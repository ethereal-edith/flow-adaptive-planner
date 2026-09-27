// AI Layer: Natural language parsing & plain-spoken explanations
// Never invents schedules. Strictly parses messy input into structured data,
// and summarizes deterministic engine results.

import { getGeminiKey, loadCalendarEvents } from '../data/storage.js';

const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function formatCalendarContext(events, now = new Date()) {
  const days = Array.from({ length: 4 }, (_, offset) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    return {
      key: day.toISOString().split('T')[0],
      label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : day.toLocaleDateString([], { weekday: 'long' })
    };
  });

  const summaries = days.map((day) => {
    const items = events
      .filter((event) => event.start_time && new Date(event.start_time).toISOString().split('T')[0] === day.key)
      .map((event) => {
        const start = new Date(event.start_time);
        const end = event.end_time ? new Date(event.end_time) : null;
        const time = end
          ? `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}-${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `${event.title} ${time}`;
      });
    return items.length ? `${day.label}: ${items.join(', ')}` : null;
  }).filter(Boolean);

  return summaries.join('. ') || 'No calendar events scheduled today through the next 3 days.';
}

/**
 * Low-level Gemini caller. Uses the x-goog-api-key header (current recommended
 * auth method) instead of the ?key= query param, disables "thinking" for
 * structured-extraction calls (thinking eats the output token budget and can
 * leave zero visible text if left on), and — critically — logs the actual
 * failure reason instead of silently falling through to the heuristic parser.
 */
async function callGemini(prompt, { thinkingLevel = 'low', maxOutputTokens = 2048 } = {}) {
  const apiKey = getGeminiKey() || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : '') || '';
  if (!apiKey) {
    console.info('[Flow AI] No Gemini API key configured (VITE_GEMINI_API_KEY) — using local heuristic parser.');
    return null;
  }

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens,
          thinkingConfig: { thinkingLevel }
        }
      })
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '(no body)');
      console.warn(`[Flow AI] Gemini request failed: HTTP ${response.status} ${response.statusText} — ${bodyText}`);
      return null;
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';

    if (!text) {
      // This is the exact failure mode that was previously silent: the request
      // succeeded but no visible text came back (commonly because thinking
      // tokens consumed the whole output budget, or the model hit a stop
      // reason before writing an answer).
      console.warn('[Flow AI] Gemini returned no text content.', {
        finishReason: candidate?.finishReason,
        usage: data.usageMetadata
      });
      return null;
    }

    return text;
  } catch (e) {
    console.warn('[Flow AI] Gemini call threw an exception, falling back to local heuristic:', e);
    return null;
  }
}

/**
 * Parses messy natural language input into structured tasks and state updates,
 * plus a short warm "talk" acknowledging the user's state before any plan
 * is proposed (the sequence your planning spec calls for: understand → talk →
 * recommend, never straight to a task list).
 */
export async function parseNaturalLanguageInput(userInput, currentState = {}) {
  const calendarSummary = formatCalendarContext(await loadCalendarEvents());

  const prompt = `You are the reasoning layer for 'Flow — Adaptive Planner'.
The user is a university student and software developer with fluctuating energy and time blindness, sometimes managing ADHD, low mood, or a depleted physical state (poor sleep, poor food intake). Be accurate, not literal-minded. Never moralize, never say "just try harder", never assume every mentioned task must happen today.

Current day: ${new Date().toISOString().split('T')[0]}.
Existing calendar commitments: ${calendarSummary}
User input: "${userInput}"

CRITICAL RULES FOR TASK EXTRACTION:
- Only extract something as a task if the user is describing an action they need or want to DO (e.g. "do laundry", "finish school work", "clean my room").
- NEVER extract a task from a clause that only describes a feeling, physical state, or reaction (e.g. "I feel lazy", "I've only eaten chips", "I feel annoyed because tomorrow is Monday", "I feel groggy"). These clauses exist ONLY to inform detected_energy, detected_stress, and state_note — they must never appear as an extracted_tasks entry.
- If a single task-like phrase is followed by an explanatory reason clause (e.g. "finish school work but I feel lazy"), extract ONLY the actionable part ("Finish school work") as the task, and route the rest into state_note.
- Low sleep quality (e.g. slept all day / overslept), poor nutrition (e.g. "only ate chips"), and dread about the coming day/week are all strong signals of low energy and elevated stress — reflect this in detected_energy and detected_stress even if the user never says the words "tired" or "stressed" directly.
- Do not invent a deadline for a task unless the user stated or clearly implied one.

TALK RULE:
- Write one short (1-3 sentence) acknowledgment of the user's actual state, in a warm, direct, non-judgmental, non-motivational-poster tone. Reframe things like "lazy" as depleted/overwhelmed where the input supports it. Do not include a plan or task list in this field — that comes later.

Respond strictly with a JSON object (no markdown fences, raw JSON only) matching this schema:
{
  "talk": string,
  "detected_energy": number or null (1 to 5),
  "detected_stress": number or null (1 to 5),
  "state_note": string or null,
  "extracted_tasks": [
    {
      "title": string,
      "estimated_duration": number (minutes, default 30-45 if unspecified),
      "cognitive_load": number (1 to 5, where 1=chores/admin/mindless, 5=heavy coding/math/writing),
      "importance": number (1 to 5),
      "category": string ("coding" | "coursework" | "language" | "chores" | "admin" | "personal"),
      "deadline_relative": string or null ("today" | "tomorrow" | "tuesday" | "friday" | null),
      "flexibility": "flexible" | "fixed"
    }
  ]
}`;

  const text = await callGemini(prompt);
  if (text) {
    try {
      return normalizeParsedResult(JSON.parse(text));
    } catch (e) {
      console.warn('[Flow AI] Gemini returned malformed JSON, falling back to local heuristic:', e, text);
    }
  }

  // Robust Local Heuristic NLP Parser (Works offline / zero-config / Gemini failure)
  return parseLocallyWithHeuristics(userInput, currentState);
}

/**
 * Deterministic local NLP parser for zero-setup execution
 */
function parseLocallyWithHeuristics(input, currentState = {}) {
  const lower = input.toLowerCase();
  let energy = currentState.energy ?? 3;
  let stress = currentState.stress ?? 3;
  let note = input;

  // Energy detection
  if (lower.includes('exhausted') || lower.includes('drained') || lower.includes('barely awake') || lower.includes('zero energy')) {
    energy = 1;
  } else if (lower.includes('tired') || lower.includes('low energy') || lower.includes('sluggish') || lower.includes('cant focus') || lower.includes("can't focus")) {
    energy = 2;
  } else if (lower.includes('feeling great') || lower.includes('high energy') || lower.includes('fresh') || lower.includes('wired')) {
    energy = 5;
  } else if (lower.includes('good') || lower.includes('well rested')) {
    energy = 4;
  }

  // Stress detection
  if (lower.includes('overwhelmed') || lower.includes('panicking') || lower.includes('stressed out') || lower.includes('too much')) {
    stress = 5;
  } else if (lower.includes('stressed') || lower.includes('behind') || lower.includes('anxious')) {
    stress = 4;
  }

  const tasks = [];
  const clauses = input.split(/[,;\n]|\band\b/i).map(s => s.trim()).filter(s => s.length > 2);

  for (const clause of clauses) {
    const cLower = clause.toLowerCase();

    // Ignore pure feeling clauses
    if (
      cLower.match(/^(i'm|im|i am|feeling)\s+(exhausted|tired|stressed|overwhelmed|fine|okay)/i) &&
      !cLower.includes('assignment') && !cLower.includes('laundry') && !cLower.includes('study')
    ) {
      continue;
    }

    let title = clause.replace(/^(i have|i need to|got to|do|finish|work on)\s+/i, '').trim();
    if (!title) continue;

    title = title.charAt(0).toUpperCase() + title.slice(1);

    let category = 'personal';
    let cognitive_load = 3;
    let importance = 3;
    let estimated_duration = 45;
    let deadline_relative = null;

    if (cLower.includes('laundry') || cLower.includes('clean') || cLower.includes('dishes') || cLower.includes('cook') || cLower.includes('tidy')) {
      category = 'chores';
      cognitive_load = 1;
      estimated_duration = 35;
      importance = 3;
    } else if (cLower.includes('german') || cLower.includes('spanish') || cLower.includes('vocab') || cLower.includes('anki') || cLower.includes('duolingo')) {
      category = 'language';
      cognitive_load = 2;
      estimated_duration = 25;
      importance = 4;
    } else if (cLower.includes('db') || cLower.includes('database') || cLower.includes('code') || cLower.includes('coding') || cLower.includes('bug') || cLower.includes('api') || cLower.includes('git')) {
      category = 'coding';
      cognitive_load = 5;
      estimated_duration = 90;
      importance = 5;
    } else if (cLower.includes('assignment') || cLower.includes('lecture') || cLower.includes('paper') || cLower.includes('study') || cLower.includes('exam')) {
      category = 'coursework';
      cognitive_load = 4;
      estimated_duration = 60;
      importance = 4;
    } else if (cLower.includes('email') || cLower.includes('form') || cLower.includes('reply') || cLower.includes('call') || cLower.includes('admin')) {
      category = 'admin';
      cognitive_load = 2;
      estimated_duration = 20;
      importance = 3;
    }

    if (cLower.includes('tomorrow')) {
      deadline_relative = 'tomorrow';
    } else if (cLower.includes('tuesday')) {
      deadline_relative = 'tuesday';
    } else if (cLower.includes('today') || cLower.includes('tonight')) {
      deadline_relative = 'today';
    }

    tasks.push({
      title,
      estimated_duration,
      cognitive_load,
      importance,
      category,
      deadline_relative,
      flexibility: 'flexible'
    });
  }

  return {
    talk: heuristicTalk(energy, stress),
    detected_energy: energy,
    detected_stress: stress,
    state_note: note,
    extracted_tasks: tasks
  };
}

function heuristicTalk(energy, stress) {
  if (energy <= 2 && stress >= 4) {
    return "Okay — you're running on empty and stress is high. This isn't a discipline problem, it's a capacity problem. Let's keep today small and realistic.";
  }
  if (energy <= 2) {
    return "Sounds like there's not much in the tank right now. We'll keep today's plan light instead of trying to force a full day out of it.";
  }
  if (stress >= 4) {
    return "There's a lot piling up at once. Let's sort out what actually needs to happen versus what can wait, instead of trying to hold it all in your head.";
  }
  if (energy >= 4) {
    return "You've got real energy to work with right now — good time to put it toward the harder stuff.";
  }
  return "Got it — let's see what fits realistically into today.";
}

function normalizeParsedResult(parsed) {
  return {
    talk: parsed.talk || null,
    detected_energy: parsed.detected_energy || null,
    detected_stress: parsed.detected_stress || null,
    state_note: parsed.state_note || null,
    extracted_tasks: (parsed.extracted_tasks || []).map(t => ({
      title: t.title || 'Untitled Task',
      estimated_duration: Number(t.estimated_duration) || 30,
      cognitive_load: Math.min(5, Math.max(1, Number(t.cognitive_load) || 3)),
      importance: Math.min(5, Math.max(1, Number(t.importance) || 3)),
      category: t.category || 'personal',
      deadline_relative: t.deadline_relative || null,
      flexibility: t.flexibility || 'flexible'
    }))
  };
}

/**
 * Generates plain-language explanation of scheduling trade-offs
 */
export async function explainScheduleChanges({ scheduled, postponed, energy, stress, reality }) {
  const highCogPostponed = postponed.filter(t => (t.cognitive_load || 3) >= 4);
  const scheduledCount = scheduled.length;
  const postponedCount = postponed.length;

  let text = '';

  if (energy <= 2) {
    if (highCogPostponed.length > 0) {
      const names = highCogPostponed.map(t => t.title).join(' and ');
      const verb = highCogPostponed.length === 1 ? 'has' : 'have';
      text += `Energy is low today (${energy}/5), so ${names} ${verb} moved to tomorrow's longer focus block. `;
    }
    const lowCogScheduled = scheduled.filter(t => (t.cognitive_load || 3) <= 2).map(t => t.title);
    if (lowCogScheduled.length > 0) {
      const verb = lowCogScheduled.length === 1 ? 'is' : 'are';
      text += `${lowCogScheduled.join(' and ')} ${verb} kept for today since ${lowCogScheduled.length === 1 ? 'it requires' : 'they require'} minimal cognitive effort. `;
    }
    if (!text) {
      text += scheduledCount > 0
        ? `Energy is low today (${energy}/5). ${scheduledCount} manageable task${scheduledCount === 1 ? '' : 's'} fit into today's open time. `
        : `Energy is low today (${energy}/5). Nothing was scheduled yet — add a task or two and Flow will fit them where they're realistic. `;
    }
  } else if (energy >= 4) {
    text += `Energy is high (${energy}/5). High-focus tasks have been scheduled first in your prime windows. `;
  } else {
    text += `Standard schedule aligned with deadline priorities and ${scheduledCount} available slot${scheduledCount === 1 ? '' : 's'}. `;
  }

  if (reality?.isUnrealistic) {
    text += `\n\nReality warning: ${reality.warning}`;
  }

  if (postponedCount > 0 && !text.includes('moved')) {
    text += ` ${postponedCount} task${postponedCount === 1 ? ' was' : 's were'} deferred because today's free blocks are full.`;
  }

  return text.trim();
}

/**
 * Heuristic micro-step templates, keyed by category, used as a fallback and
 * as the base the Gemini prompt is asked to refine. Each step stays under
 * ~5 minutes so an overwhelming task has a genuinely tiny first move.
 */
const MICRO_STEP_TEMPLATES = {
  chores: (title) => [
    { step: `Do just the first physical motion for "${title}"`, minutes: 3 },
    { step: 'Keep going for one continuous stretch', minutes: null },
    { step: 'Put everything back / reset the space', minutes: 5 }
  ],
  coding: (title) => [
    { step: `Open the file(s) and reread where you left off on "${title}"`, minutes: 5 },
    { step: 'Pick ONE sub-piece to try first — not the whole thing', minutes: 5 },
    { step: 'Work in one uninterrupted stretch', minutes: null },
    { step: 'Jot a one-line note on what to pick up next time', minutes: 3 }
  ],
  coursework: (title) => [
    { step: `Open the material for "${title}" — no reading yet, just open it`, minutes: 2 },
    { step: 'Read or work through the first small section only', minutes: 10 },
    { step: 'Continue for one focused block', minutes: null }
  ],
  language: (title) => [
    { step: `Open the app / notes for "${title}"`, minutes: 2 },
    { step: 'Do the first set of items only', minutes: null }
  ],
  admin: (title) => [
    { step: `Open whatever "${title}" requires (form, email, tab)`, minutes: 2 },
    { step: 'Fill in / write just the first field or line', minutes: 3 },
    { step: 'Finish and send', minutes: null }
  ],
  personal: (title) => [
    { step: `Take the smallest possible first step on "${title}"`, minutes: 5 },
    { step: 'Continue if it still feels doable', minutes: null }
  ]
};

/**
 * Breaks an overwhelming task into 3-5 tiny starting steps. Tries Gemini for
 * a task-specific breakdown; falls back to a category template so this
 * never fails even offline.
 */
export async function generateMicroSteps(task) {
  const prompt = `Break the task "${task.title}" (category: ${task.category || 'personal'}, estimated ${task.estimated_duration || 30} minutes) into 3 to 5 tiny starting steps for someone who is stuck or overwhelmed. The FIRST step must take 5 minutes or less and require zero decisions. Do not include motivational language. Respond strictly with a JSON array (no markdown fences), each item shaped as {"step": string, "minutes": number or null}. Use null minutes only for a step meant to fill the remaining time.`;

  const text = await callGemini(prompt, { thinkingLevel: 'low', maxOutputTokens: 512 });
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((s) => ({ step: String(s.step || ''), minutes: s.minutes ?? null })).filter((s) => s.step);
      }
    } catch (e) {
      console.warn('[Flow AI] Micro-step JSON parse failed, using template fallback:', e, text);
    }
  }

  const template = MICRO_STEP_TEMPLATES[task.category] || MICRO_STEP_TEMPLATES.personal;
  return template(task.title);
}

/**
 * Suggests a background-stimulation pairing for low-cognitive-load, repetitive
 * tasks (music / podcast / storytime) — never for high-cognitive-load focus
 * work, where stimulation competes for the same attention the task needs.
 */
export function suggestStimulationPairing(task) {
  const cogLoad = Number(task.cognitive_load) || 3;
  if (cogLoad >= 4) return null; // deep-focus work: silence or instrumental only, not a "pairing"

  const byCategory = {
    chores: 'Try pairing this with a podcast, a storytime, or music — chores go faster with something in your ears.',
    admin: 'This is mindless enough to pair with a podcast or low-key music in the background.',
    language: 'Some quiet instrumental music in the background can help here without competing with the words.'
  };

  return byCategory[task.category] || null;
}
