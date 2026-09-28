import React, { useEffect, useState } from 'react';
import {
  X,
  Settings,
  RotateCcw,
  CalendarDays,
  RefreshCw
} from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  onResetData,
  googleCalendars = [],
  onConnectGoogle,
  onSyncGoogle,
  googleSyncing = false
}) {
  const [wakeTime, setWakeTime] = useState(preferences.wake_time || '08:00');
  const [sleepTime, setSleepTime] = useState(preferences.sleep_time || '23:30');
  const [bufferMin, setBufferMin] = useState(preferences.buffer_minutes || 15);
  const [selectedGoogleCalendars, setSelectedGoogleCalendars] = useState(preferences.google_calendar_ids || []);

  useEffect(() => {
    setSelectedGoogleCalendars(preferences.google_calendar_ids || []);
  }, [preferences.google_calendar_ids]);

  // Same fix as above, applied to wake/sleep/buffer — these were only ever
  // read once at first mount, so a saved change could still display the old
  // default (e.g. 08:00) the next time Settings was reopened.
  useEffect(() => {
    setWakeTime(preferences.wake_time || '08:00');
  }, [preferences.wake_time]);

  useEffect(() => {
    setSleepTime(preferences.sleep_time || '23:30');
  }, [preferences.sleep_time]);

  useEffect(() => {
    setBufferMin(preferences.buffer_minutes || 15);
  }, [preferences.buffer_minutes]);

  if (!isOpen) return null;

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    const updatedPreferences = {
      ...preferences,
      wake_time: wakeTime,
      sleep_time: sleepTime,
      buffer_minutes: Number(bufferMin),
      google_calendar_ids: selectedGoogleCalendars
    };
    await onUpdatePreferences(updatedPreferences);
    await onSyncGoogle(selectedGoogleCalendars);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3E3A3F]/30 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-[#F3EAE7] bg-white shadow-soft-lg p-6 sm:p-7 overflow-y-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F3EAE7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FFF9F7] border border-[#EEDCD7] flex items-center justify-center text-[#857C82]">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-base font-heading font-bold text-[#3E3A3F]">Settings & Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-[#FFF9F7] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-5 pt-4">
          
          {/* Skeleton bounds */}
          <div className="space-y-3">
            <h3 className="text-xs font-heading font-bold text-[#857C82] uppercase tracking-wider">
              Protected Daily Boundaries
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5C5257] mb-1">Wake up</label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full text-xs bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl p-2.5 text-[#3E3A3F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5C5257] mb-1">Sleep (Protected)</label>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  className="w-full text-xs bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl p-2.5 text-[#3E3A3F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5C5257] mb-1">Buffer between tasks</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="5"
                  value={bufferMin}
                  onChange={(e) => setBufferMin(e.target.value)}
                  className="w-full text-xs bg-[#FFF9F7] border border-[#EEDCD7] rounded-2xl p-2.5 text-[#3E3A3F]"
                />
              </div>
            </div>
          </div>

          {/* Google Calendar */}
          <div className="space-y-3 pt-3 border-t border-[#F3EAE7]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-heading font-bold text-[#857C82] uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Google Calendar</span>
              </h3>
              <button
                type="button"
                onClick={onConnectGoogle}
                className="px-3 py-1.5 rounded-full bg-[#FFF9F7] border border-[#EEDCD7] hover:bg-[#FCEEE6] text-xs font-semibold text-[#5C5257]"
              >
                {googleCalendars.length ? 'Reconnect' : 'Connect Google Calendar'}
              </button>
            </div>
            <p className="text-xs text-[#857C82]">
              Choose which Google calendars should appear as protected commitments.
            </p>

            {googleCalendars.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {googleCalendars.map((calendar) => {
                  const checked = selectedGoogleCalendars.includes(calendar.id);
                  return (
                    <label key={calendar.id} className="flex items-center gap-2 text-xs text-[#5C5257] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedGoogleCalendars((current) => checked
                          ? current.filter((id) => id !== calendar.id)
                          : [...current, calendar.id])}
                        className="rounded border-[#EEDCD7] text-[#F2ADC5] focus:ring-0"
                      />
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: calendar.color }} />
                      <span>{calendar.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              disabled={googleSyncing || selectedGoogleCalendars.length === 0}
              onClick={async () => {
                await onUpdatePreferences({ ...preferences, google_calendar_ids: selectedGoogleCalendars });
                await onSyncGoogle(selectedGoogleCalendars);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F8C8DC] hover:bg-[#F2ADC5] disabled:opacity-50 text-xs font-semibold text-[#3E3A3F]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${googleSyncing ? 'animate-spin' : ''}`} />
              <span>{googleSyncing ? 'Syncing...' : 'Sync now'}</span>
            </button>
          </div>

          {/* Reset Demo State */}
          <div className="pt-3 border-t border-[#F3EAE7] flex items-center justify-between">
            <div>
              <span className="text-xs text-[#3E3A3F] font-semibold block">Reset Demo State</span>
              <span className="text-[11px] text-[#857C82]">
                Reloads initial student coursework, German prep, and B+ tree tasks.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset schedule and tasks back to demo state?')) {
                  onResetData();
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#EEDCD7] text-[#6E646A] hover:bg-[#FFF9F7] text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset data</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3EAE7]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full text-xs font-medium text-[#857C82] hover:text-[#3E3A3F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-xs font-semibold bg-[#F8C8DC] hover:bg-[#F2ADC5] text-[#3E3A3F] shadow-soft transition-colors cursor-pointer"
            >
              Save settings
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}