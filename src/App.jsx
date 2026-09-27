import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import TodayView from './components/TodayView';
import TasksView from './components/TasksView';
import CalendarView from './components/CalendarView';
import InsightsView from './components/InsightsView';
import TaskModal from './components/TaskModal';
import CompletionModal from './components/CompletionModal';
import AiPlannerModal from './components/AiPlannerModal';
import SettingsModal from './components/SettingsModal';
import AuthScreen from './components/AuthScreen';
import {
  INITIAL_DAILY_STATE,
  INITIAL_USER_PREFERENCES
} from './data/initialData';
import {
  beginGoogleCalendarConnect,
  completeGoogleCalendarConnect,
  syncGoogleCalendar
} from './data/googleCalendar';

import {
  loadTasks,
  saveTasks,
  loadCalendarEvents,
  loadDailyState,
  saveDailyState,
  loadPreferences,
  savePreferences,
  loadSchedulingDecisions,
  saveSchedulingDecision,
  loadTaskOutcomes,
  recordTaskOutcome,
  resetToSeedData,
  getSupabaseClient,
  ensureUserProfile,
  hasLegacyData,
  importLegacyData,
  discardLegacyData
} from './data/storage';

import {
  generateAdaptiveSchedule,
  handleAdaptiveReschedule
} from './engine/planningEngine';
import { deriveLearnedMultipliers } from './engine/personalizedTimeModel';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setAuthLoading(false);
      return undefined;
    }

    client.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen text-[#857C82] text-sm bg-[#FFF9F7]">Opening Flow...</div>;
  }

  if (!session) return <AuthScreen />;
  return <PlannerApp />;
}

