import { useState, useEffect } from "react";

const STEPS = [
  {
    selector: ".impact-toggle.drain",
    title: "Draining or charging?",
    desc: "Toggle whether a task costs or restores your energy. The app uses this to protect your day and surface the right tasks at the right time.",
  },
  {
    selector: ".battery-panel",
    title: "Your energy has a number",
    desc: "Drag the bar to set where you're starting from. It rises and falls as you check off tasks throughout the day.",
  },
  {
    selector: ".nav-sos-btn",
    title: "Overwhelmed? Hit SOS",
    desc: "Get an instant grounding exercise or breathing tool — no decisions required.",
  },
  {
    selector: ".tutorial-help-btn",
    title: "Full walkthrough here",
    desc: "Tap ? anytime to replay the feature guide at your own pace. Takes about 2 minutes.",
  },
];

const PAD = 5;
const TOOLTIP_W = 252;

export default function CoachMarks({ onDone }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    setRect(null);
    const el = document.querySelector(STEPS[step].selector);
    if (!el) { advance(); return; }
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Wait for scroll to fully settle before measuring position
    let attempts = 0;
    let lastTop = null;
    const measure = () => {
      const domRect = el.getBoundingClientRect();
      // Keep polling until position stabilises or we've waited long enough
      if (attempts < 12 && domRect.top !== lastTop) {
        lastTop = domRect.top;
        attempts++;
        setTimeout(measure, 80);
        return;
      }
      // Skip if element is outside the visible viewport
      const H = window.innerHeight;
      if (domRect.bottom < 0 || domRect.top > H || domRect.width === 0) {
        advance();
        return;
      }
      const computed = getComputedStyle(el);
      const br = parseFloat(computed.borderTopLeftRadius) || 8;
      setRect({
        top: domRect.top, left: domRect.left,
        right: domRect.right, bottom: domRect.bottom,
        width: domRect.width, height: domRect.height,
        borderRadius: br,
      });
    };
    const t = setTimeout(measure, 120);
    return () => clearTimeout(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function advance() {
    if (step >= STEPS.length - 1) { finish(); }
    else { setStep(s => s + 1); }
  }

  function finish() {
    localStorage.setItem("lf_coach_done", "1");
    onDone();
  }

  if (!rect) return null;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const isLast = step === STEPS.length - 1;

  const spotTop    = Math.max(0, rect.top    - PAD);
  const spotLeft   = Math.max(0, rect.left   - PAD);
  const spotBottom = Math.min(H, rect.bottom + PAD);
  const spotRight  = Math.min(W, rect.right  + PAD);
  const spotW      = spotRight - spotLeft;
  const spotH      = spotBottom - spotTop;
  // Scale the border-radius proportionally with padding, clamped to a true pill
  const spotRadius = Math.min(rect.borderRadius + PAD * 0.5, spotH / 2);

  const belowRoom = H - spotBottom;
  const aboveRoom = spotTop;
  const useBelow  = belowRoom >= 160 || belowRoom >= aboveRoom;

  const tooltipCenterX = (rect.left + rect.right) / 2;
  const ttLeft = Math.max(12, Math.min(W - TOOLTIP_W - 12, tooltipCenterX - TOOLTIP_W / 2));
  const ttTop  = useBelow ? spotBottom + 10 : spotTop - 10 - 158;

  const arrowOffset = Math.max(12, Math.min(TOOLTIP_W - 24, tooltipCenterX - ttLeft - 6));

  const dim = "rgba(28,26,20,0.58)";
  // Unique mask ID per step prevents stale mask references during transitions
  const maskId = `coach-mask-${step}`;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9000, pointerEvents:"none" }}>

      {/* Single SVG overlay with a rounded-rect cutout — no corner bleed */}
      <svg
        style={{ position:"fixed", inset:0, width:"100%", height:"100%", pointerEvents:"all" }}
        onClick={finish}
      >
        <defs>
          <mask id={maskId}>
            {/* White = show dim; black = cut out (transparent) */}
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotLeft} y={spotTop}
              width={spotW} height={spotH}
              rx={spotRadius} ry={spotRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={dim} mask={`url(#${maskId})`} />
      </svg>

      {/* Highlight ring — border-radius matches the cutout exactly */}
      <div style={{
        position:"fixed", top:spotTop, left:spotLeft,
        width:spotW, height:spotH,
        borderRadius:spotRadius,
        boxShadow:"0 0 0 2.5px #5a7a5a, 0 0 0 5px rgba(90,122,90,0.18)",
        overflow:"hidden",
        pointerEvents:"none",
      }} />

      {/* Tooltip */}
      <div style={{
        position:"fixed", top:ttTop, left:ttLeft, width:TOOLTIP_W,
        background:"white", borderRadius:13, padding:"16px 18px",
        filter:"drop-shadow(0 8px 28px rgba(0,0,0,0.18)) drop-shadow(0 2px 6px rgba(0,0,0,0.10))",
        pointerEvents:"all", zIndex:9001,
      }}>
        {useBelow && (
          <div style={{
            position:"absolute", top:-8, left:arrowOffset,
            width:14, height:9, background:"white",
            clipPath:"polygon(50% 0%, 0% 100%, 100% 100%)",
          }} />
        )}
        {!useBelow && (
          <div style={{
            position:"absolute", bottom:-8, left:arrowOffset,
            width:14, height:9, background:"white",
            clipPath:"polygon(0% 0%, 100% 0%, 50% 100%)",
          }} />
        )}

        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:1.3, textTransform:"uppercase", color:"#5a7a5a", marginBottom:6 }}>
          {step + 1} of {STEPS.length}
        </div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:"#2a2a1e", marginBottom:7, lineHeight:1.3 }}>
          {STEPS[step].title}
        </div>
        <div style={{ fontSize:12.5, color:"#6a6a5a", lineHeight:1.65, marginBottom:14, fontFamily:"'DM Sans',sans-serif" }}>
          {STEPS[step].desc}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={finish} style={{ fontSize:11, color:"#9a9a8a", background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
            Skip tour
          </button>
          <button onClick={advance} style={{ fontSize:12, padding:"7px 18px", borderRadius:20, border:"none", background:"#5a7a5a", color:"white", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, letterSpacing:0.2 }}>
            {isLast ? "Got it" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
