import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  Heart
} from 'lucide-react';

export default function HeroFocus({
  currentTask,
  alternativeTask,
  onCompleteTask,
  onMissedTask,
  onSwitchTask,
  dailyState
}) {
  const [isFiveMinMode, setIsFiveMinMode] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(5 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [customStep1, setCustomStep1] = useState('');

  // 5-minute initiation timer
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const resetFiveMinTimer = () => {
    setIsTimerRunning(false);
    setSecondsRemaining(5 * 60);
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!currentTask) {
    return (
      <div className="rounded-3xl border border-[#F3EAE7] bg-white p-8 text-center shadow-soft">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#FCEEE6] flex items-center justify-center text-xl">
          🌿
        </div>
        <h2 className="text-xl font-heading font-semibold text-[#3E3A3F] mb-1">All clear for right now</h2>
        <p className="text-sm text-[#857C82] max-w-md mx-auto">
          Your scheduled tasks for today are finished or resting for tomorrow. Take a quiet breath or enjoy some downtime.
        </p>
      </div>
    );
  }

  const getLoadBadge = (load) => {
    const badges = {
      1: { emoji: '🧺', label: 'Very gentle · Low effort', bg: 'bg-[#F2F7F2] text-[#426147] border-[#DFEBDD]' },
      2: { emoji: '📝', label: 'Light mental effort', bg: 'bg-[#F4F1FA] text-[#5C4872] border-[#E6DEEE]' },
      3: { emoji: '🌱', label: 'Moderate focus', bg: 'bg-[#FFF6ED] text-[#7A5636] border-[#FBE5D2]' },
      4: { emoji: '📖', label: 'High focus needed', bg: 'bg-[#FFF0F4] text-[#854559] border-[#FCDCE6]' },
      5: { emoji: '💻', label: 'Deep problem solving', bg: 'bg-[#FFF0F3] text-[#8A3751] border-[#FCD6E0]' }
    };
    const b = badges[load] || badges[3];
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${b.bg}`}>
        <span>{b.emoji}</span>
        <span>{b.label}</span>
      </span>
    );
  };

  return (
    <div className="rounded-3xl border border-[#F5E6E8] bg-white p-6 sm:p-8 shadow-soft-lg relative">
      
      {/* Soft header question badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#F8C8DC]" />
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#857C82]">
            What to do right now
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentTask.startTimeStr && currentTask.endTimeStr && (
            <span className="text-xs font-mono font-medium text-[#6B6168] bg-[#FFF9F7] border border-[#F3EAE7] px-3 py-1 rounded-full">
              {currentTask.startTimeStr} – {currentTask.endTimeStr}
            </span>
          )}
          <span className="text-xs font-medium text-[#6B6168] bg-[#FFF9F7] border border-[#F3EAE7] px-3 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#A399A0]" />
            {currentTask.adjustedDuration || currentTask.estimated_duration} min
          </span>
        </div>
      </div>

      {/* Main Task Description */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {getLoadBadge(currentTask.cognitive_load || 3)}
          <span className="text-xs text-[#857C82] capitalize font-medium">
            · {currentTask.category}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[#2D2B2E] tracking-tight leading-snug">
          {currentTask.title}
        </h1>

        {currentTask.description && (
          <p className="text-sm text-[#5C5257] leading-relaxed max-w-3xl">
            {currentTask.description}
          </p>
        )}

        {/* Why this task now */}
        {currentTask.reasons && currentTask.reasons.length > 0 && (
          <div className="text-xs text-[#6B5A63] bg-[#FFF8FA] border border-[#F9E5EC] rounded-2xl p-3 max-w-2xl flex items-start gap-2.5">
            <span className="text-sm">🌸</span>
            <span>
              <strong>Why right now:</strong> {currentTask.reasons[0]}
            </span>
          </div>
        )}
      </div>

      {/* Initiation Friction Breaker */}
      <div className="mt-7 pt-5 border-t border-[#F5EAE7]">
        {!isFiveMinMode ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Primary Mark Done button */}
              <button
                onClick={() => onCompleteTask(currentTask)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F8C8DC] hover:bg-[#F2ADC5] text-[#3E3A3F] font-semibold text-sm shadow-soft transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#3E3A3F]" />
                <span>Mark Done</span>
              </button>

              {/* 5-Min gentle start */}
              <button
                onClick={() => setIsFiveMinMode(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#EAE4F2] hover:bg-[#DFD5E8] text-[#554366] font-medium text-sm transition-all cursor-pointer shadow-soft"
              >
                <span>✨</span>
                <span>Stuck initiating? Do 5 gentle minutes</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {alternativeTask && (
                <button
                  onClick={() => onSwitchTask(alternativeTask)}
                  className="text-xs text-[#857C82] hover:text-[#3E3A3F] transition-colors underline cursor-pointer"
                >
                  Switch to: {alternativeTask.title.slice(0, 24)}...
                </button>
              )}

              <button
                onClick={() => onMissedTask(currentTask.id)}
                className="text-xs text-[#825742] hover:text-[#5F3D2B] bg-[#FCEEE6] border border-[#F8DC handle-click] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
                title="Reschedule adaptively without guilt"
              >
                I fell behind / Missed this
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFF8FA] border border-[#F7DFE6] rounded-2xl p-4 sm:p-5 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-sm font-heading font-bold text-[#3E3A3F] flex items-center gap-2">
                  <span>5-Minute Gentle Agreement</span>
                  <span className="text-[11px] font-normal text-[#8A5265] bg-[#FDEEF3] px-2.5 py-0.5 rounded-full">
                    Zero pressure to finish
                  </span>
                </h4>
                <p className="text-xs text-[#7A6E75] mt-0.5">
                  Just stay with this for 5 minutes. If you still want to stop when the timer rings, you have full permission.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-mono font-bold text-[#3E3A3F] bg-white px-3.5 py-1 rounded-full border border-[#F3EAE7] shadow-soft">
                  {formatTimer(secondsRemaining)}
                </span>
                <button
                  onClick={toggleTimer}
                  className={`p-2 rounded-full font-medium text-[#3E3A3F] transition-all cursor-pointer shadow-soft ${
                    isTimerRunning ? 'bg-[#FCEEE6] hover:bg-[#F8DEC] text-[#825742]' : 'bg-[#F8C8DC] hover:bg-[#F2ADC5]'
                  }`}
                >
                  {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button
                  onClick={resetFiveMinTimer}
                  className="p-2 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-white transition-all cursor-pointer"
                  title="Reset timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Micro Step 1 */}
            <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-[#F5E6E8]">
              <span className="text-xs text-[#857C82] shrink-0 font-medium">Just step 1:</span>
              <input
                type="text"
                value={customStep1}
                onChange={(e) => setCustomStep1(e.target.value)}
                placeholder="e.g. Just open the code file, or put sheets in the washer"
                className="w-full text-xs bg-white border border-[#EEDCD7] rounded-full px-3.5 py-2 text-[#3E3A3F] placeholder-[#B5AAA2] focus:outline-none focus:border-[#F8C8DC]"
              />
              <button
                onClick={() => setIsFiveMinMode(false)}
                className="text-xs text-[#857C82] hover:text-[#3E3A3F] px-2 py-1 shrink-0 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