function PlannerApp() {
  const [activeTab, setActiveTab] = useState('today');

  // Core Data State
  const [tasks, setTasks] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [dailyState, setDailyState] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [schedulingDecisions, setSchedulingDecisions] = useState([]);
  const [taskOutcomes, setTaskOutcomes] = useState([]);

  // Scheduler derived state
  const [scheduledToday, setScheduledToday] = useState([]);
  const [postponedTasks, setPostponedTasks] = useState([]);
  const [fixedEventsToday, setFixedEventsToday] = useState([]);
  const [reality, setReality] = useState(null);

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);

  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [calendarSyncNotice, setCalendarSyncNotice] = useState(null);
  const [initializationError, setInitializationError] = useState(null);
  const initializationPromiseRef = useRef(null);
  const isMountedRef = useRef(false);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    const initialize = async () => {
      try {
        if (new URLSearchParams(window.location.search).has('code')) {
          const connectedCalendars = await completeGoogleCalendarConnect();
          setGoogleCalendars(connectedCalendars?.calendars || []);
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsSettingsModalOpen(true);
        }

        if (hasLegacyData()) {
          const shouldImport = window.confirm('Import your existing Flow data into your new account?');
          if (shouldImport) await importLegacyData();
          else discardLegacyData();
        }

        await ensureUserProfile();
        const [loadedTasks, initialEvents, loadedState, loadedPrefs, loadedDecisions, loadedOutcomes] = await Promise.all([
          loadTasks(),
          loadCalendarEvents(),
          loadDailyState(),
          loadPreferences(),
          loadSchedulingDecisions(),
          loadTaskOutcomes()
        ]);

        let loadedEvents = initialEvents;
        if (loadedPrefs.google_calendar_ids?.length) {
          await syncGoogleCalendar(loadedPrefs.google_calendar_ids);
          loadedEvents = await loadCalendarEvents();
        }

        if (!isMountedRef.current) return;
        setTasks(loadedTasks);
        setCalendarEvents(loadedEvents);
        setDailyState(loadedState);
        setPreferences(loadedPrefs);
        setSchedulingDecisions(loadedDecisions);
        setTaskOutcomes(loadedOutcomes);
        await runScheduler(loadedTasks, loadedEvents, loadedState, loadedPrefs, 'initial_plan');
      } catch (error) {
        console.error('Flow initialization failed:', error);
        if (isMountedRef.current) {
          setInitializationError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    if (!initializationPromiseRef.current) {
      initializationPromiseRef.current = initialize();
    }

    const currentPromise = initializationPromiseRef.current;
    currentPromise.then(
      () => {
        if (initializationPromiseRef.current === currentPromise) {
          initializationPromiseRef.current = null;
        }
      },
      () => {
        if (initializationPromiseRef.current === currentPromise) {
          initializationPromiseRef.current = null;
        }
      }
    );

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Central deterministic scheduler runner
  async function runScheduler(currTasks, currEvents, currState, currPrefs, trigger = 'replan') {
    if (!currTasks || !currEvents || !currState || !currPrefs) return;

    const result = generateAdaptiveSchedule({
      tasks: currTasks,
      calendarEvents: currEvents,
      dailyState: currState,
      preferences: currPrefs,
      trigger
    });

    setScheduledToday(result.scheduledToday);
    setPostponedTasks(result.postponedTasks);
    setFixedEventsToday(result.fixedEvents);
    setReality(result.reality);

    if (result.decisionRecord) {
      await saveSchedulingDecision(result.decisionRecord);
      setSchedulingDecisions(await loadSchedulingDecisions());
    }
  }

  // Quick energy switcher handler
  const handleUpdateEnergy = async (newEnergy) => {
    const updatedState = {
      ...dailyState,
      energy: newEnergy,
      available_time_minutes: dailyState.available_time_minutes
        ?? INITIAL_DAILY_STATE.available_time_minutes,
      updated_at: new Date().toISOString()
    };
    setDailyState(updatedState);
    await saveDailyState(updatedState);
    await runScheduler(tasks, calendarEvents, updatedState, preferences, 'energy_shift');
  };

  // Replan button handler
  const handleManualReplan = async () => {
    await runScheduler(tasks, calendarEvents, dailyState, preferences, 'manual_shift');
  };

  const handleSyncGoogle = async (calendarIds = preferences?.google_calendar_ids || []) => {
    setGoogleSyncing(true);
    try {
      const previousGoogleEvents = calendarEvents.filter((event) => event.source === 'google');
      await syncGoogleCalendar(calendarIds);
      const updatedEvents = await loadCalendarEvents();
      const updatedByGoogleId = new Map(updatedEvents.map((event) => [event.google_event_id, event]));
      const removed = previousGoogleEvents.find((event) => !updatedByGoogleId.has(event.google_event_id));
      const moved = previousGoogleEvents.find((event) => {
        const current = updatedByGoogleId.get(event.google_event_id);
        return current && (current.start_time !== event.start_time || current.end_time !== event.end_time);
      });
      if (removed) {
        setCalendarSyncNotice(`Your ${removed.title} was cancelled or removed from Google Calendar — that block is free now.`);
      } else if (moved) {
        setCalendarSyncNotice(`Your ${moved.title} changed on Google Calendar — today's schedule was refreshed.`);
      }
      setCalendarEvents(updatedEvents);
      await runScheduler(tasks, updatedEvents, dailyState, preferences, 'replan');
    } catch (error) {
      console.error('Google Calendar sync failed:', error);
    } finally {
      setGoogleSyncing(false);
    }
  };

  useEffect(() => {
    if ((activeTab === 'today' || activeTab === 'calendar') && preferences?.google_calendar_ids?.length) {
      handleSyncGoogle(preferences.google_calendar_ids);
    }
  }, [activeTab]);

  // Adaptive Rescheduling when task was missed or fell behind
  const handleMissedTask = async (missedTaskId) => {
    const result = handleAdaptiveReschedule({
      missedTaskId,
      tasks,
      calendarEvents,
      dailyState,
      preferences,
      reason: 'Fell behind schedule — flexible tasks adapted gently.'
    });

    const updatedTasks = tasks.map((t) => {
      if (t.id === missedTaskId) {
        return {
          ...t,
          status: 'postponed',
          postponed_count: (t.postponed_count || 0) + 1,
          postpone_reason: 'Fell behind schedule; re-derived urgency into next open block.'
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    await saveTasks(updatedTasks);

    setScheduledToday(result.scheduledToday);
    setPostponedTasks(result.postponedTasks);
    setFixedEventsToday(result.fixedEvents);
    setReality(result.reality);

    if (result.decisionRecord) {
      await saveSchedulingDecision(result.decisionRecord);
      setSchedulingDecisions(await loadSchedulingDecisions());
    }
  };

  // Switch to alternative task when stuck on initiation
  const handleSwitchTask = (alternativeTask) => {
    if (!alternativeTask) return;
    const reordered = [
      alternativeTask,
      ...scheduledToday.filter((t) => t.id !== alternativeTask.id)
    ];
    setScheduledToday(reordered);
  };

  // Completion modal trigger
  const handlePromptComplete = (task) => {
    setTaskToComplete(task);
    setIsCompletionModalOpen(true);
  };

  // Confirm task completion and log outcome
  const handleConfirmCompletion = async ({ actualDuration, energyUsed }) => {
    if (!taskToComplete) return;

    const completedAt = new Date().toISOString();
    const updatedTasks = tasks.map((t) => {
      if (t.id === taskToComplete.id) {
        return {
          ...t,
          status: 'completed',
          actual_duration: actualDuration,
          completed_at: completedAt
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    await saveTasks(updatedTasks);

    const newOutcome = {
      id: `out-${Date.now()}`,
      task_id: taskToComplete.id,
      title: taskToComplete.title,
      category: taskToComplete.category,
      estimated_duration: taskToComplete.estimated_duration,
      actual_duration: actualDuration,
      ratio: Number((actualDuration / (taskToComplete.estimated_duration || 1)).toFixed(2)),
      energy_at_time: energyUsed,
      cognitive_load: taskToComplete.cognitive_load || 3,
      completed_at: completedAt
    };

    await recordTaskOutcome(newOutcome);
    const refreshedOutcomes = await loadTaskOutcomes();
    setTaskOutcomes(refreshedOutcomes);

    // Personalized time-estimation learning: fold this and every prior
    // outcome into per-category duration multipliers the scheduler already
    // reads (preferences.category_multipliers), so estimates get more
    // accurate the more Flow is used — instead of the old fixed guesses.
    const learnedMultipliers = deriveLearnedMultipliers(refreshedOutcomes, preferences?.category_multipliers);
    if (JSON.stringify(learnedMultipliers) !== JSON.stringify(preferences?.category_multipliers)) {
      const updatedPreferences = { ...preferences, category_multipliers: learnedMultipliers };
      setPreferences(updatedPreferences);
      await savePreferences(updatedPreferences);
    }

    await runScheduler(updatedTasks, calendarEvents, dailyState, preferences, 'replan');
  };

  // Save new or edited task
  const handleSaveTask = async (taskData) => {
    let updatedTasks = [];
    const exists = tasks.some((t) => t.id === taskData.id);

    if (exists) {
      updatedTasks = tasks.map((t) => (t.id === taskData.id ? taskData : t));
    } else {
      updatedTasks = [taskData, ...tasks];
    }

    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    await runScheduler(updatedTasks, calendarEvents, dailyState, preferences, 'replan');
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    await runScheduler(updatedTasks, calendarEvents, dailyState, preferences, 'replan');
  };

  // Apply AI parsed plan
  const handleApplyAiPlan = async ({ dailyState: newState, tasks: newTasks, scheduledToday: newSched, postponedTasks: newPost, reality: newReal, decision }) => {
    setDailyState(newState);
    await saveDailyState(newState);
    setTasks(newTasks);
    await saveTasks(newTasks);
    setScheduledToday(newSched);
    setPostponedTasks(newPost);
    setReality(newReal);

    if (decision) {
      await saveSchedulingDecision(decision);
      setSchedulingDecisions(await loadSchedulingDecisions());
    }
  };

  // Reset to seed data
  const handleResetData = async () => {
    await resetToSeedData();
    const [t, e, s, p, outcomes, decisions] = await Promise.all([
      loadTasks(), loadCalendarEvents(), loadDailyState(), loadPreferences(), loadTaskOutcomes(), loadSchedulingDecisions()
    ]);
    setTasks(t);
    setCalendarEvents(e);
    setDailyState(s);
    setPreferences(p);
    setTaskOutcomes(outcomes);
    setSchedulingDecisions(decisions);
    await runScheduler(t, e, s, p, 'initial_plan');
  };

  if (initializationError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FFF9F7] px-4">
        <div className="w-full max-w-md rounded-3xl border border-[#F3EAE7] bg-white p-6 shadow-soft-lg">
          <h2 className="text-base font-heading font-bold text-[#3E3A3F]">
            Flow could not finish loading
          </h2>
          <p className="mt-2 text-sm text-[#857C82]">
            {initializationError}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => {
                setInitializationError(null);
                window.location.reload();
              }}
              className="px-4 py-2 rounded-full bg-[#F8C8DC] text-xs font-semibold text-[#3E3A3F]"
            >
              Retry
            </button>
            <button
              onClick={() => {
                setTasks([]);
                setCalendarEvents([]);
                setDailyState({ ...INITIAL_DAILY_STATE });
                setPreferences({ ...INITIAL_USER_PREFERENCES });
                setInitializationError(null);
              }}
              className="px-4 py-2 rounded-full border border-[#EEDCD7] text-xs font-semibold text-[#6E646A]"
            >
              Continue anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dailyState || !preferences) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[#857C82] text-sm bg-[#FFF9F7]">
        Opening Flow...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9F7] text-[#3E3A3F] flex flex-col font-sans selection:bg-[#F8C8DC] selection:text-[#3E3A3F]">
      
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        dailyState={dailyState}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-7">
        {activeTab === 'today' && (
          <TodayView
            scheduledToday={scheduledToday}
            postponedTasks={postponedTasks}
            fixedEvents={fixedEventsToday}
            dailyState={dailyState}
            reality={reality}
            calendarSyncNotice={calendarSyncNotice}
            onUpdateEnergy={handleUpdateEnergy}
            onReplan={handleManualReplan}
            onCompleteTask={handlePromptComplete}
            onMissedTask={handleMissedTask}
            onSwitchTask={handleSwitchTask}
            onOpenTaskModal={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            tasks={tasks}
            onOpenAddModal={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
            onEditTask={(task) => {
              setTaskToEdit(task);
              setIsTaskModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onCompleteTask={handlePromptComplete}
          />
        )}

  {activeTab === 'calendar' && (
  <CalendarView
    scheduledToday={scheduledToday}
    fixedEvents={fixedEventsToday}
    allCalendarEvents={calendarEvents}
    preferences={preferences}
    calendarSyncNotice={calendarSyncNotice}
  />
)}

        {activeTab === 'insights' && (
          <InsightsView
            taskOutcomes={taskOutcomes}
            schedulingDecisions={schedulingDecisions}
            tasks={tasks}
          />
        )}
      </main>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
      />

      <CompletionModal
        isOpen={isCompletionModalOpen}
        onClose={() => setIsCompletionModalOpen(false)}
        onConfirm={handleConfirmCompletion}
        task={taskToComplete}
      />

      <AiPlannerModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        tasks={tasks}
        calendarEvents={calendarEvents}
        dailyState={dailyState}
        preferences={preferences}
        onApplyPlan={handleApplyAiPlan}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        preferences={preferences}
        onUpdatePreferences={(newPrefs) => {
          setPreferences(newPrefs);
          return savePreferences(newPrefs).then(() => runScheduler(tasks, calendarEvents, dailyState, newPrefs, 'replan'));
        }}
        onResetData={handleResetData}
        googleCalendars={googleCalendars}
        onConnectGoogle={() => {
          try {
            beginGoogleCalendarConnect();
          } catch (error) {
            window.alert(error.message);
          }
        }}
        onSyncGoogle={handleSyncGoogle}
        googleSyncing={googleSyncing}
      />

      {/* Footer */}
      <footer className="border-t border-[#F3EAE7] py-8 text-center text-xs text-[#A39996]">
        <p className="font-heading">Flow — Adaptive Planner · Protected skeleton, gentle execution · No guilt, just realistic capacity.</p>
      </footer>

    </div>
  );
}
