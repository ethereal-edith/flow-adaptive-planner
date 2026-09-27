import React, { useState } from 'react';
import { Clock, X } from 'lucide-react';

export default function CompletionModal({ isOpen, onClose, onConfirm, task }) {
  const [actualDuration, setActualDuration] = useState(task?.estimated_duration || 30);
  const [energyUsed, setEnergyUsed] = useState(3);

  if (!isOpen || !task) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      actualDuration: Number(actualDuration),
      energyUsed: Number(energyUsed)
    });
    onClose();
  };

  const estimated = task.estimated_duration || 30;
  const ratio = (Number(actualDuration) / estimated).toFixed(2);

  const emojis = ['🌙', '☁️', '🌤️', '☀️', '✨'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3E3A3F]/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#F3EAE7] bg-white shadow-soft-lg p-6 sm:p-7">
        
        <div className="flex items-center justify-between pb-3 border-b border-[#F3EAE7]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <h3 className="text-base font-heading font-bold text-[#3E3A3F]">Task Completed</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-[#FFF9F7]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <span className="text-xs text-[#857C82] font-medium block mb-1">Finished Task:</span>
            <h4 className="text-sm font-semibold text-[#2D2B2E]">{task.title}</h4>
            <p className="text-xs text-[#857C82] mt-0.5">
              Estimated: <strong>{estimated} min</strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C5257] mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#857C82]" />
              <span>How long did it actually take? (minutes)</span>
            </label>
            <input
              type="number"
              min="5"
              step="5"
              required
              value={actualDuration}
              onChange={(e) => setActualDuration(e.target.value)}
              className="w-full text-sm bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl px-4 py-2.5 text-[#3E3A3F] focus:outline-none focus:border-[#F8C8DC]"
            />
            <div className="mt-1.5 text-xs text-[#857C82] flex items-center justify-between">
              <span>Time accuracy:</span>
              <span className="font-semibold text-[#5C5257]">
                {ratio}× of initial estimate
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C5257] mb-1.5">
              How was your energy while doing this?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl, i) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setEnergyUsed(lvl)}
                  className={`py-2 rounded-2xl text-xs font-semibold border flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                    energyUsed === lvl
                      ? 'bg-[#F8C8DC]/40 border-[#F2ADC5] text-[#3E3A3F] shadow-soft'
                      : 'bg-[#FFF9F7] border-[#EEDCD7] text-[#857C82] hover:bg-white'
                  }`}
                >
                  <span className="text-sm">{emojis[i]}</span>
                  <span>{lvl}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3EAE7]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-[#857C82] hover:text-[#3E3A3F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-xs font-semibold bg-[#F8C8DC] hover:bg-[#F2ADC5] text-[#3E3A3F] shadow-soft transition-colors cursor-pointer"
            >
              Save outcome
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
