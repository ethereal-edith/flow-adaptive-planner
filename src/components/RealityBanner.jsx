import React from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function RealityBanner({ reality, onResolveOverbook }) {
  if (!reality || (!reality.isUnrealistic && reality.severity === 'normal')) {
    return null;
  }

  const isSevere = reality.severity === 'impossible' || reality.severity === 'overbooked';

  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 transition-all shadow-soft border ${
        isSevere
          ? 'bg-[#FFF2EE] border-[#F7D2C7] text-[#613C33]'
          : 'bg-[#FDF6E8] border-[#F6E3B8] text-[#594A2A]'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-1.5 rounded-full bg-white/80 shrink-0 text-[#E07A5F]">
            <AlertCircle className="w-4 h-4" />
          </div>

          <div>
            <h4 className="text-sm font-semibold tracking-tight mb-1 text-[#3E3A3F]">
              A quick check on today's time budget
            </h4>
            <p className="text-xs sm:text-sm leading-relaxed text-[#5C5257]">
              {reality.warning}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-[#7D7379]">
              <span>Available: <strong>{reality.availableHours}h</strong></span>
              <span>·</span>
              <span>Scheduled: <strong>{reality.requiredHours}h</strong></span>
              {reality.deficitMinutes > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[#C85A3F] font-semibold">Over by {reality.deficitMinutes} min</span>
                </>
              )}
            </div>
          </div>
        </div>

        {isSevere && onResolveOverbook && (
          <button
            onClick={onResolveOverbook}
            className="self-start sm:self-center shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F8C8DC] hover:bg-[#F2ADC5] text-[#3E3A3F] text-xs font-semibold shadow-soft transition-colors cursor-pointer"
          >
            <span>Adjust my day</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
