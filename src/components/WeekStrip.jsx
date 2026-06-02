import { useState } from "react";

const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function mondayOf(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isoStr(d)     { return d.toLocaleDateString("en-CA"); }

export default function WeekStrip({ selectedDate, onSelectDate, taskDates = new Set() }) {
  const [offset, setOffset] = useState(0);

  const todayStr  = isoStr(new Date());
  const weekStart = addDays(mondayOf(new Date()), offset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d  = addDays(weekStart, i);
    const ds = isoStr(d);
    return {
      ds,
      num:        d.getDate(),
      abbr:       DAY_ABBR[d.getDay()],
      isToday:    ds === todayStr,
      isSelected: ds === selectedDate,
      hasTasks:   taskDates.has(ds),
    };
  });

  return (
    <div className="week-strip">
      <button className="week-nav-btn" onClick={() => setOffset(o => o - 1)} aria-label="Previous week">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>

      <div className="week-strip-days">
        {days.map(day => (
          <button
            key={day.ds}
            className={`week-day-pill${day.isSelected ? " selected" : ""}${day.isToday ? " today" : ""}`}
            onClick={() => onSelectDate(day.ds)}
          >
            <span className="week-day-letter">{day.abbr}</span>
            <span className="week-day-num-circle">
              <span className="week-day-num">{day.num}</span>
            </span>
            {(day.hasTasks) && (
              <span className="week-day-dot-row">
                {day.hasTasks && <span className="week-dot task-dot" />}
              </span>
            )}
          </button>
        ))}
      </div>

      <button className="week-nav-btn" onClick={() => setOffset(o => o + 1)} aria-label="Next week">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  );
}
