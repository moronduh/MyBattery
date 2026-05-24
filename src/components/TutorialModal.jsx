import { useState } from "react";
import Icon from "./Icon.jsx";

export default function TutorialModal({ onClose }) {
  const [step, setStep] = useState(0);

  const chip = (label, color="var(--sage-dark)", bg="rgba(90,122,90,0.1)") => (
    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, border:`1.5px solid ${color}`, color, background:bg, fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
  );

  const SLIDES = [
    {
      label: "Morning check-in",
      title: "Start with where you actually are.",
      desc: "Each morning, drag the battery bar to where your energy feels right — the app calibrates how many tasks to surface and which bucket to prioritize. Pick a mood so the greeting can adapt. Physically stuck in bed? Jumpstart mode walks you through four micro-movements to help you get up.",
      visual: (
        <div>
          <div style={{ background:"white", borderRadius:12, padding:"16px 18px", marginBottom:10, border:"1px solid var(--warm)" }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>How's your energy today?</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, lineHeight:1, color:"var(--sage-dark)" }}>64%</div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", marginTop:4 }}>steady</div>
              </div>
              <Icon name="bolt" size={26} style={{color:"var(--sage-dark)"}} />
            </div>
            <div style={{ height:10, borderRadius:6, background:"var(--warm)", overflow:"hidden", marginBottom:4 }}>
              <div style={{ width:"64%", height:"100%", borderRadius:6, background:"var(--sage-dark)" }} />
            </div>
            <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", textAlign:"center", marginTop:4 }}>← drag to set →</div>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {chip("aim for ~5 tasks today")}
            {chip("Jumpstart mode if stuck in bed","var(--earth-dark)","rgba(196,168,130,0.1)")}
          </div>
        </div>
      ),
    },
    {
      label: "Tasks",
      title: "Every task either drains or charges you.",
      desc: "Toggle whether a task costs or restores your energy, then set the intensity and a time estimate. Tasks sort into Must / Should / Could so MyBattery surfaces the right ones based on your energy. Add subtasks for anything with steps. Completely frozen on something? Long-press a task and tap \"Break the freeze\" to turn it into a focused 2–25 min sprint.",
      visual: (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { name:"Write quarterly report", impact:-20, dur:"2h", bucket:"must" },
            { name:"Reply to Slack threads",  impact:-5,  dur:"20m", bucket:"should" },
            { name:"Read an article",         impact:10,  dur:"15m", bucket:"could" },
          ].map((t,i) => (
            <div key={t.name}>
              <div style={{ background:"white", borderRadius:10, padding:"9px 12px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 1px 6px rgba(0,0,0,0.05)", border:"1.5px solid transparent" }}>
                <div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid var(--sage-light)", flexShrink:0 }} />
                <div style={{ flex:1, fontSize:12, color:"var(--ink)" }}>{t.name}</div>
                <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background: t.impact < 0 ? "rgba(196,114,106,0.1)" : "rgba(90,122,90,0.1)", color: t.impact < 0 ? "var(--error)" : "var(--sage-dark)", display:"inline-flex", alignItems:"center", gap:3 }}>
                  <Icon name={t.impact > 0 ? "bolt" : "battery"} size={9} />{t.impact > 0 ? `+${t.impact}` : t.impact}
                </span>
                <span style={{ fontSize:10, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace", display:"inline-flex", alignItems:"center", gap:3 }}><Icon name="timer" size={9} />{t.dur}</span>
              </div>
              {i === 0 && (
                <div style={{ marginLeft:14, marginTop:4, borderLeft:"2px solid var(--sage-light)", paddingLeft:10, display:"flex", flexDirection:"column", gap:3 }}>
                  {["Draft exec summary","Pull last quarter's numbers"].map(s => (
                    <div key={s} style={{ fontSize:11, color:"var(--ink-mute)", display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:12, height:12, borderRadius:3, border:"1.5px solid var(--sage-light)", flexShrink:0 }} />
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Energy battery",
      title: "Your energy has a number now.",
      desc: "The battery runs 0–100%. Draining tasks lower it; charging tasks raise it. If your remaining tasks would cost more than you have left, a nudge appears suggesting what to drop or defer. Below 20%, power-save mode kicks in with an amber theme. Drag the bar anytime to adjust manually — it refills slowly on its own if you haven't drained in 4+ hours.",
      visual: (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:40, lineHeight:1, color:"var(--sage-dark)" }}>18%</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", marginTop:3 }}>running low</div>
            </div>
            <div><Icon name="battery" size={28} style={{color:"var(--error)"}} /></div>
          </div>
          <div style={{ height:10, borderRadius:6, background:"var(--warm)", overflow:"hidden", marginBottom:6 }}>
            <div style={{ width:"18%", height:"100%", borderRadius:6, background:"var(--error)" }} />
          </div>
          <div style={{ background:"rgba(196,114,106,0.08)", border:"1.5px solid rgba(196,114,106,0.25)", borderRadius:9, padding:"10px 12px", marginTop:10, fontSize:12, color:"var(--error)", lineHeight:1.5 }}>
            Your tasks cost ~60% but you only have 18% left. Consider dropping "Write report" today.
          </div>
          <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
            {chip("below 20% → power-save mode","var(--error)","rgba(196,114,106,0.08)")}
          </div>
        </div>
      ),
    },
    {
      label: "Calendar",
      title: "Plan your day in plain language.",
      desc: "Add events as a sentence — \"I'm [doing something] from [time] to [time].\" MyBattery calculates the duration and places a block on the 24-hour grid. Make anything recurring: Daily, Weekdays, or custom days you pick. Auto-schedule (Power Mode) drops your pending tasks into open slots automatically, never overlapping existing events. Export as .ics to sync with any calendar app.",
      visual: (
        <div>
          <div style={{ background:"white", borderRadius:10, padding:"12px 14px", marginBottom:10, border:"1px solid var(--warm)" }}>
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
          </div>
          <div style={{ background:"rgba(90,122,90,0.1)", borderLeft:"3px solid var(--sage-dark)", borderRadius:8, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:500, color:"var(--ink)" }}>in a meeting</div>
              <div style={{ fontSize:10, color:"var(--ink-mute)", marginTop:2, fontFamily:"'DM Mono',monospace" }}>10:00 am – 11:30 am · repeats weekdays</div>
            </div>
            <Icon name="calendar" size={16} style={{color:"var(--ink-mute)"}} />
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {chip("auto-schedule into free slots")}
            {chip("export as .ics","var(--earth-dark)","rgba(196,168,130,0.1)")}
          </div>
        </div>
      ),
    },
    {
      label: "When you're stuck",
      title: "Three ways to get unstuck.",
      desc: "SOS button (top right) opens crisis support lines — 988, Crisis Text Line, and others — all free, confidential, and available right now. Jumpstart mode walks you through four gentle micro-movements when you're physically stuck or can't get out of bed. Task Paralysis modal (\"Break the freeze\" on any task) names what's in the way, picks one micro-action, and turns it into a focused sprint with a countdown timer.",
      visual: (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { icon:"shield",  label:"SOS",                  sub:"Crisis lines — 988, Crisis Text Line, more.", color:"var(--error)",      bg:"rgba(196,114,106,0.08)" },
            { icon:"leaf",    label:"Jumpstart mode",        sub:"4 micro-movements to get out of bed.",    color:"var(--sage-dark)",  bg:"rgba(90,122,90,0.08)" },
            { icon:"timer",   label:"Break the freeze",      sub:"Name the block · pick an action · sprint.", color:"var(--earth-dark)", bg:"rgba(196,168,130,0.08)" },
          ].map(r => (
            <div key={r.label} style={{ display:"flex", alignItems:"center", gap:12, background:"white", borderRadius:10, padding:"10px 12px", border:`1.5px solid ${r.bg.replace("0.08","0.3")}` }}>
              <div style={{ width:34, height:34, borderRadius:"50%", background:r.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon name={r.icon} size={16} style={{color:r.color}} />
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:"var(--ink)" }}>{r.label}</div>
                <div style={{ fontSize:10, color:"var(--ink-mute)", marginTop:1 }}>{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Wellness",
      title: "Built-in tools for when you need to reset.",
      desc: "The Wellness tab has Grounding exercises, Breathing (Box, 4-7-8), a Body Scan, a Micro-journal, a Focus timer (Pomodoro), and mental health Screening (PHQ-9 and GAD-7). When your energy is very low, Hibernate mode gives you a gentle wind-down with journaling prompts to close the day without guilt.",
      visual: (
        <div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
            {["Grounding","Breathing","Journal","Focus","Screening"].map((tab,i) => (
              <div key={tab} style={{ fontSize:11, padding:"5px 11px", borderRadius:20, border:`1.5px solid ${i===0?"var(--sage-dark)":"var(--warm)"}`, background:i===0?"rgba(90,122,90,0.08)":"white", color:i===0?"var(--sage-dark)":"var(--ink-mute)", fontFamily:"'DM Sans',sans-serif" }}>{tab}</div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { icon:"wind",     title:"Breathing",    sub:"Box · 4-7-8" },
              { icon:"brain",    title:"Screening",    sub:"PHQ-9 · GAD-7" },
              { icon:"moon",     title:"Hibernate",    sub:"Wind-down + journal" },
            ].map(c => (
              <div key={c.title} style={{ flex:1, background:"white", border:"1.5px solid var(--warm)", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                <div style={{ marginBottom:5 }}><Icon name={c.icon} size={18} style={{color:"var(--sage-dark)"}} /></div>
                <div style={{ fontSize:11, fontWeight:500, color:"var(--ink)" }}>{c.title}</div>
                <div style={{ fontSize:9, color:"var(--ink-mute)", marginTop:2, lineHeight:1.4 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      label: "AI Coach",
      title: "An AI to think out loud with.",
      desc: "Tap the sparkle button (bottom right) to open the AI Coach. Talk through your day, get help deciding what to prioritize, or describe what you need to do and let it generate a task list. It knows your current battery level and task load. The Schedule Generator sub-tab turns a plain-language description of your day into a ready-to-add schedule.",
      visual: (
        <div>
          <div style={{ background:"white", borderRadius:12, padding:"14px 16px", marginBottom:10, border:"1px solid var(--warm)" }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>AI Coach</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ alignSelf:"flex-start", background:"var(--cream)", border:"1px solid var(--warm)", borderRadius:"14px 14px 14px 4px", padding:"8px 12px", fontSize:12, color:"var(--ink)", maxWidth:"85%", lineHeight:1.5 }}>
                I have a presentation at 2 pm and keep avoiding prep. Can you help me break it down?
              </div>
              <div style={{ alignSelf:"flex-end", background:"var(--sage-dark)", borderRadius:"14px 14px 4px 14px", padding:"8px 12px", fontSize:12, color:"white", maxWidth:"85%", lineHeight:1.5 }}>
                Sure — with 64% battery, you have room for 2 focused blocks. Want me to add the sub-steps as tasks?
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {chip("knows your battery + task load")}
            {chip("schedule generator tab","var(--earth-dark)","rgba(196,168,130,0.1)")}
          </div>
        </div>
      ),
    },
    {
      label: "Settings & Privacy",
      title: "More control when you want it.",
      desc: "Power Mode unlocks auto-scheduling and .ics export. Gentle Mode softens all copy and skips hard questions on low-energy days. Privacy Mode blurs task names in shared spaces — hover to reveal. History, Patterns, and Energy Log let you spot trends over time. The Safety tab has crisis resources available anytime. You can clear all data or delete your account from Account settings.",
      visual: (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { icon:"bolt",     label:"Power Mode",    sub:"Auto-schedule · ICS export" },
            { icon:"leaf",     label:"Gentle Mode",   sub:"Softer copy · skips hard questions" },
            { icon:"lock",     label:"Privacy Mode",  sub:"Blur task names · hover to reveal" },
            { icon:"chart",    label:"History",       sub:"Patterns · Energy Log · trends" },
            { icon:"shield",   label:"Safety",        sub:"Crisis resources · always available" },
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
