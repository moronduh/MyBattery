import { useState, useEffect } from "react";
import Icon from "./Icon.jsx";

const TPM_DATA = {
  emotion:     ["overwhelmed","anxious","foggy","frozen","scattered","exhausted","restless","avoidant"],
  roadblock:   ["don't know where to start","it feels too big","afraid to fail","waiting to feel ready","too distracted","feels pointless right now","I'm too tired","other things keep pulling me"],
  microAction: ["open the document","write one sentence","set up my workspace","read the first paragraph","make a list of sub-steps","send one message","set a timer and try","just look at it for 2 minutes"],
  tinyTime:    [{ label:"2 min", mins:2 },{ label:"5 min", mins:5 },{ label:"10 min", mins:10 },{ label:"15 min", mins:15 },{ label:"25 min", mins:25 }],
};

export default function TaskParalysisModal({ task, onClose, onComplete }) {
  const [phase,       setPhase]       = useState("form");
  const [emotion,     setEmotion]     = useState([]);
  const [roadblock,   setRoadblock]   = useState([]);
  const [microAction, setMicroAction] = useState([]);
  const [microCustom, setMicroCustom] = useState("");
  const [tinyTime,    setTinyTime]    = useState(null);
  const [running,     setRunning]     = useState(false);
  const [secsLeft,    setSecsLeft]    = useState(0);
  const totalSecs = tinyTime ? tinyTime * 60 : 0;

  function toggle(setter, val) {
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }
  function joinVals(arr, custom = "") {
    const all = [...arr, ...(custom.trim() ? [custom.trim()] : [])];
    if (!all.length) return "___";
    if (all.length === 1) return all[0];
    return all.slice(0, -1).join(", ") + " & " + all[all.length - 1];
  }

  const emotionStr     = joinVals(emotion);
  const roadblockStr   = joinVals(roadblock);
  const microActionStr = joinVals(microAction, microCustom);
  const canStart = emotion.length > 0 && roadblock.length > 0
    && (microAction.length > 0 || microCustom.trim()) && tinyTime !== null;

  function handleStart() {
    setSecsLeft(tinyTime * 60);
    setPhase("focus");
    setRunning(true);
  }

  useEffect(() => {
    if (phase !== "focus" || !running) return;
    if (secsLeft <= 0) {
      setRunning(false);
      setPhase("done");
      onComplete(task.id);
      return;
    }
    const id = setTimeout(() => setSecsLeft(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, running, secsLeft]);

  const R    = 88;
  const CIRC = 2 * Math.PI * R;
  const pct  = totalSecs > 0 ? secsLeft / totalSecs : 1;
  const mins = String(Math.floor(secsLeft / 60)).padStart(2, "0");
  const secs = String(secsLeft % 60).padStart(2, "0");

  if (phase === "done") {
    return (
      <div className="tpm-focus-overlay">
        <div className="tpm-done-banner">
          <div className="tpm-done-title">You did it.</div>
          <div className="tpm-done-sub">You broke through the freeze.<br />That took real courage.</div>
          <div className="tpm-done-energy">+2% energy restored</div>
          <button className="tpm-done-close" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  if (phase === "focus") {
    return (
      <div className="tpm-focus-overlay">
        <div className="tpm-focus-eyebrow">Focus Mode · {tinyTime} min</div>
        <div className="tpm-focus-action">"{microActionStr}"</div>
        <div className="tpm-focus-ring-wrap">
          <svg className="tpm-focus-ring-svg" width="200" height="200" viewBox="0 0 200 200">
            <circle className="tpm-focus-ring-bg" cx="100" cy="100" r={R} />
            <circle className="tpm-focus-ring-fill" cx="100" cy="100" r={R}
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)} />
          </svg>
          <div className="tpm-focus-time">
            <div className="tpm-focus-mm-ss">{mins}:{secs}</div>
            <div className="tpm-focus-label">remaining</div>
          </div>
        </div>
        <div className="tpm-focus-controls">
          <button className="tpm-focus-btn-pause" onClick={() => setRunning(r => !r)}>
            {running ? "Pause" : "Resume"}
          </button>
          <button className="tpm-focus-btn-exit" onClick={onClose}>Exit</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tpm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tpm-card">
        <div className="tpm-eyebrow">Break the freeze</div>
        <div className="tpm-title">Let's get you unstuck.</div>
        <div className="tpm-task-name">{task.name}</div>

        <div className="tpm-preview">
          I'm feeling <em>{emotionStr}</em> and stuck because <em>{roadblockStr}</em>.
          {" "}My next step is to <em>{microActionStr}</em> — just for{" "}
          <em>{tinyTime ? `${tinyTime} minutes` : "___"}</em>.
        </div>

        <div className="tpm-section">
          <div className="tpm-section-label">How are you feeling?</div>
          <div className="tpm-chips">
            {TPM_DATA.emotion.map(o => (
              <button key={o} className={`tpm-chip ${emotion.includes(o) ? "active" : ""}`}
                onClick={() => toggle(setEmotion, o)}>{o}</button>
            ))}
          </div>
        </div>

        <div className="tpm-section">
          <div className="tpm-section-label">What's in the way?</div>
          <div className="tpm-chips">
            {TPM_DATA.roadblock.map(o => (
              <button key={o} className={`tpm-chip ${roadblock.includes(o) ? "active" : ""}`}
                onClick={() => toggle(setRoadblock, o)}>{o}</button>
            ))}
          </div>
        </div>

        <div className="tpm-section">
          <div className="tpm-section-label">One micro-action</div>
          <div className="tpm-chips">
            {TPM_DATA.microAction.map(o => (
              <button key={o} className={`tpm-chip ${microAction.includes(o) ? "active" : ""}`}
                onClick={() => toggle(setMicroAction, o)}>{o}</button>
            ))}
          </div>
          <input className="tpm-custom-input" placeholder="or describe your own…"
            value={microCustom} onChange={e => setMicroCustom(e.target.value)} />
        </div>

        <div className="tpm-section">
          <div className="tpm-section-label">Tiny time commitment</div>
          <div className="tpm-chips">
            {TPM_DATA.tinyTime.map(o => (
              <button key={o.mins} className={`tpm-chip tpm-time ${tinyTime === o.mins ? "active" : ""}`}
                onClick={() => setTinyTime(o.mins)}>{o.label}</button>
            ))}
          </div>
        </div>

        <div className="tpm-actions">
          <button className="tpm-btn-cancel" onClick={onClose}>Not now</button>
          <button className="tpm-btn-start" disabled={!canStart} onClick={handleStart}>
            <Icon name="timer" size={15} />Start focus
          </button>
        </div>
      </div>
    </div>
  );
}
