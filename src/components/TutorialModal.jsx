import { useState } from "react";
import Icon from "./Icon.jsx";

export default function TutorialModal({ onClose }) {
  const [step, setStep] = useState(0);

  const chip = (label, color="var(--sage-dark)", bg="rgba(90,122,90,0.1)") => (
    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, border:`1.5px solid ${color}`, color, background:bg, fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
  );

  const rows = items => (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {items.map(r => (
        <div key={r.label} style={{ display:"flex", alignItems:"center", gap:12, background:"var(--card)", borderRadius:10, padding:"10px 12px", border:"1px solid var(--warm)" }}>
          <div style={{ width:34, height:34, borderRadius:"50%", background:r.bg ?? "rgba(90,122,90,0.08)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Icon name={r.icon} size={16} style={{color:r.color ?? "var(--sage-dark)"}} />
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:500, color:"var(--ink)" }}>{r.label}</div>
            <div style={{ fontSize:10, color:"var(--ink-mute)", marginTop:1 }}>{r.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const SLIDES = [
    {
      label: "Morning check-in",
      title: "Start with where you actually are.",
      desc: "Each morning, drag the battery to where your energy really is. If you like, answer a few quick questions about sleep, food, water and mood — MyBattery will suggest something that might help.",
      visual: (
        <div>
          <div style={{ background:"var(--card)", borderRadius:12, padding:"16px 18px", marginBottom:10, border:"1px solid var(--warm)" }}>
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
            {chip("optional: sleep · food · water · mood")}
          </div>
        </div>
      ),
    },
    {
      label: "Tasks & energy",
      title: "Every task costs or gives energy.",
      desc: "Tasks live in Must, Should and Could — swipe between them. Each one drains or charges your battery. If your list costs more than you have left, MyBattery suggests what to move to tomorrow. Press and hold a task's circle to finish it, or swipe a task left to delete it. Frozen on something? Tap \"stuck?\" on the task.",
      visual: (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:12 }}>
            <div style={{ flex:1, height:1, background:"var(--sage-light)" }} />
            <div style={{ display:"flex", gap:18, padding:"0 12px" }}>
              {["MUST","SHOULD","COULD"].map((label, i) => (
                <span key={label} style={{ fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, textTransform:"uppercase", color: i===0 ? "var(--ink)" : "var(--ink-mute)", paddingBottom:3, borderBottom: i===0 ? "1.5px solid var(--ink)" : "1.5px solid transparent" }}>{label}</span>
              ))}
            </div>
            <div style={{ flex:1, height:1, background:"var(--sage-light)" }} />
          </div>
          <div style={{ background:"var(--card)", border:"1.5px solid var(--sage-light)", borderRadius:16, padding:"14px 16px", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)", textAlign:"center", marginBottom:10 }}>Must Do</div>
            {[
              { name:"Write quarterly report", impact:-20, dur:"2h" },
              { name:"Send project update",     impact:-8,  dur:"20m" },
            ].map(t => (
              <div key={t.name} style={{ background:"var(--cream)", borderRadius:10, padding:"8px 12px", display:"flex", alignItems:"center", gap:10, marginBottom:6, border:"1px solid var(--warm)" }}>
                <div style={{ width:15, height:15, borderRadius:"50%", border:"2px solid var(--sage-light)", flexShrink:0 }} />
                <div style={{ flex:1, fontSize:12, color:"var(--ink)" }}>{t.name}</div>
                <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:"rgba(196,114,106,0.1)", color:"var(--error)", display:"inline-flex", alignItems:"center", gap:3 }}>
                  <Icon name="battery" size={9} />{t.impact}
                </span>
                <span style={{ fontSize:10, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace" }}>{t.dur}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontSize:11, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace" }}>
            <span style={{ fontSize:16 }}>←</span>
            <span>swipe to switch buckets</span>
            <span style={{ fontSize:16 }}>→</span>
          </div>
        </div>
      ),
    },
    {
      label: "Finding your way",
      title: "Five tabs, one idea each.",
      desc: "Today is your tasks and battery. Routines holds your routines and brain dump. Calendar is your week. Wellness has grounding, breathing, Jumpstart and your journal. More holds settings, your history, and the Safety area.",
      visual: rows([
        { icon:"bolt",     label:"Today", sub:"Tasks and battery" },
        { icon:"brain",    label:"Routines", sub:"Routines · brain dump" },
        { icon:"calendar", label:"Calendar", sub:"Coming up this week" },
        { icon:"leaf",     label:"Wellness", sub:"Grounding · breathing · Jumpstart · journal" },
        { icon:"gear",     label:"More", sub:"Settings · history · safety" },
      ]),
    },
    {
      label: "When it's hard",
      title: "Help is always one tap away.",
      desc: "The SOS button (top right) opens free, confidential crisis lines — and links to therapist finders and self-checks when you need something less urgent. The + button lets you add a task, brain dump, log energy, or talk things through with the AI assistant.",
      visual: rows([
        { icon:"shield", label:"SOS",        sub:"Crisis lines · therapist finder · self-checks", color:"var(--error)", bg:"rgba(196,114,106,0.08)" },
        { icon:"timer",  label:"stuck?",     sub:"Name the block · pick one action · sprint",   color:"var(--earth-dark)", bg:"rgba(196,168,130,0.08)" },
        { icon:"sparkle",label:"+ button",   sub:"Add task · brain dump · log energy · AI" },
      ]),
    },
  ];

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="tutorial-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tutorial-card" style={{ position:"relative" }}>
        <button onClick={onClose} aria-label="Close" style={{ position:"absolute", top:12, right:12, background:"none", border:"none", cursor:"pointer", color:"var(--ink-mute)", fontSize:18, lineHeight:1, padding:4 }}>✕</button>
        <div className="tutorial-dots">
          {SLIDES.map((_, i) => (
            <div key={i} className={`tutorial-dot ${i===step?"active":i<step?"done":""}`} onClick={() => setStep(i)} style={{ cursor:"pointer" }} />
          ))}
        </div>
        <div className="tutorial-visual">{slide.visual}</div>
        <div className="tutorial-step">{slide.label} · {step+1} of {SLIDES.length}</div>
        <div className="tutorial-title">{slide.title}</div>
        <div className="tutorial-desc">{slide.desc}</div>
        <div className="tutorial-actions" style={{ justifyContent:"flex-end" }}>
          {step > 0 && <button className="btn-back" onClick={() => setStep(s => s-1)}>← Back</button>}
          {isLast
            ? <button className="btn-primary" onClick={onClose}>Understood →</button>
            : <button className="btn-primary" onClick={() => setStep(s => s+1)}>Sounds good →</button>
          }
        </div>
      </div>
    </div>
  );
}
