-- ====================================================================
-- Flow — Adaptive Planner Database Schema (PostgreSQL / Supabase)
-- ====================================================================

-- 1. Users profile table. Authentication is handled by Supabase Auth.
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    timezone TEXT DEFAULT 'Europe/Berlin'
);

-- 2. User Preferences (rigid bounds, buffers, personalized time multipliers)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    wake_time TIME NOT NULL DEFAULT '08:00',
    sleep_time TIME NOT NULL DEFAULT '23:30',
    buffer_minutes INTEGER NOT NULL DEFAULT 10,
    max_high_focus_blocks_per_day INTEGER NOT NULL DEFAULT 2,
    category_multipliers JSONB NOT NULL DEFAULT '{"coding": 1.35, "coursework": 1.25, "admin": 1.1, "chores": 1.0, "language": 1.15, "personal": 1.0}'::jsonb,
    google_calendar_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Calendar Events (Fixed commitments — Rigid Skeleton: classes, exams, sleep, meals)
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    origin TEXT NOT NULL DEFAULT 'committed' CHECK (origin IN ('committed', 'adaptive')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'google')),
    google_event_id TEXT,
    google_calendar_id TEXT,
    category TEXT NOT NULL CHECK (category IN ('class', 'deadline', 'sleep', 'meal', 'work', 'appointment', 'other')),
    is_fixed BOOLEAN NOT NULL DEFAULT true,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_google_event
    ON public.calendar_events(user_id, google_event_id);

-- 9. Google OAuth tokens. Access is mediated by the Edge Function; RLS still
-- scopes any direct access to the authenticated owner.
CREATE TABLE IF NOT EXISTS public.user_google_tokens (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    scope TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Daily State (Fluctuating energy, stress, capacity)
CREATE TABLE IF NOT EXISTS public.daily_states (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    energy INTEGER NOT NULL CHECK (energy >= 1 AND energy <= 5),
    stress INTEGER NOT NULL CHECK (stress >= 1 AND stress <= 5),
    available_time_minutes INTEGER NOT NULL DEFAULT 360,
    note TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- 5. Tasks (Flexible & semi-fixed items to schedule)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    origin TEXT NOT NULL DEFAULT 'adaptive' CHECK (origin IN ('committed', 'adaptive')),
    estimated_duration INTEGER NOT NULL CHECK (estimated_duration > 0), -- in minutes
    actual_duration INTEGER, -- in minutes
    deadline TIMESTAMPTZ,
    importance INTEGER NOT NULL DEFAULT 3 CHECK (importance >= 1 AND importance <= 5),
    cognitive_load INTEGER NOT NULL DEFAULT 3 CHECK (cognitive_load >= 1 AND cognitive_load <= 5),
    flexibility TEXT NOT NULL DEFAULT 'flexible' CHECK (flexibility IN ('fixed', 'flexible')),
    category TEXT NOT NULL DEFAULT 'coursework' CHECK (category IN ('coursework', 'coding', 'admin', 'chores', 'language', 'personal', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'postponed')),
    preferred_time_of_day TEXT NOT NULL DEFAULT 'any' CHECK (preferred_time_of_day IN ('morning', 'afternoon', 'evening', 'any')),
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    postponed_count INTEGER NOT NULL DEFAULT 0,
    postpone_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMPTZ
);

-- 6. Task Dependencies
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(task_id, depends_on_task_id)
);

-- 7. Scheduling Decisions (Audit log of every schedule recalculation)
CREATE TABLE IF NOT EXISTS public.scheduling_decisions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    trigger TEXT NOT NULL CHECK (trigger IN ('initial_plan', 'replan', 'missed_task', 'energy_shift', 'natural_language', 'manual_shift')),
    available_minutes INTEGER NOT NULL,
    scheduled_minutes INTEGER NOT NULL,
    is_unrealistic BOOLEAN NOT NULL DEFAULT false,
    reality_warning TEXT,
    changes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    plain_explanation TEXT NOT NULL
);

-- 8. Task Outcomes (Tracks estimated vs actual duration and energy for time model)
CREATE TABLE IF NOT EXISTS public.task_outcomes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    estimated_duration INTEGER NOT NULL,
    actual_duration INTEGER NOT NULL,
    duration_ratio NUMERIC(5,2) GENERATED ALWAYS AS (ROUND((actual_duration::numeric / NULLIF(estimated_duration, 0)::numeric), 2)) STORED,
    energy_at_time INTEGER CHECK (energy_at_time >= 1 AND energy_at_time <= 5),
    cognitive_load INTEGER CHECK (cognitive_load >= 1 AND cognitive_load <= 5),
    completed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON public.calendar_events(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_daily_states_user_date ON public.daily_states(user_id, date);
CREATE INDEX IF NOT EXISTS idx_task_outcomes_user_category ON public.task_outcomes(user_id, category);

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

-- Auth profile creation and ownership policies.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Users can access their own profile" ON public.users
    FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Users can access their own preferences" ON public.user_preferences
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can access their own calendar events" ON public.calendar_events
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can access their own daily states" ON public.daily_states
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can access their own tasks" ON public.tasks
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can access their own dependencies" ON public.task_dependencies
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.tasks
                WHERE tasks.id = task_dependencies.task_id AND tasks.user_id = auth.uid()
    )) WITH CHECK (EXISTS (
        SELECT 1 FROM public.tasks
                WHERE tasks.id = task_dependencies.task_id AND tasks.user_id = auth.uid()
    ) AND EXISTS (
        SELECT 1 FROM public.tasks
                WHERE tasks.id = task_dependencies.depends_on_task_id AND tasks.user_id = auth.uid()
    ));

CREATE POLICY "Users can access their own scheduling decisions" ON public.scheduling_decisions
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can access their own task outcomes" ON public.task_outcomes
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can access their own Google tokens" ON public.user_google_tokens
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
