import React from 'react';
import {
  RotateCw,
  Clock,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';
import HeroFocus from './HeroFocus';
import RealityBanner from './RealityBanner';

export default function TodayView({
  scheduledToday = [],
  postponedTasks = [],
  fixedEvents = [],
  dailyState = {},
  reality = {},
  calendarSyncNotice = null,
  onUpdateEnergy,
  onReplan,
  onCompleteTask,
  onMissedTask,
  onSwitchTask,
  onOpenTaskModal
}) {
  const currentEnergy = dailyState.energy || 3;

  const activeTask = scheduledToday.find((t) => t.status === 'in_progress') || scheduledToday[0];
  const alternativeTask = scheduledToday.length > 1 ? scheduledToday[1] : null;

  // Timeline items
  const timelineItems = [
    ...fixedEvents.map((evt) => ({
      ...evt,
      isFixedSkeleton: true,
      timeDisplay: `${evt.startTimeStr || formatTime(evt.startMin)} - ${evt.endTimeStr || formatTime(evt.endMin)}`,
      sortTime: evt.startMin
    })),
    ...scheduledToday.map((task) => ({
      ...task,
      isFixedSkeleton: false,
      timeDisplay: `${task.startTimeStr} - ${task.endTimeStr}`,
      sortTime: task.startTimeStr ? timeToMin(task.startTimeStr) : 9999
    }))
  ].sort((a, b) => a.sortTime - b.sortTime);

  function formatTime(minutes) {
    if (minutes === undefined) return '';
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function timeToMin(str) {
    if (!str) return 0;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  }

  const energyOptions = [
    { level: 1, emoji: '🌙', label: 'Exhausted', hint: 'Gentle chores & resting' },
    { level: 2, emoji: '☁️', label: 'Low', hint: 'Flashcards & light review' },
    { level: 3, emoji: '🌤️', label: 'Okay', hint: 'Standard coursework' },
    { level: 4, emoji: '☀️', label: 'High', hint: 'Coding & deep focus' },
    { level: 5, emoji: '✨', label: 'Peak', hint: 'Hard problem solving' }
  ];

  return (
    <div className="space-y-7 pb-16">
      
      {/* Friendly Energy Check-In */}
      <div className="rounded-3xl border border-[#F3EAE7] bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-heading font-bold text-[#3E3A3F] flex items-center gap-2">
              <span>🌸</span>
              <span>How's your energy right now?</span>
            </h2>
            <p className="text-xs text-[#857C82]">
              Choose how you're feeling — Flow will adapt your schedule to match your actual capacity.
            </p>
          </div>

          <button
            onClick={onReplan}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFF9F7] hover:bg-[#FCEEE6] border border-[#EEDCD7] text-[#635359] text-xs font-semibold shadow-soft transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#857C82]" />
            <span>Replan my day</span>
          </button>
        </div>

        {/* Energy options with soft emojis */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {energyOptions.map((opt) => {
            const isSelected = currentEnergy === opt.level;
            return (
              <button
                key={opt.level}
                onClick={() => onUpdateEnergy(opt.level)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#F8C8DC]/30 border-[#F2ADC5] shadow-soft text-[#3E3A3F]'
                    : 'bg-[#FFF9F7]/70 border-[#F3EAE7] text-[#6B6168] hover:bg-white hover:border-[#E8DAD5]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{opt.emoji}</span>
                  <span className="text-xs font-heading font-bold text-[#3E3A3F]">{opt.label}</span>
                </div>
                <div className="text-[11px] text-[#857C82] truncate">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reality Check Alert */}
      <RealityBanner reality={reality} onResolveOverbook={onReplan} />

      {calendarSyncNotice && (
        <div className="rounded-2xl border border-[#EEDCD7] bg-[#FFF9F7] px-4 py-3 text-xs text-[#6E646A]">
          {calendarSyncNotice}
        </div>
      )}

      {/* "What should I do right now?" Hero Widget */}
      <HeroFocus
        currentTask={activeTask}
        alternativeTask={alternativeTask}
        onCompleteTask={onCompleteTask}
        onMissedTask={onMissedTask}
        onSwitchTask={onSwitchTask}
        dailyState={dailyState}
      />

      {/* Schedule Timeline & Set Aside Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        
        {/* Left 2 Cols: Journal-like Daily Flow */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-heading font-bold text-[#3E3A3F] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#857C82]" />
              <span>Today's Flow</span>
            </h3>
            <span className="text-xs text-[#857C82]">
              {scheduledToday.length} flexible tasks · {fixedEvents.length} protected events
            </span>
          </div>

          <div className="rounded-3xl border border-[#F3EAE7] bg-white p-5 space-y-3 shadow-soft">
            {timelineItems.length === 0 ? (
              <div className="text-center py-10 text-[#857C82] text-sm">
                No items on today's schedule yet.
              </div>
            ) : (
              timelineItems.map((item, idx) => {
                if (item.isFixedSkeleton) {
                  // Fixed commitment (Classes, Sleep, Meals)
                  return (
                    <div
                      key={`fixed-${item.id || idx}`}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1] text-[#554C51]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white border border-[#EEDCD7] text-[#857C82]">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#3E3A3F]">{item.title}</span>
                            <span className="text-[10px] font-heading font-medium px-2 py-0.5 rounded-full bg-[#EAE4F2] text-[#554366]">
                              Protected
                            </span>
                          </div>
                          {item.location && (
                            <span className="text-xs text-[#857C82]">{item.location}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-medium text-[#7D7379] shrink-0">
                        {item.timeDisplay}
                      </span>
                    </div>
                  );
                }

                // Dynamic flexible scheduled task
                const isCurrent = activeTask?.id === item.id;
                return (
                  <div
                    key={`task-${item.id}`}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-[#FFF8FA] border-[#F5D5DE] shadow-soft'
                        : 'bg-white border-[#F3EAE7] hover:border-[#E8DAD5]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => onCompleteTask(item)}
                        className="w-5 h-5 rounded-full border border-[#D5C5BE] hover:border-[#F2ADC5] hover:bg-[#F8C8DC]/30 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                        title="Mark Done"
                      >
                        <CheckCircle2 className="w-4 h-4 text-transparent hover:text-[#3E3A3F]" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate">
                          <span className={`text-sm font-semibold truncate text-[#3E3A3F]`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFF0F4] text-[#854559] border border-[#FCDCE6] shrink-0">
                            Load {item.cognitive_load}/5
                          </span>
                        </div>
                        <span className="text-xs text-[#857C82]">
                          {item.adjustedDuration || item.estimated_duration}m · {item.category}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-3">
                      <span className="text-xs font-mono font-medium text-[#6B5E65] block">
                        {item.timeDisplay}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Col: Set Aside For Later */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-heading font-bold text-[#3E3A3F] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#857C82]" />
              <span>Set Aside for Later</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FCEEE6] text-[#825742]">
              {postponedTasks.length}
            </span>
          </div>

          <div className="rounded-3xl border border-[#F3EAE7] bg-white p-5 space-y-3 shadow-soft">
            <p className="text-xs text-[#857C82] leading-relaxed">
              These tasks were moved to protect your rest and focus. No guilt — they will wait for the right energy window.
            </p>

            {postponedTasks.length === 0 ? (
              <div className="text-center py-8 text-[#A89E9B] text-xs">
                Nothing set aside. Everything fits today's rhythm.
              </div>
            ) : (
              postponedTasks.map((t) => (
                <div
                  key={`postponed-${t.id}`}
                  className="p-3.5 rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#3E3A3F] truncate">{t.title}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FCEEE6] text-[#825742] shrink-0">
                      Load {t.cognitive_load}/5
                    </span>
                  </div>
                  <p className="text-[#6E646A] text-[11px] leading-relaxed">
                    {t.postpone_reason || 'Deferred to prevent schedule overbooking'}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-[#EFE4E0] text-[10px] text-[#857C82]">
                    <span>Est: {t.estimated_duration}m</span>
                    <span>Deferred {t.postponed_count || 1}x</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
