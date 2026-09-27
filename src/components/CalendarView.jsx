import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Lock,
  Clock
} from 'lucide-react';

export default function CalendarView({
  scheduledToday = [],
  fixedEvents = [],
  allCalendarEvents = [],
  preferences = {},
  calendarSyncNotice = null
}) {
  const [viewMode, setViewMode] = useState('day');
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const tick = () => setCurrentTime(new Date());
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const startHour = 8;
  const endHour = 24;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + selectedDayOffset);
  const dateFormatted = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const selectedDateStr = currentDate.toLocaleDateString('en-CA');

  const eventsForDay = (allCalendarEvents || []).filter(evt => {
    if (evt.origin === 'adaptive') return false;
    if (!evt.start_time) return false;
    const evtLocalDate = new Date(evt.start_time).toLocaleDateString('en-CA');
    return evtLocalDate === selectedDateStr;
  });

  const isAllDay = (evt) => {
    const start = new Date(evt.start_time);
    const end = new Date(evt.end_time);
    return (end.getTime() - start.getTime()) >= 20 * 60 * 60 * 1000;
  };

  const allDayEvents = eventsForDay.filter(isAllDay);

  const dayFixedEvents = eventsForDay
    .filter(evt => !isAllDay(evt))
    .map(evt => {
      const start = new Date(evt.start_time);
      const end = new Date(evt.end_time);
      return {
        id: evt.id,
        title: evt.title,
        startMin: start.getHours() * 60 + start.getMinutes(),
        endMin: end.getHours() * 60 + end.getMinutes(),
        category: evt.category,
        location: evt.location
      };
    })
    .sort((a, b) => a.startMin - b.startMin);

  function layoutEventsWithColumns(events) {
    const sorted = [...events].sort((a, b) => a.startMin - b.startMin);
    const columns = [];

    sorted.forEach(evt => {
      let placed = false;
      for (const col of columns) {
        const last = col[col.length - 1];
        if (evt.startMin >= last.endMin) {
          col.push(evt);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([evt]);
    });

    const totalCols = columns.length;
    const result = [];
    columns.forEach((col, colIndex) => {
      col.forEach(evt => {
        result.push({ ...evt, colIndex, totalCols });
      });
    });
    return result;
  }

  const laidOutFixedEvents = layoutEventsWithColumns(dayFixedEvents);

  const isToday = selectedDayOffset === 0;
  const nowHour = currentTime.getHours() + currentTime.getMinutes() / 60;
  const nowInGrid = nowHour >= startHour && nowHour < endHour;
  const nowPct = isToday && nowInGrid
    ? ((nowHour - startHour) / (endHour - startHour)) * 100
    : null;

  const getItemStyle = (startStr, endStr) => {
    if (!startStr || !endStr) return { top: '0%', height: '40px' };
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);

    const startTotalMin = sh * 60 + sm;
    const endTotalMin = eh * 60 + em;
    const gridStartMin = startHour * 60;
    const totalGridMin = (endHour - startHour) * 60;

    const topPct = Math.max(0, ((startTotalMin - gridStartMin) / totalGridMin) * 100);
    const durationMin = Math.max(25, endTotalMin - startTotalMin);
    const heightPct = Math.min(100 - topPct, (durationMin / totalGridMin) * 100);

    return {
      top: `${topPct}%`,
      height: `max(36px, ${heightPct}%)`
    };
  };

  function minToTime(m) {
    const hrs = Math.floor(m / 60).toString().padStart(2, '0');
    const mins = (m % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}`;
  }

  return (
    <div className="space-y-6 pb-16">

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-[#3E3A3F] tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#857C82]" />
            <span>Schedule & Fixed Commitments</span>
          </h2>
          <p className="text-xs text-[#857C82]">
            Protected anchors stay put; flexible tasks flow gently around them.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-white border border-[#F3EAE7] rounded-full p-1 shadow-soft">
            <button
              onClick={() => setSelectedDayOffset((prev) => prev - 1)}
              className="p-1.5 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-[#FFF9F7] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-[#3E3A3F] px-3 font-heading">
              {dateFormatted}
            </span>
            <button
              onClick={() => setSelectedDayOffset((prev) => prev + 1)}
              className="p-1.5 rounded-full text-[#857C82] hover:text-[#3E3A3F] hover:bg-[#FFF9F7] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex rounded-full border border-[#F3EAE7] bg-white p-1 text-xs font-medium shadow-soft">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3.5 py-1 rounded-full transition-colors cursor-pointer ${
                viewMode === 'day' ? 'bg-[#F8C8DC] text-[#3E3A3F] font-semibold' : 'text-[#857C82] hover:text-[#3E3A3F]'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-1 rounded-full transition-colors cursor-pointer ${
                viewMode === 'week' ? 'bg-[#F8C8DC] text-[#3E3A3F] font-semibold' : 'text-[#857C82] hover:text-[#3E3A3F]'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {calendarSyncNotice && (
        <div className="rounded-2xl border border-[#EEDCD7] bg-[#FFF9F7] px-4 py-3 text-xs text-[#6E646A]">
          {calendarSyncNotice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-5 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-[#FFF9F7] border border-[#E8DAD5] flex items-center justify-center">
            <Lock className="w-2 h-2 text-[#857C82]" />
          </span>
          <span className="text-[#3E3A3F] font-medium">Protected commitments</span>
          <span className="text-[#857C82]">(classes, sleep, meals)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-md bg-[#FFF0F4] border border-[#F2ADC5]" />
          <span className="text-[#854559] font-medium">Adaptive tasks</span>
          <span className="text-[#857C82]">(fitted into open time)</span>
        </div>
      </div>

      {viewMode === 'day' && allDayEvents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allDayEvents.map((evt) => (
            <div
              key={`allday-${evt.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF9F7] border border-[#EFE4E0] text-xs text-[#3E3A3F] font-medium"
            >
              <Lock className="w-3 h-3 text-[#857C82]" />
              {evt.title}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'day' ? (
        <div className="rounded-3xl border border-[#F3EAE7] bg-white p-5 sm:p-6 shadow-soft">
          <div className="relative min-h-[720px] flex">

            <div className="w-16 shrink-0 flex flex-col justify-between text-xs font-mono text-[#A89E9B] pr-3 border-r border-[#F3EAE7]">
              {hours.map((h) => (
                <div key={h} className="h-12 flex items-start">
                  <span>{h.toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>

            <div className="relative flex-1 ml-4 min-h-[720px]">

              {hours.map((h, i) => (
                <div
                  key={`line-${h}`}
                  className="absolute left-0 right-0 border-b border-[#FAF3F0] pointer-events-none"
                  style={{ top: `${(i / hours.length) * 100}%` }}
                />
              ))}

              {laidOutFixedEvents.map((evt) => {
                const startStr = minToTime(evt.startMin);
                const endStr = minToTime(evt.endMin);
                const style = getItemStyle(startStr, endStr);
                const widthPct = 100 / evt.totalCols;
                const leftPct = evt.colIndex * widthPct;

                return (
                  <div
                    key={`fixed-cal-${evt.id}`}
                    style={{
                      ...style,
                      left: `calc(${leftPct}% + 4px)`,
                      width: `calc(${widthPct}% - 8px)`,
                      right: 'auto'
                    }}
                    className="absolute rounded-2xl bg-[#FFF9F7] border border-[#EFE4E0] p-2 shadow-soft text-xs z-10 transition-all hover:bg-[#FFF5F2] overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Lock className="w-3 h-3 text-[#857C82] shrink-0" />
                        <span className="font-semibold text-[#3E3A3F] truncate">{evt.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] font-heading font-medium px-1.5 py-0.5 rounded-full bg-white border border-[#EFE4E0] text-[#786D74] truncate">
                        {evt.category}
                      </span>
                      <span className="font-mono text-[10px] text-[#7A7077] shrink-0">
                        {startStr}–{endStr}
                      </span>
                    </div>
                    {evt.location && (
                      <p className="text-[10px] text-[#91868C] mt-0.5 truncate">{evt.location}</p>
                    )}
                  </div>
                );
              })}

              {isToday && scheduledToday.map((task) => {
                if (!task.startTimeStr || !task.endTimeStr) return null;
                const style = getItemStyle(task.startTimeStr, task.endTimeStr);

                return (
                  <div
                    key={`task-cal-${task.id}`}
                    style={style}
                    className="absolute left-6 right-2 rounded-2xl bg-[#FFF0F4] border border-[#F5D5DE] p-3 shadow-soft text-xs z-20 transition-all hover:border-[#F2ADC5]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#F2ADC5]" />
                        <span className="font-semibold text-[#3E3A3F] truncate">{task.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[#854559] border border-[#FCDCE6]">
                          Load {task.cognitive_load}/5
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#854559] font-medium shrink-0">
                        {task.startTimeStr} – {task.endTimeStr} ({task.adjustedDuration || task.estimated_duration}m)
                      </span>
                    </div>
                  </div>
                );
              })}

              {dayFixedEvents.length === 0 && allDayEvents.length === 0 && (!isToday || scheduledToday.length === 0) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <span className="text-3xl">🗓️</span>
                  <p className="text-sm font-heading font-semibold text-[#B0A0A6]">No events yet</p>
                  <p className="text-xs text-[#C5B8BC]">Add tasks or fixed commitments to see them here</p>
                </div>
              )}

              {nowPct !== null && (
                <div
                  className="absolute left-0 right-0 z-30 pointer-events-none"
                  style={{ top: `${nowPct}%` }}
                >
                  <span className="absolute -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-[#E5547C] shadow-sm" />
                  <div className="h-px bg-[#E5547C] opacity-80 ml-1.5" />
                </div>
              )}

            </div>

          </div>
        </div>

      ) : (
        (() => {
          const getMonday = (d) => {
            const date = new Date(d);
            const day = date.getDay();
            const diff = (day === 0 ? -6 : 1) - day;
            date.setDate(date.getDate() + diff);
            date.setHours(0, 0, 0, 0);
            return date;
          };

          const weekStart = getMonday(currentDate);
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return d;
          });

          const todayStr = new Date().toLocaleDateString('en-CA');

          return (
            <div className="rounded-3xl border border-[#F3EAE7] bg-white p-6 shadow-soft">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {weekDays.map((day) => {
                  const dayStr = day.toLocaleDateString('en-CA');
                  const label = day.toLocaleDateString('en-US', { weekday: 'short' });
                  const dateLabel = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const isThisDayToday = dayStr === todayStr;

                  const dayEvents = (allCalendarEvents || [])
                    .filter(evt => {
                      if (evt.origin === 'adaptive' || !evt.start_time) return false;
                      return new Date(evt.start_time).toLocaleDateString('en-CA') === dayStr;
                    })
                    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

                  // Adaptive (AI-scheduled) tasks only exist in memory for "today" —
                  // they aren't persisted calendar_events rows, so we merge them in
                  // here rather than relying on allCalendarEvents for this day.
                  const adaptiveForThisDay = isThisDayToday
                    ? (scheduledToday || []).filter((t) => t.startTimeStr && t.endTimeStr)
                    : [];

                  const isEmpty = dayEvents.length === 0 && adaptiveForThisDay.length === 0;

                  return (
                    <div key={dayStr} className="rounded-2xl border border-[#F3EAE7] bg-[#FFF9F7]/70 p-3.5 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#F1E5E1]">
                        <span className="font-heading font-bold text-sm text-[#3E3A3F]">{label}</span>
                        <span className="text-[11px] text-[#A89E9B]">{dateLabel}</span>
                      </div>
                      <div className="space-y-2 text-[11px]">
                        {isEmpty && (
                          <p className="text-[10px] text-[#C5B8BC]">Nothing scheduled</p>
                        )}
                        {dayEvents.map((evt) => {
                          const start = new Date(evt.start_time);
                          const end = new Date(evt.end_time);
                          const evtIsAllDay = (end.getTime() - start.getTime()) >= 20 * 60 * 60 * 1000;
                          return (
                            <div
                              key={evt.id}
                              className="p-2 rounded-xl bg-white text-[#4A4247] border border-[#F1E5E1] shadow-soft"
                            >
                              {!evtIsAllDay && (
                                <span className="text-[#857C82] block text-[10px]">
                                  {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </span>
                              )}
                              {evt.title}
                            </div>
                          );
                        })}
                        {adaptiveForThisDay.map((task) => (
                          <div
                            key={`week-adaptive-${task.id}`}
                            className="p-2 rounded-xl bg-[#FFF0F4] text-[#854559] border border-[#F5D5DE] shadow-soft"
                          >
                            <span className="block text-[10px] font-medium">
                              {task.startTimeStr} – {task.endTimeStr}
                            </span>
                            {task.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      )}

    </div>
  );
}
