import { useState } from "react";
import Icon from "./Icon.jsx";

export default function TutorialModal({ onClose }) {
  const [step, setStep] = useState(0);

  const chip = (label, color="var(--sage-dark)", bg="rgba(90,122,90,0.1)") => (
    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, border:`1.5px solid ${color}`, color, background:bg, fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
  );

  const SLIDES = [
    {
      label: "Tasks",
      title: "Every task either drains or charges you.",
      desc: "When adding a task, toggle whether it drains or charges your battery, then set the intensity with the slider. Add a time estimate so the calendar knows how long to block. Tasks are sorted into Must / Should / Could — LiveFlo surfaces the right ones based on your energy. Tap the pencil icon on any task to edit its name, due date, or duration later.",
      visual: (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { name:"Write quarterly report", impact:-20, dur:"2h", bucket:"must" },
            { name:"Reply to emails",        impact:-5,  dur:"30m", bucket:"should" },
            { name:"Read an article",        impact:10,  dur:"15m", bucket:"could" },
          ].map(t => (
            <div key={t.name} style={{ background:"white", borderRadius:10, padding:"9px 12px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 1px 6px rgba(0,0,0,0.05)", border:"1.5px solid transparent" }}>
              <div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid var(--sage-light)", flexShrink:0 }} />
              <div style={{ flex:1, fontSize:12, color:"var(--ink)" }}>{t.name}</div>
              <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background: t.impact < 0 ? "rgba(196,114,106,0.1)" : "rgba(90,122,90,0.1)", color: t.impact < 0 ? "var(--error)" : "var(--sage-dark)", display:"inline-flex", alignItems:"center", gap:3 }}><Icon name={t.impact > 0 ? "bolt" : "battery"} size={9} />{t.impact > 0 ? `+${t.impact}` : t.impact}</span>
              <span style={{ fontSize:10, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace", display:"inline-flex", alignItems:"center", gap:3 }}><Icon name="timer" size={9} />{t.dur}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Energy battery",
      title: "Your energy has a number now.",
      desc: "The battery panel on your dashboard tracks your energy 0–100%. Completing draining tasks lowers it; charging tasks raise it. If you haven't finished a draining task in 4+ hours, it slowly refills on its own. Drag the bar anytime to manually set it.",
      visual: (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:40, lineHeight:1, color:"var(--sage-dark)" }}>72%</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", marginTop:3 }}>ready to go</div>
            </div>
            <div><Icon name="bolt" size={30} style={{color:"var(--sage-dark)"}} /></div>
          </div>
          <div style={{ height:10, borderRadius:6, background:"var(--warm)", overflow:"hidden", marginBottom:6 }}>
            <div style={{ width:"72%", height:"100%", borderRadius:6, background:"var(--sage-dark)" }} />
          </div>
          <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", textAlign:"center" }}>← drag to adjust →</div>
          <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
            {chip("below 20% → power-save mode","var(--error)","rgba(196,114,106,0.08)")}
          </div>
        </div>
      ),
    },
    {
      label: "Calendar",
      title: "Plan your day in plain language.",
      desc: "Add events as a sentence — \"I'm [doing something] from [time] to [time].\" LiveFlo calculates the duration and places a block on the 24-hour grid. Auto-schedule (Power Mode) places your tasks into free slots automatically, respecting existing events and never overlapping. Your calendar syncs to the cloud in real time so it's always up to date across devices.",
      visual: (
        <div>
          <div style={{ background:"white", borderRadius:10, padding:"14px 16px", marginBottom:10, border:"1px solid var(--warm)" }}>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Add to your day</div>
            <div style={{ fontSize:13, color:"var(--ink)", lineHeight:2 }}>
              {"I'm "}
              <span style={{ borderBottom:"2px solid var(--sage)" }}>in a meeting</span>
              {" from "}
              <span style={{ borderBottom:"2px solid var(--earth)" }}>10:00 am</span>
              {" to "}
              <span style={{ borderBottom:"2px solid #c47a5a" }}>11:30 am</span>
              {"."}
            </div>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", marginTop:4 }}>1h 30m block</div>
          </div>
          <div style={{ background:"rgba(90,122,90,0.1)", borderLeft:"3px solid var(--sage-dark)", borderRadius:8, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:12, fontWeight:500, color:"var(--ink)" }}>in a meeting</div>
              <div style={{ fontSize:10, color:"var(--ink-mute)", marginTop:2, fontFamily:"'DM Mono',monospace" }}>10:00 am – 11:30 am · 1h 30m</div>
            </div>
            <div><Icon name="calendar" size={18} style={{color:"var(--ink-mute)"}} /></div>
          </div>
        </div>
      ),
    },
    {
      label: "Recurring events",
      title: "Set it once, see it every week.",
      desc: "When adding a calendar event, open the \"Repeats\" dropdown to make it recurring. Choose Daily, Weekdays, or Custom days — then pick exactly which days of the week it applies to using the day picker. Recurring events show across your calendar automatically. You can remove a single occurrence without touching the rest.",
      visual: (
        <div>
          <div style={{ background:"white", borderRadius:10, padding:"12px 14px", marginBottom:10, border:"1px solid var(--warm)" }}>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Repeats</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {["Daily","Weekdays","Custom days…"].map((opt,i) => (
                <div key={opt} style={{ fontSize:11, padding:"4px 10px", borderRadius:20, border:`1.5px solid ${i===2?"var(--sage-dark)":"var(--warm)"}`, background:i===2?"rgba(90,122,90,0.08)":"white", color:i===2?"var(--sage-dark)":"var(--ink-mute)", fontFamily:"'DM Sans',sans-serif" }}>{opt}</div>
              ))}
            </div>
            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
              {["S","M","T","W","T","F","S"].map((d,i) => {
                const active = [1,2,3,4,5].includes(i);
                return (
                  <div key={i} style={{ width:26, height:26, borderRadius:"50%", border:`1.5px solid ${active?"var(--sage-dark)":"var(--warm)"}`, background:active?"var(--sage-dark)":"white", color:active?"white":"var(--ink-mute)", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", fontWeight:500 }}>{d}</div>
                );
              })}
              <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--sage-dark)", marginLeft:4 }}>Mon – Fri</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {chip("syncs across all days")}
            {chip("remove one without breaking the rest","var(--earth-dark)","rgba(196,168,130,0.1)")}
          </div>
        </div>
      ),
    },
    {
      label: "Wellness Hub",
      title: "Built-in tools for when you need to reset.",
      desc: "The Wellness tab has breathing exercises (Box, 4-7-8), a body scan, and a focus timer (Pomodoro). When your energy is low, Rest Mode gives you a gentle wind-down with journaling prompts to close the day without guilt.",
      visual: (
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {[
            { icon:"wind",  title:"Breathing", sub:"Box · 4-7-8 · Custom" },
            { icon:"eye",   title:"Body Scan", sub:"5–10 min awareness" },
            { icon:"timer", title:"Focus Timer", sub:"Pomodoro blocks" },
            { icon:"moon",  title:"Rest Mode", sub:"Wind-down + journal" },
          ].map(c => (
            <div key={c.title} style={{ flex:1, background:"white", border:"1.5px solid var(--warm)", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ marginBottom:5 }}><Icon name={c.icon} size={18} style={{color:"var(--sage-dark)"}} /></div>
              <div style={{ fontSize:11, fontWeight:500, color:"var(--ink)" }}>{c.title}</div>
              <div style={{ fontSize:9, color:"var(--ink-mute)", marginTop:2, lineHeight:1.4 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Mindfulness suggestions",
      title: "Recharge tasks live in your list.",
      desc: "The sidebar suggests mindfulness tasks based on your battery level. Below 30%? It surfaces charging activities. Above 70%? It surfaces drain tasks to make use of your capacity. Adding a mindfulness suggestion creates a task that gives you +1% battery when done.",
      visual: (
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:1, marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Icon name="bolt" size={10} style={{color:"var(--sage-dark)"}} />Recharge — start here</div>
          {[
            { text:"Take 3 slow breaths before your next task.", impact:"+1" },
            { text:"Walk to get water. No phone.", impact:"+1" },
            { text:"Look out a window for one full minute.", impact:"+1" },
          ].map((s,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderTop: i===0?"none":"1px solid var(--warm)" }}>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:"rgba(90,122,90,0.1)", color:"var(--sage-dark)", fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{s.impact}</span>
              <span style={{ fontSize:12, color:"var(--ink)" }}>{s.text}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Privacy & safety",
      title: "Your data stays yours.",
      desc: "Privacy Mode blurs all task names — hover to reveal. This protects your screen in shared spaces without logging out. Journal entries and check-in notes are encrypted before being stored in the cloud: only your device can read them. You can clear all your data or delete your account entirely from Settings at any time.",
      visual: (
        <div>
          <div style={{ background:"white", borderRadius:10, padding:"12px 14px", marginBottom:10, border:"1px solid var(--warm)" }}>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Privacy Mode on</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {["Write quarterly report","Reply to emails","Read an article"].map((name,i) => (
                <div key={i} style={{ background:"var(--cream)", borderRadius:8, padding:"8px 10px", display:"flex", alignItems:"center", gap:8, border:"1px solid var(--warm)" }}>
                  <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid var(--sage-light)", flexShrink:0 }} />
                  <div style={{ flex:1, fontSize:12, color:"var(--ink)", filter:"blur(6px)", userSelect:"none" }}>{name}</div>
                  <span style={{ fontSize:9, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace" }}>hover →</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {chip("notes encrypted end-to-end")}
            {chip("clear data anytime","var(--error)","rgba(196,114,106,0.08)")}
          </div>
        </div>
      ),
    },
    {
      label: "Settings & Power Mode",
      title: "More control when you want it.",
      desc: "Power Mode unlocks auto-scheduling and .ics calendar export. Gentle Mode softens all copy and skips hard questions on low-energy days. Privacy Mode blurs task names in shared spaces. Notifications lets you set a wind-down reminder. Recalibrate resets your profile if your capacity changes.",
      visual: (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { icon:"bolt",     label:"Power Mode", sub:"Auto-schedule · ICS export · Focus blocks" },
            { icon:"leaf",     label:"Gentle Mode", sub:"Softer copy · skips hard questions" },
            { icon:"lock",     label:"Privacy Mode", sub:"Blur task names · hover to reveal" },
            { icon:"bell",     label:"Notifications", sub:"Wind-down reminders" },
            { icon:"calendar", label:"History", sub:"Past check-ins and moods" },
          ].map(r => (
            <div key={r.label} style={{ display:"flex", alignItems:"center", gap:12, background:"white", borderRadius:10, padding:"9px 12px", border:"1px solid var(--warm)" }}>
              <Icon name={r.icon} size={18} style={{color:"var(--sage-dark)", flexShrink:0}} />
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:"var(--ink)" }}>{r.label}</div>
                <div style={{ fontSize:10, color:"var(--ink-mute)", marginTop:1 }}>{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="tutorial-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tutorial-card">
        <div className="tutorial-dots">
          {SLIDES.map((_, i) => (
            <div key={i} className={`tutorial-dot ${i===step?"active":i<step?"done":""}`} onClick={() => setStep(i)} style={{ cursor:"pointer" }} />
          ))}
        </div>
        <div className="tutorial-visual">{slide.visual}</div>
        <div className="tutorial-step">{slide.label} · {step+1} of {SLIDES.length}</div>
        <div className="tutorial-title">{slide.title}</div>
        <div className="tutorial-desc">{slide.desc}</div>
        <div className="tutorial-actions">
          <button className="btn-skip" onClick={onClose}>Close</button>
          <div style={{ display:"flex", gap:10 }}>
            {step > 0 && <button className="btn-back" onClick={() => setStep(s => s-1)}>← Back</button>}
            {isLast
              ? <button className="btn-primary" onClick={onClose}>Understood →</button>
              : <button className="btn-primary" onClick={() => setStep(s => s+1)}>Sounds good →</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
