import React from 'react';
import {
  Sparkles,
  Clock,
  Layers,
  History,
  Heart
} from 'lucide-react';

export default function InsightsView({
  taskOutcomes = [],
  schedulingDecisions = [],
  tasks = []
}) {
  // 1. Calculate time-blindness multiplier by category
  const categoryStats = {};

  taskOutcomes.forEach((out) => {
    const cat = out.category || 'other';
    if (!categoryStats[cat]) {
      categoryStats[cat] = {
        totalEst: 0,
        totalAct: 0,
        count: 0
      };
    }
    categoryStats[cat].totalEst += out.estimated_duration;
    categoryStats[cat].totalAct += out.actual_duration;
    categoryStats[cat].count += 1;
  });

  const categoryRatios = Object.entries(categoryStats).map(([category, data]) => {
    const ratio = data.totalEst > 0 ? (data.totalAct / data.totalEst).toFixed(2) : 1.0;
    return {
      category,
      ratio: Number(ratio),
      count: data.count,
      avgEst: Math.round(data.totalEst / data.count),
      avgAct: Math.round(data.totalAct / data.count)
    };
  });

  const postponedList = tasks
    .filter((t) => (t.postponed_count || 0) > 0)
    .sort((a, b) => (b.postponed_count || 0) - (a.postponed_count || 0));

  // 2. Derive the top two reflection cards from real logged outcomes instead
  //    of a fixed "Coding takes 1.4x" / "Chores usually on time" pair. Only
  //    surfaces a category once it has at least a few logged completions.
  const CATEGORY_LABELS = {
    coding: { emoji: '💻', name: 'Coding & Deep Work' },
    coursework: { emoji: '📚', name: 'Coursework' },
    language: { emoji: '🗣️', name: 'Language Practice' },
    chores: { emoji: '🧺', name: 'Chores & Admin' },
    admin: { emoji: '🧺', name: 'Chores & Admin' },
    personal: { emoji: '🌷', name: 'Personal Tasks' }
  };
  const labelFor = (cat) => CATEGORY_LABELS[cat] || { emoji: '🌿', name: cat.charAt(0).toUpperCase() + cat.slice(1) };

  const trustedRatios = categoryRatios.filter((c) => c.count >= 3);
  const slowestCategory = [...trustedRatios].sort((a, b) => b.ratio - a.ratio)[0];
  const mostOnTimeCategory = [...trustedRatios].sort((a, b) => Math.abs(a.ratio - 1) - Math.abs(b.ratio - 1))[0];

  return (
    <div className="space-y-7 pb-16">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-heading font-bold text-[#3E3A3F] tracking-tight flex items-center gap-2">
          <span>🌿</span>
          <span>Personal Rhythm & Observations</span>
        </h2>
        <p className="text-xs text-[#857C82]">
          Gentle reflections on how your time and energy actually unfold in real life.
        </p>
      </div>

      {/* Gentle Reflection Cards (Personal & Warm, not corporate KPI tiles) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="rounded-3xl border border-[#F5E6E8] bg-white p-5 space-y-2 shadow-soft">
          <span className="text-xs text-[#857C82] font-medium flex items-center gap-1.5">
            <span>{slowestCategory ? labelFor(slowestCategory.category).emoji : '💻'}</span>
            <span>{slowestCategory ? labelFor(slowestCategory.category).name : 'Time Calibration'}</span>
          </span>
          <div className="text-2xl font-heading font-bold text-[#3E3A3F]">
            {slowestCategory
              ? (slowestCategory.ratio > 1.1 ? `Takes ~${slowestCategory.ratio}× longer` : 'Estimates tracking well')
              : 'Still learning'}
          </div>
          <p className="text-xs text-[#6E636A] leading-relaxed">
            {slowestCategory
              ? `Based on ${slowestCategory.count} completed tasks. Flow pads these blocks automatically so you don't feel rushed.`
              : "Complete a few tasks in a category and Flow will learn your real pace here — no guessing."}
          </p>
        </div>

        <div className="rounded-3xl border border-[#F1EAE5] bg-white p-5 space-y-2 shadow-soft">
          <span className="text-xs text-[#857C82] font-medium flex items-center gap-1.5">
            <span>{mostOnTimeCategory ? labelFor(mostOnTimeCategory.category).emoji : '🧺'}</span>
            <span>{mostOnTimeCategory ? labelFor(mostOnTimeCategory.category).name : 'Steadiest Category'}</span>
          </span>
          <div className="text-2xl font-heading font-bold text-[#3E3A3F]">
            {mostOnTimeCategory ? 'Most predictable' : 'Still learning'}
          </div>
          <p className="text-xs text-[#6E636A] leading-relaxed">
            {mostOnTimeCategory
              ? `Runs at ${mostOnTimeCategory.ratio}× your estimate across ${mostOnTimeCategory.count} logged tasks — a reliable transition ritual.`
              : 'Once a category has a few logged completions, Flow will show which ones you estimate most accurately.'}
          </p>
        </div>

        <div className="rounded-3xl border border-[#EFEAE5] bg-white p-5 space-y-2 shadow-soft">
          <span className="text-xs text-[#857C82] font-medium flex items-center gap-1.5">
            <span>🌙</span>
            <span>Energy Protection</span>
          </span>
          <div className="text-2xl font-heading font-bold text-[#3E3A3F]">
            {postponedList.length} resting tasks
          </div>
          <p className="text-xs text-[#6E636A] leading-relaxed">
            Tasks postponed without guilt to protect your sleep and prevent compounding overwhelm.
          </p>
        </div>

      </div>

      {/* Category Time Calibration Card */}
      <div className="rounded-3xl border border-[#F3EAE7] bg-white p-6 space-y-4 shadow-soft">
        <h3 className="text-base font-heading font-bold text-[#3E3A3F] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#857C82]" />
          <span>How Long Things Actually Take (Time Calibration)</span>
        </h3>
        <p className="text-xs text-[#857C82]">
          Flow learns your natural pace for each category so schedules reflect reality, not wishful thinking.
        </p>

        <div className="space-y-3">
          {categoryRatios.map((item) => {
            const takesLonger = item.ratio > 1.15;
            return (
              <div
                key={item.category}
                className="p-4 rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1] flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#3E3A3F] capitalize text-sm mr-2">{item.category}</span>
                  <span className="text-[#857C82]">
                    ({item.count} logged · Avg estimated: {item.avgEst}m → actual: {item.avgAct}m)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[#857C82]">Calibration:</span>
                  <span
                    className={`font-semibold px-3 py-1 rounded-full ${
                      takesLonger
                        ? 'bg-[#FCEEE6] text-[#825742] border border-[#F7D8CE]'
                        : 'bg-white text-[#4A4247] border border-[#EFE4E0]'
                    }`}
                  >
                    {item.ratio}× estimate
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Postponed Tasks & Decision History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        
        {/* Postponed Tasks Gentle Check-in */}
        <div className="rounded-3xl border border-[#F3EAE7] bg-white p-6 space-y-3 shadow-soft">
          <h3 className="text-base font-heading font-bold text-[#3E3A3F] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#857C82]" />
            <span>Gentle Check-in: Deferred Tasks</span>
          </h3>
          <p className="text-xs text-[#857C82]">
            If a task keeps getting postponed, it's usually too big. Consider a tiny 15-minute start.
          </p>

          <div className="space-y-3">
            {postponedList.length === 0 ? (
              <p className="text-xs text-[#A89E9B] py-6 text-center">No deferred tasks right now.</p>
            ) : (
              postponedList.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#3E3A3F]">{t.title}</span>
                    <span className="text-[#825742] text-[11px] bg-[#FCEEE6] px-2 py-0.5 rounded-full font-medium">
                      Moved {t.postponed_count}x
                    </span>
                  </div>
                  <p className="text-[#6E646A] text-[11px] leading-relaxed">
                    {t.postpone_reason || 'Deferred to maintain realistic capacity.'}
                  </p>
                  {(t.postponed_count || 0) >= 2 && (
                    <div className="text-[11px] text-[#6A4D59] bg-[#FFF0F4] p-2.5 rounded-xl border border-[#FCDCE6] mt-1">
                      💡 Gentle idea: Start with just 15 minutes of setup or reading, nothing more.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Adaptations Log */}
        <div className="rounded-3xl border border-[#F3EAE7] bg-white p-6 space-y-3 shadow-soft">
          <h3 className="text-base font-heading font-bold text-[#3E3A3F] flex items-center gap-2">
            <History className="w-4 h-4 text-[#857C82]" />
            <span>Recent Schedule Adaptations</span>
          </h3>
          <p className="text-xs text-[#857C82]">
            A quiet log of how your plan adapted when energy or commitments changed.
          </p>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {schedulingDecisions.map((dec, idx) => (
              <div
                key={dec.id || idx}
                className="p-3.5 rounded-2xl bg-[#FFF9F7] border border-[#F1E5E1] text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] text-[#857C82]">
                  <span className="font-heading font-semibold text-[#554C51] uppercase">{dec.trigger}</span>
                  <span>{new Date(dec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-[#4A4247] leading-relaxed">{dec.plain_explanation}</p>
                {dec.reality_warning && (
                  <p className="text-[#825742] text-[11px] bg-[#FCEEE6] p-2 rounded-xl border border-[#F7D8CE]">
                    {dec.reality_warning}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
