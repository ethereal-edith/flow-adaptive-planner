import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  X,
  RotateCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListTree,
  Headphones
} from 'lucide-react';
import {
  parseNaturalLanguageInput,
  explainScheduleChanges,
  generateMicroSteps,
  suggestStimulationPairing
} from '../ai/llmService';
import { generateAdaptiveSchedule } from '../engine/planningEngine';

/**
 * A single task row within the results preview — scheduled or postponed.
 * Handles its own "why is this here?" expand state and its own on-demand
 * micro-step breakdown, so the parent modal doesn't need per-task state.
 */
function PlannedTaskRow({ task, kind }) {
  const [showReasons, setShowReasons] = useState(false);
  const [steps, setSteps] = useState(null);
  const [loadingSteps, setLoadingSteps] = useState(false);

  const reasons = task.reasons || [];
  const stimulationTip = suggestStimulationPairing(task);

  const handleBreakDown = async () => {
    if (steps) {
      setSteps(null); // toggle off if already shown
      return;
    }
    setLoadingSteps(true);
    try {
      const result = await generateMicroSteps(task);
      setSteps(result);
    } finally {
      setLoadingSteps(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#F1E5E1] bg-[#FFF9F7] p-3.5 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[#3E3A3F] truncate">{task.title}</p>
          <p className="text-[#857C82] mt-0.5">
            {kind === 'scheduled'
              ? `${task.startTimeStr} – ${task.endTimeStr} · ${task.adjustedDuration || task.estimated_duration}m`
              : task.postpone_reason}
          </p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wide font-semibold text-[#A89E9B]">
          {task.category}
        </span>
      </div>

      {stimulationTip && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[#7E6596]">
          <Headphones className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{stimulationTip}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-3">
        {reasons.length > 0 && (
          <button
            onClick={() => setShowReasons((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-[#8A5265] hover:text-[#6B3E4F] cursor-pointer"
          >
            <span>Why?</span>
            {showReasons ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
        <button
          onClick={handleBreakDown}
          disabled={loadingSteps}
          className="flex items-center gap-1 text-[11px] font-medium text-[#8A5265] hover:text-[#6B3E4F] cursor-pointer disabled:opacity-50"
        >
          <ListTree className="w-3 h-3" />
          <span>{loadingSteps ? 'Breaking down…' : steps ? 'Hide steps' : 'Break it down'}</span>
        </button>
      </div>

      {showReasons && reasons.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-[#F1E5E1] pt-2">
          {reasons.map((r, i) => (
            <li key={i} className="text-[#6B6168]">• {r}</li>
          ))}
        </ul>
      )}

      {steps && (
        <ol className="mt-2 space-y-1 border-t border-[#F1E5E1] pt-2 list-decimal list-inside">
          {steps.map((s, i) => (
            <li key={i} className="text-[#6B6168]">
              {s.step}
              {s.minutes != null && <span className="text-[#A89E9B]"> — {s.minutes} min</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function AiPlannerModal({
  isOpen,
  onClose,
  tasks,
  calendarEvents,
  dailyState,
  preferences,
  onApplyPlan
}) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const presets = [
    "I'm exhausted, I have an assignment due Tuesday, German tomorrow, and laundry",
    "What should I do right now? I feel completely drained.",
    "Woke up feeling sharp and rested. Let's tackle the hardest coding work today.",
    "I fell behind by 2 hours because of a lab run. What needs to move?"
  ];

  const handleProcess = async (textToUse) => {
    const text = textToUse || inputText;
    if (!text.trim()) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const parsed = await parseNaturalLanguageInput(text, dailyState);

      const updatedDailyState = {
        ...dailyState,
        energy: parsed.detected_energy !== null ? parsed.detected_energy : dailyState.energy,
        stress: parsed.detected_stress !== null ? parsed.detected_stress : dailyState.stress,
        note: parsed.state_note || dailyState.note
      };

      const newTasksToAdd = (parsed.extracted_tasks || []).map((t, idx) => ({
        id: `task-ai-${Date.now()}-${idx}`,
        title: t.title,
        description: 'Added via natural-language input',
        estimated_duration: t.estimated_duration,
        actual_duration: null,
        deadline: t.deadline_relative === 'today'
          ? new Date(Date.now() + 6 * 3600 * 1000).toISOString()
          : t.deadline_relative === 'tomorrow'
          ? new Date(Date.now() + 24 * 3600 * 1000).toISOString()
          : t.deadline_relative === 'tuesday'
          ? new Date(Date.now() + 48 * 3600 * 1000).toISOString()
          : null,
        importance: t.importance,
        cognitive_load: t.cognitive_load,
        flexibility: t.flexibility,
        category: t.category,
        status: 'pending',
        preferred_time_of_day: 'any',
        postponed_count: 0,
        postpone_reason: null,
        created_at: new Date().toISOString()
      }));

      const existingTitles = new Set(tasks.map((t) => t.title.toLowerCase()));
      const filteredNew = newTasksToAdd.filter((t) => !existingTitles.has(t.title.toLowerCase()));
      const combinedTasks = [...tasks, ...filteredNew];

      const scheduleResult = generateAdaptiveSchedule({
        tasks: combinedTasks,
        calendarEvents,
        dailyState: updatedDailyState,
        preferences,
        trigger: 'natural_language'
      });

      const plainExplanation = await explainScheduleChanges({
        scheduled: scheduleResult.scheduledToday,
        postponed: scheduleResult.postponedTasks,
        energy: updatedDailyState.energy,
        stress: updatedDailyState.stress,
        reality: scheduleResult.reality
      });

      setResult({
        parsed,
        updatedDailyState,
        combinedTasks,
        scheduleResult,
        plainExplanation
      });
    } catch (err) {
      console.error('AI planning error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApplyPlan({
      dailyState: result.updatedDailyState,
      tasks: result.combinedTasks,
      scheduledToday: result.scheduleResult.scheduledToday,
      postponedTasks: result.scheduleResult.postponedTasks,
      reality: result.scheduleResult.reality,
      decision: result.scheduleResult.decisionRecord
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3E3A3F]/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-[#F3EAE7] bg-white shadow-soft-lg p-6 sm:p-7 overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F3EAE7]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#EAE4F2] flex items-center justify-center text-sm shadow-soft">
              <Sparkles className="w-4 h-4 text-[#7E6596]" />
            </div>
            <div>
              <h2 className="text-base font-heading font-bold text-[#3E3A3F]">Ask Flow</h2>
              <p className="text-xs text-[#857C82]">
                Tell me what's on your mind and I'll adapt your schedule.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-[#FFF9F7] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Area */}
        <div className="space-y-3.5 pt-4">
          <label className="block text-xs font-medium text-[#6B6168]">
            What's going on right now? (deadlines, tiredness, errands...)
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. I'm exhausted, I have an assignment due Tuesday, German tomorrow, and laundry..."
              className="w-full text-sm bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl p-4 text-[#3E3A3F] placeholder-[#B0A6A3] focus:outline-none focus:border-[#F8C8DC]"
            />
            <button
              onClick={() => handleProcess()}
              disabled={isProcessing || !inputText.trim()}
              className="absolute right-3 bottom-3 px-4 py-2 rounded-full bg-[#F8C8DC] hover:bg-[#F2ADC5] disabled:opacity-50 text-[#3E3A3F] text-xs font-semibold flex items-center gap-1.5 shadow-soft transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Reason & Plan</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-[11px] text-[#A89E9B] font-medium">Try these examples:</span>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputText(preset);
                    handleProcess(preset);
                  }}
                  className="text-left text-xs bg-[#FFF9F7] hover:bg-[#FCEEE6] border border-[#F1E5E1] text-[#695D64] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
                >
                  "{preset}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Preview */}
        {result && (
          <div className="mt-6 pt-5 border-t border-[#F3EAE7] space-y-4">

            {/* The "Talk" — short acknowledgment before any plan is shown */}
            {result.parsed.talk && (
              <div className="rounded-2xl bg-[#EAE4F2]/50 border border-[#DCD0E8] p-4 sm:p-5">
                <p className="text-sm text-[#4A4247] leading-relaxed italic">
                  {result.parsed.talk}
                </p>
              </div>
            )}

            {/* Plain-Language Explanation / Recommendation */}
            <div className="rounded-2xl bg-[#FFF8FA] border border-[#F7DFE6] p-4 sm:p-5">
              <h4 className="text-xs font-heading font-bold text-[#8A5265] uppercase tracking-wider mb-1.5">
                🌸 Engine Recommendation
              </h4>
              <p className="text-sm text-[#4A4247] leading-relaxed">
                "{result.plainExplanation}"
              </p>
            </div>

            {/* Extracted Capacity & Scheduler summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1]">
                <span className="text-[#857C82] block mb-1">Detected Capacity:</span>
                <span className="text-[#3E3A3F] font-semibold">
                  Energy: {result.updatedDailyState.energy}/5 · Stress: {result.updatedDailyState.stress}/5
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1]">
                <span className="text-[#857C82] block mb-1">Today's Schedule:</span>
                <span className="text-[#3E3A3F] font-semibold">
                  {result.scheduleResult.scheduledToday.length} tasks scheduled · {result.scheduleResult.postponedTasks.length} deferred
                </span>
              </div>
            </div>

            {/* Per-task breakdown: scheduled */}
            {result.scheduleResult.scheduledToday.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-[#A89E9B] font-medium uppercase tracking-wide">
                  Scheduled today
                </span>
                <div className="space-y-2">
                  {result.scheduleResult.scheduledToday.map((task) => (
                    <PlannedTaskRow key={task.id} task={task} kind="scheduled" />
                  ))}
                </div>
              </div>
            )}

            {/* Per-task breakdown: postponed */}
            {result.scheduleResult.postponedTasks.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] text-[#A89E9B] font-medium uppercase tracking-wide">
                  Moved / deferred
                </span>
                <div className="space-y-2">
                  {result.scheduleResult.postponedTasks.map((task) => (
                    <PlannedTaskRow key={task.id} task={task} kind="postponed" />
                  ))}
                </div>
              </div>
            )}

            {/* Apply Action */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-medium text-[#857C82] hover:text-[#3E3A3F]"
              >
                Discard
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#F8C8DC] hover:bg-[#F2ADC5] text-[#3E3A3F] text-xs font-semibold shadow-soft transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply to my schedule</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
