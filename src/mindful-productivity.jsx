import { useState, useEffect, useLayoutEffect, useRef, useMemo, Component } from "react";
import { createPortal } from "react-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ConfirmModal from "./components/ConfirmModal.jsx";
import DeleteAccountModal from "./components/DeleteAccountModal.jsx";
import Icon from "./components/Icon.jsx";
import Toast from "./components/Toast.jsx";
import TutorialModal from "./components/TutorialModal.jsx";
import TaskParalysisModal from "./components/TaskParalysisModal.jsx";
import CoachMarks from "./components/CoachMarks.jsx";
import WeekStrip from "./components/WeekStrip.jsx";
import { logClientError } from "./firebase.js";
import { CapacitorApp, syncEnergyLevel, syncTasks, getEnergyLevel, getPendingTask, clearPendingTask, getPendingDeepLink, clearPendingDeepLink } from "./shared-data-plugin.js";
import { PrivacyPolicyModal, TermsModal } from "./components/LegalModal.jsx";
import PaywallScreen from "./components/PaywallScreen.jsx";
import WaitlistScreen from "./components/WaitlistScreen.jsx";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap";
document.head.appendChild(fontLink);

// When the keyboard opens, iOS scrolls the page and shrinks the visual viewport, which left bottom
// sheets (Add/Edit Task, Brain Dump…) sitting under the status bar or over a shifted page. Publish
// the visible area as CSS vars so those overlays can pin themselves to what is actually on screen.
if (typeof window !== "undefined" && window.visualViewport) {
  const vv = window.visualViewport;
  const syncViewportVars = () => {
    const root = document.documentElement.style;
    root.setProperty("--vv-top", `${vv.offsetTop}px`);
    root.setProperty("--vv-height", `${vv.height}px`);
  };
  syncViewportVars();
  vv.addEventListener("resize", syncViewportVars);
  vv.addEventListener("scroll", syncViewportVars);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  :root {
    --teal: #4a9e8e; --teal-light: #b8ddd8; --teal-dark: #1c7562;
    --cream: #f4f7f7; --warm: #e6efee;
    /* Minimal: sections sit flat on the page (--card), only true surfaces are raised */
    --card: var(--cream); --surface: #ffffff; --line: rgba(20,30,30,0.10);
    --control-line: rgba(20,30,30,0.30); /* outline of empty checkboxes */
    --slate: #4a7a9b; --slate-dark: #2a5a7a;
    --ink: #141e1e; --ink-soft: #2e4040; --ink-mute: #5a7070;
    --error: #a84040;
    --focus-blue: #2a6a8a; --focus-blue-light: rgba(42,106,138,0.12);
    --glow: transparent;
    --radius: 8px; --radius-sm: 6px;
    --transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
  }
  [data-theme="dark"] {
    /* Soft near-black with a hint of green (not pure black, which smears on OLED); text ≈ 14:1,
       gentle enough not to glow at night, muted text ≈ 6.5:1 */
    --cream: #121514; --warm: #1a1e1c; --card: var(--cream); --surface: #1b1f1d; --line: rgba(223,230,228,0.14);
    --control-line: rgba(223,230,228,0.45);
    --ink: #dfe6e4; --ink-soft: #bccac7; --ink-mute: #93a6a2;
    --teal-light: #1d3a34; --teal-dark: #3ecfb0;
    --slate-dark: #4a9aba;
    --error: #e07070;
    --focus-blue: #5aaaca; --focus-blue-light: rgba(90,170,202,0.2);
    --glow: transparent;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { width: 100%; overflow-x: hidden; }
  body { width: 100%; overflow-x: hidden; overflow-x: clip; background: var(--cream); }

  .app { min-height: 100vh; min-height: 100dvh; background: var(--cream); color: var(--ink); font-family: 'DM Sans', sans-serif; font-weight: 400; position: relative; overflow-x: hidden; overflow-x: clip; }
  .app[data-view="shutdown"] { background: #111612; }
  .app[data-view="shutdown"] .nav { background: #111612; }
  .app[data-view="shutdown"] .main { background: #111612; }
  [data-theme="dark"] .app[data-view="shutdown"] {
    --cream:#faf7f2; --warm:#f0ebe0; --card:var(--cream); --surface:white; --line:rgba(42,42,37,0.12);
    --ink:#2a2a25; --ink-soft:#5a5a52; --ink-mute:#9a9a8a;
    --teal-light:#c4d4c4; --teal-dark:#5a7a5a; --slate-dark:#9a7c5a;
    --error:#c4726a; --focus-blue:#6a8aaa; --focus-blue-light:rgba(106,138,170,0.12);
    --glow:transparent;
  }

  /* NAV */
  .nav { display:flex; align-items:center; justify-content:space-between; padding:20px 36px; padding-top:max(20px,env(safe-area-inset-top)); position:sticky; top:0; z-index:20; background:var(--cream); }
  .week-strip-wrap { position:sticky; top:62px; z-index:19; background:var(--cream); margin:0 -16px; padding:4px 16px 8px; }
  .nav-logo { font-family:'Playfair Display',serif; font-size:22px; font-weight:400; color:var(--ink); letter-spacing:-0.5px; }
  .nav-logo span { color:var(--teal-dark); font-style:italic; }
  .nav-tabs { display:flex; gap:4px; background:var(--warm); border-radius:40px; padding:4px; }
  /* Shared layout contract for every nav tab — power-save amber theme must not change any of these */
  .nav-tab {
    display:inline-flex; align-items:center; justify-content:center;
    box-sizing:border-box; height:36px; padding:0 20px;
    border:none; border-radius:40px; flex-shrink:0; white-space:nowrap;
    font-family:'DM Sans',sans-serif; font-size:13px; font-weight:400;
    color:var(--ink-soft); background:transparent;
    cursor:pointer; transition:var(--transition); letter-spacing:0.3px;
  }
  .nav-tab.active { background:var(--cream); color:var(--ink); font-weight:500; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
  /* Power-save: re-assert layout so amber colour swap can't drift sizing */
  [data-battery-save="true"] .nav-tab,
  [data-battery-save="true"] .nav-tab.active {
    display:inline-flex; align-items:center; justify-content:center;
    box-sizing:border-box; height:36px; padding:0 20px;
    border:none; border-radius:40px; flex-shrink:0;
    font-size:13px;
  }
  .nav-right { display:flex; align-items:center; gap:14px; }
  .nav-profile-btn { background:var(--warm); border:none; border-radius:40px; padding:7px 14px; font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-soft); cursor:pointer; transition:var(--transition); letter-spacing:0.5px; }
  .nav-profile-btn:hover { background:var(--teal-light); color:var(--teal-dark); }
  .nav-jumpstart-btn { background:none; border:1.5px solid var(--warm); border-radius:50%; width:32px; height:32px; cursor:pointer; color:var(--ink-mute); transition:var(--transition); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .nav-jumpstart-btn:hover { border-color:var(--teal-light); color:var(--teal-dark); }
  .nav-time { font-family:'DM Mono',monospace; font-size:13px; color:var(--ink-mute); font-weight:400; }

  .main { max-width:960px; margin:0 auto; padding:0 36px 60px; position:relative; z-index:5; }

  /* ONBOARDING */
  .onboard-wrap { max-width:600px; margin:0 auto; padding:40px 0 60px; animation:fadeUp 0.6s ease both; }
  .onboard-progress { display:flex; align-items:center; gap:8px; margin-bottom:36px; justify-content:center; }
  .onboard-step-dot { width:28px; height:4px; border-radius:2px; background:var(--warm); transition:var(--transition); }
  .onboard-step-dot.active { background:var(--teal-dark); }
  .onboard-step-dot.done   { background:var(--teal-light); }
  .onboard-card { background:var(--card); border-radius:24px; padding:44px 48px; box-shadow:0 4px 40px rgba(0,0,0,0.05); }
  .onboard-eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--teal-dark); margin-bottom:10px; text-align:center; }
  .onboard-title { font-family:'Playfair Display',serif; font-size:26px; font-weight:400; color:var(--ink); line-height:1.35; margin-bottom:8px; text-align:center; }
  .onboard-sub { font-size:14px; color:var(--ink-soft); line-height:1.65; margin-bottom:32px; text-align:center; }
  .onboard-feature-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin:0 0 36px; }
  .onboard-feature-card { background:var(--cream); border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:16px 14px; text-align:left; }
  .onboard-name-input { width:100%; font-size:22px; font-family:'Playfair Display',serif; border:none; border-bottom:2px solid var(--teal); outline:none; padding:8px 0; background:transparent; color:var(--ink); margin-bottom:36px; box-sizing:border-box; }
  .onboard-name-input::placeholder { color:var(--ink-mute); font-style:italic; }
  .onboard-summary-row { display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:var(--radius-sm); background:var(--cream); border:1px solid var(--warm); margin-bottom:8px; }
  .profile-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:28px; }
  .profile-option { border:2px solid var(--warm); border-radius:var(--radius); padding:18px 16px; cursor:pointer; transition:var(--transition); background:var(--cream); position:relative; }
  .profile-option:hover { border-color:var(--teal-light); transform:translateY(-2px); }
  .profile-option.selected { border-color:var(--teal-dark); background:rgba(90,122,90,0.05); }
  .profile-icon { font-size:26px; margin-bottom:8px; display:block; }
  .profile-name { font-size:14px; font-weight:500; color:var(--ink); margin-bottom:3px; }
  .profile-hint { font-size:12px; color:var(--ink-mute); line-height:1.5; }
  .profile-baseline { position:absolute; top:12px; right:12px; font-family:'DM Mono',monospace; font-size:10px; color:var(--teal-dark); background:rgba(90,122,90,0.1); padding:2px 7px; border-radius:20px; }
  .capacity-display { text-align:center; margin-bottom:24px; }
  .capacity-num { font-family:'Playfair Display',serif; font-size:64px; color:var(--ink); line-height:1; margin-bottom:6px; }
  .capacity-label { font-size:13px; color:var(--ink-mute); font-family:'DM Mono',monospace; letter-spacing:1px; }
  .capacity-slider-wrap { padding:0 8px; margin-bottom:28px; }
  .capacity-slider { width:100%; -webkit-appearance:none; height:4px; border-radius:2px; background:var(--warm); outline:none; cursor:pointer; }
  .capacity-slider::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:var(--teal-dark); box-shadow:0 2px 8px rgba(90,122,90,0.35); cursor:pointer; transition:transform 0.2s; }
  .capacity-slider::-webkit-slider-thumb:hover { transform:scale(1.15); }
  .capacity-scale { display:flex; justify-content:space-between; margin-top:8px; }
  .capacity-scale span { font-size:11px; color:var(--ink-mute); font-family:'DM Mono',monospace; }
  .capacity-suggestion { background:rgba(196,168,130,0.12); border:1px solid rgba(196,168,130,0.3); border-radius:var(--radius-sm); padding:12px 16px; font-size:14px; color:var(--slate-dark); line-height:1.6; margin-bottom:28px; display:flex; align-items:flex-start; gap:10px; }
  .capacity-suggestion::before { content:''; display:none; }
  .rhythm-options { display:flex; flex-direction:column; gap:10px; margin-bottom:32px; }
  .rhythm-option { border:2px solid var(--warm); border-radius:var(--radius-sm); padding:16px 18px; cursor:pointer; transition:var(--transition); background:var(--cream); display:flex; align-items:flex-start; gap:14px; }
  .rhythm-option:hover { border-color:var(--teal-light); }
  .rhythm-option.selected { border-color:var(--teal-dark); background:rgba(90,122,90,0.04); }
  .rhythm-icon { font-size:20px; flex-shrink:0; margin-top:1px; }
  .rhythm-name { font-size:14px; font-weight:500; color:var(--ink); margin-bottom:3px; }
  .rhythm-desc { font-size:13px; color:var(--ink-mute); line-height:1.5; }
  .preview-energy-row { display:flex; flex-direction:column; gap:10px; margin-bottom:24px; }
  .preview-row { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-radius:var(--radius-sm); background:var(--cream); border:1px solid var(--warm); }
  .preview-row-left { display:flex; align-items:center; gap:12px; }
  .preview-row-icon { font-size:20px; }
  .preview-count { font-family:'Playfair Display',serif; font-size:26px; color:var(--teal-dark); display:flex; align-items:baseline; gap:5px; }
  .preview-count small { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); }
  .onboard-actions { display:flex; align-items:center; justify-content:space-between; }
  .btn-back { background:transparent; border:1.5px solid var(--warm); border-radius:40px; padding:11px 22px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-soft); cursor:pointer; transition:var(--transition); }
  .btn-back:hover { border-color:var(--teal-light); color:var(--ink); }
  .btn-secondary { background:transparent; border:1.5px solid var(--warm); border-radius:40px; padding:9px 20px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-soft); cursor:pointer; transition:var(--transition); display:inline-flex; align-items:center; gap:6px; }
  .btn-secondary:hover { border-color:var(--teal-light); color:var(--ink); }
  .btn-primary { background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:13px 32px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:var(--transition); letter-spacing:0.3px; }
  .btn-primary:hover { background:var(--teal); transform:translateY(-1px); box-shadow:0 6px 20px rgba(90,122,90,0.3); }
  .btn-primary:disabled { opacity:0.4; cursor:not-allowed; transform:none; box-shadow:none; }
  .btn-skip { background:transparent; border:none; font-size:13px; color:var(--ink-mute); cursor:pointer; text-decoration:underline; text-underline-offset:3px; padding:4px; transition:var(--transition); }
  .btn-skip:hover { color:var(--ink-soft); }

  /* READINESS */
  .readiness-card { background:var(--card); border-radius:24px; padding:48px; max-width:640px; margin:40px auto; box-shadow:0 4px 40px rgba(0,0,0,0.05); text-align:center; animation:fadeUp 0.6s ease both; }
  .readiness-eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--teal-dark); margin-bottom:12px; }
  .readiness-title { font-family:'Playfair Display',serif; font-size:32px; font-weight:400; color:var(--ink); line-height:1.3; margin-bottom:8px; }
  .readiness-subtitle { font-size:15px; color:var(--ink-soft); margin-bottom:40px; line-height:1.6; }
  .readiness-struggle-btn { display:block; margin:14px auto 0; background:none; border:none; font-family:'DM Mono',monospace; font-size:11px; color:var(--focus-blue); cursor:pointer; transition:var(--transition); letter-spacing:0.3px; text-decoration:underline; text-underline-offset:3px; opacity:0.7; }
  .readiness-struggle-btn:hover { opacity:1; }
  .settings-advanced-toggle { display:block; width:100%; margin:20px 0 12px; padding:0; background:none; border:none; text-align:left; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:var(--ink-mute); cursor:pointer; }
  .readiness-quickcheck { margin:28px auto 0; max-width:440px; padding-top:22px; border-top:1px solid var(--warm); text-align:left; }
  .readiness-quickcheck-title { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:var(--ink-mute); margin-bottom:14px; }
  .readiness-quickcheck-title span { text-transform:none; letter-spacing:0; }
  .readiness-quickcheck-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .readiness-quickcheck-row .checkin-chips { flex:1; min-width:0; }
  .readiness-quickcheck-label { font-size:12px; font-weight:500; color:var(--ink-soft); width:52px; flex-shrink:0; }
  .energy-options { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:16px; margin-bottom:32px; }
  .energy-option { border:2px solid var(--warm); border-radius:var(--radius); padding:24px 16px; cursor:pointer; transition:var(--transition); text-align:center; background:var(--cream); position:relative; overflow:hidden; }
  .energy-option::before { content:''; position:absolute; inset:0; opacity:0; transition:var(--transition); border-radius:calc(var(--radius) - 2px); }
  .energy-option.high::before { background:rgba(90,122,90,0.08); }
  .energy-option.med::before  { background:rgba(196,168,130,0.12); }
  .energy-option.low::before  { background:rgba(196,114,106,0.08); }
  .energy-option:hover { border-color:var(--teal-light); transform:translateY(-2px); }
  .energy-option:hover::before { opacity:1; }
  .energy-option.selected.high      { border-color:var(--teal-dark); background:rgba(90,122,90,0.06); }
  .energy-option.selected.med       { border-color:var(--slate-dark); background:rgba(196,168,130,0.1); }
  .energy-option.selected.low       { border-color:var(--error); background:rgba(196,114,106,0.06); }
  .energy-option.hibernate::before  { background:rgba(106,138,170,0.08); }
  .energy-option.selected.hibernate { border-color:var(--focus-blue); background:rgba(106,138,170,0.06); }
  .energy-option.selected::before { opacity:1; }
  .energy-icon { font-size:32px; margin-bottom:10px; display:block; }
  .energy-label { font-weight:500; font-size:15px; color:var(--ink); margin-bottom:4px; }
  .energy-desc  { font-size:13px; color:var(--ink-mute); line-height:1.5; }
  .energy-task-hint { font-family:'DM Mono',monospace; font-size:11px; color:var(--teal-dark); margin-top:8px; opacity:0.85; }
  .energy-count { display:inline-flex; align-items:center; gap:8px; background:var(--warm); border-radius:40px; padding:10px 20px; font-size:13px; color:var(--ink-soft); margin-bottom:28px; font-family:'DM Mono',monospace; }
  .energy-count strong { color:var(--teal-dark); font-family:'Playfair Display',serif; font-size:18px; }

  /* DASHBOARD */
  .dashboard-header { margin:20px 0 18px; animation:fadeUp 0.5s ease both; }
  .greeting { font-family:'Playfair Display',serif; font-size:32px; font-weight:400; color:var(--ink); margin-bottom:6px; letter-spacing:-0.02em; line-height:1.2; }
  .greeting span { font-style:italic; color:var(--teal-dark); }
  .greeting-sub { font-size:14px; color:var(--ink-soft); display:flex; align-items:center; gap:12px; flex-wrap:wrap; letter-spacing:0.01em; }
  .energy-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:40px; font-size:12px; font-weight:500; }
  .energy-badge.high      { background:rgba(90,122,90,0.12); color:var(--teal-dark); }
  .energy-badge.med       { background:rgba(196,168,130,0.2); color:var(--slate-dark); }
  .energy-badge.low       { background:rgba(196,114,106,0.12); color:var(--error); }
  .energy-badge.hibernate { background:rgba(106,138,170,0.15); color:var(--focus-blue); }
  .grid-2 { display:grid; grid-template-columns:1fr 340px; gap:20px; align-items:start; }
  .section-label { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; color:var(--ink-mute); margin-bottom:14px; display:flex; align-items:center; gap:10px; }
  .section-label::after { content:''; flex:1; height:1px; background:var(--warm); }
  .task-columns { display:flex; flex-direction:column; gap:16px; animation:fadeUp 0.5s 0.1s ease both; }
  /* BUCKET CAROUSEL (beta) */
  /* ── BucketCarousel redesign ── */
  .bucket-tabs-row { display:flex; align-items:center; margin-bottom:18px; }
  .bucket-tabs-line { flex:1; height:1px; background:var(--teal-light); }
  .bucket-tab-labels { display:flex; gap:18px; padding:0 10px; }
  .bucket-tab-lbl { font-size:14px; font-family:'DM Sans',sans-serif; font-weight:500; color:var(--ink-mute); cursor:pointer; padding-bottom:3px; border:none; border-bottom:1.5px solid transparent; background:none; transition:color 0.15s, border-color 0.15s; }
  .bucket-tab-lbl.active { color:var(--ink); border-bottom-color:var(--ink); }
  .bucket-view-toggle { display:flex; align-items:center; gap:3px; background:none; border:none; cursor:pointer; padding:4px 6px; border-radius:8px; color:var(--ink-mute); transition:background 0.15s, color 0.15s; margin-left:8px; flex-shrink:0; }
  .bucket-view-toggle:hover { background:var(--teal-light); color:var(--ink); }
  .bucket-view-toggle.active { color:var(--teal-dark); background:var(--teal-light); }
  .bucket-all-view { display:flex; flex-direction:column; gap:20px; }
  .bucket-all-section { border-radius:16px; padding:4px 0; transition:background 0.15s; }
  .bucket-all-section.drag-over { background:rgba(90,122,90,0.08); }
  .bucket-all-header { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; color:var(--ink-soft); margin-bottom:10px; }
  .bucket-task-draggable { display:flex; align-items:center; gap:4px; cursor:default; }
  .bucket-task-draggable.is-dragging { opacity:0.35; }
  .drag-handle { display:flex; align-items:center; padding:4px 2px; cursor:grab; color:var(--ink-mute); flex-shrink:0; touch-action:none; }
  .drag-handle:active { cursor:grabbing; }
  .drag-handle svg { display:block; }
  .bucket-main-card { min-height:120px; }
  .bucket-main-title { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:var(--ink); margin-bottom:14px; text-align:center; }
  .new-task-row { display:flex; align-items:center; gap:12px; background:var(--card); border-radius:14px; padding:12px 14px; margin-bottom:10px; border:1.5px solid rgba(0,0,0,0.08); box-shadow:0 2px 10px rgba(0,0,0,0.07); cursor:pointer; position:relative; overflow:hidden; }
  [data-theme="dark"] .new-task-row { border-color:rgba(255,255,255,0.09); }
  .new-task-row.urgency-urgent { border-left:3px solid #d94f4f; }
  .new-task-row.urgency-high   { border-left:3px solid #c8903a; }
  .new-task-row.holding .task-hold-fill { animation:taskHoldFill 600ms linear forwards; }
  .new-task-check { width:30px; height:30px; border-radius:50%; border:2px solid rgba(0,0,0,0.2); background:none; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:var(--transition); }
  .new-task-check.done { border-color:var(--teal-dark); background:var(--teal-dark); }
  .new-task-check::before { content:""; position:absolute; inset:-10px; } /* roomy touch target without a bigger circle */
  .new-task-info { flex:1; min-width:0; position:relative; z-index:1; }
  .new-task-title-text { font-family:'DM Sans',sans-serif; font-size:15px; font-weight:500; color:var(--ink); line-height:1.25; }
  .new-task-sub-text { font-size:11px; color:var(--teal-dark); margin-top:2px; font-family:'DM Sans',sans-serif; }
  .new-task-badges { display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex-shrink:0; position:relative; z-index:1; }
  .new-energy-badge { font-size:11px; font-family:'DM Mono',monospace; font-weight:600; background:rgba(196,114,106,0.12); color:#c04a3e; border-radius:20px; padding:2px 8px; white-space:nowrap; }
  .new-energy-badge.recharge { background:rgba(90,122,90,0.12); color:var(--teal-dark); }
  .new-due-pill { font-size:10px; font-family:'DM Mono',monospace; background:var(--teal-dark); color:white; border-radius:20px; padding:2px 8px; white-space:nowrap; }
  .bucket-empty-label { font-size:14px; color:var(--ink-mute); padding:4px 0 8px; }
  .bucket-dots-row { display:flex; justify-content:center; gap:8px; padding:16px 0 4px; }
  .bucket-dot-pill { height:8px; border-radius:4px; background:var(--teal-dark); transition:all 0.25s; cursor:pointer; border:none; padding:0; }
  .bucket-dot-pill.active { width:24px; opacity:1; }
  .bucket-dot-pill:not(.active) { width:8px; opacity:0.25; }
  .wins-card { user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; background:var(--card); border-radius:20px; padding:20px; margin-top:16px; }
  .wins-card-title { font-family:'DM Sans',sans-serif; font-size:16px; font-weight:600; color:var(--ink); margin-bottom:0; padding-bottom:12px; border-bottom:1px solid var(--warm); }
  .wins-item { display:flex; align-items:center; gap:10px; padding:11px 0; border-bottom:1px solid var(--warm); }
  .wins-item:last-child { border-bottom:none; }
  .wins-bullet { width:5px; height:5px; border-radius:50%; background:var(--teal-dark); flex-shrink:0; }
  .wins-name { flex:1; font-size:14px; color:var(--ink); line-height:1.3; }
  .wins-energy { font-size:11px; font-family:'DM Mono',monospace; background:rgba(196,114,106,0.12); color:#c04a3e; border-radius:20px; padding:2px 8px; flex-shrink:0; }
  [data-theme="dark"] .new-energy-badge { color:var(--error); background:rgba(224,112,112,0.15); }
  [data-theme="dark"] .new-energy-badge.recharge { color:var(--teal-dark); background:rgba(90,122,90,0.15); }
  [data-theme="dark"] .wins-energy { color:var(--error); background:rgba(224,112,112,0.15); }
  .column-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .column-title { font-size:13px; font-weight:500; color:var(--ink-soft); display:flex; align-items:center; gap:8px; }
  .column-title.must-title   { color:var(--error); }
  .column-title.should-title { color:var(--slate-dark); }
  .column-title.could-title  { color:var(--teal-dark); }
  .column-pill { font-size:10px; padding:2px 8px; border-radius:20px; font-family:'DM Mono',monospace; }
  .must-pill   { background:rgba(196,114,106,0.12); color:var(--error); }
  .should-pill { background:rgba(196,168,130,0.2); color:var(--slate-dark); }
  .could-pill  { background:rgba(138,158,138,0.15); color:var(--teal-dark); }
  .task-item { background:var(--card); border-radius:var(--radius-sm); padding:10px 12px 10px 16px; display:flex; align-items:flex-start; gap:12px; margin-bottom:8px; transition:var(--transition); border:1.5px solid rgba(0,0,0,0.08); cursor:pointer; position:relative; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04); }
  [data-theme="dark"] .task-item { border-color:rgba(255,255,255,0.09); }
  .task-hold-fill { position:absolute; inset:0; background:linear-gradient(90deg, rgba(90,122,90,0.18) 0%, rgba(90,122,90,0.08) 100%); transform:scaleX(0); transform-origin:left; border-radius:inherit; pointer-events:none; z-index:0; }
  .task-item.holding .task-hold-fill { animation:taskHoldFill 600ms linear forwards; }
  @keyframes taskHoldFill { to { transform:scaleX(1); } }
  .task-item:hover { border-color:var(--teal-light); box-shadow:0 6px 20px rgba(0,0,0,0.09); }
  .task-item:hover .task-actions { opacity:1; }
  @media(hover:none) { .task-actions { opacity:1; } }
  .task-item.done { opacity:0.55; }
  .task-item.done .task-name { text-decoration:line-through; color:var(--ink-mute); }
  .task-check { width:20px; height:20px; border-radius:50%; border:2px solid var(--teal-light); flex-shrink:0; margin-top:1px; display:flex; align-items:center; justify-content:center; transition:var(--transition); cursor:pointer; }
  .task-item.done .task-check { background:var(--teal-dark); border-color:var(--teal-dark); }
  .task-check svg { opacity:0; transition:var(--transition); }
  .task-item.done .task-check svg { opacity:1; }
  .task-body { flex:1; min-width:0; }
  .task-name { font-size:15px; color:var(--ink); margin-bottom:4px; line-height:1.5; font-weight:500; }
  .task-bucket-btn { font-size:9px; font-family:'DM Mono',monospace; font-weight:600; letter-spacing:0.8px; text-transform:uppercase; border:none; border-radius:10px; padding:2px 7px; cursor:pointer; transition:var(--transition); margin-right:4px; }
  .task-bucket-btn:hover { filter:brightness(0.9); transform:scale(1.05); }
  .subtask-toggle-btn { display:inline-flex; align-items:center; gap:4px; background:none; border:none; padding:2px 7px; border-radius:10px; font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); cursor:pointer; transition:var(--transition); margin-top:2px; }
  .subtask-toggle-btn:hover { background:rgba(90,122,90,0.09); color:var(--teal-dark); }
  .subtask-section { margin-top:8px; border-left:2px solid var(--teal-light); padding-left:12px; }
  .subtask-item { display:flex; align-items:center; gap:8px; padding:4px 0; group:subtask; }
  .subtask-check { width:15px; height:15px; border-radius:3px; border:1.5px solid var(--teal-light); flex-shrink:0; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:var(--transition); }
  .subtask-check.done { background:var(--teal-dark); border-color:var(--teal-dark); }
  .subtask-name { font-size:14px; color:var(--ink-soft); flex:1; line-height:1.5; cursor:pointer; }
  .subtask-name.done { text-decoration:line-through; color:var(--ink-mute); }
  .subtask-del { background:none; border:none; cursor:pointer; color:transparent; padding:2px 3px; transition:var(--transition); line-height:1; flex-shrink:0; font-size:14px; }
  .subtask-item:hover .subtask-del { color:var(--ink-mute); }
  .subtask-del:hover { color:var(--error) !important; }
  .subtask-add-row { display:flex; gap:6px; align-items:center; margin-top:6px; }
  .subtask-add-input { flex:1; background:var(--warm); border:1px solid transparent; border-radius:8px; padding:5px 10px; font-size:13px; font-family:'DM Sans',sans-serif; color:var(--ink); outline:none; transition:var(--transition); }
  .subtask-add-input:focus { border-color:rgba(90,122,90,0.4); background:var(--surface); }
  .subtask-add-input::placeholder { color:var(--ink-mute); }
  .subtask-add-confirm { background:var(--teal-dark); border:none; color:white; border-radius:6px; padding:4px 10px; font-size:11px; font-family:'DM Sans',sans-serif; cursor:pointer; flex-shrink:0; transition:var(--transition); }
  .subtask-add-confirm:hover { background:#4a6a4a; }

  /* PRIVACY MODE */
  .privacy-blur .task-name,
  .privacy-blur .new-task-title-text,
  .privacy-blur .node-task-name,
  .privacy-blur .sched-task-name,
  .privacy-blur .subtask-name { filter:blur(7px); transition:filter 0.2s ease; user-select:none; }
  .privacy-blur .task-item:hover .task-name,
  .privacy-blur .task-item:focus-within .task-name { filter:none; }
  .privacy-blur .new-task-row:hover .new-task-title-text,
  .privacy-blur .new-task-row:focus-within .new-task-title-text { filter:none; }
  .privacy-blur .node-item:hover .node-task-name { filter:none; }
  .privacy-blur .sched-item:hover .sched-task-name { filter:none; }
  .privacy-blur .suggest-name { filter:blur(7px); transition:filter 0.2s ease; user-select:none; }
  .privacy-blur .suggest-item:hover .suggest-name { filter:none; }
  .privacy-blur .mood-label { filter:blur(6px); transition:filter 0.2s ease; }
  .privacy-blur .mood-option:hover .mood-label,
  .privacy-blur .mood-option:focus .mood-label { filter:none; }
  .privacy-blur .sd-ml-sentence { filter:blur(6px); transition:filter 0.2s ease; }
  .privacy-blur .shutdown-prompt:hover .sd-ml-sentence { filter:none; }

  /* SAFETY HUB */
  .safety-intro { font-size:14px; color:var(--ink-soft); line-height:1.7; margin-bottom:20px; }
  .safety-card { background:var(--card); border-radius:var(--radius); padding:18px 20px; box-shadow:0 1px 8px rgba(0,0,0,0.05); margin-bottom:12px; display:flex; align-items:center; gap:16px; text-decoration:none; transition:var(--transition); border:1.5px solid transparent; }
  .safety-card:hover { border-color:var(--teal-light); box-shadow:0 4px 16px rgba(0,0,0,0.08); transform:translateY(-1px); }
  .safety-icon { font-size:24px; flex-shrink:0; }
  .safety-name { font-size:14px; font-weight:500; color:var(--ink); margin-bottom:2px; }
  .safety-detail { font-size:13px; color:var(--ink-mute); font-family:'DM Mono',monospace; }
  .safety-action { margin-left:auto; font-size:12px; color:var(--teal-dark); font-weight:500; flex-shrink:0; padding:6px 14px; background:rgba(90,122,90,0.08); border-radius:20px; }
  .safety-offline-note { font-size:11px; color:var(--ink-mute); text-align:center; margin-top:16px; font-family:'DM Mono',monospace; letter-spacing:0.3px; }

  /* CONFIRM MODAL */
  .modal-overlay { position:fixed; inset:0; background:rgba(42,42,37,0.55); z-index:1000; display:flex; align-items:center; justify-content:center; padding:24px; backdrop-filter:blur(4px); animation:fadeIn 0.15s ease; }
  .modal-box { background:var(--surface); border-radius:24px; padding:36px 32px; max-width:420px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,0.18); animation:fadeUp 0.2s ease; }
  .modal-title { font-family:'Playfair Display',serif; font-size:20px; color:var(--ink); margin-bottom:8px; }
  .modal-body { font-size:14px; color:var(--ink-soft); line-height:1.7; margin-bottom:24px; }
  .modal-actions { display:flex; gap:10px; justify-content:flex-end; }
  .modal-cancel { background:var(--warm); border:none; border-radius:40px; padding:11px 22px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-soft); cursor:pointer; transition:var(--transition); }
  .modal-confirm-danger { background:var(--error); border:none; border-radius:40px; padding:11px 22px; font-family:'DM Sans',sans-serif; font-size:13px; color:white; font-weight:500; cursor:pointer; transition:var(--transition); }
  .modal-confirm-danger:hover { background:#b05a52; }

  /* ANALYTICS */
  .analytics-wrap { padding:4px 0 24px; }
  .analytics-chart-wrap { background:var(--card); border-radius:var(--radius); padding:20px 8px 8px; box-shadow:0 1px 8px rgba(0,0,0,0.05); margin-bottom:20px; }
  .analytics-legend { display:flex; gap:16px; margin-bottom:16px; padding:0 12px; flex-wrap:wrap; }
  .analytics-legend-item { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-soft); font-family:'DM Mono',monospace; }
  .analytics-legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .analytics-empty { text-align:center; padding:40px 20px; font-size:14px; color:var(--ink-mute); font-style:italic; }
  .analytics-insight { background:rgba(90,122,90,0.06); border:1px solid rgba(90,122,90,0.15); border-radius:var(--radius-sm); padding:14px 16px; font-size:13px; color:var(--ink-soft); line-height:1.6; margin-bottom:12px; }
  .wr-card { border-radius:var(--radius); padding:24px; margin-bottom:16px; display:flex; flex-direction:column; gap:14px; }
  .wr-card--recharge { background:rgba(106,138,170,0.07); border:1px solid rgba(106,138,170,0.2); }
  .wr-card--flow     { background:rgba(90,122,90,0.07);  border:1px solid rgba(90,122,90,0.2); }
  .wr-card--mixed    { background:rgba(196,168,130,0.08); border:1px solid rgba(196,168,130,0.25); }
  .wr-heading { font-family:'Playfair Display',serif; font-size:17px; font-weight:400; color:var(--ink); margin-bottom:2px; }

  /* ── Week Plan Modal ────────────────────────────────────────────────────── */
  .wplan-overlay { position:fixed; inset:0; z-index:900; background:rgba(248,246,242,0.92); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.3s ease both; }
  [data-theme="dark"] .wplan-overlay { background:rgba(18,21,20,0.94); }
  .wplan-card { background:var(--surface); border-radius:var(--radius); padding:32px 28px; max-width:480px; width:100%; box-shadow:0 8px 40px rgba(0,0,0,0.10); position:relative; }
  .wplan-eyebrow { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--teal-dark); margin-bottom:8px; }
  .wplan-title { font-family:'Playfair Display',serif; font-size:24px; color:var(--ink); line-height:1.25; margin-bottom:8px; }
  .wplan-sub { font-size:13px; color:var(--ink-mute); line-height:1.6; margin-bottom:24px; }
  .wplan-label { font-size:13px; font-weight:500; color:var(--ink); margin-bottom:10px; }
  .wplan-textarea { width:100%; box-sizing:border-box; border:1.5px solid rgba(90,122,90,0.25); border-radius:var(--radius-sm); padding:12px 14px; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); background:var(--cream); resize:none; outline:none; line-height:1.6; transition:border-color 0.2s; }
  .wplan-textarea:focus { border-color:var(--teal-dark); }
  .wplan-energy-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px; }
  .wplan-energy-option { border:1.5px solid rgba(0,0,0,0.1); border-radius:var(--radius-sm); padding:14px 12px; cursor:pointer; transition:all 0.15s; text-align:center; background:var(--card); }
  .wplan-energy-option:hover { border-color:var(--teal-light); background:rgba(90,122,90,0.04); }
  .wplan-energy-option.selected { border-color:var(--teal-dark); background:rgba(90,122,90,0.08); }
  .wplan-energy-icon { font-size:22px; margin-bottom:6px; }
  .wplan-energy-label { font-size:13px; font-weight:500; color:var(--ink); }
  .wplan-energy-hint { font-size:11px; color:var(--ink-mute); margin-top:2px; line-height:1.4; }
  .wplan-priorities { display:flex; flex-direction:column; gap:10px; margin-bottom:8px; }
  .wplan-priority-row { display:flex; align-items:center; gap:10px; }
  .wplan-priority-num { width:24px; height:24px; border-radius:50%; background:var(--teal-dark); color:white; font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .wplan-priority-input { flex:1; border:1.5px solid rgba(90,122,90,0.25); border-radius:var(--radius-sm); padding:10px 12px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink); background:var(--cream); outline:none; transition:border-color 0.2s; }
  .wplan-priority-input:focus { border-color:var(--teal-dark); }
  .wplan-actions { display:flex; justify-content:space-between; align-items:center; margin-top:24px; gap:12px; }
  .wplan-skip { background:none; border:none; font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); cursor:pointer; padding:4px; text-decoration:underline; text-underline-offset:3px; }
  .wplan-dots { display:flex; gap:6px; justify-content:center; margin-bottom:24px; }
  .wplan-dot { width:6px; height:6px; border-radius:50%; background:rgba(90,122,90,0.2); transition:background 0.2s; }
  .wplan-dot.active { background:var(--teal-dark); }
  .wplan-summary-row { display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.06); }
  .wplan-summary-row:last-child { border-bottom:none; }
  .wplan-summary-icon { font-size:16px; flex-shrink:0; margin-top:1px; }
  .wplan-summary-text { font-size:13px; color:var(--ink); line-height:1.5; }
  .wplan-summary-muted { font-size:12px; color:var(--ink-mute); }
  /* week start day picker in settings */
  .week-day-picker { display:flex; gap:6px; flex-wrap:wrap; margin-top:12px; }
  .week-day-btn { border:1.5px solid rgba(0,0,0,0.12); border-radius:40px; padding:6px 14px; font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; background:var(--card); color:var(--ink-soft); transition:all 0.15s; }
  .week-day-btn.selected { background:var(--teal-dark); border-color:var(--teal-dark); color:white; font-weight:500; }
  .week-day-btn:hover:not(.selected) { border-color:var(--teal-light); }
  .wr-row { display:flex; align-items:flex-start; gap:12px; }
  .wr-icon { font-size:14px; flex-shrink:0; margin-top:1px; opacity:0.8; }
  .wr-text { font-size:13px; color:var(--ink-soft); line-height:1.65; }
  .task-name-input { font-size:14px; color:var(--ink); line-height:1.4; font-weight:400; border:none; outline:none; width:100%; background:transparent; font-family:'DM Sans',sans-serif; padding:0; margin-bottom:4px; border-bottom:1.5px solid var(--teal-light); }
  .task-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .task-actions { opacity:0; display:flex; gap:4px; align-items:center; flex-shrink:0; transition:opacity 0.15s; margin-top:1px; }
  .task-btn { background:none; border:none; cursor:pointer; padding:3px 5px; border-radius:4px; font-size:12px; line-height:1; transition:var(--transition); color:var(--ink-mute); }
  .task-btn:hover { background:var(--warm); color:var(--ink); }
  .task-btn.delete:hover { background:#fde8e8; color:#c0392b; }
  .task-tag  { font-size:11px; padding:2px 8px; border-radius:20px; font-family:'DM Mono',monospace; opacity:0.62; }
  .tag-deep  { background:rgba(90,122,90,0.1); color:var(--teal-dark); }
  .tag-light { background:rgba(196,168,130,0.15); color:var(--slate-dark); }
  .tag-admin { background:rgba(138,158,138,0.1); color:var(--ink-soft); }
  .task-scheduled-badge { font-size:10px; font-family:'DM Mono',monospace; color:var(--focus-blue); background:var(--focus-blue-light); padding:2px 7px; border-radius:20px; }
  .tag-due     { background:rgba(90,122,90,0.08); color:var(--teal-dark); }
  .tag-overdue { background:rgba(196,114,106,0.1); color:var(--error); }
  .reschedule-prompt { margin-top:6px; font-size:12px; color:var(--ink-soft); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .reschedule-prompt input[type=date] { border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:4px 8px; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--ink); background:var(--surface); outline:none; }
  .reschedule-prompt input[type=date]:focus { border-color:var(--teal-light); }
  .reschedule-btn { font-size:11px; padding:3px 10px; border-radius:20px; border:1.5px solid var(--teal-light); background:var(--card); color:var(--teal-dark); cursor:pointer; font-family:'DM Sans',sans-serif; }
  .reschedule-btn.cancel { border-color:var(--warm); color:var(--ink-mute); }
  .add-task-date { border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:6px 10px; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--ink-soft); background:var(--surface); outline:none; transition:var(--transition); }
  .add-task-date:focus { border-color:var(--teal-light); }
  .gauge-debt-section { margin-top:8px; padding-top:8px; border-top:1px solid var(--warm); display:flex; align-items:center; gap:8px; }
  .gauge-pip.done { background:var(--teal-light); opacity:0.7; }
  .gauge-debt-badge { font-size:10px; font-family:'DM Mono',monospace; color:var(--error); background:rgba(196,114,106,0.08); border:1px solid rgba(196,114,106,0.2); border-radius:20px; padding:1px 7px; white-space:nowrap; }
  .add-task-row { display:flex; gap:8px; margin-top:4px; }
  .add-task-input { flex:1; border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:10px 14px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink); background:var(--surface); outline:none; transition:var(--transition); }
  .add-task-input:focus { border-color:var(--teal-light); box-shadow:0 0 0 3px var(--glow); }
  .add-task-input::placeholder { color:var(--ink-mute); }
  .add-task-select { border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:10px 24px 10px 10px; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--ink-soft); background:var(--surface); outline:none; cursor:pointer; transition:var(--transition); appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a9a8a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 8px center; }
  .add-task-select:focus { border-color:var(--teal-light); }
  .btn-add { background:var(--teal-dark); color:white; border:none; border-radius:var(--radius-sm); padding:10px 16px; font-size:18px; cursor:pointer; transition:var(--transition); line-height:1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(90,122,90,0.25); }
  .btn-add:hover { background:var(--teal); box-shadow:0 4px 12px rgba(90,122,90,0.35); }
  .btn-task-options { background:none; border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:10px 12px; font-size:13px; cursor:pointer; color:var(--ink-mute); transition:var(--transition); line-height:1; }
  .btn-task-options:hover { border-color:var(--teal-light); color:var(--ink); }
  .btn-task-options.open { border-color:var(--teal-light); color:var(--teal-dark); background:rgba(90,122,90,0.06); }
  .tasks-all-empty { text-align:center; padding:28px 0 12px; color:var(--ink-mute); font-size:13px; font-style:italic; min-height:180px; display:flex; align-items:center; justify-content:center; }

  /* ADD TASK BUTTON */
  .add-task-trigger { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; border:1.5px dashed var(--teal-light); border-radius:var(--radius); padding:14px 18px; background:rgba(138,158,138,0.04); color:var(--teal-dark); font-family:'DM Sans',sans-serif; font-size:14px; cursor:pointer; transition:var(--transition); margin-top:8px; }
  .add-task-trigger:hover { background:rgba(138,158,138,0.1); border-color:var(--teal-dark); }
  .add-task-trigger-icon { width:28px; height:28px; border-radius:50%; background:var(--teal-dark); color:white; display:flex; align-items:center; justify-content:center; font-size:18px; line-height:1; flex-shrink:0; }

  /* ADD TASK MODAL (bottom sheet) */
  .atm-overlay { position:fixed; inset:var(--vv-top,0px) 0 auto 0; height:var(--vv-height,100%); overflow-y:auto; overscroll-behavior:contain; background:rgba(0,0,0,0.35); z-index:200; display:flex; align-items:flex-end; animation:fadeIn 0.2s ease; }
  .atm-sheet { width:100%; max-width:560px; margin:0 auto; background:var(--cream); border-radius:28px 28px 0 0; padding:0 0 max(28px,env(safe-area-inset-bottom)) 0; max-height:min(92%, calc(100% - env(safe-area-inset-top) - 24px)); overflow-y:auto; animation:slideUp 0.3s cubic-bezier(0.4,0,0.2,1); }
  @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
  .atm-handle { width:40px; height:4px; border-radius:2px; background:var(--teal-light); margin:12px auto 0; }
  .atm-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px 8px; }
  .atm-title { font-family:'DM Sans',sans-serif; font-size:17px; font-weight:500; color:var(--ink); }
  .atm-hbtn { width:36px; height:36px; border-radius:50%; border:none; background:var(--warm); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--ink-mute); transition:var(--transition); }
  .atm-hbtn:hover { background:var(--teal-light); color:var(--teal-dark); }
  .atm-body { padding:8px 20px 0; display:flex; flex-direction:column; gap:16px; }
  .atm-field-label { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; color:var(--ink); margin-bottom:6px; }
  .atm-input { width:100%; border:none; border-radius:14px; padding:14px 16px; font-family:'DM Sans',sans-serif; font-size:15px; color:var(--ink); background:var(--surface); outline:none; transition:var(--transition); box-shadow:0 1px 4px rgba(0,0,0,0.06); }
  .atm-input:focus { box-shadow:0 0 0 2px var(--teal-light); }
  .atm-input::placeholder { color:var(--ink-mute); }
  .atm-textarea { resize:none; min-height:90px; }
  .atm-datetime-row { display:flex; gap:10px; }
  .atm-datetime-field { flex:1; background:var(--surface); border-radius:14px; padding:12px 14px; display:flex; align-items:center; gap:8px; box-shadow:0 1px 4px rgba(0,0,0,0.06); }
  .atm-datetime-field input { border:none; background:transparent; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink); outline:none; width:100%; }
  .atm-datetime-field input::placeholder { color:var(--ink-mute); }
  .atm-priority-row { display:flex; gap:10px; }
  .atm-priority-btn { flex:1; border:1.5px solid transparent; border-radius:24px; padding:10px 8px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:var(--transition); background:var(--surface); }
  .atm-priority-btn.low   { color:#4a8a4a; border-color:rgba(74,138,74,0.3); }
  .atm-priority-btn.low.active   { background:rgba(74,138,74,0.12); border-color:#4a8a4a; }
  .atm-priority-btn.medium { color:#b87028; border-color:rgba(184,112,40,0.3); }
  .atm-priority-btn.medium.active { background:rgba(184,112,40,0.12); border-color:#b87028; }
  .atm-priority-btn.high  { color:#b84040; border-color:rgba(184,64,64,0.3); }
  .atm-priority-btn.high.active  { background:rgba(184,64,64,0.12); border-color:#b84040; }
  [data-theme="dark"] .atm-priority-btn.low    { color:#6aba6a; border-color:rgba(106,186,106,0.35); }
  [data-theme="dark"] .atm-priority-btn.low.active    { background:rgba(106,186,106,0.15); border-color:#6aba6a; }
  [data-theme="dark"] .atm-priority-btn.medium { color:#d4923e; border-color:rgba(212,146,62,0.35); }
  [data-theme="dark"] .atm-priority-btn.medium.active { background:rgba(212,146,62,0.15); border-color:#d4923e; }
  [data-theme="dark"] .atm-priority-btn.high   { color:var(--error); border-color:rgba(224,112,112,0.35); }
  [data-theme="dark"] .atm-priority-btn.high.active   { background:rgba(224,112,112,0.15); border-color:var(--error); }
  .atm-project-row { background:var(--surface); border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:10px; box-shadow:0 1px 4px rgba(0,0,0,0.06); cursor:pointer; }
  .atm-project-select { border:none; background:transparent; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); outline:none; flex:1; cursor:pointer; appearance:none; }
  .atm-tags-wrap { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .atm-tag { display:flex; align-items:center; gap:5px; background:var(--surface); border:1.5px solid var(--teal-light); border-radius:20px; padding:5px 12px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--teal-dark); }
  .atm-tag-remove { background:none; border:none; color:var(--ink-mute); cursor:pointer; padding:0; font-size:14px; line-height:1; display:flex; align-items:center; }
  .atm-tag-add { background:var(--surface); border:1.5px dashed var(--teal-light); border-radius:20px; padding:5px 12px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-mute); cursor:pointer; display:flex; align-items:center; gap:4px; transition:var(--transition); }
  .atm-tag-add:hover { border-color:var(--teal-dark); color:var(--teal-dark); }
  .atm-tag-input { border:none; border-bottom:1.5px solid var(--teal-light); background:transparent; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink); outline:none; width:80px; padding:2px 4px; }
  .atm-energy-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .atm-create-btn { width:100%; border:none; border-radius:16px; padding:16px; font-family:'DM Sans',sans-serif; font-size:16px; font-weight:500; color:white; background:linear-gradient(135deg,var(--teal-dark),#4a6a8a); cursor:pointer; transition:var(--transition); box-shadow:0 4px 16px rgba(90,122,90,0.3); margin:8px 0 4px; }
  .atm-create-btn:hover { box-shadow:0 6px 20px rgba(90,122,90,0.4); transform:translateY(-1px); }
  .atm-create-btn:disabled { opacity:0.5; cursor:default; transform:none; }

  /* SIDE PANEL */
  .side-panel { display:flex; flex-direction:column; gap:16px; animation:fadeUp 0.5s 0.2s ease both; }
  .panel-card { background:var(--card); border-radius:var(--radius); padding:22px; box-shadow:0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04); margin-bottom:12px; }
  .panel-title { font-size:11px; font-weight:600; color:var(--ink-soft); margin-bottom:16px; display:flex; align-items:center; gap:6px; letter-spacing:0.8px; text-transform:uppercase; }
  .panel-action-row { display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .setting-info-wrap { position:relative; display:inline-flex; align-items:center; }
  .setting-info-icon { width:15px; height:15px; border-radius:50%; border:1.5px solid var(--ink-mute); color:var(--ink-mute); font-size:9px; font-family:'DM Mono',monospace; display:inline-flex; align-items:center; justify-content:center; cursor:default; flex-shrink:0; margin-left:4px; opacity:0.6; transition:opacity 0.15s; }
  .setting-info-wrap:hover .setting-info-icon { opacity:1; }
  .setting-info-tip { position:absolute; left:calc(100% + 10px); top:50%; transform:translateY(-50%); width:220px; background:var(--ink); color:rgba(255,255,255,0.9); font-size:11px; font-family:'DM Sans',sans-serif; line-height:1.55; padding:9px 12px; border-radius:10px; z-index:200; pointer-events:none; opacity:0; transition:opacity 0.15s; white-space:normal; box-shadow:0 4px 16px rgba(0,0,0,0.2); }
  .setting-info-tip::before { content:''; position:absolute; right:100%; top:50%; transform:translateY(-50%); border:5px solid transparent; border-right-color:var(--ink); }
  .setting-info-wrap:hover .setting-info-tip { opacity:1; }
  @media(max-width:600px) {
    .panel-action-row { flex-direction:column; align-items:flex-start; }
    .panel-action-row > button { align-self:flex-end; }
    .setting-info-tip { left:auto; right:0; top:calc(100% + 8px); transform:none; }
    .setting-info-tip::before { display:none; }
  }
  .mindfulness-prompt-card { }
  .mindfulness-prompt-body { display:flex; align-items:flex-start; gap:10px; margin-bottom:14px; }
  .mindfulness-prompt-icon { font-size:22px; line-height:1; flex-shrink:0; margin-top:1px; }
  .mindfulness-prompt-text { font-size:14px; color:var(--ink); line-height:1.55; }
  .mindfulness-prompt-actions { display:flex; gap:8px; flex-wrap:wrap; }
  .mindfulness-btn-add { background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:6px 14px; font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); }
  .mindfulness-btn-add:hover:not(:disabled) { background:var(--teal); }
  .mindfulness-btn-add:disabled { opacity:0.65; cursor:default; }
  .mindfulness-btn-shuffle { background:transparent; color:var(--ink-mute); border:1px solid var(--warm); border-radius:40px; padding:6px 14px; font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); }
  .mindfulness-btn-shuffle:hover { border-color:var(--teal); color:var(--teal-dark); }

  /* ENERGY GAUGE */
  .battery-panel { background:var(--card); border-radius:var(--radius); padding:22px 24px; box-shadow:0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04); }
  .battery-panel-label { font-size:11px; font-weight:500; color:var(--ink-mute); text-transform:uppercase; letter-spacing:0.6px; }
  .battery-panel-pct { font-family:'Playfair Display',serif; font-size:42px; font-weight:400; line-height:1; }
  .battery-panel-status { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); margin-top:8px; }
  .battery-shape-outer { display:flex; align-items:center; margin:14px 0 4px; cursor:pointer; touch-action:none; user-select:none; }
  .battery-body { flex:1; height:48px; border:2.5px solid; border-radius:10px; overflow:hidden; position:relative; background:rgba(0,0,0,0.03); transition:border-color 0.6s ease; }
  [data-theme="dark"] .battery-body { background:rgba(255,255,255,0.07); }
  .battery-nub { width:5px; height:20px; border-radius:0 4px 4px 0; flex-shrink:0; transition:background 0.6s ease; }
  .battery-panel-fill { position:absolute; left:0; top:0; bottom:0; border-radius:7px; transition:width 0.8s cubic-bezier(0.4,0,0.2,1), background 0.6s ease; opacity:0.9; }
  .battery-panel-pct-row { display:flex; justify-content:space-between; align-items:center; margin:10px 0 0; }
  .battery-panel-wrap.charging .battery-panel-pct { animation:batteryPulse 1.5s ease-in-out infinite; }
  /* SHUTDOWN MOOD */
  .shutdown-mood-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-top:10px; max-height:200px; overflow-y:auto; }
  .energy-edit-row { display:flex; gap:6px; margin-top:14px; padding-top:14px; border-top:1px solid var(--warm); }
  .energy-edit-btn { flex:1; border:1.5px solid var(--warm); border-radius:40px; padding:6px 0; font-size:11px; font-family:'DM Mono',monospace; color:var(--ink-mute); background:var(--card); cursor:pointer; transition:var(--transition); text-align:center; }
  .energy-edit-btn:hover { border-color:var(--teal-light); color:var(--ink); }
  .energy-edit-btn.active.high { border-color:var(--teal-dark); background:rgba(90,122,90,0.08); color:var(--teal-dark); font-weight:500; }
  .energy-edit-btn.active.med  { border-color:var(--slate-dark); background:rgba(196,168,130,0.12); color:var(--slate-dark); font-weight:500; }
  .energy-edit-btn.active.low  { border-color:var(--error); background:rgba(196,114,106,0.08); color:var(--error); font-weight:500; }
  .gauge-task-load { margin-top:12px; display:flex; align-items:center; gap:8px; }
  .gauge-task-pips { display:flex; gap:4px; }
  .gauge-pip { width:8px; height:8px; border-radius:50%; background:var(--warm); transition:var(--transition); }
  .gauge-pip.filled.high { background:var(--teal-dark); }
  .gauge-pip.filled.med  { background:var(--slate-dark); }
  .gauge-pip.filled.low  { background:var(--error); }
  .gauge-pip.over { background:rgba(196,114,106,0.5); }
  .gauge-task-count { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); }

  /* BURNOUT WARNING */
  .week-strip { display:flex; align-items:center; gap:4px; margin-bottom:14px; }
  .week-nav-btn { background:none; border:none; cursor:pointer; color:var(--ink-mute); padding:6px 2px; display:flex; align-items:center; flex-shrink:0; transition:var(--transition); }
  .week-nav-btn:hover { color:var(--ink); }
  .week-strip-days { display:flex; flex:1; gap:4px; min-width:0; }
  .week-day-pill { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 2px 12px; border-radius:18px; border:none; background:var(--card); box-shadow:0 2px 8px rgba(0,0,0,0.06); cursor:pointer; transition:var(--transition); }
  .week-day-pill:hover:not(.selected) { box-shadow:0 4px 12px rgba(0,0,0,0.1); transform:translateY(-2px); }
  .week-day-pill.selected { background:var(--ink); }
  .week-day-letter { font-family:'DM Sans',sans-serif; font-size:10px; font-weight:500; color:var(--ink-mute); letter-spacing:0.2px; transition:color 0.15s; }
  .week-day-pill.selected .week-day-letter { color:rgba(255,255,255,0.65); }
  .week-day-num-circle { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:var(--warm); transition:background 0.15s; }
  .week-day-pill.today .week-day-num-circle { background:rgba(90,122,90,0.15); }
  .week-day-pill.selected .week-day-num-circle { background:white; }
  .week-day-num { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; color:var(--ink); line-height:1; transition:color 0.15s; }
  .week-day-pill.today .week-day-num { color:var(--teal-dark); }
  .week-day-pill.selected .week-day-num { color:var(--ink); }
  .week-day-dot-row { display:flex; align-items:center; justify-content:center; gap:3px; height:4px; }
  .week-dot { width:3px; height:3px; border-radius:50%; flex-shrink:0; }
  .today-dot { background:var(--teal-dark); }
  .week-day-pill.selected .today-dot { background:rgba(255,255,255,0.6); }
  .task-dot { background:var(--slate); }
  .week-day-pill.selected .task-dot { background:rgba(255,255,255,0.5); }
  [data-theme="dark"] .week-day-pill { border:1px solid rgba(255,255,255,0.08); box-shadow:0 2px 8px rgba(0,0,0,0.3); }
  [data-theme="dark"] .week-day-pill:hover:not(.selected) { border-color:rgba(255,255,255,0.15); box-shadow:0 4px 12px rgba(0,0,0,0.4); }
  [data-theme="dark"] .week-day-pill.selected { border-color:transparent; }
  [data-theme="dark"] .week-day-pill.selected .week-day-letter { color:rgba(14,24,24,0.72); }
  [data-theme="dark"] .week-day-pill.selected .week-day-num { color:var(--cream); }
  .burnout-warning { background:rgba(196,114,106,0.08); border:1px solid rgba(196,114,106,0.25); border-radius:var(--radius-sm); padding:11px 14px; font-size:13px; color:var(--error); line-height:1.5; margin-top:8px; display:flex; align-items:flex-start; gap:8px; }
  .burnout-warning::before { content:''; display:none; }

  /* BATTERY NUDGE */
  .battery-nudge { background:var(--card); border:1px solid var(--warm); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:14px; display:flex; align-items:flex-start; gap:10px; animation:fadeUp 0.35s ease both; }
  .battery-nudge-body { flex:1; min-width:0; }
  .battery-nudge-msg { font-size:14px; color:var(--ink); line-height:1.5; }
  .battery-nudge-task { font-size:11px; color:var(--ink-mute); margin-top:3px; font-family:'DM Mono',monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .battery-nudge-actions { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }
  .battery-nudge-btn { font-size:12px; padding:5px 13px; border-radius:20px; cursor:pointer; border:1.5px solid var(--teal); background:var(--card); color:var(--teal-dark); font-family:'DM Sans',sans-serif; transition:var(--transition); }
  .battery-nudge-btn:hover { background:var(--teal-dark); color:white; }
  .battery-nudge-dismiss { font-size:12px; color:var(--ink-mute); background:none; border:none; cursor:pointer; padding:5px 4px; font-family:'DM Sans',sans-serif; }

  /* WINS */
  .win-item { display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid var(--warm); font-size:13px; color:var(--ink-soft); line-height:1.4; }
  .win-item:last-child { border-bottom:none; }
  .win-dot { width:6px; height:6px; border-radius:50%; background:var(--teal-dark); flex-shrink:0; margin-top:5px; }
  .win-time { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); margin-left:auto; flex-shrink:0; }
  .win-undo-btn { opacity:0; background:none; border:none; cursor:pointer; font-size:11px; font-family:'DM Mono',monospace; color:var(--ink-mute); padding:1px 7px; border-radius:8px; transition:var(--transition); flex-shrink:0; margin-left:auto; line-height:1.6; }
  .win-item:hover .win-undo-btn { opacity:1; }
  .win-undo-btn:hover { color:var(--teal-dark); background:rgba(90,122,90,0.1); }

  /* ── CALENDAR ── */
  .cal-page { animation:fadeUp 0.5s ease both; }

  .cal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
  .cal-title { font-family:'Playfair Display',serif; font-size:26px; font-weight:400; color:var(--ink); }
  .cal-title span { font-style:italic; color:var(--teal-dark); }
  .cal-header-right { display:flex; align-items:center; gap:10px; }

  /* week-day (calendar view) — uses pill style matching Circuit */
  .week-shutdown-dot { width:5px; height:5px; border-radius:50%; background:var(--slate); }
  .week-day-pill.selected .week-shutdown-dot { background:rgba(255,255,255,0.7); }

  /* day view */
  .cal-body { display:grid; grid-template-columns:1fr 260px; gap:20px; align-items:start; }

  .day-view { background:var(--card); border-radius:var(--radius); box-shadow:0 1px 8px rgba(0,0,0,0.05); overflow:hidden; }

  .day-view-header { padding:16px 20px 12px; border-bottom:1px solid var(--warm); display:flex; align-items:center; justify-content:space-between; }
  .day-view-title { font-size:13px; font-weight:500; color:var(--ink-soft); }
  .btn-autoschedule { background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:7px 16px; font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); display:flex; align-items:center; gap:6px; }
  .btn-autoschedule:hover { background:var(--teal); }
  .btn-autoschedule:disabled { opacity:0.4; cursor:not-allowed; }
  .btn-export { background:transparent; color:var(--slate-dark); border:1.5px solid var(--slate); border-radius:40px; padding:7px 16px; font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); display:flex; align-items:center; gap:6px; }
  .btn-export:hover { background:rgba(196,168,130,0.12); }
  .btn-export:disabled { opacity:0.4; cursor:not-allowed; }

  .hour-grid { max-height:620px; overflow-y:auto; position:relative; }
  .hour-row { display:flex; align-items:stretch; border-bottom:1px solid rgba(0,0,0,0.06); height:36px; overflow:visible; position:relative; }
  .hour-row.half-hour { border-bottom:1px dashed rgba(0,0,0,0.03); height:36px; opacity:0.75; }
  .cal-event { position:absolute; left:64px; right:8px; border-radius:8px; padding:6px 10px; z-index:4; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; cursor:default; box-shadow:0 1px 6px rgba(0,0,0,0.08); transition:opacity 0.3s ease; }
  .cal-event.event-done { opacity:0.55; }
  .cal-event.event-done .cal-event-name { text-decoration:line-through; color:var(--ink-mute); }
  .cal-event-name { font-size:13px; font-weight:500; color:var(--ink); line-height:1.3; }
  .cal-event-meta { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); margin-top:2px; }
  .cal-event-impact { font-family:'DM Mono',monospace; font-size:9px; padding:1px 6px; border-radius:12px; display:inline-block; margin-top:4px; }
  .cal-event-impact.drain { background:rgba(196,114,106,0.15); color:var(--error); }
  .cal-event-impact.charge { background:rgba(90,122,90,0.12); color:var(--teal-dark); }
  .cal-event-edit { position:absolute; top:5px; right:24px; background:none; border:none; font-size:13px; color:var(--ink-mute); cursor:pointer; opacity:0; transition:var(--transition); line-height:1; padding:0; }
  .cal-event:hover .cal-event-edit { opacity:1; }
  .cal-event.event-editing { outline:2px solid var(--teal-dark); outline-offset:1px; }
  .cal-event-remove { position:absolute; top:5px; right:7px; background:none; border:none; font-size:14px; color:var(--ink-mute); cursor:pointer; opacity:0; transition:var(--transition); line-height:1; padding:0; }
  .cal-event:hover .cal-event-remove { opacity:1; }
  .cal-event-done-btn { position:absolute; bottom:6px; right:8px; width:20px; height:20px; border-radius:50%; border:1.5px solid rgba(0,0,0,0.18); background:var(--card); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; opacity:0; transition:var(--transition); line-height:1; padding:0; color:var(--ink-mute); }
  .cal-event:hover .cal-event-done-btn { opacity:1; }
  .cal-event-done-btn.marked { opacity:1; background:var(--teal-dark); border-color:var(--teal-dark); color:white; }
  .ml-event-form { background:var(--card); border-radius:var(--radius); padding:24px; box-shadow:0 1px 8px rgba(0,0,0,0.05); margin-bottom:16px; }
  .ml-form-section { margin-top:16px; }
  .ml-form-section + .ml-form-section { margin-top:24px; }
  .ml-repeat-row { display:flex; align-items:center; gap:8px; justify-content:space-between; margin-bottom:0; }
  .ml-repeat-left { display:flex; align-items:center; gap:8px; }
  .ml-repeat-label { font-size:11px; font-family:'DM Mono',monospace; color:var(--ink-mute); white-space:nowrap; }
  .ml-block-pill { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); background:rgba(0,0,0,0.06); border-radius:20px; padding:3px 9px; white-space:nowrap; }
  .ml-duration-recur { color:var(--teal-dark); }
  .ml-day-picker { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:8px; margin-top:12px; margin-bottom:0; }
  .ml-day-btn { width:28px; height:28px; border-radius:50%; border:1.5px solid var(--warm); background:var(--card); font-size:11px; font-family:'DM Mono',monospace; font-weight:500; color:var(--ink-mute); cursor:pointer; transition:var(--transition); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; padding:0; }
  .ml-day-btn:hover { border-color:var(--teal-light); color:var(--teal-dark); }
  .ml-day-btn.active { background:var(--teal-dark); border-color:var(--teal-dark); color:white; }
  .ml-day-hint { font-size:10px; font-family:'DM Mono',monospace; color:var(--teal-dark); margin-left:4px; }
  /* Recurring event: dashed left border + subtle stripe */
  .cal-event-recurring { border-left-style:dashed !important; }
  .cal-event-recurring .cal-event-name { font-style:italic; }
  /* Inline remove choice (Today / All / Cancel) */
  .cal-event-remove-choice { position:absolute; top:4px; right:6px; display:flex; gap:3px; }
  .cal-event-remove-choice button { font-size:9px; font-family:'DM Mono',monospace; padding:2px 5px; border-radius:4px; border:1px solid rgba(0,0,0,0.15); background:var(--card); cursor:pointer; color:var(--ink-soft); white-space:nowrap; }
  .cal-event-remove-choice button:first-child { color:var(--error); border-color:rgba(196,114,106,0.35); }
  .cal-event-remove-choice button:nth-child(2) { color:var(--error); border-color:rgba(196,114,106,0.35); font-weight:500; }
  .ml-event-title { font-size:11px; font-weight:500; color:var(--ink-mute); text-transform:uppercase; letter-spacing:0.7px; margin-bottom:14px; }
  .ml-sentence { font-size:14px; color:var(--ink); line-height:2; margin-bottom:0; }
  .ml-input { border:none; border-bottom:2px solid var(--teal); outline:none; font-size:14px; font-family:'DM Sans',sans-serif; color:var(--ink); background:transparent; width:100px; padding:0 2px; }
  .ml-select { border:none; border-bottom:2px solid var(--slate); outline:none; font-size:14px; font-family:'DM Sans',sans-serif; color:var(--ink); background:transparent; padding:0 2px; cursor:pointer; appearance:none; -webkit-appearance:none; }
  .ml-time-btn { border:none; border-bottom:2px solid var(--slate); background:transparent; font-size:14px; font-family:'DM Sans',sans-serif; color:var(--ink); padding:0 2px; cursor:pointer; transition:color 0.15s, border-color 0.15s; white-space:nowrap; }
  .ml-time-btn.active { border-bottom-color:var(--teal-dark); color:var(--teal-dark); font-weight:500; }
  .ml-time-btn:hover { color:var(--teal-dark); }
  .ml-nextday { font-size:9px; font-family:'DM Mono',monospace; color:var(--teal-dark); vertical-align:super; margin-left:2px; }
  .ios-picker-wrap { display:flex; background:var(--surface); border-radius:14px; border:1.5px solid var(--warm); overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08); margin-top:12px; margin-bottom:0; width:fit-content; }
  .ios-picker-col { position:relative; overflow:hidden; flex-shrink:0; }
  .ios-picker-col-scroll { overflow-y:scroll; scroll-snap-type:y mandatory; scrollbar-width:none; }
  .ios-picker-col-scroll::-webkit-scrollbar { display:none; }
  .ios-picker-item { display:flex; align-items:center; justify-content:center; scroll-snap-align:center; cursor:pointer; user-select:none; font-family:'DM Sans',sans-serif; transition:font-size 0.12s, color 0.12s, font-weight 0.12s; }
  .ios-picker-divider { width:1px; background:var(--warm); align-self:center; flex-shrink:0; }
  .ios-picker-label { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); text-transform:uppercase; letter-spacing:0.6px; text-align:center; padding:6px 0 2px; }
  .ml-duration { font-size:11px; font-family:'DM Mono',monospace; color:var(--ink-mute); margin-bottom:12px; min-height:16px; }
  .ml-save-btn { width:100%; background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:8px 0; font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); }
  .ml-save-btn:hover:not(:disabled) { background:var(--teal); }
  .ml-save-btn:disabled { opacity:0.35; cursor:not-allowed; }
  .ml-cancel-btn { display:block; width:100%; margin-top:8px; background:none; border:none; font-size:11px; font-family:'DM Mono',monospace; color:var(--ink-mute); cursor:pointer; text-align:center; padding:4px 0; }
  .ml-cancel-btn:hover { color:var(--ink); }
  .ml-rec-update-row { display:flex; gap:8px; }
  .ml-save-btn--half { flex:1; width:auto; }

  /* ── Energy Log ─────────────────────────────────────────────────────────── */
  .el-wrap { display:flex; flex-direction:column; gap:20px; padding-top:4px; }
  .el-insights { background:var(--card); border-radius:var(--radius); padding:20px 24px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .el-insights-title { font-size:10px; font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:1.5px; color:var(--ink-mute); margin-bottom:14px; }
  .el-insights-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .el-insight-cell { background:var(--cream); border-radius:var(--radius-sm); padding:12px 14px; }
  .el-insight-label { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); margin-bottom:6px; }
  .el-insight-value { font-size:13px; font-weight:500; color:var(--ink); word-break:break-word; line-height:1.3; }
  .el-insight-value.drain { color:var(--error); }
  .el-insight-value.charge { color:var(--teal-dark); }
  .el-insight-value.neutral { color:var(--ink-mute); }
  .el-group { display:flex; flex-direction:column; gap:6px; }
  .el-group-label { font-size:10px; font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:1.2px; color:var(--ink-mute); padding:0 2px; margin-bottom:2px; }
  .el-entry { display:flex; align-items:flex-start; gap:14px; background:var(--card); border-radius:var(--radius-sm); padding:12px 16px; border-left:3px solid transparent; transition:var(--transition); }
  .el-entry.drain { border-left-color:var(--error); }
  .el-entry.charge { border-left-color:var(--teal-dark); }
  .el-entry.neutral { border-left-color:var(--warm); }
  .el-delta { font-family:'DM Mono',monospace; font-size:13px; font-weight:500; min-width:46px; text-align:right; flex-shrink:0; padding-top:1px; }
  .el-delta.drain { color:var(--error); }
  .el-delta.charge { color:var(--teal-dark); }
  .el-delta.neutral { color:var(--ink-mute); }
  .el-entry-body { flex:1; min-width:0; }
  .el-entry-label { font-size:13px; color:var(--ink); font-weight:400; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:3px; }
  .el-entry-meta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .el-type-badge { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); background:var(--warm); border-radius:20px; padding:1px 7px; }
  .el-time { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); }
  .el-battery-after { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); }
  .el-empty { text-align:center; padding:60px 24px; }
  .el-empty-icon { font-size:40px; margin-bottom:16px; opacity:0.5; }
  .el-empty-title { font-family:'Playfair Display',serif; font-size:20px; color:var(--ink); margin-bottom:10px; }
  .el-empty-sub { font-size:14px; color:var(--ink-mute); line-height:1.7; max-width:320px; margin:0 auto; }
  .ml-time-cards { display:flex; gap:10px; margin-bottom:12px; }
  .ml-time-card { flex:1; border:1.5px solid var(--warm); border-radius:12px; padding:10px 14px; background:var(--card); cursor:pointer; transition:var(--transition); text-align:left; }
  .ml-time-card.active { border-color:var(--teal-dark); background:rgba(90,122,90,0.05); }
  .ml-time-card-label { font-size:9px; font-family:'DM Mono',monospace; color:var(--ink-mute); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px; }
  .ml-time-card-time { font-size:19px; color:var(--ink); font-family:'DM Sans',sans-serif; }
  .ml-time-card.active .ml-time-card-time { color:var(--teal-dark); font-weight:500; }
  .ml-impact-row { margin:0; }
  .ml-impact-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .ml-impact-label-text { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); text-transform:uppercase; letter-spacing:0.8px; }
  .impact-pill { font-size:11px; font-family:'DM Sans',monospace; padding:4px 10px; border-radius:20px; font-weight:500; display:inline-flex; align-items:center; gap:5px; }
  .impact-pill.drain { background:rgba(196,114,106,0.15); color:var(--error); }
  .impact-pill.charge { background:rgba(90,122,90,0.12); color:var(--teal-dark); }
  .impact-pill.neutral { background:rgba(0,0,0,0.06); color:var(--ink-mute); }
  .ml-impact-slider-row { display:flex; align-items:center; gap:10px; }
  .ml-impact-track-wrap { flex:1; min-width:0; position:relative; display:flex; align-items:center; }
  .ml-impact-track-wrap input[type=range] { width:100%; }
  .ml-impact-center-tick { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:2px; height:10px; background:rgba(0,0,0,0.15); border-radius:1px; pointer-events:none; }
  .ml-slider-label { font-size:11px; font-family:'DM Sans',sans-serif; font-weight:500; flex-shrink:0; line-height:1; }
  .ml-slider-label.drain-lbl { color:var(--error); }
  .ml-slider-label.charge-lbl { color:var(--teal-dark); }
  .ml-notes-input { width:100%; border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:10px 12px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink); background:var(--surface); outline:none; margin-bottom:0; }
  .ml-notes-input::placeholder { color:var(--ink-mute); }
  .ml-notes-input:focus { border-color:var(--teal-light); }
  .ml-chk-box { width:14px; height:14px; border:1.5px solid var(--warm); border-radius:3px; flex-shrink:0; display:inline-block; transition:var(--transition); vertical-align:middle; }
  .ml-chk-box.checked { background:var(--teal-dark); border-color:var(--teal-dark); }
  .ml-check-item { display:inline-flex; align-items:center; gap:5px; cursor:pointer; }
  .hour-row:last-child { border-bottom:none; }
  .hour-row.peak-zone { background:rgba(90,122,90,0.07); border-left:2px solid rgba(90,122,90,0.25); }
  .hour-row.dip-zone  { background:rgba(196,168,130,0.1); border-left:2px solid rgba(196,168,130,0.4); }
  .hour-row.wind-zone { background:rgba(106,138,170,0.08); border-left:2px solid rgba(106,138,170,0.3); }
  .hour-row:not(.peak-zone):not(.dip-zone):not(.wind-zone) { border-left:2px solid transparent; }
  .hour-label { width:52px; flex-shrink:0; padding:10px 10px 0; font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); text-align:right; line-height:1; }
  .hour-zone-tag { font-size:8px; font-weight:600; letter-spacing:0.8px; text-transform:uppercase; margin-top:3px; text-align:right; padding-right:10px; width:52px; flex-shrink:0; }
  .hour-zone-tag.peak-tag { color:var(--teal-dark); }
  .hour-zone-tag.dip-tag  { color:var(--slate-dark); }
  .hour-zone-tag.wind-tag { color:rgba(106,138,170,0.9); }
  .hour-content { flex:1; padding:6px 12px; display:flex; flex-direction:column; gap:4px; justify-content:center; }

  /* calendar blocks */
  .cal-block { border-radius:8px; padding:8px 10px; display:flex; align-items:flex-start; gap:8px; cursor:pointer; transition:var(--transition); position:relative; }
  .cal-block:hover { filter:brightness(0.96); }
  .cal-block.type-deep  { background:rgba(90,122,90,0.12); border-left:3px solid var(--teal-dark); }
  .cal-block.type-light { background:rgba(196,168,130,0.15); border-left:3px solid var(--slate); }
  .cal-block.type-admin { background:rgba(138,158,138,0.1); border-left:3px solid var(--teal-light); }
  .cal-block.type-focus { background:var(--focus-blue-light); border-left:3px solid var(--focus-blue); }
  .cal-block-name  { font-size:13px; color:var(--ink); font-weight:400; line-height:1.3; flex:1; }
  .cal-block.type-focus .cal-block-name { color:var(--focus-blue); font-weight:500; }
  .cal-block-tag   { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); margin-top:2px; }
  .cal-block-remove { background:none; border:none; color:var(--ink-mute); cursor:pointer; font-size:14px; line-height:1; padding:0 2px; opacity:0; transition:var(--transition); }
  .cal-block:hover .cal-block-remove { opacity:1; }

  .hour-add-btn { width:100%; background:none; border:1px dashed var(--warm); border-radius:8px; padding:7px 10px; font-size:12px; color:var(--ink-mute); cursor:pointer; text-align:left; transition:var(--transition); display:none; }
  .hour-row:hover .hour-add-btn { display:block; }
  .hour-add-btn:hover { border-color:var(--teal-light); color:var(--teal-dark); background:rgba(90,122,90,0.04); }

  /* now line */
  .now-line { position:absolute; left:54px; right:0; height:2px; background:var(--error); z-index:5; pointer-events:none; }
  .now-line::before { content:''; position:absolute; left:-6px; top:-4px; width:10px; height:10px; border-radius:50%; background:var(--error); box-shadow:0 0 0 3px rgba(196,114,106,0.2); }

  /* right col */
  .cal-sidebar { display:flex; flex-direction:column; gap:16px; }

  /* WELLNESS PROMPT */
  .wellness-prompt { background:rgba(196,168,130,0.13); border:1px solid rgba(196,168,130,0.35); border-radius:var(--radius-sm); padding:14px 16px; animation:fadeUp 0.35s ease both; }
  .wellness-prompt-eyebrow { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:var(--slate-dark); margin-bottom:6px; display:flex; align-items:center; gap:5px; }
  .wellness-prompt-msg { font-size:13px; color:var(--ink); line-height:1.6; margin-bottom:12px; }
  .wellness-prompt-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .wellness-prompt-btn { font-size:12px; padding:6px 14px; border-radius:20px; cursor:pointer; border:1.5px solid var(--slate-dark); background:var(--card); color:var(--slate-dark); font-family:'DM Sans',sans-serif; transition:var(--transition); }
  .wellness-prompt-btn:hover { background:var(--slate-dark); color:white; }
  .wellness-prompt-dismiss { font-size:11px; color:var(--ink-mute); background:none; border:none; cursor:pointer; padding:4px; font-family:'DM Sans',sans-serif; }

  /* shutdown history */
  .shutdown-history { background:var(--card); border-radius:var(--radius); padding:20px 22px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .shutdown-history-title { font-size:12px; font-weight:500; color:var(--ink-soft); margin-bottom:14px; }
  .shutdown-dots { display:flex; gap:5px; flex-wrap:wrap; }
  .s-dot { width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:11px; cursor:default; transition:var(--transition); }
  .s-dot.done     { background:var(--teal-dark); color:white; }
  .s-dot.missed   { background:var(--warm); color:var(--ink-mute); }
  .s-dot.today    { border:2px solid var(--teal-dark); background:transparent; color:var(--teal-dark); }
  .s-dot.future   { background:rgba(0,0,0,0.03); color:rgba(0,0,0,0.15); }
  .shutdown-streak { margin-top:10px; font-size:12px; color:var(--ink-soft); display:flex; align-items:center; gap:6px; }
  .shutdown-streak strong { color:var(--teal-dark); font-family:'Playfair Display',serif; font-size:16px; }

  /* focus block adder */
  .focus-adder { background:var(--card); border-radius:var(--radius); padding:20px 22px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .focus-adder-title { font-size:12px; font-weight:500; color:var(--ink-soft); margin-bottom:14px; }
  .focus-time-row { display:flex; gap:8px; margin-bottom:10px; align-items:center; }
  .focus-time-input { border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:8px 10px; font-family:'DM Mono',monospace; font-size:13px; color:var(--ink); background:var(--surface); outline:none; width:80px; transition:var(--transition); }
  .focus-time-input:focus { border-color:var(--focus-blue); }
  .focus-time-sep { color:var(--ink-mute); font-size:13px; }
  .focus-duration-select { border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:8px 24px 8px 10px; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--ink-soft); background:var(--surface); outline:none; cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a9a8a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 8px center; transition:var(--transition); flex:1; }
  .btn-add-focus { background:var(--focus-blue); color:white; border:none; border-radius:var(--radius-sm); padding:8px 14px; font-size:13px; cursor:pointer; transition:var(--transition); white-space:nowrap; }
  .btn-add-focus:hover { background:#5a7a9a; }

  /* unscheduled tasks */
  .unscheduled-panel { background:var(--card); border-radius:var(--radius); padding:20px 22px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .unscheduled-title { font-size:12px; font-weight:500; color:var(--ink-soft); margin-bottom:14px; }
  .unsched-item { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:var(--radius-sm); background:var(--cream); margin-bottom:6px; font-size:13px; color:var(--ink); cursor:pointer; transition:var(--transition); border:1.5px solid transparent; }
  .unsched-item:hover { border-color:var(--teal-light); }
  .unsched-item:last-child { margin-bottom:0; }
  .unsched-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .unsched-dot.deep  { background:var(--teal-dark); }
  .unsched-dot.light { background:var(--slate); }
  .unsched-dot.admin { background:var(--teal-light); }

  /* zone legend */
  .zone-legend { display:flex; gap:12px; flex-wrap:wrap; }
  .zone-badge { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--ink-mute); font-family:'DM Mono',monospace; }
  .zone-swatch { width:8px; height:8px; border-radius:2px; }

  /* SHUTDOWN */
  .shutdown-card { background:var(--ink); border-radius:var(--radius); padding:28px; color:white; animation:fadeUp 0.5s ease both; }
  .shutdown-title { font-family:'Playfair Display',serif; font-size:24px; font-weight:400; margin-bottom:6px; font-style:italic; }
  .shutdown-sub { font-size:13px; color:rgba(255,255,255,0.5); margin-bottom:28px; line-height:1.5; }
  .shutdown-prompt { margin-bottom:20px; }
  .shutdown-q { font-size:13px; color:rgba(255,255,255,0.7); margin-bottom:8px; font-weight:400; }
  .shutdown-textarea { width:100%; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:var(--radius-sm); padding:12px 14px; font-family:'DM Sans',sans-serif; font-size:13px; color:white; resize:none; outline:none; transition:var(--transition); min-height:70px; }
  .shutdown-textarea::placeholder { color:rgba(255,255,255,0.5); }
  .shutdown-textarea:focus { border-color:rgba(255,255,255,0.3); background:rgba(255,255,255,0.1); }
  .shutdown-stats { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:24px; }
  .shutdown-stat { text-align:center; background:rgba(255,255,255,0.05); border-radius:var(--radius-sm); padding:14px 10px; }
  .shutdown-num { font-family:'Playfair Display',serif; font-size:28px; color:var(--teal-light); display:block; margin-bottom:4px; }
  .shutdown-label { font-size:11px; color:rgba(255,255,255,0.6); font-family:'DM Mono',monospace; }
  .btn-shutdown { width:100%; background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:14px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:var(--transition); letter-spacing:0.3px; }
  .btn-shutdown:hover { background:var(--teal); }
  .sd-ml-sentence { font-size:15px; color:rgba(255,255,255,0.9); line-height:2.2; margin-bottom:12px; }
  .sd-ml-chips { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 4px; }
  .sd-ml-chip { font-size:12px; padding:4px 12px; border-radius:20px; border:1.5px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6); cursor:pointer; transition:var(--transition); font-family:'DM Sans',sans-serif; }
  .sd-ml-chip:hover { border-color:rgba(255,255,255,0.35); color:rgba(255,255,255,0.85); }
  .sd-ml-chip.active { border-color:var(--teal-light); background:rgba(196,212,196,0.15); color:var(--teal-light); }
  .sd-ml-input { background:transparent; border:none; border-bottom:1.5px solid rgba(255,255,255,0.25); outline:none; font-size:13px; font-family:'DM Sans',sans-serif; color:rgba(255,255,255,0.8); padding:2px 4px; width:130px; margin-top:6px; }
  .sd-ml-input::placeholder { color:rgba(255,255,255,0.25); }

  /* COMPLETE */
  @keyframes gentleFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-6px) } }
  .complete-screen { text-align:center; padding:60px 40px; animation:fadeUp 0.6s ease both; }
  .complete-icon  { font-size:56px; margin-bottom:20px; display:block; animation:fadeUp 0.6s ease both, gentleFloat 3s ease-in-out 0.6s infinite; }
  .complete-title { font-family:'Playfair Display',serif; font-size:32px; font-weight:400; color:var(--ink); margin-bottom:12px; font-style:italic; }
  .complete-msg   { font-size:15px; color:var(--ink-soft); line-height:1.7; max-width:400px; margin:0 auto 16px; }
  .complete-streak { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); margin:0 auto 32px; letter-spacing:0.3px; }
  .complete-btn   { background:transparent; border:2px solid var(--teal-light); border-radius:40px; padding:12px 28px; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--teal-dark); cursor:pointer; transition:var(--transition); }
  .complete-btn:hover { background:var(--teal-dark); color:white; border-color:var(--teal-dark); }
  .complete-btn:active { transform:scale(0.97); }

  /* NOTIFICATIONS */
  .notif-page { max-width:560px; margin:0 auto; padding:32px 0 60px; animation:fadeUp 0.5s ease both; }
  .notif-section { background:var(--card); border-radius:var(--radius); padding:28px 32px; box-shadow:0 1px 8px rgba(0,0,0,0.05); margin-bottom:16px; }
  .notif-section-title { font-family:'Playfair Display',serif; font-size:18px; font-weight:400; color:var(--ink); margin-bottom:4px; }
  .notif-section-sub { font-size:13px; color:var(--ink-mute); margin-bottom:24px; line-height:1.5; }
  .notif-row { display:flex; align-items:center; justify-content:space-between; padding:14px 0; border-bottom:1px solid var(--warm); }
  .notif-row:last-of-type { border-bottom:none; }
  .notif-row-label { font-size:14px; color:var(--ink); display:flex; align-items:center; gap:10px; }
  .notif-row-hint { font-size:11px; color:var(--ink-mute); margin-top:2px; font-family:'DM Mono',monospace; }
  .notif-time-input { border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:8px 12px; font-family:'DM Mono',monospace; font-size:13px; color:var(--ink); background:var(--surface); outline:none; width:110px; text-align:center; transition:var(--transition); }
  .notif-time-input:focus { border-color:var(--teal-light); box-shadow:0 0 0 3px var(--glow); }
  .notif-toggle { position:relative; width:44px; height:24px; flex-shrink:0; }
  .notif-toggle input { opacity:0; width:0; height:0; }
  .notif-toggle-slider { position:absolute; inset:0; background:var(--warm); border-radius:24px; cursor:pointer; transition:var(--transition); }
  .notif-toggle-slider::before { content:''; position:absolute; width:18px; height:18px; left:3px; bottom:3px; background:var(--surface); border-radius:50%; transition:var(--transition); box-shadow:0 1px 4px rgba(0,0,0,0.15); }
  .notif-toggle input:checked + .notif-toggle-slider { background:var(--teal-dark); }
  .notif-toggle input:checked + .notif-toggle-slider::before { transform:translateX(20px); }
  .notif-permission-bar { background:rgba(196,168,130,0.12); border:1px solid rgba(196,168,130,0.3); border-radius:var(--radius-sm); padding:14px 16px; font-size:13px; color:var(--slate-dark); line-height:1.5; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .notif-token-box { background:var(--warm); border-radius:var(--radius-sm); padding:10px 14px; font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); word-break:break-all; margin-top:12px; line-height:1.6; }
  .notif-save-row { display:flex; justify-content:flex-end; margin-top:8px; }

  /* TUTORIAL */
  .tutorial-overlay { position:fixed; inset:0; background:rgba(20,28,20,0.6); z-index:1100; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.3s ease both; }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  .tutorial-card { background:var(--surface); border-radius:24px; padding:40px 44px; max-width:520px; width:100%; box-shadow:0 24px 64px rgba(0,0,0,0.25); animation:fadeUp 0.4s ease both; max-height:90vh; overflow-y:auto; }
  .tutorial-visual { background:var(--cream); border-radius:var(--radius); padding:20px; margin-bottom:24px; border:1px solid var(--warm); min-height:120px; }
  .tutorial-dots { display:flex; gap:6px; justify-content:center; margin-bottom:24px; }
  .tutorial-dot { width:24px; height:3px; border-radius:2px; background:var(--warm); transition:var(--transition); }
  .tutorial-dot.active { background:var(--teal-dark); }
  .tutorial-dot.done   { background:var(--teal-light); }
  .tutorial-step { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--teal-dark); margin-bottom:8px; }
  .tutorial-title { font-family:'Playfair Display',serif; font-size:22px; font-weight:400; color:var(--ink); line-height:1.35; margin-bottom:8px; }
  .tutorial-desc { font-size:14px; color:var(--ink-soft); line-height:1.7; margin-bottom:28px; }
  .tutorial-actions { display:flex; align-items:center; justify-content:space-between; }
  .tutorial-help-btn { background:none; border:1.5px solid var(--warm); border-radius:50%; width:32px; height:32px; font-size:14px; cursor:pointer; color:var(--ink-mute); transition:var(--transition); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .tutorial-help-btn:hover { border-color:var(--teal-light); color:var(--teal-dark); }
  .nav-privacy-btn { background:none; border:1.5px solid var(--warm); border-radius:50%; width:32px; height:32px; cursor:pointer; color:var(--ink-mute); transition:var(--transition); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .nav-privacy-btn:hover { border-color:var(--teal-light); color:var(--teal-dark); }
  .nav-privacy-btn.active { border-color:var(--teal-dark); color:var(--teal-dark); background:var(--teal-pale,rgba(107,142,90,0.12)); }
  .nav-sos-btn { background:none; border:1.5px solid rgba(196,114,106,0.4); border-radius:20px; padding:0 9px; height:32px; cursor:pointer; color:var(--error); font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1px; font-weight:500; transition:var(--transition); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .nav-sos-btn:hover { border-color:var(--error); background:rgba(196,114,106,0.08); }

  /* TOAST */
  .toast { position:fixed; bottom:28px; right:28px; z-index:999; background:#2a2a25; color:#f5f2eb; border-radius:var(--radius); padding:16px 20px; max-width:280px; box-shadow:0 8px 32px rgba(0,0,0,0.4); animation:slideIn 0.4s cubic-bezier(0.4,0,0.2,1) both; }
  /* WELCOME BACK — in-app only, fades out on its own */
  .welcome-back-card { position:fixed; top:calc(env(safe-area-inset-top, 0px) + 96px); left:50%; transform:translateX(-50%); z-index:998; background:var(--surface); color:var(--ink); border:1.5px solid rgba(90,122,90,0.25); border-radius:var(--radius); padding:12px 20px; font-family:'DM Sans',sans-serif; font-size:14px; box-shadow:0 6px 24px var(--glow); white-space:nowrap; cursor:pointer; animation:welcomeBackFade 5s ease both; }
  @keyframes welcomeBackFade { 0%{opacity:0} 10%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
  .toast.scheduled { background:linear-gradient(135deg,var(--focus-blue) 0%,#4a6a8a 100%); }
  .toast.warn { background:linear-gradient(135deg,var(--slate-dark) 0%,#9a6a3a 100%); }
  .toast-title { font-weight:500; font-size:14px; margin-bottom:4px; }
  .toast-msg   { font-size:12px; opacity:0.85; line-height:1.5; }
  .toast-action { margin-top:8px; background:none; border:none; padding:4px 0; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; color:#f5f2eb; text-decoration:underline; cursor:pointer; }
  .toast-close { position:absolute; top:10px; right:12px; background:none; border:none; color:rgba(245,242,235,0.6); cursor:pointer; font-size:16px; line-height:1; }

  /* MINDFULNESS VIEW */
  .mindfulness-page { max-width:560px; margin:0 auto; padding:32px 0 60px; animation:fadeUp 0.5s ease both; }
  .mind-sub-tabs { display:flex; flex-wrap:nowrap; gap:4px; background:var(--warm); border-radius:40px; padding:4px; margin-bottom:28px; max-width:100%; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
  .mind-sub-tabs::-webkit-scrollbar { display:none; }
  .flat-nav-wrap { position:relative; margin-bottom:28px; }
  .flat-nav-wrap .mind-sub-tabs { margin-bottom:0; }
  .flat-nav-fade { position:absolute; right:0; top:0; bottom:0; width:56px; background:linear-gradient(to right, transparent, var(--warm)); border-radius:0 40px 40px 0; pointer-events:none; }
  .mind-tab { padding:8px 22px; border:none; background:transparent; border-radius:40px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-soft); cursor:pointer; transition:var(--transition); white-space:nowrap; flex-shrink:0; outline:none; }
  .mind-tab:focus-visible { outline:2px solid var(--teal); outline-offset:2px; }
  .mind-tab.active { background:var(--card); color:var(--ink); font-weight:500; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
  .hold-hint { position:absolute; left:calc(100% + 8px); top:50%; transform:translateY(-50%); white-space:nowrap; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:500; color:var(--ink); background:var(--surface); border:1.5px solid var(--teal-dark); border-radius:20px; padding:4px 12px; pointer-events:none; box-shadow:0 2px 10px rgba(0,0,0,0.15); animation:holdHintIn 0.2s ease both; z-index:3; }
  @keyframes holdHintIn { from { opacity:0; } to { opacity:1; } }
  /* Compact variant: equal-width tabs that fit a phone without scrolling */
  .mind-sub-tabs--compact .mind-tab { flex:1; min-width:0; padding:8px 4px; font-size:12px; display:flex; align-items:center; justify-content:center; }
  .mind-sub-tabs--compact .mind-tab svg { display:none; }
  /* Split variant: equal-width, separate pill buttons (Recharge) */
  .mind-sub-tabs--split { background:none; padding:0; gap:12px; border-radius:0; overflow:visible; }
  .mind-sub-tabs--split .mind-tab { flex:1; display:flex; align-items:center; justify-content:center; padding:12px 16px; font-size:14px; background:var(--card); border:1.5px solid var(--warm); color:var(--ink-soft); }
  .mind-sub-tabs--split .mind-tab.active { background:rgba(90,122,90,0.1); border-color:var(--teal-dark); color:var(--teal-dark); box-shadow:none; }

  /* BREATHING */
  .breathing-wrap { background:var(--card); border-radius:var(--radius); padding:28px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .breath-pattern-row { display:flex; gap:8px; margin-bottom:24px; }
  .breath-pattern-btn { flex:1; border:1.5px solid var(--warm); border-radius:40px; padding:8px 0; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-soft); background:var(--card); cursor:pointer; transition:var(--transition); }
  .breath-pattern-btn:hover { border-color:var(--teal-light); }
  .breath-pattern-btn.active { border-color:var(--teal-dark); background:rgba(90,122,90,0.06); color:var(--teal-dark); font-weight:500; }
  .breath-pacer-wrap { display:flex; justify-content:center; align-items:center; padding:40px 0 32px; }
  .breath-ring { width:min(220px,100%); aspect-ratio:1; border-radius:50%; background:rgba(90,122,90,0.04); border:1.5px solid var(--teal-light); display:flex; align-items:center; justify-content:center; position:relative; }
  .breath-circle { width:150px; height:150px; border-radius:50%; background:radial-gradient(circle,rgba(90,122,90,0.22) 0%,rgba(90,122,90,0.06) 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; -webkit-transition:transform var(--breath-dur,4s) var(--breath-ease,ease-in-out); transition:transform var(--breath-dur,4s) var(--breath-ease,ease-in-out); }
  .breath-phase-label { font-family:'Playfair Display',serif; font-size:17px; font-style:italic; color:var(--ink); }
  .breath-countdown { font-family:'DM Mono',monospace; font-size:34px; font-weight:300; color:var(--teal-dark); margin-top:2px; line-height:1; }
  .breath-phase-strip { display:flex; gap:6px; justify-content:center; margin-bottom:24px; flex-wrap:wrap; }
  .breath-phase-chip { display:flex; flex-direction:column; align-items:center; padding:6px 12px; border-radius:var(--radius-sm); background:var(--cream); font-size:11px; color:var(--ink-mute); font-family:'DM Mono',monospace; transition:var(--transition); }
  .breath-phase-chip.active { background:rgba(90,122,90,0.1); color:var(--teal-dark); }
  .breath-phase-chip span:first-child { font-size:10px; letter-spacing:0.5px; margin-bottom:2px; }
  .breath-controls { display:flex; align-items:center; justify-content:center; gap:16px; }
  .breath-cycles { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); }
  .breath-custom-row { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px; margin-bottom:20px; }
  .breath-custom-input-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; }
  .breath-custom-label { font-size:10px; color:var(--ink-mute); font-family:'DM Mono',monospace; letter-spacing:0.5px; }
  .breath-custom-input { width:100%; border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:8px 4px; font-family:'DM Mono',monospace; font-size:14px; color:var(--ink); text-align:center; background:var(--surface); outline:none; transition:var(--transition); }
  .breath-custom-input:focus { border-color:var(--teal-light); }

  /* MOOD CHECK-IN */
  .mood-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:24px; max-height:320px; overflow-y:auto; padding-right:2px; }
  .mood-option { border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:12px 8px; cursor:pointer; transition:var(--transition); text-align:center; background:var(--cream); }
  .mood-option:hover { border-color:var(--teal-light); transform:translateY(-1px); }
  .mood-option.selected { border-color:var(--teal-dark); background:rgba(90,122,90,0.06); }
  .mood-icon { font-size:22px; display:block; margin-bottom:4px; }
  .mood-label { font-size:11px; color:var(--ink-soft); font-family:'DM Mono',monospace; }
  .mood-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:40px; font-size:12px; background:rgba(90,122,90,0.1); color:var(--teal-dark); }

  /* INTENTION */
  .intention-wrap { background:rgba(90,122,90,0.05); border:1px solid rgba(90,122,90,0.15); border-radius:var(--radius-sm); padding:16px; margin-bottom:24px; }
  .intention-q { font-size:13px; color:var(--ink-soft); margin-bottom:8px; }
  .intention-input { width:100%; border:none; background:transparent; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); outline:none; resize:none; line-height:1.6; min-height:72px; box-sizing:border-box; }
  .intention-input::placeholder { color:var(--ink-mute); }
  .intention-display { font-family:'Playfair Display',serif; font-size:16px; font-style:italic; color:var(--teal-dark); }

  /* JOURNAL */
  .journal-wrap { background:var(--card); border-radius:var(--radius); padding:24px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .journal-textarea { width:100%; border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:14px 16px; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); background:var(--surface); outline:none; resize:none; overflow-y:auto; transition:border-color 0.2s, box-shadow 0.2s; min-height:80px; max-height:320px; line-height:1.6; }
  .journal-textarea:focus { border-color:var(--teal-light); box-shadow:0 0 0 3px var(--glow); }
  .journal-textarea::placeholder { color:var(--ink-mute); }
  .journal-submit-row { display:flex; justify-content:space-between; align-items:center; margin-top:8px; margin-bottom:20px; }
  .journal-entry { padding:12px 0; border-bottom:1px solid var(--warm); cursor:pointer; transition:background 0.15s; border-radius:6px; padding-left:4px; padding-right:4px; }
  .journal-entry:last-child { border-bottom:none; }
  .journal-entry:hover { background:rgba(138,158,138,0.04); }
  .journal-entry-header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .journal-entry-preview { font-size:14px; color:var(--ink); line-height:1.5; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .journal-entry-meta { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .journal-entry-time { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); }
  .journal-entry-chevron { font-size:9px; color:var(--ink-mute); transition:transform 0.2s; line-height:1; }
  .journal-entry-chevron.open { transform:rotate(180deg); }
  .journal-entry-body { font-size:14px; color:var(--ink); line-height:1.65; margin-top:10px; padding-top:10px; border-top:1px solid var(--warm); }
  .journal-entry-actions { display:flex; justify-content:flex-end; margin-top:8px; }
  .journal-empty { font-size:13px; color:var(--ink-mute); font-style:italic; text-align:center; padding:28px 0; }
  .journal-prompt-section { margin-bottom:18px; }
  .journal-prompt-label { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px; }
  .journal-prompt-cats { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:10px; }
  .journal-prompt-cat { font-size:11px; padding:4px 11px; border-radius:20px; border:1.5px solid var(--warm); background:var(--card); color:var(--ink-mute); cursor:pointer; font-family:'DM Sans',sans-serif; transition:var(--transition); }
  .journal-prompt-cat.active { background:var(--teal-dark); border-color:var(--teal-dark); color:white; }
  .journal-prompt-cat:hover:not(.active) { border-color:var(--teal-light); color:var(--teal-dark); }
  .journal-prompt-card { background:var(--cream); border:1.5px solid var(--warm); border-radius:12px; padding:14px 16px; display:flex; align-items:flex-start; gap:12px; transition:border-color 0.2s ease; }
  .journal-prompt-card:hover { border-color:var(--teal-light); }
  .journal-prompt-text { font-size:13px; color:var(--ink-soft); line-height:1.6; font-style:italic; flex:1; }
  .journal-prompt-use { font-size:11px; padding:5px 12px; border-radius:20px; border:1.5px solid var(--teal); color:var(--teal-dark); background:var(--card); cursor:pointer; font-family:'DM Sans',sans-serif; transition:var(--transition); white-space:nowrap; flex-shrink:0; align-self:center; }
  .journal-prompt-use:hover { background:var(--teal-dark); color:white; border-color:var(--teal-dark); }
  .journal-prompt-shuffle { background:none; border:none; cursor:pointer; color:var(--ink-mute); font-size:15px; padding:4px; transition:var(--transition); flex-shrink:0; align-self:center; line-height:1; }
  .journal-prompt-shuffle:hover { color:var(--teal-dark); transform:rotate(45deg); }
  .journal-draft-badge { font-size:11px; color:var(--ink-mute); font-family:'DM Mono',monospace; opacity:0.6; font-style:italic; }
  .settings-tab-content { animation:fadeUp 0.22s ease both; }
  .dirty-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); backdrop-filter:blur(4px); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
  .dirty-modal { background:var(--surface); border-radius:20px; padding:32px 28px; max-width:380px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,0.18); animation:fadeUp 0.18s ease both; }
  .dirty-modal-title { font-family:'Playfair Display',serif; font-size:19px; font-weight:400; color:var(--ink); margin-bottom:8px; }
  .dirty-modal-sub { font-size:13px; color:var(--ink-mute); line-height:1.6; margin-bottom:24px; }
  .dirty-modal-actions { display:flex; flex-direction:column; gap:8px; }
  .dirty-modal-save { width:100%; background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:12px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:var(--transition); }
  .dirty-modal-save:hover { opacity:0.88; }
  .dirty-modal-discard { width:100%; background:var(--warm); color:var(--ink-soft); border:none; border-radius:40px; padding:12px; font-family:'DM Sans',sans-serif; font-size:13px; cursor:pointer; transition:var(--transition); }
  .dirty-modal-discard:hover { background:#e5ddd0; }
  .dirty-modal-cancel { width:100%; background:none; border:none; color:var(--ink-mute); font-size:12px; padding:8px; cursor:pointer; font-family:'DM Mono',monospace; }

  /* GRATITUDE */
  .gratitude-wrap { margin-bottom:20px; }
  .gratitude-item { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .gratitude-num { font-family:'DM Mono',monospace; font-size:11px; color:rgba(255,255,255,0.4); width:16px; flex-shrink:0; }

  @keyframes breathe     { 0%,100%{box-shadow:0 0 0 0 rgba(90,122,90,0.15)} 50%{box-shadow:0 0 0 20px rgba(90,122,90,0)} }
  @keyframes fadeUp      { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideIn     { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:0.5} }
  @keyframes batteryPulse{ 0%,100%{opacity:1} 50%{opacity:0.55} }
  @keyframes checkPop    { 0%{transform:scale(1)} 20%{transform:scale(1.32);background:var(--teal-dark);border-color:var(--teal-dark)} 45%{transform:scale(0.9);background:var(--teal-dark);border-color:var(--teal-dark)} 60%{transform:scale(1.06);background:var(--teal-dark);border-color:var(--teal-dark)} 100%{transform:scale(1);background:var(--teal-dark);border-color:var(--teal-dark)} }
  @keyframes holdFill    { from{stroke-dashoffset:94.2} to{stroke-dashoffset:0} }
  .hold-ring { position:absolute; inset:-5px; width:calc(100% + 10px); height:calc(100% + 10px); pointer-events:none; overflow:visible; }
  .hold-ring circle { transform-origin:center; transform:rotate(-90deg); }
  .new-task-check { position:relative; overflow:visible !important; }
  .task-check { position:relative; overflow:visible !important; }
  @keyframes taskGlow    { 0%{box-shadow:0 1px 6px rgba(0,0,0,0.04);opacity:1;transform:translateY(0)} 20%{box-shadow:0 2px 16px rgba(90,122,90,0.22);background:rgba(90,122,90,0.07)} 60%{box-shadow:0 1px 6px rgba(0,0,0,0.04);opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-10px)} }
  @keyframes drawCheck   { from{stroke-dashoffset:13;opacity:1} to{stroke-dashoffset:0;opacity:1} }
  .task-item.completing .task-check { animation:checkPop 1.2s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .task-item.completing { animation:taskGlow 1.5s ease forwards; }
  .task-item.completing .task-check svg { opacity:1; transition:none; }
  .task-item.completing .task-check svg path { stroke-dasharray:13; stroke-dashoffset:13; animation:drawCheck 0.45s 0.35s ease forwards; }
  .pulsing { animation:pulse 2s ease infinite; }

  /* ── Power-Save Theme Override ─────────────────────────────────── */
  [data-battery-save="true"] { --teal:#c4a030; --teal-light:#e8cc7a; --teal-dark:#9a7a20; --glow:rgba(196,160,48,0.15); }
  [data-battery-save="true"] *,[data-battery-save="true"] *::before,[data-battery-save="true"] *::after { animation-duration:0.01ms!important; transition-duration:0.01ms!important; }

  /* ── Battery Indicator ─────────────────────────────────────────── */
  .battery-wrap { display:flex; align-items:center; gap:5px; }
  .battery-shell { width:26px; height:13px; border:2px solid currentColor; border-radius:3px; position:relative; flex-shrink:0; }
  .battery-shell::after { content:''; position:absolute; right:-5px; top:3px; width:3px; height:5px; background:currentColor; border-radius:0 2px 2px 0; }
  .battery-fill { height:100%; border-radius:1px; transition:width 0.6s ease, background 0.6s ease; }
  .battery-pct { font-family:'DM Mono',monospace; font-size:10px; }
  .battery-wrap.charging .battery-shell { animation:batteryPulse 1.5s ease-in-out infinite; }

  /* ── Energy Impact Toggle (AddTask) ────────────────────────────── */
  .impact-toggle { font-size:11px; padding:5px 10px; border-radius:20px; border:1.5px solid var(--warm); background:var(--card); color:var(--ink-mute); cursor:pointer; font-family:'DM Sans',sans-serif; transition:var(--transition); white-space:nowrap; }
  .impact-toggle.active.drain  { border-color:var(--error); background:rgba(196,114,106,0.08); color:var(--error); }
  .impact-toggle.active.charge { border-color:var(--teal-dark); background:rgba(90,122,90,0.08); color:var(--teal-dark); }
  .impact-slider { flex:1; accent-color:var(--teal-dark); cursor:pointer; }

  /* ── Suggestion Engine Card ────────────────────────────────────── */
  .suggest-card { background:var(--card); border-radius:var(--radius); padding:24px 28px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .suggest-title { font-size:10px; font-weight:500; color:var(--ink-mute); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:16px; }
  .suggest-item { display:flex; align-items:center; gap:12px; padding:10px 0; border-top:1px solid var(--warm); cursor:pointer; transition:var(--transition); }
  .suggest-item:first-of-type { border-top:none; padding-top:0; }
  .suggest-item:hover { opacity:0.75; }
  .suggest-impact { font-family:'DM Mono',monospace; font-size:11px; padding:2px 8px; border-radius:20px; flex-shrink:0; }
  .suggest-impact.drain  { background:rgba(196,114,106,0.1); color:var(--error); }
  .suggest-impact.charge { background:rgba(90,122,90,0.1); color:var(--teal-dark); }
  .suggest-item--nudge { cursor:default; }
  .suggest-item--nudge:hover { opacity:1; }
  .suggest-nudge-icon { font-size:14px; flex-shrink:0; width:32px; text-align:center; }

  /* BREATHING GATE OVERLAY */
  .breath-gate { position:fixed; inset:0; z-index:1000; background:linear-gradient(160deg,#2d4a2d 0%,#1a2e1a 60%,#0f1f0f 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; }
  .breath-gate-eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:rgba(196,212,196,0.5); margin-bottom:10px; }
  .breath-gate-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; color:rgba(240,245,240,0.95); font-style:italic; margin-bottom:48px; text-align:center; }
  .breath-gate-ring { width:min(240px,100%); aspect-ratio:1; border-radius:50%; border:1px solid rgba(138,158,138,0.25); display:flex; align-items:center; justify-content:center; position:relative; margin-bottom:40px; }
  .breath-gate-ring::before { content:''; position:absolute; inset:-16px; border-radius:50%; border:1px solid rgba(138,158,138,0.1); }
  .breath-gate-circle { width:160px; height:160px; border-radius:50%; background:radial-gradient(circle,rgba(138,158,138,0.35) 0%,rgba(90,122,90,0.1) 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; -webkit-transition:transform var(--gate-dur,4s) var(--gate-ease,ease-in-out); transition:transform var(--gate-dur,4s) var(--gate-ease,ease-in-out); }
  .breath-gate-label { font-family:'Playfair Display',serif; font-size:16px; font-style:italic; color:rgba(240,245,240,0.9); }
  .breath-gate-count { font-family:'DM Mono',monospace; font-size:32px; font-weight:300; color:rgba(196,212,196,0.8); margin-top:4px; line-height:1; }
  .breath-gate-cycles { font-family:'DM Mono',monospace; font-size:11px; color:rgba(196,212,196,0.4); letter-spacing:1px; margin-bottom:28px; }
  .breath-gate-continue { background:rgba(138,158,138,0.2); border:1px solid rgba(138,158,138,0.4); color:rgba(240,245,240,0.9); border-radius:40px; padding:13px 36px; font-family:'DM Sans',sans-serif; font-size:14px; cursor:pointer; transition:var(--transition); letter-spacing:0.3px; animation:fadeUp 0.5s ease both; }
  .breath-gate-continue:hover { background:rgba(138,158,138,0.35); }
  .breath-gate-affirm { font-size:12px; color:rgba(196,212,196,0.5); margin-top:14px; font-style:italic; animation:fadeUp 0.6s 0.2s ease both; }
  .breath-gate-begin { background:transparent; border:1.5px solid rgba(138,158,138,0.35); color:rgba(196,212,196,0.75); border-radius:40px; padding:13px 36px; font-family:'DM Sans',sans-serif; font-size:14px; cursor:pointer; transition:var(--transition); }
  .breath-gate-begin:hover { border-color:rgba(138,158,138,0.6); color:rgba(240,245,240,0.9); }
  .breath-gate-skip { background:none; border:none; color:rgba(196,212,196,0.65); font-family:'DM Mono',monospace; font-size:11px; cursor:pointer; margin-top:20px; padding:4px 8px; letter-spacing:0.5px; transition:color 0.2s; text-decoration:underline; text-underline-offset:3px; }
  .breath-gate-skip:hover { color:rgba(196,212,196,0.9); }
  .breath-gate-fact { margin-top:32px; padding:16px 20px; border-top:1px solid rgba(138,158,138,0.15); text-align:center; max-width:320px; animation:fadeUp 0.6s ease both; }
  .breath-gate-fact-text { font-size:12px; font-style:italic; color:rgba(196,212,196,0.55); line-height:1.6; }
  .breath-gate-fact-source { font-family:'DM Mono',monospace; font-size:10px; color:rgba(196,212,196,0.3); margin-top:6px; letter-spacing:0.3px; }

  /* GROUNDING */
  .grounding-page { max-width:620px; margin:0 auto; padding:32px 0 80px; animation:fadeUp 0.5s ease both; }
  .wellness-intro-banner { background:var(--card); border-radius:var(--radius); padding:28px 28px 22px; box-shadow:0 1px 8px rgba(0,0,0,0.05); margin-bottom:24px; border-top:3px solid var(--teal-dark); }
  .wellness-intro-title { font-family:'Playfair Display',serif; font-size:20px; font-weight:400; color:var(--ink); margin-bottom:8px; }
  .wellness-intro-sub { font-size:13px; color:var(--ink-soft); line-height:1.65; margin-bottom:18px; }
  .wellness-intro-features { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; }
  .wellness-intro-feature { display:flex; align-items:flex-start; gap:10px; background:var(--cream); border-radius:var(--radius-sm); padding:12px 14px; }
  .wellness-intro-feature-text { font-size:12px; color:var(--ink); line-height:1.5; }
  .wellness-intro-feature-name { font-weight:500; display:block; margin-bottom:2px; }
  .wellness-intro-dismiss { background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:9px 22px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:var(--transition); }
  .wellness-intro-dismiss:hover { background:var(--teal-light); }
  .ground-card { background:var(--card); border-radius:var(--radius); padding:24px; box-shadow:0 1px 8px rgba(0,0,0,0.05); margin-bottom:16px; cursor:pointer; transition:var(--transition); }
  .ground-card:hover { box-shadow:0 4px 20px rgba(0,0,0,0.08); transform:translateY(-1px); }
  .ground-card-header { display:flex; align-items:center; justify-content:space-between; }
  .ground-card-left { display:flex; align-items:center; gap:14px; }
  .ground-card-icon { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
  .ground-card-title { font-family:'Playfair Display',serif; font-size:16px; font-weight:400; color:var(--ink); margin-bottom:2px; }
  .ground-card-meta { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); letter-spacing:0.5px; }
  .ground-card-chevron { font-size:18px; color:var(--ink-mute); transition:transform 0.3s ease; }
  .ground-card.open .ground-card-chevron { transform:rotate(180deg); }
  .ground-card-body { max-height:0; overflow:hidden; transition:max-height 0.4s ease; }
  .ground-card.open .ground-card-body { max-height:1400px; }
  .ground-card-inner { padding-top:20px; border-top:1px solid var(--warm); margin-top:20px; }
  .ground-step { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; }
  .ground-step-num { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:13px; flex-shrink:0; color:white; }
  .ground-step-text strong { display:block; font-size:14px; color:var(--ink); margin-bottom:3px; font-weight:500; }
  .ground-step-text span { font-size:12px; color:var(--ink-mute); line-height:1.5; }
  .ground-tip { background:var(--cream); border-radius:var(--radius-sm); padding:14px 16px; font-size:13px; color:var(--ink-soft); line-height:1.6; margin-bottom:16px; border-left:3px solid var(--teal-light); }
  .ground-complete-btn { width:100%; padding:11px; border:none; border-radius:40px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:var(--transition); }
  .ground-complete-btn:not(:disabled):hover { transform:translateY(-1px); }
  .ground-complete-btn:disabled { opacity:0.55; cursor:not-allowed; }
  /* ── Mental health screening ── */
  .screening-wrap { max-width:560px; }
  .screening-disclaimer { background:var(--cream); border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:14px 16px; font-size:12px; color:var(--ink-mute); line-height:1.6; margin-bottom:20px; }
  .screening-disclaimer strong { color:var(--ink-soft); }
  .screening-type-row { display:flex; gap:8px; margin-bottom:24px; }
  .screening-type-btn { flex:1; padding:12px 8px; border-radius:var(--radius-sm); border:1.5px solid var(--warm); background:var(--card); font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-soft); cursor:pointer; transition:var(--transition); text-align:center; }
  .screening-type-btn.active { border-color:var(--teal-dark); background:rgba(90,122,90,0.06); color:var(--teal-dark); }
  .screening-type-btn:hover:not(.active) { border-color:var(--teal-light); }
  .screening-type-label { font-size:11px; font-family:'DM Mono',monospace; color:var(--ink-mute); margin-top:3px; }
  .screening-timeframe { font-size:13px; color:var(--ink-soft); line-height:1.6; margin-bottom:20px; font-style:italic; }
  .screening-q { background:var(--card); border-radius:var(--radius-sm); padding:18px; box-shadow:0 1px 6px rgba(0,0,0,0.05); margin-bottom:10px; }
  .screening-q-num { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); margin-bottom:6px; }
  .screening-q-text { font-size:14px; color:var(--ink); line-height:1.5; margin-bottom:12px; }
  .screening-options { display:flex; gap:6px; flex-wrap:wrap; }
  .screening-opt { font-size:11px; padding:6px 12px; border-radius:20px; border:1.5px solid var(--warm); background:var(--card); color:var(--ink-mute); cursor:pointer; font-family:'DM Sans',sans-serif; transition:var(--transition); }
  .screening-opt:hover:not(.selected) { border-color:var(--teal-light); color:var(--teal-dark); }
  .screening-opt.selected { border-color:var(--teal-dark); background:var(--teal-dark); color:white; }
  .screening-opt.selected.alert { border-color:var(--error); background:var(--error); }
  .screening-submit { width:100%; padding:12px; border:none; border-radius:40px; background:var(--teal-dark); color:white; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:var(--transition); margin-top:16px; }
  .screening-submit:disabled { opacity:0.35; cursor:not-allowed; }
  .screening-result { background:var(--card); border-radius:var(--radius); padding:28px; box-shadow:0 1px 8px rgba(0,0,0,0.05); margin-bottom:16px; }
  .screening-score-row { display:flex; align-items:flex-end; gap:12px; margin-bottom:4px; }
  .screening-score-num { font-family:'Playfair Display',serif; font-size:48px; line-height:1; }
  .screening-score-max { font-family:'DM Mono',monospace; font-size:14px; color:var(--ink-mute); margin-bottom:8px; }
  .screening-severity { font-size:13px; font-weight:500; margin-bottom:10px; }
  .screening-desc { font-size:13px; color:var(--ink-soft); line-height:1.7; }
  .screening-pro-rec { margin-top:20px; background:rgba(196,168,130,0.12); border:1.5px solid var(--slate); border-radius:var(--radius-sm); padding:16px 18px; }
  .screening-pro-rec-title { font-size:13px; font-weight:500; color:var(--slate-dark); margin-bottom:6px; }
  .screening-pro-rec-body { font-size:12px; color:var(--ink-soft); line-height:1.65; }
  .screening-crisis-rec { margin-top:12px; background:rgba(196,114,106,0.08); border:1.5px solid var(--error); border-radius:var(--radius-sm); padding:16px 18px; }
  .screening-crisis-title { font-size:13px; font-weight:500; color:var(--error); margin-bottom:6px; }
  .screening-crisis-body { font-size:12px; color:var(--ink-soft); line-height:1.65; }
  .screening-crisis-body a { color:var(--error); font-weight:500; }
  .screening-retake { margin-top:20px; background:none; border:1.5px solid var(--warm); border-radius:40px; padding:10px 24px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-mute); cursor:pointer; transition:var(--transition); }
  .screening-retake:hover { border-color:var(--teal-light); color:var(--teal-dark); }
  .ground-box-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0; }
  .ground-box-cell { background:var(--cream); border-radius:var(--radius-sm); padding:16px; text-align:center; }
  .ground-box-num { font-family:'Playfair Display',serif; font-size:28px; color:var(--teal-dark); }
  .ground-box-label { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); margin-top:2px; letter-spacing:0.5px; }
  .ground-quick { background:rgba(90,122,90,0.05); border:1px solid rgba(90,122,90,0.15); border-radius:var(--radius); padding:20px 22px; display:flex; align-items:flex-start; gap:14px; }
  .ground-quick-icon { font-size:24px; flex-shrink:0; }
  .ground-quick-title { font-family:'Playfair Display',serif; font-size:15px; color:var(--ink); margin-bottom:4px; }
  .ground-quick-desc { font-size:13px; color:var(--ink-mute); line-height:1.6; }
  .wellness-fact-card { margin-top:24px; padding:20px 22px; border-radius:var(--radius); background:rgba(196,168,130,0.08); border:1px solid rgba(196,168,130,0.2); }
  .wellness-fact-eyebrow { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--ink-soft); margin-bottom:10px; }
  .wellness-fact-text { font-size:13px; font-style:italic; color:var(--ink); line-height:1.65; }
  .wellness-fact-source { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); margin-top:8px; }

  /* AUTH */
  .auth-screen { min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .auth-card { background:var(--surface); border-radius:24px; padding:48px; max-width:420px; width:100%; box-shadow:0 4px 40px rgba(0,0,0,0.07); animation:fadeUp 0.5s ease both; }
  .auth-logo { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; color:var(--ink); text-align:center; margin-bottom:6px; }
  .auth-logo span { color:var(--teal-dark); font-style:italic; }
  .auth-tagline { text-align:center; font-size:13px; color:var(--ink-mute); margin-bottom:32px; }
  .auth-eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--teal-dark); margin-bottom:20px; text-align:center; }
  .auth-field { margin-bottom:14px; }
  .auth-label { display:block; font-size:12px; color:var(--ink-soft); margin-bottom:5px; font-weight:500; }
  .auth-input { width:100%; border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:11px 14px; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); background:var(--surface); outline:none; transition:var(--transition); }
  .auth-input:focus { border-color:var(--teal-light); box-shadow:0 0 0 3px var(--glow); }
  .auth-error { background:rgba(196,114,106,0.1); border:1px solid rgba(196,114,106,0.25); border-radius:var(--radius-sm); padding:10px 14px; font-size:13px; color:var(--error); margin-bottom:14px; line-height:1.4; }
  .auth-submit { width:100%; margin-top:6px; }
  .auth-toggle { text-align:center; margin-top:16px; font-size:13px; color:var(--ink-mute); }
  .auth-toggle button { background:none; border:none; color:var(--teal-dark); cursor:pointer; font-size:13px; font-family:'DM Sans',sans-serif; text-decoration:underline; text-underline-offset:2px; padding:0 2px; }
  .auth-toggle button:hover { color:var(--ink); }
  .auth-divider { display:flex; align-items:center; gap:12px; margin:20px 0; }
  .auth-divider::before, .auth-divider::after { content:''; flex:1; height:1px; background:var(--warm); }
  .auth-divider span { font-size:11px; color:var(--ink-mute); font-family:'DM Mono',monospace; letter-spacing:1px; }
  .auth-social { display:flex; flex-direction:column; gap:10px; }
  .auth-social-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:10px; border:1.5px solid var(--warm); border-radius:40px; padding:11px 20px; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); background:var(--surface); cursor:pointer; transition:var(--transition); }
  .auth-social-btn:hover { border-color:var(--teal-light); background:var(--cream); }
  .auth-social-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .auth-social-btn svg { flex-shrink:0; }

  /* POMODORO */
  .pomo-page { max-width:520px; margin:0 auto; padding:32px 0 80px; animation:fadeUp 0.5s ease both; }
  .pomo-timer-wrap { background:var(--card); border-radius:var(--radius); padding:40px 28px 32px; box-shadow:0 1px 8px rgba(0,0,0,0.05); text-align:center; margin-bottom:20px; }
  .pomo-mode-row { display:flex; gap:6px; justify-content:center; margin-bottom:32px; }
  .pomo-mode-btn { border:1.5px solid var(--warm); border-radius:40px; padding:7px 18px; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--ink-soft); background:var(--card); cursor:pointer; transition:var(--transition); }
  .pomo-mode-btn:hover { border-color:var(--teal-light); }
  .pomo-mode-btn.active { border-color:var(--teal-dark); background:rgba(90,122,90,0.07); color:var(--teal-dark); font-weight:500; }
  .pomo-ring-wrap { position:relative; width:200px; height:200px; margin:0 auto 28px; }
  .pomo-ring-svg { transform:rotate(-90deg); }
  .pomo-ring-bg { fill:none; stroke:var(--warm); stroke-width:8; }
  .pomo-ring-fill { fill:none; stroke-width:8; stroke-linecap:round; transition:stroke-dashoffset 1s linear, stroke 0.4s; }
  .pomo-ring-fill.work  { stroke:var(--teal-dark); }
  .pomo-ring-fill.short { stroke:var(--slate-dark); }
  .pomo-ring-fill.long  { stroke:var(--focus-blue); }
  .pomo-time-display { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .pomo-time { font-family:'DM Mono',monospace; font-size:40px; font-weight:300; color:var(--ink); letter-spacing:2px; line-height:1; }
  .pomo-mode-label { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); letter-spacing:1.5px; text-transform:uppercase; margin-top:6px; }
  .pomo-controls { display:flex; gap:10px; justify-content:center; align-items:center; margin-bottom:20px; }
  .pomo-btn-main { background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:12px 36px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:var(--transition); min-width:120px; }
  .pomo-btn-main:hover { background:var(--teal); transform:translateY(-1px); }
  .pomo-btn-reset { background:transparent; border:1.5px solid var(--warm); color:var(--ink-mute); border-radius:40px; padding:10px 20px; font-family:'DM Sans',sans-serif; font-size:13px; cursor:pointer; transition:var(--transition); }
  .pomo-btn-reset:hover { border-color:var(--teal-light); color:var(--ink); }
  .pomo-cycles { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); letter-spacing:0.5px; }
  .pomo-settings-card { background:var(--card); border-radius:var(--radius); padding:22px 24px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .pomo-settings-title { font-size:12px; font-weight:500; color:var(--ink-soft); margin-bottom:16px; }
  .pomo-settings-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  .pomo-setting-item { display:flex; flex-direction:column; gap:5px; }
  .pomo-setting-label { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); letter-spacing:0.5px; text-transform:uppercase; }
  .pomo-setting-input { border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:8px 10px; font-family:'DM Mono',monospace; font-size:14px; color:var(--ink); background:var(--surface); outline:none; transition:var(--transition); text-align:center; width:100%; }
  .pomo-setting-input:focus { border-color:var(--teal-light); }

  /* FEEDBACK */
  .feedback-page { max-width:560px; margin:0 auto; padding:32px 0 80px; animation:fadeUp 0.5s ease both; }
  .feedback-card { background:var(--card); border-radius:var(--radius); padding:32px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .feedback-type-row { display:flex; gap:8px; margin-bottom:24px; flex-wrap:wrap; }
  .feedback-type-btn { border:1.5px solid var(--warm); border-radius:40px; padding:8px 18px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-soft); background:var(--card); cursor:pointer; transition:var(--transition); }
  .feedback-type-btn:hover { border-color:var(--teal-light); }
  .feedback-type-btn.active { border-color:var(--teal-dark); background:rgba(90,122,90,0.07); color:var(--teal-dark); font-weight:500; }
  .feedback-field { margin-bottom:16px; }
  .feedback-label { display:block; font-size:12px; color:var(--ink-soft); margin-bottom:5px; font-weight:500; }
  .feedback-textarea { width:100%; border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:12px 14px; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); background:var(--surface); outline:none; resize:vertical; transition:var(--transition); min-height:110px; line-height:1.6; }
  .feedback-textarea:focus { border-color:var(--teal-light); box-shadow:0 0 0 3px var(--glow); }
  .feedback-input { width:100%; border:1.5px solid var(--warm); border-radius:var(--radius-sm); padding:11px 14px; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); background:var(--surface); outline:none; transition:var(--transition); }
  .feedback-input:focus { border-color:var(--teal-light); box-shadow:0 0 0 3px var(--glow); }
  .feedback-success { background:rgba(90,122,90,0.08); border:1px solid rgba(90,122,90,0.2); border-radius:var(--radius-sm); padding:16px; text-align:center; font-size:14px; color:var(--teal-dark); line-height:1.6; }
  .feedback-img-upload { border:1.5px dashed var(--warm); border-radius:var(--radius-sm); padding:14px 16px; display:flex; align-items:center; gap:12px; cursor:pointer; transition:var(--transition); background:var(--cream); }
  .feedback-img-upload:hover { border-color:var(--teal-light); background:rgba(90,122,90,0.04); }
  .feedback-img-label { font-size:13px; color:var(--ink-soft); }
  .feedback-img-preview { position:relative; display:inline-block; }
  .feedback-img-preview img { display:block; max-height:120px; max-width:100%; border-radius:var(--radius-sm); border:1px solid var(--warm); object-fit:contain; }
  .feedback-img-remove { position:absolute; top:-8px; right:-8px; width:20px; height:20px; border-radius:50%; background:var(--ink); color:white; border:none; font-size:12px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; }

  /* HISTORY */
  .history-page { padding:32px 0 80px; animation:fadeUp 0.5s ease both; }
  .history-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; color:var(--ink); margin-bottom:6px; }
  .history-title span { font-style:italic; color:var(--teal-dark); }
  .history-sub { font-size:14px; color:var(--ink-mute); margin-bottom:32px; }
  .history-loading { text-align:center; padding:60px 0; font-size:14px; color:var(--ink-mute); font-family:'DM Mono',monospace; }
  .history-empty { text-align:center; padding:60px 0; }
  .history-empty-icon { font-size:36px; margin-bottom:12px; }
  .history-empty-msg { font-size:14px; color:var(--ink-mute); }
  .history-day-card { background:var(--card); border-radius:var(--radius); padding:24px 28px; margin-bottom:16px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .history-day-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
  .history-day-date { font-family:'Playfair Display',serif; font-size:17px; color:var(--ink); }
  .history-day-badges { display:flex; gap:8px; flex-wrap:wrap; }
  .history-badge { font-size:11px; padding:3px 9px; border-radius:20px; font-family:'DM Mono',monospace; }
  .history-badge.energy-high      { background:rgba(90,122,90,0.12); color:var(--teal-dark); }
  .history-badge.energy-med       { background:rgba(196,168,130,0.2); color:var(--slate-dark); }
  .history-badge.energy-low       { background:rgba(196,114,106,0.12); color:var(--error); }
  .history-badge.energy-hibernate { background:rgba(106,138,170,0.15); color:var(--focus-blue); }
  .history-badge.shutdown { background:rgba(90,122,90,0.1); color:var(--teal-dark); }
  .history-badge.tasks { background:var(--warm); color:var(--ink-soft); }
  .history-badge.week-plan { background:rgba(106,138,170,0.12); color:var(--focus-blue); }
  .history-day-detail { font-size:13px; color:var(--ink-soft); line-height:1.7; }
  .history-detail-row { display:flex; gap:8px; margin-bottom:4px; }
  .history-detail-label { color:var(--ink-mute); font-family:'DM Mono',monospace; font-size:11px; min-width:70px; padding-top:1px; }
  .history-gratitude { font-size:13px; color:var(--ink-soft); padding-left:8px; border-left:2px solid var(--teal-light); line-height:1.6; margin-top:6px; }
  .history-journal-section { margin-top:24px; }
  .history-journal-entry { background:var(--card); border-radius:var(--radius); padding:20px 24px; margin-bottom:12px; box-shadow:0 1px 8px rgba(0,0,0,0.05); }
  .history-journal-text { font-size:14px; color:var(--ink); line-height:1.65; margin-bottom:8px; }
  .history-journal-time { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); }

  /* BOTTOM NAV */
  .bottom-nav { display:none; }
  @media (max-width:800px) {
    .grid-2 { grid-template-columns:1fr; }
    .cal-body { grid-template-columns:1fr; }
    .energy-options { grid-template-columns:1fr 1fr; }
    .profile-grid { grid-template-columns:1fr; }
    .onboard-feature-grid { grid-template-columns:1fr; }
    .nav { padding:16px 20px; padding-top:max(16px,env(safe-area-inset-top)); }
    .side-panel { gap:10px; order:-1; }
    .suggest-card { display:none; }
    .battery-panel { padding:12px 16px; display:flex; flex-direction:row; align-items:center; gap:12px; }
    .battery-panel-label { font-size:10px; flex-shrink:0; }
    .battery-panel-wrap { margin:0 !important; flex:1; display:flex; align-items:center; gap:10px; }
    .battery-panel-pct { font-size:20px; }
    .battery-panel-status { font-size:10px; margin-top:0; }
    .battery-panel-pct-row { display:none; }
    .battery-panel-wrap > svg, .battery-panel-wrap > * > svg { display:none; }
    .battery-shape-outer { display:none; }
    .readiness-card .battery-panel { padding:22px 24px; flex-direction:column; align-items:stretch; gap:0; }
    .readiness-card .battery-panel-label { font-size:11px; text-align:center; }
    .readiness-card .battery-panel-wrap { margin:10px 0 12px !important; align-items:center !important; justify-content:center !important; position:relative; padding-right:64px; }
    .readiness-card .battery-panel-wrap > div { text-align:center; }
    .readiness-card .battery-panel-pct { font-size:42px; }
    .readiness-card .battery-panel-status { font-size:10px; margin-top:8px; display:block; }
    .readiness-card .battery-panel-wrap > svg, .readiness-card .battery-panel-wrap > * > svg { display:block; position:absolute; right:0; top:50%; transform:translateY(-50%); }
    .readiness-card .battery-shape-outer { display:flex; }
    .week-strip-wrap { top:max(54px, calc(54px + env(safe-area-inset-top))); }
    .nav-tabs { display:none; }
    .nav-right .nav-profile-btn { display:none; }
    .main { padding:0 16px 90px; }
    .readiness-card { padding:32px 24px; }
    .onboard-card { padding:32px 24px; }
    .auth-card { padding:36px 28px; }

    .bottom-nav {
      display: flex;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      width: 100%;
      max-width: 100vw;
      overflow: hidden;
      background: var(--cream);
      border-top: 1px solid var(--warm);
      padding: 8px 0 max(12px, env(safe-area-inset-bottom));
      z-index: 100;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
    }
    [data-theme="dark"] .bottom-nav { box-shadow: 0 -4px 20px rgba(0,0,0,0.3); }
    .bottom-nav-item {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 2px;
      transition: var(--transition);
      color: var(--ink-mute);
    }
    .bottom-nav-item.active { color: var(--teal-dark); }
    .bottom-nav-item svg { width:22px; height:22px; stroke:currentColor; fill:none; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
    .bottom-nav-item.active svg { stroke-width:2.2; }
    .bottom-nav-label { font-family:'DM Sans',sans-serif; font-size:10px; font-weight:400; letter-spacing:0.2px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bottom-nav-item.active .bottom-nav-label { font-weight:600; }
  }

  /* ENERGY MAP */
  .emap-wrap { padding:4px 0; }
  .emap-legend { display:flex; align-items:center; gap:12px; margin-bottom:14px; font-size:12px; color:var(--ink-soft); flex-wrap:wrap; }
  .emap-legend-item { display:flex; align-items:center; gap:5px; }
  .emap-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .emap-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  @media(max-width:520px) { .emap-grid { grid-template-columns:repeat(2,1fr); } }
  .emap-block { display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:14px; border:1.5px solid; cursor:pointer; background:none; font-family:'DM Sans',sans-serif; transition:var(--transition); text-align:left; width:100%; }
  .emap-block:hover { transform:translateY(-1px); box-shadow:0 2px 10px rgba(0,0,0,0.07); }
  .emap-block:active { transform:translateY(0); }
  .emap-block-time { font-size:10px; font-family:'DM Mono',monospace; color:var(--ink-mute); flex:1; white-space:nowrap; line-height:1.3; }
  .emap-block-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .emap-block-level { font-size:11px; color:var(--ink-soft); font-weight:500; white-space:nowrap; }
  .emap-save-row { display:flex; align-items:center; justify-content:space-between; margin-top:14px; }
  .emap-saved-msg { font-size:11px; font-family:'DM Mono',monospace; color:var(--teal-dark); opacity:0; transition:opacity 0.4s; }
  .emap-saved-msg.visible { opacity:1; }

  /* ── TaskParalysisModal ──────────────────────────────────────────────────── */
  .tpm-overlay { position:fixed; inset:0; background:rgba(20,32,22,0.52); backdrop-filter:blur(6px); z-index:1200; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.25s ease both; }
  .tpm-card { background:var(--surface); border-radius:24px; padding:36px 40px; max-width:540px; width:100%; box-shadow:0 24px 72px rgba(0,0,0,0.14); max-height:90vh; overflow-y:auto; animation:fadeUp 0.3s ease both; }
  .tpm-eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--focus-blue); margin-bottom:8px; }
  .tpm-title { font-family:'Playfair Display',serif; font-size:22px; font-weight:400; color:var(--ink); line-height:1.35; margin-bottom:8px; }
  .tpm-task-name { font-size:13px; color:var(--ink-soft); margin-bottom:24px; font-family:'DM Mono',monospace; padding:6px 12px; background:rgba(106,138,170,0.08); border-radius:8px; border-left:3px solid var(--focus-blue); }
  .tpm-preview { font-size:14px; color:var(--ink); line-height:1.85; margin-bottom:24px; padding:14px 16px; background:rgba(90,122,90,0.05); border-radius:12px; border:1px solid rgba(90,122,90,0.12); }
  .tpm-preview em { color:var(--teal-dark); font-style:italic; font-weight:500; }
  .tpm-section { margin-bottom:22px; }
  .tpm-section-label { font-size:10px; font-family:'DM Mono',monospace; color:var(--focus-blue); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:8px; }
  .tpm-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:4px; }
  .tpm-chip { font-size:12px; padding:5px 13px; border-radius:20px; border:1.5px solid rgba(106,138,170,0.22); background:rgba(106,138,170,0.05); color:var(--ink-soft); cursor:pointer; transition:var(--transition); font-family:'DM Sans',sans-serif; }
  .tpm-chip:hover { border-color:var(--focus-blue); color:var(--focus-blue); }
  .tpm-chip.active { border-color:var(--teal-dark); background:rgba(90,122,90,0.1); color:var(--teal-dark); font-weight:500; }
  .tpm-chip.tpm-time { border-color:rgba(90,122,90,0.22); background:rgba(90,122,90,0.04); }
  .tpm-chip.tpm-time.active { border-color:var(--focus-blue); background:rgba(106,138,170,0.12); color:var(--focus-blue); font-weight:500; }
  .tpm-custom-input { background:transparent; border:none; border-bottom:1.5px solid rgba(106,138,170,0.28); outline:none; font-size:13px; font-family:'DM Sans',sans-serif; color:var(--ink); padding:3px 4px; width:200px; margin-top:6px; }
  .tpm-custom-input::placeholder { color:var(--ink-mute); }
  .tpm-actions { display:flex; gap:10px; margin-top:28px; }
  .tpm-btn-cancel { flex:1; padding:11px; border-radius:var(--radius-sm); border:1.5px solid var(--warm); background:var(--surface); color:var(--ink-mute); font-size:13px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); }
  .tpm-btn-cancel:hover { border-color:var(--teal-light); color:var(--ink-soft); }
  .tpm-btn-start { flex:2; padding:11px; border-radius:var(--radius-sm); border:none; background:var(--teal-dark); color:white; font-size:13px; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; transition:var(--transition); display:inline-flex; align-items:center; justify-content:center; gap:7px; }
  .tpm-btn-start:hover { background:#4a6a4a; }
  .tpm-btn-start:disabled { opacity:0.4; cursor:not-allowed; }
  .tpm-focus-overlay { position:fixed; inset:0; background:linear-gradient(155deg,#e6efe6 0%,#dce8f0 55%,#e6f0ec 100%); z-index:1300; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; animation:fadeIn 0.45s ease both; }
  .tpm-focus-eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--focus-blue); margin-bottom:28px; opacity:0.75; }
  .tpm-focus-action { font-family:'Playfair Display',serif; font-size:26px; font-weight:400; color:var(--ink); text-align:center; max-width:380px; line-height:1.55; margin-bottom:44px; }
  .tpm-focus-ring-wrap { position:relative; width:200px; height:200px; margin-bottom:36px; }
  .tpm-focus-ring-svg { transform:rotate(-90deg); }
  .tpm-focus-ring-bg { fill:none; stroke:rgba(106,138,170,0.16); stroke-width:10; }
  .tpm-focus-ring-fill { fill:none; stroke:var(--teal-dark); stroke-width:10; stroke-linecap:round; transition:stroke-dashoffset 1s linear; }
  .tpm-focus-time { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .tpm-focus-mm-ss { font-family:'Playfair Display',serif; font-size:46px; font-weight:400; color:var(--ink); line-height:1; }
  .tpm-focus-label { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); letter-spacing:1.5px; text-transform:uppercase; margin-top:6px; }
  .tpm-focus-controls { display:flex; gap:12px; align-items:center; }
  .tpm-focus-btn-pause { padding:10px 30px; border-radius:40px; border:1.5px solid rgba(90,122,90,0.35); background:rgba(90,122,90,0.09); color:var(--teal-dark); font-size:14px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); }
  .tpm-focus-btn-pause:hover { background:rgba(90,122,90,0.18); }
  .tpm-focus-btn-exit { padding:10px 18px; border-radius:40px; border:none; background:transparent; color:var(--ink-mute); font-size:13px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); }
  .tpm-focus-btn-exit:hover { color:var(--ink-soft); }
  .tpm-done-banner { text-align:center; animation:fadeUp 0.4s ease both; }
  .tpm-done-title { font-family:'Playfair Display',serif; font-size:34px; color:var(--teal-dark); margin-bottom:10px; }
  .tpm-done-sub { font-size:15px; color:var(--ink-soft); line-height:1.65; margin-bottom:16px; }
  .tpm-done-energy { font-family:'DM Mono',monospace; font-size:12px; color:var(--teal-dark); background:rgba(90,122,90,0.12); padding:6px 18px; border-radius:20px; display:inline-block; margin-bottom:32px; }
  .tpm-done-close { padding:12px 40px; border-radius:40px; border:none; background:var(--teal-dark); color:white; font-size:14px; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; transition:var(--transition); }
  .tpm-done-close:hover { background:#4a6a4a; }
  .task-btn-stuck { background:rgba(106,138,170,0.08); border:1px solid rgba(106,138,170,0.2); border-radius:12px; padding:3px 8px; font-size:10px; font-family:'DM Mono',monospace; color:var(--focus-blue); cursor:pointer; transition:var(--transition); white-space:nowrap; flex-shrink:0; }
  .task-btn-stuck:hover { background:rgba(106,138,170,0.18); border-color:var(--focus-blue); }

  /* ── AI COACH ── */
  .ai-fab { position:fixed; bottom:80px; right:16px; z-index:150; width:52px; height:52px; border-radius:50%; background:var(--teal-dark); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 4px 18px rgba(90,122,90,0.45); transition:transform 0.25s, box-shadow 0.2s; }
  .ai-fab:hover { transform:scale(1.08); box-shadow:0 6px 24px rgba(90,122,90,0.55); }
  .ai-fab:active { transform:scale(0.94); }
  .ai-fab.open { transform:rotate(45deg); }
  .ai-fab-pulse { animation:aiFabPulse 2.4s ease-in-out infinite; }
  @keyframes aiFabPulse { 0%,100%{box-shadow:0 4px 18px rgba(90,122,90,0.45)} 50%{box-shadow:0 4px 26px rgba(90,122,90,0.7), 0 0 0 8px rgba(90,122,90,0.08)} }
  .fab-backdrop { position:fixed; inset:0; z-index:148; }
  .fab-menu { position:fixed; bottom:144px; right:16px; z-index:149; display:flex; flex-direction:column; align-items:flex-end; gap:12px; }
  .fab-menu-item { display:flex; align-items:center; gap:10px; animation:fabItemIn 0.18s ease both; }
  .fab-menu-item:nth-child(1) { animation-delay:0.05s; }
  .fab-menu-item:nth-child(2) { animation-delay:0.02s; }
  .fab-menu-item:nth-child(3) { animation-delay:0s; }
  .fab-menu-item:nth-child(4) { animation-delay:0s; }
  @keyframes fabItemIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fab-menu-label { background:var(--ink); color:var(--cream); font-size:13px; font-family:'DM Sans',sans-serif; font-weight:500; padding:7px 14px; border-radius:20px; white-space:nowrap; box-shadow:0 2px 12px rgba(0,0,0,0.22); cursor:pointer; border:none; }
  [data-theme="dark"] .fab-menu-label { background:var(--surface); color:var(--ink); border:1px solid rgba(255,255,255,0.1); }
  .fab-menu-icon { width:42px; height:42px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; background:var(--teal-dark); color:white; box-shadow:0 2px 10px rgba(90,122,90,0.35); flex-shrink:0; }
  /* ── Priority flag ────────────────────────────────────────────────────────── */
  .priority-dot { display:inline-block; width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .priority-dot.urgent { background:#d94f4f; }
  .priority-dot.high   { background:#c8903a; }
  .priority-dot.low    { background:#7aabe0; }
  .task-priority-tag { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:0.5px; padding:1px 6px; border-radius:20px; font-weight:600; flex-shrink:0; }
  .task-priority-tag.urgent { background:rgba(217,79,79,0.12); color:#d94f4f; }
  .task-priority-tag.high   { background:rgba(200,144,58,0.12); color:#c8903a; }
  .task-priority-tag.low    { background:rgba(122,171,224,0.12); color:#5a8ab0; }
  [data-theme="dark"] .priority-dot.urgent { background:#e07070; }
  [data-theme="dark"] .priority-dot.high   { background:#d4923e; }
  [data-theme="dark"] .priority-dot.low    { background:#7ab8e0; }
  [data-theme="dark"] .task-priority-tag.urgent { background:rgba(224,112,112,0.15); color:#e07070; }
  [data-theme="dark"] .task-priority-tag.high   { background:rgba(212,146,62,0.15); color:#d4923e; }
  [data-theme="dark"] .task-priority-tag.low    { background:rgba(122,184,224,0.15); color:#7ab8e0; }
  .atm-urgency-row { display:flex; gap:8px; flex-wrap:wrap; }
  .atm-urgency-btn { flex:1; min-width:60px; padding:8px 4px; border:1.5px solid var(--warm); border-radius:10px; background:var(--surface); font-family:'DM Sans',sans-serif; font-size:12px; color:var(--ink-mute); cursor:pointer; transition:var(--transition); display:flex; align-items:center; justify-content:center; gap:5px; white-space:nowrap; }
  .atm-urgency-btn.urgent.active { border-color:#d94f4f; background:rgba(217,79,79,0.1); color:#d94f4f; font-weight:600; }
  .atm-urgency-btn.high.active   { border-color:#c8903a; background:rgba(200,144,58,0.1); color:#c8903a; font-weight:600; }
  .atm-urgency-btn.normal.active { border-color:var(--teal-light); background:rgba(90,122,90,0.08); color:var(--teal-dark); font-weight:600; }
  .atm-urgency-btn.low.active    { border-color:#7aabe0; background:rgba(122,171,224,0.1); color:#5a8ab0; font-weight:600; }
  [data-theme="dark"] .atm-urgency-btn.urgent.active { border-color:#e07070; background:rgba(224,112,112,0.12); color:#e07070; }
  [data-theme="dark"] .atm-urgency-btn.high.active   { border-color:#d4923e; background:rgba(212,146,62,0.12); color:#d4923e; }
  [data-theme="dark"] .atm-urgency-btn.low.active    { border-color:#7ab8e0; background:rgba(122,184,224,0.12); color:#7ab8e0; }

  /* ── Fumes mode ────────────────────────────────────────────────────────────── */
  [data-fumes="true"] { --error:#b86a30; }
  .fumes-banner { background:linear-gradient(135deg,rgba(200,144,58,0.12),rgba(200,100,58,0.08)); border-bottom:1.5px solid rgba(200,144,58,0.3); padding:10px 20px; padding-top:calc(10px + env(safe-area-inset-top, 0px)); display:flex; align-items:center; gap:12px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--slate-dark); }
  .fumes-banner-text { flex:1; line-height:1.4; }
  .fumes-banner-dismiss { background:none; border:none; font-size:18px; color:var(--slate-dark); opacity:0.6; cursor:pointer; padding:8px; line-height:1; flex-shrink:0; margin:-8px; }

  /* ── Streak display ────────────────────────────────────────────────────────── */
  .streak-badge { display:inline-flex; align-items:center; gap:4px; background:rgba(200,144,58,0.12); border-radius:20px; padding:3px 10px; font-family:'DM Mono',monospace; font-size:10px; color:var(--slate-dark); font-weight:600; letter-spacing:0.3px; }

  /* ── Feature recommendation center ────────────────────────────────────────── */
  .frec-wrap { background:var(--card); border-radius:var(--radius); padding:16px 18px; box-shadow:0 2px 12px var(--glow); margin-bottom:24px; }
  .frec-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .frec-title { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--ink-mute); }
  .frec-dismiss-all { background:none; border:none; font-size:11px; color:var(--ink-mute); cursor:pointer; font-family:'DM Mono',monospace; }
  .frec-item { display:flex; align-items:flex-start; gap:12px; padding:10px 0; border-top:1px solid var(--warm); }
  .frec-item:first-of-type { border-top:none; padding-top:0; }
  .frec-icon { width:32px; height:32px; border-radius:10px; background:rgba(90,122,90,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--teal-dark); }
  .frec-body { flex:1; min-width:0; }
  .frec-label { font-size:13px; font-weight:500; color:var(--ink); line-height:1.3; }
  .frec-desc { font-size:11px; color:var(--ink-mute); margin-top:3px; line-height:1.4; }
  .frec-actions { display:flex; gap:8px; margin-top:7px; }
  .frec-try-btn { font-size:11px; font-family:'DM Mono',monospace; background:var(--teal-dark); color:white; border:none; border-radius:20px; padding:4px 12px; cursor:pointer; transition:var(--transition); }
  .frec-skip-btn { font-size:11px; font-family:'DM Mono',monospace; background:none; border:1px solid var(--warm); border-radius:20px; padding:4px 12px; cursor:pointer; color:var(--ink-mute); transition:var(--transition); }

  /* ── Medication tracking ────────────────────────────────────────────────────── */
  .meds-wrap { padding:4px 0; }
  .meds-card { background:var(--card); border-radius:var(--radius); padding:16px; margin-bottom:12px; box-shadow:0 1px 8px var(--glow); }
  .meds-card-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
  .meds-color-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .meds-name { font-size:15px; font-weight:500; color:var(--ink); }
  .meds-dose { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); margin-left:4px; }
  .meds-streak-badge { margin-left:auto; font-family:'DM Mono',monospace; font-size:9px; color:var(--teal-dark); background:rgba(90,122,90,0.1); padding:2px 8px; border-radius:20px; }
  .meds-times { display:flex; gap:8px; flex-wrap:wrap; }
  .meds-time-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 14px; border-radius:12px; border:1.5px solid var(--warm); background:var(--card); cursor:pointer; transition:var(--transition); min-width:70px; }
  .meds-time-btn.taken { border-color:var(--teal-dark); background:rgba(90,122,90,0.1); }
  .meds-time-label { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); }
  .meds-time-btn.taken .meds-time-label { color:var(--teal-dark); font-weight:600; }
  .meds-check { width:18px; height:18px; border-radius:50%; border:1.5px solid var(--warm); display:flex; align-items:center; justify-content:center; color:transparent; }
  .meds-time-btn.taken .meds-check { background:var(--teal-dark); border-color:var(--teal-dark); color:white; }
  .meds-add-btn { width:100%; padding:13px; border:1.5px dashed var(--warm); border-radius:var(--radius); background:transparent; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-mute); cursor:pointer; transition:var(--transition); display:flex; align-items:center; justify-content:center; gap:6px; }
  .meds-add-btn:hover { border-color:var(--teal-light); color:var(--teal-dark); }
  .meds-archive-btn { background:none; border:none; font-size:11px; color:var(--ink-mute); cursor:pointer; margin-left:auto; padding:2px 6px; }
  .meds-empty { text-align:center; padding:28px; color:var(--ink-mute); font-family:'DM Mono',monospace; font-size:12px; }

  /* ── Elastic goals ──────────────────────────────────────────────────────────── */
  .goals-section { margin-bottom:16px; background:var(--card); border-radius:var(--radius); padding:16px 20px; box-shadow:0 2px 16px var(--glow); }
  .goals-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .goals-title { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--ink-mute); }
  .goals-add-btn { font-size:11px; font-family:'DM Mono',monospace; background:none; border:1px solid var(--warm); border-radius:20px; padding:3px 12px; color:var(--ink-mute); cursor:pointer; transition:var(--transition); }
  .goals-add-btn:hover { border-color:var(--teal-light); color:var(--teal-dark); }
  .goal-card { background:var(--cream); border-radius:var(--radius-sm); padding:16px; margin-bottom:10px; border:1px solid var(--warm); }
  .goal-card-header { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .goal-emoji { font-size:18px; line-height:1; }
  .goal-name { font-size:14px; font-weight:500; color:var(--ink); flex:1; }
  .goal-streak { font-family:'DM Mono',monospace; font-size:10px; color:var(--teal-dark); background:rgba(90,122,90,0.1); padding:2px 8px; border-radius:20px; }
  .goal-range { margin:4px 0 10px; }
  .goal-range-labels { display:flex; justify-content:space-between; font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); margin-bottom:5px; }
  .goal-range-track { position:relative; height:6px; background:var(--warm); border-radius:3px; cursor:pointer; }
  .goal-range-fill { position:absolute; left:0; top:0; height:100%; background:var(--teal-dark); border-radius:3px; transition:width 0.2s; }
  .goal-range-thumb { position:absolute; top:50%; transform:translate(-50%,-50%); width:16px; height:16px; border-radius:50%; background:var(--teal-dark); box-shadow:0 1px 4px rgba(0,0,0,0.18); cursor:grab; transition:left 0.2s; }
  .goal-range-thumb:active { cursor:grabbing; }
  .goal-log-btn { width:100%; padding:10px; border:1.5px solid var(--teal-light); border-radius:40px; background:transparent; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--teal-dark); cursor:pointer; transition:var(--transition); }
  .goal-log-btn.logged { background:rgba(90,122,90,0.12); border-color:var(--teal-dark); font-weight:500; }
  .goal-log-btn:hover { background:rgba(90,122,90,0.08); }
  .goal-add-modal { position:fixed; inset:0; z-index:400; background:rgba(0,0,0,0.45); display:flex; align-items:flex-end; }
  .goal-add-sheet { background:var(--cream); border-radius:24px 24px 0 0; padding:28px 20px 40px; width:100%; max-height:80vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }


  /* ── Calendar events section ─────────────────────────────────────────────── */
  .cal-section { background:var(--card); border-radius:var(--radius); padding:16px 18px; box-shadow:0 2px 12px rgba(0,0,0,0.07); margin-bottom:14px; }
  .cal-section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .cal-section-title { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--ink-mute); display:flex; align-items:center; gap:6px; }
  .cal-connect-btn { font-size:11px; font-family:'DM Mono',monospace; background:none; border:1px solid var(--teal-light); border-radius:20px; padding:3px 12px; color:var(--teal-dark); cursor:pointer; transition:var(--transition); }
  .cal-connect-btn:hover { background:rgba(90,122,90,0.08); }
  .cal-event-row { display:flex; align-items:flex-start; gap:10px; padding:7px 0; border-bottom:1px solid var(--warm); }
  .cal-event-row:last-child { border-bottom:none; }
  .cal-event-time { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); min-width:44px; margin-top:2px; }
  .cal-event-dot { width:6px; height:6px; border-radius:50%; background:var(--teal-dark); flex-shrink:0; margin-top:5px; }
  .cal-event-name { font-size:13px; color:var(--ink); flex:1; line-height:1.35; }
  .cal-event-allday { font-family:'DM Mono',monospace; font-size:9px; color:var(--ink-mute); background:var(--warm); padding:1px 6px; border-radius:20px; flex-shrink:0; margin-top:2px; }
  .cal-event.cal-event-device { background:rgba(90,122,170,0.1); border-left:3px solid rgba(90,122,170,0.5); pointer-events:none; }
  [data-theme="dark"] .cal-event.cal-event-device { background:rgba(90,122,200,0.15); border-left-color:rgba(120,150,220,0.5); }
  .cal-empty { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); text-align:center; padding:12px 0; }
  .cal-permission-prompt { text-align:center; padding:8px 0 4px; }
  .cal-permission-btn { font-size:12px; font-family:'DM Sans',sans-serif; font-weight:500; background:var(--teal-dark); color:white; border:none; border-radius:20px; padding:8px 18px; cursor:pointer; }
  .cal-permission-sub { font-size:11px; color:var(--ink-mute); margin-top:6px; font-family:'DM Mono',monospace; }

  /* ── Swipe-to-defer (shutdown) ───────────────────────────────────────────── */
  .shutdown-undone { margin-bottom:18px; }
  .shutdown-undone-label { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,0.6); margin-bottom:10px; }
  .swipe-task-wrap { position:relative; overflow:hidden; border-radius:12px; margin-bottom:6px; }
  .swipe-task-hint-right { position:absolute; inset:0; display:flex; align-items:center; padding:0 16px; background:rgba(90,140,90,0.35); color:rgba(255,255,255,0.9); font-size:12px; font-family:'DM Mono',monospace; gap:6px; }
  .swipe-task-hint-left  { position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-end; padding:0 16px; background:rgba(200,80,80,0.35); color:rgba(255,255,255,0.9); font-size:12px; font-family:'DM Mono',monospace; gap:6px; }
  .swipe-task-card { position:relative; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:11px 14px; font-size:13px; color:rgba(255,255,255,0.8); display:flex; align-items:center; gap:10px; cursor:grab; user-select:none; touch-action:pan-y; will-change:transform; }
  .shutdown-defer-all { width:100%; padding:9px; border:1px solid rgba(255,255,255,0.15); border-radius:40px; background:none; color:rgba(255,255,255,0.6); font-size:11px; font-family:'DM Mono',monospace; cursor:pointer; transition:all 0.2s; margin-top:4px; letter-spacing:0.4px; }
  .shutdown-defer-all:hover { color:rgba(255,255,255,0.7); border-color:rgba(255,255,255,0.3); }

  /* ── Milestone toast / badge shelf ─────────────────────────────────────────── */
  .badge-shelf { display:flex; gap:10px; flex-wrap:wrap; padding:4px 0; }
  .badge-chip { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 12px; background:var(--card); border-radius:12px; border:1.5px solid var(--warm); min-width:64px; }
  .badge-chip.earned { border-color:var(--teal-light); background:rgba(90,122,90,0.06); }
  .badge-chip.locked { opacity:0.38; }
  .badge-icon { font-size:20px; line-height:1; }
  .badge-name { font-family:'DM Mono',monospace; font-size:9px; color:var(--ink-mute); text-align:center; letter-spacing:0.3px; }
  .badge-chip.earned .badge-name { color:var(--teal-dark); }

  /* Shared: plain sentence-case section label (replaces tiny spaced-out mono caps) */
  .plain-label { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; color:var(--ink-soft); margin-bottom:10px; }
  .guest-note { display:flex; align-items:center; gap:12px; padding:10px 0; margin-bottom:8px; border-bottom:1px solid var(--line); font-family:'DM Sans',sans-serif; font-size:13px; line-height:1.5; color:var(--ink-mute); }
  .guest-note-text { flex:1; }
  .guest-note-link { background:none; border:none; padding:6px 0; font-family:inherit; font-size:13px; font-weight:500; color:var(--teal-dark); cursor:pointer; white-space:nowrap; }
  .guest-note-close { background:none; border:none; padding:6px; font-size:18px; line-height:1; color:var(--ink-mute); cursor:pointer; }

  /* Node view */
  .node-view { padding:8px 0 24px; }
  .node-header { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:18px; }
  .node-add-link { background:none; border:none; color:var(--teal-dark); font-size:14px; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:500; padding:0; }
  .node-view-title { font-family:'Playfair Display',serif; font-size:26px; font-weight:400; color:var(--ink); letter-spacing:-0.3px; }
  .node-view-sub { font-size:13px; color:var(--ink-mute); margin-top:4px; }
  .node-capture { margin-bottom:24px; }
  .node-textarea { width:100%; border:1.5px solid var(--warm); border-radius:12px; padding:14px; font-size:14px; font-family:'DM Sans',sans-serif; color:var(--ink); background:var(--surface); resize:none; outline:none; line-height:1.65; }
  .node-textarea:focus { border-color:var(--teal-light); }
  .node-actions { display:flex; gap:10px; margin-top:12px; }
  .node-btn-ai { flex:1; background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:12px; font-size:13px; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
  .node-btn-add { background:var(--warm); color:var(--ink); border:none; border-radius:40px; padding:12px 18px; font-size:13px; font-family:'DM Sans',sans-serif; cursor:pointer; }
  .node-btn-add:disabled, .node-btn-ai:disabled { opacity:0.45; cursor:default; }
  .node-list-label { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--ink-mute); margin-bottom:12px; }
  .node-task-row { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--card); border-radius:var(--radius-sm); margin-bottom:6px; border:1px solid var(--warm); }
  .node-task-check { background:none; border:1.5px solid var(--teal-light); border-radius:50%; width:20px; height:20px; flex-shrink:0; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--teal-dark); transition:var(--transition); }
  .node-task-check:hover { background:var(--teal-light); }
  .node-task-name { flex:1; font-size:13px; color:var(--ink-soft); }
  .node-task-bucket { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); padding:2px 8px; border-radius:20px; background:var(--warm); flex-shrink:0; }
  .node-task-del { background:none; border:none; color:var(--ink-mute); cursor:pointer; font-size:18px; line-height:1; padding:2px 5px; border-radius:4px; transition:var(--transition); flex-shrink:0; }
  .node-task-del:hover { color:var(--error); background:rgba(168,85,80,0.08); }
  .node-empty { text-align:center; padding:36px; color:var(--ink-mute); font-size:13px; font-family:'DM Mono',monospace; letter-spacing:0.5px; }

  /* Brain dump modal */
  .bdump-overlay { position:fixed; inset:var(--vv-top,0px) 0 auto 0; height:var(--vv-height,100%); overflow-y:auto; overscroll-behavior:contain; z-index:300; background:rgba(0,0,0,0.45); display:flex; align-items:flex-end; }
  .bdump-sheet { background:var(--cream); border-radius:24px 24px 0 0; padding:28px 20px 40px; width:100%; max-height:min(85%, calc(100% - env(safe-area-inset-top) - 12px)); overflow-y:auto; overscroll-behavior:contain; display:flex; flex-direction:column; gap:14px; }
  .bdump-header { display:flex; align-items:center; justify-content:space-between; }
  .bdump-title { font-family:'Playfair Display',serif; font-size:20px; font-weight:700; color:var(--ink); }
  .bdump-sub { font-size:13px; color:var(--ink-mute); line-height:1.5; }
  .bdump-textarea { flex:1; min-height:160px; max-height:300px; border:1.5px solid var(--warm); border-radius:14px; padding:14px; font-size:14px; font-family:'DM Sans',sans-serif; color:var(--ink); background:var(--surface); resize:none; outline:none; line-height:1.6; }
  .bdump-textarea:focus { border-color:var(--teal-light); }
  .bdump-actions { display:flex; gap:10px; }
  .bdump-btn-ai { flex:1; background:var(--teal-dark); color:white; border:none; border-radius:40px; padding:13px; font-size:14px; font-family:'DM Sans',sans-serif; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
  .bdump-btn-save { background:var(--warm); color:var(--ink); border:none; border-radius:40px; padding:13px 18px; font-size:14px; font-family:'DM Sans',sans-serif; cursor:pointer; }
  .ai-panel-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.38); z-index:300; display:flex; align-items:flex-end; animation:fadeIn 0.2s ease; }
  .ai-panel { background:rgba(250,249,245,0.97); backdrop-filter:blur(22px) saturate(1.5); -webkit-backdrop-filter:blur(22px) saturate(1.5); border:1px solid rgba(210,205,192,0.7); border-bottom:none; border-radius:24px 24px 0 0; width:100%; max-width:480px; margin:0 auto; max-height:82dvh; display:flex; flex-direction:column; animation:slideUp 0.3s cubic-bezier(0.32,0.72,0,1); overflow:hidden; box-shadow:0 -8px 40px rgba(90,122,90,0.13), 0 -2px 12px rgba(0,0,0,0.05); }
  .ai-panel-header { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 14px; border-bottom:1.5px solid rgba(210,205,192,0.8); flex-shrink:0; }
  .ai-panel-title { font-family:'DM Sans',sans-serif; font-weight:600; font-size:15px; color:var(--ink); display:flex; align-items:center; gap:8px; }
  .ai-panel-close { background:none; border:none; font-size:22px; color:var(--ink-mute); cursor:pointer; line-height:1; padding:0 2px; transition:var(--transition); }
  .ai-panel-close:hover { color:var(--ink); }
  .ai-panel-messages { flex:1; overflow-y:auto; padding:16px 20px; display:flex; flex-direction:column; gap:10px; scroll-behavior:smooth; }
  .ai-message { max-width:85%; padding:10px 14px; border-radius:18px; font-size:14px; line-height:1.6; font-family:'DM Sans',sans-serif; }
  .ai-message-user { align-self:flex-end; background:var(--teal-dark); color:white; border-bottom-right-radius:5px; }
  .ai-message-assistant { align-self:flex-start; background:rgba(228,224,212,0.85); color:var(--ink); border-bottom-left-radius:5px; }
  .ai-message-loading { display:flex; gap:5px; align-items:center; padding:12px 16px; }
  .ai-message-loading span { width:7px; height:7px; border-radius:50%; background:var(--ink-mute); animation:aiDot 1.2s infinite ease-in-out; }
  .ai-message-loading span:nth-child(2){ animation-delay:0.2s; }
  .ai-message-loading span:nth-child(3){ animation-delay:0.4s; }
  @keyframes aiDot { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }
  .ai-chips { display:flex; flex-wrap:wrap; gap:7px; padding:4px 20px 14px; flex-shrink:0; }
  .ai-chip { background:rgba(90,122,90,0.1); border:1.5px solid rgba(90,122,90,0.38); border-radius:20px; padding:6px 13px; font-size:13px; font-family:'DM Sans',sans-serif; color:var(--teal-dark); cursor:pointer; transition:var(--transition); font-weight:500; }
  .ai-chip:hover { background:rgba(90,122,90,0.2); border-color:rgba(90,122,90,0.6); }
  [data-theme="dark"] .ai-add-tasks-no { border-color:var(--control-line); }
  [data-theme="dark"] .ai-panel { background:rgba(27,31,29,0.97); border-color:var(--line); box-shadow:0 -8px 40px rgba(0,0,0,0.5); }
  [data-theme="dark"] .ai-panel-header, [data-theme="dark"] .ai-panel-input-row { border-color:var(--line); }
  [data-theme="dark"] .ai-message-assistant { background:#262c29; color:var(--ink); }
  [data-theme="dark"] .ai-panel-input { background:#262c29; border-color:var(--control-line); color:var(--ink); }
  [data-theme="dark"] .ai-panel-input:focus { background:var(--surface); border-color:var(--teal-dark); }
  .ai-panel-input-row { display:flex; gap:10px; align-items:center; padding:12px 20px max(18px,env(safe-area-inset-bottom)); border-top:1.5px solid rgba(210,205,192,0.8); flex-shrink:0; }
  .ai-panel-input { flex:1; background:rgba(228,224,212,0.6); border:1.5px solid rgba(190,185,170,0.6); border-radius:40px; padding:10px 16px; font-size:14px; font-family:'DM Sans',sans-serif; color:var(--ink); outline:none; transition:var(--transition); }
  .ai-panel-input:focus { border-color:rgba(90,122,90,0.5); background:var(--surface); }
  .ai-panel-input::placeholder { color:var(--ink-mute); }
  .ai-send-btn { width:40px; height:40px; border-radius:50%; background:var(--teal-dark); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:white; flex-shrink:0; transition:var(--transition); }
  .ai-send-btn:hover { background:#4a6a4a; }
  .ai-send-btn:disabled { opacity:0.38; cursor:not-allowed; }
  .ai-context-badge { display:inline-flex; align-items:center; gap:5px; font-family:'DM Mono',monospace; font-size:10px; color:var(--teal-dark); background:rgba(90,122,90,0.1); padding:3px 9px; border-radius:20px; }
  .ai-add-tasks-card { margin:6px 0 4px; background:var(--card); border:1.5px solid rgba(90,122,90,0.25); border-radius:14px; padding:12px 14px; animation:fadeUp 0.2s ease; max-width:85%; }
  .ai-add-tasks-label { font-size:13px; font-weight:500; color:var(--ink); margin-bottom:10px; font-family:'DM Sans',sans-serif; }
  .ai-add-tasks-list { display:flex; flex-direction:column; gap:5px; margin-bottom:12px; }
  .ai-add-tasks-item { display:flex; align-items:flex-start; gap:7px; font-size:13px; color:var(--ink-soft); font-family:'DM Sans',sans-serif; line-height:1.4; }
  .ai-add-tasks-dot { width:5px; height:5px; border-radius:50%; background:var(--teal-dark); flex-shrink:0; margin-top:5px; }
  .ai-add-tasks-actions { display:flex; gap:8px; }
  .ai-add-tasks-yes { flex:1; background:var(--teal-dark); color:white; border:none; border-radius:20px; padding:8px 14px; font-size:13px; font-family:'DM Sans',sans-serif; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:var(--transition); }
  .ai-add-tasks-yes:hover { background:#4a6a4a; }
  .ai-add-tasks-no { background:none; border:1.5px solid rgba(0,0,0,0.1); border-radius:20px; padding:8px 14px; font-size:13px; font-family:'DM Sans',sans-serif; color:var(--ink-mute); cursor:pointer; transition:var(--transition); }
  .ai-add-tasks-no:hover { border-color:rgba(0,0,0,0.2); color:var(--ink-soft); }
  .ai-add-tasks-done { display:flex; align-items:center; font-size:12px; color:var(--teal-dark); font-family:'DM Sans',sans-serif; margin:6px 0 4px; padding:6px 10px; background:rgba(90,122,90,0.08); border-radius:20px; width:fit-content; }
  /* ── SCHEDULE GENERATOR ── */
  .sched-mode-toggle { display:flex; gap:4px; background:var(--warm); border-radius:20px; padding:3px; flex-shrink:0; }
  .sched-mode-btn { background:none; border:none; border-radius:16px; padding:4px 12px; font-size:12px; font-family:'DM Sans',sans-serif; color:var(--ink-mute); cursor:pointer; transition:var(--transition); white-space:nowrap; }
  .sched-mode-btn.active { background:var(--card); color:var(--ink); font-weight:500; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  .sched-input-area { flex:1; overflow-y:auto; padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
  .sched-textarea { width:100%; min-height:110px; background:var(--warm); border:1.5px solid transparent; border-radius:14px; padding:12px 14px; font-size:14px; font-family:'DM Sans',sans-serif; color:var(--ink); outline:none; resize:none; transition:var(--transition); box-sizing:border-box; line-height:1.6; }
  .sched-textarea:focus { border-color:rgba(90,122,90,0.4); background:var(--surface); }
  .sched-textarea::placeholder { color:var(--ink-mute); }
  .sched-hint { font-size:12px; color:var(--ink-mute); font-family:'DM Sans',sans-serif; line-height:1.5; }
  .sched-hint strong { color:var(--ink-soft); font-weight:500; }
  .sched-generate-btn { width:100%; padding:12px; background:var(--teal-dark); color:white; border:none; border-radius:12px; font-size:14px; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; transition:var(--transition); display:flex; align-items:center; justify-content:center; gap:8px; }
  .sched-generate-btn:hover { background:#4a6a4a; }
  .sched-generate-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .sched-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:40px 20px; color:var(--ink-mute); font-size:14px; font-family:'DM Sans',sans-serif; }
  .sched-loading-dots { display:flex; gap:6px; }
  .sched-loading-dots span { width:8px; height:8px; border-radius:50%; background:var(--teal-dark); animation:aiDot 1.2s infinite ease-in-out; }
  .sched-loading-dots span:nth-child(2){ animation-delay:0.2s; }
  .sched-loading-dots span:nth-child(3){ animation-delay:0.4s; }
  .sched-preview { flex:1; overflow-y:auto; padding:16px 20px; }
  .sched-summary { font-size:13px; color:var(--ink-soft); line-height:1.6; font-family:'DM Sans',sans-serif; background:rgba(90,122,90,0.07); border-radius:10px; padding:10px 13px; margin-bottom:14px; }
  .sched-task-list { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
  .sched-task-card { background:var(--card); border:1.5px solid var(--warm); border-radius:12px; padding:10px 13px; }
  .sched-task-card.must  { border-left:3px solid var(--error); }
  .sched-task-card.should{ border-left:3px solid var(--slate-dark); }
  .sched-task-card.could { border-left:3px solid var(--teal-light); }
  .sched-task-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:5px; }
  .sched-task-name { font-size:14px; font-weight:500; color:var(--ink); flex:1; }
  .sched-task-time { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); flex-shrink:0; }
  .sched-task-meta { display:flex; gap:6px; flex-wrap:wrap; }
  .sched-tag { display:inline-flex; align-items:center; gap:3px; font-family:'DM Mono',monospace; font-size:10px; padding:2px 7px; border-radius:10px; }
  .sched-tag.bucket-must   { background:rgba(196,114,106,0.1); color:var(--error); }
  .sched-tag.bucket-should { background:rgba(196,168,130,0.15); color:var(--slate-dark); }
  .sched-tag.bucket-could  { background:rgba(90,122,90,0.1); color:var(--teal-dark); }
  .sched-tag.duration { background:var(--warm); color:var(--ink-mute); }
  .sched-tag.energy-drain  { background:rgba(196,114,106,0.08); color:var(--error); }
  .sched-tag.energy-charge { background:rgba(90,122,90,0.1); color:var(--teal-dark); }
  .sched-subtasks { margin-top:7px; padding-left:10px; border-left:2px solid var(--warm); display:flex; flex-direction:column; gap:3px; }
  .sched-subtask { font-size:12px; color:var(--ink-mute); display:flex; align-items:center; gap:5px; }
  .sched-subtask::before { content:"·"; color:var(--teal-light); font-size:16px; line-height:1; }
  .sched-footer { display:flex; gap:8px; align-items:center; padding:0 20px max(16px,env(safe-area-inset-bottom)); flex-shrink:0; border-top:1px solid var(--warm); padding-top:12px; }
  .sched-projection { font-family:'DM Mono',monospace; font-size:11px; color:var(--ink-mute); flex:1; }
  .sched-projection strong { color:var(--teal-dark); }
  .sched-add-all { flex:2; padding:10px; background:var(--teal-dark); color:white; border:none; border-radius:20px; font-size:13px; font-family:'DM Sans',sans-serif; font-weight:500; cursor:pointer; transition:var(--transition); }
  .sched-add-all:hover { background:#4a6a4a; }
  .sched-retry { flex:1; padding:10px; background:none; border:1.5px solid rgba(90,122,90,0.3); border-radius:20px; font-size:13px; font-family:'DM Sans',sans-serif; color:var(--teal-dark); cursor:pointer; transition:var(--transition); }
  .sched-retry:hover { background:rgba(90,122,90,0.07); }

  /* ── Jumpstart Mode ──────────────────────────────────────────────────── */
  .jumpstart-overlay { position:fixed; inset:0; z-index:500; background:rgba(18,28,18,0.82); display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.3s ease; backdrop-filter:blur(4px); }
  .jumpstart-card { background:var(--surface); border-radius:28px; padding:36px 28px 28px; max-width:380px; width:100%; text-align:center; position:relative; box-shadow:0 24px 60px rgba(0,0,0,0.22); }
  .jumpstart-progress { display:flex; justify-content:center; gap:7px; margin-bottom:28px; }
  .jumpstart-dot { width:7px; height:7px; border-radius:50%; background:rgba(90,122,90,0.18); transition:all 0.35s ease; }
  .jumpstart-dot.done { background:var(--teal-dark); opacity:0.45; }
  .jumpstart-dot.active { background:var(--teal-dark); width:22px; border-radius:4px; }
  .jumpstart-eyebrow { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1.4px; text-transform:uppercase; color:var(--teal-dark); opacity:0.7; margin-bottom:18px; }
  .jumpstart-emoji { margin-bottom:18px; display:flex; align-items:center; justify-content:center; animation:fadeUp 0.3s ease; }
  .jumpstart-title { font-size:22px; font-weight:600; color:var(--ink); margin-bottom:10px; animation:fadeUp 0.3s ease 0.05s both; }
  .jumpstart-instruction { font-size:15px; color:var(--ink-soft); line-height:1.65; margin-bottom:24px; animation:fadeUp 0.3s ease 0.1s both; }
  .jumpstart-boost-flash { font-size:18px; font-weight:700; color:var(--teal-dark); font-family:'DM Mono',monospace; margin-bottom:14px; animation:jumpBoost 0.5s ease; }
  @keyframes jumpBoost { 0%{transform:scale(0.7);opacity:0} 50%{transform:scale(1.18);opacity:1} 100%{transform:scale(1);opacity:1} }
  .jumpstart-done-btn { width:100%; padding:16px; background:var(--teal-dark); color:white; border:none; border-radius:18px; font-size:16px; font-family:'DM Sans',sans-serif; font-weight:600; cursor:pointer; transition:var(--transition); margin-bottom:10px; letter-spacing:0.2px; }
  .jumpstart-done-btn:hover { background:#4a6a4a; }
  .jumpstart-done-btn:active { transform:scale(0.97); }
  .jumpstart-skip-btn { background:none; border:none; font-size:13px; color:var(--ink-mute); font-family:'DM Sans',sans-serif; cursor:pointer; padding:6px; opacity:0.7; }
  .jumpstart-skip-btn:hover { opacity:1; }
  .jumpstart-done-emoji { margin-bottom:20px; display:flex; align-items:center; justify-content:center; }
  .jumpstart-done-title { font-size:26px; font-weight:700; color:var(--ink); margin-bottom:12px; }
  .jumpstart-done-body { font-size:15px; color:var(--ink-soft); line-height:1.65; margin-bottom:28px; }
  .jumpstart-close-btn { width:100%; padding:16px; background:var(--teal-dark); color:white; border:none; border-radius:18px; font-size:16px; font-family:'DM Sans',sans-serif; font-weight:600; cursor:pointer; transition:var(--transition); }
  .jumpstart-close-btn:hover { background:#4a6a4a; }
  .jumpstart-trigger-btn { display:block; margin:12px auto 0; background:none; border:none; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--teal-dark); cursor:pointer; transition:var(--transition); letter-spacing:0.2px; opacity:0.75; text-decoration:underline; text-underline-offset:3px; }
  .jumpstart-trigger-btn:hover { opacity:1; }

  .btn-ai-breakdown { background:none; border:1.5px solid rgba(90,122,90,0.28); border-radius:8px; padding:6px 9px; cursor:pointer; color:var(--teal-dark); display:flex; align-items:center; justify-content:center; transition:var(--transition); flex-shrink:0; }
  .btn-ai-breakdown:hover { background:rgba(90,122,90,0.1); border-color:var(--teal-dark); }
  .btn-ai-breakdown.spinning svg { animation:spin 0.9s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .ai-breakdown-card { background:rgba(90,122,90,0.05); border:1px solid rgba(90,122,90,0.18); border-radius:12px; padding:12px 14px; margin-top:8px; animation:fadeUp 0.25s ease; }
  .ai-breakdown-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .ai-breakdown-label { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:1.2px; text-transform:uppercase; color:var(--teal-dark); }
  .ai-breakdown-dismiss { background:none; border:none; font-size:16px; color:var(--ink-mute); cursor:pointer; line-height:1; padding:0; }
  .ai-breakdown-list { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
  .ai-breakdown-item { display:flex; align-items:center; gap:8px; background:var(--card); border-radius:8px; padding:8px 10px; border:1px solid rgba(90,122,90,0.1); }
  .ai-breakdown-item-name { font-size:13px; color:var(--ink); flex:1; line-height:1.4; }
  .ai-breakdown-add-one { font-size:11px; font-family:'DM Mono',monospace; color:var(--teal-dark); background:rgba(90,122,90,0.1); border:none; border-radius:20px; padding:3px 10px; cursor:pointer; flex-shrink:0; transition:var(--transition); white-space:nowrap; }
  .ai-breakdown-add-one:hover { background:rgba(90,122,90,0.22); }
  .ai-breakdown-add-one.added { background:rgba(90,122,90,0.2); color:var(--teal-dark); opacity:0.5; cursor:default; }
  .ai-breakdown-footer { display:flex; gap:8px; }
  .ai-breakdown-add-all { flex:1; padding:8px; background:var(--teal-dark); color:white; border:none; border-radius:8px; font-size:13px; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); }
  .ai-breakdown-add-all:hover { background:#4a6a4a; }
  .ai-breakdown-retry { padding:8px 14px; background:none; border:1.5px solid rgba(90,122,90,0.3); border-radius:8px; font-size:13px; font-family:'DM Sans',sans-serif; color:var(--teal-dark); cursor:pointer; transition:var(--transition); }
  .ai-breakdown-retry:hover { background:rgba(90,122,90,0.08); }

  /* ── Stern Mode ────────────────────────────────────────────────────────────── */
  .stern-mode-bar { background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%); border-bottom:2px solid #4f46e5; color:white; padding:7px 20px; display:flex; align-items:center; justify-content:space-between; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:0.06em; }
  @media (max-width:800px) {
    .stern-mode-bar { padding:14px 20px; font-size:12px; }
    .stern-mode-bar-exit { font-size:12px; padding:8px 18px; }
  }
  .stern-mode-bar-label { display:flex; align-items:center; gap:7px; font-weight:500; opacity:0.95; }
  .stern-mode-bar-exit { background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); border-radius:20px; color:white; font-family:'DM Mono',monospace; font-size:10px; padding:3px 12px; cursor:pointer; letter-spacing:0.05em; transition:background 0.15s; }
  .stern-mode-bar-exit:hover { background:rgba(255,255,255,0.22); }
  .stern-mode-badge { display:inline-flex; align-items:center; gap:5px; background:rgba(79,70,229,0.12); border:1.5px solid rgba(79,70,229,0.35); border-radius:20px; padding:2px 10px; font-family:'DM Mono',monospace; font-size:10px; color:#4f46e5; font-weight:500; letter-spacing:0.05em; vertical-align:middle; }
  .task-item.stern-overdue { border-left:3px solid #4f46e5; background:rgba(79,70,229,0.03); }
  .task-item.stern-overdue .task-name { font-weight:500; color:#1e1b4b; }
  .tag-stern-overdue { background:rgba(79,70,229,0.1) !important; color:#4f46e5 !important; border:1px solid rgba(79,70,229,0.25) !important; }
  /* Pre-task & post-task modals */
  .stern-modal-overlay { position:fixed; inset:0; background:rgba(30,27,75,0.55); backdrop-filter:blur(4px); z-index:1200; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.18s ease; }
  .stern-modal { background:var(--surface); border-radius:20px; padding:28px 28px 22px; max-width:400px; width:100%; border:2px solid rgba(79,70,229,0.2); box-shadow:0 20px 60px rgba(30,27,75,0.2),0 4px 16px rgba(30,27,75,0.1); animation:slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1); }
  .stern-modal-eyebrow { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:#4f46e5; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
  .stern-modal-title { font-family:'DM Sans',sans-serif; font-size:18px; font-weight:500; color:#1e1b4b; margin-bottom:8px; line-height:1.3; }
  .stern-modal-task { font-family:'DM Mono',monospace; font-size:12px; color:var(--ink-mute); margin-bottom:20px; padding:8px 12px; background:rgba(79,70,229,0.05); border-radius:8px; border-left:3px solid #4f46e5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .stern-chips { display:flex; flex-direction:column; gap:8px; margin-bottom:18px; }
  .stern-chip { padding:11px 15px; border-radius:12px; border:1.5px solid rgba(79,70,229,0.18); background:rgba(79,70,229,0.03); color:#1e1b4b; font-family:'DM Sans',sans-serif; font-size:14px; cursor:pointer; text-align:left; transition:all 0.15s ease; display:flex; align-items:center; gap:12px; }
  .stern-chip:hover { border-color:#4f46e5; background:rgba(79,70,229,0.09); transform:translateX(2px); }
  .stern-chip-icon { font-size:18px; flex-shrink:0; }
  .stern-chip-label { font-weight:500; font-size:14px; }
  .stern-chip-sub { font-size:11px; color:var(--ink-mute); margin-top:1px; }
  .stern-modal-dismiss { width:100%; padding:10px; border:none; background:transparent; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-mute); cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
  .stern-modal-dismiss:hover { color:var(--ink); }
  .stern-emotions { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
  .stern-emotion-tag { padding:8px 16px; border-radius:20px; border:1.5px solid rgba(79,70,229,0.18); background:var(--surface); color:#1e1b4b; font-family:'DM Sans',sans-serif; font-size:13px; cursor:pointer; transition:all 0.15s ease; }
  .stern-emotion-tag:hover { border-color:#4f46e5; background:rgba(79,70,229,0.08); }
  .stern-emotion-tag.selected { border-color:#4f46e5; background:rgba(79,70,229,0.12); color:#4f46e5; font-weight:500; }
  .stern-modal-cta { width:100%; padding:13px; border-radius:12px; border:none; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:500; cursor:pointer; transition:opacity 0.15s; letter-spacing:0.01em; }
  .stern-modal-cta:hover { opacity:0.9; }
  .stern-modal-cta:disabled { opacity:0.4; cursor:not-allowed; }
  .stern-win-confetti { font-size:32px; text-align:center; margin-bottom:10px; }
  /* Stern toggle in settings */
  .stern-mode-selector { display:flex; gap:8px; margin-top:12px; }
  .stern-mode-option { flex:1; padding:10px 8px; border-radius:12px; border:1.5px solid var(--warm); background:var(--surface); font-family:'DM Sans',sans-serif; font-size:13px; cursor:pointer; transition:all 0.18s ease; text-align:center; color:var(--ink-mute); }
  .stern-mode-option:hover { border-color:var(--teal-light); color:var(--ink); }
  .stern-mode-option.active { font-weight:500; }
  .stern-mode-option.gentle.active { border-color:var(--teal-dark); background:rgba(90,122,90,0.08); color:var(--teal-dark); }
  .stern-mode-option.default.active { border-color:var(--ink-mute); background:rgba(90,90,82,0.06); color:var(--ink); }
  .stern-mode-option.stern.active { border-color:#4f46e5; background:rgba(79,70,229,0.08); color:#4f46e5; }
  [data-theme="dark"] .stern-mode-badge { color:#9c90f0; background:rgba(156,144,240,0.15); border-color:rgba(156,144,240,0.4); }
  [data-theme="dark"] .task-item.stern-overdue { background:rgba(156,144,240,0.06); }
  [data-theme="dark"] .task-item.stern-overdue .task-name { color:#c8c0f8; }
  [data-theme="dark"] .tag-stern-overdue { background:rgba(156,144,240,0.15) !important; color:#9c90f0 !important; border-color:rgba(156,144,240,0.3) !important; }
  [data-theme="dark"] .stern-modal-eyebrow { color:#9c90f0; }
  [data-theme="dark"] .stern-modal-title { color:var(--ink); }
  [data-theme="dark"] .stern-modal-task { background:rgba(156,144,240,0.08); border-left-color:#9c90f0; }
  [data-theme="dark"] .stern-chip { color:var(--ink); border-color:rgba(156,144,240,0.25); background:rgba(156,144,240,0.04); }
  [data-theme="dark"] .stern-chip:hover { border-color:#9c90f0; background:rgba(156,144,240,0.12); }
  [data-theme="dark"] .stern-emotion-tag { color:var(--ink); border-color:rgba(156,144,240,0.2); }
  [data-theme="dark"] .stern-emotion-tag:hover { border-color:#9c90f0; background:rgba(156,144,240,0.12); }
  [data-theme="dark"] .stern-emotion-tag.selected { border-color:#9c90f0; background:rgba(156,144,240,0.18); color:#9c90f0; }
  [data-theme="dark"] .stern-mode-option.stern.active { border-color:#9c90f0; background:rgba(156,144,240,0.12); color:#9c90f0; }

  /* ── Daily Check-In Modal ──────────────────────────────────── */
  .checkin-overlay { position:fixed; inset:0; background:rgba(42,42,37,0.62); z-index:1100; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(6px); animation:fadeIn 0.2s ease; }
  .checkin-box { background:var(--surface); border-radius:24px; padding:32px 28px; max-width:400px; width:100%; box-shadow:0 24px 64px rgba(0,0,0,0.2); animation:fadeUp 0.25s ease; max-height:90vh; overflow-y:auto; }
  .checkin-progress { display:flex; gap:6px; margin-bottom:28px; }
  .checkin-dot { flex:1; height:3px; border-radius:2px; background:var(--warm); transition:background 0.3s ease; }
  .checkin-dot.done { background:var(--teal-dark); }
  .checkin-eyebrow { font-family:'DM Mono',monospace; font-size:10px; color:var(--ink-mute); letter-spacing:1px; text-transform:uppercase; margin-bottom:8px; }
  .checkin-title { font-family:'Playfair Display',serif; font-size:22px; font-weight:400; color:var(--ink); line-height:1.3; margin-bottom:6px; }
  .checkin-sub { font-size:13px; color:var(--ink-soft); line-height:1.6; margin-bottom:24px; }
  .checkin-field { margin-bottom:20px; }
  .checkin-field-label { font-size:12px; font-weight:500; color:var(--ink-soft); margin-bottom:10px; display:block; letter-spacing:0.2px; }
  .checkin-chips { display:flex; gap:8px; flex-wrap:wrap; }
  .checkin-chip { padding:9px 16px; border-radius:40px; border:1.5px solid var(--warm); background:var(--card); font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-soft); cursor:pointer; transition:all 0.18s ease; }
  .checkin-chip:hover { border-color:var(--teal-light); color:var(--ink); }
  .checkin-chip.selected { border-color:var(--teal-dark); background:rgba(90,122,90,0.1); color:var(--teal-dark); font-weight:500; }
  .checkin-ns-option { width:100%; padding:14px 16px; border-radius:14px; border:1.5px solid var(--warm); background:var(--card); font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.18s ease; text-align:left; margin-bottom:10px; display:block; }
  .checkin-ns-option:last-child { margin-bottom:0; }
  .checkin-ns-option:hover { border-color:var(--teal-light); }
  .checkin-ns-label { font-size:14px; font-weight:500; color:var(--ink); margin-bottom:2px; }
  .checkin-ns-desc { font-size:12px; color:var(--ink-mute); line-height:1.4; }
  .checkin-ns-option.selected.hyper { border-color:var(--error); background:rgba(196,114,106,0.07); }
  .checkin-ns-option.selected.hyper .checkin-ns-label { color:var(--error); }
  .checkin-ns-option.selected.hypo { border-color:var(--slate-dark); background:rgba(196,168,130,0.1); }
  .checkin-ns-option.selected.hypo .checkin-ns-label { color:var(--slate-dark); }
  .checkin-ns-option.selected.grounded { border-color:var(--teal-dark); background:rgba(90,122,90,0.08); }
  .checkin-ns-option.selected.grounded .checkin-ns-label { color:var(--teal-dark); }
  .checkin-textarea { width:100%; min-height:150px; border:1.5px solid var(--warm); border-radius:14px; padding:14px 16px; font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink); background:var(--surface); resize:vertical; outline:none; transition:border-color 0.2s ease; line-height:1.7; box-sizing:border-box; }
  .checkin-textarea:focus { border-color:var(--teal-dark); }
  .checkin-textarea::placeholder { color:var(--ink-mute); font-style:italic; font-size:13px; }
  .checkin-actions { margin-top:24px; display:flex; flex-direction:column; gap:10px; }
  .checkin-btn-primary { width:100%; padding:14px; background:var(--teal-dark); color:white; border:none; border-radius:40px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; transition:var(--transition); letter-spacing:0.3px; }
  .checkin-btn-primary:hover { filter:brightness(1.1); }
  .checkin-btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
  .checkin-btn-secondary { width:100%; padding:12px; background:var(--warm); color:var(--ink-soft); border:none; border-radius:40px; font-family:'DM Sans',sans-serif; font-size:13px; cursor:pointer; transition:var(--transition); }
  .checkin-btn-secondary:hover { background:var(--teal-light); color:var(--teal-dark); }
  .checkin-btn-skip { background:none; border:none; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-mute); cursor:pointer; text-align:center; padding:4px; transition:color 0.2s; width:100%; }
  .checkin-btn-skip:hover { color:var(--ink-soft); }
  .checkin-coping-card { border-radius:16px; padding:18px 20px; margin-bottom:4px; }
  .checkin-coping-card.hyper { background:rgba(106,138,170,0.08); border:1.5px solid rgba(106,138,170,0.25); }
  .checkin-coping-card.hypo  { background:rgba(196,168,130,0.1); border:1.5px solid rgba(154,124,90,0.25); }
  .checkin-coping-card.body  { background:rgba(90,122,90,0.07); border:1.5px solid rgba(90,122,90,0.2); }
  .checkin-coping-name { font-size:15px; font-weight:500; margin-bottom:6px; }
  .checkin-coping-card.hyper .checkin-coping-name { color:var(--focus-blue); }
  .checkin-coping-card.hypo  .checkin-coping-name { color:var(--slate-dark); }
  .checkin-coping-card.body  .checkin-coping-name { color:var(--teal-dark); }
  .checkin-coping-desc { font-size:13px; color:var(--ink-soft); line-height:1.6; }
  .checkin-divider { height:1px; background:var(--warm); margin:20px 0; }

  /* ── Paywall ── */
  .paywall-overlay { position:fixed; inset:0; background:rgba(30,28,24,0.72); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); z-index:200; display:flex; align-items:flex-end; justify-content:center; animation:fadeUp 0.2s ease; }
  .paywall-sheet { background:var(--surface); border-radius:28px 28px 0 0; width:100%; max-width:520px; max-height:92dvh; overflow-y:auto; padding:32px 28px 48px; position:relative; box-shadow:0 -8px 48px rgba(0,0,0,0.18); }
  .paywall-close { position:absolute; top:18px; right:18px; background:var(--warm); border:none; border-radius:50%; width:32px; height:32px; font-size:20px; line-height:1; cursor:pointer; color:var(--ink-mute); display:flex; align-items:center; justify-content:center; }
  .paywall-eyebrow { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--teal-dark); text-align:center; margin-bottom:6px; }
  .paywall-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; color:var(--ink); text-align:center; margin-bottom:8px; }
  .paywall-sub { font-size:14px; color:var(--ink-soft); text-align:center; line-height:1.55; margin-bottom:24px; }
  .paywall-features { display:flex; flex-direction:column; gap:10px; margin-bottom:24px; }
  .paywall-feature-row { display:flex; align-items:flex-start; gap:10px; }
  .paywall-feature-icon { color:var(--teal-dark); font-size:12px; flex-shrink:0; margin-top:2px; }
  .paywall-feature-label { font-size:14px; font-weight:500; color:var(--ink); }
  .paywall-feature-desc { font-size:13px; color:var(--ink-mute); }
  .paywall-plans { display:flex; gap:10px; margin-bottom:20px; }
  .paywall-plan { flex:1; border:2px solid var(--warm); border-radius:16px; padding:14px 12px; background:var(--cream); cursor:pointer; text-align:center; transition:var(--transition); position:relative; }
  .paywall-plan:hover { border-color:var(--teal-light); }
  .paywall-plan.active { border-color:var(--teal-dark); background:rgba(90,122,90,0.06); }
  .paywall-plan-badge { position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:var(--teal-dark); color:white; font-size:10px; font-family:'DM Mono',monospace; letter-spacing:0.5px; padding:2px 9px; border-radius:20px; white-space:nowrap; }
  .paywall-plan-name { font-size:13px; font-weight:500; color:var(--ink-soft); margin-bottom:4px; }
  .paywall-plan-price { font-family:'Playfair Display',serif; font-size:22px; color:var(--ink); }
  .paywall-plan-per { font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-mute); }
  .paywall-plan-note { font-size:11px; color:var(--ink-mute); margin-top:2px; font-family:'DM Mono',monospace; }
  .paywall-cta { width:100%; padding:16px; background:var(--teal-dark); color:white; border:none; border-radius:16px; font-size:16px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); margin-bottom:12px; }
  .paywall-cta:hover:not(:disabled) { background:#4a6a4a; }
  .paywall-cta:disabled { opacity:0.6; cursor:not-allowed; }
  .paywall-legal { font-size:11px; color:var(--ink-mute); text-align:center; line-height:1.5; margin-bottom:16px; }
  .paywall-footer-links { display:flex; align-items:center; justify-content:center; gap:8px; }
  .paywall-footer-sep { color:var(--ink-mute); font-size:12px; }
  .paywall-restore-btn, .paywall-dismiss-btn { background:none; border:none; font-size:13px; color:var(--ink-mute); cursor:pointer; text-decoration:underline; font-family:'DM Sans',sans-serif; }
  .paywall-restore-btn:hover, .paywall-dismiss-btn:hover { color:var(--ink-soft); }
  .paywall-error { font-size:13px; color:var(--error); text-align:center; margin-bottom:10px; }
  .paywall-no-native { text-align:center; font-size:14px; color:var(--ink-soft); padding:20px 0; line-height:1.6; }

  /* ── Pro gate (inline upgrade wall) ── */
  .pro-gate { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; text-align:center; background:var(--cream); border:1.5px dashed var(--warm); border-radius:20px; margin:20px 0; }
  .pro-gate-icon { font-size:28px; margin-bottom:12px; opacity:0.6; }
  .pro-gate-feature { font-family:'Playfair Display',serif; font-size:18px; color:var(--ink); margin-bottom:4px; }
  .pro-gate-sub { font-size:13px; color:var(--ink-mute); margin-bottom:18px; }
  .pro-gate-btn { background:var(--teal-dark); color:white; border:none; border-radius:24px; padding:10px 24px; font-size:14px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; transition:var(--transition); }
  .pro-gate-btn:hover { background:#4a6a4a; }

  /* ─── MINIMAL ─────────────────────────────────────────────────────────────
     Calm, flat look: main-screen sections sit on the page and are separated by
     hairlines instead of rounded, shadowed boxes. Surfaces that float (modals,
     sheets, toasts, inputs) keep --surface. */
  .nav, .bottom-nav, [data-theme="dark"] .bottom-nav { box-shadow:none; }
  .bottom-nav { border-top:1px solid var(--line); }
  .nav-tab.active { box-shadow:none; }
  .btn-primary { border-radius:var(--radius); }
  /* Dark mode: filled buttons use a deep green so white text stays readable (bright mint + white was ~2:1) */
  [data-theme="dark"] .btn-primary:not(.btn-quiet), [data-theme="dark"] .ml-save-btn, [data-theme="dark"] .btn-autoschedule,
  [data-theme="dark"] .jumpstart-done-btn, [data-theme="dark"] .jumpstart-close-btn, [data-theme="dark"] .pro-gate-btn,
  [data-theme="dark"] .atm-create-btn, [data-theme="dark"] .ai-fab,
  [data-theme="dark"] .ground-complete-btn:not(:disabled) { background:#1f7a68 !important; color:#fff !important; }

  .readiness-card, .onboard-card, .panel-card, .battery-panel, .notif-section, .wins-card,
  .safety-card, .analytics-chart-wrap, .day-view, .ml-event-form, .el-insights,
  .shutdown-history, .focus-adder, .unscheduled-panel, .breathing-wrap, .journal-wrap,
  .suggest-card, .wellness-intro-banner, .ground-card, .screening-q, .screening-result,
  .pomo-timer-wrap, .pomo-settings-card, .feedback-card, .history-day-card, .history-journal-entry,
  .cal-section, .meds-card, .goals-section, .ml-time-card, .sched-task-card,
  .ai-add-tasks-card, .frec-wrap {
    background:transparent; box-shadow:none; border:none; border-radius:0;
    border-bottom:1px solid var(--line);
  }
  .panel-card, .battery-panel, .notif-section, .safety-card, .ground-card, .suggest-card,
  .wellness-intro-banner, .feedback-card, .history-day-card, .cal-section,
  .meds-card, .goals-section, .el-insights, .journal-wrap, .breathing-wrap {
    padding-left:0; padding-right:0;
  }
  .safety-card:hover, .ground-card:hover, .task-item:hover { box-shadow:none; transform:none; }

  /* Task rows: a quiet list, not a stack of cards */
  .new-task-row, [data-theme="dark"] .new-task-row {
    background:transparent; box-shadow:none; border:none; border-radius:0;
    border-bottom:1px solid var(--line); margin-bottom:0; padding:14px 2px;
  }
  .new-task-row.urgency-urgent, .new-task-row.urgency-high { border-left:none; }
  .new-task-check { width:24px; height:24px; border-width:1.5px; }
  .new-task-check:not(.done), .task-check, .node-task-check { border-color:var(--control-line); }
  .new-energy-badge { display:none; }

  /* Nudges: text between hairlines, no box */
  .battery-nudge {
    background:transparent; border:none; border-radius:0;
    border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:14px 0;
  }
  .battery-nudge-btn { border:none; background:none; padding:4px 0; margin-right:12px; font-size:14px; font-weight:500; color:var(--teal-dark); }
  .battery-nudge-btn:hover { background:none; color:var(--ink); }
  .battery-nudge-dismiss { font-size:14px; padding:4px 0; }

  /* Week strip: plain letters and numbers, selected day is a small filled circle */
  .week-day-pill, [data-theme="dark"] .week-day-pill,
  .week-day-pill.selected, [data-theme="dark"] .week-day-pill.selected {
    background:transparent; box-shadow:none; border:none; border-radius:0; padding:6px 0;
  }
  .week-day-pill:hover:not(.selected), [data-theme="dark"] .week-day-pill:hover:not(.selected) { box-shadow:none; transform:none; }
  .week-day-num-circle, .week-day-pill.today .week-day-num-circle { background:transparent; }
  .week-day-pill.selected .week-day-num-circle { background:var(--ink); }
  .week-day-pill.selected .week-day-num { color:var(--cream); }
  .week-day-pill.selected .week-day-letter, [data-theme="dark"] .week-day-pill.selected .week-day-letter { color:var(--ink); }
  .week-day-pill.selected .today-dot, .week-day-pill.selected .task-dot { background:var(--ink-mute); }

  /* Header battery: just the mascot */
  .nav-battery { display:flex; align-items:center; background:none; border:none; cursor:pointer; padding:4px; }

  /* Check-in battery: the mascot is the focus; the bar is a slim track */
  .battery-panel-pct { font-family:'DM Sans',sans-serif; font-size:15px; font-weight:500; }
  .battery-body { height:8px; border:none; box-shadow:none; background:var(--line); border-radius:4px; overflow:hidden; }
  .battery-nub { display:none; }
  .battery-shape-outer { padding:14px 0; margin:0; }

  /* Wellness: bare line icons, thin chevrons, one accent colour */
  .ground-card-icon { width:24px; height:24px; background:none !important; border-radius:0; color:var(--ink-mute); }
  .ground-card-left { gap:16px; }
  .ground-card-title { font-family:'DM Sans',sans-serif; font-size:16px; font-weight:500; }
  .ground-card-meta { font-family:'DM Sans',sans-serif; font-size:13px; letter-spacing:0; margin-top:2px; }
  .ground-card-chevron { color:var(--ink-mute); flex-shrink:0; }
  .ground-card-inner { border-top:none; margin-top:12px; padding-top:8px; padding-left:40px; }
  .ground-step-num { width:20px; height:auto; border-radius:0; background:none; color:var(--teal-dark); font-size:15px; font-weight:500; justify-content:flex-start; padding-top:1px; }
  .ground-tip { background:none; border-left:none; border-radius:0; padding:0; font-size:14px; }
  .ground-complete-btn { border-radius:var(--radius); }
  .ground-quick { background:none; border:none; border-radius:0; border-bottom:1px solid var(--line); padding:20px 0; }
  .ground-quick-title { font-family:'DM Sans',sans-serif; font-size:16px; font-weight:500; }
  .ground-box-cell { background:none; border:1px solid var(--line); }
  .ground-box-label { font-family:'DM Sans',sans-serif; font-size:12px; letter-spacing:0; }

  /* Grounding / Journal: text tabs with an underline, like Must / Should / Could */
  .mind-sub-tabs--split { gap:32px; justify-content:center; border-bottom:1px solid var(--line); margin-bottom:8px; }
  .mind-sub-tabs--split .mind-tab, .mind-sub-tabs--split .mind-tab.active {
    flex:none; background:none; border:none; border-radius:0; padding:10px 0; margin-bottom:-1px;
    border-bottom:2px solid transparent; color:var(--ink-mute); box-shadow:none;
  }
  .mind-sub-tabs--split .mind-tab.active { color:var(--ink); border-bottom-color:var(--ink); }

  /* Settings: both tab rows reuse the Grounding / Journal look; the second row is just tighter so four tabs fit */
  .mind-sub-tabs--split.mind-sub-tabs--tight { gap:20px; margin-bottom:16px; }
  .mind-sub-tabs--split.mind-sub-tabs--tight .mind-tab, .mind-sub-tabs--split.mind-sub-tabs--tight .mind-tab.active { font-size:13px; }
  .mind-sub-tabs--split.mind-sub-tabs--tight .mind-tab svg { display:none !important; }

  /* Calendar: one scroll, hour lines, quiet energy zones */
  .cal-events-wrap { margin-top:8px; padding-bottom:96px; }  /* last thing on the tab: room for the + button */
  .cal-header { margin-bottom:16px; }
  .cal-title { font-size:26px; }
  .cal-add-link { display:block; background:none; border:none; padding:10px 0 18px; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:500; color:var(--teal-dark); cursor:pointer; }
  .cal-earlier-btn { display:block; width:100%; background:none; border:none; border-top:1px solid var(--line); padding:12px 0; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--ink-mute); cursor:pointer; text-align:left; }
  .zone-legend { gap:16px; padding:0 0 10px; }
  .zone-badge { font-family:'DM Sans',sans-serif; font-size:12px; gap:6px; }
  .zone-swatch { width:2px; height:12px; border-radius:1px; }
  .zone-swatch.peak { background:rgba(90,122,90,0.6); }
  .zone-swatch.dip  { background:rgba(196,168,130,0.8); }
  .zone-swatch.wind { background:rgba(106,138,170,0.6); }
  .hour-grid { max-height:none; overflow:visible; }
  .hour-row, .hour-row.half-hour { border-bottom:none; opacity:1; }
  .hour-row:not(.half-hour) { border-top:1px solid var(--line); }
  .hour-row.peak-zone, .hour-row.dip-zone, .hour-row.wind-zone { background:none; }
  .hour-row.peak-zone { border-left:2px solid rgba(90,122,90,0.6); }
  .hour-row.dip-zone  { border-left:2px solid rgba(196,168,130,0.8); }
  .hour-row.wind-zone { border-left:2px solid rgba(106,138,170,0.6); }
  .hour-label { font-family:'DM Sans',sans-serif; font-size:12px; padding-top:8px; width:58px; white-space:nowrap; }
  .now-line { left:58px; }
  .cal-event { left:66px; }
  .cal-event { border-radius:6px; }
  .cal-event-meta, .cal-event-impact { font-family:'DM Sans',sans-serif; font-size:11px; }
  .ml-impact-label-text { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; text-transform:none; letter-spacing:0; color:var(--ink-soft); }
  .ml-save-btn { border-radius:var(--radius); padding:12px 0; font-size:14px; }
  .ml-cancel-btn { font-family:'DM Sans',sans-serif; font-size:14px; padding:8px 0; }
  .ml-repeat-label { font-family:'DM Sans',sans-serif; font-size:14px; letter-spacing:0; }
  /* Today's calendar: plain label, left-aligned text, time + name rows */
  .cal-section-header { margin-bottom:8px; }
  .cal-section-title { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; letter-spacing:0; text-transform:none; color:var(--ink-soft); }
  .cal-permission-prompt { text-align:left; padding:0; }
  .cal-permission-sub { font-family:'DM Sans',sans-serif; font-size:14px; color:var(--ink-mute); margin-top:0; line-height:1.5; }
  .cal-permission-btn { background:none; color:var(--teal-dark); border-radius:0; padding:8px 0 0; font-size:14px; }
  .cal-empty { font-family:'DM Sans',sans-serif; font-size:14px; text-align:left; padding:4px 0; }
  .cal-event-row { gap:14px; padding:10px 0; border-bottom:1px solid var(--line); }
  .cal-event-time { font-family:'DM Sans',sans-serif; font-size:13px; min-width:56px; margin-top:0; }
  .cal-event-allday { font-family:'DM Sans',sans-serif; }

  /* Days you checked in: letters with a small dot, nothing marked as missed */
  .shutdown-history { padding:20px 0; }
  .shutdown-history-title { font-size:13px; font-weight:600; margin-bottom:14px; }
  .checkin-week { display:flex; justify-content:space-between; max-width:320px; }
  .checkin-day { display:flex; flex-direction:column; align-items:center; gap:8px; width:28px; }
  .checkin-day-letter { font-size:12px; color:var(--ink-mute); }
  .checkin-day.today .checkin-day-letter { color:var(--ink); font-weight:600; }
  .checkin-day-dot { width:8px; height:8px; border-radius:50%; background:var(--line); }
  .checkin-day.today .checkin-day-dot { background:none; box-shadow:inset 0 0 0 1.5px var(--teal-dark); }
  .checkin-day-dot.done, .checkin-day.today .checkin-day-dot.done { background:var(--teal-dark); box-shadow:none; }
  .checkin-week-note { font-size:13px; color:var(--ink-mute); margin-top:14px; line-height:1.5; }

  /* Did you know: a plain section, not a tinted box */
  .wellness-fact-card { background:none; border:none; border-radius:0; padding:20px 0 0; margin-top:8px; }
  .wellness-fact-eyebrow { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; letter-spacing:0; text-transform:none; color:var(--ink-soft); }
  .wellness-fact-text { font-size:15px; font-style:normal; color:var(--ink); line-height:1.6; margin-top:6px; }
  .wellness-fact-source { font-family:'DM Sans',sans-serif; font-size:12px; margin-top:10px; }
  /* keeps a finger-sized drag area around the slim bar */
  .readiness-card .battery-panel-pct { font-size:15px; }

  /* Small controls: plain icons and text, no chips or outlines */
  .nav-privacy-btn { border:none; }
  .nav-privacy-btn.active { border:none; background:none; }
  .task-btn-stuck, .task-btn-stuck:hover { background:none; border:none; padding:2px 0; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--ink-mute); }
  .bucket-view-toggle.active, .bucket-view-toggle:hover { background:none; }
  .bucket-tabs-row { margin-bottom:6px; }
  .drag-handle { opacity:0.35; }
  .node-textarea { background:transparent; border:1px solid var(--line); border-radius:var(--radius); }
  .node-btn-add { background:none; padding:8px 0; font-size:14px; font-weight:500; color:var(--teal-dark); }

  /* Check-in screen */
  .readiness-card { border-bottom:none; }
  .readiness-eyebrow { font-family:'DM Sans',sans-serif; font-size:14px; letter-spacing:0; text-transform:none; color:var(--ink-mute); }
  .readiness-card .battery-panel { display:block; border-bottom:none; padding:0; }
  .readiness-card .battery-panel-label, .readiness-card .battery-panel-status { display:none; }
  .readiness-card .battery-panel-wrap { flex-direction:column-reverse; align-items:center !important; gap:10px; padding-right:0; }
  .readiness-card .battery-panel-wrap > svg, .readiness-card .battery-panel-wrap > * > svg { position:static; transform:none; }
  .readiness-card .battery-panel-pct { font-size:15px; color:var(--ink-soft) !important; }
  .readiness-quickcheck { border-top:1px solid var(--line); }
  .readiness-quickcheck-title { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; letter-spacing:0; text-transform:none; color:var(--ink-soft); }
  .readiness-quickcheck-title span { font-weight:400; color:var(--ink-mute); }
  .checkin-chip { background:transparent; border:1px solid var(--line); border-radius:var(--radius); padding:8px 14px; }
  .checkin-chip.selected { border-color:var(--teal-dark); background:transparent; }
  .readiness-struggle-btn { font-family:'DM Sans',sans-serif; font-size:14px; text-decoration:none; color:var(--ink-mute); letter-spacing:0; margin-top:18px; }


  /* Dark mode: every other white-on-teal fill gets the same deep green (white on bright mint was ~2:1) */
  [data-theme="dark"] .new-due-pill,
  [data-theme="dark"] .subtask-add-confirm,
  [data-theme="dark"] .wplan-priority-num,
  [data-theme="dark"] .week-day-btn.selected,
  [data-theme="dark"] .btn-add,
  [data-theme="dark"] .add-task-trigger-icon,
  [data-theme="dark"] .mindfulness-btn-add,
  [data-theme="dark"] .cal-event-done-btn.marked,
  [data-theme="dark"] .ml-day-btn.active,
  [data-theme="dark"] .s-dot.done,
  [data-theme="dark"] .btn-shutdown,
  [data-theme="dark"] .journal-prompt-cat.active,
  [data-theme="dark"] .dirty-modal-save,
  [data-theme="dark"] .wellness-intro-dismiss,
  [data-theme="dark"] .screening-opt.selected,
  [data-theme="dark"] .screening-submit,
  [data-theme="dark"] .pomo-btn-main,
  [data-theme="dark"] .tpm-btn-start,
  [data-theme="dark"] .tpm-done-close,
  [data-theme="dark"] .fab-menu-icon,
  [data-theme="dark"] .frec-try-btn,
  [data-theme="dark"] .meds-time-btn.taken .meds-check,
  [data-theme="dark"] .cal-permission-btn,
  [data-theme="dark"] .node-btn-ai,
  [data-theme="dark"] .bdump-btn-ai,
  [data-theme="dark"] .ai-message-user,
  [data-theme="dark"] .ai-send-btn,
  [data-theme="dark"] .ai-add-tasks-yes,
  [data-theme="dark"] .sched-generate-btn,
  [data-theme="dark"] .sched-add-all,
  [data-theme="dark"] .ai-breakdown-add-all,
  [data-theme="dark"] .checkin-btn-primary,
  [data-theme="dark"] .paywall-plan-badge,
  [data-theme="dark"] .paywall-cta,
  [data-theme="dark"] [style*="var(--teal-dark)"][style*="color: white"] { background:#1f7a68 !important; color:#fff !important; }

  /* Touch targets: small icon/link controls get an invisible hit area out to ~44px; chunky controls get a 44px minimum height */
  .nav-battery, .nav-privacy-btn, .nav-sos-btn, .week-nav-btn, .bucket-view-toggle, .node-add-link, .tap-slop { position:relative; }
  .nav-battery::after, .nav-privacy-btn::after, .nav-sos-btn::after, .week-nav-btn::after, .bucket-view-toggle::after, .node-add-link::after, .tap-slop::after { content:""; position:absolute; inset:-10px -8px; }
  .week-nav-btn::after { inset:-10px -4px; }
  .new-task-check::after, .task-btn-stuck::after { content:""; position:absolute; inset:-12px; }
  .task-btn-stuck { position:relative; }
  body[data-form-open] .ai-fab, body[data-form-open] .fab-menu, body[data-form-open] .fab-backdrop { display:none; }
  body[data-sheet-open] .bottom-nav { display:none; }
  .swipe-del-wrap { position:relative; overflow:hidden; }
  .swipe-del-btn { position:absolute; top:0; right:0; bottom:0; width:88px; border:none; cursor:pointer; background:rgba(192,57,43,0.1); color:#b23a30; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; }
  [data-theme="dark"] .swipe-del-btn { background:rgba(224,138,128,0.14); color:#e79a91; }
  .new-task-row.swiped { background:var(--card); }

  /* The sheet ends where the visual viewport does; on iPhone the keyboard toolbar floats over the strip below it, so colour that strip like the sheet. */
  .atm-overlay::after { content:""; position:fixed; left:0; right:0; top:calc(var(--vv-top,0px) + var(--vv-height,100%)); height:240px; background:var(--cream); pointer-events:none; }
  .rt-form button, .rt-form input:not([type=checkbox]) { min-height:44px; }
  .rt-form button.tap-slop { min-height:0; }
  .tap-slop-lg::after { inset:-14px -12px; }
  .tap-slop-sm::after { inset:-6px; }
  .bucket-view-toggle::after { inset:-10px -8px; }
  .node-add-link::after { inset:-13px -8px; }
  .mind-tab, .stern-mode-option, .feedback-type-btn, .breath-pattern-btn, .ground-complete-btn, .btn-secondary, .node-btn-add, .cal-earlier-btn, .feedback-input { min-height:44px; }
  .settings-advanced-toggle { padding:15px 0; margin:5px 0 -3px; }
  .atm-hbtn { width:44px; height:44px; }
  .subtask-add-input, .subtask-add-confirm, .atm-priority-btn, .atm-urgency-btn, .impact-toggle, .impact-slider, .atm-tag-add, .atm-datetime-field input { min-height:44px; }
  .subtask-add-confirm { min-width:44px; }

  /* Keyboard focus ring for everything that isn't a text field */
  button:focus-visible, [role="button"]:focus-visible, [role="radio"]:focus-visible, [role="checkbox"]:focus-visible, select:focus-visible, summary:focus-visible, a:focus-visible, .notif-toggle input:focus-visible + .notif-toggle-slider {
    outline:2px solid var(--teal-dark); outline-offset:2px;
  }
  input:focus-visible, textarea:focus-visible, select:focus-visible {
    outline:2px solid var(--teal-dark); outline-offset:1px;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration:0.01ms !important; animation-iteration-count:1 !important; transition-duration:0.01ms !important; scroll-behavior:auto !important; }
  }
`;

// Makes a clickable non-button element keyboard-operable (Enter/Space) and announced correctly.
const asButton = (onActivate, role = "button", extra = {}) => ({
  role, tabIndex: 0, ...extra,
  onKeyDown: e => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(e); }
  },
});

// ─── Static Data ──────────────────────────────────────────────────────────────
const PROFILES = [
  { id:"knowledge", icon:"briefcase",  name:"Desk Worker",      hint:"Screen-based, cognitive tasks dominate", baseline:5,
    science:"Ericsson et al. (1993) studied elite musicians and found deliberate, high-quality practice rarely exceeded 4 hrs/day before performance degraded. Gloria Mark (UC Irvine, CHI 2008) found workers took ~23 min on average to return to a task after being interrupted — meaning fewer, protected tasks matter more than longer lists.", scienceUrl:"https://doi.org/10.1037/0033-295X.100.3.363" },
  { id:"creative",  icon:"palette",    name:"Creative",         hint:"Flow-state work, high variability",      baseline:4,
    science:"Csikszentmihalyi's flow theory (1990) describes how deep creative states require sustained, uninterrupted engagement — and collapse quickly under distraction or cognitive overload. This points to fewer, deeper tasks over a longer list.", scienceUrl:"https://search.worldcat.org/title/20392741" },
  { id:"athlete",   icon:"activity",   name:"Athlete / Active", hint:"Physical training, high resilience",     baseline:5,
    science:"Marcora et al. (2009) showed that mental fatigue impairs physical performance — and the reverse holds too: high training load draws on the same finite neural and metabolic reserves used for focused cognitive work. Recovery isn't just physical.", scienceUrl:"https://doi.org/10.1152/japplphysiol.91324.2008" },
  { id:"caregiver", icon:"heart",      name:"Caregiver",        hint:"Interrupted focus, unpredictable days",  baseline:3,
    science:"Pinquart & Sörensen's 2003 meta-analysis (Psychology and Aging) found caregivers show significantly higher depression, stress, and lower wellbeing than non-caregivers. The emotional demands of caregiving leave fewer reserves for planned, self-directed tasks.", scienceUrl:"https://pubmed.ncbi.nlm.nih.gov/12825775/" },
  { id:"student",   icon:"book-open",  name:"Student",          hint:"Mix of study blocks and admin",          baseline:5,
    science:"Cognitive load theory (Sweller, 1988) demonstrates that learning actively occupies working memory. Encoding new material is itself cognitively demanding — study time counts as real work and competes directly with other task capacity.", scienceUrl:"https://doi.org/10.1207/s15516709cog1202_4" },
  { id:"executive", icon:"compass",    name:"Executive / Lead", hint:"Meetings-heavy, reactive by nature",     baseline:4,
    science:"Baumeister et al. (1998) introduced ego depletion — the finding that self-control and decision-making draw on a limited resource that degrades with use. Note: large-scale replications have shown mixed results, but the practical reality of meeting-heavy schedules fragmenting deep focus time is well-documented.", scienceUrl:"https://doi.org/10.1037/0022-3514.74.5.1252" },
];

const RHYTHMS = [
  { id:"deep",     icon:"target",   name:"Deep blocks",           desc:"I prefer 2–3 long stretches of focused work with few interruptions." },
  { id:"varied",   icon:"shuffle",  name:"Varied & mixed",        desc:"I like alternating between different types of tasks throughout the day." },
  { id:"reactive", icon:"bolt",     name:"Responsive & reactive", desc:"My day is largely shaped by others — meetings, requests, context-switching." },
];

const ENERGY_TAGS = [
  { id:"deep",  label:"Deep Work", class:"tag-deep" },
  { id:"light", label:"Light",     class:"tag-light" },
  { id:"admin", label:"Admin",     class:"tag-admin" },
];

const INITIAL_TASKS = [];
const GUEST_TASKS_KEY = "reflow-guest-tasks";
function loadGuestTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_TASKS_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

// Single source of truth for battery level thresholds.
// Changing a value here affects power-save mode, AI tier labels, colors, and schedule bucketing.
const BATTERY_THRESHOLDS = {
  CRITICAL: 20,  // power-save mode, rest warnings, crisis nudge
  LOW:      40,  // AI coach tier "Low", weekly reflection trigger, schedule demotion
  MID:      50,  // color inflection: amber → green
  GOOD:     75,  // AI coach tier "Medium", energy derivation "high"
  FULL:     80,  // "fully charged" display label
};
// Maps battery % → qualitative energy level used in check-in and schedule generation.
const ENERGY_LEVEL_THRESHOLDS = {
  HIGH: 75,  // battery ≥ 75 → "high"
  MED:  40,  // battery ≥ 40 → "med"
  LOW:  15,  // battery ≥ 15 → "low"; below 15 → "hibernate"
};

const BREATHING_PATTERNS = [
  { id:"box",    name:"Box",
    desc:"A balanced 4-count rhythm — inhale, hold, exhale, hold, all equal. Used in high-pressure professions (Navy SEALs, surgeons) to stabilise focus under stress. The even holds keep your CO₂ stable, preventing lightheadedness while measurably increasing heart rate variability (HRV). Best for: pre-meeting nerves, mid-day reset, or when anxiety is creeping in.",
    phases:[{l:"Inhale",d:4},{l:"Hold",d:4},{l:"Exhale",d:4},{l:"Hold",d:4}] },
  { id:"478",    name:"4-7-8",
    desc:"Exhale-dominant — the long 8-second out-breath is the key. It slows your respiratory rate enough to stimulate the vagus nerve, your body's primary \"all clear\" signal. The 7-second hold builds mild CO₂ tolerance that deepens the effect without dizziness. Based on ancient pranayama practice, popularised by Dr. Andrew Weil. Best for: falling asleep, intense anxiety, or de-escalating after conflict.",
    phases:[{l:"Inhale",d:4},{l:"Hold",d:7},{l:"Exhale",d:8}] },
  { id:"custom", name:"Custom",
    desc:"Set your own timing. A useful rule: make your exhale longer than your inhale (e.g. 4 in, 6 out). Inhale activates your nervous system slightly; exhale calms it. The more your exhale dominates, the deeper the relaxation response. Experiment until you find what settles you.",
    phases:[{l:"Inhale",d:4},{l:"Hold",d:4},{l:"Exhale",d:4},{l:"Hold",d:4}], customizable:true },
];

const MOODS = [
  { id:"calm",      icon:"smile",   label:"Calm" },
  { id:"energized", icon:"bolt",    label:"Energized" },
  { id:"anxious",   icon:"frown",   label:"Anxious" },
  { id:"low",       icon:"cloud",   label:"Low" },
  { id:"grateful",  icon:"heart",   label:"Grateful" },
  { id:"irritable", icon:"flame",   label:"Irritable" },
  { id:"numb",      icon:"meh",     label:"Numb" },
  { id:"hopeful",   icon:"sun",     label:"Hopeful" },
];


const MINDFULNESS_TASKS = {
  high: [
    { icon:"wind",    text:"Take 3 slow breaths before your next task." },
    { icon:"activity",text:"Walk to get water. No phone." },
    { icon:"leaf",    text:"Name one thing around you that's beautiful." },
    { icon:"target",  text:"Close all tabs you don't need right now." },
    { icon:"pen",     text:"Write down the one thing that actually matters today." },
    { icon:"sun",     text:"Step outside for 2 minutes. Just stand there." },
    { icon:"bell",    text:"Silence your notifications for the next hour." },
    { icon:"wind",    text:"Roll your shoulders back and drop your jaw. Hold for 10 seconds." },
  ],
  med: [
    { icon:"droplet",       text:"Make a warm drink and drink it without looking at a screen." },
    { icon:"smile",         text:"Do one thing slowly and with full attention." },
    { icon:"eye",           text:"Put your phone face-down for 20 minutes." },
    { icon:"sun",           text:"Pause. What's one thing going okay today?" },
    { icon:"sparkle",       text:"Play a song you love before starting your next task." },
    { icon:"eye",           text:"Look out a window for one full minute." },
    { icon:"activity",      text:"Stretch your hands and wrists. You've been typing." },
    { icon:"message-circle",text:"Send a kind message to someone you haven't talked to in a while." },
  ],
  low: [
    { icon:"moon",    text:"Lie down for 10 minutes. Not scrolling — just resting." },
    { icon:"droplet", text:"Splash cold water on your face or hands." },
    { icon:"leaf",    text:"What would feel most restorative right now?" },
    { icon:"moon",    text:"Dim the lights and sit quietly for 5 minutes." },
    { icon:"heart",   text:"Get comfortable. Put on cozy socks or a sweater." },
    { icon:"book",    text:"Read something for pleasure — not to learn, just to enjoy." },
    { icon:"wind",    text:"4-7-8 breath: inhale 4, hold 7, exhale 8. Twice." },
    { icon:"heart",   text:"Rest is part of the work. Give yourself permission." },
  ],
};

const SHUTDOWN_QUESTIONS = [
  { id:"win",      q:"What felt good today — even something small?",  placeholder:"A conversation, a decision, a moment of clarity..." },
  { id:"carry",    q:"What can wait until tomorrow?",                  placeholder:"Name the thing you're releasing for now..." },
  { id:"tomorrow", q:"One gentle intention for tomorrow:",             placeholder:"Not a goal — just a direction..." },
];

// ─── EnergyMap ────────────────────────────────────────────────────────────────
const DEFAULT_ENERGY_MAP = [
  {time:'00:00',level:'Low'},{time:'02:00',level:'Low'},{time:'04:00',level:'Low'},
  {time:'06:00',level:'Medium'},{time:'08:00',level:'High'},{time:'10:00',level:'High'},
  {time:'12:00',level:'Medium'},{time:'14:00',level:'Low'},{time:'16:00',level:'Medium'},
  {time:'18:00',level:'Medium'},{time:'20:00',level:'Low'},{time:'22:00',level:'Low'},
];
const EMAP_BLOCKS = Array.from({length:12}, (_, i) => `${String(i*2).padStart(2,'0')}:00`);
const EMAP_CYCLE  = ['High','Medium','Low'];
const EMAP_COLORS = {
  High:   {bg:'rgba(90,122,90,0.13)',  border:'rgba(90,122,90,0.38)',   dot:'#5a7a5a'},
  Medium: {bg:'rgba(196,168,130,0.12)',border:'rgba(196,168,130,0.35)', dot:'#c4a882'},
  Low:    {bg:'rgba(196,212,196,0.10)',border:'rgba(196,212,196,0.30)', dot:'#c4d4c4'},
};

function formatEmapHour(time) {
  const h = parseInt(time, 10);
  if (h === 0)  return '12 am';
  if (h === 12) return '12 pm';
  return h < 12 ? `${h} am` : `${h-12} pm`;
}

function EnergyMapEditor({ energyMap = DEFAULT_ENERGY_MAP, onChange }) {
  const [savedFlash, setSavedFlash] = useState(false);
  const levelMap = Object.fromEntries(energyMap.map(e => [e.time, e.level]));

  function toggleBlock(time) {
    const current = levelMap[time] || 'Low';
    const next = EMAP_CYCLE[(EMAP_CYCLE.indexOf(current) + 1) % EMAP_CYCLE.length];
    const updated = EMAP_BLOCKS.map(t => ({ time: t, level: t === time ? next : (levelMap[t] || 'Low') }));
    onChange(updated);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  }

  return (
    <div className="emap-wrap">
      <div className="emap-legend">
        {EMAP_CYCLE.map(l => (
          <span key={l} className="emap-legend-item">
            <span className="emap-legend-dot" style={{background:EMAP_COLORS[l].dot}} />
            {l}
          </span>
        ))}
        <span style={{marginLeft:'auto',fontSize:11,color:'var(--ink-mute)'}}>tap block to cycle</span>
      </div>
      <div className="emap-grid">
        {EMAP_BLOCKS.map(time => {
          const level  = levelMap[time] || 'Low';
          const colors = EMAP_COLORS[level];
          const endH   = (parseInt(time,10) + 2) % 24;
          const endTime = `${String(endH).padStart(2,'0')}:00`;
          return (
            <button key={time} className="emap-block"
              style={{background:colors.bg, borderColor:colors.border}}
              onClick={() => toggleBlock(time)}
            >
              <span className="emap-block-time">{formatEmapHour(time)}–{formatEmapHour(endTime)}</span>
              <span className="emap-block-dot" style={{background:colors.dot}} />
              <span className="emap-block-level">{level}</span>
            </button>
          );
        })}
      </div>
      <div className="emap-save-row">
        <span className={`emap-saved-msg ${savedFlash ? 'visible' : ''}`} style={{display:"inline-flex",alignItems:"center",gap:4}}>saved <Icon name="check-circle" size={12} /></span>
      </div>
    </div>
  );
}

// Half-hour slots for full 24h (0:00 to 23:30)
const HOURS = Array.from({ length:48 }, (_, i) => i * 0.5);
const ROW_H = 36; // px per 30-min slot — must match .hour-row height in CSS

// Energy zones: which hours are best for which task type
function getZone(hour) {
  if (hour >= 6  && hour <= 10) return "peak";   // deep work
  if (hour >= 11 && hour <= 13) return "mid";
  if (hour >= 14 && hour <= 15) return "dip";    // light tasks
  if (hour >= 16 && hour <= 18) return "second"; // admin
  if (hour >= 19)               return "wind";   // wind-down
  return "mid";
}

function zoneClass(hour) {
  const z = getZone(hour);
  if (z === "peak")   return "peak-zone";
  if (z === "dip")    return "dip-zone";
  if (z === "wind")   return "wind-zone";
  return "";
}

function zoneLabel(hour) {
  const z = getZone(hour);
  if (z === "peak")   return "peak";
  if (z === "dip")    return "dip";
  if (z === "wind")   return "wind";
  return "";
}

// Build a Set of every 30-min slot that is occupied, respecting each block's duration
function buildOccupied(existingSchedule, existingEvents) {
  const occupied = new Set();
  // Firestore returns object keys as strings — always parse to Number before arithmetic.
  Object.entries(existingSchedule).forEach(([h, blocks]) => {
    if (!Array.isArray(blocks)) return;
    const startH = Number(h);
    if (isNaN(startH)) return;
    blocks.forEach(block => {
      const slots = Math.max(1, Math.ceil((Number(block.duration) || 30) / 30));
      for (let s = 0; s < slots; s++) {
        occupied.add(Math.round((startH + s * 0.5) * 10) / 10);
      }
    });
  });
  // startHour / endHour may be stored as numbers or strings depending on serialization path.
  existingEvents.forEach(ev => {
    let h = Number(ev.startHour);
    const end = Number(ev.endHour);
    if (isNaN(h) || isNaN(end)) return;
    while (h < end) { occupied.add(Math.round(h * 10) / 10); h = Math.round((h + 0.5) * 10) / 10; }
  });
  return occupied;
}

// Find the first free start hour for a block of slotsNeeded consecutive 30-min slots,
// scanning forward from preferredHour. Returns null if no room found.
function findFreeBlock(occupied, preferredHour, slotsNeeded, minHour = 0) {
  const start = Math.max(preferredHour, Math.ceil(minHour * 2) / 2);
  const allSlots = Array.from({ length: 48 }, (_, i) => i * 0.5).filter(h => h >= start);
  for (const h of allSlots) {
    let fits = true;
    for (let s = 0; s < slotsNeeded; s++) {
      if (occupied.has(Math.round((h + s * 0.5) * 10) / 10)) { fits = false; break; }
    }
    if (fits) return h;
  }
  return null;
}

// Auto-schedule: assigns tasks to best hours based on energyImpact and the user's EnergyMap.
// energyMap: [{time:'08:00', level:'High'|'Medium'|'Low'}, ...] — 2-hour blocks covering 24h.
// battery:   current battery %; when < 20 only Charge tasks are placed, all others deferred.
function autoSchedule(tasks, energy, existingSchedule = {}, existingEvents = [], minHour = 0, energyMap = [], battery = 100) {
  const occupied = buildOccupied(existingSchedule, existingEvents);
  const earliest = Math.ceil(minHour * 2) / 2;
  const future   = h => h >= earliest;

  // Build slot → level lookup from the EnergyMap (each 2-h block = 4 half-hour slots)
  const slotLevel = new Map();
  energyMap.forEach(({ time, level }) => {
    const startH = parseInt(time, 10);
    for (let s = 0; s < 4; s++) {
      slotLevel.set(Math.round((startH + s * 0.5) * 10) / 10, level);
    }
  });

  // Candidate lists derived from EnergyMap, falling back to time-of-day heuristics
  const hasMap = energyMap.length > 0;
  const allSlots = Array.from({length:48}, (_, i) => i * 0.5);
  const highSlots = allSlots.filter(h => slotLevel.get(h) === 'High'  && future(h));
  const lowSlots  = allSlots.filter(h => slotLevel.get(h) === 'Low'   && future(h));

  // Legacy heuristic fallbacks (used when map is empty or impact is null)
  const deepCandidates  = (energy === "low" ? [10,10.5,11,11.5]    : energy === "med" ? [9,9.5,10,10.5]  : [8,8.5,9,9.5,10]).filter(future);
  const lightCandidates = (energy === "low" ? [13,13.5,14,14.5,15] : [14,14.5,15,15.5,16]).filter(future);
  const adminCandidates = (energy === "low" ? [13,13.5,15,15.5]    : [16,16.5,17,17.5]).filter(future);

  function claimBlock(preferredList, slotsNeeded) {
    for (const h of preferredList) {
      let fits = true;
      for (let s = 0; s < slotsNeeded; s++) {
        if (occupied.has(Math.round((h + s * 0.5) * 10) / 10)) { fits = false; break; }
      }
      if (fits) {
        for (let s = 0; s < slotsNeeded; s++) occupied.add(Math.round((h + s * 0.5) * 10) / 10);
        return h;
      }
    }
    const fallback = findFreeBlock(occupied, earliest, slotsNeeded, minHour);
    if (fallback !== null) {
      for (let s = 0; s < slotsNeeded; s++) occupied.add(Math.round((fallback + s * 0.5) * 10) / 10);
    }
    return fallback;
  }

  const schedule = { ...existingSchedule };
  if (!occupied.has(12) && 12 >= earliest) {
  }

  const lowBattery = battery < BATTERY_THRESHOLDS.CRITICAL;
  const noTime = [];
  tasks.forEach(t => {
    if (t.done) return;

    const impact = typeof t.energyImpact === "number" ? t.energyImpact : null;

    // Critical override: battery under 20% — only schedule Charge tasks; everything else rests.
    if (lowBattery && (impact === null || impact <= 0)) { noTime.push(t); return; }

    let candidates;
    if (impact !== null) {
      if (impact <= -30) {
        // Heavy Drain → needs peak cognitive hours → prefer High-energy map slots
        candidates = hasMap && highSlots.length > 0 ? highSlots : deepCandidates;
      } else if (impact >= 0) {
        // Charge task → gentle activity → prefer Low-energy map slots (mid-afternoon slump etc.)
        candidates = hasMap && lowSlots.length > 0 ? lowSlots : lightCandidates;
      } else {
        // Moderate drain (admin) → prefer Low-energy slots; fall back to admin heuristic
        candidates = hasMap && lowSlots.length > 0 ? lowSlots : adminCandidates;
      }
    } else if (t.energy === "deep")  { candidates = hasMap && highSlots.length > 0 ? highSlots : deepCandidates; }
    else if (t.energy === "light")   { candidates = hasMap && lowSlots.length  > 0 ? lowSlots  : lightCandidates; }
    else                             { candidates = adminCandidates; }

    const durationMins = Number(t.duration) || 30;
    const slotsNeeded  = Math.max(1, Math.ceil(durationMins / 30));
    const hour = claimBlock(candidates, slotsNeeded);
    if (hour === null) { noTime.push(t); return; }
    if (!schedule[hour]) schedule[hour] = [];
    schedule[hour].push({ id:t.id, type: impact !== null ? (impact < 0 ? "drain" : "charge") : (t.energy || "admin"), name:t.name, tag:t.bucket, duration: durationMins });
  });

  return { schedule, noTime };
}

function formatHour(h) {
  const hour = Math.floor(h);
  const mins = h % 1 === 0.5 ? ":30" : "";
  if (hour === 0 || hour === 24) return `12${mins} am`;
  if (hour === 12) return `12${mins} pm`;
  return hour < 12 ? `${hour}${mins} am` : `${hour - 12}${mins} pm`;
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function getWeekDays() {
  const today = new Date();
  const day   = today.getDay(); // 0=Sun
  const mon   = new Date(today); mon.setDate(today.getDate() - ((day + 6) % 7));
  return Array.from({ length:7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return d;
  });
}

// ─── Capacity Engine ──────────────────────────────────────────────────────────
function deriveTaskCounts(profile, peakCapacity, rhythm) {
  // Ratios derived from energy research:
  // High:  ~85–90% of peak (sustained peak output is rare even on good days)
  // Med:   ~60–65% (post-lunch circadian dip reduces performance ~20–30%; Walker, 'Why We Sleep')
  // Low:   ~35–45% (sleep deprivation/burnout research shows 40–60% cognitive reduction; Maslach burnout model)
  const ratioMap = {
    athlete:   { high:0.85, med:0.65, low:0.45 }, // physical fatigue compounds cognitive load (Marcora et al.)
    executive: { high:0.85, med:0.60, low:0.35 }, // decision fatigue hits hard at low energy (Baumeister)
    caregiver: { high:0.75, med:0.55, low:0.40 }, // interrupted baseline means high is already constrained
    creative:  { high:0.85, med:0.60, low:0.35 }, // flow states collapse under low energy (Csikszentmihalyi)
    student:   { high:0.85, med:0.65, low:0.42 }, // cognitive load theory: low energy degrades encoding
    knowledge: { high:0.85, med:0.65, low:0.40 }, // Ericsson: deliberate practice collapses when depleted
  };
  const rhythmMod = {
    deep:     { high:1.00, med:0.95, low:0.90 },
    varied:   { high:0.95, med:1.00, low:0.95 },
    reactive: { high:0.90, med:1.00, low:1.05 },
  };
  const ratios = ratioMap[profile?.id] || ratioMap.knowledge;
  const mods   = rhythmMod[rhythm]     || rhythmMod.varied;
  const clamp  = (n, min, max) => Math.min(max, Math.max(min, Math.round(n)));
  return {
    high:      clamp(peakCapacity * ratios.high * mods.high, 2, 12),
    med:       clamp(peakCapacity * ratios.med  * mods.med,  1, 10),
    low:       clamp(peakCapacity * ratios.low  * mods.low,  1,  6),
    hibernate: 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Checkmark() {
  return <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
function Onboarding({ onComplete, initialProfile = null, initialPeak = null, initialRhythm = null, initialUserName = null }) {
  const TOTAL = 15;
  const [step,              setStep]             = useState(0);
  const [userName,          setUserName]         = useState(initialUserName || "");
  const [prof,              setProf]             = useState(initialProfile);
  const [peak,              setPeak]             = useState(initialPeak);
  const [rhythm,            setRhythm]           = useState(initialRhythm);
  const [initBatt,          setInitBatt]         = useState(70);
  const [energyMap,         setEnergyMap]        = useState(DEFAULT_ENERGY_MAP);
  const [demoAge,           setDemoAge]          = useState("");
  const [demoGender,        setDemoGender]       = useState("");
  const [demoMH,            setDemoMH]           = useState("");
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [burnoutPattern,    setBurnoutPattern]   = useState("");
  const [arrivedBecause,    setArrivedBecause]   = useState("");
  const [wantBack,          setWantBack]         = useState("");
  const [ndResonance,       setNdResonance]      = useState([]);
  const [quizAnswers,       setQuizAnswers]      = useState({});
  const [quizQuestion,      setQuizQuestion]     = useState(0);
  const [quizScore,         setQuizScore]        = useState(null);
  const [quizTier,          setQuizTier]         = useState(null);
  const [mapPeak,           setMapPeak]          = useState("");
  const [mapDip,            setMapDip]           = useState("");
  const [mapEvening,        setMapEvening]       = useState("");
  const [identityValues,    setIdentityValues]   = useState([]);
  const [identityStatement, setIdentityStatement] = useState("");

  function pickProf(p) { setProf(p); if (peak === null) setPeak(p.baseline); }
  function autoGrow(el) { if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  function skip() {
    onComplete({ profile: initialProfile ?? PROFILES[0], peakCapacity: initialPeak ?? 5, rhythm: initialRhythm ?? "varied", userName: initialUserName || "", initialBattery: 70, energyMap: DEFAULT_ENERGY_MAP });
  }
  function finish() { onComplete({ profile: prof, peakCapacity: peak, rhythm, userName: userName.trim(), initialBattery: initBatt, energyMap, demographics: { age: demoAge, gender: demoGender, mentalHealth: demoMH }, identityValues, identityStatement }); }

  const counts = prof && peak && rhythm ? deriveTaskCounts(prof, peak, rhythm) : null;
  const battColor = initBatt < BATTERY_THRESHOLDS.CRITICAL ? "var(--error)" : initBatt < BATTERY_THRESHOLDS.MID ? "var(--slate-dark)" : "var(--teal-dark)";
  const battLabel = initBatt < BATTERY_THRESHOLDS.CRITICAL ? "rest when you can" : initBatt < BATTERY_THRESHOLDS.MID ? "running on less" : initBatt < BATTERY_THRESHOLDS.FULL ? "ready to go" : "fully charged";
  const battEmoji = initBatt < BATTERY_THRESHOLDS.MID ? "battery" : "bolt";

  const dots = step >= 1 && step <= TOTAL
    ? Array.from({ length: TOTAL }, (_, i) => (
        <div key={i} className={`onboard-step-dot ${i===step-1?"active":i<step-1?"done":""}`} />
      ))
    : null;

  const BURNOUT_PATTERNS = [
    { id:"never-stop",  icon:"flame",    name:"I can't stop working",          hint:"Tasks breed faster than I finish them. Rest feels like failure." },
    { id:"wired-tired", icon:"battery", name:"Exhausted but can't switch off", hint:"Body wants to stop, mind won't let it. I replay my to-do list at midnight." },
    { id:"yes-machine", icon:"heart",   name:"I say yes to everything",        hint:"Commitments pile up. I overcommit, crash, then feel guilty for both." },
    { id:"fumes",       icon:"wind",    name:"Running on fumes",               hint:"I used to have energy for this. Now I'm just getting through the day." },
  ];
  const burnoutResponses = {
    "never-stop":  "That list will never be finished. That's the trap. We'll show you how to close the loop.",
    "wired-tired": "Your nervous system is stuck in overdrive. We'll work with your natural rhythm to give it real off-ramps.",
    "yes-machine": "Every 'yes' is a 'no' to your own recovery. We'll help you see the cost before you commit.",
    "fumes":       "That's not a willpower problem. That's a depletion problem. The tank needs refilling, not pushing harder.",
  };
  const burnoutPatternLabel = {
    "never-stop":  "can't stop working",
    "wired-tired": "wired but tired",
    "yes-machine": "yes to everything",
    "fumes":       "running on fumes",
  }[burnoutPattern] || "starting point";

  const batteryContextMessage = (() => {
    if (burnoutPattern === "never-stop" && initBatt < 50) return "That tracks. You've been spending energy you don't have. Today we start from here.";
    if (burnoutPattern === "wired-tired" && initBatt >= 60) return "Your body might be running on cortisol, not real energy. That can feel like 'fine' until it's not.";
    if (burnoutPattern === "fumes" && initBatt < 30) return "Honest. Brave. Opening this app today is already step one.";
    return "This is your starting line. MyBattery calibrates everything around protecting this level.";
  })();

  const ARRIVED_OPTIONS = [
    { id:"exhausted",   icon:"wind",          label:"I'm exhausted and need relief",      sub:"The tank is close to empty and I need a way out." },
    { id:"preventing",  icon:"shield",         label:"I want to stay ahead of burnout",    sub:"Things are okay-ish, but I can feel the wall coming." },
    { id:"structure",   icon:"layout",         label:"I want to work in a smarter way",    sub:"My effort isn't translating into results. Something needs to shift." },
    { id:"curious",     icon:"star",           label:"I'm curious what this can do",       sub:"I heard about it and wanted to see for myself." },
  ];

  const arrivedResponses = {
    "exhausted":  userName.trim() ? `${userName.trim()}, you made the right call. Your body has been asking for this — we're going to listen.` : "You made the right call. Your body has been asking for this — we're going to listen.",
    "preventing": "Smart. The best time to protect your energy is before it's gone. You're already ahead.",
    "structure":  "Energy management is the foundation most productivity systems skip. That's exactly what we fix.",
    "curious":    "Curiosity is how change starts. You're in the right place.",
  };

  const WANT_BACK_OPTIONS = [
    { id:"presence",    icon:"heart",   label:"Being present with people I love",      sub:"Not distracted. Actually there." },
    { id:"creativity",  icon:"star",    label:"Space to create and think clearly",      sub:"The ideas that go quiet when I'm overloaded." },
    { id:"health",      icon:"leaf",    label:"Energy to move my body again",           sub:"Walks, workouts, or just not collapsing at 6pm." },
    { id:"peace",       icon:"sun",     label:"Finishing the day without dreading tomorrow", sub:"A sense of calm instead of a running list." },
    { id:"goals",       icon:"bolt",    label:"Progress on what actually matters",      sub:"The projects that keep getting pushed to someday." },
  ];

  const wantBackLabel = WANT_BACK_OPTIONS.find(o => o.id === wantBack)?.label || "";

  const BURNOUT_SCIENCE = {
    "never-stop": [
      { stat: "90m",   detail: "Your brain naturally cycles between peak focus and recovery every ~90 minutes. Ignoring this signal trains your cortex to stay 'on' — even when you sleep.", source: "Peretz Lavie, 1982 · ultradian rhythm research" },
      { stat: "40%",   detail: "Switching between tasks costs up to 40% of productive time. The more you pile on, the less actually gets done.", source: "American Psychological Association, 2006" },
      { stat: "↓",     detail: "Chronic overwork shrinks the prefrontal cortex — the part that makes decisions, manages emotion, and knows when to stop.", source: "Magnus Glise et al., 2022" },
    ],
    "wired-tired": [
      { stat: "HPA",   detail: "When you're exhausted but can't switch off, your hypothalamic-pituitary-adrenal axis is stuck in overdrive — flooding your system with cortisol that blocks rest.", source: "McEwen & Stellar, 1993" },
      { stat: "152%",  detail: "More sick days are taken by people experiencing sustained burnout — the wired-tired pattern is an early warning sign the body recognises before the mind does.", source: "Salvagioni et al., 2017" },
      { stat: "2–3d",  detail: "It takes 2–3 days of genuine rest to fully reverse a cortisol spike. Short breaks don't cut it. Protected recovery time does.", source: "Sonnentag & Fritz, 2007" },
    ],
    "yes-machine": [
      { stat: "67%",   detail: "In one study, 67% of workers said they couldn't say no to their manager even when overloaded. Overcommitment isn't a character flaw — it's a systemic trap.", source: "Gallup State of the Workplace, 2023" },
      { stat: "↑",     detail: "Every yes without a corresponding no raises your baseline stress level — the new floor becomes higher, recovery becomes harder.", source: "Lazarus & Folkman, 1984 · stress appraisal model" },
      { stat: "4×",    detail: "People who regularly protect recovery time report 4× higher wellbeing scores — not because they do less, but because they recover between effort.", source: "Sonnentag & Bayer, 2005" },
    ],
    "fumes": [
      { stat: "B12",   detail: "Burnout on fumes often masks a physiological depletion cycle — sleep debt, nutrient depletion, and elevated cortisol all compound into the 'I used to be able to do this' feeling.", source: "Toker & Biron, 2012" },
      { stat: "2.3×",  detail: "Greater risk of cardiovascular disease is associated with chronic work stress in this pattern. Running on fumes isn't just unpleasant — it's a health signal.", source: "Salvagioni et al., 2017" },
      { stat: "↑",     detail: "Small, protected wins — even micro-recoveries — measurably restore motivation and output within days. The tank refills faster than you'd expect with the right inputs.", source: "Amabile & Kramer, 2011 · The Progress Principle" },
    ],
  };

  const scienceCards = BURNOUT_SCIENCE[burnoutPattern] || BURNOUT_SCIENCE["fumes"];

  function buildEnergyMapFromAnswers(peak, dip, evening) {
    const levels = {
      '00:00':'Low','02:00':'Low','04:00':'Low',
      '06:00':'Low','08:00':'Medium','10:00':'Medium',
      '12:00':'Medium','14:00':'Medium','16:00':'Medium',
      '18:00':'Medium','20:00':'Low','22:00':'Low',
    };
    if (peak === 'early')        { levels['06:00']='Medium'; levels['08:00']='High'; levels['10:00']='High'; }
    if (peak === 'late-morning') { levels['08:00']='Medium'; levels['10:00']='High'; levels['12:00']='High'; }
    if (peak === 'afternoon')    { levels['14:00']='High';   levels['16:00']='High'; levels['12:00']='Medium'; }
    if (peak === 'night')        { levels['18:00']='High';   levels['20:00']='High'; levels['22:00']='Medium'; }
    if (dip === 'hard'   && peak !== 'afternoon') { levels['14:00']='Low'; }
    if (dip === 'little' && peak !== 'afternoon' && levels['14:00'] !== 'High') { levels['14:00']='Low'; }
    if (evening === 'fade')        { if (peak !== 'night') { levels['18:00']='Low'; levels['20:00']='Low'; levels['22:00']='Low'; } }
    if (evening === 'second-wind') { levels['20:00']='High'; levels['22:00']='Medium'; if (levels['18:00']==='Low') levels['18:00']='Medium'; }
    return EMAP_BLOCKS.map(t => ({ time: t, level: levels[t] || 'Low' }));
  }

  const previewMap = (mapPeak || mapDip || mapEvening)
    ? buildEnergyMapFromAnswers(mapPeak || 'late-morning', mapDip || 'little', mapEvening || 'fade')
    : null;

  // Step 0 — Welcome
  if (step === 0) return (
    <div className="onboard-wrap">
      <div className="onboard-card" style={{ textAlign:"center" }}>
        <div style={{ marginBottom:24, display:"flex", justifyContent:"center" }}><BatteryMascot level={100} size={80} /></div>
        <div className="onboard-eyebrow">Your energy. Your rules.</div>
        <div className="onboard-title" style={{ fontSize:30, marginBottom:14 }}>You're not lazy.<br />You're running on empty.</div>
        <div className="onboard-sub" style={{ marginBottom:8 }}>Most productivity apps tell you to do more.<br />MyBattery tells you when to stop — and the science to back it up.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, margin:"28px auto 0", maxWidth:340 }}>
          {[
            { icon:"shield",  text:"100% private — your data never leaves your device" },
            { icon:"leaf",    text:"Built on peer-reviewed research, not hustle culture" },
            { icon:"heart",   text:"Designed to protect, not push" },
            { icon:"bolt",    text:"Built with neurodivergent minds in mind — ADHD, autism & sensory differences welcome" },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"rgba(90,122,90,0.06)", borderRadius:"var(--radius-sm)", textAlign:"left" }}>
              <Icon name={icon} size={16} style={{color:"var(--teal-dark)", flexShrink:0}} />
              <span style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.4 }}>{text}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, marginTop:32 }}>
          <button className="btn-primary" style={{ fontSize:15, padding:"14px 40px" }} onClick={() => setStep(1)}>Begin my journey →</button>
          <button className="btn-skip" onClick={skip}>Skip setup — use defaults</button>
        </div>
      </div>
    </div>
  );

  // Step 1 — Name
  if (step === 1) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 1 of {TOTAL} — Let's begin</div>
        <div className="onboard-title">What do we call you?</div>
        <div className="onboard-sub">This is just for you — a name that greets you every morning.<br />Nothing else uses it.</div>
        <input
          className="onboard-name-input"
          placeholder="First name…"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && userName.trim() && setStep(2)}
          autoFocus
        />
        {userName.trim() && (
          <div style={{ background:"rgba(90,122,90,0.06)", borderRadius:"var(--radius-sm)", padding:"14px 18px", fontSize:14, color:"var(--teal-dark)", lineHeight:1.6, marginBottom:28, textAlign:"center", fontFamily:"'Playfair Display',serif", fontStyle:"italic" }}>
            Hi {userName.trim()} — let's build something that actually works for you.
          </div>
        )}
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(0)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(2)}>
            {userName.trim() ? `That's me — continue →` : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );

  // Step 2 — What brought you here
  if (step === 2) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 2 of {TOTAL} — Your moment</div>
        <div className="onboard-title">{userName.trim() ? `${userName.trim()}, what\nbrought you here today?` : "What brought you here today?"}</div>
        <div className="onboard-sub">There's no agenda behind this question — it just helps us start in the right place for you.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:8 }}>
          {ARRIVED_OPTIONS.map(o => (
            <div key={o.id}
              className={`profile-option ${arrivedBecause===o.id?"selected":""}`}
              onClick={() => setArrivedBecause(o.id)}
              style={{ display:"flex", alignItems:"flex-start", gap:16, padding:"16px 18px" }}
            >
              <div style={{ flexShrink:0, width:38, height:38, borderRadius:"50%", background:"rgba(90,122,90,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name={o.icon} size={18} style={{color:"var(--teal-dark)"}} />
              </div>
              <div>
                <div className="profile-name" style={{ marginBottom:3 }}>{o.label}</div>
                <div className="profile-hint">{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
        {arrivedBecause && (
          <div className="capacity-suggestion" style={{ marginTop:12 }}>
            {arrivedResponses[arrivedBecause]}
          </div>
        )}
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(1)}>← Back</button>
          <button className="btn-primary" disabled={!arrivedBecause} onClick={() => setStep(3)}>That's why →</button>
        </div>
      </div>
    </div>
  );

  // Step 3 — Neurodivergent inclusion
  const ND_CARDS = [
    { id:"hyperfocus", icon:"bolt",     label:"My focus isn't linear",              sub:"I hyperfocus intensely, or I can't start at all. The middle setting barely exists." },
    { id:"recovery",   icon:"moon",     label:"I need more recovery time than most", sub:"Social demands, sensory load, or just a busy day cost me more energy than they seem to cost others." },
    { id:"crashes",    icon:"battery",  label:"My energy crashes harder and longer",  sub:"When I hit a wall, it's a full system shutdown — not just tiredness." },
    { id:"outside9to5",icon:"sun",      label:"I work outside conventional hours",   sub:"My best thinking happens when the world expects me to be offline — or asleep." },
  ];
  if (step === 3) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <div style={{ width:60, height:60, borderRadius:"50%", background:"rgba(90,122,90,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name="bolt" size={26} style={{color:"var(--teal-dark)"}} />
          </div>
        </div>
        <div className="onboard-eyebrow">Step 3 of {TOTAL} — You belong here</div>
        <div className="onboard-title">Built for every brain.<br />Especially the ones that never fit the system.</div>
        <div className="onboard-sub">MyBattery was built for everyone — but it was <em>designed</em> with neurodivergent minds at the centre. ADHD, autism, sensory differences, and non-linear energy patterns aren't bugs to fix. They're the blueprint.</div>
        <div style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.65, marginBottom:16, textAlign:"center" }}>
          Do any of these sound like you? <span style={{ color:"var(--ink-mute)", fontSize:12 }}>(tap any that resonate — nothing is required)</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
          {ND_CARDS.map(c => {
            const selected = ndResonance.includes(c.id);
            return (
              <div key={c.id}
                onClick={() => setNdResonance(prev => selected ? prev.filter(x=>x!==c.id) : [...prev, c.id])}
                style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"14px 16px", borderRadius:"var(--radius-sm)", border:`2px solid ${selected ? "var(--teal-dark)" : "var(--warm)"}`, background: selected ? "rgba(90,122,90,0.05)" : "var(--cream)", cursor:"pointer", transition:"all 0.2s" }}
              >
                <div style={{ flexShrink:0, width:36, height:36, borderRadius:"50%", background: selected ? "rgba(90,122,90,0.15)" : "rgba(90,122,90,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name={c.icon} size={17} style={{color:"var(--teal-dark)"}} />
                </div>
                <div>
                  <div className="profile-name" style={{ marginBottom:3 }}>{c.label}</div>
                  <div className="profile-hint">{c.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background:"rgba(196,168,130,0.1)", borderLeft:"3px solid var(--slate-light)", borderRadius:"var(--radius-sm)", padding:"13px 16px", fontSize:13, color:"var(--ink-soft)", lineHeight:1.65, marginBottom:28 }}>
          Whether or not any of these fit a label — MyBattery adapts to <em>your</em> nervous system. Not the other way around.
        </div>
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(2)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(4)}>This speaks to me →</button>
        </div>
      </div>
    </div>
  );

  // Step 4 — BAT-12 short form (Schaufeli, De Witte & Desart, 2019)
  const QUIZ_QUESTIONS = [
    { q: "I feel mentally exhausted." },
    { q: "At the end of the day, I find it hard to recover." },
    { q: "I feel physically exhausted." },
    { q: "I struggle to find any enthusiasm for my work." },
    { q: "I feel a strong aversion towards my job." },
    { q: "I'm cynical about what my work means to others." },
    { q: "I have trouble staying focused." },
    { q: "I have trouble concentrating." },
    { q: "I make mistakes because I have my mind on other things." },
    { q: "I feel unable to control my emotions." },
    { q: "I do not recognize myself in the way I react emotionally." },
    { q: "I may overreact unintentionally." },
  ];
  const QUIZ_SUBSCALES = [
    { name: "Exhaustion",           items: [0,1,2]    },
    { name: "Mental Distance",      items: [3,4,5]    },
    { name: "Cognitive Impairment", items: [6,7,8]    },
    { name: "Emotional Impairment", items: [9,10,11]  },
  ];
  const QUIZ_OPTIONS = ["Never", "Rarely", "Sometimes", "Often", "Always"];
  const QUIZ_TIERS = [
    { id:"recovering", min:1.00, max:2.53, label:"No-low risk of burnout",   color:"var(--teal-dark)",  icon:"leaf",    desc:"Burnout is not likely an issue right now. The work is staying ahead of it — protecting your energy before the wall finds you.", next:"never-stop" },
    { id:"moderate",   min:2.54, max:2.95, label:"Moderate risk of burnout", color:"var(--slate-dark)", icon:"sun",     desc:"You may benefit from support or some changes. The patterns are forming — we can help interrupt them before they compound.", next:"never-stop" },
    { id:"high",       min:2.96, max:3.74, label:"High risk of burnout",     color:"var(--error)",      icon:"battery", desc:"Your system is significantly depleted. This level doesn't resolve itself with willpower — it needs a structured recovery plan.", next:"wired-tired" },
    { id:"severe",     min:3.75, max:5.00, label:"High risk of burnout",     color:"var(--error)",      icon:"wind",    desc:"You're running on fumes — and have been for a while. The fact that you're here is meaningful. This is where we start.", next:"fumes" },
  ];
  function derivePatternFromQuiz(avg) {
    if (avg >= 3.75) return "fumes";
    if (avg >= 2.96) return "wired-tired";
    return "never-stop";
  }
  function recordQuizAnswer(qIdx, val) {
    const updated = { ...quizAnswers, [qIdx]: val };
    setQuizAnswers(updated);
    if (qIdx < QUIZ_QUESTIONS.length - 1) {
      setTimeout(() => setQuizQuestion(qIdx + 1), 280);
    } else {
      const avg = Object.values(updated).reduce((s, v) => s + (v + 1), 0) / QUIZ_QUESTIONS.length;
      const rounded = Math.round(avg * 10) / 10;
      const tier = QUIZ_TIERS.find(t => avg >= t.min && avg <= t.max) || QUIZ_TIERS[1];
      setQuizScore(rounded);
      setQuizTier(tier.id);
      setBurnoutPattern(tier.next || derivePatternFromQuiz(avg));
      setTimeout(() => setQuizQuestion(QUIZ_QUESTIONS.length), 320);
    }
  }
  const currentQ = QUIZ_QUESTIONS[quizQuestion];
  const currentTier = QUIZ_TIERS.find(t => t.id === quizTier);
  if (step === 4) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        {quizQuestion < QUIZ_QUESTIONS.length ? (
          <>
            <div className="onboard-eyebrow">Step 4 of {TOTAL} — Burnout assessment · Q{quizQuestion + 1} of {QUIZ_QUESTIONS.length}</div>
            <div style={{ height:4, background:"var(--warm)", borderRadius:2, marginBottom:32, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"var(--teal-dark)", borderRadius:2, width:`${((quizQuestion) / QUIZ_QUESTIONS.length) * 100}%`, transition:"width 0.3s ease" }} />
            </div>
            <div className="onboard-title" style={{ fontSize:22, marginBottom:28 }}>{currentQ.q}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
              {QUIZ_OPTIONS.map((label, i) => {
                const selected = quizAnswers[quizQuestion] === i;
                return (
                  <button key={label}
                    onClick={() => recordQuizAnswer(quizQuestion, i)}
                    style={{ padding:"14px 20px", borderRadius:"var(--radius-sm)", border:`2px solid ${selected ? "var(--teal-dark)" : "var(--warm)"}`, background: selected ? "rgba(90,122,90,0.06)" : "var(--cream)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"var(--ink)", textAlign:"left", transition:"all 0.15s", display:"flex", alignItems:"center", gap:12 }}
                  >
                    <span style={{ width:22, height:22, borderRadius:"50%", border:`2px solid ${selected ? "var(--teal-dark)" : "var(--warm)"}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {selected && <span style={{ width:10, height:10, borderRadius:"50%", background:"var(--teal-dark)" }} />}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="onboard-actions">
              <button className="btn-back" onClick={() => {
                if (quizQuestion === 0) setStep(3);
                else setQuizQuestion(q => q - 1);
              }}>← Back</button>
              <span style={{ fontSize:12, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace" }}>{quizQuestion + 1} / {QUIZ_QUESTIONS.length}</span>
            </div>
          </>
        ) : (
          <>
            <div className="onboard-eyebrow">Step 4 of {TOTAL} — Your results</div>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
                <div style={{ width:72, height:72, borderRadius:"50%", background:`rgba(90,122,90,0.1)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name={currentTier?.icon || "leaf"} size={32} style={{color: currentTier?.color || "var(--teal-dark)"}} />
                </div>
              </div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:"2px", textTransform:"uppercase", color: currentTier?.color || "var(--teal-dark)", marginBottom:8 }}>{currentTier?.label}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:52, lineHeight:1, color: currentTier?.color || "var(--teal-dark)", marginBottom:4 }}>{quizScore?.toFixed(1)}</div>
              <div style={{ fontSize:12, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace" }}>average out of 5.0</div>
            </div>
            <div style={{ background:"rgba(90,122,90,0.06)", borderRadius:"var(--radius-sm)", padding:"16px 18px", fontSize:14, color:"var(--ink)", lineHeight:1.7, marginBottom:20, borderLeft:"3px solid var(--teal-light)" }}>
              {currentTier?.desc}
            </div>
            <div style={{ marginBottom:20 }}>
              {QUIZ_SUBSCALES.map(sub => {
                const subAvg = sub.items.reduce((s, i) => s + (quizAnswers[i] ?? 0) + 1, 0) / sub.items.length;
                const pct = ((subAvg - 1) / 4) * 100;
                return (
                  <div key={sub.name} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                    <div style={{ fontSize:12, color:"var(--ink-soft)", minWidth:152, flexShrink:0 }}>{sub.name}</div>
                    <div style={{ flex:1, height:6, background:"var(--warm)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", background: pct >= 49 ? "var(--error)" : "var(--teal-dark)", borderRadius:3, width:`${pct}%`, transition:"width 0.4s ease" }} />
                    </div>
                    <div style={{ fontSize:12, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace", minWidth:28, textAlign:"right" }}>{subAvg.toFixed(1)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ background:"rgba(196,168,130,0.1)", borderLeft:"3px solid var(--slate-light)", borderRadius:"var(--radius-sm)", padding:"12px 16px", fontSize:12, color:"var(--ink-soft)", lineHeight:1.6, marginBottom:28 }}>
              This isn't a clinical diagnosis — it's a starting point. MyBattery will calibrate your plan around this score and adjust as you use it. <em>Based on the Burnout Assessment Tool (BAT-12); Schaufeli, De Witte & Desart, 2019.</em>
            </div>
            <div className="onboard-actions">
              <button className="btn-back" onClick={() => { setQuizQuestion(QUIZ_QUESTIONS.length - 1); }}>← Retake</button>
              <button className="btn-primary" onClick={() => setStep(5)}>This tracks — continue →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Step 5 — Personalised science (was step 4)
  if (step === 5) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 5 of {TOTAL} — The science behind it</div>
        <div className="onboard-title">This isn't a character flaw.<br />It's biology.</div>
        <div className="onboard-sub" style={{ marginBottom:20 }}>
          Your score reflects a real, measurable pattern. Here's what the research says about it.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
          {scienceCards.map(({ stat, detail, source }) => (
            <div key={stat} style={{ display:"flex", alignItems:"flex-start", gap:16, background:"rgba(90,122,90,0.06)", borderRadius:"var(--radius-sm)", padding:"14px 16px" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:400, color:"var(--teal-dark)", flexShrink:0, lineHeight:1, minWidth:44, textAlign:"center" }}>{stat}</div>
              <div>
                <div style={{ fontSize:13, color:"var(--ink)", lineHeight:1.55 }}>{detail}</div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", marginTop:5 }}>{source}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:"rgba(196,168,130,0.1)", borderRadius:"var(--radius-sm)", padding:"14px 18px", fontSize:13, color:"var(--ink-soft)", lineHeight:1.65, marginBottom:28, borderLeft:"3px solid var(--slate-light)" }}>
          <strong style={{color:"var(--ink)"}}>The most powerful thing you can do isn't hustle harder.</strong> It's learning to read your own depletion signals — before they become irreversible.
        </div>
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(4)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(6)}>I want to change this →</button>
        </div>
      </div>
    </div>
  );

  // Step 6 — Reclaiming identity
  if (step === 6) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">A moment for you · Step 6 of {TOTAL}</div>
        <div className="onboard-title" style={{ fontFamily:"'Playfair Display',serif" }}>
          You are not<br />your burnout.
        </div>
        <div className="onboard-sub">
          Burnout has a way of making you feel like you <em>are</em> your exhaustion. Before we build anything, let's remember who you actually are.
        </div>

        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--ink)", marginBottom:10 }}>
            What matters to you at your core? Pick up to 5.
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {["Creativity","Connection","Peace","Family","Growth","Learning","Freedom",
              "Health","Play","Honesty","Courage","Nature","Humor","Service","Curiosity","Simplicity"]
              .map(v => (
                <button key={v}
                  style={{ background: identityValues.includes(v) ? "var(--teal-dark)" : "var(--card)", color: identityValues.includes(v) ? "white" : "var(--ink-soft)", border: `1.5px solid ${identityValues.includes(v) ? "var(--teal-dark)" : "var(--warm)"}`, borderRadius:40, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}
                  onClick={() => setIdentityValues(prev =>
                    prev.includes(v) ? prev.filter(x => x !== v) : prev.length < 5 ? [...prev, v] : prev
                  )}>
                  {v}
                </button>
            ))}
          </div>
          {identityValues.length > 0 && (
            <div style={{ fontSize:11, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace", marginTop:8 }}>
              {identityValues.length} of 5 selected
            </div>
          )}
        </div>

        <div style={{ marginBottom:8, fontSize:13, fontWeight:500, color:"var(--ink)" }}>
          Outside of everything that's been weighing on you — what's one thing that still feels like you?
        </div>
        <textarea
          className="journal-textarea"
          style={{ marginBottom:4, maxHeight:140 }}
          placeholder="e.g. I love cooking for people, I get lost in music, I'm the one who remembers everyone's birthday…"
          value={identityStatement}
          onChange={e => { setIdentityStatement(e.target.value); autoGrow(e.target); }}
          onInput={e => autoGrow(e.target)}
        />
        <div style={{ fontSize:11, color:"var(--ink-mute)", fontStyle:"italic", marginBottom:24 }}>
          Optional — skip if you're not ready.
        </div>

        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(5)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(7)}>Continue →</button>
        </div>
      </div>
    </div>
  );

  // Step 7 — What would you reclaim
  if (step === 7) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 7 of {TOTAL} — Your reason</div>
        <div className="onboard-title">If you had your energy back —<br />what would you do with it?</div>
        <div className="onboard-sub">This becomes your anchor. On hard days, it's the reason you protect your energy instead of spending it all.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:8 }}>
          {WANT_BACK_OPTIONS.map(o => (
            <div key={o.id}
              className={`profile-option ${wantBack===o.id?"selected":""}`}
              onClick={() => setWantBack(o.id)}
              style={{ display:"flex", alignItems:"flex-start", gap:16, padding:"15px 18px" }}
            >
              <div style={{ flexShrink:0, width:36, height:36, borderRadius:"50%", background:"rgba(90,122,90,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name={o.icon} size={17} style={{color:"var(--teal-dark)"}} />
              </div>
              <div>
                <div className="profile-name" style={{ marginBottom:3 }}>{o.label}</div>
                <div className="profile-hint">{o.sub}</div>
              </div>
            </div>
          ))}
        </div>
        {wantBack && (
          <div style={{ background:"rgba(90,122,90,0.06)", border:"1px solid rgba(90,122,90,0.18)", borderRadius:"var(--radius-sm)", padding:"14px 18px", fontSize:13, color:"var(--teal-dark)", lineHeight:1.65, marginTop:12, fontStyle:"italic" }}>
            That's worth protecting. Every choice MyBattery helps you make is in service of that.
          </div>
        )}
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(6)}>← Back</button>
          <button className="btn-primary" disabled={!wantBack} onClick={() => setStep(8)}>That's what I'm working toward →</button>
        </div>
      </div>
    </div>
  );

  // Step 8 — Battery reveal
  if (step === 8) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 8 of {TOTAL} — The battery</div>
        <div className="onboard-title">Right now —<br />how full is your tank?</div>
        <div className="onboard-sub">Not tomorrow, not on a good day. Right now. Drag to wherever feels honest — there's no right answer.</div>
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14 }}>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:48, lineHeight:1, color: battColor }}>{initBatt}%</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--ink-mute)", marginTop:4 }}>{battLabel}</div>
            </div>
            <div><Icon name={battEmoji} size={32} style={{color: battColor}} /></div>
          </div>
          <div style={{ position:"relative", marginBottom:8 }}>
            <div style={{ height:14, borderRadius:8, background:"var(--warm)", overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:8, background: battColor, width:`${initBatt}%`, transition:"width 0.25s ease, background 0.25s ease" }} />
            </div>
            <input type="range" min={0} max={100} step={5} value={initBatt} onChange={e => setInitBatt(Number(e.target.value))}
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0, cursor:"pointer", margin:0 }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)" }}>
            <span>empty</span><span>← drag to set your starting level →</span><span>full</span>
          </div>
        </div>
        <div className="capacity-suggestion" style={{ marginBottom:16 }}>{batteryContextMessage}</div>
        <div style={{ background:"rgba(90,122,90,0.06)", borderRadius:"var(--radius-sm)", padding:"14px 16px", fontSize:13, color:"var(--ink-soft)", lineHeight:1.6, marginBottom:28, borderLeft:"3px solid var(--teal-light)" }}>
          This number isn't a judgment. MyBattery adjusts your tasks, pacing, and nudges to protect wherever you are today.
        </div>
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(7)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(9)}>This is where I am →</button>
        </div>
      </div>
    </div>
  );

  // Step 9 — Work profile
  if (step === 9) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 9 of {TOTAL} — Help us protect you</div>
        <div className="onboard-title">What kind of work<br />fills your days?</div>
        <div className="onboard-sub">Different work drains energy differently. This shapes your personal task limits — because one size never fits all.</div>
        <div className="profile-grid">
          {PROFILES.map(p => (
            <div key={p.id} className={`profile-option ${prof?.id===p.id?"selected":""}`} onClick={() => pickProf(p)} {...asButton(() => pickProf(p), "radio", { "aria-checked": prof?.id===p.id })}>
              <span className="profile-baseline">peak ~{p.baseline}</span>
              <span className="profile-icon"><Icon name={p.icon} size={24} style={{color:"var(--teal-dark)"}} /></span>
              <div className="profile-name">{p.name}</div>
              <div className="profile-hint">{p.hint}</div>
            </div>
          ))}
        </div>
        {prof && (
          <>
            <div style={{ borderTop:"1px solid var(--warm)", margin:"0 0 24px" }} />
            <div style={{ background:"rgba(90,122,90,0.07)", border:"1px solid rgba(90,122,90,0.18)", borderLeft:"3px solid var(--teal-dark)", borderRadius:"var(--radius-sm)", padding:"12px 14px", marginBottom:20 }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--teal-dark)", marginBottom:6 }}>The science behind your limit</div>
              <div style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.65 }}>{prof.science}</div>
              {prof.scienceUrl && <a href={prof.scienceUrl} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block", marginTop:8, fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--teal-dark)", letterSpacing:"0.5px", textDecoration:"underline", textUnderlineOffset:3 }}>View source →</a>}
            </div>
            <div className="onboard-eyebrow" style={{ marginBottom:10 }}>On a strong day, how many tasks do you actually complete?</div>
            <div className="capacity-display">
              <div className="capacity-num">{peak ?? prof.baseline}</div>
              <div className="capacity-label">tasks completed</div>
            </div>
            <div className="capacity-slider-wrap">
              <input type="range" min={2} max={12} step={1} className="capacity-slider"
                value={peak ?? prof.baseline} onChange={e => setPeak(Number(e.target.value))} />
              <div className="capacity-scale"><span>2 — light</span><span>7 — solid</span><span>12 — high output</span></div>
            </div>
            {peak !== null && (
              <div className="capacity-suggestion">
                {peak > prof.baseline+2 ? "That's a high output. MyBattery will honour that ceiling — and make sure you don't blow past it." : peak < prof.baseline-1 ? "Fewer tasks, done well. Micro-wins compound. We'll keep it honest." : "This matches your profile's typical range. A solid starting point."}
              </div>
            )}
          </>
        )}
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(8)}>← Back</button>
          <button className="btn-primary" disabled={!prof} onClick={() => setStep(10)}>Protect me at this level →</button>
        </div>
      </div>
    </div>
  );

  // Step 10 — Rhythm
  if (step === 10) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 10 of {TOTAL} — Your natural flow</div>
        <div className="onboard-title">How does your<br />best day actually feel?</div>
        <div className="onboard-sub">Not how you wish it was — how it actually runs. This shapes how we sequence tasks around your energy, not the other way around.</div>
        <div className="rhythm-options">
          {RHYTHMS.map(r => (
            <div key={r.id} className={`rhythm-option ${rhythm===r.id?"selected":""}`} onClick={() => setRhythm(r.id)} {...asButton(() => setRhythm(r.id), "radio", { "aria-checked": rhythm===r.id })}>
              <span className="rhythm-icon"><Icon name={r.icon} size={18} style={{color:"var(--teal-dark)"}} /></span>
              <div><div className="rhythm-name">{r.name}</div><div className="rhythm-desc">{r.desc}</div></div>
            </div>
          ))}
        </div>
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(9)}>← Back</button>
          <button className="btn-primary" disabled={!rhythm} onClick={() => setStep(11)}>This is my rhythm →</button>
        </div>
      </div>
    </div>
  );

  // Step 11 — Energy map builder
  const MAP_PEAK_OPTIONS = [
    { id:"early",        icon:"sun",     label:"Early bird",       sub:"I peak in the early morning — 6–9am is my sharpest window." },
    { id:"late-morning", icon:"bolt",    label:"Late morning",     sub:"I hit my stride around 9am–noon. Mornings need a warm-up." },
    { id:"afternoon",    icon:"leaf",    label:"Afternoon",        sub:"I'm slow to start. By 1–5pm I'm finally in the zone." },
    { id:"night",        icon:"moon",    label:"Night owl",        sub:"I come alive after dinner. My best thinking happens late." },
  ];
  const MAP_DIP_OPTIONS = [
    { id:"hard",   label:"Yes — 2pm is basically nap time for me" },
    { id:"little", label:"A little, but I push through it" },
    { id:"no",     label:"Not really — I stay fairly even" },
  ];
  const MAP_EVENING_OPTIONS = [
    { id:"fade",        label:"I fade early — done by 7–8pm" },
    { id:"second-wind", label:"I get a second wind in the evening" },
    { id:"steady",      label:"I stay steady until I decide to stop" },
  ];
  const LEVEL_LABEL = { High:"Peak", Medium:"Good", Low:"Rest" };
  const LEVEL_COLOR = { High:"var(--teal-dark)", Medium:"var(--slate-dark)", Low:"var(--ink-mute)" };
  const LEVEL_BG    = { High:"rgba(90,122,90,0.18)", Medium:"rgba(196,168,130,0.18)", Low:"rgba(196,212,196,0.1)" };
  if (step === 11) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 11 of {TOTAL} — Map your day</div>
        <div className="onboard-title">When does your brain<br />actually work best?</div>
        <div className="onboard-sub">Answer three quick questions and we'll fill in your energy map automatically — no manual setup needed.</div>

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)", marginBottom:10 }}>When do you feel sharpest?</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {MAP_PEAK_OPTIONS.map(o => (
              <div key={o.id} onClick={() => setMapPeak(o.id)} {...asButton(() => setMapPeak(o.id), "radio", { "aria-checked": mapPeak===o.id })}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", borderRadius:"var(--radius-sm)", border:`2px solid ${mapPeak===o.id?"var(--teal-dark)":"var(--warm)"}`, background:mapPeak===o.id?"rgba(90,122,90,0.05)":"var(--cream)", cursor:"pointer", transition:"all 0.15s" }}
              >
                <Icon name={o.icon} size={16} style={{color:"var(--teal-dark)", flexShrink:0}} />
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:"var(--ink)" }}>{o.label}</div>
                  <div style={{ fontSize:11, color:"var(--ink-mute)", lineHeight:1.4 }}>{o.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)", marginBottom:10 }}>Do you get an afternoon slump?</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {MAP_DIP_OPTIONS.map(o => (
              <div key={o.id} onClick={() => setMapDip(o.id)} {...asButton(() => setMapDip(o.id), "radio", { "aria-checked": mapDip===o.id })}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:"var(--radius-sm)", border:`2px solid ${mapDip===o.id?"var(--teal-dark)":"var(--warm)"}`, background:mapDip===o.id?"rgba(90,122,90,0.05)":"var(--cream)", cursor:"pointer", transition:"all 0.15s" }}
              >
                <span style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${mapDip===o.id?"var(--teal-dark)":"var(--warm)"}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {mapDip===o.id && <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--teal-dark)" }} />}
                </span>
                <span style={{ fontSize:13, color:"var(--ink)" }}>{o.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)", marginBottom:10 }}>How does your energy end the day?</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {MAP_EVENING_OPTIONS.map(o => (
              <div key={o.id} onClick={() => setMapEvening(o.id)} {...asButton(() => setMapEvening(o.id), "radio", { "aria-checked": mapEvening===o.id })}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:"var(--radius-sm)", border:`2px solid ${mapEvening===o.id?"var(--teal-dark)":"var(--warm)"}`, background:mapEvening===o.id?"rgba(90,122,90,0.05)":"var(--cream)", cursor:"pointer", transition:"all 0.15s" }}
              >
                <span style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${mapEvening===o.id?"var(--teal-dark)":"var(--warm)"}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {mapEvening===o.id && <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--teal-dark)" }} />}
                </span>
                <span style={{ fontSize:13, color:"var(--ink)" }}>{o.label}</span>
              </div>
            ))}
          </div>
        </div>

        {previewMap && (
          <div style={{ marginBottom:28 }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--teal-dark)", marginBottom:12, textAlign:"center" }}>Your energy map — auto-filled</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6 }}>
              {previewMap.map(({ time, level }) => (
                <div key={time} style={{ background:LEVEL_BG[level], border:`1.5px solid ${LEVEL_COLOR[level]}33`, borderRadius:8, padding:"8px 4px", textAlign:"center", transition:"all 0.3s ease" }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"var(--ink-mute)", marginBottom:4 }}>{formatEmapHour(time)}</div>
                  <div style={{ fontSize:10, fontWeight:600, color:LEVEL_COLOR[level], fontFamily:"'DM Mono',monospace" }}>{LEVEL_LABEL[level]}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, color:"var(--ink-mute)", textAlign:"center", marginTop:10, lineHeight:1.5 }}>
              You can fine-tune this anytime in Settings.
            </div>
          </div>
        )}

        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(10)}>← Back</button>
          <button className="btn-primary" disabled={!mapPeak || !mapDip || !mapEvening}
            onClick={() => { setEnergyMap(buildEnergyMapFromAnswers(mapPeak, mapDip, mapEvening)); setStep(12); }}>
            {previewMap ? "This looks right →" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );

  // Step 12 — Privacy spotlight
  if (step === 12) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(90,122,90,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name="shield" size={30} style={{color:"var(--teal-dark)"}} />
          </div>
        </div>
        <div className="onboard-eyebrow">Step 12 of {TOTAL} — Your privacy</div>
        <div className="onboard-title">Everything you share<br />stays with you.</div>
        <div className="onboard-sub">Before you go further, we want to be completely transparent about where your data goes — and where it doesn't.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
          {[
            { icon:"lock",    heading:"Stays on your device", body:"Your moods, tasks, battery levels, and personal reflections are stored locally. Nothing is uploaded to a server." },
            { icon:"eye",     heading:"Never sold or shared", body:"We don't sell data to advertisers. We don't share it with third parties. Full stop." },
            { icon:"leaf",    heading:"No account required", body:"You don't need to create an account or verify an email. There's no profile to breach." },
            { icon:"trash",   heading:"Delete it anytime",   body:"You control your data completely. Reset or wipe it from settings at any time — permanently and immediately." },
          ].map(({ icon, heading, body }) => (
            <div key={heading} style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"14px 16px", background:"rgba(90,122,90,0.05)", border:"1px solid rgba(90,122,90,0.12)", borderRadius:"var(--radius-sm)" }}>
              <div style={{ flexShrink:0, width:34, height:34, borderRadius:"50%", background:"rgba(90,122,90,0.12)", display:"flex", alignItems:"center", justifyContent:"center", marginTop:1 }}>
                <Icon name={icon} size={16} style={{color:"var(--teal-dark)"}} />
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--ink)", marginBottom:3 }}>{heading}</div>
                <div style={{ fontSize:12, color:"var(--ink-soft)", lineHeight:1.55 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:"rgba(196,168,130,0.1)", borderLeft:"3px solid var(--slate-light)", borderRadius:"var(--radius-sm)", padding:"13px 16px", fontSize:13, color:"var(--ink-soft)", lineHeight:1.6, marginBottom:28 }}>
          The things you share here are personal. That's why we built this so nothing has to leave your hands.
        </div>
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(11)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(13)}>I trust this — continue →</button>
        </div>
      </div>
    </div>
  );

  // Step 13 — Health disclaimer
  if (step === 13) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 13 of {TOTAL} — Our commitment to you</div>
        <div className="onboard-title">Before we hand you the keys.</div>
        <div className="onboard-sub">Being honest with you is how we earn your trust — so here's what MyBattery is, and what it isn't.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
          {[
            { icon:"check-circle", positive:true,  text:"A daily wellness companion grounded in real science" },
            { icon:"check-circle", positive:true,  text:"A system that protects your energy and reflects it back to you" },
            { icon:"check-circle", positive:true,  text:"A tool you control completely — adjust anything, anytime" },
            { icon:"x-circle",     positive:false, text:"Not a medical device or mental health treatment" },
            { icon:"x-circle",     positive:false, text:"Not a replacement for professional healthcare" },
          ].map(({ icon, positive, text }) => (
            <div key={text} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background: positive ? "rgba(90,122,90,0.05)" : "rgba(196,168,130,0.08)", borderRadius:"var(--radius-sm)", border:`1px solid ${positive ? "rgba(90,122,90,0.12)" : "rgba(196,168,130,0.2)"}` }}>
              <Icon name={icon} size={16} style={{color: positive ? "var(--teal-dark)" : "var(--slate-dark)", flexShrink:0}} />
              <span style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.4 }}>{text}</span>
            </div>
          ))}
        </div>
        <label style={{ display:"flex", gap:"0.75rem", alignItems:"flex-start", cursor:"pointer", marginBottom:28, padding:"14px 16px", background:"rgba(90,122,90,0.06)", borderRadius:"var(--radius-sm)", border:"1px solid rgba(90,122,90,0.15)" }}>
          <input
            type="checkbox"
            checked={disclaimerAcknowledged}
            onChange={e => setDisclaimerAcknowledged(e.target.checked)}
            style={{ marginTop:3, accentColor:"var(--teal-dark)", width:16, height:16, flexShrink:0 }}
          />
          <span style={{ fontSize:13, color:"var(--ink)", lineHeight:1.6 }}>I understand MyBattery is a wellness tool, not medical advice. If I'm struggling with my mental health, I'll reach out to a professional.</span>
        </label>
        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(12)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(14)} disabled={!disclaimerAcknowledged}>I understand — let's go →</button>
        </div>
      </div>
    </div>
  );

  // Step 14 — Demographics
  if (step === 14) return (
    <div className="onboard-wrap">
      <div className="onboard-progress">{dots}</div>
      <div className="onboard-card">
        <div className="onboard-eyebrow">Step 14 of {TOTAL} — Almost there</div>
        <div className="onboard-title">Help us serve<br />people like you better.</div>
        <div className="onboard-sub">These optional questions help us understand who uses MyBattery so we can build a more inclusive experience for everyone. Skip anything — no judgement.</div>

        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--ink)", marginBottom:10 }}>How old are you?</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {["Under 18","18–24","25–34","35–44","45–54","55–64","65+"].map(r => (
              <button key={r}
                className={`sd-ml-chip${demoAge===r?" active":""}`}
                style={{ background: demoAge===r ? "var(--teal-dark)" : "var(--card)", color: demoAge===r ? "white" : "var(--ink-soft)", border: `1.5px solid ${demoAge===r ? "var(--teal-dark)" : "var(--warm)"}`, borderRadius:40, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}
                onClick={() => setDemoAge(r)}>{r}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--ink)", marginBottom:10 }}>How do you identify?</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {["Woman","Man","Non-binary","Genderfluid","Prefer not to say"].map(g => (
              <button key={g}
                className={`sd-ml-chip${demoGender===g?" active":""}`}
                style={{ background: demoGender===g ? "var(--teal-dark)" : "var(--card)", color: demoGender===g ? "white" : "var(--ink-soft)", border: `1.5px solid ${demoGender===g ? "var(--teal-dark)" : "var(--warm)"}`, borderRadius:40, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}
                onClick={() => setDemoGender(g)}>{g}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:500, color:"var(--ink)", marginBottom:10 }}>Do you live with or manage a mental health condition?</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {["Yes","No","Rather not say"].map(o => (
              <button key={o}
                className={`sd-ml-chip${demoMH===o?" active":""}`}
                style={{ background: demoMH===o ? "var(--teal-dark)" : "var(--card)", color: demoMH===o ? "white" : "var(--ink-soft)", border: `1.5px solid ${demoMH===o ? "var(--teal-dark)" : "var(--warm)"}`, borderRadius:40, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}
                onClick={() => setDemoMH(o)}>{o}</button>
            ))}
          </div>
        </div>

        <div style={{ background:"rgba(90,122,90,0.07)", border:"1px solid rgba(90,122,90,0.2)", borderRadius:"var(--radius-sm)", padding:"14px 16px", marginBottom:28 }}>
          <div style={{ fontSize:12, color:"var(--teal-dark)", fontWeight:500, marginBottom:4, display:"flex", alignItems:"center", gap:6 }}><Icon name="shield" size={13} />Fully protected — stays on your device</div>
          <div style={{ fontSize:12, color:"var(--ink-soft)", lineHeight:1.65 }}>These answers are stored locally and never transmitted, sold, or shared. They help us understand our community in aggregate — never individually. You're anonymous to us.</div>
        </div>

        <div className="onboard-actions">
          <button className="btn-back" onClick={() => setStep(13)}>← Back</button>
          <button className="btn-primary" onClick={() => setStep(15)}>See my plan →</button>
        </div>
      </div>
    </div>
  );

  // Step 15 — Summary / personal covenant
  if (step === 15) return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}><BatteryMascot level={initBatt} size={64} /></div>
        <div className="onboard-eyebrow">{userName.trim() ? `${userName.trim()}, this is your plan` : "This is your plan"}</div>
        <div className="onboard-title">You came as you are.<br />You're leaving as who<br />you're becoming.</div>
        <div className="onboard-sub" style={{ marginBottom:20 }}>Here's everything MyBattery learned about you — and the plan it built to protect you.</div>

        {identityValues.length > 0 && (
          <div style={{ background:"rgba(90,122,90,0.06)", border:"1.5px solid rgba(90,122,90,0.15)", borderRadius:"var(--radius-sm)", padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"flex-start", gap:12 }}>
            <Icon name="sparkle" size={16} style={{color:"var(--teal-dark)", flexShrink:0, marginTop:2}} />
            <div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--teal-dark)", marginBottom:6 }}>What matters to you</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {identityValues.map(v => (
                  <span key={v} style={{ fontSize:12, padding:"3px 10px", borderRadius:20, background:"rgba(90,122,90,0.12)", color:"var(--teal-dark)", fontWeight:500 }}>{v}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {wantBack && (
          <div style={{ background:"rgba(90,122,90,0.08)", border:"1.5px solid rgba(90,122,90,0.2)", borderRadius:"var(--radius-sm)", padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"flex-start", gap:12 }}>
            <Icon name="heart" size={16} style={{color:"var(--teal-dark)", flexShrink:0, marginTop:2}} />
            <div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--teal-dark)", marginBottom:4 }}>Your reason</div>
              <div style={{ fontSize:13, color:"var(--ink)", lineHeight:1.5, fontStyle:"italic" }}>"{wantBackLabel}"</div>
            </div>
          </div>
        )}

        <div style={{ marginBottom:20 }}>
          {[
            { icon: prof?.icon,                                label: prof?.name,                                   sub: `Peak capacity: ${peak} tasks on strong days` },
            { icon: RHYTHMS.find(r=>r.id===rhythm)?.icon,     label: RHYTHMS.find(r=>r.id===rhythm)?.name,         sub: "Tasks sequenced around your natural flow" },
            { icon: battEmoji,                                 label: `Starting at ${initBatt}%`,                   sub: `Calibrated to your "${burnoutPatternLabel}" pattern` },
          ].map((row, i) => (
            <div key={i} className="onboard-summary-row">
              <Icon name={row.icon || "leaf"} size={20} style={{color:"var(--teal-dark)", flexShrink:0}} />
              <div>
                <div style={{ fontSize:14, fontWeight:500, color:"var(--ink)" }}>{row.label}</div>
                <div style={{ fontSize:11, color:"var(--ink-mute)", marginTop:2, fontFamily:"'DM Mono',monospace" }}>{row.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {counts && (
          <>
            <div style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.6, marginBottom:12 }}>We'll never surface more tasks than you can handle — here's your energy-based daily limit:</div>
            <div className="preview-energy-row">
              {[
                { icon:"bolt", label:"High energy days",  key:"high", hint:"Deep work surfaces — protect the time." },
                { icon:"sun",  label:"Moderate days",      key:"med",  hint:"Balanced, structured, manageable." },
                { icon:"moon", label:"Low energy days",    key:"low",  hint:"Only what truly needs to happen." },
              ].map(row => (
                <div className="preview-row" key={row.key}>
                  <div className="preview-row-left">
                    <span className="preview-row-icon"><Icon name={row.icon} size={16} /></span>
                    <div>
                      <div style={{ fontWeight:500, fontSize:13, color:"var(--ink)" }}>{row.label}</div>
                      <div style={{ fontSize:11, color:"var(--ink-mute)", marginTop:2 }}>{row.hint}</div>
                    </div>
                  </div>
                  <div className="preview-count">{counts[row.key]}<small>tasks</small></div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ background:"rgba(196,168,130,0.1)", borderLeft:"3px solid var(--slate-light)", borderRadius:"var(--radius-sm)", padding:"13px 16px", fontSize:13, color:"var(--ink-soft)", lineHeight:1.65, marginTop:16, marginBottom:8 }}>
          You can adjust any of this anytime in settings. But today, the system is calibrated for exactly where you are — and where you want to go.
        </div>

        <div className="onboard-actions" style={{ marginTop:16 }}>
          <button className="btn-back" onClick={() => setStep(14)}>← Adjust</button>
          <button className="btn-primary" style={{ fontSize:15, padding:"14px 36px" }} onClick={finish}>
            {userName.trim() ? `Let's go, ${userName.trim()} →` : "Let's go →"}
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}

// ─── Haptics ──────────────────────────────────────────────────────────────────
const _cap = () => window.Capacitor?.Plugins?.Haptics;
const haptic = {
  light:   () => { try { _cap()?.impact({ style: "LIGHT" })   ?? navigator.vibrate?.(8);  } catch {} },
  medium:  () => { try { _cap()?.impact({ style: "MEDIUM" })  ?? navigator.vibrate?.(20); } catch {} },
  heavy:   () => { try { _cap()?.impact({ style: "HEAVY" })   ?? navigator.vibrate?.(40); } catch {} },
  success: () => { try { _cap()?.notification({ type: "SUCCESS" }) ?? navigator.vibrate?.([10, 40, 20]); } catch {} },
  sos:     () => { try { _cap()?.notification({ type: "WARNING" }) ?? navigator.vibrate?.([60, 40, 60]); } catch {} },
};

// ─── Safety Hub ───────────────────────────────────────────────────────────────
const CRISIS_LINES = [
  { icon:"alert-circle",   name:"988 Suicide & Crisis Lifeline", detail:"Call or text 988 · 24/7, free, confidential", call:"tel:988", text:"sms:988" },
  { icon:"message-circle", name:"Crisis Text Line",               detail:"Text HOME to 741741 · any time, any crisis",  call:null,       text:"sms:741741?body=HOME", action:"Text HOME" },
  { icon:"leaf",           name:"SAMHSA Helpline",               detail:"1-800-662-4357 · substance use & mental health", call:"tel:18006624357", text:null, action:"Call now" },
  { icon:"heart",          name:"The Trevor Project",            detail:"1-866-488-7386 · LGBTQ+ youth · 24/7",       call:"tel:18664887386", text:"sms:678678?body=START", action:"Call / Text START" },
];

const FIND_HELP_RESOURCES = [
  { icon:"compass",   name:"Psychology Today Finder",  detail:"Filter by location, insurance, specialty, and approach", href:"https://www.psychologytoday.com/us/therapists" },
  { icon:"map",       name:"SAMHSA Treatment Locator", detail:"Government directory of licensed mental health services near you", href:"https://findtreatment.samhsa.gov" },
  { icon:"heart",     name:"Open Path Collective",     detail:"Affordable therapy · $30–$80/session for those who qualify", href:"https://openpathcollective.org" },
  { icon:"book-open", name:"NAMI: How to Find Help",   detail:"Step-by-step guide to finding and starting therapy", href:"https://www.nami.org/Your-Journey/Individuals-with-Mental-Illness/Finding-a-Mental-Health-Professional" },
];

function CrisisCard({ line }) {
  const header = (
    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
      <span className="safety-icon"><Icon name={line.icon} size={20} /></span>
      <div style={{ flex:1, minWidth:0 }}>
        <div className="safety-name">{line.name}</div>
        <div className="safety-detail">{line.detail}</div>
      </div>
    </div>
  );

  const btnBase = { flex:1, textAlign:"center", textDecoration:"none", display:"block", padding:"9px 0", borderRadius:20, fontSize:12, fontWeight:500 };

  return (
    <div className="safety-card" style={{ flexDirection:"column", alignItems:"stretch", gap:12, cursor:"default" }}>
      {header}
      <div style={{ display:"flex", gap:8 }}>
        {line.call && (
          <a href={line.call} className="safety-action" style={{ ...btnBase }}>
            {line.text ? "Call →" : (line.action ?? "Call now") + " →"}
          </a>
        )}
        {line.text && (
          <a href={line.text} className="safety-action"
             style={{ ...btnBase, background:"rgba(90,122,90,0.04)", color:"var(--ink-soft)" }}>
            {line.call ? "Text →" : (line.action ?? "Text") + " →"}
          </a>
        )}
      </div>
    </div>
  );
}

function SafetyHubView() {
  return (
    <div>
      <p className="safety-intro">
        You don't have to be in crisis to reach out. These lines are here for hard moments — big or small. All are free, confidential, and available right now.
      </p>
      {CRISIS_LINES.map(line => <CrisisCard key={line.name} line={line} />)}
      <div className="safety-offline-note" style={{display:"flex",alignItems:"center",gap:6}}>
        <Icon name="check-circle" size={13} style={{color:"var(--teal-dark)",flexShrink:0}} />
        Works offline — no internet needed to call or text
      </div>

      <div style={{ margin:"32px 0 12px" }}>
        <div className="readiness-eyebrow">Finding a therapist</div>
        <p style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.65, marginTop:8 }}>
          You don't need to be in crisis to benefit from professional support. Reaching out early is always easier than waiting until you're running on empty.
        </p>
      </div>
          {FIND_HELP_RESOURCES.map(r => (
            <a key={r.name} className="safety-card" href={r.href} target="_blank" rel="noopener noreferrer">
              <span className="safety-icon"><Icon name={r.icon} size={20} /></span>
              <div>
                <div className="safety-name">{r.name}</div>
                <div className="safety-detail">{r.detail}</div>
              </div>
              <span className="safety-action">Visit →</span>
            </a>
          ))}

      <div style={{ margin:"32px 0 12px" }}>
        <div className="readiness-eyebrow">Self-checks</div>
      </div>
      <MentalHealthScreening />
    </div>
  );
}

// ─── SOS Modal ─────────────────────────────────────────────────────────────────
function SOSModal({ onDismiss, onOpenSafety }) {
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:460 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--error)", background:"rgba(196,114,106,0.1)", border:"1.5px solid rgba(196,114,106,0.3)", borderRadius:20, padding:"3px 10px", flexShrink:0 }}>SOS</span>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:400, color:"var(--ink)", flex:1 }}>You're not alone.</div>
          <button aria-label="Close" onClick={onDismiss} style={{ background:"none", border:"1.5px solid rgba(0,0,0,0.1)", borderRadius:"50%", width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"var(--ink-mute)", fontSize:16, flexShrink:0 }}>×</button>
        </div>
        <p className="safety-intro" style={{ marginBottom:16 }}>
          These lines are here for hard moments — big or small. All are free, confidential, and available right now.
        </p>
        {CRISIS_LINES.map(line => <CrisisCard key={line.name} line={line} />)}
        <div className="safety-offline-note" style={{ display:"flex", alignItems:"flex-start", gap:6, marginTop:12 }}>
          <Icon name="check-circle" size={13} style={{ color:"var(--teal-dark)", flexShrink:0, marginTop:2 }} />
          Works offline — no internet needed to call or text
        </div>
        {onOpenSafety && (
          <button className="readiness-struggle-btn" style={{ marginTop:18 }} onClick={onOpenSafety}>
            Not in crisis? Find a therapist or take a self-check →
          </button>
        )}
        <div style={{ marginTop:16, textAlign:"center", fontSize:12, color:"var(--ink-mute)" }}>
          Tap × or outside to close
        </div>
      </div>
    </div>
  );
}

// ─── Pro gate ─────────────────────────────────────────────────────────────────
function ProGate({ feature, detail, onUpgrade }) {
  return (
    <div className="pro-gate">
      <div className="pro-gate-icon">✦</div>
      <div className="pro-gate-feature">{feature}</div>
      <div className="pro-gate-sub">{detail ?? "Available with MyBattery Pro"}</div>
      <button className="pro-gate-btn" onClick={onUpgrade}>Unlock — 14 days free</button>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function AnalyticsView() {
  const raw = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("reflow-analytics") || "[]"); } catch { return []; }
  }, []);

  // Build 7-day window (fill missing days with null)
  const data = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-CA");
      const entry = raw.find(r => r.date === key);
      days.push({
        label: d.toLocaleDateString("en-US", { weekday:"short" }),
        battery: entry?.battery ?? null,
        tasks:   entry?.tasks   ?? null,
      });
    }
    return days;
  }, [raw]);

  const hasData = data.some(d => d.battery !== null);

  const { insight, reflection } = useMemo(() => {
    const valid = data.filter(d => d.battery !== null);
    if (valid.length < 2) return { insight: null, reflection: null };
    const avgBattery = Math.round(valid.reduce((s, d) => s + d.battery, 0) / valid.length);
    const avgTasks   = (valid.reduce((s, d) => s + (d.tasks || 0), 0) / valid.length).toFixed(1);
    const best = [...valid].sort((a, b) => b.battery - a.battery)[0];

    const insight = `Average energy ${avgBattery}% · ~${avgTasks} tasks/day · Best day: ${best.label}`;

    let reflection;
    if (avgBattery < BATTERY_THRESHOLDS.LOW) {
      reflection = {
        template: "recharge",
        heading:  "A week of conservation.",
        battery:  "This week was about conservation. It takes real wisdom to listen to your body when it asks for rest.",
        tasks:    "You kept things light this week. It's okay to let the 'Could Dos' wait while you prioritize your recovery.",
        wellness: "Taking space for yourself in the Wellness Hub is a win in itself — that's not avoidance, that's care.",
      };
    } else if (avgBattery >= 65) {
      reflection = {
        template: "flow",
        heading:  "You found your rhythm.",
        battery:  `Your energy was high this week — it looks like you found a great rhythm for your Peak hours.`,
        tasks:    `You moved through quite a bit this week. Which of those ${avgTasks > 3 ? "accomplishments" : "moments"} feels the most meaningful to you?`,
        wellness: "Even on high-energy days, you still made time to breathe. That's a powerful way to stay grounded.",
      };
    } else {
      reflection = {
        template: "mixed",
        heading:  "Steady through the shifts.",
        battery:  "You navigated a lot of ups and downs this week. How did it feel to adjust your Must Dos as your energy shifted?",
        tasks:    `Averaging around ${avgTasks} tasks a day is real, sustainable progress — even when it didn't feel like enough.`,
        wellness: "Gentle Mode was there when you needed it. Steady progress is still progress.",
      };
    }

    return { insight, reflection };
  }, [data]);

  if (!hasData) return (
    <div className="analytics-empty">
      Your energy patterns will appear here after your first full day. Close out a day using the shutdown ritual to start tracking.
    </div>
  );

  return (
    <div className="analytics-wrap">
      {reflection && (
        <div className={`wr-card wr-card--${reflection.template}`}>
          <div className="wr-heading">{reflection.heading}</div>
          <div className="wr-row">
            <span className="wr-icon"><Icon name="battery" size={14} /></span>
            <span className="wr-text">{reflection.battery}</span>
          </div>
          <div className="wr-row">
            <span className="wr-icon"><Icon name="check-circle" size={14} /></span>
            <span className="wr-text">{reflection.tasks}</span>
          </div>
          <div className="wr-row">
            <span className="wr-icon"><Icon name="leaf" size={14} /></span>
            <span className="wr-text">{reflection.wellness}</span>
          </div>
        </div>
      )}
      {insight && <div className="analytics-insight" style={{display:"flex",alignItems:"center",gap:6}}><Icon name="info" size={14} style={{flexShrink:0,color:"var(--slate-dark)"}} />{insight}</div>}
      <div className="analytics-legend">
        <div className="analytics-legend-item"><div className="analytics-legend-dot" style={{ background:"#8a9e8a" }} /> Energy %</div>
        <div className="analytics-legend-item"><div className="analytics-legend-dot" style={{ background:"#c4a882" }} /> Tasks done</div>
      </div>
      <div className="analytics-chart-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top:8, right:16, left:-20, bottom:0 }}>
            <defs>
              <linearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8a9e8a" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8a9e8a" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="tasksGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#c4a882" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#c4a882" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize:11, fill:"var(--ink-mute)", fontFamily:"DM Mono,monospace" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:"var(--ink-mute)", fontFamily:"DM Mono,monospace" }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background:"var(--card)", border:"1px solid var(--warm)", borderRadius:10, fontSize:12, fontFamily:"DM Sans,sans-serif" }}
              formatter={(val, name) => [val === null ? "—" : name === "battery" ? `${val}%` : val, name === "battery" ? "Energy" : "Tasks"]}
              labelStyle={{ color:"var(--ink-soft)", fontWeight:500, marginBottom:4 }}
            />
            <Area type="monotone" dataKey="battery" stroke="#8a9e8a" strokeWidth={2} fill="url(#batteryGrad)" dot={{ r:3, fill:"#8a9e8a", strokeWidth:0 }} connectNulls />
            <Area type="monotone" dataKey="tasks"   stroke="#c4a882" strokeWidth={2} fill="url(#tasksGrad)"   dot={{ r:3, fill:"#c4a882", strokeWidth:0 }} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize:12, color:"var(--ink-mute)", textAlign:"center", fontStyle:"italic", lineHeight:1.6 }}>
        This is for your awareness, not your judgment. Patterns are information — not grades.
      </div>
    </div>
  );
}

// ─── Ding sound (Web Audio API — no external files) ──────────────────────────
let _audioCtx = null;
if (typeof window !== "undefined") {
  // Pre-unlock the AudioContext on first user interaction so timer callbacks can play audio
  const unlock = () => {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
  };
  ["click","keydown","touchstart"].forEach(ev => window.addEventListener(ev, unlock, { once: true }));
}

function playTone(ctx, freq, startTime, duration, volume = 0.4) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function ding(type = "default") {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    const go = () => {
      const now = ctx.currentTime;
      if (type === "pomo") {
        playTone(ctx, 784, now,       1.0, 0.4);
        playTone(ctx, 988, now + 0.2, 0.9, 0.35);
        playTone(ctx, 1175,now + 0.4, 0.8, 0.3);
      } else if (type === "breath") {
        playTone(ctx, 528, now,       1.0, 0.25);
        playTone(ctx, 660, now + 0.3, 0.8, 0.2);
      } else {
        playTone(ctx, 880, now,       0.8, 0.4);
        playTone(ctx, 1108,now + 0.15,0.7, 0.3);
      }
    };
    if (ctx.state === "suspended") ctx.resume().then(go);
    else go();
  } catch {}
}


// ─── TaskColumn ───────────────────────────────────────────────────────────────
const BUCKET_CYCLE = { must:"should", should:"could", could:"must" };
const BUCKET_STYLE = {
  must:   { className:"must-pill",   label:"Must" },
  should: { className:"should-pill", label:"Should" },
  could:  { className:"could-pill",  label:"Could" },
};

function HoldTaskCheck({ done, onToggle, holding = false }) {
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef(null);
  useEffect(() => () => clearTimeout(hintTimer.current), []);
  return (
    <div
      className="task-check"
      style={{ touchAction:"none", position:"relative", zIndex:1 }}
      onClick={e => {
        e.stopPropagation();
        if (done) { onToggle(); return; }
        // A quick tap does nothing on its own — tell people completion is press-and-hold
        setShowHint(true);
        clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setShowHint(false), 3000);
      }}
    >
      <HoldRing holding={holding} size={HOLD_DURATION} />
      <Checkmark />
      {showHint && !holding && <span className="hold-hint" role="status">Hold to finish</span>}
    </div>
  );
}

function TaskColumn({ title, pillClass, tasks, onToggle, onDelete, onEdit, onOpenEdit, onReschedule, onChangeBucket, scheduledIds, gentleMode = false, sternMode = false, onParalysis, hideEmpty = false, hideHeader = false, onAddSubtask, onToggleSubtask, onDeleteSubtask }) {
  const [editingId,    setEditingId]    = useState(null);
  const [editVal,      setEditVal]      = useState("");
  const [editDueDate,  setEditDueDate]  = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPriority, setEditPriority] = useState("normal");
  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleVal,setRescheduleVal]= useState("");
  const [expandedIds,  setExpandedIds]  = useState(new Set());
  const [subtaskInputs,setSubtaskInputs]= useState({});
  const [completingId, setCompletingId] = useState(null);
  const [holdingId,    setHoldingId]    = useState(null);
  const holdTimerRef = useRef(null);
  const todayStr = new Date().toLocaleDateString("en-CA");

  function startHold(id) {
    setHoldingId(id);
    holdTimerRef.current = setTimeout(() => {
      setHoldingId(null);
      holdTimerRef.current = null;
      handleToggle(id);
    }, HOLD_DURATION);
  }
  function cancelHold() {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    setHoldingId(null);
  }

  function handleToggle(id) {
    const task = tasks.find(t => t.id === id);
    if (task && !task.done) {
      setCompletingId(id);
      setTimeout(() => { setCompletingId(null); onToggle(id); }, 1500);
    } else {
      onToggle(id);
    }
  }

  function startEdit(t, e) {
    e.stopPropagation();
    setEditingId(t.id);
    setEditVal(t.name);
    setEditDueDate(t.dueDate || "");
    setEditDuration(t.duration ? String(t.duration) : "");
    setEditPriority(t.priority || "normal");
  }

  function commitEdit(id) {
    if (editVal.trim()) onEdit(id, editVal.trim(), editDueDate, editDuration, { priority: editPriority || "normal" });
    setEditingId(null);
  }

  return (
    <div className="task-column">
      {!hideHeader && (
        <div className="column-header">
          <div className={`column-title ${pillClass.replace('-pill','-title')}`}><span className={`column-pill ${pillClass}`} style={{letterSpacing:"1px",fontWeight:500}}>{title.replace(' Do','')}{tasks.length > 0 ? ` · ${tasks.length}` : ''}</span></div>
        </div>
      )}
      {tasks.length === 0 && !hideEmpty && <div style={{ fontSize:13, color:"var(--ink-mute)", padding:"10px 0", fontStyle:"italic", display:"flex", alignItems:"center", justifyContent:"center", minHeight:180 }}>Nothing here — space to breathe.</div>}
      {tasks.map(t => {
        const tag = ENERGY_TAGS.find(e => e.id === t.energy);
        const isScheduled = scheduledIds?.has(t.id);
        const isEditing = editingId === t.id;
        const isOverdue = !t.done && t.dueDate && t.dueDate < todayStr;
        const isDue     = !t.done && t.dueDate && t.dueDate >= todayStr;
        return (
          <div key={t.id}
            className={`task-item ${t.done?"done":""}${completingId === t.id ? " completing" : ""}${holdingId === t.id ? " holding" : ""}${sternMode && isOverdue ? " stern-overdue" : ""}`}
            style={!t.done && !isEditing ? { touchAction:"none" } : undefined}
            onPointerDown={!t.done && !isEditing ? e => { e.stopPropagation(); startHold(t.id); } : undefined}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
          >
            <div className="task-hold-fill" />
            <HoldTaskCheck done={t.done} holding={holdingId === t.id} onToggle={() => { if (!t.done) { handleToggle(t.id); } else { onToggle(t.id); } }} />
            <div className="task-body">
              {isEditing ? (
                <div onClick={e => e.stopPropagation()}>
                  <input
                    className="task-name-input"
                    value={editVal}
                    autoFocus
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") commitEdit(t.id); if (e.key === "Escape") setEditingId(null); }}
                    onClick={e => e.stopPropagation()}
                  />
                  <div style={{ display:"flex", gap:8, marginTop:6, alignItems:"center", flexWrap:"wrap" }}>
                    <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace" }}>
                      <Icon name="calendar" size={11} />
                      <input
                        type="date"
                        value={editDueDate}
                        min={todayStr}
                        onChange={e => setEditDueDate(e.target.value)}
                        style={{ fontSize:11, fontFamily:"'DM Mono',monospace", border:"1px solid var(--warm)", borderRadius:6, padding:"2px 6px", color:"var(--ink)", background:"var(--card)", outline:"none" }}
                      />
                    </label>
                    <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace" }}>
                      <Icon name="timer" size={11} />
                      <input
                        type="number"
                        value={editDuration}
                        min={5}
                        max={480}
                        step={5}
                        placeholder="min"
                        onChange={e => setEditDuration(e.target.value)}
                        style={{ width:60, fontSize:11, fontFamily:"'DM Mono',monospace", border:"1px solid var(--warm)", borderRadius:6, padding:"2px 6px", color:"var(--ink)", background:"var(--card)", outline:"none" }}
                      />
                      <span style={{ fontSize:10 }}>min</span>
                    </label>
                    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                      {[["urgent","🔴"],["high","🟠"],["normal","⚪"],["low","🔵"]].map(([val, emoji]) => (
                        <button key={val} type="button"
                          onClick={e => { e.stopPropagation(); setEditPriority(val); }}
                          style={{ padding:"2px 7px", borderRadius:12, fontSize:10, border:`1.5px solid ${editPriority===val ? (val==="urgent"?"#d94f4f":val==="high"?"#c8903a":val==="low"?"#7aabe0":"var(--teal-dark)") : "var(--warm)"}`, background:editPriority===val?"rgba(90,90,90,0.08)":"transparent", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{emoji}</button>
                      ))}
                    </div>
                    {_isNative() && (
                      <button aria-label="Add to device calendar"
                        type="button"
                        onClick={async e => { e.stopPropagation(); await calendarHelpers.addTaskAsEvent(t); }}
                        title="Add to device calendar"
                        style={{ padding:"2px 8px", borderRadius:12, fontSize:10, border:"1.5px solid var(--warm)", background:"transparent", cursor:"pointer", fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", display:"flex", alignItems:"center", gap:3 }}
                      ><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>cal</button>
                    )}
                    <button
                      onMouseDown={e => { e.preventDefault(); commitEdit(t.id); }}
                      style={{ marginLeft:"auto", fontSize:11, padding:"3px 12px", borderRadius:20, border:"1.5px solid var(--teal-dark)", background:"rgba(90,122,90,0.08)", color:"var(--teal-dark)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}
                    >Save</button>
                  </div>
                </div>
              ) : (
                <div className="task-name" style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {t.priority && t.priority !== "normal" && (
                    <span className={`task-priority-tag ${t.priority}`}>{t.priority === "urgent" ? "🔴" : t.priority === "high" ? "🟠" : "🔵"} {t.priority}</span>
                  )}
                  {t.name}
                </div>
              )}
              <div className="task-meta">
                {onChangeBucket && (() => {
                  const bs = BUCKET_STYLE[t.bucket] || BUCKET_STYLE.should;
                  return (
                    <button
                      className={`task-bucket-btn ${bs.className}`}
                      onClick={e => { e.stopPropagation(); onChangeBucket(t.id, BUCKET_CYCLE[t.bucket] || "should"); }}
                      title="Tap to change priority"
                    aria-label={`Priority: ${bs.label}. Tap to change`}
                    >{bs.label}</button>
                  );
                })()}
                {t.energyImpact !== undefined
                  ? <span className={`task-tag suggest-impact ${t.energyImpact < 0 ? "drain" : "charge"}`} style={{display:"inline-flex",alignItems:"center",gap:3}}><Icon name={t.energyImpact > 0 ? "bolt" : "battery"} size={9} />{t.energyImpact > 0 ? `+${t.energyImpact}` : t.energyImpact}</span>
                  : tag && <span className={`task-tag ${tag.class}`}>{tag.label}</span>
                }
                {t.duration && <span className="task-tag" style={{ fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", display:"inline-flex", alignItems:"center", gap:3 }}><Icon name="timer" size={9} />{t.duration < 60 ? `${t.duration}m` : t.duration % 60 === 0 ? `${t.duration/60}h` : `${Math.floor(t.duration/60)}h ${t.duration%60}m`}</span>}
                {isScheduled && <span className="task-scheduled-badge" style={{display:"inline-flex",alignItems:"center",gap:3}}><Icon name="calendar" size={9} />scheduled</span>}
                {isOverdue && <span className={`task-tag ${sternMode ? "tag-stern-overdue" : "tag-overdue"}`} style={{display:"inline-flex",alignItems:"center",gap:3}}>{sternMode ? <><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Action required</> : gentleMode ? <><Icon name="leaf" size={9} />waiting for you</> : <><Icon name="warning" size={9} />overdue</>}</span>}
                {isDue     && <span className="task-tag tag-due" style={{display:"inline-flex",alignItems:"center",gap:3}}><Icon name="calendar" size={9} />{t.dueDate}</span>}
              </div>
              {/* Subtask toggle button */}
              {(() => {
                const subs = t.subtasks || [];
                const isExpanded = expandedIds.has(t.id);
                const doneSubs = subs.filter(s => s.done).length;
                return (
                  <>
                    <button
                      className="subtask-toggle-btn"
                      onClick={e => { e.stopPropagation(); setExpandedIds(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; }); }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s" }}>
                        <polygon points="1,1 7,4 1,7" />
                      </svg>
                      {subs.length > 0
                        ? <><span style={{ color:"var(--teal-dark)", fontWeight:500 }}>{doneSubs}/{subs.length}</span> subtasks</>
                        : "+ subtask"
                      }
                    </button>
                    {isExpanded && (
                      <div className="subtask-section" onClick={e => e.stopPropagation()}>
                        {subs.map(s => (
                          <div key={s.id} className="subtask-item">
                            <div
                              className={`subtask-check${s.done ? " done" : ""}`}
                              onClick={() => onToggleSubtask?.(t.id, s.id)}
                            >
                              {s.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span className={`subtask-name${s.done ? " done" : ""}`} onClick={() => onToggleSubtask?.(t.id, s.id)} {...asButton(() => onToggleSubtask?.(t.id, s.id), "checkbox", { "aria-checked": !!s.done })}>{s.name}</span>
                            <button aria-label="Delete subtask" className="subtask-del" onClick={() => onDeleteSubtask?.(t.id, s.id)}>×</button>
                          </div>
                        ))}
                        <div className="subtask-add-row">
                          <input
                            className="subtask-add-input"
                            placeholder="Add a subtask…"
                            value={subtaskInputs[t.id] || ""}
                            onChange={e => setSubtaskInputs(prev => ({ ...prev, [t.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === "Enter" && (subtaskInputs[t.id] || "").trim()) {
                                onAddSubtask?.(t.id, subtaskInputs[t.id].trim());
                                setSubtaskInputs(prev => ({ ...prev, [t.id]: "" }));
                              }
                            }}
                          />
                          <button
                            className="subtask-add-confirm"
                            onClick={() => {
                              if ((subtaskInputs[t.id] || "").trim()) {
                                onAddSubtask?.(t.id, subtaskInputs[t.id].trim());
                                setSubtaskInputs(prev => ({ ...prev, [t.id]: "" }));
                              }
                            }}
                          >Add</button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              {isOverdue && rescheduleId !== t.id && (
                <div className="reschedule-prompt" onClick={e => e.stopPropagation()}>
                  {sternMode ? "This is past due. Click to make a plan, or reschedule." : gentleMode ? "Waiting for you when you're ready." : "Missed this one — try another day?"}
                  <button className="reschedule-btn" onClick={() => { setRescheduleId(t.id); setRescheduleVal(""); }}>Reschedule</button>
                </div>
              )}
              {isOverdue && rescheduleId === t.id && (
                <div className="reschedule-prompt" onClick={e => e.stopPropagation()}>
                  <input type="date" value={rescheduleVal} min={todayStr} onChange={e => setRescheduleVal(e.target.value)} />
                  <button className="reschedule-btn" onClick={() => { if (rescheduleVal) { onReschedule(t.id, rescheduleVal); setRescheduleId(null); } }}>Save</button>
                  <button className="reschedule-btn cancel" onClick={() => setRescheduleId(null)}>Cancel</button>
                </div>
              )}
            </div>
            <div className="task-actions">
              {!t.done && onParalysis && (
                <button aria-label="Feeling stuck?" className="task-btn-stuck" title="Feeling stuck?" onClick={e => { e.stopPropagation(); onParalysis(t); }}>stuck?</button>
              )}
              <button aria-label="Edit" className="task-btn" title="Edit" onClick={e => { e.stopPropagation(); onOpenEdit ? onOpenEdit(t) : startEdit(t, e); }}><Icon name="pen" size={13} /></button>
              <button aria-label="Delete" className="task-btn delete" title="Delete" onClick={e => { e.stopPropagation(); onDelete(t.id); }}><Icon name="trash" size={13} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── NewTaskRow ───────────────────────────────────────────────────────────────
const HOLD_DURATION = 600;

// Shared by the hold, tap and drag gestures on task rows. A hold or drag that just ended
// must not also register as a tap that opens Edit.
let lastTaskGestureEnd = 0;
const markTaskGestureEnd = () => { lastTaskGestureEnd = Date.now(); };
const TAP_SLOP_PX = 8;      // finger travel beyond this is a scroll/drag, not a tap or hold
const TAP_MAX_MS  = 500;    // presses longer than this are not taps
const TAP_QUIET_MS = 300;   // ignore taps right after a hold/drag finished
const SWIPE_OPEN_PX   = 88;   // how far a row rests open, showing Delete
const SWIPE_DELETE_PX = 180;  // sliding past this deletes without a second tap
const SWIPE_MAX_PX    = 240;

function useHoldToggle(onComplete, active = true, onShortPress) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  function start(e) {
    if (!active) return;
    e.stopPropagation();
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY };
    setHolding(true);
    timerRef.current = setTimeout(() => {
      setHolding(false);
      timerRef.current = null;
      markTaskGestureEnd();
      onComplete();
    }, HOLD_DURATION);
  }

  function cancel(e) {
    e?.stopPropagation();
    const released = !!timerRef.current && e?.type === "pointerup";
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; markTaskGestureEnd(); }
    setHolding(false);
    if (released) onShortPress?.(e); // let go before the hold finished
  }

  // Finger wandered off the circle: that's a scroll or drag, so abandon the hold.
  function move(e) {
    if (!timerRef.current || !startRef.current) return;
    if (Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y) > TAP_SLOP_PX) cancel(e);
  }

  return {
    holding,
    handlers: { onPointerDown: start, onPointerMove: move, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel },
  };
}

const HoldRing = ({ holding, size = 600 }) => !holding ? null : (
  <svg className="hold-ring" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="none" stroke="var(--teal-dark)" strokeWidth="2.5"
      strokeDasharray="94.2" strokeDashoffset="94.2"
      style={{ animation:`holdFill ${size}ms linear forwards` }}
    />
  </svg>
);

function NewTaskRow({ task, onToggle, onOpenEdit, onEdit, onParalysis, onDelete }) {
  const subs   = task.subtasks || [];
  const energy = task.energyImpact ?? 0;
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef(null);
  useEffect(() => () => clearTimeout(hintTimer.current), []);
  // A quick tap on the circle does nothing on its own — tell people completion is press-and-hold
  function flashHint(e) {
    if (!e?.target?.closest?.(".new-task-check")) return;
    setShowHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setShowHint(false), 3000);
  }
  const { holding, handlers } = useHoldToggle(() => onToggle(task.id), !task.done, flashHint);

  function formatDue(ds) {
    if (!ds) return null;
    const [y, m, d] = ds.split("-");
    return `${m}/${d}/${String(y).slice(2)}`;
  }

  // Slide left to reveal Delete; a long slide deletes straight away. Vertical moves are left to scrolling.
  const wrapRef  = useRef(null);
  const swipeRef = useRef(null);
  const [offset,   setOffset]   = useState(0);
  const [swiping,  setSwiping]  = useState(false);
  const [leaving,  setLeaving]  = useState(false);
  const open = offset <= -SWIPE_OPEN_PX / 2 && !swiping;
  function removeTask() {
    setLeaving(true);
    setOffset(-(wrapRef.current?.offsetWidth ?? 400));
    setTimeout(() => onDelete?.(task.id), 180);
  }
  useEffect(() => {
    if (!open) return;
    function closeOnOutside(e) { if (!wrapRef.current?.contains(e.target)) setOffset(0); }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);
  function swipeStart(e) {
    if (!onDelete || task.done || e.target.closest("button, input, textarea, select, a")) return;
    swipeRef.current = { x: e.clientX, y: e.clientY, base: offset, locked: false };
  }
  function swipeMove(e) {
    const s = swipeRef.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipeRef.current = null; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      s.locked = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setSwiping(true);
    }
    setOffset(Math.max(-SWIPE_MAX_PX, Math.min(0, s.base + dx)));
  }
  function swipeEnd() {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s?.locked) return;
    markTaskGestureEnd();
    setSwiping(false);
    if (offset < -SWIPE_DELETE_PX) removeTask();
    else setOffset(offset < -SWIPE_OPEN_PX / 2 ? -SWIPE_OPEN_PX : 0);
  }

  // Only a real tap opens Edit: little finger travel, short press, and not the tail of a hold/drag.
  const pressRef = useRef(null);
  function openIfTap() {
    const p = pressRef.current;
    pressRef.current = null;
    if (!p) return;
    if (Date.now() - p.t > TAP_MAX_MS) return;
    if (Date.now() - lastTaskGestureEnd < TAP_QUIET_MS) return;
    if (open) { setOffset(0); return; }
    onOpenEdit?.(task);
  }

  return (
    <div ref={wrapRef} className="swipe-del-wrap">
      {onDelete && (
        <button className="swipe-del-btn" style={{ visibility: offset === 0 ? "hidden" : "visible" }}
          aria-label={`Delete "${task.name}"`} tabIndex={open ? 0 : -1} onClick={removeTask}>Delete</button>
      )}
    <div
      className={`new-task-row${holding ? " holding" : ""}${task.priority === "urgent" ? " urgency-urgent" : task.priority === "high" ? " urgency-high" : ""}${offset !== 0 ? " swiped" : ""}`}
      style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: swiping ? "none" : "transform 0.2s ease, opacity 0.18s ease", opacity: leaving ? 0 : 1, touchAction: onDelete && !task.done ? "pan-y" : undefined }}
      onPointerDown={e => { e.stopPropagation(); pressRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }; swipeStart(e); }}
      onPointerMove={e => {
        const p = pressRef.current;
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_SLOP_PX) pressRef.current = null;
        swipeMove(e);
      }}
      onPointerUp={swipeEnd}
      onPointerCancel={() => { pressRef.current = null; swipeEnd(); }}
      onClick={openIfTap}
    >
      <div className="task-hold-fill" />
      <button aria-label={task.done ? `Mark "${task.name}" not done` : `Complete "${task.name}" (press and hold)`}
        className={`new-task-check${task.done ? " done" : ""}`}
        style={{ touchAction: task.done ? undefined : "none", position:"relative", zIndex:2, flexShrink:0 }}
        {...(!task.done ? handlers : {})}
        onClick={e => { e.stopPropagation(); if (task.done) onToggle(task.id); }}
      >
        <HoldRing holding={holding} size={HOLD_DURATION} />
        {showHint && !holding && <span className="hold-hint" role="status">Hold to finish</span>}
        {task.done && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </button>
      <div className="new-task-info">
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {task.priority && task.priority !== "normal" && task.priority !== "low" && (
            <span className={`priority-dot ${task.priority}`} />
          )}
          <div className="new-task-title-text">{task.name}</div>
        </div>
        {subs.length > 0 && <div className="new-task-sub-text">{subs.filter(x => x.done).length} of {subs.length} steps</div>}
      </div>
      <div className="new-task-badges">
        <span className={`new-energy-badge${energy > 0 ? " recharge" : ""}`}>{energy > 0 ? `+${energy}` : energy}</span>
        {task.recurrence && <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--teal-dark)", background:"rgba(90,122,90,0.1)", borderRadius:20, padding:"2px 7px", letterSpacing:"0.5px" }}>↻ {task.recurrence}</span>}
        {task.dueDate && <span className="new-due-pill">Due {formatDue(task.dueDate)}</span>}
        {!task.done && onParalysis && (
          <button aria-label="Feeling stuck?" className="task-btn-stuck" title="Feeling stuck?" onClick={e => { e.stopPropagation(); onParalysis(task); }}>stuck?</button>
        )}
      </div>
    </div>
    </div>
  );
}

// ─── CalendarEventsSection ────────────────────────────────────────────────────
function CalendarEventsSection({ calendarPermission, calConnected, onRequestPermission, onResync, onUnsync, events, loading }) {
  function fmtTime(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    const h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? "pm" : "am";
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2,"0")}${ampm}`;
  }

  const isConnected = calendarPermission === "granted" && calConnected;

  return (
    <div className="cal-section">
      <div className="cal-section-header">
        <div className="cal-section-title">Today's calendar</div>
        {isConnected && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button
              onClick={onResync}
              disabled={loading}
              style={{ background:"none", border:"none", padding:4, cursor:loading ? "default" : "pointer", opacity:loading ? 0.4 : 1, display:"flex", alignItems:"center" }}
              title="Resync calendar" aria-label="Resync calendar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button
              onClick={onUnsync}
              style={{ background:"none", border:"none", padding:4, cursor:"pointer", display:"flex", alignItems:"center" }}
              title="Disconnect calendar" aria-label="Disconnect calendar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {!isConnected ? (
        <div className="cal-permission-prompt">
          {calendarPermission === "denied" ? (
            <div className="cal-permission-sub">
              To see your events here, turn on calendar access in Settings → Privacy &amp; Security → Calendars → MyBattery.
            </div>
          ) : (
            <>
              <div className="cal-permission-sub">See your events alongside your tasks.</div>
              <button className="cal-permission-btn" onClick={onRequestPermission}>
                Connect calendar
              </button>
            </>
          )}
        </div>
      ) : loading ? (
        <div className="cal-empty">Syncing…</div>
      ) : events.length === 0 ? (
        <div className="cal-empty">Nothing scheduled today</div>
      ) : (
        events.map((ev, i) => (
          <div key={ev.id || i} className="cal-event-row">
            <div className="cal-event-time">
              {ev.isAllDay ? "" : fmtTime(ev.startDate)}
            </div>
            <div className="cal-event-name">{ev.title}</div>
            {ev.isAllDay && <div className="cal-event-allday">all day</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ─── BucketCarousel ───────────────────────────────────────────────────────────
const BUCKET_TABS = [
  { key:"must",   label:"Must",   title:"Must do"   },
  { key:"should", label:"Should", title:"Should do" },
  { key:"could",  label:"Could",  title:"Could do"  },
];

function WinsCardSection({ wins, onUncomplete }) {
  const lastTapMap = useRef({});
  function handleTap(id) {
    const now = Date.now();
    if (now - (lastTapMap.current[id] || 0) < 350) {
      onUncomplete?.(id);
      lastTapMap.current[id] = 0;
    } else {
      lastTapMap.current[id] = now;
    }
  }
  return (
    <div className="wins-card">
      <div className="wins-card-title">Today's Wins</div>
      {wins.map(w => (
        <div key={w.id} className="wins-item" onClick={() => handleTap(w.id)} {...asButton(() => handleTap(w.id))} style={{ cursor:"pointer" }}>
          <div className="wins-bullet" />
          <span className="wins-name">{w.name}</span>
          {w.energyImpact !== undefined && (
            <span className="wins-energy">{w.energyImpact > 0 ? `+${w.energyImpact}` : w.energyImpact}</span>
          )}
        </div>
      ))}
      <div style={{ fontSize:10, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", marginTop:6, paddingLeft:2 }}>double-tap to undo</div>
    </div>
  );
}

function BucketCarousel({ mustTasks, shouldTasks, couldTasks, sessionWins = [], onUncomplete, onToggle, onDelete, onOpenEdit, onEdit, onChangeBucket, onParalysis, onAddSubtask, onToggleSubtask, onDeleteSubtask, gentleMode, sternMode }) {
  const [tabIdx,      setTabIdx]     = useState(0);
  const [viewAll,     setViewAll]    = useState(true);
  const [drag,        setDrag]       = useState(null);
  const [ptrDrag,     setPtrDrag]    = useState(null); // { id, fromBucket, x, y, label }
  const [dragOverKey, setDragOverKey] = useState(null);
  const wrapRef = useRef(null);
  const TOTAL   = BUCKET_TABS.length;

  // Pointer-based drag for iOS/touch compatibility. Keyed off `!!ptrDrag` rather than
  // `ptrDrag` itself so the listeners bind once per drag gesture instead of rebinding
  // on every pointermove (setPtrDrag updates x/y/moved on each move, which would
  // otherwise thrash addEventListener/removeEventListener at pointer-move frequency).
  const ptrDragRef = useRef(null);
  useEffect(() => { ptrDragRef.current = ptrDrag; }, [ptrDrag]);

  useEffect(() => {
    if (!ptrDrag) return;
    function onMove(e) {
      const x = e.clientX, y = e.clientY;
      setPtrDrag(d => {
        if (!d) return null;
        const moved = d.moved || Math.hypot(x - d.startX, y - d.startY) > 10;
        return { ...d, x, y, moved };
      });
      const el = document.elementFromPoint(x, y);
      setDragOverKey(ptrDragRef.current?.moved ? (el?.closest('[data-bucket-key]')?.dataset.bucketKey ?? null) : null);
    }
    function onUp(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el?.closest('[data-bucket-key]')?.dataset.bucketKey;
      const current = ptrDragRef.current;
      // A touch that never really travelled is not a drag: don't move the task.
      if (current?.moved && target && target !== current.fromBucket) onChangeBucket?.(current.id, target);
      markTaskGestureEnd();
      setPtrDrag(null);
      setDragOverKey(null);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!ptrDrag, onChangeBucket]);

  const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };
  function sortByPriority(arr) {
    return [...arr].sort((a, b) => (PRIORITY_ORDER[a.priority || "normal"] ?? 2) - (PRIORITY_ORDER[b.priority || "normal"] ?? 2));
  }
  const allByTab = [mustTasks, shouldTasks, couldTasks].map(sortByPriority);
  const active   = BUCKET_TABS[tabIdx];
  const pending  = (allByTab[tabIdx] || []).filter(t => !t.done);

  function go(next) { setTabIdx(Math.max(0, Math.min(TOTAL - 1, next))); }

  function onPointerDown(e) {
    if (e.target.closest("button, input, textarea, select, a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startX: e.clientX, offsetX: 0 });
  }
  function onPointerMove(e) {
    if (!drag) return;
    setDrag(d => ({ ...d, offsetX: e.clientX - d.startX }));
  }
  function onPointerUp() {
    if (!drag) return;
    const threshold = (wrapRef.current?.offsetWidth ?? 240) * 0.2;
    if (Math.abs(drag.offsetX) > threshold) go(tabIdx + (drag.offsetX < 0 ? 1 : -1));
    setDrag(null);
  }

  const rawPx   = drag?.offsetX ?? 0;
  const slidePx = tabIdx === 0         ? Math.min(0, rawPx) * 0.25
                : tabIdx === TOTAL - 1 ? Math.max(0, rawPx) * 0.25
                : rawPx;

  const emptyMsg = { must: "Nothing here.", should: "Nothing here.", could: "Nothing here." };

  return (
    <div className="task-columns">
      {/* Tab bar */}
      <div className="bucket-tabs-row">
        {viewAll ? <div style={{ flex:1 }} /> : (<>
          <div className="bucket-tab-labels" style={{ paddingLeft:0 }}>
            {BUCKET_TABS.map((t, i) => (
              <button key={t.key}
                className={`bucket-tab-lbl${i === tabIdx ? " active" : ""}`}
                onClick={() => setTabIdx(i)}
              >{t.label}</button>
            ))}
          </div>
          <div style={{ flex:1 }} />
        </>)}
        <button
          className={`bucket-view-toggle${viewAll ? " active" : ""}`}
          onClick={() => setViewAll(v => !v)}
          aria-label={viewAll ? "Switch to single bucket view" : "View all buckets"}
          title={viewAll ? "Single view" : "View all"}
        >
          {viewAll ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>
            </svg>
          )}
        </button>
      </div>

      {viewAll ? (
        /* All-buckets view */
        <div className="bucket-all-view" style={{ userSelect:"none", WebkitUserSelect:"none" }}>
          {BUCKET_TABS.map((tab, i) => {
            const tasks = allByTab[i].filter(t => !t.done);
            return (
              <div
                key={tab.key}
                data-bucket-key={tab.key}
                className={`bucket-all-section${dragOverKey === tab.key ? " drag-over" : ""}`}
              >
                <div className="bucket-all-header">{tab.title}</div>
                {tasks.map(t => (
                  <div
                    key={t.id}
                    className={`bucket-task-draggable${ptrDrag?.id === t.id ? " is-dragging" : ""}`}
                  >
                    <div
                      className="drag-handle"
                      onPointerDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setPtrDrag({ id: t.id, fromBucket: tab.key, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, label: t.name, moved: false });
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/>
                        <circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
                        <circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
                      </svg>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <NewTaskRow task={t} onToggle={onToggle} onOpenEdit={onOpenEdit} onEdit={onEdit} onParalysis={onParalysis} onDelete={onDelete} />
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="bucket-empty-label">{emptyMsg[tab.key]}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Single-bucket carousel */
        <>
          <div
            ref={wrapRef}
            style={{ overflow:"hidden", touchAction:"pan-y", userSelect:"none", WebkitUserSelect:"none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="bucket-main-card"
              style={{ transform: `translateX(${slidePx}px)`, transition: drag ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)" }}
            >
              {pending.map(t => (
                <NewTaskRow key={t.id} task={t} onToggle={onToggle} onOpenEdit={onOpenEdit} onEdit={onEdit} onParalysis={onParalysis} onDelete={onDelete} />
              ))}
              {pending.length === 0 && (
                <div className="bucket-empty-label">{emptyMsg[active.key]}</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Today's Wins */}
      {sessionWins.length > 0 && (
        <WinsCardSection wins={sessionWins} onUncomplete={onUncomplete} />
      )}

      {/* Drag ghost — follows pointer on touch/desktop. Portaled to <body>: an ancestor's fadeUp
          animation leaves a transform behind, which turns position:fixed into "relative to that
          ancestor" and made the ghost land far below the finger. */}
      {ptrDrag?.moved && createPortal(
        <div style={{
          position:"fixed", left:ptrDrag.x, top:ptrDrag.y,
          transform:"translate(-50%,-50%) rotate(2deg) scale(1.04)",
          background:"var(--card)", border:"1.5px solid var(--teal-dark)",
          borderRadius:8, padding:"6px 12px", fontSize:13, fontWeight:500, fontFamily:"'DM Sans',sans-serif",
          color:"var(--ink)", boxShadow:"0 4px 16px rgba(0,0,0,0.18)",
          pointerEvents:"none", zIndex:9999, maxWidth:220,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        }}>
          {ptrDrag.label}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── ICS Export ───────────────────────────────────────────────────────────────
function generateICS(schedule, date) {
  const pad = n => String(n).padStart(2, "0");
  const fmtDT = (d, hFloat) => {
    const hour = Math.floor(hFloat);
    const mins = Math.round((hFloat % 1) * 60);
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(hour)}${pad(mins)}00`;
  };

  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;

  const events = Object.entries(schedule).flatMap(([slot, blocks]) =>
    blocks.map(block => {
      const h = parseFloat(slot);
      const durationHours = block.duration ? block.duration / 60 : 0.5;
      return [
        "BEGIN:VEVENT",
        `UID:${block.id}-${fmtDT(date, h)}@mindfull`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${fmtDT(date, h)}`,
        `DTEND:${fmtDT(date, h + durationHours)}`,
        `SUMMARY:${block.name}`,
        block.tag ? `DESCRIPTION:${block.tag}` : null,
        "END:VEVENT",
      ].filter(Boolean).join("\r\n");
    })
  );

  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//MyBattery//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    ...events,"END:VCALENDAR"].join("\r\n");
}

function downloadICS(content, filename) {
  const blob = new Blob([content], { type:"text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href:url, download:filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── MindfulnessPrompt ────────────────────────────────────────────────────────
function MindfulnessPrompt({ energy, onAdd }) {
  const pool = MINDFULNESS_TASKS[energy] ?? MINDFULNESS_TASKS.med;
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * pool.length));
  const [added, setAdded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const suggestion = pool[idx];

  function shuffle() {
    setIdx(i => {
      let next = Math.floor(Math.random() * pool.length);
      if (next === i) next = (i + 1) % pool.length;
      return next;
    });
    setAdded(false);
  }

  function handleAdd() {
    onAdd?.(suggestion.text);
    setAdded(true);
  }

  return (
    <div className="panel-card mindfulness-prompt-card">
      <div className="panel-title" style={{ marginBottom: collapsed ? 0 : 10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{display:"inline-flex",alignItems:"center",gap:6}}><Icon name="leaf" size={14} style={{color:"var(--teal-dark)"}} />Mindfulness suggestion</span>
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-mute)", padding:"0 0 0 8px", lineHeight:1, display:"flex", alignItems:"center" }}
          aria-label={collapsed ? "Expand" : "Minimize"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ transition:"transform 0.2s", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="mindfulness-prompt-body">
            <span className="mindfulness-prompt-icon"><Icon name={suggestion.icon} size={18} style={{color:"var(--teal-dark)"}} /></span>
            <div className="mindfulness-prompt-text">{suggestion.text}</div>
          </div>
          <div className="mindfulness-prompt-actions">
            <button
              className="mindfulness-btn-add"
              disabled={added}
              onClick={handleAdd}
            >
              {added ? <span style={{display:"inline-flex",alignItems:"center",gap:5}}><Icon name="check-circle" size={13} />Added to today</span> : "+ Add as a task"}
            </button>
            <button className="mindfulness-btn-shuffle" onClick={shuffle}>
              ↻ Different one
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── iOS-style time picker ───────────────────────────────────────────────────
const IOS_ITEM_H   = 38;
const IOS_VISIBLE  = 5;                           // rows shown
const IOS_PAD      = IOS_ITEM_H * 2;             // padding so first/last can centre
const IOS_H        = IOS_ITEM_H * IOS_VISIBLE;   // total container height

const HOUR_LABELS  = Array.from({ length: 24 }, (_, i) => {
  if (i === 0)  return "12 am";
  if (i === 12) return "12 pm";
  return i < 12 ? `${i} am` : `${i - 12} pm`;
});
const MIN_LABELS = [":00", ":15", ":30", ":45"];

function IosPickerColumn({ items, selectedIdx, onSelect, width }) {
  const scrollRef  = useRef();
  const timerRef   = useRef();
  const internalRef = useRef(selectedIdx); // track last confirmed idx

  // Scroll to position on mount (instant) and when selectedIdx changes externally (smooth)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (internalRef.current !== selectedIdx) {
      internalRef.current = selectedIdx;
      el.scrollTo({ top: selectedIdx * IOS_ITEM_H, behavior: "smooth" });
    }
  }, [selectedIdx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = selectedIdx * IOS_ITEM_H;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / IOS_ITEM_H)));
      internalRef.current = idx;
      el.scrollTo({ top: idx * IOS_ITEM_H, behavior: "smooth" });
      onSelect(idx);
    }, 80);
  }

  return (
    <div className="ios-picker-col" style={{ width, height: IOS_H }}>
      {/* Fade overlays */}
      <div style={{ position:"absolute", inset:"0 0 auto 0", height: IOS_PAD, background:"linear-gradient(to bottom, rgba(255,255,255,0.97), rgba(255,255,255,0))", zIndex:2, pointerEvents:"none" }} />
      <div style={{ position:"absolute", inset:"auto 0 0 0", height: IOS_PAD, background:"linear-gradient(to top, rgba(255,255,255,0.97), rgba(255,255,255,0))", zIndex:2, pointerEvents:"none" }} />
      {/* Selection bar */}
      <div style={{ position:"absolute", top: IOS_PAD, left:6, right:6, height: IOS_ITEM_H, borderTop:"1.5px solid var(--warm)", borderBottom:"1.5px solid var(--warm)", borderRadius:8, background:"rgba(90,122,90,0.05)", zIndex:1, pointerEvents:"none" }} />
      {/* Scroll drum */}
      <div ref={scrollRef} className="ios-picker-col-scroll" onScroll={handleScroll}
        style={{ height:"100%", paddingTop: IOS_PAD, paddingBottom: IOS_PAD }}>
        {items.map((label, i) => (
          <div key={i} className="ios-picker-item"
            style={{ height: IOS_ITEM_H, fontSize: i === selectedIdx ? 17 : 15, fontWeight: i === selectedIdx ? 500 : 400, color: i === selectedIdx ? "var(--ink)" : "var(--ink-mute)" }}
            onClick={() => { internalRef.current = i; onSelect(i); scrollRef.current?.scrollTo({ top: i * IOS_ITEM_H, behavior:"smooth" }); }}
          >{label}</div>
        ))}
      </div>
    </div>
  );
}

function IosTimePicker({ value, onChange, label }) {
  const hourIdx = Math.floor(value);
  const minIdx  = Math.min(3, Math.round((value % 1) / 0.25));

  return (
    <div>
      {label && <div className="ios-picker-label">{label}</div>}
      <div className="ios-picker-wrap">
        <IosPickerColumn items={HOUR_LABELS} selectedIdx={hourIdx} onSelect={h => onChange(h + minIdx * 0.25)} width={90} />
        <div className="ios-picker-divider" style={{ height: IOS_H * 0.6 }} />
        <IosPickerColumn items={MIN_LABELS}  selectedIdx={minIdx}  onSelect={m => onChange(hourIdx + m * 0.25)}  width={58} />
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────
function appliesToDate(r, dateStr, dayOfWeek) {
  if (dateStr < r.startDate) return false;
  if (r.exceptions?.includes(dateStr)) return false;
  if (r.recurrence === "daily") return true;
  if (r.recurrence === "weekdays") return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (r.recurrence === "custom" && Array.isArray(r.days)) return r.days.includes(dayOfWeek);
  // legacy "weekly" records: match same day-of-week as startDate
  if (r.recurrence === "weekly") {
    const start = new Date(r.startDate + "T12:00:00");
    return start.getDay() === dayOfWeek;
  }
  return false;
}

const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Guests keep everything on this phone only, and iOS can clear that storage. Say so once per
// launch, quietly, with a way to move to an account.
function GuestNote({ onCreateAccount }) {
  const KEY = "reflow-guest-note-hidden";
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } });
  if (hidden) return null;
  return (
    <div className="guest-note" role="note">
      <span className="guest-note-text">No account yet, so this only lives on this phone.</span>
      <button className="guest-note-link" onClick={onCreateAccount}>Create account</button>
      <button className="guest-note-close" aria-label="Dismiss" onClick={() => { try { sessionStorage.setItem(KEY, "1"); } catch {} setHidden(true); }}>×</button>
    </div>
  );
}

function CalendarView({ tasks, energy, shutdownDays, onToast, onBack, powerMode = false, uid, saveCalendarDay, subscribeCalendarDay, recurringEvents = [], onSaveRecurringEvents, battery = 100, onBatteryChange, onLogEnergy, energyMap = [], isPro = false, onOpenPaywall, calPermission = "prompt", deviceCalEventsByDay = {} }) {
  const today      = new Date();
  const [weekOffset, setWeekOffset] = useState(0); // weeks from current
  const weekDays   = (() => {
    const base = new Date(today);
    const day  = base.getDay();
    base.setDate(base.getDate() - ((day + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base); d.setDate(base.getDate() + i); return d;
    });
  })();
  const [selDate, setSelDate] = useState(today);

  // per-day schedules: Map<dateKey, {hour -> [block]}>
  // When authenticated, start empty so Firestore onSnapshot is always authoritative.
  // localStorage is written on every save as an offline fallback only.
  const [schedules, setSchedules] = useState(() => {
    if (uid) return {};
    try { return JSON.parse(localStorage.getItem("reflow-schedules") || "{}"); } catch { return {}; }
  });
  const [eventsMap, setEventsMap] = useState(() => {
    if (uid) return {};
    try { return JSON.parse(localStorage.getItem("reflow-events") || "{}"); } catch { return {}; }
  });
  const [focusStart, setFocusStart] = useState("09");
  const [focusMins,  setFocusMins]  = useState("0");
  const [focusDur,   setFocusDur]   = useState("90");
  const [mlActivity,   setMlActivity]   = useState("");
  const [mlStart,      setMlStart]      = useState(9);
  const [mlEnd,        setMlEnd]        = useState(10);
  const [mlRecurrence,  setMlRecurrence]  = useState("none");
  const [mlCustomDays,  setMlCustomDays]  = useState(() => [selDate.getDay()]); // day-of-week indices
  const [removingRecId, setRemovingRecId] = useState(null);
  const [activePicker,  setActivePicker]  = useState(null); // null | "start" | "end"
  const [mlEnergyValue,     setMlEnergyValue]     = useState(0);         // -50 (exhausting) → 0 (neutral) → +50 (restorative)
  const [doneEventIds,      setDoneEventIds]      = useState(new Set());  // ids marked done today
  const [mlNotes,           setMlNotes]           = useState("");
  const [mlEventImpactMode, setMlEventImpactMode] = useState("drain");
  const [mlEventIntensity,  setMlEventIntensity]  = useState(10);
  const [editingEventId,    setEditingEventId]    = useState(null);
  const [editingRecId,      setEditingRecId]      = useState(null);

  const selKey = selDate.toLocaleDateString("en-CA"); // YYYY-MM-DD, matches Firestore doc IDs
  const isToday = selKey === todayKey();
  const schedule = schedules[selKey] || {};
  const dayRecurringEvents = recurringEvents.filter(r => appliesToDate(r, selKey, selDate.getDay()));

  // Reset done-event marks, pickers, and editing state when the user navigates to a different day
  useEffect(() => { setDoneEventIds(new Set()); setActivePicker(null); setEditingEventId(null); setEditingRecId(null); }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Device calendar events for the selected day.
  // Primary source: the 30-day cache built by the parent's get30DayEvents() call.
  // Fallback: direct API call for days outside that window.
  const [deviceCalEvents, setDeviceCalEvents] = useState([]);
  useEffect(() => {
    if (calPermission !== "granted") { setDeviceCalEvents([]); return; }
    const cached = deviceCalEventsByDay[selKey];
    if (cached !== undefined) { setDeviceCalEvents(cached); return; }
    const start = new Date(selDate); start.setHours(0,0,0,0);
    const end   = new Date(selDate); end.setHours(23,59,59,999);
    const cal = window.Capacitor?.Plugins?.CapacitorCalendar;
    if (!cal || !window.Capacitor?.isNativePlatform?.()) return;
    cal.listEventsInRange({ from: start.getTime(), to: end.getTime() })
      .then(({ result }) => setDeviceCalEvents((result || []).map(mapNativeEvent).sort((a,b) => a.startDate - b.startDate)))
      .catch(() => setDeviceCalEvents([]));
  }, [selKey, calPermission, deviceCalEventsByDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Receive events added from the task modal without a full re-mount
  useEffect(() => {
    function handleExternalEvent(e) {
      const { dateKey, event } = e.detail;
      setEventsMap(prev => {
        const day = prev[dateKey] || [];
        if (day.find(ev => ev.id === event.id)) return prev;
        return { ...prev, [dateKey]: [...day, event] };
      });
    }
    window.addEventListener("reflow-calendar-event-added", handleExternalEvent);
    return () => window.removeEventListener("reflow-calendar-event-added", handleExternalEvent);
  }, []);

  // Re-fetch device calendar events when a task is added to the device calendar.
  // Bypasses the cache so the new event is visible immediately.
  useEffect(() => {
    function handleDeviceCalUpdated(e) {
      if (calPermission !== "granted") return;
      const cal = window.Capacitor?.Plugins?.CapacitorCalendar;
      if (!cal || !window.Capacitor?.isNativePlatform?.()) return;
      const start = new Date(selDate); start.setHours(0,0,0,0);
      const end   = new Date(selDate); end.setHours(23,59,59,999);
      cal.listEventsInRange({ from: start.getTime(), to: end.getTime() })
        .then(({ result }) => setDeviceCalEvents((result || []).map(mapNativeEvent).sort((a,b) => a.startDate - b.startDate)))
        .catch(() => {});
    }
    window.addEventListener("reflow-device-calendar-updated", handleDeviceCalUpdated);
    return () => window.removeEventListener("reflow-device-calendar-updated", handleDeviceCalUpdated);
  }, [selDate, calPermission]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time Firestore subscription for the selected day.
  // Uses functional state updates to avoid stale-closure reads of schedules/eventsMap.
  useEffect(() => {
    if (!uid || !subscribeCalendarDay) return;
    const unsub = subscribeCalendarDay(uid, selKey, ({ schedule: s, events: e }) => {
      setSchedules(prev => {
        const next = { ...prev, [selKey]: s };
        localStorage.setItem("reflow-schedules", JSON.stringify(next));
        return next;
      });
      setEventsMap(prev => {
        const next = { ...prev, [selKey]: e };
        localStorage.setItem("reflow-events", JSON.stringify(next));
        return next;
      });
    });
    return unsub;
  }, [uid, selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Write to Firestore (primary) and localStorage (offline fallback).
  // nextSchedule / nextEvents are the already-updated values, so we don't read stale state.
  function persistDay(nextSchedule, nextEvents) {
    if (uid && saveCalendarDay) {
      saveCalendarDay(uid, selKey, nextSchedule, nextEvents).catch(err => {
        console.error("Calendar save failed:", err);
        onToast({ type:"warn", title:"Couldn't save to cloud", msg:"Your changes are saved locally but may not sync across devices. Check your connection." });
      });
    }
    setSchedules(prev => {
      const next = { ...prev, [selKey]: nextSchedule };
      localStorage.setItem("reflow-schedules", JSON.stringify(next));
      return next;
    });
    setEventsMap(prev => {
      const next = { ...prev, [selKey]: nextEvents };
      localStorage.setItem("reflow-events", JSON.stringify(next));
      return next;
    });
  }

  // current time position
  const nowHour = today.getHours() + today.getMinutes() / 60;

  const hourGridRef = useRef(null);
  const formRef     = useRef(null);
  // The add/edit form stays tucked away until it's needed.
  const [showForm, setShowForm] = useState(false);
  function openForm() {
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior:"smooth", block:"center" });
      formRef.current?.querySelector("input")?.focus();
    }, 50);
  }
  // The timeline starts at 6am, or an hour before now later in the day (never after 6pm, so
  // there's always a good stretch of evening visible); earlier hours are one tap away.
  const defaultStartH = isToday ? Math.min(18, Math.max(6, Math.floor(nowHour) - 1)) : 6;
  const [startH, setStartH] = useState(defaultStartH);
  useEffect(() => { setStartH(defaultStartH); setShowForm(false); }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Position of a block on the visible part of the timeline (null if it ends before it starts).
  function slot(start, end) {
    if (end <= startH) return null;
    const from = Math.max(start, startH);
    return { top: (from - startH) * 2 * ROW_H, height: (end - from) * 2 * ROW_H };
  }

  function doAutoSchedule() {
    const minHour = isToday ? nowHour : 0;
    const { schedule: sched, noTime } = autoSchedule(tasks, energy, schedules[selKey] || {}, eventsMap[selKey] || [], minHour, energyMap, battery);
    persistDay(sched, eventsMap[selKey] || []);
    if (noTime.length > 0) {
      const names = noTime.map(t => t.name).join(", ");
      onToast({ type:"warn", title:"We may not have time for that today.", msg:`Couldn't fit: ${names}` });
    } else {
      onToast({ type:"scheduled", title:"Day scheduled.", msg:"Tasks placed into your energy zones. Adjust anytime." });
    }
  }

  function addFocusBlock() {
    const requested = parseInt(focusStart, 10) + parseInt(focusMins, 10) / 60;
    if (isNaN(requested) || requested < 0 || requested > 23.5) return;
    const dur        = parseInt(focusDur, 10);
    const slotsNeeded = Math.max(1, Math.ceil(dur / 30));
    const minHour    = isToday ? nowHour : 0;
    const occupied   = buildOccupied(schedules[selKey] || {}, eventsMap[selKey] || []);
    const h          = findFreeBlock(occupied, requested, slotsNeeded, minHour);
    if (h === null) {
      onToast && onToast({ type:"warn", title:"No room left.", msg:`Couldn't find ${dur}m free after ${formatHour(requested)}. Try a shorter block or a different time.` });
      return;
    }
    const shifted = h !== requested;
    const block = { id:`focus-${Date.now()}`, type:"focus", name:`Focus block (${dur}m)`, tag:"protected", duration: dur };
    const day = { ...(schedules[selKey] || {}), [h]: [...((schedules[selKey] || {})[h] || []), block] };
    persistDay(day, eventsMap[selKey] || []);
    if (shifted) onToast && onToast({ type:"scheduled", title:"Shifted to avoid overlap.", msg:`Focus block moved to ${formatHour(h)} — next open slot.` });
  }

  function removeBlock(hour, blockId) {
    const cur = schedules[selKey] || {};
    const day = { ...cur, [hour]: (cur[hour] || []).filter(b => b.id !== blockId) };
    persistDay(day, eventsMap[selKey] || []);
  }

  const EVENT_COLORS = [
    { bg:"rgba(90,122,90,0.13)",  border:"var(--teal-dark)" },
    { bg:"rgba(106,138,170,0.13)",border:"#5a8aaa" },
    { bg:"rgba(196,168,130,0.2)", border:"var(--slate-dark)" },
    { bg:"rgba(170,130,170,0.13)",border:"#8a5a8a" },
    { bg:"rgba(170,106,106,0.13)",border:"#aa5a5a" },
  ];

  function startEditEvent(ev) {
    openForm();
    setEditingEventId(ev.id);
    setMlActivity(ev.activity);
    setMlStart(ev.startHour);
    setMlEnd(ev.endHour);
    setMlRecurrence("none");
    setMlEnergyValue(ev.energyImpact ?? 0);
    setActivePicker(null);
  }

  function cancelEdit() {
    setShowForm(false);
    setEditingEventId(null);
    setEditingRecId(null);
    setMlActivity("");
    setMlStart(9);
    setMlEnd(10);
    setMlRecurrence("none");
    setMlCustomDays([selDate.getDay()]);
    setMlEnergyValue(0);
    setActivePicker(null);
  }

  function startEditRecEvent(ev) {
    openForm();
    setEditingRecId(ev.id);
    setEditingEventId(null);
    setMlActivity(ev.activity);
    setMlStart(ev.startHour);
    setMlEnd(ev.endHour);
    setMlRecurrence(ev.recurrence);
    setMlCustomDays(ev.days || [selDate.getDay()]);
    setMlEnergyValue(ev.energyImpact ?? 0);
    setActivePicker(null);
  }

  function updateRecurringAll() {
    const name         = mlActivity.trim();
    const energyImpact = mlEnergyValue;
    const activeDays   = mlRecurrence === "daily"    ? [0,1,2,3,4,5,6]
                       : mlRecurrence === "weekdays" ? [1,2,3,4,5]
                       : mlCustomDays.slice().sort((a,b) => a - b);
    const next = recurringEvents.map(r =>
      r.id === editingRecId
        ? { ...r, activity: name, startHour: mlStart, endHour: mlEnd, energyImpact, recurrence: mlRecurrence, days: activeDays }
        : r
    );
    onSaveRecurringEvents && onSaveRecurringEvents(next);
    onToast && onToast({ type:"win", title:"↻ Updated all.", msg:`${name} · ${formatDuration(crossMidnightDur(mlStart, mlEnd))}` });
    cancelEdit();
  }

  function updateRecurringToday() {
    const name         = mlActivity.trim();
    const energyImpact = mlEnergyValue;
    const rec          = recurringEvents.find(r => r.id === editingRecId);
    if (!rec) { cancelEdit(); return; }
    // Add today as exception to the recurring series
    const nextRec = recurringEvents.map(r =>
      r.id === editingRecId ? { ...r, exceptions: [...(r.exceptions || []), selKey] } : r
    );
    onSaveRecurringEvents && onSaveRecurringEvents(nextRec);
    // Create a one-time override for today
    const colorIdx = rec.colorIdx ?? (eventsMap[selKey] || []).length % EVENT_COLORS.length;
    const ev = { id:`ev-${Date.now()}`, activity: name, startHour: mlStart, endHour: mlEnd, colorIdx, energyImpact };
    persistDay(schedules[selKey] || {}, [...(eventsMap[selKey] || []), ev]);
    onToast && onToast({ type:"win", title:"Updated today.", msg:`${name} · ${formatDuration(crossMidnightDur(mlStart, mlEnd))}` });
    cancelEdit();
  }

  function addCustomEvent() {
    if (!mlActivity.trim() || mlEnd === mlStart) return;
    const name         = mlActivity.trim();
    const dur          = formatDuration(crossMidnightDur(mlStart, mlEnd));
    const energyImpact = mlEnergyValue;

    if (editingEventId) {
      const nextEvents = (eventsMap[selKey] || []).map(e =>
        e.id === editingEventId
          ? { ...e, activity: name, startHour: mlStart, endHour: mlEnd, energyImpact }
          : e
      );
      persistDay(schedules[selKey] || {}, nextEvents);
      onToast && onToast({ type:"win", title:"Updated.", msg:`${name} · ${dur}` });
      cancelEdit();
      return;
    }

    const colorIdx = (eventsMap[selKey] || []).length % EVENT_COLORS.length;

    if (mlRecurrence !== "none") {
      const activeDays = mlRecurrence === "daily"    ? [0,1,2,3,4,5,6]
                       : mlRecurrence === "weekdays" ? [1,2,3,4,5]
                       : mlCustomDays.slice().sort((a,b) => a - b);
      if (mlRecurrence === "custom" && activeDays.length === 0) {
        onToast && onToast({ type:"warn", title:"Pick at least one day", msg:"Select which days this event should repeat." });
        return;
      }
      const rec = {
        id: `rec-${Date.now()}`,
        activity: name,
        startHour: mlStart,
        endHour: mlEnd,
        colorIdx,
        energyImpact,
        recurrence: mlRecurrence === "custom" ? "custom" : mlRecurrence,
        days: activeDays,
        startDate: selKey,
        exceptions: [],
      };
      onSaveRecurringEvents && onSaveRecurringEvents([...recurringEvents, rec]);
      const label = mlRecurrence === "daily"    ? "every day"
                  : mlRecurrence === "weekdays" ? "weekdays"
                  : activeDays.map(d => DAY_LABELS[d]).join(", ");
      onToast && onToast({ type:"win", title:"↻ Recurring event saved.", msg:`${name} · ${dur} · ${label}` });
    } else {
      const ev = { id:`ev-${Date.now()}`, activity: name, startHour: mlStart, endHour: mlEnd, colorIdx, energyImpact, ...(mlNotes.trim() && { notes: mlNotes.trim() }) };
      persistDay(schedules[selKey] || {}, [...(eventsMap[selKey] || []), ev]);
      onToast && onToast({ type:"win", title:"Added.", msg:`${name} · ${dur}` });
    }

    setStartH(h => Math.min(h, Math.floor(mlStart))); // make sure the new event is on screen
    setMlActivity("");
    setMlNotes("");
    setMlStart(mlEnd);
    setMlEnd(Math.min(mlEnd + 1, 23.75));
    setMlRecurrence("none");
    setMlCustomDays([selDate.getDay()]);
    setMlEventImpactMode("drain");
    setMlEventIntensity(10);
    setActivePicker(null);
    setShowForm(false);
  }

  function removeCustomEvent(id) {
    const nextEvents = (eventsMap[selKey] || []).filter(e => e.id !== id);
    persistDay(schedules[selKey] || {}, nextEvents);
  }

  function removeRecurringToday(id) {
    const next = recurringEvents.map(r =>
      r.id === id ? { ...r, exceptions: [...(r.exceptions || []), selKey] } : r
    );
    onSaveRecurringEvents && onSaveRecurringEvents(next);
    setRemovingRecId(null);
  }

  function removeRecurringSeries(id) {
    onSaveRecurringEvents && onSaveRecurringEvents(recurringEvents.filter(r => r.id !== id));
    setRemovingRecId(null);
  }

  function markEventDone(id, energyImpact, label) {
    if (doneEventIds.has(id)) {
      setDoneEventIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (energyImpact && onBatteryChange) onBatteryChange(prev => Math.max(0, Math.min(100, prev - energyImpact)));
    } else {
      setDoneEventIds(prev => new Set([...prev, id]));
      if (energyImpact && onBatteryChange) {
        onBatteryChange(prev => {
          const next = Math.max(0, Math.min(100, prev + energyImpact));
          onLogEnergy && onLogEnergy(energyImpact, label || "Calendar event", "event", next);
          return next;
        });
      }
      if (energyImpact) {
        const sign = energyImpact > 0 ? "+" : "";
        onToast && onToast({ type:"win", title:"Event done", msg:`Battery ${sign}${energyImpact}%` });
      }
    }
  }

  function crossMidnightDur(start, end) {
    return end < start ? (24 - start + end) : (end - start);
  }

  function formatDuration(hrs) {
    const total = Math.round(hrs * 60);
    const h = Math.floor(total / 60), m = total % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  const TIME_OPTIONS = HOURS.map(h => ({ value: h, label: formatHour(h) }));

  const scheduledIds = new Set(
    Object.values(schedule).flat().map(b => b.id).filter(id => typeof id === "number")
  );

  const unscheduledTasks = tasks.filter(t => !t.done && !scheduledIds.has(t.id));

  const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  return (
    <div className="cal-page">
      <div className="cal-header">
        <div className="cal-title">
          {selDate.toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" })}
        </div>
      </div>

      {/* Week strip */}
      <div className="week-strip">
        <button className="week-nav-btn" onClick={() => setWeekOffset(o => o - 1)} aria-label="Previous week">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="week-strip-days">
          {weekDays.map((d, i) => {
            const k = d.toLocaleDateString("en-CA");
            const isTod = k === todayKey();
            const isSel = k === selKey;
            const hasSched = !!(schedules[k] && Object.values(schedules[k]).flat().length > 0);
            const didShutdown = shutdownDays.has(k);
            return (
              <button key={i} className={`week-day-pill${isTod?" today":""}${isSel?" selected":""}`} onClick={() => setSelDate(new Date(d))}>
                <span className="week-day-letter">{DAY_NAMES[i]}</span>
                <span className="week-day-num-circle">
                  <span className="week-day-num">{d.getDate()}</span>
                </span>
                {(hasSched || didShutdown) && (
                  <span className="week-day-dot-row">
                    {hasSched    && <span className="week-dot task-dot" />}
                    {didShutdown && <span className="week-shutdown-dot" title="Shutdown completed" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button className="week-nav-btn" onClick={() => setWeekOffset(o => o + 1)} aria-label="Next week">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {!showForm && (
        <button className="cal-add-link" onClick={() => {
          // Default to the next hour today, 9am on other days
          const from = isToday ? Math.min(22, Math.ceil(nowHour)) : 9;
          setMlStart(from); setMlEnd(from + 1);
          openForm();
        }}>
          + Add to {selDate.toLocaleDateString("en-US", { month:"short", day:"numeric" })}
        </button>
      )}

      {/* Event entry form — opens from the link above, a timeline slot, or an event's edit button */}
      {showForm && <div className="ml-event-form" ref={formRef} style={{ marginBottom:16 }}>
        {/* Mad-lib sentence — time buttons are inline and clickable */}
        <div className="ml-sentence">
          {"I'm "}
          <input
            className="ml-input"
            placeholder="doing what"
            value={mlActivity}
            onChange={e => setMlActivity(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustomEvent()}
            style={{ width: mlActivity ? Math.max(80, mlActivity.length * 8) : 90 }}
          />
          {" from "}
          <button className={`ml-time-btn${activePicker==="start"?" active":""}`}
            onClick={() => setActivePicker(p => p==="start" ? null : "start")}>
            {formatHour(mlStart)}
          </button>
          {" to "}
          <button className={`ml-time-btn${activePicker==="end"?" active":""}`}
            onClick={() => setActivePicker(p => p==="end" ? null : "end")}>
            {formatHour(mlEnd)}
          </button>
          {mlEnd < mlStart && <sup className="ml-nextday">+1</sup>}
          {"."}
        </div>

        {activePicker === "start" && (
          <IosTimePicker
            value={mlStart}
            onChange={v => { setMlStart(v); }}
          />
        )}
        {activePicker === "end" && (
          <IosTimePicker
            value={mlEnd}
            onChange={v => { if (v !== mlStart) setMlEnd(v); }}
          />
        )}

        {/* Energy impact */}
        <div className="ml-form-section ml-impact-row">
          <div className="ml-impact-header">
            <span className="ml-impact-label-text">Energy impact</span>
            <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:500,
              color: mlEnergyValue < 0 ? "var(--error)" : mlEnergyValue > 0 ? "var(--teal-dark)" : "var(--ink-mute)" }}>
              {mlEnergyValue > 0 ? "+" : ""}{mlEnergyValue}
            </span>
          </div>
          <div className="ml-impact-track-wrap">
            <input
              type="range"
              className="impact-slider"
              min={-100} max={100} step={5}
              value={mlEnergyValue}
              onChange={e => setMlEnergyValue(Number(e.target.value))}
              style={{ accentColor: mlEnergyValue < 0 ? "var(--error)" : mlEnergyValue > 0 ? "var(--teal-dark)" : "var(--ink-mute)" }}
            />
            <div className="ml-impact-center-tick" />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--ink-mute)", marginTop:5 }}>
            <span>Drains</span>
            <span>Neutral</span>
            <span>Recharges</span>
          </div>
        </div>

        {/* Frequency row */}
        <div className="ml-form-section">
          <div className="ml-repeat-row">
            <div className="ml-repeat-left">
              <div className="ml-check-item" {...asButton(() => {
                if (!isPro && mlRecurrence === "none") { onOpenPaywall?.(); return; }
                setMlRecurrence(r => r === "none" ? "daily" : "none");
              }, "checkbox", { "aria-checked": mlRecurrence !== "none" })} onClick={() => {
                if (!isPro && mlRecurrence === "none") { onOpenPaywall?.(); return; }
                setMlRecurrence(r => r === "none" ? "daily" : "none");
              }}>
                <span className={`ml-chk-box${mlRecurrence !== "none" ? " checked" : ""}`} />
                <span className="ml-repeat-label">Repeats {!isPro && <span style={{fontSize:10,color:"var(--teal-dark)",fontFamily:"'DM Mono',monospace",marginLeft:3}}>✦ Pro</span>}</span>
              </div>
              <select
                className="ml-select"
                value={mlRecurrence}
                onChange={e => {
                  if (!isPro) { onOpenPaywall?.(); return; }
                  const v = e.target.value;
                  setMlRecurrence(v);
                  if (v === "daily")         setMlCustomDays([0,1,2,3,4,5,6]);
                  else if (v === "weekdays") setMlCustomDays([1,2,3,4,5]);
                  else if (v === "custom")   setMlCustomDays([selDate.getDay()]);
                }}
              >
                <option value="none">Never</option>
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays (Mon – Fri)</option>
                <option value="custom">Custom days…</option>
              </select>
            </div>
          </div>

          {mlRecurrence === "custom" && (
            <div className="ml-day-picker">
              {DAY_LABELS.map((label, idx) => {
                const active = mlCustomDays.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`ml-day-btn${active ? " active" : ""}`}
                    onClick={() => setMlCustomDays(active
                      ? mlCustomDays.filter(d => d !== idx)
                      : [...mlCustomDays, idx]
                    )}
                  >{label.slice(0,1)}</button>
                );
              })}
              <span className="ml-day-hint">
                {mlCustomDays.length === 0
                  ? "pick at least one"
                  : mlCustomDays.slice().sort((a,b)=>a-b).map(d=>DAY_LABELS[d]).join(", ")}
              </span>
            </div>
          )}
        </div>

        <div className="ml-form-section">
          {editingRecId ? (
            <>
              <div className="ml-rec-update-row">
                <button className="ml-save-btn ml-save-btn--half" disabled={!mlActivity.trim() || mlEnd === mlStart} onClick={updateRecurringToday}>Today</button>
                <button className="ml-save-btn ml-save-btn--half" disabled={!mlActivity.trim() || mlEnd === mlStart} onClick={updateRecurringAll}>All</button>
              </div>
              <button className="ml-cancel-btn" onClick={cancelEdit}>Cancel</button>
            </>
          ) : (
            <>
              <button className="ml-save-btn" disabled={!mlActivity.trim() || mlEnd === mlStart} onClick={addCustomEvent}>
                {editingEventId ? "Update" : "Save"}
              </button>
              <button className="ml-cancel-btn" onClick={cancelEdit}>Cancel</button>
            </>
          )}
        </div>
      </div>}

      <div className="cal-body">
        {/* Day view */}
        <div className="day-view">
          <div className="zone-legend">
            <span className="zone-badge"><span className="zone-swatch peak" />Peak</span>
            <span className="zone-badge"><span className="zone-swatch dip" />Dip</span>
            <span className="zone-badge"><span className="zone-swatch wind" />Wind-down</span>
          </div>
          {powerMode && <div className="day-view-header">
            <div className="day-view-title">Hourly plan</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {powerMode ? (
                <>
                  <button className="btn-export"
                    disabled={Object.keys(schedule).length === 0}
                    onClick={() => {
                      if (!isPro) { onOpenPaywall?.(); return; }
                      const pad = n => String(n).padStart(2,"0");
                      const filename = `serendo-${selDate.getFullYear()}-${pad(selDate.getMonth()+1)}-${pad(selDate.getDate())}.ics`;
                      downloadICS(generateICS(schedule, selDate), filename);
                    }}>
                    {isPro ? "↓ Export .ics" : "↓ Export .ics ✦"}
                  </button>
                  <button className="btn-autoschedule" onClick={doAutoSchedule} disabled={tasks.filter(t=>!t.done).length===0}>
                    Auto-schedule
                  </button>
                </>
              ) : null}
            </div>
          </div>}

          {deviceCalEvents.filter(ev => ev.isAllDay).length > 0 && (
            <div style={{ padding:"6px 14px 6px", borderBottom:"1px solid var(--warm)", display:"flex", flexWrap:"wrap", gap:5 }}>
              {deviceCalEvents.filter(ev => ev.isAllDay).map((ev, i) => (
                <span key={ev.id||i} style={{ fontSize:11, fontFamily:"'DM Sans',sans-serif", background:"rgba(90,122,170,0.1)", color:"rgba(60,80,140,0.85)", borderRadius:20, padding:"2px 10px", border:"1px solid rgba(90,122,170,0.25)" }}>
                  {ev.title}
                </span>
              ))}
            </div>
          )}
          {startH > 0 && (
            <button className="cal-earlier-btn" onClick={() => setStartH(0)}>Show earlier hours</button>
          )}
          <div className="hour-grid" ref={hourGridRef}>
            {HOURS.filter(h => h >= startH).map(h => {
              const isHalf  = h % 1 === 0.5;
              const blocks  = schedule[h] || [];
              const zc      = zoneClass(h);
              const showNow = isToday && nowHour >= h && nowHour < h + 0.5;
              const nowPct  = ((nowHour - h) / 0.5 * 100).toFixed(1);
              const coveredByEvent = (eventsMap[selKey] || []).some(ev => h >= ev.startHour && h < ev.endHour);

              return (
                <div key={h} className={`hour-row ${zc} ${isHalf ? "half-hour" : ""}`}>
                  {showNow && <div className="now-line" style={{ top:`${nowPct}%` }} />}
                  <div className="hour-label">{isHalf ? "" : formatHour(h)}</div>
                  <div className="hour-content">
                    {blocks.map(block => (
                      <div key={block.id} className={`cal-block type-${block.type}`}>
                        <div style={{ flex:1 }}>
                          <div className="cal-block-name">{block.name}</div>
                          <div className="cal-block-tag">
                            {block.tag && <span>{block.tag}</span>}
                            {block.duration && <span style={{ marginLeft: block.tag ? 6 : 0 }}>⏱ {block.duration < 60 ? `${block.duration}m` : block.duration % 60 === 0 ? `${block.duration/60}h` : `${Math.floor(block.duration/60)}h ${block.duration%60}m`}</span>}
                          </div>
                        </div>
                        <button aria-label="Remove block" className="cal-block-remove" onClick={() => removeBlock(h, block.id)}>×</button>
                      </div>
                    ))}
                    {blocks.length === 0 && !coveredByEvent && (
                      <button className="hour-add-btn" onClick={() => {
                        setMlStart(h);
                        setMlEnd(Math.min(h + 1, 23.75));
                        openForm();
                      }}>+ Add to {formatHour(h)}</button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* One-time custom events */}
            {(eventsMap[selKey] || []).map(ev => {
              const c        = EVENT_COLORS[ev.colorIdx % EVENT_COLORS.length];
              const box      = slot(ev.startHour, ev.endHour);
              if (!box) return null;
              const topPx    = box.top;
              const heightPx = box.height;
              const isDone   = doneEventIds.has(ev.id);
              const hasImpact = ev.energyImpact !== undefined && ev.energyImpact !== 0;
              return (
                <div key={ev.id} className={`cal-event${isDone ? " event-done" : ""}${editingEventId === ev.id ? " event-editing" : ""}`} style={{ top:topPx, height:heightPx, background:c.bg, borderLeft:`3px solid ${c.border}` }}>
                  <div>
                    <div className="cal-event-name">{ev.activity}</div>
                    <div className="cal-event-meta">{formatHour(ev.startHour)} – {formatHour(ev.endHour)} · {formatDuration(ev.endHour - ev.startHour)}</div>
                    {hasImpact && (
                      <span className={`cal-event-impact ${ev.energyImpact < 0 ? "drain" : "charge"}`} style={{display:"inline-flex",alignItems:"center",gap:3}}>
                        <Icon name={ev.energyImpact > 0 ? "bolt" : "battery"} size={9} />{ev.energyImpact > 0 ? "+" : ""}{ev.energyImpact}%
                      </span>
                    )}
                  </div>
                  <button aria-label="Edit" className="cal-event-edit" onClick={() => startEditEvent(ev)} title="Edit"><Icon name="pen" size={11} /></button>
                  <button aria-label="Remove event" className="cal-event-remove" onClick={() => removeCustomEvent(ev.id)}>×</button>
                  {hasImpact && (
                    <button aria-label={isDone ? "Undo" : "Mark done"}
                      className={`cal-event-done-btn${isDone ? " marked" : ""}`}
                      title={isDone ? "Undo" : "Mark done"}
                      onClick={() => markEventDone(ev.id, ev.energyImpact, ev.activity)}
                    >{isDone ? <Icon name="check-circle" size={11} /> : "○"}</button>
                  )}
                </div>
              );
            })}
            {/* Recurring event overlays */}
            {dayRecurringEvents.map(ev => {
              const c          = EVENT_COLORS[ev.colorIdx % EVENT_COLORS.length];
              const box        = slot(ev.startHour, ev.endHour);
              if (!box) return null;
              const topPx      = box.top;
              const heightPx   = box.height;
              const isRemoving = removingRecId === ev.id;
              const isDone     = doneEventIds.has(ev.id);
              const hasImpact  = ev.energyImpact !== undefined && ev.energyImpact !== 0;
              return (
                <div key={ev.id} className={`cal-event cal-event-recurring${isDone ? " event-done" : ""}${editingRecId === ev.id ? " event-editing" : ""}`} style={{ top:topPx, height:heightPx, background:c.bg, borderLeft:`3px solid ${c.border}` }}>
                  <div>
                    <div className="cal-event-name">↻ {ev.activity}</div>
                    <div className="cal-event-meta">
                      {formatHour(ev.startHour)} – {formatHour(ev.endHour)} · {formatDuration(ev.endHour - ev.startHour)}
                      {" · "}{ev.recurrence === "daily" ? "daily"
                            : ev.recurrence === "weekdays" ? "weekdays"
                            : ev.recurrence === "custom" && ev.days?.length
                              ? ev.days.slice().sort((a,b)=>a-b).map(d=>DAY_LABELS[d]).join(", ")
                              : ev.recurrence}
                    </div>
                    {hasImpact && (
                      <span className={`cal-event-impact ${ev.energyImpact < 0 ? "drain" : "charge"}`} style={{display:"inline-flex",alignItems:"center",gap:3}}>
                        <Icon name={ev.energyImpact > 0 ? "bolt" : "battery"} size={9} />{ev.energyImpact > 0 ? "+" : ""}{ev.energyImpact}%
                      </span>
                    )}
                  </div>
                  {!isRemoving && (
                    <button aria-label="Edit" className="cal-event-edit" onClick={() => startEditRecEvent(ev)} title="Edit"><Icon name="pen" size={11} /></button>
                  )}
                  {!isRemoving ? (
                    <button aria-label="Remove event" className="cal-event-remove" onClick={() => setRemovingRecId(ev.id)}>×</button>
                  ) : (
                    <div className="cal-event-remove-choice">
                      <button onClick={() => removeRecurringToday(ev.id)}>Today</button>
                      <button onClick={() => removeRecurringSeries(ev.id)}>All</button>
                      <button aria-label="Cancel" onClick={() => setRemovingRecId(null)}>×</button>
                    </div>
                  )}
                  {hasImpact && (
                    <button aria-label={isDone ? "Undo" : "Mark done"}
                      className={`cal-event-done-btn${isDone ? " marked" : ""}`}
                      title={isDone ? "Undo" : "Mark done"}
                      onClick={() => markEventDone(ev.id, ev.energyImpact, ev.activity)}
                    >{isDone ? <Icon name="check-circle" size={11} /> : "○"}</button>
                  )}
                </div>
              );
            })}
            {/* Device calendar event overlays */}
            {deviceCalEvents.filter(ev => !ev.isAllDay).map((ev, i) => {
              if (!ev.startDate) return null;
              const d = new Date(ev.startDate);
              const startHour = d.getHours() + d.getMinutes() / 60;
              const durMs = (ev.endDate || ev.startDate + 3600000) - ev.startDate;
              const durHours = Math.max(0.5, durMs / 3600000);
              const box      = slot(startHour, startHour + durHours);
              if (!box) return null;
              const topPx    = box.top;
              const heightPx = Math.max(ROW_H, box.height);
              return (
                <div key={ev.id || i} className="cal-event cal-event-device" style={{ top:topPx, height:heightPx }}>
                  <div>
                    <div className="cal-event-name">{ev.title}</div>
                    <div className="cal-event-meta">
                      {[new Date(ev.startDate).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}), ev.endDate ? new Date(ev.endDate).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}) : ""].filter(Boolean).join(" – ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="cal-sidebar">

          {/* Focus block adder */}
          {powerMode ? (
            <div className="focus-adder">
              <div className="focus-adder-title" style={{display:"flex",alignItems:"center",gap:6}}><Icon name="target" size={14} style={{color:"var(--teal-dark)"}} />Book a focus block</div>
              <div className="focus-time-row">
                <input
                  className="focus-time-input"
                  type="number" min="0" max="23" placeholder="09"
                  value={focusStart}
                  onChange={e => setFocusStart(e.target.value)}
                />
                <select
                  className="focus-duration-select"
                  style={{ width:64, flex:"none" }}
                  value={focusMins}
                  onChange={e => setFocusMins(e.target.value)}
                >
                  <option value="0">:00</option>
                  <option value="30">:30</option>
                </select>
                <span className="focus-time-sep">for</span>
                <select className="focus-duration-select" value={focusDur} onChange={e => setFocusDur(e.target.value)}>
                  <option value="25">25 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <button className="btn-add-focus" onClick={addFocusBlock} style={{ width:"100%" }}>Reserve block</button>
            </div>
          ) : (
            <div className="panel-card" style={{ fontSize:13, color:"var(--ink-mute)", textAlign:"center" }}>
              Enable <strong>Power Mode</strong> in Settings to book protected focus blocks.
            </div>
          )}

          {/* Unscheduled tasks */}
          {unscheduledTasks.length > 0 && (
            <div className="unscheduled-panel">
              <div className="unscheduled-title">Unscheduled tasks</div>
              {unscheduledTasks.map(t => (
                <div key={t.id} className="unsched-item" title="Click Auto-schedule to place these">
                  <div className={`unsched-dot ${t.energy}`} />
                  <span style={{ flex:1 }}>{t.name}</span>
                  <span style={{ fontSize:11, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace" }}>{t.energy}</span>
                </div>
              ))}
            </div>
          )}

          {/* Check-in history */}
          <div className="shutdown-history">
            <div className="shutdown-history-title">Days you checked in</div>
            <div className="checkin-week">
              {weekDays.map((d, i) => {
                const k    = d.toLocaleDateString("en-CA");
                const isTd = k === todayKey();
                const done = shutdownDays.has(k);
                // Days without a check-in stay neutral — no "missed" marks.
                return (
                  <div key={i} className={`checkin-day${isTd ? " today" : ""}`} title={d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}>
                    <span className="checkin-day-letter">{DAY_NAMES[i][0]}</span>
                    <span className={`checkin-day-dot${done ? " done" : ""}`} />
                  </div>
                );
              })}
            </div>
            {(() => {
              const weekCount  = weekDays.filter(d => shutdownDays.has(d.toLocaleDateString("en-CA"))).length;
              const prefix     = new Date().toISOString().slice(0,7);
              const monthCount = [...shutdownDays].filter(d => d.startsWith(prefix)).length;
              return (
                <div className="checkin-week-note">
                  {weekCount > 0 && <>{weekCount} this week{monthCount > weekCount ? ` · ${monthCount} this month` : ""}. </>}
                  Every day you open the app counts.
                </div>
              );
            })()}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── ShutdownView ─────────────────────────────────────────────────────────────
const SD_ML = {
  feeling: ["relieved","tired","proud","grateful","unsettled","foggy","lighter","steady","drained","full"],
  carrying: ["a small win","a lesson","one question","some tension","more than I expected","nothing I need to hold","a moment I'm glad happened","a feeling I can't name yet"],
  arriving: ["fresh eyes","a clearer head","one focus","less pressure","more patience","the same steady energy","a little more grace for myself"],
};

function SwipeTaskCard({ task, onDefer, onSkip }) {
  const [offset, setOffset] = useState(0);
  const [drag, setDrag] = useState(null);
  const [settled, setSettled] = useState(null); // "defer" | "skip" | null

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startX: e.clientX });
  }
  function onPointerMove(e) {
    if (!drag) return;
    setOffset(e.clientX - drag.startX);
  }
  function onPointerUp() {
    if (offset > 60) { setSettled("defer"); setTimeout(() => onDefer(task.id), 300); }
    else if (offset < -60) { setSettled("skip"); setTimeout(() => onSkip(task.id), 300); }
    else { setOffset(0); }
    setDrag(null);
  }

  if (settled) return null;

  return (
    <div className="swipe-task-wrap">
      {offset > 10  && <div className="swipe-task-hint-right"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>Tomorrow</div>}
      {offset < -10 && <div className="swipe-task-hint-left"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Skip</div>}
      <div
        className="swipe-task-card"
        style={{ transform: `translateX(${offset}px)`, transition: drag ? "none" : "transform 0.25s ease" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.name}</span>
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, opacity:0.35, textTransform:"uppercase" }}>{task.bucket}</span>
      </div>
    </div>
  );
}

function ShutdownView({ tasks, onComplete, onCancel, onDeferTask, shutdownDays = new Set() }) {
  const [win,         setWin]         = useState("");
  const [eveningMood, setEveningMood] = useState(null);
  const [deferred,    setDeferred]    = useState(new Set());
  const done    = tasks.filter(t => t.done).length;
  const total   = tasks.length;
  const undone  = tasks.filter(t => !t.done && !deferred.has(t.id));

  function handleDefer(id) {
    setDeferred(prev => new Set([...prev, id]));
    onDeferTask?.(id);
  }
  function handleSkip(id) {
    setDeferred(prev => new Set([...prev, id]));
  }
  function deferAll() {
    undone.forEach(t => handleDefer(t.id));
  }

  return (
    <div className="shutdown-card">
      <div className="shutdown-title">Permission to stop.</div>
      <div className="shutdown-sub">{["You showed up. That's enough.","You did today. That's real.","Whatever today was — you were in it.","You kept going. Now you can stop.","Today counted. So do you."][shutdownDays.size % 5]}</div>
      <div className="shutdown-stats">
        <div className="shutdown-stat"><span className="shutdown-num">{done}</span><span className="shutdown-label">completed</span></div>
        <div className="shutdown-stat"><span className="shutdown-num">{total - done}</span><span className="shutdown-label">can wait</span></div>
        <div className="shutdown-stat"><span className="shutdown-num">1</span><span className="shutdown-label">day shown up</span></div>
      </div>

      {undone.length > 0 && (
        <div className="shutdown-undone">
          <div className="shutdown-undone-label">Undone tasks — swipe → tomorrow, ← skip</div>
          {undone.slice(0, 5).map(t => (
            <SwipeTaskCard key={t.id} task={t} onDefer={handleDefer} onSkip={handleSkip} />
          ))}
          {undone.length > 1 && (
            <button className="shutdown-defer-all" onClick={deferAll}>Move all to tomorrow</button>
          )}
        </div>
      )}

      <div className="shutdown-prompt">
        <div className="shutdown-q">How are you feeling right now?</div>
        <div className="shutdown-mood-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {MOODS.map(m => (
            <button
              key={m.id}
              onClick={() => setEveningMood(m.id)}
              style={{
                background: eveningMood === m.id ? "rgba(138,158,138,0.25)" : "rgba(255,255,255,0.05)",
                border: `1.5px solid ${eveningMood === m.id ? "rgba(138,158,138,0.7)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "var(--radius-sm)", padding:"10px 4px", cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s", textAlign:"center"
              }}
            >
              <Icon name={m.icon} size={16} style={{ color: eveningMood === m.id ? "rgba(196,212,196,0.9)" : "rgba(255,255,255,0.6)", display:"block", margin:"0 auto 4px" }} />
              <div style={{ fontSize:11, color: eveningMood === m.id ? "rgba(196,212,196,0.9)" : "rgba(255,255,255,0.6)", fontFamily:"'DM Mono',monospace", letterSpacing:"0.3px" }}>{m.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="shutdown-prompt">
        <div className="shutdown-q">Anything on your mind?</div>
        <textarea className="shutdown-textarea" placeholder="Brain dump it here — thoughts, worries, wins, whatever needs to leave your head…" rows={5}
          value={win} onChange={e => setWin(e.target.value)} />
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <button className="btn-shutdown" onClick={() => onComplete({ answers:{ notes: win }, eveningMood })} style={{display:"inline-flex",alignItems:"center",gap:8}}>
          <Icon name="leaf" size={16} />I'm done for today.
        </button>
        {onCancel && (
          <button onClick={onCancel} style={{ background:"none", border:"1.5px solid rgba(255,255,255,0.12)", borderRadius:40, padding:"10px 20px", color:"rgba(255,255,255,0.6)", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}>Not now — go back</button>
        )}
      </div>
    </div>
  );
}

// ─── BreathingExercise ────────────────────────────────────────────────────────
function BreathingExercise({ isOpen = true }) {
  const [patternId,   setPatternId]   = useState("box");
  const [active,      setActive]      = useState(false);
  const [phaseIdx,    setPhaseIdx]    = useState(0);
  const [tick,        setTick]        = useState(0);
  const [cycles,      setCycles]      = useState(0);
  const [customDurs,  setCustomDurs]  = useState([4, 4, 4, 4]);

  const base   = BREATHING_PATTERNS.find(p => p.id === patternId);
  const phases = base.phases.map((p, i) => ({ ...p, d: patternId === "custom" ? (customDurs[i] || 4) : p.d }));
  const phase  = phases[phaseIdx];

  useEffect(() => {
    if (!isOpen) { setActive(false); setPhaseIdx(0); setTick(0); setCycles(0); }
  }, [isOpen]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setTick(t => {
        if (t + 1 >= phase.d) {
          setPhaseIdx(idx => {
            const next = (idx + 1) % phases.length;
            if (next === 0) { setCycles(c => c + 1); ding("breath"); }
            return next;
          });
          return 0;
        }
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, phaseIdx, patternId, JSON.stringify(customDurs)]);

  function stop() { setActive(false); setPhaseIdx(0); setTick(0); setCycles(0); }

  const isHold = active && phase.l === "Hold";
  const prevPhaseLabel = phases[(phaseIdx - 1 + phases.length) % phases.length].l;
  const holdAfterInhale = prevPhaseLabel === "Inhale";
  const holdScale = holdAfterInhale ? 1.35 : 0.72;

  const circleRef = useRef(null);
  useLayoutEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    const dur  = active ? `${phase.d}s` : "0.6s";
    const ease = (active && phase.l === "Exhale") ? "cubic-bezier(0.4,0,0.6,1)" : "ease-in-out";
    const scale = isHold ? holdScale : (active ? (phase.l === "Inhale" ? 1.35 : 0.72) : 1.0);
    el.style.setProperty("--breath-dur", dur);
    el.style.setProperty("--breath-ease", ease);
    void el.offsetWidth; // force reflow so new transition duration commits before transform changes
    el.style.transform = `scale(${scale})`;
  }, [active, phaseIdx, patternId, JSON.stringify(customDurs)]);

  return (
    <div className="breathing-wrap">
      <div className="breath-pattern-row">
        {BREATHING_PATTERNS.map(p => (
          <button key={p.id} className={`breath-pattern-btn ${patternId===p.id?"active":""}`}
            onClick={() => { setPatternId(p.id); stop(); }}>{p.name}</button>
        ))}
      </div>

      {!active && (
        <p style={{ fontSize:12, color:"var(--ink-mute)", lineHeight:1.65, marginBottom:16, fontStyle:"italic", padding:"0 2px" }}>
          {base.desc}
        </p>
      )}

      {patternId === "custom" && !active && (
        <div className="breath-custom-row">
          {["Inhale","Hold","Exhale","Hold"].map((label, i) => (
            <div key={i} className="breath-custom-input-wrap">
              <div className="breath-custom-label">{label}</div>
              <input type="number" min={1} max={20} className="breath-custom-input"
                value={customDurs[i]}
                onChange={e => setCustomDurs(d => d.map((v,j) => j===i ? Math.max(1, parseInt(e.target.value)||1) : v))} />
            </div>
          ))}
        </div>
      )}

      <div className="breath-pacer-wrap">
        <div className="breath-ring">
          <div className="breath-circle" ref={circleRef}>
            <div className="breath-phase-label">{active ? phase.l : "Ready"}</div>
            {active && <div className="breath-countdown">{phase.d - tick}</div>}
          </div>
        </div>
      </div>

      {active && (
        <div className="breath-phase-strip">
          {phases.map((p, i) => (
            <div key={i} className={`breath-phase-chip ${i===phaseIdx?"active":""}`}>
              <span>{p.l}</span><span>{p.d}s</span>
            </div>
          ))}
        </div>
      )}

      <div className="breath-controls">
        {!active
          ? <button className="btn-primary" onClick={() => setActive(true)}>Begin</button>
          : <button style={{ background:"none", border:"1.5px solid var(--ink-mute)", color:"var(--ink)", borderRadius:40, padding:"8px 20px", fontSize:12, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", transition:"var(--transition)", letterSpacing:"0.3px" }} onClick={stop}>End session</button>
        }
        {cycles > 0 && <div className="breath-cycles">{cycles} cycle{cycles!==1?"s":""} complete</div>}
      </div>
    </div>
  );
}

// ─── MicroJournal ─────────────────────────────────────────────────────────────
const JOURNAL_PROMPTS = {
  "Right now": [
    "What's taking up the most space in my head right now?",
    "If I could describe my current feeling as a weather forecast, what would it say?",
    "What do I need most in this moment?",
    "Finish this sentence: \"Right now I feel _____ because _____\".",
    "What am I avoiding thinking about?",
    "What would make the next hour feel a little better?",
  ],
  "Today": [
    "What was the hardest moment today, and what got me through it?",
    "What's one thing I did today that I'm proud of, even if it was small?",
    "When did I feel most like myself today?",
    "What drained me most today? What filled me back up?",
    "If today were a chapter title in a book, what would it be called?",
    "What surprised me today — about the world, or about myself?",
  ],
  "Reflection": [
    "What have I been pretending is okay that isn't?",
    "What would I tell a close friend who was going through exactly what I'm going through?",
    "What belief am I holding onto that might not be serving me anymore?",
    "What does \"rest\" actually mean to me right now?",
    "What's something I've been putting off — and what's really behind that?",
    "What is one thing that felt difficult this week that I actually handled?",
  ],
  "Gratitude": [
    "What's one small thing I noticed today that I usually overlook?",
    "What did my body do today that I took for granted?",
    "Who made something easier for me recently, even in a small way?",
    "What's something in my environment right now that I'm grateful for?",
    "What's a version of this current difficulty that I might one day be thankful for?",
    "What's a skill or quality in myself that I don't appreciate often enough?",
  ],
  "Energy": [
    "What activities fill me up vs. drain me lately?",
    "When did I last feel genuinely energized? What was happening?",
    "What would it look like to honor my energy level today, rather than fight it?",
    "What's one thing I could let go of this week to create more space?",
    "If my body could speak right now, what would it say it needs?",
    "What's one small thing I could do tomorrow to start with more energy?",
  ],
};
const PROMPT_CATS = Object.keys(JOURNAL_PROMPTS);

function MicroJournal({ uid, saveJournalEntry, deleteJournalEntry, isPro = false, onOpenPaywall }) {
  const [entries, setEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mindfull-journal") || "[]"); } catch { return []; }
  });
  const [expandedId, setExpandedId] = useState(null);
  const [text, setText] = useState(() => localStorage.getItem("journal-draft") || "");
  const [draftSaved, setDraftSaved] = useState(false);
  const [promptCat, setPromptCat] = useState(PROMPT_CATS[0]);
  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * JOURNAL_PROMPTS[PROMPT_CATS[0]].length));
  const textareaRef = useRef(null);

  function autoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  // Grow on mount if draft loaded
  useEffect(() => { autoGrow(textareaRef.current); }, []);

  // Debounced autosave — 2s after last keystroke
  useEffect(() => {
    if (!text.trim()) { localStorage.removeItem("journal-draft"); setDraftSaved(false); return; }
    const t = setTimeout(() => {
      localStorage.setItem("journal-draft", text);
      setDraftSaved(true);
    }, 2000);
    return () => clearTimeout(t);
  }, [text]);

  function shuffle() {
    const prompts = JOURNAL_PROMPTS[promptCat];
    setPromptIdx(i => {
      let next = Math.floor(Math.random() * (prompts.length - 1));
      if (next >= i) next++;
      return next;
    });
  }

  function switchCat(cat) {
    setPromptCat(cat);
    setPromptIdx(Math.floor(Math.random() * JOURNAL_PROMPTS[cat].length));
  }

  function usePrompt() {
    const p = JOURNAL_PROMPTS[promptCat][promptIdx];
    setText(prev => prev ? prev + "\n\n" + p + "\n" : p + "\n");
  }

  async function addEntry() {
    if (!text.trim()) return;
    const entryData = { text: text.trim(), ts: new Date().toISOString() };
    if (uid && saveJournalEntry) {
      try {
        const ref = await saveJournalEntry(uid, entryData);
        const entry = { id: ref.id, ...entryData };
        setEntries(prev => [entry, ...prev]);
      } catch {
        const entry = { id: Date.now(), ...entryData };
        setEntries(prev => [entry, ...prev]);
      }
    } else {
      const entry = { id: Date.now(), ...entryData };
      const updated = [entry, ...entries];
      setEntries(updated);
      localStorage.setItem("mindfull-journal", JSON.stringify(updated));
    }
    setText("");
    setDraftSaved(false);
    localStorage.removeItem("journal-draft");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
  }

  async function removeEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id));
    if (uid && deleteJournalEntry) {
      try { await deleteJournalEntry(uid, String(id)); } catch {}
    } else {
      const updated = entries.filter(e => e.id !== id);
      localStorage.setItem("mindfull-journal", JSON.stringify(updated));
    }
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    return d.toLocaleDateString([], { month:"short", day:"numeric" }) + " " + d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  }

  const currentPrompt = JOURNAL_PROMPTS[promptCat][promptIdx];

  return (
    <div className="journal-wrap">
      {/* Prompt section */}
      <div className="journal-prompt-section">
        <div className="journal-prompt-label">Need a place to start?</div>
        <div className="journal-prompt-cats">
          {PROMPT_CATS.map(cat => (
            <button key={cat} className={`journal-prompt-cat${promptCat === cat ? " active" : ""}`} onClick={() => switchCat(cat)}>
              {cat}
            </button>
          ))}
        </div>
        <div className="journal-prompt-card">
          <span className="journal-prompt-text">"{currentPrompt}"</span>
          <button aria-label="Show another prompt" className="journal-prompt-shuffle" onClick={shuffle} title="Show another prompt">↺</button>
          <button className="journal-prompt-use" onClick={usePrompt}>Use this →</button>
        </div>
      </div>

      <textarea ref={textareaRef} className="journal-textarea" placeholder="Write as much or as little as you like…"
        value={text}
        onChange={e => { setText(e.target.value); setDraftSaved(false); autoGrow(e.target); }}
        onKeyDown={e => e.key === "Enter" && e.metaKey && addEntry()} />
      <div className="journal-submit-row">
        <span className="journal-draft-badge">
          {draftSaved ? "draft saved" : text.trim() ? "saving…" : "⌘ + Enter to save"}
        </span>
        <button className="btn-primary" style={{ padding:"10px 24px", fontSize:13 }} onClick={addEntry}>Save entry</button>
      </div>
      {entries.length === 0
        ? <div className="journal-empty">No entries yet. Start writing.</div>
        : (() => {
            const FREE_LIMIT = 30;
            const visibleEntries = isPro ? entries : entries.slice(0, FREE_LIMIT);
            const hiddenCount = isPro ? 0 : Math.max(0, entries.length - FREE_LIMIT);
            return (
              <>
                {visibleEntries.map(e => {
                  const isOpen = expandedId === e.id;
                  const preview = e.text.length > 90 ? e.text.slice(0, 90).trimEnd() + "…" : e.text;
                  return (
                    <div key={e.id} className="journal-entry" onClick={() => setExpandedId(isOpen ? null : e.id)} {...asButton(() => setExpandedId(isOpen ? null : e.id), "button", { "aria-expanded": isOpen })}>
                      <div className="journal-entry-header">
                        <div className="journal-entry-preview">{isOpen ? e.text.split("\n")[0] || preview : preview}</div>
                        <div className="journal-entry-meta">
                          <div className="journal-entry-time">{fmtTime(e.ts)}</div>
                          <span className={`journal-entry-chevron${isOpen ? " open" : ""}`}>▼</span>
                        </div>
                      </div>
                      {isOpen && (
                        <>
                          <div className="journal-entry-body">{e.text}</div>
                          <div className="journal-entry-actions">
                            <button
                              onClick={ev => { ev.stopPropagation(); removeEntry(e.id); }}
                              style={{ background:"none", border:"none", color:"var(--ink-mute)", cursor:"pointer", fontSize:12, fontFamily:"'DM Mono',monospace", opacity:0.6 }}
                            >delete entry</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <div className="pro-gate" style={{ margin:"16px 0 0" }}>
                    <div className="pro-gate-icon">✦</div>
                    <div className="pro-gate-feature">Full Journal History</div>
                    <div className="pro-gate-sub">{hiddenCount} older {hiddenCount === 1 ? "entry" : "entries"} — unlock with Pro</div>
                    <button className="pro-gate-btn" onClick={onOpenPaywall}>Unlock — 14 days free</button>
                  </div>
                )}
              </>
            );
          })()
      }
    </div>
  );
}

// ─── MindfulnessView — removed, content merged into GroundingView ─────────────

// ─── Research-backed facts shown on breathing & loading screens ───────────────
const BURNOUT_FACTS = [
  { fact: "Burnout triples the risk of leaving the workforce entirely.", source: "Salvagioni et al., 2017 · PLOS ONE", url: "https://doi.org/10.1371/journal.pone.0185781" },
  { fact: "High burnout is linked to 152% more sick days per year compared to low burnout.", source: "Salvagioni et al., 2017 · PLOS ONE", url: "https://doi.org/10.1371/journal.pone.0185781" },
  { fact: "Burnout raises the risk of heart disease by up to 2.3×, and type 2 diabetes by 84%.", source: "Salvagioni et al., 2017 · PLOS ONE", url: "https://doi.org/10.1371/journal.pone.0185781" },
  { fact: "Chronic stress keeps cortisol elevated, suppressing immune function and fuelling low-grade inflammation.", source: "Yaribeygi et al., 2017 · EXCLI Journal", url: "https://doi.org/10.17179/excli2017-480" },
  { fact: "Perceived control transforms the impact of stress — the same pressure that overwhelms one person strengthens another depending on how much agency they feel.", source: "Yaribeygi et al., 2017 · EXCLI Journal", url: "https://doi.org/10.17179/excli2017-480" },
  { fact: "Burnout and poor sleep feed each other: exhaustion disrupts sleep, and poor sleep deepens exhaustion.", source: "Magnus Glise et al., 2022" },
  { fact: "Mindfulness strengthens the prefrontal cortex and reduces amygdala reactivity — measurable brain changes from slowing down.", source: "Magnus Glise et al., 2022" },
  { fact: "Emotional exhaustion is the strongest predictor of workplace depression — checking in with yourself daily interrupts the cycle.", source: "Salvagioni et al., 2017 · PLOS ONE", url: "https://doi.org/10.1371/journal.pone.0185781" },
  { fact: "Slow, controlled breathing raises heart rate variability (HRV) — a direct measure of your nervous system's capacity to recover from stress.", source: "Zaccaro et al., 2018 · Frontiers in Human Neuroscience", url: "https://doi.org/10.3389/fnhum.2018.00353" },
  { fact: "Burnout causes structural changes in the brain, reducing gray matter in areas that govern focus and decision-making.", source: "Magnus Glise et al., 2022" },
  { fact: "Across 142 clinical trials, mindfulness-based interventions consistently reduced anxiety, depression, and chronic pain — with effects lasting up to six months.", source: "Goldberg et al., 2018 · Perspectives on Psychological Science", url: "https://doi.org/10.1177/1745691618808177" },
  { fact: "Stress alters gut bacteria composition, influencing both mood and digestion through the brain-gut connection.", source: "APA — Stress & Your Body", url: "https://www.apa.org/topics/stress" },
  { fact: "Chronic stress impairs communication between your immune and endocrine systems, fuelling fatigue, metabolic disorders, and depression.", source: "APA — Stress & Your Body", url: "https://www.apa.org/topics/stress" },
  { fact: "Prolonged stress causes continuous nervous system activation, creating wear-and-tear that cascades across every body system.", source: "APA — Stress & Your Body", url: "https://www.apa.org/topics/stress" },
  { fact: "Chronic stress raises blood pressure and sustains elevated heart rate, significantly increasing the risk of heart attack and stroke.", source: "APA — Stress & Your Body", url: "https://www.apa.org/topics/stress" },
  { fact: "Chronic stress keeps muscles in constant tension — a direct path to tension headaches, migraines, and persistent back pain.", source: "APA — Stress & Your Body", url: "https://www.apa.org/topics/stress" },
  { fact: "Stress-triggered cortisol surges impair memory consolidation — one reason it becomes hard to think clearly when you're overwhelmed.", source: "Yaribeygi et al., 2017 · EXCLI Journal", url: "https://doi.org/10.17179/excli2017-480" },
];

// ─── BreathingGate ────────────────────────────────────────────────────────────
function BreathingGate({ onComplete }) {
  const [active,   setActive]   = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [tick,     setTick]     = useState(0);
  const [cycles,   setCycles]   = useState(0);
  const [factIdx,  setFactIdx]  = useState(() => Math.floor(Math.random() * BURNOUT_FACTS.length));

  useEffect(() => {
    const id = setInterval(() => setFactIdx(i => (i + 1) % BURNOUT_FACTS.length), 10000);
    return () => clearInterval(id);
  }, []);

  const phases = [
    { l:"Inhale", d:4 }, { l:"Hold", d:4 }, { l:"Exhale", d:4 },
  ];
  const phase = phases[phaseIdx];
  const canContinue = cycles >= 1;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setTick(t => {
        if (t + 1 >= phase.d) {
          setPhaseIdx(idx => {
            const next = (idx + 1) % phases.length;
            if (next === 0) { setCycles(c => c + 1); ding("breath"); }
            return next;
          });
          return 0;
        }
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, phaseIdx]);

  const isGateHold = active && phase.l === "Hold";

  const gateCircleRef = useRef(null);
  useLayoutEffect(() => {
    const el = gateCircleRef.current;
    if (!el) return;
    const dur   = active ? `${phase.d}s` : "0.6s";
    const ease  = (active && phase.l === "Exhale") ? "cubic-bezier(0.4,0,0.6,1)" : "ease-in-out";
    const scale = isGateHold ? 1.35 : (active ? (phase.l === "Inhale" ? 1.35 : 0.72) : 1.0);
    el.style.setProperty("--gate-dur", dur);
    el.style.setProperty("--gate-ease", ease);
    void el.offsetWidth; // force reflow so new transition duration commits before transform changes
    el.style.transform = `scale(${scale})`;
  }, [active, phaseIdx]);

  return (
    <div className="breath-gate">
      <div className="breath-gate-eyebrow">before you begin</div>
      <div className="breath-gate-title">Take a breath.</div>

      <div className="breath-gate-ring">
        <div className="breath-gate-circle" ref={gateCircleRef}>
          <div className="breath-gate-label">{active ? phase.l : "Ready"}</div>
          {active && <div className="breath-gate-count">{phase.d - tick}</div>}
        </div>
      </div>

      <div className="breath-gate-cycles">
        {cycles === 0 ? "complete 1 cycle to continue" : `${cycles} cycle${cycles!==1?"s":""} complete`}
      </div>

      {!active && !canContinue && (
        <button className="breath-gate-begin" onClick={() => setActive(true)}>Begin</button>
      )}
      {active && !canContinue && (
        <button className="breath-gate-begin" onClick={() => { setActive(false); setPhaseIdx(0); setTick(0); }}>
          Pause
        </button>
      )}
      {canContinue && (
        <>
          <button className="breath-gate-continue" onClick={onComplete}>I'm ready. Take me in →</button>
          <div className="breath-gate-affirm">You showed up. That's already something.</div>
        </>
      )}
      {!canContinue && (
        <button className="breath-gate-skip" onClick={onComplete}>Take me straight in</button>
      )}
    </div>
  );
}

// ─── GroundingView ────────────────────────────────────────────────────────────
// ─── MentalHealthScreening ────────────────────────────────────────────────────
const SCREENING_OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

const SCREENS = {
  phq9: {
    id: "phq9",
    name: "PHQ-9",
    about: "Depression",
    icon: "cloud",
    timeframe: "Over the last 2 weeks, how often have you been bothered by any of the following?",
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself — or that you've let yourself or others down",
      "Trouble concentrating on things",
      "Moving or speaking unusually slowly, or feeling unusually fidgety or restless",
      "Thoughts that you would be better off dead, or of hurting yourself",
    ],
    sensitiveIdx: 8,
    max: 27,
    thresholds: [
      { min:0,  max:4,  label:"Minimal",             color:"var(--teal-dark)",  desc:"Your responses suggest minimal depression symptoms. Keep checking in with yourself." },
      { min:5,  max:9,  label:"Mild",                color:"var(--slate-dark)", desc:"Your responses suggest mild depressive symptoms. Notice any patterns, and be gentle with yourself." },
      { min:10, max:14, label:"Moderate",             color:"#c47a5a",           desc:"Your responses suggest moderate depression symptoms. Speaking with a mental health professional could help.", pro:true },
      { min:15, max:19, label:"Moderately Severe",    color:"var(--error)",      desc:"Your responses suggest moderately severe depression. We encourage you to reach out to a mental health professional.", pro:true, crisis:true },
      { min:20, max:27, label:"Severe",               color:"var(--error)",      desc:"Your responses suggest severe depression. Please reach out to a professional or crisis support as soon as you can.", pro:true, crisis:true },
    ],
  },
  gad7: {
    id: "gad7",
    name: "GAD-7",
    about: "Anxiety",
    icon: "wind",
    timeframe: "Over the last 2 weeks, how often have you been bothered by the following?",
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless that it's hard to sit still",
      "Becoming easily annoyed or irritable",
      "Feeling afraid, as if something awful might happen",
    ],
    max: 21,
    thresholds: [
      { min:0,  max:4,  label:"Minimal",  color:"var(--teal-dark)",  desc:"Your responses suggest minimal anxiety symptoms. You're doing okay — keep checking in." },
      { min:5,  max:9,  label:"Mild",     color:"var(--slate-dark)", desc:"Your responses suggest mild anxiety symptoms. Grounding and breathing exercises can help." },
      { min:10, max:14, label:"Moderate", color:"#c47a5a",           desc:"Your responses suggest moderate anxiety. A conversation with a mental health professional could be valuable.", pro:true },
      { min:15, max:21, label:"Severe",   color:"var(--error)",      desc:"Your responses suggest severe anxiety. Please consider reaching out to a mental health professional.", pro:true, crisis:true },
    ],
  },
};

function MentalHealthScreening() {
  const [screen,       setScreen]       = useState("phq9");
  const [answers,      setAnswers]      = useState({});
  const [result,       setResult]       = useState(null);
  const [gateAcked,    setGateAcked]    = useState(() => localStorage.getItem("reflow-screening-ack") === "true");
  const [gateChecked,  setGateChecked]  = useState(false);

  // ── Acknowledgment gate ────────────────────────────────────────────────────
  if (!gateAcked) {
    return (
      <div className="screening-wrap">
        <div style={{ background:"rgba(106,138,170,0.08)", border:"1.5px solid rgba(106,138,170,0.25)", borderRadius:"var(--radius-sm)", padding:"20px 20px 16px", marginBottom:20 }}>
          <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--focus-blue)", marginBottom:10 }}>Before you continue</div>
          <div style={{ fontSize:14, color:"var(--ink)", lineHeight:1.65, marginBottom:16 }}>
            The PHQ-9 and GAD-7 are <strong>self-administered educational questionnaires</strong>, not clinical assessments. They are not a substitute for professional evaluation and do not constitute a diagnosis.
          </div>
          <ul style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.7, paddingLeft:18, marginBottom:16 }}>
            <li>Results are for personal awareness only.</li>
            <li>If you are in distress, please reach out to a professional or call/text <strong>988</strong>.</li>
            <li>Your responses are encrypted and never shared.</li>
          </ul>
          <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", marginBottom:20 }}>
            <input
              type="checkbox"
              checked={gateChecked}
              onChange={e => setGateChecked(e.target.checked)}
              style={{ marginTop:3, accentColor:"var(--teal-dark)", width:16, height:16, flexShrink:0, cursor:"pointer" }}
            />
            <span style={{ fontSize:13, color:"var(--ink)", lineHeight:1.5 }}>
              I understand this is an educational self-screening tool, not a clinical diagnosis, and I am not currently in crisis.
            </span>
          </label>
          <button
            className="btn-primary"
            style={{ width:"100%" }}
            disabled={!gateChecked}
            onClick={() => { localStorage.setItem("reflow-screening-ack","true"); setGateAcked(true); }}
          >
            Continue to screening →
          </button>
        </div>
      </div>
    );
  }

  const current = SCREENS[screen];
  const total   = current.questions.length;
  const answered = Object.keys(answers).filter(k => k.startsWith(screen)).length;
  const allDone  = answered === total;

  function setAnswer(qIdx, val) {
    setAnswers(prev => ({ ...prev, [`${screen}-${qIdx}`]: val }));
  }

  function getAnswer(qIdx) {
    return answers[`${screen}-${qIdx}`];
  }

  function submit() {
    const score = current.questions.reduce((sum, _, i) => sum + (getAnswer(i) ?? 0), 0);
    const tier  = current.thresholds.find(t => score >= t.min && score <= t.max);
    const sensitiveTriggered = current.sensitiveIdx !== undefined && (getAnswer(current.sensitiveIdx) ?? 0) > 0;
    setResult({ score, tier, sensitiveTriggered });
  }

  function retake() {
    setAnswers(prev => {
      const next = { ...prev };
      current.questions.forEach((_, i) => delete next[`${screen}-${i}`]);
      return next;
    });
    setResult(null);
  }

  function switchScreen(id) {
    setScreen(id);
    setResult(null);
  }

  return (
    <div className="screening-wrap">
      <div className="screening-disclaimer">
        <strong>This is a self-screening tool, not a clinical diagnosis.</strong> It's designed to help you understand your mental health patterns and decide if professional support might be right for you. Your answers are private and never shared.
      </div>

      {/* Type selector */}
      <div className="screening-type-row">
        {Object.values(SCREENS).map(s => (
          <button key={s.id} className={`screening-type-btn${screen===s.id?" active":""}`} onClick={() => switchScreen(s.id)}>
            <div style={{ marginBottom:4 }}><Icon name={s.icon} size={20} style={{color:"var(--teal-dark)"}} /></div>
            <div>{s.name}</div>
            <div className="screening-type-label">{s.about}</div>
          </button>
        ))}
      </div>

      {result ? (
        /* ── Results ── */
        <div className="screening-result">
          <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:12 }}>
            {current.name} · {current.about} Screening
          </div>
          <div className="screening-score-row">
            <div className="screening-score-num" style={{ color: result.tier.color }}>{result.score}</div>
            <div className="screening-score-max">/ {current.max}</div>
          </div>
          <div className="screening-severity" style={{ color: result.tier.color }}>{result.tier.label}</div>
          <div className="screening-desc">{result.tier.desc}</div>

          {(result.tier.pro || result.sensitiveTriggered) && (
            <div className="screening-pro-rec">
              <div className="screening-pro-rec-title" style={{display:"flex",alignItems:"center",gap:7}}><Icon name="message-circle" size={15} style={{color:"var(--focus-blue)",flexShrink:0}} />Consider speaking with a professional</div>
              <div className="screening-pro-rec-body">
                A therapist, counselor, or your primary care doctor can help you understand these results and build a support plan. You don't need to be in crisis to ask for help — reaching out early makes a real difference.
              </div>
            </div>
          )}

          {(result.tier.crisis || result.sensitiveTriggered) && (
            <div className="screening-crisis-rec">
              <div className="screening-crisis-title" style={{display:"flex",alignItems:"center",gap:7}}><Icon name="alert-circle" size={15} style={{color:"var(--error)",flexShrink:0}} />If you need support right now</div>
              <div className="screening-crisis-body">
                {/* US lines sourced from CRISIS_LINES — edit contact info there, not here */}
                <strong>{CRISIS_LINES[0].name}</strong> — <a href={CRISIS_LINES[0].call}>{CRISIS_LINES[0].action}</a> or text 988 (US)<br />
                <strong>{CRISIS_LINES[1].name}</strong> — <a href={CRISIS_LINES[1].text}>{CRISIS_LINES[1].action}</a> to 741741<br />
                <strong>International Association for Suicide Prevention</strong> — <a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank" rel="noopener noreferrer">find a crisis centre</a><br /><br />
                You don't have to carry this alone. Help is available right now.
              </div>
            </div>
          )}

          <button className="screening-retake" onClick={retake}>↺ Retake screening</button>
        </div>
      ) : (
        /* ── Questions ── */
        <>
          <div className="screening-timeframe">{current.timeframe}</div>
          {current.questions.map((q, i) => {
            const isSensitive = current.sensitiveIdx === i;
            return (
              <div key={i} className="screening-q">
                <div className="screening-q-num">Q{i + 1} of {total}{isSensitive ? " · sensitive" : ""}</div>
                <div className="screening-q-text">{q}</div>
                <div className="screening-options">
                  {SCREENING_OPTIONS.map((opt, val) => {
                    const selected = getAnswer(i) === val;
                    return (
                      <button
                        key={val}
                        className={`screening-opt${selected ? " selected" : ""}${selected && isSensitive && val > 0 ? " alert" : ""}`}
                        onClick={() => setAnswer(i, val)}
                      >{opt}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <button className="screening-submit" disabled={!allDone} onClick={submit}>
            {allDone ? "See my results →" : `${answered} of ${total} answered`}
          </button>
        </>
      )}
    </div>
  );
}

const COLD_PHASES = [
  { label:"Splash your face with cold water",  secs:8,  color:"#6a8aaa" },
  { label:"Hold wrists under the cold tap",    secs:12, color:"#5a8a9a" },
  { label:"Pat dry. Take a slow breath out.",  secs:10, color:"#5a7a5a" },
];
const COLD_TOTAL = COLD_PHASES.reduce((s, p) => s + p.secs, 0);

function ColdWaterTimer({ onComplete, done }) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secsLeft, setSecsLeft] = useState(null);
  const [finished, setFinished] = useState(false);

  const phase  = COLD_PHASES[phaseIdx];
  const R      = 17, CIRC = 2 * Math.PI * R;
  const pct    = secsLeft !== null ? secsLeft / phase.secs : 1;
  const running = secsLeft !== null && !finished;

  useEffect(() => {
    if (!running) return;
    if (secsLeft <= 0) {
      const next = phaseIdx + 1;
      if (next < COLD_PHASES.length) {
        setPhaseIdx(next);
        setSecsLeft(COLD_PHASES[next].secs);
      } else {
        setSecsLeft(null);
        setFinished(true);
        onComplete?.();
      }
      return;
    }
    const id = setTimeout(() => setSecsLeft(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [running, secsLeft, phaseIdx]);

  function start()  { setPhaseIdx(0); setSecsLeft(COLD_PHASES[0].secs); setFinished(false); }
  function cancel() { setPhaseIdx(0); setSecsLeft(null); }

  const complete = done || finished;

  if (running) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:4 }}>
        <svg width="44" height="44" style={{ flexShrink:0 }}>
          <circle cx="22" cy="22" r={R} fill="none" stroke="var(--line)" strokeWidth="2" />
          <circle cx="22" cy="22" r={R} fill="none" stroke="var(--teal-dark)" strokeWidth="2"
            strokeDasharray={CIRC.toFixed(1)}
            strokeDashoffset={(CIRC * (1 - pct)).toFixed(1)}
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
            style={{ transition:"stroke-dashoffset 1s linear" }}
          />
          <text x="22" y="27" textAnchor="middle" style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fill:"var(--ink)" }}>
            {Math.max(0, secsLeft)}
          </text>
        </svg>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, color:"var(--ink)" }}>{phase.label}</div>
          <div style={{ fontSize:13, color:"var(--ink-mute)", marginTop:2 }}>Step {phaseIdx + 1} of {COLD_PHASES.length}</div>
        </div>
        <button onClick={cancel} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"var(--ink-mute)" }}>Cancel</button>
      </div>
    );
  }

  return (
    <>
      <p className="ground-tip">
        {complete
          ? "Cold thermoreceptors interrupted the anxiety loop and triggered your dive reflex — slowing your heart rate within seconds."
          : `Splash cold water on your face and wrists. The temperature shift signals safety to your nervous system. ${COLD_TOTAL} seconds total.`}
      </p>
      {complete ? (
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:14, color:"var(--teal-dark)" }}>
          <Icon name="check-circle" size={14} />Completed
        </div>
      ) : (
        <button className="ground-complete-btn" style={{ background:"var(--teal-dark)", color:"white" }} onClick={start}>
          Start ({COLD_TOTAL}s)
        </button>
      )}
    </>
  );
}

function GroundingCard({ id, icon, iconBg, title, meta, btnColor, children, noComplete, completeLabel = "Mark complete", open, onToggle, done, onMarkDone }) {
  return (
    <div className={`ground-card ${open===id?"open":""}`} onClick={() => onToggle(id)} {...asButton(() => onToggle(id), "button", { "aria-expanded": open===id })}>
      <div className="ground-card-header">
        <div className="ground-card-left">
          <div className="ground-card-icon"><Icon name={icon} size={20} /></div>
          <div>
            <div className="ground-card-title" style={ done.has(id) ? { textDecoration:"line-through", color:"var(--ink-mute)" } : {} }>{title}</div>
            <div className="ground-card-meta">{meta}{done.has(id) ? <span style={{display:"inline-flex",alignItems:"center",gap:3,marginLeft:4}}> · <Icon name="check-circle" size={11} style={{color:"var(--teal-dark)"}} />done</span> : ""}</div>
          </div>
        </div>
        <Icon name="chevron" size={18} className="ground-card-chevron" />
      </div>
      <div className="ground-card-body">
        <div className="ground-card-inner" onClick={e => e.stopPropagation()}>
          {children}
          {!noComplete && (
            <button
              className="ground-complete-btn"
              style={{ background: done.has(id) ? "var(--warm)" : btnColor, color: done.has(id) ? "var(--ink-mute)" : "white" }}
              disabled={done.has(id)}
              onClick={() => onMarkDone(id)}
            >
              {done.has(id) ? <span style={{display:"inline-flex",alignItems:"center",gap:5}}><Icon name="check-circle" size={13} />Completed</span> : completeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GroundingView({ uid, saveJournalEntry, deleteJournalEntry, isPro = false, onOpenPaywall, onJumpstart }) {
  const [subtab,       setSubtab]       = useState("ground");
  const [lastWeekEntry] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    try {
      const saved = JSON.parse(localStorage.getItem("mindfull-journal") ?? "[]");
      return saved.find(e => {
        const ed = new Date(e.ts ?? e.createdAt ?? 0);
        return `${ed.getFullYear()}-${ed.getMonth()}-${ed.getDate()}` === k;
      }) ?? null;
    } catch { return null; }
  });
  const [open,         setOpen]         = useState(null);
  const [done,         setDone]         = useState(new Set());
  const [factIdx,      setFactIdx]      = useState(() => Math.floor(Math.random() * BURNOUT_FACTS.length));
  const [showIntro,    setShowIntro]    = useState(() => localStorage.getItem("reflow-wellness-seen") !== "true");

  // Mark seen on first show, not on unmount — the app can be killed while this tab is open
  useEffect(() => { localStorage.setItem("reflow-wellness-seen", "true"); }, []);

  function dismissIntro() {
    localStorage.setItem("reflow-wellness-seen", "true");
    setShowIntro(false);
  }

  function toggle(id) { setOpen(o => o === id ? null : id); }
  function markDone(id) { setDone(d => new Set([...d, id])); }


  return (
    <div className="grounding-page">
      <div style={{ marginBottom:20 }}>
        <div className="readiness-eyebrow">Wellness Hub</div>
        <div className="greeting">Come <span>back to now.</span></div>
      </div>

      {showIntro && (
        <div className="wellness-intro-banner">
          <div className="wellness-intro-title">Your personal wellness space.</div>
          <div className="wellness-intro-sub">
            The Wellness Hub is a quiet corner of the app built around one idea: when you feel better, you do better. It's not a productivity tool — it's the foundation underneath one.
          </div>
          <div className="wellness-intro-features">
            {[
              { icon:"leaf",   name:"Grounding",  desc:"Sensory exercises to bring you back when anxiety spikes." },
              { icon:"wind",   name:"Breathing",  desc:"Guided breathwork proven to calm your nervous system in minutes." },
              { icon:"pen",    name:"Journal",    desc:"Micro-prompts for offloading what's stuck in your head." },
              { icon:"bolt",   name:"Jumpstart",  desc:"Six tiny steps for when you're physically stuck and can't get going." },
            ].map(f => (
              <div key={f.name} className="wellness-intro-feature">
                <Icon name={f.icon} size={15} style={{ color:"var(--teal-dark)", flexShrink:0, marginTop:2 }} />
                <div className="wellness-intro-feature-text">
                  <span className="wellness-intro-feature-name">{f.name}</span>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
          <button className="wellness-intro-dismiss" onClick={dismissIntro}>Got it — let's explore</button>
        </div>
      )}

      <div className="mind-sub-tabs mind-sub-tabs--split">
        <button className={`mind-tab ${subtab==="ground"?"active":""}`}      onClick={() => setSubtab("ground")}><Icon name="leaf" size={13} style={{marginRight:5}} />Grounding</button>
        <button className={`mind-tab ${subtab==="journal"?"active":""}`}     onClick={() => setSubtab("journal")}><Icon name="pen" size={13} style={{marginRight:5}} />Journal</button>
      </div>

      {subtab === "journal"    && <>
        {lastWeekEntry?.text && (
          <div className="panel-card" style={{ background:"rgba(138,158,138,0.07)", border:"1px solid rgba(138,158,138,0.2)", marginBottom:16 }}>
            <div className="panel-title" style={{ marginBottom:6, display:"flex", alignItems:"center", gap:6 }}><Icon name="book-open" size={14} style={{color:"var(--teal-dark)"}} />This time last week</div>
            <div style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.6, fontStyle:"italic" }}>"{lastWeekEntry.text}"</div>
          </div>
        )}
        <MicroJournal uid={uid} saveJournalEntry={saveJournalEntry} deleteJournalEntry={deleteJournalEntry} isPro={isPro} onOpenPaywall={onOpenPaywall} />
      </>}
      {subtab === "ground" && <>

      {/* Shortest to longest */}
      <GroundingCard id="coldwater" icon="droplet" title="Cold Water Reset" meta={`Quick reset · ${COLD_TOTAL} sec`} noComplete open={open} onToggle={toggle} done={done} onMarkDone={markDone}>
        <ColdWaterTimer onComplete={() => markDone("coldwater")} done={done.has("coldwater")} />
      </GroundingCard>

      <GroundingCard id="namestate" icon="leaf" title="Name Your State" meta="Quick reset · 1 min" btnColor="var(--teal-dark)" completeLabel="I named it" open={open} onToggle={toggle} done={done} onMarkDone={markDone}>
        <p className="ground-tip">Say aloud: "I notice I'm feeling ___." Labeling an emotion activates the prefrontal cortex and reduces its intensity. You don't have to fix it — just name it.</p>
      </GroundingCard>

      {onJumpstart && (
        <GroundingCard id="jumpstart" icon="bolt" title="Jumpstart" meta="Six tiny steps · 2 min" btnColor="var(--teal-dark)" completeLabel="Start Jumpstart" open={open} onToggle={toggle} done={done} onMarkDone={() => onJumpstart()}>
          <p className="ground-tip">For when you're physically stuck and can't get going. Six tiny steps, each one a few seconds. No pressure to finish them all.</p>
        </GroundingCard>
      )}

      <GroundingCard id="breathing" icon="wind" iconBg="rgba(90,122,90,0.1)" title="Box Breathing" meta="Breathwork · 2–5 min" noComplete open={open} onToggle={toggle} done={done} onMarkDone={markDone}>
        <BreathingExercise isOpen={open === "breathing"} />
      </GroundingCard>

      <GroundingCard id="54321" icon="eye" iconBg="rgba(90,122,90,0.1)" title="5-4-3-2-1 Grounding" meta="Sensory awareness · 3–5 min" btnColor="var(--teal-dark)" open={open} onToggle={toggle} done={done} onMarkDone={markDone}>
        {[
          { n:5, color:"#5a7a5a", sense:"see",   desc:"Look around slowly. Notice shapes, colors, textures, shadows." },
          { n:4, color:"#6a8a6a", sense:"touch",  desc:"Feel the temperature, weight, and texture of what's near you." },
          { n:3, color:"#7a9a7a", sense:"hear",   desc:"Listen past the obvious. Background sounds count." },
          { n:2, color:"#8a8a6a", sense:"smell",  desc:"Even subtle scents — paper, air, fabric, the room." },
          { n:1, color:"#9a7a5a", sense:"taste",  desc:"Notice what lingers. Take a sip of water if you have one." },
        ].map(({ n, color, sense, desc }) => (
          <div key={n} className="ground-step">
            <div className="ground-step-num">{n}</div>
            <div className="ground-step-text">
              <strong>Name {n} thing{n === 1 ? "" : "s"} you can <em>{sense}</em></strong>
              <span>{desc}</span>
            </div>
          </div>
        ))}
      </GroundingCard>

      <GroundingCard id="bodyscan" icon="activity" iconBg="rgba(196,168,130,0.15)" title="Body Scan" meta="Physical awareness · 5–10 min" btnColor="var(--slate-dark)" open={open} onToggle={toggle} done={done} onMarkDone={markDone}>
        <p className="ground-tip">There's nothing to fix here. Just notice what's present, with kindness.</p>
        {[
          "Scalp, forehead, eyes. Let the muscles around your eyes soften.",
          "Unclench your jaw. Let your tongue rest. Relax your throat.",
          "Roll your shoulders back and down. Soften your chest.",
          "Relax your belly. Let each exhale release a little more tension.",
          "Feel both feet on the floor. Notice the solid ground beneath you.",
        ].map((text, i) => (
          <div key={i} className="ground-step">
            <div className="ground-step-num">↓</div>
            <div className="ground-step-text"><span style={{ fontSize:14, color:"var(--ink)" }}>{text}</span></div>
          </div>
        ))}
      </GroundingCard>

      <div className="wellness-fact-card">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <div className="wellness-fact-eyebrow" style={{ marginBottom:0 }}>Did you know?</div>
          <div style={{ display:"flex", gap:2 }}>
            <button className="tap-slop" aria-label="Previous fact" onClick={e => { e.stopPropagation(); setFactIdx(i => (i - 1 + BURNOUT_FACTS.length) % BURNOUT_FACTS.length); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-mute)", padding:"4px 6px", display:"flex" }}><Icon name="chevron" size={16} style={{ transform:"rotate(90deg)" }} /></button>
            <button className="tap-slop" aria-label="Next fact" onClick={e => { e.stopPropagation(); setFactIdx(i => (i + 1) % BURNOUT_FACTS.length); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-mute)", padding:"4px 6px", display:"flex" }}><Icon name="chevron" size={16} style={{ transform:"rotate(-90deg)" }} /></button>
          </div>
        </div>
        <div className="wellness-fact-text">"{BURNOUT_FACTS[factIdx].fact}"</div>
        <div className="wellness-fact-source">
          {BURNOUT_FACTS[factIdx].url
            ? <a href={BURNOUT_FACTS[factIdx].url} target="_blank" rel="noopener noreferrer"
                 style={{ color:"inherit", textDecoration:"underline", textUnderlineOffset:2 }}
                 onClick={e => e.stopPropagation()}>
                — {BURNOUT_FACTS[factIdx].source} ↗
              </a>
            : `— ${BURNOUT_FACTS[factIdx].source}`
          }
        </div>
      </div>
      </>}
    </div>
  );
}

// ─── FeedbackView ─────────────────────────────────────────────────────────────
function compressFeedbackImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width: w, height: h } = img;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function FeedbackView({ onToast, saveFeedback, uid }) {
  const [type,         setType]         = useState("bug");
  const [message,      setMessage]      = useState("");
  const [email,        setEmail]        = useState("");
  const [sent,         setSent]         = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const imgInputRef = useRef(null);

  const TYPES = [
    { id:"bug",        label:"Bug" },
    { id:"complaint",  label:"Complaint" },
    { id:"suggestion", label:"Suggestion" },
    { id:"praise",     label:"Praise" },
  ];

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressFeedbackImage(file);
    setImageDataUrl(dataUrl);
  }

  async function submit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    const entry = { type, message: message.trim(), email: email.trim(), uid: uid || null, ts: new Date().toISOString(), ...(imageDataUrl ? { imageDataUrl } : {}) };
    try {
      const existing = JSON.parse(localStorage.getItem("reflow-feedback") || "[]");
      localStorage.setItem("reflow-feedback", JSON.stringify([entry, ...existing]));
    } catch {}
    if (saveFeedback) saveFeedback(entry).catch(() => {});
    setSent(true);
    onToast({ type:"win", title:"Received.", msg:"Thank you — your feedback has been noted." });
  }

  if (sent) {
    return (
      <div className="feedback-page">
        <div style={{ marginBottom:24 }}>
          <div className="readiness-eyebrow">Feedback</div>
          <div className="greeting">Thanks for <span>sharing.</span></div>
        </div>
        <div className="feedback-card">
          <div className="feedback-success">
            <div style={{ marginBottom:12 }}><Icon name="leaf" size={28} style={{color:"var(--teal-dark)"}} /></div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, marginBottom:8 }}>Feedback received.</div>
            <div style={{ fontSize:13, color:"var(--ink-mute)" }}>Your {type} has been logged. We read everything — thank you for helping make MyBattery better.</div>
            <button className="btn-primary" style={{ marginTop:20 }} onClick={() => { setSent(false); setMessage(""); setEmail(""); }}>
              Submit another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <div style={{ marginBottom:24 }}>
        <div className="readiness-eyebrow">Feedback</div>
        <div className="greeting">Tell us <span>anything.</span></div>
        <div style={{ fontSize:14, color:"var(--ink-mute)", marginTop:6 }}>Bugs, complaints, ideas, praise — it all helps.</div>
      </div>
      <div className="feedback-card">
        <form onSubmit={submit}>
          <div className="feedback-field">
            <span className="feedback-label" id="fb-type-label">Type</span>
            <div className="feedback-type-row" role="group" aria-labelledby="fb-type-label">
              {TYPES.map(t => (
                <button key={t.id} type="button" className={`feedback-type-btn ${type===t.id?"active":""}`}
                  onClick={() => setType(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="feedback-field">
            <label className="feedback-label" htmlFor="fb-message">Message <span style={{ color:"var(--error)" }}>*</span></label>
            <textarea id="fb-message" className="feedback-textarea"
              placeholder={type==="bug" ? "Describe what happened and what you expected…" : type==="complaint" ? "What frustrated you?" : type==="suggestion" ? "What would make MyBattery better?" : "What made your day?"}
              value={message} onChange={e => setMessage(e.target.value)} required />
          </div>
          <div className="feedback-field">
            <label className="feedback-label" htmlFor="fb-email">Email <span style={{ color:"var(--ink-mute)", fontWeight:400 }}>(optional — only if you want a reply)</span></label>
            <input id="fb-email" className="feedback-input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="feedback-field">
            <span className="feedback-label">Screenshot <span style={{ color:"var(--ink-mute)", fontWeight:400 }}>(optional)</span></span>
            {imageDataUrl ? (
              <div className="feedback-img-preview">
                <img src={imageDataUrl} alt="Attached screenshot" />
                <button aria-label="Remove image" type="button" className="feedback-img-remove" onClick={() => { setImageDataUrl(null); if (imgInputRef.current) imgInputRef.current.value = ""; }}>✕</button>
              </div>
            ) : (
              <div className="feedback-img-upload" onClick={() => imgInputRef.current?.click()} {...asButton(() => imgInputRef.current?.click())}>
                <Icon name="camera" size={16} style={{ color:"var(--ink-mute)", flexShrink:0 }} />
                <span className="feedback-img-label">Attach a screenshot or image</span>
                <input ref={imgInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImageChange} />
              </div>
            )}
          </div>
          <button className="btn-primary" type="submit" style={{ width:"100%" }} disabled={!message.trim()}>
            Submit feedback
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── NotificationService (inlined) ────────────────────────────────────────────
// Battery tiers: high ≥70%, medium 40–69%, low <40%
const NOTIF_TEMPLATES = {
  morning: {
    high: [
      "Good morning! Your battery is at {battery}%. How would you like to use your spark today?",
      "You're starting strong at {battery}%. The day is yours — what feels right first?",
      "Morning. {battery}% and ready. No rush — what's the one thing that would make today feel good?",
      "A full tank at {battery}%. Whatever you put your energy toward today, you've got what it takes.",
    ],
    medium: [
      "Good morning. You're at {battery}% — a steady place to begin. Take it one step at a time.",
      "Morning check-in: {battery}%. Enough to work with. What's the one thing that matters most today?",
      "You're at {battery}%. A gentle start is still a start. When you're ready, your day is here.",
      "Morning. {battery}% is a solid foundation. Start wherever feels natural.",
    ],
    low: [
      "Good morning. You're at {battery}% — and that's okay. Rest is part of the plan too.",
      "Morning. {battery}% in the tank. Be kind to yourself today — you don't have to do everything.",
      "You're starting at {battery}%. Today might be a slow day, and that's allowed. What's the smallest thing that would feel like enough?",
      "Good morning. Your battery is low at {battery}%. A gentle day still counts as a good one.",
    ],
  },
  midday: {
    high: [
      "It's {time} — you've been going strong at {battery}%. A quick break now protects your energy for the afternoon.",
      "Mid-day check-in. You're at {battery}% and doing well. How are you actually feeling?",
      "It's {time}. Even high-energy days need a pause. Take a breath — you've earned it.",
      "You're at {battery}% at {time}. A short rest will keep you there.",
    ],
    medium: [
      "It's {time} — the natural energy valley. Maybe a quick stretch or a glass of water before the next task?",
      "Mid-afternoon. Your battery is at {battery}%. A short rest now could make the next few hours easier.",
      "It's {time}. You're at {battery}% — right in the middle. A small recharge goes a long way.",
      "The 3 PM dip is real. At {battery}%, a few minutes away from the screen might be exactly what you need.",
    ],
    low: [
      "It's {time}. At {battery}%, your body is asking for something. Water, a stretch, or just stillness.",
      "Mid-day, and you're at {battery}%. Time for a recharge — even five minutes counts.",
      "It's {time}. You're at {battery}% — that's your cue to slow down. Your progress is safe. Rest first.",
      "Running low at {battery}% and it's only {time}. A break now isn't giving up — it's protecting the rest of your day.",
    ],
  },
  shutdown: {
    high: [
      "The sun is setting. Time to close the work chapter and plug yourself in for the night. Ready to wind down?",
      "Evening is here. You've done enough. Your tasks will be here tomorrow — ready to start winding down?",
      "It's getting late. A good day deserves a gentle close. Ready to begin your shutdown ritual?",
      "You gave a lot today at {battery}%. The best thing you can do now is rest well.",
    ],
    medium: [
      "The day is winding down. You're at {battery}% — a quiet evening will help restore what you've spent.",
      "Evening. Time to put the day to rest. Your progress is safe. Ready to close out?",
      "The sun is setting. What you did today was enough. Ready to wind down when you are.",
      "Evening check-in: {battery}%. Not bad for a full day. Time to let go of anything left undone.",
    ],
    low: [
      "Evening. At {battery}%, your body has been working hard. Time to rest — no guilt required.",
      "The day is done. You're at {battery}% and that makes rest even more important. Start your wind-down?",
      "It's time to stop. You've given what you had today. That's always enough. Rest now.",
      "You ran low at {battery}% today. The kindest thing you can do now is a real, full rest.",
    ],
  },
  checkin: {
    any: [
      "When you're ready — how are you arriving today?",
      "No pressure. Just checking in: how's your energy right now?",
      "Your daily check-in is here whenever you'd like to begin.",
      "A moment to notice how you're feeling before the day begins.",
      "Good morning. Take a breath, then let's see how you're showing up today.",
    ],
  },
  recharge: {
    any: [
      "Your battery is at {battery}%. Time for a recharge — even a short one makes a difference.",
      "Running low at {battery}%. When you're ready, a small rest will go a long way.",
      "At {battery}%, your energy needs some attention. No rush — just a gentle nudge.",
      "Your battery is asking for care at {battery}%. A few minutes of stillness is always available.",
      "At {battery}%, rest isn't a luxury — it's the next right move. Your progress is safe.",
    ],
  },
};

function _getNotifBatteryTier(b) {
  if (b >= 70) return "high";
  if (b >= 40) return "medium";
  return "low";
}

function _pickNotifRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _fillNotifVars(template, vars = {}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
  return template
    .replace(/\{battery\}/g, vars.battery ?? "")
    .replace(/\{time\}/g,    vars.time    ?? timeStr)
    .replace(/\{name\}/g,    vars.name    ?? "");
}

function getGentleMessage(type, battery = 100, vars = {}) {
  const pool = NOTIF_TEMPLATES[type];
  if (!pool) return null;
  const tier = _getNotifBatteryTier(battery);
  const templates = pool[tier] ?? pool.any ?? [];
  if (!templates.length) return null;
  return _fillNotifVars(_pickNotifRandom(templates), { battery, ...vars });
}

function _isQuietHours(start, end) {
  // start/end are "HH:MM" strings
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  const cur = h * 60 + m;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s > e ? (cur >= s || cur < e) : (cur >= s && cur < e);
}

async function _fireGentleNotif(title, body) {
  // Electron: route through main process for reliable native macOS notifications
  if (window.electronAPI?.sendNotification) {
    window.electronAPI.sendNotification(title, body);
    return;
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const opts = { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", silent: false };
  try {
    new Notification(title, opts);
  } catch {
    try {
      const sw = await navigator.serviceWorker.ready;
      await sw.showNotification(title, opts);
    } catch (err) {
      console.warn("NotificationService:", err);
    }
  }
}

// ─── iOS Local Notifications helper ──────────────────────────────────────────
const _localNotifs = () => window.Capacitor?.Plugins?.LocalNotifications;
const _isNative    = () => window.Capacitor?.isNativePlatform?.() ?? false;
// ─── Calendar (native EventKit via @ebarooni/capacitor-calendar) ─────────────
const _cal = () => window.Capacitor?.Plugins?.CapacitorCalendar;

// Normalize a raw native calendar event to the shape the app uses everywhere.
// Both CalendarEventsSection (Circuit Tab) and CalendarView (full Calendar tab)
// consume this shape: { id, title, startDate, endDate, isAllDay, source, ... }
function mapNativeEvent(ev) {
  // The plugin's Swift layer emits "allDay" (not "isAllDay") and "description" (not "notes").
  // Read both spellings so the mapping survives any future plugin update that aligns with its own TS types.
  return {
    id:         ev.id         ?? `device-${ev.startDate}-${encodeURIComponent(ev.title ?? "")}`,
    title:      ev.title      ?? "(No title)",
    startDate:  typeof ev.startDate === "number" ? ev.startDate : Number(ev.startDate ?? 0),
    endDate:    typeof ev.endDate   === "number" ? ev.endDate   : ((ev.startDate ?? 0) + 3600000),
    isAllDay:   ev.allDay     ?? ev.isAllDay   ?? false,
    calendarId: ev.calendarId ?? null,
    location:   ev.location   ?? null,
    notes:      ev.description ?? ev.notes     ?? null,
    source: "device",
  };
}

const calendarHelpers = {
  async checkPermission() {
    const cal = _cal();
    if (!cal || !_isNative()) return "denied";
    try {
      const { result } = await cal.checkPermission({ scope: "readCalendar" });
      return result;
    } catch { return "denied"; }
  },
  async requestAccess() {
    const cal = _cal();
    if (!cal || !_isNative()) return "denied";
    try {
      const { result } = await cal.requestFullCalendarAccess();
      return result;
    } catch { return "denied"; }
  },
  async getTodayEvents() {
    const cal = _cal();
    if (!cal || !_isNative()) return [];
    try {
      const start = new Date(); start.setHours(0,0,0,0);
      const end   = new Date(); end.setHours(23,59,59,999);
      const { result } = await cal.listEventsInRange({ from: start.getTime(), to: end.getTime() });
      return (result || []).map(mapNativeEvent).sort((a, b) => a.startDate - b.startDate);
    } catch { return []; }
  },
  // Fetch a sliding 30-day window (today + 29 days) for pre-populating the Calendar tab.
  async get30DayEvents() {
    const cal = _cal();
    if (!cal || !_isNative()) return [];
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end   = new Date(start); end.setDate(end.getDate() + 30); end.setHours(23, 59, 59, 999);
      const { result } = await cal.listEventsInRange({ from: start.getTime(), to: end.getTime() });
      return (result || []).map(mapNativeEvent).sort((a, b) => a.startDate - b.startDate);
    } catch { return []; }
  },
  async addTaskAsEvent(task) {
    const cal = _cal();
    if (!cal || !_isNative()) return null;
    try {
      const start = task.dueDate ? new Date(task.dueDate + "T09:00:00") : new Date();
      const end   = new Date(start.getTime() + (task.duration || 30) * 60000);
      const { id } = await cal.createEvent({ title: task.name, startDate: start.getTime(), endDate: end.getTime(), isAllDay: !task.duration });
      window.dispatchEvent(new CustomEvent("reflow-device-calendar-updated", { detail: { dateKey: (task.dueDate || new Date().toLocaleDateString("en-CA")) } }));
      return id;
    } catch { return null; }
  },
};




function _fmtScheduledTime(h, m) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Registers this device's push token + notification prefs with the server. `platform` lets the
// server skip reminders an iPhone already schedules on-device (check-in, wind-down).
const SAVE_PREFS_URL = "https://us-central1-mindfulstillflow.cloudfunctions.net/savePrefs";
async function syncPushPrefs(token, prefs, getIdToken, uid) {
  const idToken = await getIdToken();
  if (!idToken) return false;
  const res = await fetch(SAVE_PREFS_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    body:    JSON.stringify({ token, prefs: { ...prefs, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, platform: _isNative() ? "ios" : "web" } }),
  });
  if (!res.ok) throw new Error(`savePrefs ${res.status}`);
  try { localStorage.setItem("reflow-push-synced", `${uid}:${token}`); } catch {}
  return true;
}

async function scheduleIosNotifs(prefs, battery) {
  const ln = _localNotifs();
  if (!ln || !_isNative()) return;
  try {
    const { display } = await ln.requestPermissions();
    if (display !== "granted") return;
    await ln.cancel({ notifications: [{ id:2001 }, { id:2002 }, { id:2003 }] }).catch(() => {});
    const notifs = [];
    if (prefs.checkinEnabled) {
      const [h, m] = prefs.checkinTime.split(":").map(Number);
      notifs.push({ id:2001, title:"MyBattery", body: getGentleMessage("morning", battery, { time: _fmtScheduledTime(h, m) }) ?? "How are you arriving today?",
        schedule:{ on:{ hour:h, minute:m }, repeats:true, allowWhileIdle:true } });
    }
    if (prefs.middayEnabled) {
      const [h, m] = prefs.middayTime.split(":").map(Number);
      notifs.push({ id:2002, title:"MyBattery", body: getGentleMessage("midday", battery, { time: _fmtScheduledTime(h, m) }) ?? "Mid-day check-in — how are you holding up?",
        schedule:{ on:{ hour:h, minute:m }, repeats:true, allowWhileIdle:true } });
    }
    if (prefs.winddownEnabled) {
      const [h, m] = prefs.winddownTime.split(":").map(Number);
      notifs.push({ id:2003, title:"MyBattery", body: getGentleMessage("shutdown", battery, { time: _fmtScheduledTime(h, m) }) ?? "Time to wind down. You showed up — that's enough.",
        schedule:{ on:{ hour:h, minute:m }, repeats:true, allowWhileIdle:true } });
    }
    if (notifs.length) await ln.schedule({ notifications: notifs });
  } catch (err) { console.warn("iOS local notifications:", err); }
}

// IDs 3001–4400 reserved for routine reminders: 7 slots (one per weekday) × up to 200 routines
const ROUTINE_NOTIF_BODY_SUFFIX = "— time for your routine.";
// Runs are queued so an older, slower run (e.g. still awaiting the permission check) can't
// re-schedule stale days after a newer run has already cleared them — that left routines
// alerting on days they'd just been turned off for. Queued runs that are no longer the latest skip.
let _habitNotifQueue  = Promise.resolve();
let _habitNotifLatest = null;
function scheduleHabitNotifsIos(routines) {
  _habitNotifLatest = routines;
  _habitNotifQueue = _habitNotifQueue.then(() =>
    routines === _habitNotifLatest ? _scheduleHabitNotifsIosNow(routines) : undefined);
  return _habitNotifQueue;
}

async function _scheduleHabitNotifsIosNow(routines) {
  const ln = _localNotifs();
  if (!ln || !_isNative()) return;
  try {
    const { display } = await ln.requestPermissions();
    if (display !== "granted") return;
    const cancelIds = Array.from({ length: 1400 }, (_, i) => ({ id: 3001 + i }));
    // Also clear any routine reminders left pending under an older ID scheme.
    const { notifications: pending = [] } = await ln.getPending().catch(() => ({}));
    pending.forEach(n => { if (n.body?.endsWith(ROUTINE_NOTIF_BODY_SUFFIX)) cancelIds.push({ id: n.id }); });
    await ln.cancel({ notifications: cancelIds }).catch(() => {});
    const notifs = [];
    routines.slice(0, 200).forEach((r, idx) => {
      if (!r.reminderTime) return;
      const [hour, minute] = r.reminderTime.split(":").map(Number);
      const body = `${r.emoji} ${r.name} ${ROUTINE_NOTIF_BODY_SUFFIX}`;
      // No days selected = every day. JS getDay() is 0=Sun; Capacitor weekday is 1=Sun.
      const days = r.days?.length ? r.days.map(Number) : [0,1,2,3,4,5,6];
      for (const dow of days) {
        notifs.push({ id: 3001 + idx * 7 + dow, title:"MyBattery", body,
          schedule:{ on:{ weekday: dow + 1, hour, minute }, repeats:true, allowWhileIdle:true } });
      }
    });
    if (notifs.length) await ln.schedule({ notifications: notifs });
  } catch (err) { console.warn("Routine iOS notifications:", err); }
}

// ─── NotificationsView ────────────────────────────────────────────────────────
function NotificationsView({ onToast, firebaseHelpers = {}, gentleMode, onToggleGentleMode, battery = 100, onDirtyChange, saveRef, discardRef }) {
  const requestNotificationPermission = firebaseHelpers.requestNotificationPermission ?? (async () => null);
  const getIdToken = firebaseHelpers.getIdToken ?? (async () => null);
  const requestNativePushToken = firebaseHelpers.requestNativePushToken ?? (async () => null);
  const uid = firebaseHelpers.uid ?? null;
  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.sendNotification;
  const [permissionState, setPermissionState] = useState(
    isElectron ? "granted" :
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [fcmToken, setFcmToken]   = useState(null);
  const [requesting, setRequesting] = useState(false);

  // On iOS, Notification API is unavailable — read permission from the local notifications plugin
  useEffect(() => {
    if (!_isNative()) return;
    const ln = _localNotifs();
    if (!ln) return;
    ln.checkPermissions().then(({ display }) => {
      setPermissionState(display === "granted" ? "granted" : "default");
      // Already allowed → fetch the push token silently (no prompt)
      if (display === "granted") requestNativePushToken().then(t => { if (t) setFcmToken(t); });
    }).catch(() => {});
  }, []);

  // Silently restore FCM token if permission was already granted in a previous session (web only)
  useEffect(() => {
    if (_isNative()) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    requestNotificationPermission().then(token => { if (token) setFcmToken(token); }).catch(() => {});
  }, []);

  const DEFAULT_PREFS = {
    checkinEnabled:      false, checkinTime:       "09:00",
    middayEnabled:       false, middayTime:        "15:00",
    winddownEnabled:     false, winddownTime:      "17:30",
    quietHoursEnabled:   true,  quietStart:        "21:00", quietEnd: "08:00",
    quietCheckinEnabled: true,
  };

  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mindfull-notif-prefs") || "null");
      return saved ? { ...DEFAULT_PREFS, ...saved } : DEFAULT_PREFS;
    }
    catch { return DEFAULT_PREFS; }
  });
  const savedPrefsRef = useRef(null);
  // Populate savedPrefsRef on first render from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mindfull-notif-prefs") || "null");
      savedPrefsRef.current = saved ? { ...DEFAULT_PREFS, ...saved } : DEFAULT_PREFS;
    } catch { savedPrefsRef.current = DEFAULT_PREFS; }
  }, []);

  const isDirty = savedPrefsRef.current !== null &&
    JSON.stringify(prefs) !== JSON.stringify(savedPrefsRef.current);

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty]);

  // Expose save/discard to parent via refs
  if (saveRef)    saveRef.current    = () => savePrefs();
  if (discardRef) discardRef.current = () => {
    if (savedPrefsRef.current) setPrefs(savedPrefsRef.current);
  };

  // ── in-session notification handles ─────────────────────────────────────────
  const _notifHandles = useRef({});

  function _scheduleOnce(id, hourMinStr, fn) {
    if (_notifHandles.current[id]) clearTimeout(_notifHandles.current[id]);
    const [h, m]    = hourMinStr.split(":").map(Number);
    const now       = new Date();
    const target    = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    _notifHandles.current[id] = setTimeout(() => { fn(); delete _notifHandles.current[id]; }, delay);
  }

  function _isCurrentlyQuiet() {
    return prefs.quietHoursEnabled && _isQuietHours(prefs.quietStart, prefs.quietEnd);
  }

  // Wire up in-session schedulers whenever prefs change
  useEffect(() => {
    if (permissionState !== "granted") return;

    if (prefs.checkinEnabled) {
      _scheduleOnce("checkin", prefs.checkinTime, () => {
        if (_isCurrentlyQuiet()) return;
        const msg = getGentleMessage("morning", battery) ?? getGentleMessage("checkin", battery);
        if (msg) _fireGentleNotif("MyBattery", msg);
      });
    }

    if (prefs.middayEnabled) {
      _scheduleOnce("midday", prefs.middayTime, () => {
        if (_isCurrentlyQuiet()) return;
        const msg = getGentleMessage("midday", battery);
        if (msg) _fireGentleNotif("MyBattery", msg);
      });
    }

    if (prefs.winddownEnabled) {
      _scheduleOnce("winddown", prefs.winddownTime, () => {
        if (_isCurrentlyQuiet()) return;
        const msg = getGentleMessage("shutdown", battery);
        if (msg) _fireGentleNotif("MyBattery", msg);
      });
    }


    return () => {
      Object.values(_notifHandles.current).forEach(clearTimeout);
      _notifHandles.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, permissionState, battery]);

  function updatePref(key, value) {
    setPrefs(p => ({ ...p, [key]: value }));
  }

  async function savePrefs() {
    localStorage.setItem("mindfull-notif-prefs", JSON.stringify(prefs));
    savedPrefsRef.current = { ...prefs };
    await scheduleIosNotifs(prefs, battery);
    if (fcmToken) {
      try {
        await syncPushPrefs(fcmToken, prefs, getIdToken, uid);
      } catch {
        onToast({ type:"error", title:"Couldn't sync.", msg:"Notification schedule saved locally but not synced — push notifications may use the wrong time. Try again." });
        return;
      }
    }
    onToast({ type:"win", title:"Saved.", msg:"Your notification schedule has been saved." });
  }

  async function requestPermission() {
    setRequesting(true);
    if (_isNative()) {
      const ln = _localNotifs();
      try {
        const { display } = ln ? await ln.requestPermissions() : { display: "denied" };
        setPermissionState(display === "granted" ? "granted" : "denied");
        if (display === "granted") {
          const token = await requestNativePushToken();
          if (token) setFcmToken(token);
          onToast({ type:"win", title:"Notifications enabled.", msg:"You're all set. Save your schedule below." });
        } else {
          onToast({ type:"win", title:"Permission denied.", msg:"Enable notifications in iOS Settings → MyBattery and try again." });
        }
      } catch {
        onToast({ type:"win", title:"Permission denied.", msg:"Enable notifications in iOS Settings → MyBattery and try again." });
      }
      setRequesting(false);
      return;
    }
    const token = await requestNotificationPermission();
    setPermissionState(Notification.permission);
    if (token) {
      setFcmToken(token);
      onToast({ type:"win", title:"Notifications enabled.", msg:"You're all set. Save your schedule below." });
    } else {
      onToast({ type:"win", title:"Permission denied.", msg:"Enable notifications in your browser settings and try again." });
    }
    setRequesting(false);
  }

  async function sendTestNotification() {
    const ln = _localNotifs();
    if (ln && _isNative()) {
      try {
        await ln.schedule({ notifications: [{ id:2099, title:"MyBattery",
          body: getGentleMessage("checkin", battery) ?? "When you're ready — how are you arriving today?",
          schedule: { at: new Date(Date.now() + 5000) } }] });
        onToast({ type:"win", title:"Notification scheduled.", msg:"You'll see it in 5 seconds." });
        return;
      } catch {}
    }
    if (!isElectron && permissionState !== "granted") return;
    const msg = getGentleMessage("checkin", battery) ?? "When you're ready — how are you arriving today?";
    _fireGentleNotif("MyBattery", msg);
    onToast({ type:"win", title:"Notification sent.", msg:"Check your notification tray." });
  }

  const granted = permissionState === "granted";

  return (
    <div className="notif-page">
      <div style={{ marginBottom:24 }}>
        <div className="readiness-eyebrow">Notifications</div>
        <div className="greeting">Stay in <span>rhythm.</span></div>
        <div style={{ fontSize:14, color:"var(--ink-mute)", marginTop:4 }}>
          Gentle nudges, timed to your day. No noise — just the right signal at the right moment.
        </div>
      </div>

      {!granted && (
        <div className="notif-permission-bar">
          <span>MyBattery needs permission to send you notifications.</span>
          <button className="btn-primary" style={{ whiteSpace:"nowrap", padding:"9px 18px", fontSize:13 }}
            onClick={requestPermission} disabled={requesting}>
            {requesting ? "Requesting…" : "Enable notifications"}
          </button>
        </div>
      )}

      {/* Morning check-in */}
      <div className="notif-section">
        <div className="notif-section-title">Morning check-in</div>
        <div className="notif-section-sub">A gentle greeting that matches your energy level when you wake up.</div>
        <div className="notif-row">
          <div><div className="notif-row-label">Enable</div></div>
          <label className="notif-toggle">
            <input type="checkbox" checked={prefs.checkinEnabled} disabled={!granted}
              onChange={e => updatePref("checkinEnabled", e.target.checked)} />
            <span className="notif-toggle-slider" />
          </label>
        </div>
        <div className="notif-row">
          <div>
            <div className="notif-row-label">Time</div>
            <div className="notif-row-hint">Daily, at this time</div>
          </div>
          <input type="time" className="notif-time-input" value={prefs.checkinTime}
            disabled={!granted || !prefs.checkinEnabled}
            onChange={e => updatePref("checkinTime", e.target.value)} />
        </div>
        {prefs.checkinEnabled && granted && (
          <div style={{ fontSize:12, color:"var(--ink-mute)", marginTop:6, fontStyle:"italic", lineHeight:1.5, paddingLeft:2 }}>
            Example: "{getGentleMessage("morning", battery) ?? "Good morning. When you're ready, your day is here."}"
          </div>
        )}
      </div>

      {/* Mid-day slump */}
      <div className="notif-section">
        <div className="notif-section-title">Mid-day check-in</div>
        <div className="notif-section-sub">A soft nudge at the afternoon energy dip — around 3 PM by default.</div>
        <div className="notif-row">
          <div><div className="notif-row-label">Enable</div></div>
          <label className="notif-toggle">
            <input type="checkbox" checked={prefs.middayEnabled} disabled={!granted}
              onChange={e => updatePref("middayEnabled", e.target.checked)} />
            <span className="notif-toggle-slider" />
          </label>
        </div>
        <div className="notif-row">
          <div>
            <div className="notif-row-label">Time</div>
            <div className="notif-row-hint">Daily, at this time</div>
          </div>
          <input type="time" className="notif-time-input" value={prefs.middayTime}
            disabled={!granted || !prefs.middayEnabled}
            onChange={e => updatePref("middayTime", e.target.value)} />
        </div>
        {prefs.middayEnabled && granted && (
          <div style={{ fontSize:12, color:"var(--ink-mute)", marginTop:6, fontStyle:"italic", lineHeight:1.5, paddingLeft:2 }}>
            Example: "{getGentleMessage("midday", battery) ?? "Time for a recharge — even five minutes counts."}"
          </div>
        )}
      </div>

      {/* Wind-down / Shutdown reminder */}
      <div className="notif-section">
        <div className="notif-section-title">Shutdown reminder</div>
        <div className="notif-section-sub">A gentle close to your day — no pressure, just an invitation to rest.</div>
        <div className="notif-row">
          <div><div className="notif-row-label">Enable</div></div>
          <label className="notif-toggle">
            <input type="checkbox" checked={prefs.winddownEnabled} disabled={!granted}
              onChange={e => updatePref("winddownEnabled", e.target.checked)} />
            <span className="notif-toggle-slider" />
          </label>
        </div>
        <div className="notif-row">
          <div>
            <div className="notif-row-label">Time</div>
            <div className="notif-row-hint">Daily, at this time</div>
          </div>
          <input type="time" className="notif-time-input" value={prefs.winddownTime}
            disabled={!granted || !prefs.winddownEnabled}
            onChange={e => updatePref("winddownTime", e.target.value)} />
        </div>
        {prefs.winddownEnabled && granted && (
          <div style={{ fontSize:12, color:"var(--ink-mute)", marginTop:6, fontStyle:"italic", lineHeight:1.5, paddingLeft:2 }}>
            Example: "{getGentleMessage("shutdown", battery) ?? "The day is done. Your progress is safe. Rest now."}"
          </div>
        )}
      </div>

      {/* Gentle check-in after a quiet stretch (sent by functions/index.js sendQuietCheckin) */}
      <div className="notif-section">
        <div className="notif-section-title">Gentle check-in</div>
        <div className="notif-section-sub">If you haven't logged anything for a few days, we'll send one quiet note around midday. Just once — nothing to do.</div>
        <div className="notif-row">
          <div><div className="notif-row-label">Gentle check-in if I've been quiet for a few days</div></div>
          <label className="notif-toggle">
            <input type="checkbox" checked={prefs.quietCheckinEnabled} disabled={!granted}
              onChange={e => updatePref("quietCheckinEnabled", e.target.checked)} />
            <span className="notif-toggle-slider" />
          </label>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="notif-section" style={{ background:"rgba(106,138,170,0.04)", borderColor:"rgba(106,138,170,0.2)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <div className="notif-section-title" style={{ marginBottom:0 }}>Quiet hours</div>
          {prefs.quietHoursEnabled && (
            <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase", background:"var(--focus-blue)", color:"white", padding:"2px 7px", borderRadius:20 }}>on</span>
          )}
        </div>
        <div className="notif-section-sub">The app stays completely silent during this window. No notifications will be sent, even if a scheduled time falls inside it.</div>
        <div className="notif-row">
          <div><div className="notif-row-label">Enable quiet hours</div></div>
          <label className="notif-toggle">
            <input type="checkbox" checked={prefs.quietHoursEnabled}
              onChange={e => updatePref("quietHoursEnabled", e.target.checked)} />
            <span className="notif-toggle-slider" />
          </label>
        </div>
        <div className="notif-row" style={{ opacity: prefs.quietHoursEnabled ? 1 : 0.45, transition:"opacity 0.2s" }}>
          <div>
            <div className="notif-row-label">From</div>
            <div className="notif-row-hint">Silence starts</div>
          </div>
          <input type="time" className="notif-time-input" value={prefs.quietStart}
            disabled={!prefs.quietHoursEnabled}
            onChange={e => updatePref("quietStart", e.target.value)} />
        </div>
        <div className="notif-row" style={{ opacity: prefs.quietHoursEnabled ? 1 : 0.45, transition:"opacity 0.2s" }}>
          <div>
            <div className="notif-row-label">Until</div>
            <div className="notif-row-hint">Silence ends</div>
          </div>
          <input type="time" className="notif-time-input" value={prefs.quietEnd}
            disabled={!prefs.quietHoursEnabled}
            onChange={e => updatePref("quietEnd", e.target.value)} />
        </div>
        {prefs.quietHoursEnabled && _isCurrentlyQuiet() && (
          <div style={{ marginTop:8, fontSize:12, color:"var(--focus-blue)", display:"flex", alignItems:"center", gap:6 }}>
            <Icon name="moon" size={12} />Quiet hours are active right now.
          </div>
        )}
      </div>

      <div className="notif-save-row">
        <button className="btn-primary" disabled={!granted} onClick={savePrefs}>
          Save notification schedule
        </button>
      </div>

      {/* Test notification */}
      {granted && (
        <div className="notif-section" style={{ marginTop:8 }}>
          <div className="notif-section-title">Test</div>
          <div className="notif-section-sub">Fire a gentle notification right now to confirm everything is working.</div>
          {_isCurrentlyQuiet() && (
            <div style={{ fontSize:12, color:"var(--ink-mute)", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
              <Icon name="moon" size={12} />Quiet hours are active — the test will still send so you can verify delivery.
            </div>
          )}
          <button
            onClick={sendTestNotification}
            style={{ width:"100%", background:"rgba(106,138,170,0.1)", border:"1.5px solid rgba(106,138,170,0.3)", borderRadius:40, padding:"11px 20px", fontSize:14, color:"var(--focus-blue)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, transition:"var(--transition)", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
          >
            <Icon name="bell" size={15} />Send test notification
          </button>
        </div>
      )}

    </div>
  );
}

// ─── AuthView ─────────────────────────────────────────────────────────────────
function AuthView({ createAccount, signIn, signInGoogle, redirectError, resetPassword, friendlyAuthError, onGuestMode }) {
  const [mode,     setMode]     = useState("signin"); // "signin" | "signup" | "reset"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(redirectError ?? null);
  const [success,  setSuccess]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  function switchMode(m) { setMode(m); setError(null); setSuccess(null); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setSuccess(null);
    setLoading(true);
    try {
      if (mode === "signup")      await createAccount(email, password);
      else if (mode === "signin") await signIn(email, password);
      else {
        await resetPassword(email);
        setSuccess("Check your email for a reset link.");
      }
    } catch (err) {
      setError(friendlyAuthError ? friendlyAuthError(err.code) : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSocial(fn) {
    setError(null); setSuccess(null);
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      console.error("[Auth] Google sign-in error:", err.code, err.message);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(friendlyAuthError ? friendlyAuthError(err.code) : err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">MyBattery</div>
        <div className="auth-tagline">Take charge of your day.</div>
        <div className="auth-eyebrow">
          {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
        </div>
        {error   && <div className="auth-error">{error}</div>}
        {success && <div style={{ background:"rgba(90,122,90,0.1)", border:"1px solid rgba(90,122,90,0.25)", borderRadius:"var(--radius-sm)", padding:"10px 14px", fontSize:13, color:"var(--teal-dark)", marginBottom:14 }}>{success}</div>}

        {mode !== "reset" && (
          <>
            <div className="auth-social">
              {signInGoogle && (
                <button className="auth-social-btn" onClick={() => handleSocial(signInGoogle)} disabled={loading}>
                  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
                  Continue with Google
                </button>
              )}
            </div>
            {signInGoogle && <div className="auth-divider"><span>or</span></div>}
          </>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Email</label>
            <input id="auth-email" className="auth-input" type="email" placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          {mode !== "reset" && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">Password</label>
              <input id="auth-password" className="auth-input" type="password" placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
          )}
          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === "signin" && <>
            <button onClick={() => switchMode("reset")}>Forgot password?</button>
            {" · "}
            No account? <button onClick={() => switchMode("signup")}>Create one</button>
          </>}
          {mode === "signup" && <>
            Already have an account? <button onClick={() => switchMode("signin")}>Sign in</button>
          </>}
          {mode === "reset" && <>
            <button onClick={() => switchMode("signin")}>← Back to sign in</button>
          </>}
        </div>

        {onGuestMode && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <button
              type="button"
              onClick={onGuestMode}
              style={{ width:"100%", background:"transparent", border:"1.5px solid var(--warm)", borderRadius:40, padding:"11px 20px", fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"var(--ink-soft)", cursor:"pointer", transition:"var(--transition)", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
              onMouseOver={e => { e.currentTarget.style.borderColor="var(--teal-light)"; e.currentTarget.style.color="var(--ink)"; }}
              onMouseOut={e => { e.currentTarget.style.borderColor="var(--warm)"; e.currentTarget.style.color="var(--ink-soft)"; }}
            >
              Try without an account →
            </button>
            <div style={{ textAlign:"center", marginTop:10, fontSize:11, color:"var(--ink-mute)", lineHeight:1.5 }}>
              Your data stays on this device. No account needed.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── HistoryView ──────────────────────────────────────────────────────────────
function HistoryView({ uid, loadHistory }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !loadHistory) { setLoading(false); return; }
    loadHistory(uid).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [uid]);

  function fmtDate(dateKey) {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], { weekday:"long", month:"long", day:"numeric" });
  }

  function fmtTs(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month:"short", day:"numeric" }) + " · " + d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  }

  function entryDateKey(entry) {
    const iso = entry.ts ?? entry.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
    const d = new Date(iso);
    // Zero-padded YYYY-MM-DD, matching the day-doc IDs from todayKey() (en-CA format)
    // so journal entries land under the same key as their day's card.
    return d.toLocaleDateString("en-CA");
  }

  const energyLabel = { high:"High Focus", med:"Maintenance", low:"Rest Mode", hibernate:"Hibernating" };

  // Build merged timeline: collect all dateKeys from days + journal entries
  const timelineKeys = useMemo(() => {
    if (!data) return [];
    const keys = new Set([...data.days.map(d => d.id), ...(data.journal ?? []).map(entryDateKey)]);
    return [...keys].sort((a, b) => {
      const [ay,am,ad] = a.split("-").map(Number);
      const [by,bm,bd] = b.split("-").map(Number);
      return new Date(by,bm-1,bd) - new Date(ay,am-1,ad);
    });
  }, [data]);

  const journalByDay = useMemo(() => {
    if (!data) return {};
    const map = {};
    (data.journal ?? []).forEach(e => {
      const k = entryDateKey(e);
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return map;
  }, [data]);

  const dayMap = useMemo(() => {
    if (!data) return {};
    const map = {};
    data.days.forEach(d => { map[d.id] = d; });
    return map;
  }, [data]);

  const isEmpty = !data || (data.days.length === 0 && (data.journal ?? []).length === 0);

  return (
    <div className="history-page">
      <div className="history-title">Your <span>history.</span></div>
      <div className="history-sub">A record of showing up.</div>

      {loading && <div className="history-loading">Loading…</div>}

      {!loading && isEmpty && (
        <div className="history-empty">
          <div className="history-empty-icon"><Icon name="leaf" size={32} style={{color:"var(--teal-light)"}} /></div>
          <div className="history-empty-msg">No history yet. Come back after your first full day.</div>
        </div>
      )}

      {!loading && !isEmpty && timelineKeys.map(key => {
        const day     = dayMap[key];
        const entries = journalByDay[key] ?? [];
        return (
          <div key={key} style={{ marginBottom:20 }}>
            {day && (
              <div className="history-day-card">
                <div className="history-day-header">
                  <div className="history-day-date">{fmtDate(day.id)}</div>
                  <div className="history-day-badges">
                    {day.energy && <span className={`history-badge energy-${day.energy}`}>{energyLabel[day.energy] ?? day.energy}</span>}
                    {day.mood    && <span className="history-badge tasks">{day.mood}</span>}
                    {day.shutdownComplete && <span className="history-badge shutdown" style={{display:"inline-flex",alignItems:"center",gap:4}}><Icon name="leaf" size={11} />shut down</span>}
                    {day.tasksCompleted != null && <span className="history-badge tasks">{day.tasksCompleted} tasks done</span>}
                    {day.weekPlan && <span className="history-badge week-plan" style={{display:"inline-flex",alignItems:"center",gap:4}}><Icon name="target" size={11} />week plan</span>}
                  </div>
                </div>
                <div className="history-day-detail">
                  {day.intention && (
                    <div className="history-detail-row">
                      <span className="history-detail-label">Brain Dump</span>
                      <span style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic" }}>"{day.intention}"</span>
                    </div>
                  )}
                  {day.gratitude?.some(g=>g) && (
                    <div style={{ marginTop:8 }}>
                      <div className="history-detail-label" style={{ marginBottom:4 }}>Gratitude</div>
                      <div className="history-gratitude">
                        {day.gratitude.filter(g=>g).map((g,i) => <div key={i}>{g}</div>)}
                      </div>
                    </div>
                  )}
                  {day.shutdownAnswers?.win && (
                    <div className="history-detail-row" style={{ marginTop:8 }}>
                      <span className="history-detail-label">Win</span>
                      <span>{day.shutdownAnswers.win}</span>
                    </div>
                  )}
                  {day.weekPlan && (
                    <div style={{ marginTop:8 }}>
                      {day.weekPlan.focus && (
                        <div className="history-detail-row">
                          <span className="history-detail-label">Theme</span>
                          <span style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic" }}>"{day.weekPlan.focus}"</span>
                        </div>
                      )}
                      {day.weekPlan.forecast && (
                        <div className="history-detail-row">
                          <span className="history-detail-label">Forecast</span>
                          <span>{{ high:"High energy", med:"Moderate", low:"Low energy", unknown:"Not sure yet" }[day.weekPlan.forecast] ?? day.weekPlan.forecast}</span>
                        </div>
                      )}
                      {day.weekPlan.priorities?.length > 0 && (
                        <div style={{ marginTop:4 }}>
                          <div className="history-detail-label" style={{ marginBottom:4 }}>Priorities</div>
                          <div className="history-gratitude">
                            {day.weekPlan.priorities.map((p, i) => <div key={i}>{i + 1}. {p}</div>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {entries.length > 0 && (
              <div style={{ paddingLeft: day ? 16 : 0 }}>
                {!day && <div className="history-detail-label" style={{ marginBottom:6, fontSize:11 }}>{fmtDate(key)}</div>}
                {entries.map(entry => {
                  const iso = entry.ts ?? entry.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
                  return (
                    <div key={entry.id} className="history-journal-entry">
                      <div className="history-journal-text">{entry.text}</div>
                      <div className="history-journal-time">{fmtTs(iso)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── EnergyLogView ────────────────────────────────────────────────────────────
function EnergyLogView({ logs = [] }) {
  const TYPE_META = {
    event:  { label: "Event",      icon: "calendar" },
    task:   { label: "Task",       icon: "check-circle" },
    manual: { label: "Manual",     icon: "activity" },
  };

  // ── Insights ──────────────────────────────────────────────────────────────
  const drains   = logs.filter(l => l.delta < 0);
  const charges  = logs.filter(l => l.delta > 0);

  function topLabel(arr) {
    if (!arr.length) return null;
    const counts = {};
    arr.forEach(l => { counts[l.label] = (counts[l.label] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  const topDrain   = topLabel(drains);
  const topCharge  = topLabel(charges);
  const netToday   = logs
    .filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString())
    .reduce((s, l) => s + l.delta, 0);

  // ── Date grouping ─────────────────────────────────────────────────────────
  function dayLabel(ts) {
    const d = new Date(ts), now = new Date();
    const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return new Date(ts).toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" });
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
  }

  const grouped = logs.reduce((acc, entry) => {
    const key = dayLabel(entry.timestamp);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  // ── Empty state ───────────────────────────────────────────────────────────
  if (logs.length === 0) {
    return (
      <div className="el-empty">
        <div className="el-empty-icon"><Icon name="battery" size={32} style={{color:"var(--teal-light)"}} /></div>
        <div className="el-empty-title">No energy changes yet</div>
        <div className="el-empty-sub">
          Schedule your first event on the Calendar, then mark it complete to see how it affects your energy. Your full history will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="el-wrap">
      {/* Insights card */}
      <div className="el-insights">
        <div className="el-insights-title">Insights</div>
        <div className="el-insights-grid">
          <div className="el-insight-cell">
            <div className="el-insight-label">Today's net</div>
            <div className={`el-insight-value ${netToday < 0 ? "drain" : netToday > 0 ? "charge" : "neutral"}`}>
              {netToday > 0 ? "+" : ""}{netToday}%
            </div>
          </div>
          <div className="el-insight-cell">
            <div className="el-insight-label">Top drain</div>
            <div className="el-insight-value drain">{topDrain ?? "—"}</div>
          </div>
          <div className="el-insight-cell">
            <div className="el-insight-label">Top recharge</div>
            <div className="el-insight-value charge">{topCharge ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Log groups */}
      {Object.entries(grouped).map(([day, entries]) => (
        <div key={day} className="el-group">
          <div className="el-group-label">{day}</div>
          {entries.map(entry => {
            const meta = TYPE_META[entry.type] || { label: entry.type, icon: "·" };
            const isDrain = entry.delta < 0;
            const isCharge = entry.delta > 0;
            return (
              <div key={entry.id} className={`el-entry ${isDrain ? "drain" : isCharge ? "charge" : "neutral"}`}>
                <div className={`el-delta ${isDrain ? "drain" : isCharge ? "charge" : "neutral"}`}>
                  {isCharge ? "+" : ""}{entry.delta}%
                </div>
                <div className="el-entry-body">
                  <div className="el-entry-label">{entry.label}</div>
                  <div className="el-entry-meta">
                    <span className="el-type-badge">{meta.label}</span>
                    <span className="el-time">{fmtTime(entry.timestamp)}</span>
                    <span className="el-battery-after">→ {entry.battery}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── WeekPlanModal ────────────────────────────────────────────────────────────
const WEEK_ENERGY_OPTIONS = [
  { id:"high",    icon:"bolt",  label:"High energy",  hint:"Ready to tackle big things." },
  { id:"med",     icon:"sun",   label:"Moderate",      hint:"Balanced and steady." },
  { id:"low",     icon:"moon",  label:"Low energy",    hint:"Slow and intentional." },
  { id:"unknown", icon:"cloud", label:"Not sure yet",  hint:"I'll see how it unfolds." },
];

function WeekPlanModal({ weekStartDay, userName, onClose, onSave }) {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState("");
  const [forecast, setForecast] = useState(null);
  const [priorities, setPriorities] = useState(["", "", ""]);

  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dayName = DAY_NAMES[weekStartDay] ?? "Monday";
  const firstName = userName?.trim() || null;

  function dismiss() {
    localStorage.setItem("reflow-week-plan-date", new Date().toLocaleDateString("en-CA"));
    if (onSave) onSave({ focus: focus.trim(), forecast, priorities: priorities.filter(p => p.trim()) });
    onClose();
  }

  const TOTAL = 3;
  const dots = Array.from({ length: TOTAL }, (_, i) => (
    <div key={i} className={`wplan-dot ${i === step ? "active" : ""}`} />
  ));

  const filledPriorities = priorities.filter(p => p.trim());
  const forecastOption = WEEK_ENERGY_OPTIONS.find(o => o.id === forecast);

  // Step 0 — Focus / theme
  if (step === 0) return (
    <div className="wplan-overlay">
      <div className="wplan-card">
        <div className="wplan-eyebrow">New week · {dayName}</div>
        <div className="wplan-title">
          {firstName ? `Good to see you, ${firstName}.` : "A new week begins."}
        </div>
        <div className="wplan-sub">
          Take a moment to set your intention before the week gets moving. What's the one word or phrase that captures what you want this week to feel like?
        </div>
        <div className="wplan-dots">{dots}</div>
        <div className="wplan-label">This week's theme or focus</div>
        <textarea
          className="wplan-textarea"
          rows={3}
          placeholder={'e.g. "steady", "creative burst", "protect my energy", "just ship it"…'}
          value={focus}
          onChange={e => setFocus(e.target.value)}
          autoFocus
        />
        <div className="wplan-actions">
          <button className="btn-primary" onClick={() => setStep(1)}>
            {focus.trim() ? "That's the one →" : "I'll skip this →"}
          </button>
        </div>
      </div>
    </div>
  );

  // Step 1 — Energy forecast
  if (step === 1) return (
    <div className="wplan-overlay">
      <div className="wplan-card">
        <div className="wplan-eyebrow">New week · {dayName}</div>
        <div className="wplan-title">How does this week feel, going in?</div>
        <div className="wplan-sub">Your honest read — not what you wish it were. MyBattery will calibrate suggestions to match.</div>
        <div className="wplan-dots">{dots}</div>
        <div className="wplan-energy-grid">
          {WEEK_ENERGY_OPTIONS.map(o => (
            <div
              key={o.id}
              className={`wplan-energy-option ${forecast === o.id ? "selected" : ""}`}
              onClick={() => setForecast(o.id)}
            >
              <div className="wplan-energy-icon"><Icon name={o.icon} size={20} style={{color:"var(--teal-dark)"}} /></div>
              <div className="wplan-energy-label">{o.label}</div>
              <div className="wplan-energy-hint">{o.hint}</div>
            </div>
          ))}
        </div>
        <div className="wplan-actions">
          <button className="wplan-skip" onClick={() => setStep(0)}>← Back</button>
          <button className="btn-primary" disabled={!forecast} onClick={() => setStep(2)}>
            Sounds about right →
          </button>
        </div>
      </div>
    </div>
  );

  // Step 2 — Top 3 priorities
  if (step === 2) return (
    <div className="wplan-overlay">
      <div className="wplan-card">
        <div className="wplan-eyebrow">New week · {dayName}</div>
        <div className="wplan-title">What three things matter most this week?</div>
        <div className="wplan-sub">Not a full to-do list — just the three that, if done, would make this week feel like a success.</div>
        <div className="wplan-dots">{dots}</div>
        <div className="wplan-priorities">
          {priorities.map((p, i) => (
            <div key={i} className="wplan-priority-row">
              <div className="wplan-priority-num">{i + 1}</div>
              <input
                className="wplan-priority-input"
                type="text"
                placeholder={["The one thing I can't let slip…", "Something I've been putting off…", "A small win I can build on…"][i]}
                value={p}
                onChange={e => setPriorities(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                onKeyDown={e => { if (e.key === "Enter" && i < 2) document.querySelectorAll(".wplan-priority-input")[i + 1]?.focus(); }}
                autoFocus={i === 0}
              />
            </div>
          ))}
        </div>
        <div className="wplan-actions">
          <button className="wplan-skip" onClick={() => setStep(1)}>← Back</button>
          <button className="btn-primary" onClick={dismiss}>
            {filledPriorities.length > 0 ? "I'm ready. Let's go →" : "Skip — take me in →"}
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}

// ─── LegalTab ────────────────────────────────────────────────────────────────
const PRIVACY_SECTIONS = [
  { heading:"What we collect", body:`MyBattery stores the following data in your personal Firebase account:\n• Energy levels and battery readings you enter each day\n• Tasks you create, including names, buckets, and completion status\n• Mood and journal entries\n• Mental health screening responses (PHQ-9, GAD-7)\n• Notification preferences and schedule\n• Anonymous usage analytics (errors, crashes)\n\nTask names and health notes are encrypted on your device before being stored. We cannot read them.` },
  { heading:"How we use it", body:`Your data is used only to operate the app — to show you your history, generate AI suggestions, and send your scheduled notifications. It is never sold, shared with advertisers, or used to train AI models.\n\nThe AI Coach sends your task list and current battery level to Google Gemini to generate responses. Task content reaches Google's servers. If you prefer not to share task details with the AI, do not use the AI Coach feature.` },
  { heading:"Data storage & security", body:`All data is stored in Google Firebase (Firestore), hosted in the United States (nam5 region). Firebase is SOC 2 Type II certified and GDPR-compliant.\n\nSensitive fields (task names, journal entries, health notes) are encrypted client-side using AES-GCM-256 with a key derived from your account. Only you can decrypt them.` },
  { heading:"Mental health data", body:`MyBattery includes mental health screening tools (PHQ-9, GAD-7) and mood tracking. This data is treated with the same encryption and access controls as all other personal data. It is never shared with third parties.\n\nMyBattery is not a medical device. It is not a substitute for professional mental health care. If you are in crisis, please contact a qualified professional or use the emergency resources available in the app's SOS section.` },
  { heading:"Notifications", body:`If you enable push notifications, your device's FCM token is stored in Firebase to route messages to your device. Notification times are processed on our servers to send reminders at the times you configure. Disabling notifications in Settings removes your token from our servers.` },
  { heading:"Your rights", body:`You can delete all your data at any time from Settings → Account → Delete My Account. This permanently removes your Firestore documents and Firebase Authentication account.\n\nYou can export a copy of your history from Settings → General → Download history.\n\nFor questions or requests, contact: info@mybatteryapp.com` },
  { heading:"Changes", body:`We will notify you within the app if this policy changes in a material way. Continued use after notice constitutes acceptance.` },
];

const TERMS_SECTIONS = [
  { heading:"What MyBattery is", body:`MyBattery is a personal productivity and wellness tracking app designed for people managing variable energy capacity. It helps you plan tasks, track energy, and build sustainable routines.` },
  { heading:"What MyBattery is not", body:`MyBattery is not a medical device, a clinical tool, or a substitute for professional mental health care or medical advice. The mental health screenings (PHQ-9, GAD-7) are self-administered educational tools — they do not constitute a diagnosis.\n\nIf you are experiencing a mental health crisis, please call or text 988 (US) or contact a qualified professional immediately.` },
  { heading:"Your account", body:`You are responsible for maintaining the security of your account credentials. You must be 13 years or older to use MyBattery. By creating an account, you confirm that the information you provide is accurate.` },
  { heading:"Acceptable use", body:`You agree not to:\n• Attempt to reverse-engineer, exploit, or abuse the service\n• Use the AI features to generate harmful content\n• Attempt to access other users' data\n• Use automated scripts to make excessive API calls` },
  { heading:"AI-generated content", body:`The AI Coach and schedule generator produce suggestions based on your inputs. These suggestions are not guaranteed to be accurate, complete, or appropriate for your specific situation. Use your own judgment. MyBattery is not liable for decisions made based on AI output.` },
  { heading:"Service availability", body:`MyBattery is provided as-is. We make reasonable efforts to keep the service available but do not guarantee uptime. The service may change, be interrupted, or be discontinued with notice.` },
  { heading:"Limitation of liability", body:`To the maximum extent permitted by law, MyBattery and its developers are not liable for any indirect, incidental, or consequential damages arising from your use of the app.` },
  { heading:"Contact", body:`For questions about these terms: info@mybatteryapp.com` },
];

function LegalTab() {
  const [legalDoc, setLegalDoc] = useState("privacy");
  const sections = legalDoc === "privacy" ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const icon = legalDoc === "privacy" ? "shield" : "file";
  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div className="readiness-eyebrow">Legal</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"var(--ink)", margin:"6px 0 4px" }}>Privacy & Terms</div>
        <div style={{ fontSize:13, color:"var(--ink-mute)" }}>Last updated May 2026</div>
      </div>
      <div className="mind-sub-tabs" style={{ marginBottom:24, justifyContent:"center" }}>
        <button className={`mind-tab ${legalDoc==="privacy"?"active":""}`} onClick={() => setLegalDoc("privacy")}>
          <Icon name="shield" size={13} style={{marginRight:5}} />Privacy Policy
        </button>
        <button className={`mind-tab ${legalDoc==="terms"?"active":""}`} onClick={() => setLegalDoc("terms")}>
          <Icon name="file" size={13} style={{marginRight:5}} />Terms of Service
        </button>
      </div>
      {sections.map(s => (
        <div key={s.heading} className="panel-card" style={{ marginBottom:12 }}>
          <div style={{ fontWeight:500, color:"var(--ink)", marginBottom:8, fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
            <Icon name={icon} size={13} style={{color:"var(--teal-dark)", flexShrink:0}} />{s.heading}
          </div>
          <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.75, whiteSpace:"pre-line" }}>{s.body}</div>
        </div>
      ))}
      <div style={{ marginTop:24, padding:"14px 16px", background:"rgba(90,122,90,0.06)", border:"1px solid rgba(90,122,90,0.18)", borderRadius:"var(--radius-sm)", fontSize:12, color:"var(--ink-mute)", lineHeight:1.8 }}>
        <Icon name="link" size={11} style={{marginRight:5, color:"var(--teal-dark)"}} />
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color:"var(--teal-dark)", textDecoration:"underline" }}>Privacy Policy</a>
        {" · "}
        <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color:"var(--teal-dark)", textDecoration:"underline" }}>Terms of Service</a>
      </div>
      <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--warm)", textAlign:"center", fontSize:12, color:"var(--ink-mute)", lineHeight:1.8 }}>
        © {new Date().getFullYear()} MyBattery. All rights reserved.<br />
        <span style={{ fontSize:11 }}>MyBattery is an independent app. Not affiliated with Apple, Google, or any device manufacturer.</span>
      </div>
    </div>
  );
}

// ─── SettingsView ─────────────────────────────────────────────────────────────
// ─── AccomplishmentsView ──────────────────────────────────────────────────────
function AccomplishmentsView({ sessionWins = [], onUncomplete, routines = [] }) {
  const analytics = (() => {
    try { return JSON.parse(localStorage.getItem("reflow-analytics") || "[]"); } catch { return []; }
  })();

  const todayKey = new Date().toLocaleDateString("en-CA");
  const pastDays = analytics.filter(r => r.date !== todayKey && r.tasks > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  const todayRoutines = routines.filter(r => r.completedDate === todayKey);

  const hasAnything = sessionWins.length > 0 || todayRoutines.length > 0 || pastDays.length > 0;

  if (!hasAnything) {
    return (
      <div style={{ textAlign:"center", padding:"48px 24px" }}>
        <div style={{ fontSize:36, marginBottom:16 }}><Icon name="leaf" size={40} style={{color:"var(--teal-light)",opacity:0.7}} /></div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"var(--ink)", marginBottom:10 }}>Nothing logged yet — and that's okay.</div>
        <div style={{ fontSize:13, color:"var(--ink-soft)", lineHeight:1.7, maxWidth:320, margin:"0 auto" }}>
          Every task you complete, every goal you log — it all counts. Start your day and your wins will appear here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div className="readiness-eyebrow">Accomplishments</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"var(--ink)", margin:"6px 0 4px" }}>Look how far you've come.</div>
      </div>

      {(sessionWins.length > 0 || todayRoutines.length > 0) && (
        <div className="panel-card" style={{ marginBottom:20 }}>
          <div className="panel-title" style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
            <Icon name="check-circle" size={14} style={{color:"var(--teal-dark)"}} />Today's wins
          </div>
          {sessionWins.map((w, i) => (
            <div key={w.id ?? i} className="win-item" style={{ borderTop: i === 0 ? "none" : undefined, padding:"9px 0" }}>
              <Icon name="check-circle" size={13} style={{color:"var(--teal-dark)", flexShrink:0, marginTop:1}} />
              <span style={{ fontSize:14, color:"var(--ink)", lineHeight:1.4 }}>{w.name}</span>
              {onUncomplete && <button className="win-undo-btn" onClick={e => { e.stopPropagation(); onUncomplete(w.id); }}>↩ undo</button>}
            </div>
          ))}
          {todayRoutines.map((r, i) => {
            const doneCt = r.steps.filter(s => s.done).length;
            return (
              <div key={r.id} className="win-item" style={{ borderTop: (sessionWins.length > 0 || i > 0) ? undefined : "none", padding:"9px 0" }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{r.emoji}</span>
                <span style={{ fontSize:14, color:"var(--ink)", lineHeight:1.4, flex:1 }}>{r.name}</span>
                <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--teal-dark)", background:"var(--teal-light)", borderRadius:20, padding:"2px 8px", flexShrink:0 }}>{doneCt} of {r.steps.length} steps</span>
              </div>
            );
          })}
          <div style={{ marginTop:12, fontSize:12, color:"var(--teal-dark)", fontStyle:"italic" }}>
            {(sessionWins.length + todayRoutines.length) === 1 ? "One down. That's a real win." : `${sessionWins.length + todayRoutines.length} things done. That's momentum.`}
          </div>
        </div>
      )}

      {pastDays.length > 0 && (
        <div className="panel-card">
          <div className="panel-title" style={{ marginBottom:12 }}>Recent days</div>
          {pastDays.map((r, i) => (
            <div key={r.date} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderTop: i === 0 ? "none" : "1px solid var(--warm)" }}>
              <div style={{ fontSize:13, color:"var(--ink-soft)" }}>
                {new Date(r.date + "T12:00:00").toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" })}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <Icon name="check-circle" size={12} style={{color:"var(--teal-dark)"}} />
                <span style={{ fontSize:13, fontWeight:500, color:"var(--ink)" }}>{r.tasks} task{r.tasks !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({ initialTab = "settings", onShowTutorial, powerMode, onTogglePowerMode, privacyMode, onTogglePrivacyMode, gentleMode, onToggleGentleMode, sternMode, onToggleSternMode, showBreathingOnStart, onToggleBreathingOnStart, onClearData, onDeleteAccount, onToast, uid, userEmail, loadHistory, firebaseHelpers, energyLog = [], weekStartDay, onChangeWeekStartDay, energyMap = DEFAULT_ENERGY_MAP, onSaveEnergyMap, onSignOut, guestMode, onExitGuest, battery = 100, onRecalibrate, sessionWins = [], onUncompleteTask, fontScale = "md", onChangeFontScale, darkMode = false, onToggleDarkMode, isPro = false, onOpenPaywall, onOpenWaitlist, earnedBadges = [], routines = [] }) {
  const [activeTab,        setActiveTab]        = useState(initialTab);
  const [historySubTab,    setHistorySubTab]    = useState("timeline");
  const [settingsSubTab,   setSettingsSubTab]   = useState("general");
  const [showAdvanced,     setShowAdvanced]     = useState(false);
  const [notifDirty,       setNotifDirty]       = useState(false);
  const [pendingTab,       setPendingTab]       = useState(null);
  const [showPrivacy,      setShowPrivacy]      = useState(false);
  const [showTerms,        setShowTerms]        = useState(false);
  const notifSaveRef    = useRef(null);
  const notifDiscardRef = useRef(null);

  function trySetTab(tab) {
    if (notifDirty) { setPendingTab(tab); }
    else            { setActiveTab(tab); }
  }

  async function handleDirtyModalSave() {
    await notifSaveRef.current?.();
    setNotifDirty(false);
    if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null); }
  }

  function handleDirtyModalDiscard() {
    notifDiscardRef.current?.();
    setNotifDirty(false);
    if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null); }
  }

  return (
    <div className="grounding-page" style={{ paddingTop:0 }}>
      <div className="history-title" style={{ marginBottom:4 }}>Settings</div>
      <div className="history-sub" style={{ marginBottom:20 }}>Customize how MyBattery works for you.</div>

      <div className="flat-nav-wrap">
        <div className="mind-sub-tabs mind-sub-tabs--split">
          <button className={`mind-tab ${activeTab==="settings"?"active":""}`}  onClick={() => trySetTab("settings")}><Icon name="gear" size={13} style={{marginRight:5}} />Settings{notifDirty && <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--slate-dark)", display:"inline-block", marginLeft:5, verticalAlign:"middle" }} />}</button>
          <button className={`mind-tab ${activeTab==="safety"?"active":""}`}    onClick={() => trySetTab("safety")}><Icon name="shield" size={13} style={{marginRight:5}} />Safety</button>
          <button className={`mind-tab ${activeTab==="history"?"active":""}`}   onClick={() => trySetTab("history")}><Icon name="calendar" size={13} style={{marginRight:5}} />History</button>
        </div>
      </div>

      {pendingTab && (
        <div className="dirty-modal-overlay" onClick={() => setPendingTab(null)}>
          <div className="dirty-modal" onClick={e => e.stopPropagation()}>
            <div className="dirty-modal-title">Unsaved notification changes</div>
            <div className="dirty-modal-sub">You changed your notification schedule but haven't saved yet. What would you like to do?</div>
            <div className="dirty-modal-actions">
              <button className="dirty-modal-save"    onClick={handleDirtyModalSave}>Save changes</button>
              <button className="dirty-modal-discard" onClick={handleDirtyModalDiscard}>Discard changes</button>
              <button className="dirty-modal-cancel"  onClick={() => setPendingTab(null)}>Cancel — stay here</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div key="settings" className="settings-tab-content">
          {/* Second-level sub-tab bar */}
          <div className="mind-sub-tabs mind-sub-tabs--split mind-sub-tabs--tight">
            <button className={`mind-tab ${settingsSubTab==="general"?"active":""}`}       onClick={() => setSettingsSubTab("general")}><Icon name="gear" size={13} style={{marginRight:5}} />General</button>
            <button className={`mind-tab ${settingsSubTab==="notifications"?"active":""}`} onClick={() => setSettingsSubTab("notifications")}><Icon name="bell" size={13} style={{marginRight:5}} />Notifications{notifDirty && <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--slate-dark)", display:"inline-block", marginLeft:5, verticalAlign:"middle" }} />}</button>
            <button className={`mind-tab ${settingsSubTab==="account"?"active":""}`}       onClick={() => setSettingsSubTab("account")}><Icon name="power" size={13} style={{marginRight:5}} />Account</button>
            <button className={`mind-tab ${settingsSubTab==="legal"?"active":""}`}         onClick={() => setSettingsSubTab("legal")}><Icon name="shield" size={13} style={{marginRight:5}} />Legal</button>
          </div>

          {/* ── General ── */}
          {settingsSubTab === "general" && (<>
            <div className="panel-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:16 }}>
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}>
                    {darkMode
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal-dark)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle",marginRight:6}}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal-dark)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle",marginRight:6}}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    }
                    Dark Mode
                  </div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>
                    Switches the app to a darker colour scheme. Easier on the eyes at night.
                  </div>
                </div>
                <label className="notif-toggle" style={{ flexShrink:0 }}>
                  <input type="checkbox" checked={darkMode} onChange={onToggleDarkMode} />
                  <span className="notif-toggle-slider" />
                </label>
              </div>
            </div>
            <div className="panel-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}><Icon name="lock" size={14} style={{color:"var(--teal-dark)"}} />Privacy Mode</div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>
                    Blurs task names and mood values on screen. Tap a task to see it. Nothing changes in how your data is saved.
                  </div>
                </div>
                <label className="notif-toggle" style={{ flexShrink:0, marginTop:2 }}>
                  <input type="checkbox" checked={privacyMode} onChange={onTogglePrivacyMode} />
                  <span className="notif-toggle-slider" />
                </label>
              </div>
              {privacyMode && (
                <div style={{ marginTop:12, fontSize:12, color:"var(--focus-blue)", fontStyle:"italic" }}>
                  Privacy Mode is on — tap any task to read it.
                </div>
              )}
            </div>
            <div className="panel-card">
              <div className="panel-title" style={{ marginBottom:4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle",marginRight:6}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Communication style
              </div>
              <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6, marginBottom:4 }}>
                Choose how the app speaks to you. Stern Mode is always user-initiated and never turns on automatically.
              </div>
              <div className="stern-mode-selector">
                <button
                  className={`stern-mode-option gentle${gentleMode ? " active" : ""}`}
                  onClick={() => { onToggleGentleMode(true); }}
                >🌿 Gentle</button>
                <button
                  className={`stern-mode-option default${!gentleMode && !sternMode ? " active" : ""}`}
                  onClick={() => { if (gentleMode) onToggleGentleMode(false); if (sternMode) onToggleSternMode(false); }}
                >Default</button>
                <button
                  className={`stern-mode-option stern${sternMode ? " active" : ""}`}
                  onClick={() => { onToggleSternMode(true); }}
                >⚡ Stern</button>
              </div>
              {sternMode && (
                <div style={{ marginTop:12, fontSize:12, color:darkMode?"#9c90f0":"#4f46e5", fontStyle:"italic", display:"flex", alignItems:"center", gap:6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={darkMode?"#9c90f0":"#4f46e5"}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Stern Mode on — overdue tasks will prompt you for an action plan before activating.
                </div>
              )}
            </div>
            <div className="panel-card">
              <div className="panel-title" style={{ marginBottom:8 }}>
                <Icon name="eye" size={14} style={{color:"var(--teal-dark)"}} />Text size
              </div>
              <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6, marginBottom:12 }}>
                Adjust the display size of all text in the app.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {[["sm","S — Small"],["md","M — Default"],["lg","L — Large"]].map(([val, label]) => (
                  <button key={val} onClick={() => onChangeFontScale(val)} style={{ flex:1, minHeight:44, padding:"8px 4px", borderRadius:"var(--radius-sm)", border:`1.5px solid ${fontScale===val?"var(--teal-dark)":"var(--warm)"}`, background: fontScale===val?"rgba(90,122,90,0.08)":"var(--card)", color: fontScale===val?"var(--teal-dark)":"var(--ink-mute)", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight: fontScale===val?500:400, cursor:"pointer", transition:"var(--transition)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}>
                    <Icon name="wind" size={14} style={{color:"var(--teal-dark)"}} />Show breathing exercise on start
                    <span className="setting-info-wrap">
                      <span className="setting-info-icon">i</span>
                      <span className="setting-info-tip">Breathing helps lower your heart rate and signals your nervous system to rest, helping you recharge your battery more efficiently.</span>
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>
                    Show a short breathing exercise before your day begins. Off by default.
                  </div>
                </div>
                <label className="notif-toggle" style={{ flexShrink:0, marginTop:2 }}>
                  <input type="checkbox" checked={showBreathingOnStart} onChange={onToggleBreathingOnStart} />
                  <span className="notif-toggle-slider" />
                </label>
              </div>
            </div>
            {onShowTutorial && (
              <div className="panel-card panel-action-row">
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}><Icon name="book-open" size={14} style={{color:"var(--teal-dark)"}} />How MyBattery works</div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>A quick tour of the main features.</div>
                </div>
                <button className="btn-secondary" style={{ fontSize:13, flexShrink:0 }} onClick={onShowTutorial}>Show tour →</button>
              </div>
            )}

            <button className="settings-advanced-toggle" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}>
              Advanced {showAdvanced ? "▾" : "▸"}
            </button>
            {showAdvanced && (<>
            <div className="panel-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}><Icon name="bolt" size={14} style={{color:"var(--teal-dark)"}} />Power Mode</div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>
                    Unlocks auto-scheduling, ICS calendar export, and protected focus block reservation. Turn this on when you want more control over your day's structure.
                  </div>
                </div>
                <label className="notif-toggle" style={{ flexShrink:0, marginTop:2 }}>
                  <input type="checkbox" checked={powerMode} onChange={onTogglePowerMode} />
                  <span className="notif-toggle-slider" />
                </label>
              </div>
              {powerMode && (
                <div style={{ marginTop:12, fontSize:12, color:"var(--teal-dark)", fontStyle:"italic" }}>
                  Power Mode is on — visit Calendar to use advanced scheduling features.
                </div>
              )}
            </div>
            <div className="panel-card">
              <div className="panel-title" style={{ marginBottom:4 }}><Icon name="bolt" size={14} style={{color:"var(--teal-dark)"}} />Energy Map</div>
              <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6, marginBottom:14 }}>
                Tell MyBattery when your energy peaks and dips across a typical day. Auto-schedule uses this to place heavy work during High slots and rest tasks during Low ones.
              </div>
              <EnergyMapEditor energyMap={energyMap} onChange={onSaveEnergyMap} />
            </div>
            <div className="panel-card">
              <div className="panel-title" style={{ marginBottom:4 }}><Icon name="calendar" size={14} style={{color:"var(--teal-dark)"}} />Week starts on</div>
              <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>
                On this day each week, Circuit shows a card offering to help you plan the week ahead.
              </div>
              <div className="week-day-picker">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
                  <button
                    key={i}
                    className={`week-day-btn ${weekStartDay === i ? "selected" : ""}`}
                    onClick={() => onChangeWeekStartDay(i)}
                  >{d}</button>
                ))}
              </div>
            </div>
            {onRecalibrate && (
              <div className="panel-card">
                <div className="panel-title" style={{ marginBottom:4 }}><Icon name="bolt" size={14} style={{color:"var(--teal-dark)"}} />Recalibrate</div>
                <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6, marginBottom:12 }}>
                  Update your name, role, or any preferences you set during onboarding.
                </div>
                <button className="btn-secondary" style={{ fontSize:13 }} onClick={onRecalibrate}>Go to setup →</button>
              </div>
            )}
            </>)}
            <div style={{ marginTop:8 }}>
              <FeedbackView onToast={onToast} saveFeedback={firebaseHelpers?.saveFeedback} uid={uid} />
            </div>
          </>)}

          {/* ── Notifications ── */}
          {settingsSubTab === "notifications" && (
            <NotificationsView
              onToast={onToast}
              firebaseHelpers={{ ...firebaseHelpers, uid }}
              gentleMode={gentleMode}
              onToggleGentleMode={onToggleGentleMode}
              battery={battery}
              onDirtyChange={setNotifDirty}
              saveRef={notifSaveRef}
              discardRef={notifDiscardRef}
            />
          )}

          {/* ── Account ── */}
          {settingsSubTab === "account" && (<>
            {/* Subscription management — shown when user has an active Pro subscription */}
            {isPro && onOpenPaywall && (
              <div className="panel-card panel-action-row" style={{ background:"rgba(90,122,90,0.05)", borderColor:"rgba(90,122,90,0.3)" }}>
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}><Icon name="sparkle" size={14} style={{color:"var(--teal-dark)"}} />MyBattery Pro</div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>You're subscribed. Manage billing, cancel, or see your subscription history.</div>
                </div>
                <button
                  onClick={() => onOpenPaywall("customer-center")}
                  style={{ flexShrink:0, background:"var(--teal-dark)", border:"none", borderRadius:40, padding:"9px 18px", fontSize:13, color:"white", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, transition:"all 0.2s", whiteSpace:"nowrap" }}
                >Manage →</button>
              </div>
            )}
            {!isPro && onOpenPaywall && (
              <div className="panel-card panel-action-row" style={{ background:"rgba(90,122,90,0.04)", borderColor:"rgba(90,122,90,0.2)" }}>
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}><Icon name="sparkle" size={14} style={{color:"var(--teal-dark)"}} />MyBattery Pro</div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>Unlock AI Coach, smart scheduling, full journal history, analytics, and more.</div>
                </div>
                <button
                  onClick={() => onOpenPaywall()}
                  style={{ flexShrink:0, background:"var(--teal-dark)", border:"none", borderRadius:40, padding:"9px 18px", fontSize:13, color:"white", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, transition:"all 0.2s", whiteSpace:"nowrap" }}
                >Unlock Pro →</button>
              </div>
            )}
            {onOpenWaitlist && (
              <div className="panel-card panel-action-row" style={{ background:"rgba(106,138,170,0.05)", borderColor:"rgba(106,138,170,0.25)" }}>
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}>📱 Mobile app</div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>A dedicated mobile app is on the way. Join the waitlist to be first to know.</div>
                </div>
                <button
                  onClick={onOpenWaitlist}
                  style={{ flexShrink:0, background:"var(--warm)", border:"1.5px solid rgba(106,138,170,0.35)", borderRadius:40, padding:"9px 18px", fontSize:13, color:"var(--ink-soft)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, transition:"all 0.2s", whiteSpace:"nowrap" }}
                >Join waitlist →</button>
              </div>
            )}
            {(uid && onSignOut) && (
              <div className="panel-card panel-action-row">
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}><Icon name="power" size={14} style={{color:"var(--teal-dark)"}} />Account</div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>
                    {userEmail
                      ? <>Signed in as <strong style={{ color:"var(--ink)" }}>{userEmail}</strong>. Sign out to switch accounts or use a different device.</>
                      : "You're signed in. Sign out to switch accounts or use a different device."}
                  </div>
                </div>
                <button onClick={onSignOut} style={{ flexShrink:0, background:"var(--warm)", border:"1.5px solid rgba(0,0,0,0.08)", borderRadius:40, padding:"9px 18px", fontSize:13, color:"var(--ink-soft)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s", whiteSpace:"nowrap" }}>Sign out →</button>
              </div>
            )}
            {guestMode && onExitGuest && (
              <div className="panel-card panel-action-row" style={{ background:"rgba(106,138,170,0.06)", borderColor:"rgba(106,138,170,0.25)" }}>
                <div>
                  <div className="panel-title" style={{ marginBottom:4 }}>Guest session</div>
                  <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>Your data is saved locally on this device. Create an account to back it up and sync across devices.</div>
                </div>
                <button onClick={onExitGuest} style={{ flexShrink:0, background:"var(--teal-dark)", border:"none", borderRadius:40, padding:"9px 18px", fontSize:13, color:"white", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, transition:"all 0.2s", whiteSpace:"nowrap" }}>Save my data →</button>
              </div>
            )}
            <div className="panel-card panel-action-row" style={{ borderColor:"rgba(196,114,106,0.3)" }}>
              <div>
                <div className="panel-title" style={{ marginBottom:4, color:"var(--error)" }}><Icon name="trash" size={14} />Clear All Data</div>
                <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>Permanently delete your tasks, calendar, and records, then sign out. Your account stays open.</div>
              </div>
              <button
                onClick={onClearData}
                style={{ flexShrink:0, background:"rgba(196,114,106,0.1)", border:"1.5px solid var(--error)", borderRadius:40, padding:"9px 18px", fontSize:13, color:"var(--error)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}
              >Delete →</button>
            </div>
            <div className="panel-card panel-action-row" style={{ borderColor:"rgba(196,114,106,0.5)", background:"rgba(196,114,106,0.03)" }}>
              <div>
                <div className="panel-title" style={{ marginBottom:4, color:"var(--error)" }}><Icon name="x-circle" size={14} />Delete My Account</div>
                <div style={{ fontSize:13, color:"var(--ink-mute)", lineHeight:1.6 }}>Permanently removes your Firebase Auth profile and all associated data. This cannot be undone. Requires a recent sign-in.</div>
              </div>
              <button
                onClick={onDeleteAccount}
                style={{ flexShrink:0, background:"var(--error)", border:"none", borderRadius:40, padding:"9px 18px", fontSize:13, color:"white", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, transition:"all 0.2s" }}
              >Delete account →</button>
            </div>
          </>)}

          {/* ── Legal ── */}
          {settingsSubTab === "legal" && <LegalTab />}

          {settingsSubTab !== "legal" && (
            <div style={{ marginTop:32, paddingTop:16, borderTop:"1px solid var(--warm)", textAlign:"center", fontSize:11, color:"var(--ink-mute)" }}>
              © {new Date().getFullYear()} MyBattery. All rights reserved. · <button className="tap-slop" onClick={() => setSettingsSubTab("legal")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"var(--ink-mute)", padding:0, textDecoration:"underline" }}>Privacy & Terms</button>
            </div>
          )}
        </div>
      )}
      {activeTab === "safety" && (
        <div key="safety" className="settings-tab-content">
          <div style={{ marginBottom:20 }}>
            <div className="readiness-eyebrow">Safety Hub</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"var(--ink)", margin:"6px 0 4px" }}>You're not alone.</div>
          </div>
          <SafetyHubView />
        </div>
      )}
      {activeTab === "history" && (
        <div key="history" className="settings-tab-content">
          <div className="mind-sub-tabs" style={{ marginBottom:20, justifyContent:"center" }}>
            <button className={`mind-tab ${historySubTab==="timeline"?"active":""}`} onClick={() => setHistorySubTab("timeline")}><Icon name="calendar" size={13} style={{marginRight:5}} />Timeline</button>
            <button className={`mind-tab ${historySubTab==="patterns"?"active":""}`} onClick={() => setHistorySubTab("patterns")}><Icon name="chart" size={13} style={{marginRight:5}} />Patterns</button>
          </div>
          {historySubTab === "timeline" && (
            <>
              <AccomplishmentsView sessionWins={sessionWins} onUncomplete={onUncompleteTask} routines={routines} />
              <div className="section-label" style={{ margin:"28px 0 10px" }}>Energy log</div>
              <EnergyLogView logs={energyLog} />
              <div className="section-label" style={{ margin:"28px 0 10px" }}>Past days</div>
              {isPro
                ? <HistoryView uid={uid} loadHistory={loadHistory} />
                : <ProGate feature="History" detail="See every day's check-in, mood, and shutdown notes." onUpgrade={onOpenPaywall} />}
            </>
          )}
          {historySubTab === "patterns"  && (
            <div>
              <div style={{ marginBottom:20 }}>
                <div className="readiness-eyebrow">Energy Patterns</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"var(--ink)", margin:"6px 0 4px" }}>Your week, at a glance.</div>
              </div>
              {isPro ? <AnalyticsView /> : <ProGate feature="Analytics" detail="7-day energy charts and weekly reflections." onUpgrade={onOpenPaywall} />}
            </div>
          )}
        </div>
      )}

      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
      {showTerms   && <TermsModal         onClose={() => setShowTerms(false)}   />}
    </div>
  );
}

// ─── Hibernating views ────────────────────────────────────────────────────────
function JumpstartMode({ onBoost, onClose }) {
  const STEPS = [
    { id:1, icon:"wind",     title:"Three slow breaths",       instruction:"Breathe in for 4 counts, hold for 2, out for 6. You don't even have to open your eyes.",                    boost:1 },
    { id:2, icon:"activity", title:"Wiggle fingers and toes",  instruction:"Just a gentle wiggle. Wake up the edges of your body, starting from the tips.",                            boost:1 },
    { id:3, icon:"sun",      title:"Stretch arms overhead",    instruction:"Reach up slowly — as far as feels okay. Let out a sigh when you bring them back down.",                    boost:1 },
    { id:4, icon:"bolt",     title:"Turn on a little light",   instruction:"A lamp, your phone screen, a crack in the curtain. Just a small shift. Nothing dramatic.",                boost:1 },
    { id:5, icon:"droplet",  title:"Sip some water",           instruction:"If there's water nearby, take one slow sip. If not, just take a moment to swallow.",                       boost:1 },
    { id:6, icon:"ground",   title:"Sit up — whenever ready",  instruction:"No hurry. Use your arms, roll to your side first if that helps. You've already done the hardest part.",    boost:2 },
  ];

  const [stepIdx,    setStepIdx]    = useState(0);
  const [boostFlash, setBoostFlash] = useState(null);
  const [totalBoost, setTotalBoost] = useState(0);
  const [done,       setDone]       = useState(false);
  const [advancing,  setAdvancing]  = useState(false);

  function handleDone() {
    if (advancing || done) return;
    const step = STEPS[stepIdx];
    if (!step) return;
    setAdvancing(true);
    setBoostFlash(step.boost);
    onBoost(step.boost);
    setTotalBoost(prev => prev + step.boost);
    setTimeout(() => setBoostFlash(null), 1300);
    if (stepIdx < STEPS.length - 1) {
      setTimeout(() => { setStepIdx(i => i + 1); setAdvancing(false); }, 1500);
    } else {
      setTimeout(() => setDone(true), 1500);
    }
  }

  const step = STEPS[Math.min(stepIdx, STEPS.length - 1)];

  const XBtn = () => (
    <button onClick={onClose} aria-label="Close" style={{ position:"absolute", top:14, right:14, background:"none", border:"none", cursor:"pointer", color:"var(--ink-mute)", padding:6, lineHeight:1, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  );

  if (done) {
    return (
      <div className="jumpstart-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="jumpstart-card">
          <XBtn />
          <div className="jumpstart-done-emoji"><Icon name="leaf" size={56} style={{color:"var(--teal-dark)"}} /></div>
          <div className="jumpstart-done-title">You made it up.</div>
          <div className="jumpstart-done-body">
            That's all it took — six small things. Your battery is already{" "}
            <strong style={{ color:"var(--teal-dark)" }}>+{totalBoost}%</strong> higher.
            The hardest part of the day is already behind you.
          </div>
          <button className="jumpstart-close-btn" onClick={onClose}>Continue to my day →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="jumpstart-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="jumpstart-card">
        <XBtn />
        <div className="jumpstart-progress">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`jumpstart-dot${i < stepIdx ? " done" : i === stepIdx ? " active" : ""}`} />
          ))}
        </div>
        <div className="jumpstart-eyebrow">Jumpstart · step {stepIdx + 1} of {STEPS.length}</div>
        <div className="jumpstart-emoji" key={stepIdx}><Icon name={step.icon} size={52} style={{color:"var(--teal-dark)"}} /></div>
        <div className="jumpstart-title" key={`t${stepIdx}`}>{step.title}</div>
        <div className="jumpstart-instruction" key={`i${stepIdx}`}>{step.instruction}</div>
        {boostFlash !== null && (
          <div className="jumpstart-boost-flash">+{boostFlash}% 🔋</div>
        )}
        <button className="jumpstart-done-btn" onClick={handleDone} disabled={advancing}>Done ✓</button>
        <button className="jumpstart-skip-btn" onClick={onClose}>Exit jumpstart</button>
      </div>
    </div>
  );
}

function RestTransitionView({ onContinue }) {
  return (
    <div className="readiness-card" style={{ textAlign:"center", maxWidth:480, margin:"0 auto" }}>
      <div style={{ marginBottom:20 }}><Icon name="cloud" size={48} style={{color:"var(--focus-blue)",opacity:0.6}} /></div>
      <div className="readiness-title" style={{ marginBottom:12 }}>Full permission to do nothing.</div>
      <div className="readiness-subtitle" style={{ marginBottom:8 }}>Today, rest is the whole plan.</div>
      <div style={{ fontSize:14, color:"var(--ink-mute)", lineHeight:1.7, marginBottom:32 }}>
        Not low energy. Not a slow day. A full stop. Your nervous system asked for this — and that's worth honoring.
      </div>
      <button className="btn-primary" onClick={onContinue}>Enter hibernate →</button>
    </div>
  );
}

function RestModeView({ uid, saveJournalEntry, deleteJournalEntry, onSwitchFull }) {
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState(false);
  function save() {
    if (!prompt.trim()) return;
    if (uid && saveJournalEntry) saveJournalEntry(uid, { text: prompt, createdAt: new Date().toISOString() }).catch(() => {});
    setSaved(true);
  }

  const suggestions = [
    "Lie down without your phone.",
    "Drink a full glass of water.",
    "Open a window. Just breathe.",
    "Watch something you've already seen.",
    "Let someone know you're resting today.",
    "Eat something warm and slow.",
    "Close your eyes for ten minutes.",
    "Do exactly nothing, on purpose.",
  ];

  return (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"0 16px" }}>
      <div style={{ marginBottom:28, paddingBottom:16, borderBottom:"1px solid var(--warm)" }}>
        <div className="readiness-eyebrow" style={{ color:"var(--focus-blue)", display:"flex", alignItems:"center", gap:6 }}><Icon name="cloud" size={14} />Hibernating</div>
        <div style={{ fontSize:20, fontFamily:"'Playfair Display',serif", color:"var(--ink)", marginTop:6 }}>No tasks today. That's the plan.</div>
      </div>

      <div className="panel-card" style={{ marginBottom:20 }}>
        <div className="panel-title" style={{ marginBottom:4 }}>Instead, you might…</div>
        <div style={{ fontSize:12, color:"var(--ink-mute)", marginBottom:16 }}>No pressure. These aren't tasks.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderTop: i === 0 ? "none" : "1px solid var(--warm)" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>·</span>
              <span style={{ fontSize:14, color:"var(--ink-soft)", lineHeight:1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-card" style={{ marginBottom:20 }}>
        <div className="panel-title" style={{ marginBottom:12 }}>Anything you want to put down?</div>
        {saved ? (
          <div style={{ fontSize:14, color:"var(--teal-dark)", padding:"10px 0", display:"flex", alignItems:"center", gap:6 }}>Held. Rest now.<Icon name="leaf" size={14} /></div>
        ) : (
          <>
            <textarea
              style={{ width:"100%", minHeight:80, background:"var(--cream)", border:"1px solid var(--warm)", borderRadius:"var(--radius-sm)", padding:"10px 12px", fontFamily:"inherit", fontSize:14, color:"var(--ink)", resize:"vertical", boxSizing:"border-box" }}
              placeholder="Thoughts, feelings, whatever's on your mind… just to get it out."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
            <button className="btn-primary" style={{ marginTop:10 }} onClick={save} disabled={!prompt.trim()}>Put it down</button>
          </>
        )}
      </div>

      <div style={{ marginTop:28, textAlign:"center" }}>
        <button
          onClick={onSwitchFull}
          style={{ background:"none", border:"none", color:"var(--ink-mute)", fontSize:13, cursor:"pointer", textDecoration:"underline" }}
        >
          Actually, I have some capacity — switch to tasks
        </button>
      </div>
    </div>
  );
}

// ─── Battery Suggestion Engine ────────────────────────────────────────────────
function suggestActionBasedOnBattery(battery, tasks) {
  const actionable = tasks.filter(t => !t.done && t.energyImpact !== undefined);
  if (battery < 30) {
    const suggestions = actionable.filter(t => t.energyImpact > 0)
      .sort((a, b) => b.energyImpact - a.energyImpact).slice(0, 3);
    return suggestions.length ? { type:"recharge", suggestions } : null;
  }
  if (battery > 70) {
    const suggestions = actionable.filter(t => t.energyImpact < 0)
      .sort((a, b) => a.energyImpact - b.energyImpact).slice(0, 3);
    return suggestions.length ? { type:"powerUse", suggestions } : null;
  }
  return null;
}

// ─── AI Coach Panel ───────────────────────────────────────────────────────────
// Extracts a numbered task list from AI response text
function ScheduleGeneratorMode({ battery, tasks, energyMap, userProfile, callScheduleGenerator, onAddTasks }) {
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [schedule,   setSchedule]   = useState(null); // { tasks, summary, energyProjection } | { error }
  const [added,      setAdded]      = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 100); }, []);

  async function generate() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setSchedule(null);
    setAdded(false);
    try {
      const ctx = {
        battery,
        role:          userProfile?.profile?.id || "General",
        date:          new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" }),
        energyMap,
        existingTasks: tasks.slice(0, 15).map(t => ({ name: t.name, bucket: t.bucket, duration: t.duration })),
      };
      const result = await callScheduleGenerator({ input: input.trim(), context: ctx });
      setSchedule(result);
    } catch {
      setSchedule({ error: "Something went wrong generating your schedule. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleAddAll() {
    if (!schedule?.tasks?.length) return;
    onAddTasks(schedule.tasks.map(t => ({
      id:           Date.now() + Math.random(),
      name:         t.name,
      bucket:       t.bucket || "should",
      energyImpact: t.energyImpact ?? -10,
      duration:     t.duration  ?? 30,
      done:         false,
      dueDate:      null,
      subtasks:     (t.subtasks || []).map(s => ({ id: Date.now() + Math.random(), name: s, done: false })),
    })));
    setAdded(true);
  }

  function fmt24(t) {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "pm" : "am";
    return `${h % 12 || 12}:${String(m).padStart(2,"0")}${ampm}`;
  }

  const EXAMPLES = [
    "Class at 10am for 1.5 hours, gym after for an hour, then 2 hours studying algorithms",
    "Morning standup at 9, deep work session until lunch, errands in the afternoon",
    "I need to finish my essay, do laundry, call my mom, and study for Friday's quiz",
  ];

  if (loading) return (
    <div className="sched-loading">
      <div className="sched-loading-dots"><span/><span/><span/></div>
      Building your schedule…
    </div>
  );

  if (schedule?.error) return (
    <div className="sched-input-area">
      <div style={{ background:"rgba(196,114,106,0.08)", border:"1px solid rgba(196,114,106,0.2)", borderRadius:12, padding:"12px 14px", fontSize:13, color:"var(--error)", fontFamily:"'DM Sans',sans-serif" }}>
        {schedule.error}
      </div>
      <button className="sched-generate-btn" onClick={() => { setSchedule(null); setTimeout(() => textareaRef.current?.focus(), 100); }}>Try again</button>
    </div>
  );

  if (schedule?.tasks) return (
    <>
      <div className="sched-preview">
        <div className="sched-summary">{schedule.summary}</div>
        <div className="sched-task-list">
          {schedule.tasks.map((t, i) => (
            <div key={i} className={`sched-task-card ${t.bucket}`}>
              <div className="sched-task-top">
                <span className="sched-task-name">{t.name}</span>
                {(t.startTime || t.endTime) && (
                  <span className="sched-task-time">{fmt24(t.startTime)}{t.endTime ? ` – ${fmt24(t.endTime)}` : ""}</span>
                )}
              </div>
              <div className="sched-task-meta">
                <span className={`sched-tag bucket-${t.bucket}`}>{t.bucket}</span>
                {t.duration && <span className="sched-tag duration"><Icon name="timer" size={9} />{t.duration < 60 ? `${t.duration}m` : `${Math.floor(t.duration/60)}h${t.duration%60?` ${t.duration%60}m`:""}`}</span>}
                {t.energyImpact !== undefined && (
                  <span className={`sched-tag ${t.energyImpact >= 0 ? "energy-charge" : "energy-drain"}`}>
                    <Icon name={t.energyImpact >= 0 ? "bolt" : "battery"} size={9} />
                    {t.energyImpact > 0 ? `+${t.energyImpact}` : t.energyImpact}
                  </span>
                )}
              </div>
              {t.subtasks?.length > 0 && (
                <div className="sched-subtasks">
                  {t.subtasks.map((s, si) => <div key={si} className="sched-subtask">{s}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="sched-footer">
        <div className="sched-projection">
          After: <strong>{Math.max(0, Math.min(100, schedule.energyProjection ?? battery))}%</strong>
        </div>
        {added
          ? <div style={{ flex:3, textAlign:"center", fontSize:13, color:"var(--teal-dark)", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Icon name="check-circle" size={14} />Added to your tasks</div>
          : <>
              <button className="sched-retry" onClick={() => { setSchedule(null); setTimeout(() => textareaRef.current?.focus(), 100); }}>Edit</button>
              <button className="sched-add-all" onClick={handleAddAll}>Add all to my day</button>
            </>
        }
      </div>
    </>
  );

  return (
    <div className="sched-input-area">
      <textarea
        ref={textareaRef}
        className="sched-textarea"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && e.metaKey) generate(); }}
        placeholder={"Describe your day — tasks, times, anything on your mind…\n\ne.g. \"Class at 10, gym after, 2 hrs studying tonight\""}
      />
      <div className="sched-hint">
        <strong>Try:</strong> {EXAMPLES[Math.floor(Date.now() / 86400000) % EXAMPLES.length]}
      </div>
      <button className="sched-generate-btn" onClick={generate} disabled={!input.trim()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
        </svg>
        Generate my schedule
      </button>
    </div>
  );
}

function parseTasksFromReply(text) {
  // Match: "1. **Bold title:**" or "1. **Bold title**" or "1. Plain title:"
  const boldMatches = [...text.matchAll(/\d+\.\s+\*\*([^*:\n]+)[*:]/g)];
  if (boldMatches.length >= 2) return boldMatches.map(m => m[1].trim());
  // Match plain numbered list: "1. Something here"
  const plainMatches = [...text.matchAll(/^\d+\.\s+(.+)$/gm)];
  if (plainMatches.length >= 2) return plainMatches.map(m => m[1].replace(/\*\*/g, "").split(":")[0].trim());
  return null;
}

function AICoachPanel({ battery, tasks = [], energyMap, callAI, onClose, onAddTasks, callScheduleGenerator, userProfile }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hey! I'm your energy coach 🌿 I know your current battery level and tasks. What can I help you with?" }
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState("chat"); // "chat" | "plan"
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg = { role: "user", text: trimmed };
    const nextHistory = [...history, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const ctx = {
        battery,
        tasks: tasks.slice(0, 20).map(t => ({ name: t.name, done: t.done || false, priority: t.priority || null })),
        energyMap,
        date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      };
      const result = await callAI({ message: trimmed, context: ctx, history: nextHistory.slice(-10) });
      const reply = result?.reply || "Sorry, I couldn't connect. Try again in a moment.";
      const suggested = parseTasksFromReply(reply);
      const asstMsg = { role: "assistant", text: reply, suggestedTasks: suggested, tasksAdded: false };
      setMessages(prev => [...prev, asstMsg]);
      setHistory([...nextHistory, { role: "assistant", text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Something went wrong connecting to the AI. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleAddTasks(msgIdx, taskList) {
    // Try to find the user message just before this AI response to use as parent task name
    const prevUserMsg = messages.slice(0, msgIdx).reverse().find(m => m.role === "user");
    const parentName = prevUserMsg?.text?.length < 80 ? prevUserMsg.text : null;
    onAddTasks?.(taskList, parentName);
    setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, tasksAdded: true } : m));
  }

  function dismissTasks(msgIdx) {
    setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, tasksAdded: "dismissed" } : m));
  }

  const chips = [
    "What should I focus on right now?",
    "I'm feeling overwhelmed — help me",
    "Break down a task for me",
    "Plan my day around my energy",
  ];
  const showChips = messages.length <= 1;
  const tierLabel = battery < BATTERY_THRESHOLDS.CRITICAL ? "Critical" : battery < BATTERY_THRESHOLDS.LOW ? "Low" : battery < BATTERY_THRESHOLDS.GOOD ? "Medium" : "High";

  return (
    <div className="ai-panel-overlay" onClick={onClose}>
      <div className="ai-panel" onClick={e => e.stopPropagation()}>
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <BatteryMascot level={battery} size={20} />
            AI Coach
          </div>
          <div className="sched-mode-toggle">
            <button className={`sched-mode-btn${mode==="chat"?" active":""}`} onClick={() => setMode("chat")}>Chat</button>
            {callScheduleGenerator && <button className={`sched-mode-btn${mode==="plan"?" active":""}`} onClick={() => setMode("plan")}>Plan my day</button>}
          </div>
          <button className="ai-panel-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {mode === "plan" && callScheduleGenerator ? (
          <ScheduleGeneratorMode
            battery={battery}
            tasks={tasks}
            energyMap={energyMap}
            userProfile={userProfile}
            callScheduleGenerator={callScheduleGenerator}
            onAddTasks={taskObjs => onAddTasks?.(null, null, taskObjs)}
          />
        ) : (
          <>
            <div className="ai-panel-messages">
              {messages.map((m, i) => (
                <div key={i}>
                  <div className={`ai-message ai-message-${m.role}`}>{m.text}</div>
                  {m.role === "assistant" && m.suggestedTasks && m.tasksAdded === false && (
                    <div className="ai-add-tasks-card">
                      <div className="ai-add-tasks-label">Want to add these to your tasks?</div>
                      <div className="ai-add-tasks-list">
                        {m.suggestedTasks.map((t, ti) => (
                          <div key={ti} className="ai-add-tasks-item">
                            <span className="ai-add-tasks-dot" />
                            <span>{t}</span>
                          </div>
                        ))}
                      </div>
                      <div className="ai-add-tasks-actions">
                        <button className="ai-add-tasks-yes" onClick={() => handleAddTasks(i, m.suggestedTasks)}>
                          <Icon name="check-circle" size={13} style={{ marginRight:5 }} />Yes, add them
                        </button>
                        <button className="ai-add-tasks-no" onClick={() => dismissTasks(i)}>No thanks</button>
                      </div>
                    </div>
                  )}
                  {m.role === "assistant" && m.suggestedTasks && m.tasksAdded === true && (
                    <div className="ai-add-tasks-done">
                      <Icon name="check-circle" size={13} style={{ marginRight:5, color:"var(--teal-dark)" }} />
                      Added {m.suggestedTasks.length} tasks to your list
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="ai-message ai-message-assistant ai-message-loading">
                  <span /><span /><span />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {showChips && (
              <div className="ai-chips">
                {chips.map(c => (
                  <button key={c} className="ai-chip" onClick={() => send(c)}>{c}</button>
                ))}
              </div>
            )}
            <div className="ai-panel-input-row">
              <input
                ref={inputRef}
                className="ai-panel-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Ask your coach…"
                disabled={loading}
              />
              <button className="ai-send-btn" onClick={() => send(input)} disabled={loading || !input.trim()} aria-label="Send">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── AI Breakdown Card ────────────────────────────────────────────────────────
function AIBreakdownCard({ items, onAddOne, onAddAll, onDismiss, onRetry, taskName }) {
  const [added, setAdded] = useState(new Set());
  const isError = items.length === 1 && (items[0].startsWith("Couldn't") || items[0].startsWith("Something went wrong"));

  function handleAddOne(name, i) {
    onAddOne(name);
    setAdded(prev => new Set([...prev, i]));
  }

  return (
    <div className="ai-breakdown-card">
      <div className="ai-breakdown-header">
        <div className="ai-breakdown-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight:5, verticalAlign:"middle" }}>
            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
          </svg>
          AI breakdown{taskName ? ` — "${taskName.length > 28 ? taskName.slice(0,28)+"…" : taskName}"` : ""}
        </div>
        <button className="ai-breakdown-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>

      {isError ? (
        <div style={{ fontSize:13, color:"var(--ink-mute)", marginBottom:10 }}>{items[0]}</div>
      ) : (
        <div className="ai-breakdown-list">
          {items.map((name, i) => (
            <div key={i} className="ai-breakdown-item">
              <span className="ai-breakdown-item-name">{name}</span>
              <button
                className={`ai-breakdown-add-one${added.has(i) ? " added" : ""}`}
                onClick={() => !added.has(i) && handleAddOne(name, i)}
                disabled={added.has(i)}
              >{added.has(i) ? "added ✓" : "+ add"}</button>
            </div>
          ))}
        </div>
      )}

      <div className="ai-breakdown-footer">
        {isError
          ? <button className="ai-breakdown-add-all" onClick={onRetry}>Try again</button>
          : <button className="ai-breakdown-add-all" onClick={onAddAll}>Add all subtasks</button>
        }
        <button className="ai-breakdown-retry" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

// ─── Battery Panel Component ──────────────────────────────────────────────────
function BatteryMascot({ level = 100, size = 44, mood = null }) {
  // mood overrides: "sleeping" | "celebrate" | "thinking" | null (auto from level)
  const tier = mood || (level < BATTERY_THRESHOLDS.CRITICAL ? "critical" : level < BATTERY_THRESHOLDS.LOW ? "low" : level < BATTERY_THRESHOLDS.GOOD ? "med" : "high");
  const fillColor = level < BATTERY_THRESHOLDS.CRITICAL ? "#d94f4f" : level < BATTERY_THRESHOLDS.MID ? "#c8903a" : "#5a7a5a";
  const clipId = "bm-fill-" + tier;

  // SVG coordinate space: 40 wide, 54 tall
  const bX = 1, bY = 9, bW = 38, bH = 43, bRx = 8;
  const fillH = Math.max(0, bH * level / 100);
  const fillY = bY + bH - fillH;
  const eyeY = bY + 12, mouthY = bY + 20;
  const eyeLx = 12, eyeRx = 28;

  // 4-pointed sparkle star helper
  function Sparkle({ cx, cy, r }) {
    const d = `M${cx},${cy-r} L${cx+r*.28},${cy-r*.28} L${cx+r},${cy} L${cx+r*.28},${cy+r*.28} L${cx},${cy+r} L${cx-r*.28},${cy+r*.28} L${cx-r},${cy} L${cx-r*.28},${cy-r*.28} Z`;
    return <path d={d} fill="#333" />;
  }

  return (
    <svg aria-hidden="true"
      width={size}
      height={Math.round(size * 54 / 40)}
      viewBox="0 0 40 54"
      fill="none"
      style={{ overflow: "visible", flexShrink: 0, transition: "opacity 0.3s" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={bX} y={bY} width={bW} height={bH} rx={bRx} />
        </clipPath>
      </defs>

      {/* Nub */}
      <rect x="14" y="1" width="12" height="9" rx="3" fill="#888" />
      {/* Body */}
      <rect x={bX} y={bY} width={bW} height={bH} rx={bRx} fill="#fafafa" stroke="#3d3d3d" strokeWidth="2.2" />
      {/* Energy fill */}
      <rect x={bX} y={fillY} width={bW} height={fillH} fill={fillColor} opacity="0.22" clipPath={`url(#${clipId})`} />
      {level > 3 && <line x1={bX + 2} y1={fillY} x2={bX + bW - 2} y2={fillY} stroke={fillColor} strokeWidth="2" opacity="0.5" clipPath={`url(#${clipId})`} />}

      {/* ── Arms down (tiers that don't draw their own arms) ── */}
      {(tier === "critical" || tier === "low" || tier === "med" || tier === "thinking") && <>
        <line x1={bX}      y1={bY + 20} x2={bX - 6}  y2={bY + 30} stroke="#3d3d3d" strokeWidth="2.2" strokeLinecap="round" />
        <line x1={bX + bW} y1={bY + 20} x2={bX+bW+6} y2={bY + 30} stroke="#3d3d3d" strokeWidth="2.2" strokeLinecap="round" />
      </>}

      {/* ── CRITICAL: droopy half-eyes + frown + stress lines ── */}
      {tier === "critical" && (
        <>
          {/* Stress lines top-left */}
          <line x1="7"  y1={bY+1} x2="7"  y2={bY+7} stroke="#333" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="10" y1={bY+1} x2="10" y2={bY+8} stroke="#333" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="13" y1={bY+2} x2="13" y2={bY+7} stroke="#333" strokeWidth="1.6" strokeLinecap="round" />
          {/* Droopy half-circle eyes */}
          <path d={`M${eyeLx-4.5},${eyeY} A4.5,4.5 0 0,1 ${eyeLx+4.5},${eyeY} Z`} fill="#333" />
          <path d={`M${eyeRx-4.5},${eyeY} A4.5,4.5 0 0,1 ${eyeRx+4.5},${eyeY} Z`} fill="#333" />
          {/* Frown */}
          <path d={`M14,${mouthY+5} Q20,${mouthY} 26,${mouthY+5}`} stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* ── LOW: small dot eyes + flat filled rectangle mouth ── */}
      {tier === "low" && (
        <>
          <circle cx={eyeLx} cy={eyeY} r="3.5" fill="#333" />
          <circle cx={eyeRx} cy={eyeY} r="3.5" fill="#333" />
          {/* Grimace rectangle */}
          <rect x="13" y={mouthY - 2} width="14" height="5" rx="1.5" fill="white" stroke="#333" strokeWidth="1.8" />
        </>
      )}

      {/* ── MED: happy squint arc eyes + small smile ── */}
      {tier === "med" && (
        <>
          {/* Upward arc eyes = happy squint */}
          <path d={`M${eyeLx-4.5},${eyeY+1} Q${eyeLx},${eyeY-4} ${eyeLx+4.5},${eyeY+1}`} stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d={`M${eyeRx-4.5},${eyeY+1} Q${eyeRx},${eyeY-4} ${eyeRx+4.5},${eyeY+1}`} stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d={`M14,${mouthY} Q20,${mouthY+4} 26,${mouthY}`} stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* ── HIGH: wide open mouth + sparkle stars + arm ── */}
      {tier === "high" && (
        <>
          <circle cx={eyeLx} cy={eyeY} r="4.5" fill="#333" />
          <circle cx={eyeRx} cy={eyeY} r="4.5" fill="#333" />
          <circle cx={eyeLx + 1.2} cy={eyeY - 1.2} r="1.5" fill="white" />
          <circle cx={eyeRx + 1.2} cy={eyeY - 1.2} r="1.5" fill="white" />
          <path d={`M11,${mouthY} L29,${mouthY} C29,${mouthY+13} 11,${mouthY+13} 11,${mouthY} Z`} fill="#333" />
          <line x1={bX}      y1={bY + 18} x2={bX - 7}      y2={bY + 9} stroke="#3d3d3d" strokeWidth="2.2" strokeLinecap="round" />
          <line x1={bX + bW} y1={bY + 18} x2={bX + bW + 7} y2={bY + 9} stroke="#3d3d3d" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}

      {/* ── SLEEPING: closed eyes (arcs down) + Zzz ── */}
      {tier === "sleeping" && (
        <>
          {/* Arms drooped extra low */}
          <line x1={bX} y1={bY+22} x2={bX-5} y2={bY+34} stroke="#3d3d3d" strokeWidth="2.2" strokeLinecap="round" />
          <line x1={bX+bW} y1={bY+22} x2={bX+bW+5} y2={bY+34} stroke="#3d3d3d" strokeWidth="2.2" strokeLinecap="round" />
          {/* Closed arc eyes (downward = shut) */}
          <path d={`M${eyeLx-4},${eyeY-1} Q${eyeLx},${eyeY+3.5} ${eyeLx+4},${eyeY-1}`} stroke="#333" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d={`M${eyeRx-4},${eyeY-1} Q${eyeRx},${eyeY+3.5} ${eyeRx+4},${eyeY-1}`} stroke="#333" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          {/* Flat sleepy mouth */}
          <line x1="15" y1={mouthY+2} x2="25" y2={mouthY+2} stroke="#333" strokeWidth="1.8" strokeLinecap="round" />
          {/* Z z z floating text */}
          <text x="30" y={bY+4} fontSize="5.5" fill="#888" fontFamily="sans-serif" fontWeight="bold">Z</text>
          <text x="33" y={bY} fontSize="4.5" fill="#aaa" fontFamily="sans-serif" fontWeight="bold">z</text>
        </>
      )}


      {/* ── THINKING: eyes up-left + thought bubble ── */}
      {tier === "thinking" && (
        <>
          {/* Arms down */}
          <line x1={bX}      y1={bY+20} x2={bX-6}      y2={bY+30} stroke="#3d3d3d" strokeWidth="2.2" strokeLinecap="round" />
          <line x1={bX+bW}   y1={bY+20} x2={bX+bW+6}   y2={bY+30} stroke="#3d3d3d" strokeWidth="2.2" strokeLinecap="round" />
          {/* Eyes shifted up-left */}
          <circle cx={eyeLx-1} cy={eyeY-2} r="3.5" fill="#333" />
          <circle cx={eyeRx-1} cy={eyeY-2} r="3.5" fill="#333" />
          <circle cx={eyeLx}   cy={eyeY-3} r="1.2" fill="white" />
          <circle cx={eyeRx}   cy={eyeY-3} r="1.2" fill="white" />
          {/* Slight smile */}
          <path d={`M15,${mouthY+1} Q20,${mouthY+4} 25,${mouthY+1}`} stroke="#333" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          {/* Thought bubble */}
          <circle cx="33" cy={bY+3}  r="3.5" fill="none" stroke="#aaa" strokeWidth="1.2" />
          <circle cx="31" cy={bY+8}  r="2"   fill="none" stroke="#aaa" strokeWidth="1" />
          <circle cx="30" cy={bY+12} r="1.2" fill="#aaa" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

function BatteryPanel({ battery, onBatteryChange, charging = false, darkMode = false, minimal = false, mascotSize = 44 }) {
  const trackRef   = useRef(null);
  const isDragging = useRef(false);
  const [localVal, setLocalVal] = useState(battery);

  const colorFor  = v => v < BATTERY_THRESHOLDS.CRITICAL ? "var(--error)" : v < BATTERY_THRESHOLDS.MID ? "var(--slate-dark)" : "var(--teal-dark)";
  const fillFor   = v => v < BATTERY_THRESHOLDS.CRITICAL ? "var(--error)" : v < BATTERY_THRESHOLDS.MID ? (darkMode ? "linear-gradient(90deg,#c4906a,#d4a57a)" : "linear-gradient(90deg,#b8813e,#c4906a)") : (darkMode ? "linear-gradient(90deg,#3ecfb0,#1f9e8a)" : "linear-gradient(90deg,#4a9e8e,#1f7a68)");
  const pctClrFor = v => v < BATTERY_THRESHOLDS.CRITICAL ? "var(--error)" : v < BATTERY_THRESHOLDS.MID ? "var(--slate-dark)" : "var(--ink)";
  const statusFor = v => {
    if (v < BATTERY_THRESHOLDS.CRITICAL) return "Rest is productive. Be gentle with yourself.";
    if (v < BATTERY_THRESHOLDS.MID)      return "Running on less — take what you need.";
    if (v < BATTERY_THRESHOLDS.FULL)     return "You've got what you need for today.";
    return "Fully charged. Use it well.";
  };
  const iconFor = v => v < BATTERY_THRESHOLDS.MID ? "battery" : "bolt";

  // Sync external battery prop → local display value (when not dragging)
  useEffect(() => { if (!isDragging.current) setLocalVal(battery); }, [battery]);

  function valFromPointer(e) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return localVal;
    return Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100 / 5) * 5));
  }

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    const v = valFromPointer(e);
    setLocalVal(v);
    haptic.light();
  }

  function handlePointerMove(e) {
    if (!isDragging.current) return;
    setLocalVal(valFromPointer(e));
  }

  function handlePointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    haptic.light();
    onBatteryChange(localVal);
  }

  return (
    <div className="battery-panel">
      {!minimal && <div className="battery-panel-label">Energy Battery</div>}
      <div className={charging ? "battery-panel-wrap charging" : "battery-panel-wrap"} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", margin: minimal ? "0 0 12px" : "10px 0 12px" }}>
        <div>
          <div className="battery-panel-pct" style={{ color: pctClrFor(localVal) }}>{localVal}%</div>
          {!minimal && <div className="battery-panel-status">{statusFor(localVal)}</div>}
        </div>
        <BatteryMascot level={localVal} size={mascotSize} />
      </div>
      <div
        className="battery-shape-outer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div ref={trackRef} className="battery-body">
          <div className="battery-panel-fill" style={{ width:`${localVal}%`, background:fillFor(localVal) }} />
        </div>
        <div className="battery-nub" style={{ background: colorFor(localVal) }} />
      </div>
    </div>
  );
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
    logClientError(error, { componentStack: info.componentStack?.slice(0, 1000) });
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--ink-soft)" }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>Something went wrong in this section.</div>
          <button
            style={{ background: "none", border: "1px solid var(--teal-light)", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13 }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Stern Mode modals ────────────────────────────────────────────────────────
const STERN_STRATEGIES = [
  { icon: "⚡", label: "5-minute sprint",        sub: "Set a timer. Just start. Momentum follows." },
  { icon: "📄", label: "Open it & do one thing", sub: "One sentence, one click, one line." },
  { icon: "🧱", label: "Low-effort draft",        sub: "Messy is fine. Done beats perfect." },
];
const STERN_EMOTIONS = ["Energized", "Relieved", "Proud", "Calm", "Surprised"];

function SternPreTaskModal({ task, onSelect, onDismiss }) {
  return (
    <div className="stern-modal-overlay" onClick={onDismiss}>
      <div className="stern-modal" onClick={e => e.stopPropagation()}>
        <div className="stern-modal-eyebrow">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Stern Mode — Action plan
        </div>
        <div className="stern-modal-title">How do you plan to get this done?</div>
        <div className="stern-modal-task">↳ {task.name}</div>
        <div className="stern-chips">
          {STERN_STRATEGIES.map(s => (
            <button key={s.label} className="stern-chip" onClick={() => onSelect(s.label)}>
              <span className="stern-chip-icon">{s.icon}</span>
              <span>
                <div className="stern-chip-label">{s.label}</div>
                <div className="stern-chip-sub">{s.sub}</div>
              </span>
            </button>
          ))}
        </div>
        <button className="stern-modal-dismiss" onClick={onDismiss}>Not right now</button>
      </div>
    </div>
  );
}

function SternPostTaskModal({ task, onClose }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="stern-modal-overlay">
      <div className="stern-modal">
        <div className="stern-win-confetti">🎯</div>
        <div className="stern-modal-eyebrow">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Win logged
        </div>
        <div className="stern-modal-title">Nice. You followed through.</div>
        <div className="stern-modal-task">✓ {task.name}</div>
        <div style={{ fontSize:13, color:"var(--ink-soft)", marginBottom:16, lineHeight:1.6 }}>
          Lock in the win. How did it feel to cross this off?
        </div>
        <div className="stern-emotions">
          {STERN_EMOTIONS.map(e => (
            <button
              key={e}
              className={`stern-emotion-tag${selected === e ? " selected" : ""}`}
              onClick={() => setSelected(e)}
            >{e}</button>
          ))}
        </div>
        <button className="stern-modal-cta" onClick={onClose}>
          {selected ? `${selected}. Keep the momentum. →` : "Close"}
        </button>
      </div>
    </div>
  );
}

// ─── Brain Dump Modal ─────────────────────────────────────────────────────────
function LogEnergyModal({ battery, onSave, onClose }) {
  const [val, setVal] = useState(battery);
  const colorFor = v => v < BATTERY_THRESHOLDS.CRITICAL ? "var(--error)" : v < BATTERY_THRESHOLDS.MID ? "var(--slate-dark)" : "var(--teal-dark)";

  const FEELINGS = [
    { value:  5, mood:"sleeping", label:"Depleted", hint:"Running on empty",           max: 15 },
    { value: 20, mood: null,      label:"Very Low",  hint:"Struggling today",           max: 32 },
    { value: 45, mood: null,      label:"Low",       hint:"Going through the motions",  max: 58 },
    { value: 65, mood: null,      label:"Okay",      hint:"Steady and managing",        max: 78 },
    { value: 90, mood: null,      label:"High",      hint:"In the zone — use it well",  max:100 },
  ];
  const feeling = FEELINGS.find(f => val <= f.max) || FEELINGS[FEELINGS.length - 1];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:360 }}>
        <div className="modal-title">Log your energy</div>
        <div className="modal-body" style={{ marginBottom:16 }}>How are you feeling right now?</div>

        {/* Mascot + percentage display */}
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
            <BatteryMascot level={val} size={72} mood={val <= 8 ? "sleeping" : null} />
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:44, color:colorFor(val), lineHeight:1 }}>
            {val}<span style={{ fontSize:20 }}>%</span>
          </div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"var(--ink-mute)", marginTop:6, textTransform:"uppercase", letterSpacing:"0.8px" }}>
            {feeling.label}
          </div>
          <div style={{ fontSize:12, color:"var(--ink-mute)", marginTop:4 }}>
            {feeling.hint}
          </div>
        </div>

        {/* Slider */}
        <input
          type="range" min="0" max="100" value={val}
          onChange={e => setVal(Number(e.target.value))}
          style={{ width:"100%", marginBottom:20, accentColor:colorFor(val), cursor:"pointer" }}
        />

        {/* Mascot quick-select row */}
        <div style={{ display:"flex", gap:6, marginBottom:24, justifyContent:"center", alignItems:"flex-end" }}>
          {FEELINGS.map(f => {
            const active = feeling.label === f.label;
            return (
              <button aria-label={`${f.label} — ${f.hint}`} key={f.label} onClick={() => setVal(f.value)} title={`${f.label} — ${f.hint}`}
                style={{
                  display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                  padding:"6px 8px", borderRadius:10, cursor:"pointer", transition:"all 0.15s", border:"none", background:"transparent",
                  transform: active ? "scale(1.18)" : "scale(1)",
                  outline: active ? `2px solid ${colorFor(f.value)}` : "2px solid transparent",
                  outlineOffset: 2,
                }}>
                <BatteryMascot level={f.value} size={32} mood={f.mood} />
              </button>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ padding:"11px 22px" }} onClick={() => { onSave(val); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// Freeze the page behind an open sheet. Without this, dragging on the backdrop (or the keyboard
// nudging the page) scrolls the screen underneath and leaves it shifted when the sheet closes.
function useBodyScrollLock() {
  useEffect(() => {
    const y = window.scrollY;
    const b = document.body.style;
    const prev = { position: b.position, top: b.top, width: b.width };
    b.position = "fixed"; b.top = `-${y}px`; b.width = "100%";
    return () => {
      b.position = prev.position; b.top = prev.top; b.width = prev.width;
      window.scrollTo(0, y);
    };
  }, []);
}

function BrainDumpModal({ onClose, callAI, onAddTasks }) {
  useBodyScrollLock();
  const [text, setText]       = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAI() {
    if (!text.trim() || !callAI) return;
    setLoading(true);
    try {
      const result = await callAI({
        message: `The user did a brain dump of everything on their mind. Parse it into a clean list of actionable tasks. Return ONLY a valid JSON array of short task name strings (no explanations, no markdown). Each task should be under 60 characters. Brain dump: "${text.trim()}"`,
        context: {},
      });
      const match = (result?.reply || "").match(/\[[\s\S]*\]/);
      if (match) {
        const tasks = JSON.parse(match[0]);
        if (Array.isArray(tasks) && tasks.length) { onAddTasks(tasks.map(String)); return; }
      }
    } catch {}
    setLoading(false);
  }

  function handleSave() {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length) onAddTasks(lines);
  }

  return (
    <div className="bdump-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bdump-sheet">
        <div className="bdump-header">
          <div>
            <div className="bdump-title">Brain Dump</div>
            <div className="bdump-sub">Get everything out of your head.</div>
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"var(--ink-mute)", lineHeight:1 }}>×</button>
        </div>
        <textarea
          className="bdump-textarea"
          placeholder="Write everything on your mind — tasks, worries, ideas, reminders... anything."
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
        />
        <div className="bdump-actions">
          <button className="bdump-btn-save" onClick={handleSave} disabled={!text.trim()}>
            Save as tasks
          </button>
          {callAI && (
            <button className="bdump-btn-ai" onClick={handleAI} disabled={!text.trim() || loading}>
              {loading
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{animation:"spin 1s linear infinite"}}><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity=".3"/><path d="M12 2v4a8 8 0 0 1 8 8h4A12 12 0 0 0 12 2z"/></svg>Organising…</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2.5l1.8 5.4 5.4 1.8-5.4 1.8-1.8 5.4-1.8-5.4-5.4-1.8 5.4-1.8z"/><path d="M5.5 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>Organise with AI</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Node View ────────────────────────────────────────────────────────────────
// Filler prefixes to strip from the start of each task chunk
const NLP_STRIP = /^(i need to|i should|i have to|i must|i want to|i've got to|i gotta|need to|have to|must|should|remember to|don't forget to|dont forget to|make sure to|make sure|be sure to|go and|go to and|please)\s+/i;

function parseTasksNLP(raw) {
  // 1. Split on hard breaks: newlines, semicolons, "•", "-" at line start
  const hardChunks = raw.split(/[\n;]|(?:^|\n)\s*[-•]\s*/m);

  const tasks = [];
  for (const chunk of hardChunks) {
    // 2. Split each chunk on soft conjunctions
    const softChunks = chunk.split(/\s+(?:and also|and then|and|also|then|plus|as well as|in addition|additionally)\s+/i);
    for (const raw of softChunks) {
      let t = raw.trim();
      if (!t) continue;
      // 3. Strip trailing punctuation
      t = t.replace(/[.!?,]+$/, "").trim();
      // 4. Strip leading filler phrases (run twice to catch stacked ones)
      t = t.replace(NLP_STRIP, "").replace(NLP_STRIP, "").trim();
      // 5. Capitalize first letter
      t = t.charAt(0).toUpperCase() + t.slice(1);
      // 6. Truncate to 80 chars at a word boundary
      if (t.length > 80) t = t.slice(0, 77).replace(/\s+\S*$/, "") + "…";
      if (t.length >= 3) tasks.push(t);
    }
  }
  return tasks;
}

function NodeView({ tasks, onAddTasks, onToggleTask, onDeleteTask, isPro, onOpenPaywall, callAI, routines, setRoutines, onCompleteRoutine, onUncompleteRoutine }) {
  const [text, setText]       = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);

  const activeTasks = tasks.filter(t => !t.done);

  function handleAdd() {
    if (!text.trim()) return;
    const parsed = parseTasksNLP(text);
    if (parsed.length) { onAddTasks(parsed); setText(""); }
  }

  const taskCount = parseTasksNLP(text).length;

  return (
    <div className="node-view">
      <div className="node-header">
        <div className="node-view-title">Routines</div>
        {routines !== undefined && <button className="node-add-link" onClick={() => setShowAddRoutine(s => !s)}>+ Add</button>}
      </div>

      {routines !== undefined && <RoutineSection routines={routines} setRoutines={setRoutines} onComplete={onCompleteRoutine} onUncomplete={onUncompleteRoutine} showAdd={showAddRoutine} setShowAdd={setShowAddRoutine} />}

      <div className="plain-label">Brain dump</div>
      <div className="node-capture">
        <textarea
          className="node-textarea"
          placeholder={"What's on your mind? One task per line."}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
        />
        <div className="node-actions">
          <button className="node-btn-add" onClick={handleAdd} disabled={!text.trim()}>
            {taskCount > 1 ? `Add ${taskCount} tasks` : "Add task"}
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────
function AddTaskModal({
  newTask, setNewTask,
  newBucket, setNewBucket,
  newPriority, setNewPriority,
  newDueDate, setNewDueDate,
  newDuration, setNewDuration,
  impactMode, setImpactMode,
  impactIntensity, setImpactIntensity,
  newTaskDesc, setNewTaskDesc,
  newTaskTime, setNewTaskTime,
  newTaskTags, setNewTaskTags,
  newTagInput, setNewTagInput,
  showTagInput, setShowTagInput,
  newTaskSubtasks, setNewTaskSubtasks,
  newSubtaskInput, setNewSubtaskInput,
  onAdd, onClose, callAI, battery,
  aiBreakdown, setAiBreakdown, aiBreakdownLoading, breakdownTask,
  AIBreakdownCard, addSubtask, addAllSubtasks,
  isEditing = false,
  newRecurrence, setNewRecurrence,
}) {
  useBodyScrollLock();
  const priority = newBucket || "should";

  function handleOverlayClick(e) { if (e.target === e.currentTarget) onClose(); }

  function commitTag() {
    const v = newTagInput.trim();
    if (v && !newTaskTags.includes(v)) setNewTaskTags(prev => [...prev, v]);
    setNewTagInput(""); setShowTagInput(false);
  }

  function commitSubtask() {
    const v = newSubtaskInput.trim();
    if (v) setNewTaskSubtasks(prev => [...prev, { id: Date.now() + Math.random(), name: v, done: false }]);
    setNewSubtaskInput("");
  }

  return (
    <div className="atm-overlay" onClick={handleOverlayClick}>
      <div className="atm-sheet">
        <div className="atm-handle" />
        <div className="atm-header">
          <button className="atm-hbtn" onClick={onClose} aria-label="Cancel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <span className="atm-title">{isEditing ? "Edit Task" : "Add New Task"}</span>
          <button className="atm-hbtn" onClick={onAdd} aria-label="Save" style={{ background: newTask.trim() ? "var(--teal-dark)" : "var(--warm)", color: newTask.trim() ? "white" : "var(--ink-mute)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>

        <div className="atm-body">
          {/* Title */}
          <div>
            <div className="atm-field-label">Task Title</div>
            <input
              className="atm-input"
              placeholder="What needs doing?"
              value={newTask}
              autoFocus
              onChange={e => { setNewTask(e.target.value); if (aiBreakdown) setAiBreakdown(null); }}
              onKeyDown={e => e.key === "Enter" && newTask.trim() && onAdd()}
            />
          </div>

          {/* Description */}
          <div>
            <div className="atm-field-label">Description</div>
            <textarea
              className="atm-input atm-textarea"
              placeholder="Add details or context…"
              value={newTaskDesc}
              onChange={e => setNewTaskDesc(e.target.value)}
            />
          </div>

          {/* Subtasks */}
          <div>
            <div className="atm-field-label">Subtasks</div>
            {newTaskSubtasks.length > 0 && (
              <div className="subtask-section" style={{ marginBottom:8 }}>
                {newTaskSubtasks.map((s, i) => (
                  <div key={s.id} className="subtask-item">
                    <div className="subtask-check" style={{ cursor:"default" }} />
                    <span className="subtask-name">{s.name}</span>
                    <button aria-label="Delete subtask"
                      className="subtask-del"
                      style={{ color:"var(--ink-mute)" }}
                      onClick={() => setNewTaskSubtasks(prev => prev.filter((_, j) => j !== i))}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="subtask-add-row">
              <input
                className="subtask-add-input"
                placeholder="Add a subtask…"
                value={newSubtaskInput}
                onChange={e => setNewSubtaskInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitSubtask(); }}
              />
              <button className="subtask-add-confirm" onClick={commitSubtask}>Add</button>
            </div>
          </div>

          {/* Due Date & Time */}
          <div>
            <div className="atm-field-label">Due Date &amp; time</div>
            <div className="atm-datetime-row">
              <div className="atm-datetime-field">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <input type="date" value={newDueDate} min={new Date().toLocaleDateString("en-CA")} onChange={e => setNewDueDate(e.target.value)} />
              </div>
              <div className="atm-datetime-field">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <input type="time" value={newTaskTime} onChange={e => setNewTaskTime(e.target.value)} placeholder="10:00 AM" />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div>
            <div className="atm-field-label">Priority</div>
            <div className="atm-priority-row">
              {[["must","Must"],["should","Should"],["could","Could"]].map(([val, label]) => (
                <button
                  key={val}
                  className={`atm-priority-btn ${val === "must" ? "high" : val === "should" ? "medium" : "low"}${priority === val ? " active" : ""}`}
                  onClick={() => setNewBucket(val)}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Urgency (separate from bucket) */}
          <div>
            <div className="atm-field-label">Urgency</div>
            <div className="atm-urgency-row">
              {[
                { val:"urgent", label:"🔴 Urgent" },
                { val:"high",   label:"🟠 High"   },
                { val:"normal", label:"⚪ Normal"  },
                { val:"low",    label:"🔵 Low"     },
              ].map(({ val, label }) => (
                <button key={val} type="button"
                  className={`atm-urgency-btn ${val}${(newPriority||"normal") === val ? " active" : ""}`}
                  onClick={() => setNewPriority(val)}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <div className="atm-field-label">Duration</div>
            <select
              className="atm-input"
              value={newDuration}
              onChange={e => setNewDuration(Number(e.target.value))}
              style={{ cursor: "pointer" }}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
              <option value={240}>4 hours</option>
            </select>
          </div>

          {/* Repeat */}
          <div>
            <div className="atm-field-label">Repeat</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[["","None"],["daily","Daily"],["weekdays","Weekdays"],["weekly","Weekly"]].map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => setNewRecurrence(val)}
                  style={{ minHeight:44, padding:"8px 16px", borderRadius:40, border:`1.5px solid ${newRecurrence===val?"var(--teal-dark)":"var(--warm)"}`, background:newRecurrence===val?"var(--teal-dark)":"var(--cream)", color:newRecurrence===val?"white":"var(--ink-soft)", fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:"pointer", transition:"all 0.15s" }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div>
            <div className="atm-field-label">Energy Impact</div>
            <div className="atm-energy-row">
              <button type="button" className={`impact-toggle drain ${impactMode==="drain"?"active":""}`} onClick={() => setImpactMode("drain")}><Icon name="battery" size={13} style={{marginRight:4}} />Drains</button>
              <input type="range" className="impact-slider" min={5} max={100} step={5} value={impactIntensity} onChange={e => setImpactIntensity(Number(e.target.value))} style={{ flex:"1 1 80px", minWidth:60 }} />
              <button type="button" className={`impact-toggle charge ${impactMode==="charge"?"active":""}`} onClick={() => setImpactMode("charge")}><Icon name="bolt" size={13} style={{marginRight:4}} />Charges</button>
              <span style={{ fontSize:11, color:"var(--ink-mute)", fontFamily:"'DM Mono',monospace", minWidth:28 }}>{impactMode==="drain"?"-":"+"}{impactIntensity}</span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="atm-field-label">Tags</div>
            <div className="atm-tags-wrap">
              {newTaskTags.map(tag => (
                <span key={tag} className="atm-tag">
                  {tag}
                  <button aria-label="Remove tag" className="atm-tag-remove" onClick={() => setNewTaskTags(prev => prev.filter(t => t !== tag))}>×</button>
                </span>
              ))}
              {showTagInput ? (
                <input
                  className="atm-tag-input"
                  autoFocus
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commitTag(); if (e.key === "Escape") { setShowTagInput(false); setNewTagInput(""); } }}
                  onBlur={commitTag}
                  placeholder="tag…"
                />
              ) : (
                <button className="atm-tag-add" onClick={() => setShowTagInput(true)}>
                  + Add
                </button>
              )}
            </div>
          </div>

          {/* AI breakdown */}
          {callAI && newTask.trim().length > 3 && (
            <button aria-label="Break this down with AI"
              type="button"
              className={`btn-ai-breakdown${aiBreakdownLoading?" spinning":""}`}
              onClick={breakdownTask}
              disabled={aiBreakdownLoading}
              style={{ alignSelf: "flex-start" }}
              title="Break this down with AI"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
                <path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/>
              </svg>
              {aiBreakdownLoading ? "Breaking down…" : "AI Breakdown"}
            </button>
          )}
          {aiBreakdown && (
            <AIBreakdownCard
              items={aiBreakdown}
              onAddOne={addSubtask}
              onAddAll={addAllSubtasks}
              onDismiss={() => setAiBreakdown(null)}
              onRetry={breakdownTask}
              taskName={newTask}
            />
          )}

          {/* Create button */}
          <button className="atm-create-btn" onClick={onAdd} disabled={!newTask.trim()}>
            {isEditing ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clock hook ───────────────────────────────────────────────────────────────
function useTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
function formatTime(d) {
  return d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
}

// ─── Daily Check-In ───────────────────────────────────────────────────────────
function suggestCopingSkill(nervousState, sleep, eaten, hydrated) {
  if (nervousState === "hyper") return {
    type: "hyper", name: "Box Breathing",
    desc: "Inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat 4–6 times to slow your nervous system down.",
  };
  if (nervousState === "hypo") return {
    type: "hypo", name: "5-4-3-2-1 Grounding",
    desc: "Name 5 things you can see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. Anchors you back to the present.",
  };
  if (sleep === "poor" || eaten === false || hydrated === false) return {
    type: "body", name: "Body Scan",
    desc: "Take 3 slow breaths. Notice how your body feels right now — without trying to fix anything.",
  };
  return null;
}

// ─── RoutineSection ───────────────────────────────────────────────────────────
function RoutineSection({ routines, setRoutines, onComplete, onUncomplete, showAdd, setShowAdd }) {
  const TODAY = new Date().toLocaleDateString("en-CA");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [newEnergy, setNewEnergy] = useState("medium");
  const [newSteps, setNewSteps] = useState([{ id: Date.now(), text: "" }]);
  const [newMinSteps, setNewMinSteps] = useState(1);
  const [newMinLabel, setNewMinLabel] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("");
  const [newTags, setNewTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newDays, setNewDays] = useState([]);
  const [editingReminderFor, setEditingReminderFor] = useState(null);
  const [editingTagsFor, setEditingTagsFor] = useState(null);
  const [inlineTagInput, setInlineTagInput] = useState("");
  const [editingId, setEditingId] = useState(null);

  // The floating + button sits on top of the form's Save/Cancel row on phones, so hide it while a form is open.
  const formOpen = !!showAdd || editingId != null;
  useEffect(() => {
    if (!formOpen) return;
    document.body.setAttribute("data-form-open", "");
    return () => document.body.removeAttribute("data-form-open");
  }, [formOpen]);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editEnergy, setEditEnergy] = useState("medium");
  const [editSteps, setEditSteps] = useState([]);
  const [editMinSteps, setEditMinSteps] = useState(1);
  const [editMinLabel, setEditMinLabel] = useState("");
  const [editTags, setEditTags] = useState([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editDays, setEditDays] = useState([]);
  const [editReminderTime, setEditReminderTime] = useState("");
  const DAYS = [
    {label:"M",value:1},{label:"T",value:2},{label:"W",value:3},
    {label:"T",value:4},{label:"F",value:5},{label:"S",value:6},{label:"S",value:0},
  ];
  const ENERGY_OPTS = [
    { value:"low",    label:"Low",    color:"var(--teal-dark)", drain:5  },
    { value:"medium", label:"Medium", color:"#c8903a",          drain:15 },
    { value:"high",   label:"High",   color:"var(--error)",     drain:25 },
  ];
  const COMPLETION_MSGS = [
    "You showed up. That's everything.",
    "Routine complete. Well done.",
    "Another day, another win.",
    "Consistency is its own reward.",
    "Look at you — showing up.",
  ];

  function saveRoutines(next) {
    setRoutines(next);
    localStorage.setItem("reflow-routines", JSON.stringify(next));
  }

  function toggleStep(routineId, stepId) {
    const next = routines.map(r => {
      if (r.id !== routineId) return r;
      const steps = r.steps.map(s => s.id !== stepId ? s : { ...s, done: !s.done });
      const doneCt = steps.filter(s => s.done).length;
      const threshold = r.minSteps ?? r.steps.length;
      const isNowComplete = doneCt >= threshold;
      const wasComplete = r.completedDate === TODAY;
      if (isNowComplete && !wasComplete) onComplete?.(r);
      if (!isNowComplete && wasComplete) onUncomplete?.(r);
      return { ...r, steps, completedDate: isNowComplete ? TODAY : null };
    });
    saveRoutines(next);
  }

  function addRoutine() {
    const steps = newSteps.filter(s => s.text.trim()).map(s => ({ id: s.id, text: s.text.trim(), done: false }));
    if (!newName.trim() || steps.length === 0) return;
    const r = {
      id: Date.now(),
      name: newName.trim(),
      emoji: newEmoji,
      energyCost: newEnergy,
      minSteps: Math.min(newMinSteps, steps.length),
      minLabel: newMinLabel.trim(),
      tags: newTags,
      days: newDays,
      reminderTime: newReminderTime || null,
      steps,
      completedDate: null,
    };
    saveRoutines([...routines, r]);
    setNewName(""); setNewEmoji(""); setNewEnergy("medium");
    setNewSteps([{ id: Date.now(), text: "" }]); setNewMinSteps(1);
    setNewMinLabel(""); setNewReminderTime(""); setNewTags([]); setNewTagInput(""); setNewDays([]); setShowAdd(false);
  }

  function deleteRoutine(id) {
    saveRoutines(routines.filter(r => r.id !== id));
  }

  function setReminder(id, time) {
    saveRoutines(routines.map(r => r.id !== id ? r : { ...r, reminderTime: time || null }));
    setEditingReminderFor(null);
  }

  function addStep() {
    setNewSteps(prev => [...prev, { id: Date.now(), text: "" }]);
  }

  function updateStep(id, text) {
    setNewSteps(prev => prev.map(s => s.id !== id ? s : { ...s, text }));
  }

  function removeStep(id) {
    setNewSteps(prev => prev.filter(s => s.id !== id));
  }

  function startEdit(r) {
    setEditingId(r.id);
    setEditName(r.name);
    setEditEmoji(r.emoji || "");
    setEditEnergy(r.energyCost || "medium");
    setEditSteps(r.steps.map(s => ({ ...s })));
    setEditMinSteps(r.minSteps ?? 1);
    setEditMinLabel(r.minLabel || "");
    setEditTags([...(r.tags || [])]);
    setEditTagInput("");
    setEditDays([...(r.days || [])]);
    setEditReminderTime(r.reminderTime || "");
  }

  function saveEdit() {
    const steps = editSteps.filter(s => s.text.trim()).map(s => ({ id: s.id, text: s.text.trim(), done: s.done }));
    if (!editName.trim() || steps.length === 0) return;
    saveRoutines(routines.map(r => r.id !== editingId ? r : {
      ...r,
      name: editName.trim(),
      emoji: editEmoji,
      energyCost: editEnergy,
      minSteps: Math.min(editMinSteps, steps.length),
      minLabel: editMinLabel.trim(),
      tags: editTags,
      days: editDays,
      reminderTime: editReminderTime || null,
      steps,
    }));
    setEditingId(null);
  }

  useEffect(() => { scheduleHabitNotifsIos(routines); }, [routines]);

  useEffect(() => {
    if (_isNative()) return;
    let timer;
    function tick() {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const today = now.toLocaleDateString("en-CA");
      routines.forEach(r => {
        if (!r.reminderTime || r.reminderTime !== timeStr) return;
        if (r.days?.length && !r.days.map(Number).includes(now.getDay())) return;
        if (r.completedDate === today) return;
        _fireGentleNotif("MyBattery", `${r.emoji} ${r.name} — time for your routine.`);
      });
      const msToNext = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds() + 200;
      timer = setTimeout(tick, msToNext);
    }
    const msToNext = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds() + 200;
    timer = setTimeout(tick, msToNext);
    return () => clearTimeout(timer);
  }, [routines]);


  return (
    <div style={{ marginBottom:28 }}>
      {routines.length === 0 && !showAdd && (
        <div style={{ fontSize:14, color:"var(--ink-mute)", fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>
          Small steps you repeat, like meds or a morning routine.
        </div>
      )}

      {routines.map(r => {
        const doneCt = r.steps.filter(s => s.done).length;
        const threshold = r.minSteps ?? r.steps.length;
        const isComplete = r.completedDate === TODAY;
        const energyOpt = ENERGY_OPTS.find(e => e.value === r.energyCost) ?? ENERGY_OPTS[1];
        const msgIdx = r.id % COMPLETION_MSGS.length;
        const rDays = r.days ?? [];
        const todayDow = new Date().getDay();
        const isActiveToday = rDays.length === 0 || rDays.includes(todayDow);
        const toggleDay = (dow) => {
          const cur = rDays;
          const next = cur.includes(dow) ? cur.filter(d => d !== dow) : [...cur, dow];
          saveRoutines(routines.map(x => x.id !== r.id ? x : { ...x, days: next }));
        };
        return (
          <div key={r.id} style={{
            background: isComplete ? "rgba(90,122,90,0.08)" : "var(--card)",
            border: `1.5px solid ${isComplete ? "rgba(90,122,90,0.3)" : "transparent"}`,
            borderRadius:"var(--radius)", padding:"14px 16px", marginBottom:10,
            boxShadow:"0 2px 16px var(--glow)", transition:"background 0.3s, border-color 0.3s",
            opacity: isActiveToday ? 1 : 0.5,
          }}>
            {editingId === r.id ? (
              <div className="rt-form" style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Routine name"
                  style={{ border:"1.5px solid var(--warm)", borderRadius:8, padding:"8px 12px", fontSize:14, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Sans',sans-serif" }} />

                <div>
                  <div className="plain-label">Steps</div>
                  {editSteps.map((s, idx) => (
                    <div key={s.id} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                      <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", width:16, textAlign:"right", flexShrink:0 }}>{idx+1}.</span>
                      <input value={s.text} onChange={e => setEditSteps(prev => prev.map(x => x.id !== s.id ? x : { ...x, text: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && setEditSteps(prev => [...prev, { id: Date.now(), text: "", done: false }])}
                        style={{ flex:1, border:"1.5px solid var(--warm)", borderRadius:8, padding:"7px 10px", fontSize:13, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Sans',sans-serif" }} />
                      {editSteps.length > 1 && (
                        <button className="tap-slop tap-slop-lg" aria-label="Remove step" onClick={() => setEditSteps(prev => prev.filter(x => x.id !== s.id))} style={{ background:"none", border:"none", color:"var(--ink-mute)", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 2px" }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setEditSteps(prev => [...prev, { id: Date.now(), text: "", done: false }])} style={{ background:"none", border:"none", color:"var(--teal-dark)", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, padding:"4px 0" }}>+ Add step</button>
                </div>

                <div>
                  <div className="plain-label">Energy cost</div>
                  <div style={{ display:"flex", gap:6 }}>
                    {ENERGY_OPTS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setEditEnergy(opt.value)}
                        style={{ flex:1, padding:"8px 6px", borderRadius:40, border:`1.5px solid ${editEnergy===opt.value ? opt.color : "var(--warm)"}`, background: editEnergy===opt.value ? `${opt.color}1a` : "var(--cream)", color: editEnergy===opt.value ? opt.color : "var(--ink-soft)", fontFamily:"'DM Sans',sans-serif", fontSize:12, cursor:"pointer", transition:"all 0.15s" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="plain-label">
                    Days <span style={{ color:"var(--teal-dark)" }}>{editDays.length === 0 ? "(every day)" : `(${editDays.length} day${editDays.length !== 1 ? "s" : ""})`}</span>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    {DAYS.map(d => {
                      const sel = editDays.includes(d.value);
                      return (
                        <button key={d.value} type="button" onClick={() => setEditDays(prev => sel ? prev.filter(x => x !== d.value) : [...prev, d.value])}
                          style={{ flex:1, height:34, borderRadius:8, border:`1.5px solid ${sel ? "var(--teal-dark)" : "var(--warm)"}`, background: sel ? "rgba(90,122,90,0.15)" : "var(--cream)", color: sel ? "var(--teal-dark)" : "var(--ink-mute)", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  {editDays.length > 0 && (
                    <button type="button" onClick={() => setEditDays([])} style={{ background:"none", border:"none", color:"var(--ink-mute)", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", marginTop:6, padding:0 }}>Reset to every day</button>
                  )}
                </div>

                {editSteps.filter(s => s.text.trim()).length > 1 && (
                  <div>
                    <div className="plain-label">
                      Minimum to count as done <span style={{ color:"var(--teal-dark)" }}>({editMinSteps} of {editSteps.filter(s=>s.text.trim()).length} steps)</span>
                    </div>
                    <input type="range" min={1} max={editSteps.filter(s=>s.text.trim()).length} value={editMinSteps}
                      onChange={e => setEditMinSteps(Number(e.target.value))} style={{ width:"100%", accentColor:"var(--teal-dark)" }} />
                    {editMinSteps < editSteps.filter(s=>s.text.trim()).length && (
                      <input placeholder='Low-energy version name (optional)' value={editMinLabel} onChange={e => setEditMinLabel(e.target.value)}
                        style={{ width:"100%", border:"1.5px solid var(--warm)", borderRadius:8, padding:"7px 10px", fontSize:12, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Mono',monospace", marginTop:8, boxSizing:"border-box" }} />
                    )}
                  </div>
                )}

                <div>
                  <div className="plain-label">Reminder (optional)</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Icon name="bell" size={13} style={{ color:"var(--ink-mute)", flexShrink:0 }} />
                    <input type="time" value={editReminderTime} onChange={e => setEditReminderTime(e.target.value)}
                      style={{ border:"1.5px solid var(--warm)", borderRadius:8, padding:"7px 10px", fontSize:13, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Mono',monospace", flex:1 }} />
                    {editReminderTime && <button className="tap-slop" aria-label="Clear reminder time" type="button" onClick={() => setEditReminderTime("")} style={{ background:"none", border:"none", color:"var(--ink-mute)", cursor:"pointer", fontSize:14, lineHeight:1, padding:"0 2px" }}>×</button>}
                  </div>
                </div>

                <div>
                  <div className="plain-label">Tags (optional)</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                    {editTags.map(tag => (
                      <span key={tag} style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:0.5, padding:"2px 6px 2px 9px", borderRadius:20, background:"rgba(90,122,90,0.12)", color:"var(--teal-dark)", textTransform:"uppercase" }}>
                        {tag}
                        <button className="tap-slop" aria-label="Remove tag" type="button" onClick={() => setEditTags(prev => prev.filter(t => t !== tag))} style={{ background:"none", border:"none", cursor:"pointer", padding:0, lineHeight:1, color:"var(--teal-dark)", fontSize:12 }}>×</button>
                      </span>
                    ))}
                    <input value={editTagInput} onChange={e => setEditTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          const t = editTagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
                          if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t]);
                          setEditTagInput("");
                        }
                      }}
                      placeholder="type + Enter to add"
                      style={{ fontSize:12, fontFamily:"'DM Mono',monospace", border:"1.5px solid var(--warm)", borderRadius:8, padding:"5px 10px", background:"var(--cream)", color:"var(--ink)", outline:"none", flex:1, minWidth:120 }} />
                  </div>
                </div>

                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={saveEdit} disabled={!editName.trim() || !editSteps.some(s => s.text.trim())}
                    style={{ flex:1, padding:"9px", background:"var(--teal-dark)", color:"white", border:"none", borderRadius:40, fontSize:13, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", fontWeight:500, opacity: (!editName.trim() || !editSteps.some(s => s.text.trim())) ? 0.5 : 1 }}>Save changes</button>
                  <button onClick={() => setEditingId(null)}
                    style={{ padding:"9px 16px", background:"var(--warm)", color:"var(--ink)", border:"none", borderRadius:40, fontSize:13, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{r.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600, color: isComplete ? "var(--teal-dark)" : "var(--ink)" }}>{r.name}</span>
                  {(r.tags || []).map(tag => (
                    <span key={tag} style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:0.5, padding:"1px 5px 1px 7px", borderRadius:20, background:"rgba(90,122,90,0.12)", color:"var(--teal-dark)", textTransform:"uppercase", flexShrink:0 }}>
                      {tag}
                    </span>
                  ))}
                </div>
                {isComplete && (
                  <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--teal-dark)", marginTop:2 }}>{COMPLETION_MSGS[msgIdx]}</div>
                )}
              </div>
              {isComplete && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg>}
              <button className="tap-slop tap-slop-lg" aria-label="Edit routine" onClick={() => startEdit(r)} title="Edit routine"
                style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", color:"var(--ink-mute)", flexShrink:0, display:"flex", alignItems:"center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              {editingReminderFor === r.id ? (
                <input type="time" defaultValue={r.reminderTime || ""} autoFocus
                  onBlur={e => setReminder(r.id, e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") setReminder(r.id, e.target.value); if (e.key === "Escape") setEditingReminderFor(null); }}
                  style={{ width:88, border:"1.5px solid var(--teal-light)", borderRadius:8, padding:"3px 6px", fontSize:12, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Mono',monospace" }} />
              ) : (
                <button className="tap-slop tap-slop-lg" aria-label={r.reminderTime ? `Reminder at ${r.reminderTime}` : "Set reminder"} onClick={() => setEditingReminderFor(r.id)} title={r.reminderTime ? `Reminder at ${r.reminderTime}` : "Set reminder"}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:"2px 4px", display:"flex", alignItems:"center", gap:3, color: r.reminderTime ? "var(--teal-dark)" : "var(--ink-mute)", flexShrink:0 }}>
                  <Icon name="bell" size={13} />
                  {r.reminderTime && <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace" }}>{r.reminderTime}</span>}
                </button>
              )}
              <button className="tap-slop tap-slop-lg" aria-label="Delete routine" onClick={() => deleteRoutine(r.id)} style={{ background:"none", border:"none", color:"var(--ink-mute)", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 2px", flexShrink:0 }}>×</button>
            </div>

            {r.steps.map((s, idx) => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderTop:"1px solid var(--warm)" }}>
                <button className="tap-slop tap-slop-lg" aria-label={s.done ? "Mark step not done" : "Mark step done"} onClick={() => isActiveToday && toggleStep(r.id, s.id)} style={{
                  width:20, height:20, borderRadius:"50%", border:"2px solid",
                  borderColor: s.done ? "var(--teal-dark)" : "var(--control-line)",
                  background: s.done ? "var(--teal-dark)" : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  cursor: isActiveToday ? "pointer" : "default", flexShrink:0, transition:"var(--transition)",
                }}>
                  {s.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
                <span style={{ fontSize:13, color: s.done ? "var(--ink-mute)" : "var(--ink)", textDecoration: s.done ? "line-through" : "none", fontFamily:"'DM Sans',sans-serif", flex:1 }}>{s.text}</span>
              </div>
            ))}

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8, paddingTop:8, borderTop:"1px solid var(--warm)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)" }}>
                  {isActiveToday ? (
                    <>{doneCt} of {r.steps.length}{threshold < r.steps.length && <span style={{ color:"var(--teal-dark)" }}> · min {threshold}{r.minLabel ? ` (${r.minLabel})` : ""}</span>}</>
                  ) : (
                    <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12 }}>Not today</span>
                  )}
                </div>
                <div style={{ display:"flex", gap:3 }}>
                  {DAYS.map(d => {
                    const active = rDays.length === 0 || rDays.includes(d.value);
                    const isToday = d.value === todayDow;
                    return (
                      <button className="tap-slop tap-slop-sm" aria-label={active ? "Remove this day" : "Add this day"} key={d.value} onClick={() => toggleDay(d.value)} title={active ? "Remove this day" : "Add this day"}
                        style={{
                          width:16, height:16, borderRadius:"50%", border:`1.5px solid ${active ? (isToday ? "var(--teal-dark)" : "var(--teal-light)") : "var(--ink-mute)"}`,
                          background: active ? (isToday ? "var(--teal-dark)" : "rgba(90,122,90,0.15)") : "transparent",
                          color: active ? (isToday ? "white" : "var(--teal-dark)") : "var(--ink-mute)",
                          fontSize:8, fontFamily:"'DM Mono',monospace", fontWeight:600,
                          cursor:"pointer", padding:0, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center",
                          transition:"all 0.15s",
                        }}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        );
      })}

      {showAdd && (
        <div className="rt-form" style={{ background:"var(--card)", borderRadius:"var(--radius)", padding:18, marginTop:8, display:"flex", flexDirection:"column", gap:12, boxShadow:"0 2px 16px var(--glow)" }}>
          <div className="plain-label" style={{ marginBottom:0 }}>New routine</div>

          <input placeholder="Routine name (e.g. Morning Ritual)" value={newName} onChange={e => setNewName(e.target.value)}
            style={{ border:"1.5px solid var(--warm)", borderRadius:8, padding:"8px 12px", fontSize:14, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Sans',sans-serif" }} />

          <div>
            <div className="plain-label">Steps</div>
            {newSteps.map((s, idx) => (
              <div key={s.id} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"var(--ink-mute)", width:16, textAlign:"right", flexShrink:0 }}>{idx+1}.</span>
                <input placeholder={`Step ${idx+1}`} value={s.text} onChange={e => updateStep(s.id, e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addStep()}
                  style={{ flex:1, border:"1.5px solid var(--warm)", borderRadius:8, padding:"7px 10px", fontSize:13, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Sans',sans-serif" }} />
                {newSteps.length > 1 && (
                  <button className="tap-slop tap-slop-lg" aria-label="Remove step" onClick={() => removeStep(s.id)} style={{ background:"none", border:"none", color:"var(--ink-mute)", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 2px" }}>×</button>
                )}
              </div>
            ))}
            <button onClick={addStep} style={{ background:"none", border:"none", color:"var(--teal-dark)", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:500, padding:"4px 0" }}>+ Add step</button>
          </div>

          <div>
            <div className="plain-label">Energy cost</div>
            <div style={{ display:"flex", gap:6 }}>
              {ENERGY_OPTS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setNewEnergy(opt.value)}
                  style={{ flex:1, padding:"8px 6px", borderRadius:40, border:`1.5px solid ${newEnergy===opt.value ? opt.color : "var(--warm)"}`, background: newEnergy===opt.value ? `${opt.color}1a` : "var(--cream)", color: newEnergy===opt.value ? opt.color : "var(--ink-soft)", fontFamily:"'DM Sans',sans-serif", fontSize:12, cursor:"pointer", transition:"all 0.15s" }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="plain-label">
              Days <span style={{ color:"var(--teal-dark)" }}>{newDays.length === 0 ? "(every day)" : `(${newDays.length} day${newDays.length !== 1 ? "s" : ""})`}</span>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {DAYS.map(d => {
                const sel = newDays.includes(d.value);
                return (
                  <button key={d.value} type="button"
                    onClick={() => setNewDays(prev => sel ? prev.filter(x => x !== d.value) : [...prev, d.value])}
                    style={{
                      flex:1, height:34, borderRadius:8,
                      border:`1.5px solid ${sel ? "var(--teal-dark)" : "var(--warm)"}`,
                      background: sel ? "rgba(90,122,90,0.15)" : "var(--cream)",
                      color: sel ? "var(--teal-dark)" : "var(--ink-mute)",
                      fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600,
                      cursor:"pointer", transition:"all 0.15s",
                    }}>
                    {d.label}
                  </button>
                );
              })}
            </div>
            {newDays.length > 0 && (
              <button type="button" onClick={() => setNewDays([])}
                style={{ background:"none", border:"none", color:"var(--ink-mute)", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", marginTop:6, padding:0 }}>
                Reset to every day
              </button>
            )}
          </div>

          {newSteps.filter(s => s.text.trim()).length > 1 && (
            <div>
              <div className="plain-label">
                Minimum to count as done <span style={{ color:"var(--teal-dark)" }}>({newMinSteps} of {newSteps.filter(s=>s.text.trim()).length} steps)</span>
              </div>
              <input type="range" min={1} max={newSteps.filter(s=>s.text.trim()).length} value={newMinSteps}
                onChange={e => setNewMinSteps(Number(e.target.value))}
                style={{ width:"100%", accentColor:"var(--teal-dark)" }} />
              {newMinSteps < newSteps.filter(s=>s.text.trim()).length && (
                <input placeholder='Low-energy version name (optional, e.g. "Bare minimum")'
                  value={newMinLabel} onChange={e => setNewMinLabel(e.target.value)}
                  style={{ width:"100%", border:"1.5px solid var(--warm)", borderRadius:8, padding:"7px 10px", fontSize:12, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Mono',monospace", marginTop:8, boxSizing:"border-box" }} />
              )}
            </div>
          )}

          <div>
            <div className="plain-label">Reminder (optional)</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Icon name="bell" size={13} style={{ color:"var(--ink-mute)", flexShrink:0 }} />
              <input type="time" value={newReminderTime} onChange={e => setNewReminderTime(e.target.value)}
                style={{ border:"1.5px solid var(--warm)", borderRadius:8, padding:"7px 10px", fontSize:13, background:"var(--cream)", color:"var(--ink)", outline:"none", fontFamily:"'DM Mono',monospace", flex:1 }} />
              {newReminderTime && <button className="tap-slop" aria-label="Clear reminder time" type="button" onClick={() => setNewReminderTime("")}
                style={{ background:"none", border:"none", color:"var(--ink-mute)", cursor:"pointer", fontSize:14, lineHeight:1, padding:"0 2px" }}>×</button>}
            </div>
          </div>

          <div>
            <div className="plain-label">Tags (optional)</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
              {newTags.map(tag => (
                <span key={tag} style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10, fontFamily:"'DM Mono',monospace", letterSpacing:0.5, padding:"2px 6px 2px 9px", borderRadius:20, background:"rgba(90,122,90,0.12)", color:"var(--teal-dark)", textTransform:"uppercase" }}>
                  {tag}
                  <button className="tap-slop" aria-label="Remove tag" type="button" onClick={() => setNewTags(prev => prev.filter(t => t !== tag))}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:0, lineHeight:1, color:"var(--teal-dark)", fontSize:12 }}>×</button>
                </span>
              ))}
              <input value={newTagInput} onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const t = newTagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
                    if (t && !newTags.includes(t)) setNewTags(prev => [...prev, t]);
                    setNewTagInput("");
                  }
                }}
                placeholder="type + Enter to add"
                style={{ fontSize:12, fontFamily:"'DM Mono',monospace", border:"1.5px solid var(--warm)", borderRadius:8, padding:"5px 10px", background:"var(--cream)", color:"var(--ink)", outline:"none", flex:1, minWidth:120 }} />
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={addRoutine} disabled={!newName.trim() || !newSteps.some(s => s.text.trim())}
              style={{ flex:1, padding:"9px", background:"var(--teal-dark)", color:"white", border:"none", borderRadius:40, fontSize:13, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", fontWeight:500, opacity: (!newName.trim() || !newSteps.some(s => s.text.trim())) ? 0.5 : 1 }}>Save routine</button>
            <button onClick={() => setShowAdd(false)}
              style={{ padding:"9px 16px", background:"var(--warm)", color:"var(--ink)", border:"none", borderRadius:40, fontSize:13, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App({ user, firebaseHelpers = {} }) {
  const {
    requestNotificationPermission, onForegroundMessage,
    requestNativePushToken, onNativePushTap, getIdToken,
    createAccount, signIn, signInGoogle, redirectError, signOutUser, resetPassword, friendlyAuthError,
    saveUserProfile, loadUserData, loadRecentDays,
    saveDailyRecord,
    saveJournalEntry, deleteJournalEntry,
    loadHistory,
    clearUserData,
    deleteAccount,
    saveRecurringEvents,
    subscribeActiveTasks,
    addTaskDoc,
    updateTaskDoc,
    deleteTaskDoc,
    callAI,
    callScheduleGenerator,
    callJoinWaitlist,
    saveCalendarDay,
    isPro: _isPro = false,
    packages = [],
    offeringsError,
    purchasePackage,
    restorePurchases,
    presentCustomerCenter,
    rcSignOut,
  } = firebaseHelpers;
  const isPro = _isPro;

  const uid  = user?.uid ?? null;
  const hasPasswordAuth = !!user?.providerData?.some(p => p.providerId === "password");
  const time = useTime();

  // Guest / beta mode: skip login, data lives only in localStorage
  // localStorage (not sessionStorage) so guest mode survives the app being closed on iOS
  const [guestMode, setGuestMode] = useState(() => {
    try { return localStorage.getItem("reflow-guest") === "true" || sessionStorage.getItem("reflow-guest") === "true"; } catch { return false; }
  });

  function enterGuestMode() {
    try { localStorage.setItem("reflow-guest", "true"); } catch {}
    setGuestMode(true);
  }
  function exitGuestMode() {
    try { localStorage.removeItem("reflow-guest"); sessionStorage.removeItem("reflow-guest"); } catch {}
    setGuestMode(false);
  }

  const [showPaywall,   setShowPaywall]   = useState(false);
  const [showWaitlist,  setShowWaitlist]  = useState(false);

  // Central paywall router: "customer-center" → App Store subscriptions page; anything else → paywall sheet
  function openPaywall(mode) {
    if (mode === "customer-center" && presentCustomerCenter) {
      presentCustomerCenter();
    } else {
      setShowPaywall(true);
    }
  }

  function getAiActionsThisMonth() {
    try {
      const stored = JSON.parse(localStorage.getItem("reflow-ai-actions") || "{}");
      const thisMonth = new Date().toISOString().slice(0, 7);
      if (stored.month !== thisMonth) return { count: 0, month: thisMonth };
      return stored;
    } catch {
      return { count: 0, month: new Date().toISOString().slice(0, 7) };
    }
  }
  function incrementAiAction() {
    const data = getAiActionsThisMonth();
    localStorage.setItem("reflow-ai-actions", JSON.stringify({ ...data, count: data.count + 1 }));
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {});
    }
  }, []);

  const [showBreathingOnStart, setShowBreathingOnStart] = useState(() => {
    const stored = localStorage.getItem("reflow-show-breathing");
    return stored === "true"; // opt-in: off unless the user turns it on
  });
  const [showBreathing, setShowBreathing] = useState(() => {
    const stored = localStorage.getItem("reflow-show-breathing");
    const pref = stored === "true";
    const breathedToday = localStorage.getItem("reflow-breathed-date") === new Date().toLocaleDateString("en-CA");
    return pref && !breathedToday;
  });
  const [showSOSModal,     setShowSOSModal]     = useState(false);
  const [controlTab,       setControlTab]       = useState("settings");
  const [paralysisTask,    setParalysisTask]    = useState(null);
  const [batteryCharging,  setBatteryCharging]  = useState(false);
  // Gamification
  const [checkinStreak,   setCheckinStreak]   = useState(() => {
    try { return parseInt(localStorage.getItem("reflow-checkin-streak") || "0", 10); } catch { return 0; }
  });
  const [earnedBadges,    setEarnedBadges]    = useState(() => {
    try { return JSON.parse(localStorage.getItem("reflow-badges") || "[]"); } catch { return []; }
  });
  // Routines (migrates from legacy habits on first load)
  const [routines, setRoutines] = useState(() => {
    const TODAY = new Date().toLocaleDateString("en-CA");
    try {
      const existing = localStorage.getItem("reflow-routines");
      if (existing) {
        return JSON.parse(existing).map(r => ({
          ...r,
          tags: r.tags ?? (r.tag === "habit" ? ["habit"] : []),
          days: r.days ?? [],
          steps: r.completedDate && r.completedDate !== TODAY
            ? r.steps.map(s => ({ ...s, done: false }))
            : r.steps,
          completedDate: r.completedDate === TODAY ? TODAY : null,
        }));
      }
      const legacyHabits = JSON.parse(localStorage.getItem("reflow-habits") || "[]");
      const migrated = legacyHabits.map(h => ({
        id: h.id,
        name: h.name,
        emoji: h.emoji || "✅",
        energyCost: "low",
        minSteps: 1,
        minLabel: "",
        tags: ["habit"],
        reminderTime: h.reminderTime || null,
        steps: [{ id: h.id + 1, text: h.name, done: !!h.log?.[TODAY] }],
        completedDate: h.log?.[TODAY] ? TODAY : null,
      }));
      if (migrated.length > 0) localStorage.setItem("reflow-routines", JSON.stringify(migrated));
      return migrated;
    } catch { return []; }
  });
  // Feature recommendation dismissals
  const [dismissedTips,   setDismissedTips]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("reflow-dismissed-tips") || "[]")); } catch { return new Set(); }
  });
  // Fumes banner
  const [fumesDismissed,  setFumesDismissed]  = useState(false);
  // Mascot override mood
  const [mascotMood,      setMascotMood]      = useState(null);
  const [view,        setView]        = useState(() => {
    if (localStorage.getItem("reflow-onboarded") !== "true") return "onboarding";
    const checkedInToday = localStorage.getItem("reflow-checkin-date") === new Date().toLocaleDateString("en-CA");
    return checkedInToday ? "circuit" : "readiness";
  });
  const [energy,      setEnergy]      = useState(null);
  const [mood,        setMood]        = useState(null);
  const [mlEmotion,       setMlEmotion]       = useState([]);
  const [mlBodyPart,      setMlBodyPart]      = useState([]);
  const [mlNeed,          setMlNeed]          = useState([]);
  const [mlEmotionCustom, setMlEmotionCustom] = useState("");
  const [mlBodyCustom,    setMlBodyCustom]    = useState("");
  const [mlNeedCustom,    setMlNeedCustom]    = useState("");
  const [intention,   setIntention]   = useState("");
  const [tasks,       setTasks]       = useState(() => (!user && guestMode) ? loadGuestTasks() : INITIAL_TASKS);
  const [sessionWins, setSessionWins] = useState([]); // tasks completed in this session
  const [newTask,        setNewTask]        = useState("");
  const [newBucket,      setNewBucket]      = useState("should");
  const [newPriority,    setNewPriority]    = useState("normal");
  const [newRecurrence,  setNewRecurrence]  = useState("");
  const [newDueDate,     setNewDueDate]     = useState("");
  const [newDuration,    setNewDuration]    = useState(30);
  const [impactMode,     setImpactMode]     = useState("drain");
  const [impactIntensity,setImpactIntensity]= useState(10);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  // On iPhone the sheet stops above the keyboard toolbar, and the fixed tab bar shows through the gap below it.
  useEffect(() => {
    if (!showAddTaskModal) return;
    document.body.setAttribute("data-sheet-open", "");
    return () => document.body.removeAttribute("data-sheet-open");
  }, [showAddTaskModal]);
  const [editingTaskId,    setEditingTaskId]    = useState(null);
  const [newTaskDesc,      setNewTaskDesc]      = useState("");
  const [newTaskTime,      setNewTaskTime]      = useState("");
  const [newTaskProject,   setNewTaskProject]   = useState("");
  const [newTaskTags,      setNewTaskTags]      = useState([]);
  const [newTagInput,      setNewTagInput]      = useState("");
  const [showTagInput,     setShowTagInput]     = useState(false);
  const [newTaskSubtasks,  setNewTaskSubtasks]  = useState([]);
  const [newSubtaskInput,  setNewSubtaskInput]  = useState("");
  const [fontScale,          setFontScale]          = useState(() => localStorage.getItem("reflow-font-scale") || "md");
  const [aiBreakdown,        setAiBreakdown]        = useState(null);   // null | string[]
  const [aiBreakdownLoading, setAiBreakdownLoading] = useState(false);
  const [battery,        setBattery]        = useState(() => {
    const today = new Date().toLocaleDateString("en-CA");
    if (localStorage.getItem("reflow-battery-date") !== today) {
      localStorage.setItem("reflow-battery-date", today);
      localStorage.setItem("reflow-battery", "100");
      return 100;
    }
    const s = localStorage.getItem("reflow-battery");
    return s ? Math.max(0, Math.min(100, Number(s))) : 100;
  });
  const [energyLog,      setEnergyLog]      = useState(() => { try { return JSON.parse(localStorage.getItem("reflow-energy-log") ?? "[]"); } catch { return []; } });
  const [energyMap,      setEnergyMap]      = useState(() => { try { return JSON.parse(localStorage.getItem("reflow-energy-map") ?? "null") || DEFAULT_ENERGY_MAP; } catch { return DEFAULT_ENERGY_MAP; } });
  const [weekStartDay, setWeekStartDay] = useState(() => {
    const s = localStorage.getItem("reflow-week-start-day");
    return s !== null ? Number(s) : 1; // default Monday
  });
  const [showWeekPlan, setShowWeekPlan] = useState(false);
  // On the user's week-start day, offer planning as a card on Circuit (not an automatic pop-up)
  const [weekPlanDue, setWeekPlanDue] = useState(() => {
    if (localStorage.getItem("reflow-onboarded") !== "true") return false;
    const storedDay = Number(localStorage.getItem("reflow-week-start-day") ?? "1");
    if (new Date().getDay() !== storedDay) return false;
    const todayStr = new Date().toLocaleDateString("en-CA");
    if (localStorage.getItem("reflow-week-plan-date") === todayStr) return false;
    if (localStorage.getItem("reflow-week-plan-dismissed") === todayStr) return false;
    return true;
  });
  const [toast,       setToast]       = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userPeak,    setUserPeak]    = useState(5);
  const [userRhythm,  setUserRhythm]  = useState("varied");
  const [shutdownDays, setShutdownDays] = useState(() => {
    try {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 8);
      const shutdowns = JSON.parse(localStorage.getItem("reflow-shutdown-days") || "[]");
      const checkins  = JSON.parse(localStorage.getItem("reflow-checkin-days")  || "[]");
      const merged    = [...new Set([...shutdowns, ...checkins])];
      return new Set(merged.filter(k => new Date(k) >= cutoff));
    } catch { return new Set(); }
  });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [gateCompletedDuringLoad, setGateCompletedDuringLoad] = useState(false);
  const [powerMode,   setPowerMode]   = useState(() => localStorage.getItem("reflow-power-mode")    === "true");
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem("reflow-privacy-mode") === "true");
  const [darkMode,    setDarkMode]    = useState(() => localStorage.getItem("reflow-dark-mode")    === "true");
  const [calPermission,   setCalPermission]   = useState("prompt"); // prompt | granted | denied
  const [calConnected,    setCalConnected]    = useState(() => localStorage.getItem("reflow-cal-connected") === "true");
  const [calEvents,       setCalEvents]       = useState([]);
  const [calLoading,      setCalLoading]      = useState(false);
  const [deviceCalCache,  setDeviceCalCache]  = useState({}); // dateKey → NativeEvent[] (30-day window)
  const [calDrainWarning, setCalDrainWarning] = useState(null);
  const [calDrainDismissed, setCalDrainDismissed] = useState(false);
  const [gentleMode,       setGentleMode]       = useState(() => localStorage.getItem("reflow-gentle-mode") === "true");
  const [sternMode,         setSternMode]         = useState(() => localStorage.getItem("reflow-stern-mode") === "true");
  const [sternPreTask,      setSternPreTask]      = useState(null);
  const [sternPostTask,     setSternPostTask]     = useState(null);
  const [sternSessionCount, setSternSessionCount] = useState(0);      // tasks completed this stern session
  const [sternBatteryAlert, setSternBatteryAlert] = useState(false);  // low-battery intervention shown
  const sternStartedRef     = useRef(new Set());
  const sternBatteryWarnRef = useRef(false);                          // fire the alert only once per session
  const [recurringEvents,  setRecurringEvents]  = useState([]);
  const [bodyCheck, setBodyCheck] = useState({ sleep:null, eaten:null, hydrated:null, feeling:null });
  const [showClearModal,  setShowClearModal]  = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTutorial,    setShowTutorial]    = useState(false);
  const [showAICoach,     setShowAICoach]     = useState(false);
  const [showFabMenu,     setShowFabMenu]     = useState(false);
  const [showBrainDump,   setShowBrainDump]   = useState(false);
  const [showJumpstart,   setShowJumpstart]   = useState(false);
  const [showLogEnergy,   setShowLogEnergy]   = useState(false);
  const [showCoach,       setShowCoach]       = useState(() => !localStorage.getItem("lf_coach_done"));
  const [selectedDate,    setSelectedDate]    = useState(() => new Date().toLocaleDateString("en-CA"));
  const [nudgeDismissed,        setNudgeDismissed]        = useState(false);
  const [wellnessPromptDismissed, setWellnessPromptDismissed] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // ── StatusBar theming (Capacitor iOS) ──────────────────────────────────────
  useEffect(() => {
    const sb = window.Capacitor?.Plugins?.StatusBar;
    if (!sb) return;
    sb.setStyle({ style: darkMode ? "DARK" : "LIGHT" }).catch(() => {});
    sb.setBackgroundColor({ color: darkMode ? "#121514" : "#f4f7f7" }).catch(() => {});
  }, [darkMode]);


  // "Welcome back" card — shown once, in-app only, the first time someone opens the app
  // after WELCOME_BACK_DAYS or more without logging. Deliberately says nothing about how long.
  const WELCOME_BACK_DAYS = 3;
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  function maybeShowWelcomeBack(days) {
    const t = days[0]?.updatedAt; // loadRecentDays is ordered by updatedAt desc
    const lastMs = t == null ? null
      : typeof t.toMillis === "function" ? t.toMillis()
      : new Date(t).getTime();
    if (!lastMs || Number.isNaN(lastMs)) return;
    if (Date.now() - lastMs < WELCOME_BACK_DAYS * 24 * 60 * 60 * 1000) return;
    // Remember which quiet stretch we've greeted so it's only shown once per return.
    const key = "reflow-welcome-back-shown-for";
    if (localStorage.getItem(key) === String(lastMs)) return;
    localStorage.setItem(key, String(lastMs));
    setShowWelcomeBack(true);
  }
  useEffect(() => {
    if (!showWelcomeBack) return;
    const t = setTimeout(() => setShowWelcomeBack(false), 5000);
    return () => clearTimeout(t);
  }, [showWelcomeBack]);

  // Backfill shutdownDays from Firestore when user signs in
  // Includes both morning check-in days (has energy field) and end-of-day shutdown days
  useEffect(() => {
    if (!uid || !loadRecentDays) return;
    loadRecentDays(uid, 8).then(days => {
      maybeShowWelcomeBack(days);
      const allActivityKeys = days.filter(d => d.shutdownComplete || d.energy).map(d => d.id);
      if (allActivityKeys.length === 0) return;
      setShutdownDays(prev => {
        const next = new Set([...prev, ...allActivityKeys]);
        localStorage.setItem("reflow-shutdown-days", JSON.stringify([...next]));
        return next;
      });
    }).catch(() => {});
  }, [uid]);

  // Real-time task subscription — syncs tasks from Firestore subcollection across all devices.
  // Replaces the old array-based saveTasks approach. Active tasks carry over to new days
  // automatically because we only query status === 'active'.
  useEffect(() => {
    setSessionWins([]);
    if (!uid || !subscribeActiveTasks) { setTasks(guestMode ? loadGuestTasks() : INITIAL_TASKS); return; }
    setTasks(INITIAL_TASKS);
    // Recurring tasks stay status:"active" once completed for today (see updateTaskDoc),
    // so a snapshot can still carry yesterday's done:true/lastDoneDate. Reset those here —
    // both locally and back to Firestore — the same way the guest-mode effect above does.
    const unsub = subscribeActiveTasks(uid, incoming => {
      const today = todayKey();
      incoming.forEach(t => {
        if (t.recurrence && t.done && t.lastDoneDate !== today) {
          updateTaskDoc(uid, String(t.id), { done: false, lastDoneDate: null, status: "active" }).catch(reportTaskSyncError);
        }
      });
      setTasks(incoming.map(t =>
        t.recurrence && t.done && t.lastDoneDate !== today
          ? { ...t, done: false, lastDoneDate: null }
          : t
      ));
    });
    return () => unsub();
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guests have no Firestore — keep their tasks on the device so they survive a relaunch.
  // Only while in guest mode, so a signed-in account's tasks are never copied here.
  useEffect(() => {
    if (uid || !guestMode) return;
    try { localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(tasks)); } catch {}
  }, [tasks, uid, guestMode]);

  // ── Widget sync (iOS App Groups) ─────────────────────────────────────────
  // Push task list to shared UserDefaults whenever tasks change. The widget reads
  // this container directly — no Firebase access from the extension.
  useEffect(() => {
    syncTasks(tasks);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push battery level to shared UserDefaults whenever it changes.
  useEffect(() => {
    syncEnergyLevel(battery);
  }, [battery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle mybattery:// deep links from widgets.
  // Two paths: cold-start (AppDelegate writes URL to pendingDeepLink in UserDefaults,
  // checked once on mount) and background→foreground (Capacitor App plugin fires appUrlOpen).
  function handleDeepLinkUrl(url) {
    if (!url?.startsWith("mybattery://")) return;
    try {
      const parsed = new URL(url);
      const path   = parsed.hostname;
      if (path === "log-energy") {
        const clamped = Math.max(0, Math.min(100, parseInt(parsed.searchParams.get("level") ?? "50", 10)));
        logEnergy(0, "Widget energy tap", "widget", clamped);
        setBattery(clamped);
        setToast({ type: "win", title: "Energy logged", msg: `Battery set to ${clamped}%` });
      } else if (path === "add-task") {
        setView("circuit");
        setShowAddTaskModal(true);
      } else if (path === "tasks") {
        setView("circuit");
      }
    } catch {}
  }

  // Notification links like "/?tab=wellness" (see functions/quietCheckin.js). On a cold open
  // the tab arrives in the URL; if the app is already open, the service worker posts it instead.
  function openTabFromLink(link) {
    try {
      const tab = new URL(link, window.location.origin).searchParams.get("tab");
      if (tab === "wellness" && localStorage.getItem("reflow-onboarded") === "true") setView("recharge");
    } catch {}
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("tab")) {
      openTabFromLink(window.location.href);
      params.delete("tab");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    }
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = e => { if (e.data?.type === "open-link") openTabFromLink(e.data.link); };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, []);

  // iPhone push: tapping a server notification opens its link (e.g. the Wellness tab).
  useEffect(() => {
    if (!_isNative() || !onNativePushTap) return;
    let off = () => {};
    onNativePushTap(data => { if (data?.link) openTabFromLink(data.link); }).then(fn => { off = fn; });
    return () => off();
  }, []);

  // iPhone push: once notifications are allowed, keep this device's token registered with the
  // server so it gets server-sent notifications (like the quiet check-in) without visiting Settings.
  useEffect(() => {
    if (!_isNative() || !uid || !requestNativePushToken || !getIdToken) return;
    (async () => {
      try {
        const ln = _localNotifs();
        const { display } = ln ? await ln.checkPermissions() : { display: "denied" };
        if (display !== "granted") return;
        const token = await requestNativePushToken();
        if (!token || localStorage.getItem("reflow-push-synced") === `${uid}:${token}`) return;
        const saved = JSON.parse(localStorage.getItem("mindfull-notif-prefs") || "null") || {};
        await syncPushPrefs(token, saved, getIdToken, uid);
      } catch {}
    })();
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cold-start: runs once on mount. Drains any pending widget energy logs and reads
  // the launch deep-link URL (written to UserDefaults by AppDelegate on cold launch).
  useEffect(() => {
    getPendingDeepLink().then(url => {
      if (!url) return;
      clearPendingDeepLink();
      handleDeepLinkUrl(url);
    });
    getEnergyLevel().then(level => { if (level >= 0) setBattery(level); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Background→foreground listener. Uses the imported CapacitorApp (not
  // window.Capacitor.Plugins.App, which is undefined without an explicit import).
  useEffect(() => {
    const handles = [];

    async function setup() {
      try {
        handles.push(await CapacitorApp.addListener("appUrlOpen", ({ url }) => handleDeepLinkUrl(url)));

        handles.push(await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) return;

          // Keep widget and app in sync — read the last level written by syncEnergyLevel.
          getEnergyLevel().then(level => {
            if (level >= 0) setBattery(level);
          });

          // Task title captured by QuickAddWidget
          getPendingTask().then(title => {
            if (!title) return;
            clearPendingTask();
            const t = { id: Date.now(), name: title, bucket: "could", done: false, energyImpact: -10, duration: 30, dueDate: null };
            if (uid && addTaskDoc) addTaskDoc(uid, t).catch(reportTaskSyncError);
            else setTasks(prev => [...prev, t]);
            setToast({ type: "win", title: "Task added", msg: `"${title}" is in your Could Do list.` });
          });
        }));
      } catch {}
    }

    setup();
    return () => { handles.forEach(h => h.remove()); };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  // ── End widget sync ───────────────────────────────────────────────────────

  // Load profile when user signs in
  useEffect(() => {
    if (!uid || !loadUserData) { setProfileLoaded(true); return; }
    setProfileLoaded(false);
    loadUserData(uid).then(data => {
      if (!data) { setProfileLoaded(true); return; }

      if (Array.isArray(data.recurringEvents)) setRecurringEvents(data.recurringEvents);

      // One-time migration: if old array-based tasks exist in the user document,
      // and addTaskDoc is available, migrate them to the new subcollection.
      // After migration the subscription will pick them up automatically.
      if (Array.isArray(data.tasks) && data.tasks.length > 0 && addTaskDoc) {
        Promise.all(
          data.tasks
            .filter(t => !t.done) // only migrate incomplete tasks
            .map(t => addTaskDoc(uid, t))
        ).catch(() => {});
      }

      if (data.profile) {
        setUserProfile(data.profile);
        setUserPeak(data.profile.peakCapacity ?? 5);
        setUserRhythm(data.profile.rhythm ?? "varied");
        if (data.profile.showBreathingOnStart !== undefined) {
          setShowBreathingOnStart(data.profile.showBreathingOnStart);
          if (!data.profile.showBreathingOnStart) setShowBreathing(false);
        }
        if (data.profile.tutorialSeen) {
          setShowCoach(false);
          localStorage.setItem("lf_coach_done", "1");
        }
        if (Array.isArray(data.profile.energyMap) && data.profile.energyMap.length > 0) {
          setEnergyMap(data.profile.energyMap);
          localStorage.setItem("reflow-energy-map", JSON.stringify(data.profile.energyMap));
        }
        if (Array.isArray(data.profile.dismissedTips) && data.profile.dismissedTips.length > 0) {
          const merged = new Set([...JSON.parse(localStorage.getItem("reflow-dismissed-tips") || "[]"), ...data.profile.dismissedTips]);
          setDismissedTips(merged);
          localStorage.setItem("reflow-dismissed-tips", JSON.stringify([...merged]));
        }
      }

      const checkedInToday = localStorage.getItem("reflow-checkin-date") === new Date().toLocaleDateString("en-CA");
      setView(checkedInToday ? "circuit" : "readiness");
      setProfileLoaded(true);
    }).catch(() => setProfileLoaded(true));
  }, [uid]);

  // On a new day: reset the check-in gate so the readiness screen shows again.
  // Tasks are no longer auto-cleared — they stay until explicitly deleted.
  useEffect(() => {
    const today = todayKey();
    const lastDay = localStorage.getItem("reflow-last-day");
    if (lastDay && lastDay !== today) {
      localStorage.removeItem("reflow-checkin-date");
      localStorage.removeItem("reflow-breathed-date");
    }
    localStorage.setItem("reflow-last-day", today);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset recurring tasks that were completed on a previous day
  useEffect(() => {
    const today = todayKey();
    setTasks(prev => {
      const hasStale = prev.some(t => t.recurrence && t.done && t.lastDoneDate !== today);
      if (!hasStale) return prev;
      return prev.map(t =>
        t.recurrence && t.done && t.lastDoneDate !== today
          ? { ...t, done: false, lastDoneDate: null }
          : t
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stern Mode: reset session counter + battery-warn flag each time the mode turns on
  useEffect(() => {
    if (sternMode) {
      setSternSessionCount(0);
      setSternBatteryAlert(false);
      sternBatteryWarnRef.current = false;
    }
  }, [sternMode]);

  // Stern Mode: battery guard — fires once when battery first drops below 30%
  useEffect(() => {
    if (sternMode && battery < 30 && !sternBatteryWarnRef.current) {
      sternBatteryWarnRef.current = true;
      setSternBatteryAlert(true);
    }
  }, [battery, sternMode]);

  useEffect(() => { localStorage.setItem("reflow-battery", String(battery)); }, [battery]);
  useEffect(() => {
    document.documentElement.setAttribute("data-battery-save", battery < 20 ? "true" : "false");
  }, [battery]);

  useEffect(() => {
    function onVisibility() {
      if (!document.hidden && calPermission === "granted" && calConnected) loadCalEvents();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [calPermission, calConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  // ── Calendar: check permission on mount, reload events when view = circuit ──
  useEffect(() => {
    calendarHelpers.checkPermission().then(p => {
      setCalPermission(p);
      if (p === "granted" && calConnected) loadCalEvents();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === "circuit" && calPermission === "granted" && calConnected) { setCalDrainDismissed(false); loadCalEvents(); }
  }, [view, calPermission, calConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleDeviceCalUpdated() { if (calPermission === "granted" && calConnected) loadCalEvents(); }
    window.addEventListener("reflow-device-calendar-updated", handleDeviceCalUpdated);
    return () => window.removeEventListener("reflow-device-calendar-updated", handleDeviceCalUpdated);
  }, [calPermission, calConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCalEvents() {
    setCalLoading(true);
    // Fetch the full 30-day window in one call; bucket results by dateKey for the CalendarView cache.
    const all = await calendarHelpers.get30DayEvents();
    const byDay = {};
    for (const ev of all) {
      const key = new Date(ev.startDate).toLocaleDateString("en-CA");
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(ev);
    }
    setDeviceCalCache(byDay);
    // Expose only today's slice to the Circuit Tab's CalendarEventsSection.
    const todayKey = new Date().toLocaleDateString("en-CA");
    const todayEvs = byDay[todayKey] || [];
    setCalEvents(todayEvs);
    setCalDrainWarning(scoreCalDensity(todayEvs));
    setCalLoading(false);
  }

  function scoreCalDensity(evs) {
    if (!evs || evs.length === 0) return null;
    let score = 0;
    const timed = evs.filter(ev => !ev.isAllDay && ev.startDate);
    const allDay = evs.filter(ev => ev.isAllDay);

    // All-day events
    score += allDay.length * 0.5;

    // Per timed event
    timed.forEach(ev => {
      score += 1;
      const durH = ((ev.endDate || ev.startDate + 3600000) - ev.startDate) / 3600000;
      score += durH * 0.5;
      const hour = new Date(ev.startDate).getHours();
      if (hour < 8 || hour >= 19) score += 0.5;
    });

    // Back-to-back penalty (< 15 min gap)
    const sorted = [...timed].sort((a, b) => a.startDate - b.startDate);
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i].startDate - (sorted[i-1].endDate || sorted[i-1].startDate + 3600000)) / 60000;
      if (gap >= 0 && gap < 15) score += 1;
    }

    if (score < 3) return null;
    const totalH = timed.reduce((s, ev) => s + ((ev.endDate || ev.startDate + 3600000) - ev.startDate) / 3600000, 0);
    const backToBack = sorted.filter((ev, i) => {
      if (i === 0) return false;
      const gap = (ev.startDate - (sorted[i-1].endDate || sorted[i-1].startDate + 3600000)) / 60000;
      return gap >= 0 && gap < 15;
    }).length;
    return { score: Math.round(score * 10) / 10, eventCount: timed.length + allDay.length, totalHours: Math.round(totalH * 10) / 10, backToBack };
  }

  async function handleRequestCalPermission() {
    if (calPermission === "granted") {
      // OS permission already held — just re-enable the in-app connection without re-prompting.
      setCalConnected(true);
      localStorage.setItem("reflow-cal-connected", "true");
      setCalDrainDismissed(false);
      loadCalEvents();
      return;
    }
    const result = await calendarHelpers.requestAccess();
    setCalPermission(result);
    if (result === "granted") {
      setCalConnected(true);
      localStorage.setItem("reflow-cal-connected", "true");
      setCalDrainDismissed(false);
      loadCalEvents();
    }
  }

  function handleUnsyncCalendar() {
    setCalConnected(false);
    localStorage.setItem("reflow-cal-connected", "false");
    setCalEvents([]);
    setDeviceCalCache({});
    setCalDrainWarning(null);
  }

  async function handleResyncCalendar() {
    await loadCalEvents();
  }

  // XP float helper
  function awardXP() {}

  function updateStreak() {
    // streaks removed — no-op kept so call sites don't error
  }

  function awardBadge(id) {
    if (!id || earnedBadges.includes(id)) return;
    const next = [...earnedBadges, id];
    setEarnedBadges(next);
    localStorage.setItem("reflow-badges", JSON.stringify(next));
  }

  // Task reminder scheduler — fires when a task's reminderTime matches current time
  useEffect(() => {
    if (_isNative()) return;
    let timer;
    function tick() {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const today = now.toLocaleDateString("en-CA");
      tasks.forEach(t => {
        if (!t.reminderTime || t.reminderTime !== timeStr) return;
        if (t.done) return;
        if (t.dueDate && t.dueDate !== today) return;
        _fireGentleNotif("MyBattery", `⏰ ${t.name}`);
      });
      const msToNext = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds() + 200;
      timer = setTimeout(tick, msToNext);
    }
    const msToNext = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds() + 200;
    timer = setTimeout(tick, msToNext);
    return () => clearTimeout(timer);
  }, [tasks]);

  // Route foreground FCM push notifications to the correct tab
  useEffect(() => {
    if (!onForegroundMessage) return;
    const unsub = onForegroundMessage((payload) => {
      const screen = payload?.data?.screen;
      const map = { node: "node", circuit: "circuit", recharge: "recharge", control: "control" };
      if (map[screen]) setView(map[screen]);
    });
    return () => { try { unsub?.(); } catch {} };
  }, [onForegroundMessage]);

  const counts = deriveTaskCounts(userProfile, userPeak, userRhythm);

  const ENERGY_LEVELS = [
    { id:"high",      label:"High Focus",       desc:"Deep work ready, creative bandwidth available", icon:"bolt",  taskCount:counts.high },
    { id:"med",       label:"Maintenance Mode", desc:"Steady capacity, prefer structured tasks",       icon:"sun",   taskCount:counts.med  },
    { id:"low",       label:"Rest Mode",        desc:"Low reserves, light tasks only — go easy",       icon:"moon",  taskCount:counts.low  },
    { id:"hibernate", label:"Hibernating",      desc:"No tasks today. Full permission to do nothing.", icon:"cloud", taskCount:0           },
  ];

  const selected = ENERGY_LEVELS.find(e => e.id === energy);

  const todayStr = new Date().toLocaleDateString("en-CA");
  const visibleTasks = tasks.filter(t => {
    if (selectedDate === todayStr) return !t.dueDate || t.dueDate <= todayStr;
    return t.dueDate === selectedDate;
  });
  const taskDates = useMemo(() => {
    const s = new Set();
    tasks.forEach(t => { if (!t.done && t.dueDate) s.add(t.dueDate); });
    return s;
  }, [tasks]);

  const mustTasks   = visibleTasks.filter(t => t.bucket==="must");
  const shouldTasks = visibleTasks.filter(t => t.bucket==="should");
  const couldTasks  = visibleTasks.filter(t => t.bucket==="could");
  const weekEndStr = (() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toLocaleDateString("en-CA"); })();
  const upcomingTasks = tasks.filter(t => !t.done && t.dueDate && t.dueDate > todayStr && t.dueDate <= weekEndStr).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const wins        = sessionWins;

  function logEnergy(delta, label, type, currentBattery) {
    const entry = { id: `el-${Date.now()}`, timestamp: Date.now(), delta, label, type, battery: Math.round(currentBattery) };
    setEnergyLog(prev => {
      const next = [entry, ...prev].slice(0, 200);
      localStorage.setItem("reflow-energy-log", JSON.stringify(next));
      return next;
    });
  }

  function handleSaveEnergyMap(map) {
    setEnergyMap(map);
    localStorage.setItem("reflow-energy-map", JSON.stringify(map));
    if (uid && saveUserProfile && userProfile) {
      saveUserProfile(uid, { ...userProfile, energyMap: map }).catch(() => {});
    }
  }

  function handleOnboardComplete({ profile, peakCapacity, rhythm, userName = "", initialBattery, energyMap: onboardMap, demographics, identityValues, identityStatement }) {
    const map = onboardMap || DEFAULT_ENERGY_MAP;
    const fullProfile = { ...profile, peakCapacity, rhythm, userName, energyMap: map, ...(demographics ? { demographics } : {}), ...(identityValues?.length ? { identityValues } : {}), ...(identityStatement ? { identityStatement } : {}) };
    setUserProfile(fullProfile); setUserPeak(peakCapacity); setUserRhythm(rhythm);
    setEnergyMap(map);
    localStorage.setItem("reflow-energy-map", JSON.stringify(map));
    if (initialBattery !== undefined) setBattery(Math.max(0, Math.min(100, initialBattery)));
    if (uid && saveUserProfile) saveUserProfile(uid, fullProfile).catch(() => {});
    localStorage.setItem("reflow-onboarded", "true");
    setView("readiness");
  }

  // Task writes used to fail silently (the list only updates from the Firestore echo), so a
  // rejected save/delete looked like "nothing happened". Tell the user instead.
  function reportTaskSyncError(err) {
    console.error("Task sync failed:", err);
    setToast({ type:"warn", title:"Couldn't save that change", msg:"Check your connection and try again." });
  }

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Un-completing a recurring task that's already done — reset it
    if (task.recurrence && task.done) {
      const upd = { done: false, lastDoneDate: null };
      if (uid && updateTaskDoc) updateTaskDoc(uid, String(id), upd).catch(reportTaskSyncError);
      else setTasks(prev => prev.map(t => t.id === id ? { ...t, ...upd } : t));
      return;
    }

    // Stern mode: intercept the first click on an overdue task with the action-plan prompt.
    if (sternMode && !task.done) {
      const todayStr = new Date().toLocaleDateString("en-CA");
      const isOverdue = task.dueDate && task.dueDate < todayStr;
      if (isOverdue && !sternStartedRef.current.has(id)) {
        setSternPreTask(task);
        return;
      }
    }

    // Recurring task completing: mark done + record date, keep in list
    if (task.recurrence) {
      const today = new Date().toLocaleDateString("en-CA");
      // status stays "active" so the task keeps carrying over — only non-recurring
      // completions should flip status to "completed" and drop out of the active query.
      const upd = { done: true, lastDoneDate: today, status: "active" };
      if (uid && updateTaskDoc) updateTaskDoc(uid, String(id), upd).catch(reportTaskSyncError);
      else setTasks(prev => prev.map(t => t.id === id ? { ...t, ...upd } : t));
      haptic.success();
      setSessionWins(prev => {
        const next = [...prev, { ...task, done: true }];
        awardXP(1);
        return next;
      });
      if (!sternMode) setToast({ type:"win", title:"Done.", msg:`↻ Repeats ${task.recurrence === "daily" ? "tomorrow" : task.recurrence === "weekdays" ? "next weekday" : "next week"}.` });
      if (task.energyImpact) {
        setBattery(prev => {
          const clamped = Math.max(0, Math.min(100, prev + task.energyImpact));
          logEnergy(task.energyImpact, task.name, "task", clamped);
          return clamped;
        });
      }
      return;
    }

    // Non-recurring: remove from local state immediately (optimistic)
    setTasks(prev => prev.filter(t => t.id !== id));
    haptic.success();
    setSessionWins(prev => {
      const next = [...prev, { ...task, done: true }];
      // XP: +1 per task; +3 bonus if this clears all Must tasks
      awardXP(1);
      const remainingMust = tasks.filter(t => t.id !== id && t.bucket === "must" && !t.done);
      if (task.bucket === "must" && remainingMust.length === 0) {
        awardXP(3);
        awardBadge("clear-plate");
      }
      if (next.length === 1) awardBadge("first-steps");
      return next;
    });
    // Stern mode: show dopamine reflection instead of the standard toast.
    if (sternMode) {
      setSternPostTask(task);
      setSternSessionCount(c => c + 1);
      sternStartedRef.current.delete(id);
    } else {
      setToast({ type:"win", title:"Done.", msg:"One less thing on your plate. That counts." });
    }
    if (task.energyImpact) {
      setBattery(prev => {
        const clamped = Math.max(0, Math.min(100, prev + task.energyImpact));
        logEnergy(task.energyImpact, task.name, "task", clamped);
        return clamped;
      });
    }
    if (uid && updateTaskDoc) updateTaskDoc(uid, String(id), { done: true, status: "completed" }).catch(reportTaskSyncError);
  }

  function uncompleteTask(id) {
    const win = sessionWins.find(w => w.id === id);
    if (!win) return;
    setSessionWins(prev => prev.filter(w => w.id !== id));
    setTasks(prev => [...prev, { ...win, done: false }]);
    if (win.energyImpact) {
      setBattery(prev => {
        const clamped = Math.max(0, Math.min(100, prev - win.energyImpact));
        logEnergy(-win.energyImpact, win.name, "task", clamped);
        return clamped;
      });
    }
    if (uid && updateTaskDoc) updateTaskDoc(uid, String(id), { done: false }).catch(reportTaskSyncError);
    setToast({ type:"win", title:"Back on the list.", msg:"Task moved back to your to-do." });
  }

  function handleJumpstartBoost(amount) {
    setBattery(prev => {
      const next = Math.min(100, prev + amount);
      localStorage.setItem("reflow-battery", String(next));
      if (uid && saveDailyRecord) saveDailyRecord(uid, todayKey(), { battery: next }).catch(() => {});
      return next;
    });
    setBatteryCharging(true);
    setTimeout(() => setBatteryCharging(false), 1800);
  }

  function handleParalysisComplete(taskId) {
    if (uid && updateTaskDoc) updateTaskDoc(uid, String(taskId), { momentumStatus: "active" }).catch(reportTaskSyncError);;
    setBattery(prev => {
      const clamped = Math.min(100, prev + 2);
      logEnergy(2, "Momentum restored — paralysis broken", "paralysis", clamped);
      localStorage.setItem("reflow-battery", String(clamped));
      return clamped;
    });
    setBatteryCharging(true);
    setTimeout(() => setBatteryCharging(false), 3000);
    setToast({ type:"win", title:"+2% momentum", msg:"Breaking through paralysis is its own win. Seriously." });
  }

  function resetModalState() {
    setNewTask(""); setNewDueDate(""); setImpactMode("drain"); setImpactIntensity(10); setNewDuration(30);
    setNewPriority("normal"); setNewRecurrence("");
    setNewTaskDesc(""); setNewTaskTime(""); setNewTaskProject(""); setNewTaskTags([]); setNewTagInput(""); setShowTagInput(false);
    setNewTaskSubtasks([]); setNewSubtaskInput(""); setEditingTaskId(null);
  }

  function openEditModal(task) {
    const energyImpact = task.energyImpact ?? 0;
    setEditingTaskId(task.id);
    setNewTask(task.name || "");
    setNewBucket(task.bucket || "should");
    setNewPriority(task.priority || "normal");
    setNewDueDate(task.dueDate || "");
    setNewDuration(task.duration || 30);
    setImpactMode(energyImpact >= 0 ? "charge" : "drain");
    setImpactIntensity(Math.abs(energyImpact) || 10);
    setNewTaskDesc(task.description || "");
    setNewTaskTime(task.reminderTime || "");
    setNewTaskTags(task.tags || []);
    setNewTaskSubtasks(task.subtasks || []);
    setNewSubtaskInput("");
    setNewRecurrence(task.recurrence || "");
    setShowAddTaskModal(true);
  }

  function addTask() {
    if (!newTask.trim()) return;
    const energyImpact = impactMode === "drain" ? -impactIntensity : impactIntensity;

    if (editingTaskId) {
      // Update existing task
      const updates = { name: newTask.trim(), bucket: newBucket, priority: newPriority, energyImpact, duration: newDuration, dueDate: newDueDate || null, reminderTime: newTaskTime || null, description: newTaskDesc || null, tags: newTaskTags.length ? newTaskTags : null, subtasks: newTaskSubtasks.length ? newTaskSubtasks : [], recurrence: newRecurrence || null };
      editTask(editingTaskId, updates.name, updates.dueDate, updates.duration, updates);
      resetModalState();
      setShowAddTaskModal(false);
      return;
    }

    const taskId = Date.now();
    const t = { id: taskId, name: newTask.trim(), bucket: newBucket, priority: newPriority, energyImpact, duration: newDuration, done: false, dueDate: newDueDate || null, reminderTime: newTaskTime || null, description: newTaskDesc || null, tags: newTaskTags.length ? newTaskTags : null, subtasks: newTaskSubtasks.length ? newTaskSubtasks : [], recurrence: newRecurrence || null, lastDoneDate: null };
    if (uid && addTaskDoc) {
      addTaskDoc(uid, t).catch(reportTaskSyncError);
    } else {
      setTasks(prev => [...prev, t]);
    }

    // If a time was set, add a matching calendar event for that day
    if (newTaskTime) {
      const [hStr, mStr] = newTaskTime.split(":");
      const startHour = Number(hStr) + Number(mStr) / 60;
      const endHour   = startHour + newDuration / 60;
      const dateKey   = newDueDate || new Date().toLocaleDateString("en-CA");
      try {
        const stored    = JSON.parse(localStorage.getItem("reflow-events") || "{}");
        const dayEvents = stored[dateKey] || [];
        const colorIdx  = dayEvents.length % 5;
        const ev = { id: `task-${taskId}`, activity: newTask.trim(), startHour, endHour, colorIdx, energyImpact };
        const nextEvents = [...dayEvents, ev];
        stored[dateKey] = nextEvents;
        localStorage.setItem("reflow-events", JSON.stringify(stored));
        window.dispatchEvent(new CustomEvent("reflow-calendar-event-added", { detail: { dateKey, event: ev } }));
        if (uid && saveCalendarDay) {
          const storedSched = JSON.parse(localStorage.getItem("reflow-schedules") || "{}");
          saveCalendarDay(uid, dateKey, storedSched[dateKey] || {}, nextEvents).catch(() => {});
        }
      } catch {}
    }

    resetModalState();
    setShowAddTaskModal(false);
  }

  async function breakdownTask() {
    if (!newTask.trim() || !callAI || aiBreakdownLoading) return;
    if (!isPro) {
      const { count } = getAiActionsThisMonth();
      if (count >= 5) { openPaywall(); return; }
      incrementAiAction();
    }
    setAiBreakdownLoading(true);
    setAiBreakdown(null);
    try {
      const result = await callAI({
        message: `Break down this task into 3–5 smaller subtasks, each completable in 30 minutes or less. The user's battery is at ${battery}% — size the subtasks to match their energy. Return ONLY a valid JSON array of strings, no explanation, no markdown. Example format: ["subtask one","subtask two","subtask three"]. Task: "${newTask.trim()}"`,
        context: { battery, date: new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" }) },
      });
      const text = result?.reply || "";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length) { setAiBreakdown(parsed.map(String)); return; }
      }
      setAiBreakdown(["Couldn't parse the response — try rewording your task."]);
    } catch {
      setAiBreakdown(["Something went wrong. Make sure the AI is set up and try again."]);
    } finally {
      setAiBreakdownLoading(false);
    }
  }

  function addSubtask(name) {
    setNewTaskSubtasks(prev => [...prev, { id: Date.now() + Math.random(), name, done: false }]);
  }

  function addAllSubtasks() {
    if (!aiBreakdown?.length) return;
    const subs = aiBreakdown.map((name, i) => ({ id: Date.now() + i + Math.random(), name, done: false }));
    setNewTaskSubtasks(prev => [...prev, ...subs]);
    setAiBreakdown(null);
  }

  function addSubtaskToTask(taskId, name) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const sub = { id: Date.now() + Math.random(), name, done: false };
    const updatedSubs = [...(task.subtasks || []), sub];
    if (uid && updateTaskDoc) {
      updateTaskDoc(uid, String(taskId), { subtasks: updatedSubs }).catch(reportTaskSyncError);
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: updatedSubs } : t));
    }
  }

  function toggleSubtask(taskId, subtaskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedSubs = (task.subtasks || []).map(s => s.id === subtaskId ? { ...s, done: !s.done } : s);
    const allDone = updatedSubs.length > 0 && updatedSubs.every(s => s.done);
    if (uid && updateTaskDoc) {
      updateTaskDoc(uid, String(taskId), { subtasks: updatedSubs, ...(allDone ? { done: true } : {}) }).catch(reportTaskSyncError);
    } else {
      setTasks(prev => prev.map(t => t.id !== taskId ? t : { ...t, subtasks: updatedSubs, done: allDone ? true : t.done }));
    }
  }

  function deleteSubtask(taskId, subtaskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedSubs = (task.subtasks || []).filter(s => s.id !== subtaskId);
    if (uid && updateTaskDoc) {
      updateTaskDoc(uid, String(taskId), { subtasks: updatedSubs }).catch(reportTaskSyncError);
    } else {
      setTasks(prev => prev.map(t => t.id !== taskId ? t : { ...t, subtasks: updatedSubs }));
    }
  }

  function rescheduleTask(id, newDate) {
    // Always apply optimistically so the UI moves immediately and there's no race
    // between concurrent async onSnapshot callbacks when multiple tasks are moved at once.
    setTasks(prev => prev.map(t => t.id === id ? { ...t, dueDate: newDate || null } : t));
    if (uid && updateTaskDoc) {
      updateTaskDoc(uid, String(id), { dueDate: newDate || null }).catch(reportTaskSyncError);
    }
  }

  function deleteTask(id) {
    const removed = tasks.find(t => t.id === id);
    if (uid && deleteTaskDoc) {
      deleteTaskDoc(uid, String(id)).catch(reportTaskSyncError);
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
    // A swipe can delete in one motion, so always leave a way back (name hidden in privacy mode).
    if (removed) setToast({ type:"win", title:"Task deleted", msg: privacyMode ? "" : removed.name, actionLabel:"Undo", onAction:() => restoreTask(removed), id: Date.now() });
  }

  function restoreTask(t) {
    if (uid && addTaskDoc) addTaskDoc(uid, t).catch(reportTaskSyncError);
    else setTasks(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t]);
  }

  function editTask(id, newName, newDueDate, newDuration, extraUpdates) {
    const updates = {
      name: newName,
      dueDate: newDueDate || null,
      ...(newDuration ? { duration: Number(newDuration) } : {}),
      ...(extraUpdates || {}),
    };
    if (uid && updateTaskDoc) {
      updateTaskDoc(uid, String(id), updates).catch(reportTaskSyncError);
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  }

  function changeBucket(id, newBucket) {
    if (uid && updateTaskDoc) {
      updateTaskDoc(uid, String(id), { bucket: newBucket }).catch(reportTaskSyncError);
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, bucket: newBucket } : t));
    }
  }

  function handleShutdownComplete({ gratitude, answers, eveningMood }) {
    const k = todayKey();
    awardXP(5);
    const shutdownCount = (JSON.parse(localStorage.getItem("reflow-shutdown-days") || "[]")).length;
    if (shutdownCount >= 4) awardBadge("rest-earned");
    setShutdownDays(prev => {
      const next = new Set([...prev, k]);
      localStorage.setItem("reflow-shutdown-days", JSON.stringify([...next]));
      return next;
    });
    const completedCount = tasks.filter(t => t.done).length;
    if (uid && saveDailyRecord) {
      saveDailyRecord(uid, k, {
        shutdownComplete: true,
        gratitude,
        shutdownAnswers: answers,
        tasksCompleted: completedCount,
        ...(eveningMood ? { eveningMood, eveningMoodAt: new Date().toISOString() } : {}),
      }).catch(() => {});
    }
    try {
      const snap = JSON.parse(localStorage.getItem("reflow-analytics") || "[]");
      const entry = { date: k, battery, tasks: completedCount };
      const filtered = snap.filter(r => r.date !== k);
      localStorage.setItem("reflow-analytics", JSON.stringify([entry, ...filtered].slice(0, 30)));
    } catch {}
    setView("complete");
  }

  function handleBeginDay() {
    haptic.medium();
    const resolvedEnergy = energy ?? (battery >= ENERGY_LEVEL_THRESHOLDS.HIGH ? "high" : battery >= ENERGY_LEVEL_THRESHOLDS.MED ? "med" : battery >= ENERGY_LEVEL_THRESHOLDS.LOW ? "low" : "hibernate");
    if (!energy) setEnergy(resolvedEnergy);
    if (uid && saveDailyRecord) {
      const answered = Object.values(bodyCheck).some(v => v !== null);
      saveDailyRecord(uid, todayKey(), { energy: resolvedEnergy, mood, intention, bodyCheckin: answered ? JSON.stringify(bodyCheck) : null }).catch(() => {});
    }
    const checkinKey = new Date().toLocaleDateString("en-CA");
    localStorage.setItem("reflow-checkin-date", checkinKey);
    updateStreak();
    awardXP(2);
    setShutdownDays(prev => {
      if (prev.has(checkinKey)) return prev;
      const next = new Set([...prev, checkinKey]);
      const checkinDays = JSON.parse(localStorage.getItem("reflow-checkin-days") || "[]");
      if (!checkinDays.includes(checkinKey)) {
        localStorage.setItem("reflow-checkin-days", JSON.stringify([...checkinDays, checkinKey]));
      }
      return next;
    });
    setView(resolvedEnergy === "hibernate" ? "rest-transition" : "circuit");
  }

  function resetAll() {
    localStorage.removeItem("reflow-onboarded");
    setView("onboarding"); setEnergy(null); setMood(null); setIntention(""); setMlEmotion([]); setMlBodyPart([]); setMlNeed([]); setMlEmotionCustom(""); setMlBodyCustom(""); setMlNeedCustom("");
    setTasks(INITIAL_TASKS); setUserProfile(null); setUserPeak(5); setUserRhythm("varied");
  }

  function resetDay() {
    // Clear daily inputs only — keep profile, tasks, and all settings intact
    setEnergy(null); setMood(null); setIntention("");
    setBodyCheck({ sleep:null, eaten:null, hydrated:null, feeling:null });
    setMlEmotion([]); setMlBodyPart([]); setMlNeed([]);
    setMlEmotionCustom(""); setMlBodyCustom(""); setMlNeedCustom("");
    setView("readiness");
  }

  const LOCAL_STORAGE_KEYS = [
    "reflow-onboarded","reflow-last-day","reflow-checkin-date","reflow-battery",
    "reflow-power-mode","reflow-privacy-mode","reflow-gentle-mode","reflow-stern-mode",
    "reflow-analytics","mindfull-journal","reflow-schedules","reflow-events",
    "reflow-checkin-days","reflow-shutdown-days",
    // personal data that must be cleared on sign-out
    "journal-draft","lf_coach_done","mindfull-notif-prefs","reflow-ai-actions",
    "reflow-badges","reflow-battery-date","reflow-breathed-date","reflow-checkin-streak",
    "reflow-elastic-goals","reflow-energy-log","reflow-energy-map","reflow-feedback",
    "reflow-habits","reflow-routines","reflow-guest-tasks","reflow-last-checkin","reflow-medications","reflow-screening-ack",
    "reflow-week-plan-date","reflow-week-plan-dismissed","reflow-wellness-seen","reflow-dismissed-tips",
  ];

  async function handleClearData() {
    if (uid && clearUserData) {
      try { await clearUserData(uid); } catch {}
    }
    LOCAL_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    if (signOutUser) {
      signOutUser().catch(() => {}).finally(() => window.location.reload());
    } else {
      window.location.reload();
    }
    setShowClearModal(false);
  }

  async function handleDeleteAccount(password) {
    if (!uid || !deleteAccount) return;
    try {
      await deleteAccount(uid, password);
    } catch (err) {
      if (err?.code === "auth/requires-recent-login") {
        throw new Error("Please sign out and sign back in, then try again — Firebase requires a recent login to delete your account.");
      }
      throw new Error((friendlyAuthError && friendlyAuthError(err?.code)) || "Could not delete your account. Please try again.");
    }
    LOCAL_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    setShowDeleteModal(false);
  }

  const hour     = time.getHours();
  const greeting = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";

  const NAV_TABS = ["circuit","calendar","node","recharge","rest-mode","control"].includes(view);
  const REST_MODE = view === "rest-mode";

  if (!user && !guestMode && createAccount && signIn) {
    return (
      <>
        <style>{styles}</style>
        <div className="app">
          <AuthView createAccount={createAccount} signIn={signIn} signInGoogle={signInGoogle} redirectError={redirectError} resetPassword={resetPassword} friendlyAuthError={friendlyAuthError} onGuestMode={enterGuestMode} />
        </div>
      </>
    );
  }

  if (uid && !profileLoaded) {
    if (showBreathing && !gateCompletedDuringLoad) {
      return (
        <>
          <style>{styles}</style>
          <BreathingGate onComplete={() => {
            localStorage.setItem("reflow-breathed-date", new Date().toLocaleDateString("en-CA"));
            setShowBreathing(false);
            setGateCompletedDuringLoad(true);
          }} />
        </>
      );
    }
    if (showBreathing || gateCompletedDuringLoad) {
      return (
        <>
          <style>{styles}</style>
          <div className="breath-gate">
            <div className="breath-gate-eyebrow">before you begin</div>
            <div className="breath-gate-title">Take a breath.</div>
            <div className="breath-gate-ring">
              <div className="breath-gate-circle" style={{ animation:"breathe 4s ease-in-out infinite" }}>
                <div className="breath-gate-label">Loading</div>
              </div>
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <style>{styles}</style>
        <div className="app" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100dvh" }}>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:"var(--ink-mute)" }}>Loading…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className={`app${privacyMode ? " privacy-blur" : ""}`} data-view={view} data-fumes={battery <= 15 ? "true" : undefined} style={{ zoom: fontScale === "sm" ? "90%" : fontScale === "lg" ? "112%" : "100%" }}>


        {/* Fumes mode banner */}
        {battery <= 15 && !fumesDismissed && (
          <div className="fumes-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span className="fumes-banner-text">You're running on fumes. Be very gentle with yourself today.</span>
            <button aria-label="Dismiss" className="fumes-banner-dismiss" onClick={() => setFumesDismissed(true)}>×</button>
          </div>
        )}

        {showBreathing && (
          <BreathingGate onComplete={() => { localStorage.setItem("reflow-breathed-date", new Date().toLocaleDateString("en-CA")); setShowBreathing(false); }} />
        )}


        {sternMode && (
          <>
            <div className="stern-mode-bar">
              <span className="stern-mode-bar-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Stern Mode active
              </span>
              {sternSessionCount > 0 && (
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"rgba(255,255,255,0.7)", marginLeft:14, letterSpacing:"0.03em" }}>
                  <span style={{ color:"white", fontWeight:600 }}>{sternSessionCount}</span> done ↑
                </span>
              )}
              <button
                className="stern-mode-bar-exit"
                style={{ marginLeft:"auto" }}
                onClick={() => { setSternMode(false); localStorage.setItem("reflow-stern-mode", "false"); }}
              >Exit Stern Mode</button>
            </div>
            {sternBatteryAlert && (
              <div style={{ background:"#fef3c7", borderBottom:"2px solid #f59e0b", padding:"8px 20px", display:"flex", alignItems:"center", gap:12, fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#92400e" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style={{flex:1}}>Your battery is at <strong>{battery}%</strong>. Stern Mode works best above 30% — this is your body giving you a signal.</span>
                <div style={{display:"flex", gap:8, flexShrink:0}}>
                  <button
                    onClick={() => setSternBatteryAlert(false)}
                    style={{ background:"transparent", border:"1.5px solid rgba(146,64,14,0.3)", borderRadius:20, color:"#92400e", fontFamily:"'DM Mono',monospace", fontSize:10, padding:"3px 12px", cursor:"pointer", letterSpacing:"0.04em" }}
                  >Keep going</button>
                  <button
                    onClick={() => { setSternMode(false); localStorage.setItem("reflow-stern-mode","false"); setSternBatteryAlert(false); }}
                    style={{ background:"#f59e0b", border:"none", borderRadius:20, color:"white", fontFamily:"'DM Mono',monospace", fontSize:10, padding:"4px 12px", cursor:"pointer", fontWeight:500, letterSpacing:"0.04em" }}
                  >Switch to Default</button>
                </div>
              </div>
            )}
          </>
        )}

        <nav className="nav">
          <button
            className="nav-battery"
            onClick={() => setShowLogEnergy(true)}
            title={`Energy ${battery}% — tap to log`}
            aria-label={`Energy ${battery}%. Log energy`}
          >
            <BatteryMascot level={battery} size={26} mood={battery <= 15 ? "sleeping" : mascotMood} />
          </button>
          {false && (
            <span className="streak-badge">🔥 {checkinStreak}d</span>
          )}

          {NAV_TABS && (
            <div className="nav-tabs">
              {REST_MODE ? (
                <>
                  <button className={`nav-tab ${view==="rest-mode"?"active":""}`}  onClick={() => { haptic.light(); setView("rest-mode"); }}>Hibernate</button>
                  <button className={`nav-tab ${view==="shutdown"?"active":""}`}   onClick={() => { haptic.light(); setView("shutdown"); }}>Wind Down</button>
                </>
              ) : (
                <>
                  <button className={`nav-tab ${view==="node"?"active":""}`}    onClick={() => { haptic.medium();  setView("node"); }}>Routines</button>
                  <button className={`nav-tab ${view==="circuit"?"active":""}`} onClick={() => { haptic.light();   setView("circuit"); }}>Today</button>
                  <button className={`nav-tab ${view==="calendar"?"active":""}`} onClick={() => { haptic.light();   setView("calendar"); }}>Calendar</button>
                  <button className={`nav-tab ${view==="recharge"?"active":""}`} onClick={() => { haptic.success(); setView("recharge"); }}>Wellness</button>
                  <button className={`nav-tab ${view==="control"?"active":""}`} onClick={() => { haptic.heavy();   setControlTab("settings"); setView("control"); }}>More</button>
                </>
              )}
            </div>
          )}

          <div className="nav-right">
            <button aria-label={privacyMode ? "Privacy Mode on — click to turn off" : "Privacy Mode off — click to blur task names"}
              className={`nav-privacy-btn${privacyMode ? " active" : ""}`}
              onClick={() => {
                haptic.light();
                const next = !privacyMode;
                setPrivacyMode(next);
                localStorage.setItem("reflow-privacy-mode", String(next));
              }}
              title={privacyMode ? "Privacy Mode on — click to turn off" : "Privacy Mode off — click to blur task names"}
            >
              <Icon name="lock" size={13} />
            </button>
            <button aria-label="Get support" className="nav-sos-btn" onClick={() => { haptic.sos(); setShowSOSModal(true); }} title="Get support">SOS</button>
          </div>
        </nav>

        <main className="main">

          {view === "onboarding" && (
            <Onboarding
              onComplete={handleOnboardComplete}
              initialProfile={userProfile}
              initialPeak={userPeak}
              initialRhythm={userRhythm}
              initialUserName={userProfile?.userName}
            />
          )}

          {view === "readiness" && (() => {
            return (
              <div className="readiness-card">
                <div className="readiness-eyebrow">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}{userProfile?.userName ? `, ${userProfile.userName.split(" ")[0]}` : ""}</div>
                <div className="readiness-title">How's your energy today?</div>
                <div className="readiness-subtitle">Drag the bar to set where you're at.</div>
                <div style={{ margin:"28px 0 8px" }}>
                  <BatteryPanel
                    battery={battery}
                    darkMode={darkMode}
                    mascotSize={88}
                    onBatteryChange={v => {
                      setBattery(v);
                      localStorage.setItem("reflow-battery", String(v));
                      setEnergy(v >= ENERGY_LEVEL_THRESHOLDS.HIGH ? "high" : v >= ENERGY_LEVEL_THRESHOLDS.MED ? "med" : v >= ENERGY_LEVEL_THRESHOLDS.LOW ? "low" : "hibernate");
                    }}
                  />
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, marginTop:16 }}>
                  <span style={{ fontSize:14, color:"var(--ink-soft)" }}>
                    {(() => {
                      const drainCost = tasks.filter(t => !t.done && typeof t.energyImpact === "number" && t.energyImpact < 0).reduce((s, t) => s + Math.abs(t.energyImpact), 0);
                      return battery >= ENERGY_LEVEL_THRESHOLDS.HIGH
                        ? drainCost > battery
                          ? "You may not have enough energy to complete all your tasks today."
                          : "You have enough energy for your tasks today."
                        : battery >= ENERGY_LEVEL_THRESHOLDS.MED
                        ? "Pace yourself — take breaks between tasks."
                        : battery >= ENERGY_LEVEL_THRESHOLDS.LOW
                        ? "You may not have enough energy to complete all your tasks today."
                        : "Rest is productive today — be gentle with yourself.";
                    })()}
                  </span>
                </div>
                <div className="readiness-quickcheck">
                  <div className="readiness-quickcheck-title">Quick check <span>· optional</span></div>
                  {[
                    { label:"Sleep",   key:"sleep",    opts:[["poor","Poorly"],["normal","Okay"],["great","Well"]] },
                    { label:"Eaten",   key:"eaten",    opts:[[true,"Yes"],[false,"Not yet"]] },
                    { label:"Water",   key:"hydrated", opts:[[true,"Yes"],[false,"Not yet"]] },
                    { label:"Feeling", key:"feeling",  opts:[["hyper","Wired"],["hypo","Frozen"],["grounded","Calm"]] },
                  ].map(row => (
                    <div key={row.key} className="readiness-quickcheck-row">
                      <span className="readiness-quickcheck-label">{row.label}</span>
                      <div className="checkin-chips">
                        {row.opts.map(([val, text]) => (
                          <button key={String(val)} className={`checkin-chip${bodyCheck[row.key] === val ? " selected" : ""}`}
                            onClick={() => setBodyCheck(prev => ({ ...prev, [row.key]: prev[row.key] === val ? null : val }))}>{text}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(() => {
                    const coping = suggestCopingSkill(bodyCheck.feeling, bodyCheck.sleep, bodyCheck.eaten, bodyCheck.hydrated);
                    if (!coping) return null;
                    return (
                      <div className={`checkin-coping-card ${coping.type}`} style={{ marginTop:14, textAlign:"left" }}>
                        <div className="checkin-coping-name">{coping.name} might help today</div>
                        <div className="checkin-coping-desc">{coping.desc}</div>
                      </div>
                    );
                  })()}
                </div>
                <button className="btn-primary" style={{ marginTop:28 }} onClick={handleBeginDay}>Begin my day</button>
                <button className="readiness-struggle-btn" onClick={() => setView("recharge")}>
                  I'm struggling — take me to grounding exercises
                </button>
              </div>
            );
          })()}

          {view === "rest-transition" && (
            <RestTransitionView onContinue={() => setView("rest-mode")} />
          )}

          {view === "rest-mode" && (
            <RestModeView
              uid={uid}
              saveJournalEntry={saveJournalEntry}
              deleteJournalEntry={deleteJournalEntry}
              onSwitchFull={() => { setEnergy("med"); setView("circuit"); }}
              setView={setView}
            />
          )}

          {view === "node" && (
            <NodeView
              tasks={tasks}
              onAddTasks={(names) => {
                names.forEach(name => {
                  const t = { id: Date.now() + Math.random(), name, bucket: "could", energyImpact: -5, duration: 30, done: false, dueDate: null, subtasks: [] };
                  if (uid && addTaskDoc) addTaskDoc(uid, t).catch(reportTaskSyncError);
                  else setTasks(prev => [...prev, t]);
                });
              }}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              isPro={isPro}
              onOpenPaywall={openPaywall}
              callAI={callAI}
              routines={routines}
              setRoutines={setRoutines}
              onCompleteRoutine={r => {
                const drain = { low:-5, medium:-15, high:-25 }[r.energyCost] ?? -15;
                setBattery(prev => {
                  const clamped = Math.max(0, Math.min(100, prev + drain));
                  logEnergy(drain, r.name, "routine", clamped);
                  return clamped;
                });
              }}
              onUncompleteRoutine={r => {
                const restore = { low:5, medium:15, high:25 }[r.energyCost] ?? 15;
                setBattery(prev => {
                  const clamped = Math.max(0, Math.min(100, prev + restore));
                  logEnergy(restore, r.name, "routine-undo", clamped);
                  return clamped;
                });
              }}
            />
          )}

          {view === "circuit" && (
            <>
              {guestMode && !uid && <GuestNote onCreateAccount={exitGuestMode} />}
              <div className="dashboard-header">
                <div className="greeting">{greeting}{userProfile?.userName ? <>, <span>{userProfile.userName}</span></> : ""}.</div>
                <div className="greeting-sub">
                  {(() => {
                    const drainCost = tasks.filter(t => !t.done && typeof t.energyImpact === "number" && t.energyImpact < 0).reduce((s, t) => s + Math.abs(t.energyImpact), 0);
                    return battery >= ENERGY_LEVEL_THRESHOLDS.HIGH
                      ? drainCost > battery
                        ? "You may not have enough energy to complete all your tasks today."
                        : "You have enough energy for your tasks today."
                      : battery >= ENERGY_LEVEL_THRESHOLDS.MED
                      ? "Pace yourself — take breaks between tasks."
                      : battery >= ENERGY_LEVEL_THRESHOLDS.LOW
                      ? "Micro-wins day — one meaningful thing matters more than five rushed ones."
                      : "Rest is productive today — be gentle with yourself.";
                  })()}
                </div>
              </div>

              {(() => {
                const drainTasks = tasks.filter(t => !t.done && typeof t.energyImpact === "number" && t.energyImpact < 0);
                const drainCost  = drainTasks.reduce((s, t) => s + Math.abs(t.energyImpact), 0);
                const candidate  = drainTasks.filter(t => t.bucket !== "must").sort((a, b) => a.energyImpact - b.energyImpact)[0];
                const show = !nudgeDismissed && drainCost > battery && drainTasks.length > 0;
                if (!show) return null;
                const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); })();
                return (
                  <div className="battery-nudge">
                    <Icon name="battery" size={16} style={{ color:"var(--teal-dark)", flexShrink:0, marginTop:2 }} />
                    <div className="battery-nudge-body">
                      <div className="battery-nudge-msg">
                        You're at <strong>{battery}%</strong>. Your remaining tasks carry <strong>~{drainCost}%</strong> of drain — more than you have left.
                      </div>
                      {candidate && (
                        <div className="battery-nudge-task">Heaviest: "{candidate.name}" ({candidate.energyImpact}%)</div>
                      )}
                      <div className="battery-nudge-actions">
                        {candidate && (
                          <button className="battery-nudge-btn" onClick={() => { rescheduleTask(candidate.id, tomorrow); setNudgeDismissed(true); setToast({ type:"win", title:"Moved to tomorrow", msg:"Navigate to tomorrow on the calendar strip to see it." }); }}>
                            Move "{candidate.name.length > 24 ? candidate.name.slice(0,24)+"…" : candidate.name}" to tomorrow
                          </button>
                        )}
                        {tasks.some(t => !t.done && t.bucket === "could" && t.id !== candidate?.id) && (
                          <button className="battery-nudge-btn" onClick={() => {
                            const moving = tasks.filter(t => !t.done && t.bucket === "could");
                            moving.forEach(t => rescheduleTask(t.id, tomorrow));
                            setNudgeDismissed(true);
                            setToast({ type:"win", title:`${moving.length} task${moving.length !== 1 ? "s" : ""} moved to tomorrow`, msg:"Tap tomorrow on the calendar strip to see them." });
                          }}>
                            Move all Could tasks to tomorrow
                          </button>
                        )}
                        <button className="battery-nudge-dismiss" onClick={() => setNudgeDismissed(true)}>Dismiss</button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {calDrainWarning && !calDrainDismissed && (
                <div className="battery-nudge" style={{ borderLeftColor:"#c8903a", background:"rgba(200,144,58,0.07)", borderColor:"rgba(200,144,58,0.25)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8903a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:2 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <div className="battery-nudge-body">
                    <div className="battery-nudge-msg" style={{ color:"var(--ink)" }}>
                      <strong>Heads up — heavy calendar day.</strong>{" "}
                      {calDrainWarning.eventCount} event{calDrainWarning.eventCount !== 1 ? "s" : ""} covering ~{calDrainWarning.totalHours}h
                      {calDrainWarning.backToBack > 0 ? `, including ${calDrainWarning.backToBack} back-to-back` : ""}.
                      {" "}Meetings drain energy before tasks even start — consider keeping your task list light.
                    </div>
                    <div className="battery-nudge-actions">
                      <button className="battery-nudge-btn" style={{ borderColor:"#c8903a", color:"#c8903a" }} onClick={() => { setView("calendar"); setCalDrainDismissed(true); }}>
                        View in Current →
                      </button>
                      <button className="battery-nudge-dismiss" onClick={() => setCalDrainDismissed(true)}>Dismiss</button>
                    </div>
                  </div>
                </div>
              )}

              {weekPlanDue && (
                <div className="battery-nudge">
                  <Icon name="calendar" size={16} style={{ color:"var(--teal-dark)", flexShrink:0, marginTop:2 }} />
                  <div className="battery-nudge-body">
                    <div className="battery-nudge-msg">New week. Plan it in two minutes?</div>
                    <div className="battery-nudge-actions">
                      <button className="battery-nudge-btn" onClick={() => setShowWeekPlan(true)}>Plan my week</button>
                      <button className="battery-nudge-dismiss" onClick={() => {
                        localStorage.setItem("reflow-week-plan-dismissed", new Date().toLocaleDateString("en-CA"));
                        setWeekPlanDue(false);
                      }}>Not now</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="week-strip-wrap">
                <WeekStrip
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  taskDates={taskDates}
                />
              </div>

              <div className="grid-2">
                <div className="task-columns">
                  <ErrorBoundary>
                  <BucketCarousel
                      mustTasks={mustTasks} shouldTasks={shouldTasks} couldTasks={couldTasks}
                      sessionWins={sessionWins} onUncomplete={uncompleteTask}
                      onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} onOpenEdit={openEditModal} onReschedule={rescheduleTask}
                      onChangeBucket={changeBucket}
                      scheduledIds={new Set()} gentleMode={gentleMode} sternMode={sternMode}
                      onParalysis={t => setParalysisTask(t)}
                      onAddSubtask={addSubtaskToTask} onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask}
                    />
                  </ErrorBoundary>
                </div>

                <div className="side-panel">
                  {/* One energy-aware card at a time: recovery when very low, otherwise a mindfulness suggestion */}
                  {battery < 25 && !wellnessPromptDismissed ? (() => {
                    const suggestion = suggestActionBasedOnBattery(battery, tasks);
                    return (
                      <div className="wellness-prompt">
                        <div className="wellness-prompt-eyebrow">
                          <Icon name="leaf" size={11} />Recovery check
                        </div>
                        <div className="wellness-prompt-msg">
                          {battery < 15
                            ? "Even 4 minutes of box breathing can shift your nervous system."
                            : "You're running low. A quick grounding exercise helps more than pushing through."}
                        </div>
                        {suggestion?.type === "recharge" && (
                          <div style={{ margin:"10px 0 4px" }}>
                            <div style={{ fontSize:12, color:"var(--ink-mute)", marginBottom:6 }}>Tasks that give energy back:</div>
                            {suggestion.suggestions.map(t => (
                              <div key={t.id} className="suggest-item" onClick={() => toggleTask(t.id)} {...asButton(() => toggleTask(t.id))}>
                                <span className="suggest-impact charge">+{t.energyImpact}</span>
                                <span className="suggest-name" style={{ fontSize:14, color:"var(--ink)", lineHeight:1.4 }}>{t.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="wellness-prompt-actions">
                          <button className="wellness-prompt-btn" onClick={() => { setWellnessPromptDismissed(true); setView("recharge"); }}>
                            {battery < 15 ? "Take a breath →" : "Go to Wellness →"}
                          </button>
                          <button className="wellness-prompt-dismiss" onClick={() => setWellnessPromptDismissed(true)}>Not now</button>
                        </div>
                      </div>
                    );
                  })() : battery < ENERGY_LEVEL_THRESHOLDS.HIGH && (
                    <MindfulnessPrompt
                      energy={energy ?? "med"}
                      onAdd={text => {
                        const t = { id: Date.now(), name: text, bucket: "could", energyImpact: 1, done: false };
                        if (uid && addTaskDoc) {
                          addTaskDoc(uid, t).catch(reportTaskSyncError);
                        } else {
                          setTasks(prev => [...prev, t]);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
              <button className="btn-primary btn-quiet" style={{ width:"100%", background:"none", color:"var(--ink-soft)", border:"1px solid var(--line)", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:16 }} onClick={() => setView("shutdown")}>
                <Icon name="moon" size={15} />Begin wind-down
              </button>
            </>
          )}

          {view === "calendar" && (
            <>
            {guestMode && !uid && <GuestNote onCreateAccount={exitGuestMode} />}
            <CalendarView
              tasks={tasks}
              energy={energy}
              shutdownDays={shutdownDays}
              onToast={setToast}
              onBack={() => setView("circuit")}
              powerMode={powerMode}
              uid={uid}
              saveCalendarDay={firebaseHelpers?.saveCalendarDay}
              subscribeCalendarDay={firebaseHelpers?.subscribeCalendarDay}
              recurringEvents={recurringEvents}
              onSaveRecurringEvents={events => {
                setRecurringEvents(events);
                if (uid && saveRecurringEvents) saveRecurringEvents(uid, events).catch(console.error);
              }}
              battery={battery}
              onBatteryChange={v => setBattery(prev => typeof v === "function" ? Math.max(0, Math.min(100, v(prev))) : Math.max(0, Math.min(100, v)))}
              onLogEnergy={logEnergy}
              energyMap={energyMap}
              isPro={isPro}
              onOpenPaywall={openPaywall}
              calPermission={calPermission}
              deviceCalEventsByDay={deviceCalCache}
            />
            <div className="cal-events-wrap">
            <CalendarEventsSection
              calendarPermission={calPermission}
              calConnected={calConnected}
              onRequestPermission={handleRequestCalPermission}
              onResync={handleResyncCalendar}
              onUnsync={handleUnsyncCalendar}
              events={calEvents}
              loading={calLoading}
            />
            {upcomingTasks.length > 0 && (
              <div style={{ margin:"16px 0" }}>
                <div className="section-label">Coming up this week</div>
                {upcomingTasks.map(t => (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--card)", borderRadius:"var(--radius-sm)", marginBottom:6, border:"1.5px solid var(--warm)", opacity:0.75 }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", minWidth:68, letterSpacing:"0.3px" }}>{t.dueDate}</span>
                    <span style={{ fontSize:13, color:"var(--ink-soft)", flex:1 }}>{t.name}</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, padding:"2px 8px", borderRadius:20, background:"var(--warm)", color:"var(--ink-mute)" }}>{t.bucket}</span>
                  </div>
                ))}
              </div>
            )}
            </div>
            </>
          )}

          {view === "shutdown" && (
            <ShutdownView tasks={tasks} onComplete={handleShutdownComplete} onCancel={() => setView("circuit")} shutdownDays={shutdownDays} onDeferTask={id => {
              const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); })();
              rescheduleTask(id, tomorrow);
            }} />
          )}

          {view === "recharge" && <GroundingView uid={uid} saveJournalEntry={saveJournalEntry} deleteJournalEntry={deleteJournalEntry} isPro={isPro} onOpenPaywall={openPaywall} onJumpstart={() => setShowJumpstart(true)} />}


          {view === "feedback" && <FeedbackView onToast={setToast} saveFeedback={firebaseHelpers?.saveFeedback} uid={uid} />}

          {view === "control" && (
            <SettingsView
              key={controlTab}
              initialTab={controlTab}
              onShowTutorial={() => { setShowCoach(false); setShowTutorial(true); }}
              powerMode={powerMode}
              onTogglePowerMode={() => {
                const next = !powerMode;
                setPowerMode(next);
                localStorage.setItem("reflow-power-mode", String(next));
              }}
              privacyMode={privacyMode}
              onTogglePrivacyMode={() => {
                haptic.light();
                const next = !privacyMode;
                setPrivacyMode(next);
                localStorage.setItem("reflow-privacy-mode", String(next));
              }}
              gentleMode={gentleMode}
              onToggleGentleMode={(forceOn) => {
                const next = forceOn !== undefined ? forceOn : !gentleMode;
                setGentleMode(next);
                localStorage.setItem("reflow-gentle-mode", String(next));
                if (next) { setSternMode(false); localStorage.setItem("reflow-stern-mode", "false"); }
              }}
              sternMode={sternMode}
              onToggleSternMode={(forceOn) => {
                const next = forceOn !== undefined ? forceOn : !sternMode;
                setSternMode(next);
                localStorage.setItem("reflow-stern-mode", String(next));
                if (next) { setGentleMode(false); localStorage.setItem("reflow-gentle-mode", "false"); }
              }}
              showBreathingOnStart={showBreathingOnStart}
              onToggleBreathingOnStart={() => {
                const next = !showBreathingOnStart;
                setShowBreathingOnStart(next);
                if (!next) setShowBreathing(false);
                localStorage.setItem("reflow-show-breathing", String(next));
                if (uid && saveUserProfile && userProfile) {
                  saveUserProfile(uid, { ...userProfile, showBreathingOnStart: next }).catch(() => {});
                }
              }}
              onClearData={() => setShowClearModal(true)}
              onDeleteAccount={() => setShowDeleteModal(true)}
              onToast={setToast}
              uid={uid}
              userEmail={user?.email ?? null}
              loadHistory={loadHistory}
              firebaseHelpers={firebaseHelpers}
              energyLog={energyLog}
              weekStartDay={weekStartDay}
              onChangeWeekStartDay={day => {
                setWeekStartDay(day);
                localStorage.setItem("reflow-week-start-day", String(day));
              }}
              energyMap={energyMap}
              onSaveEnergyMap={handleSaveEnergyMap}
              onSignOut={signOutUser ? () => { LOCAL_STORAGE_KEYS.forEach(k => localStorage.removeItem(k)); signOutUser().catch(() => {}).finally(() => window.location.reload()); } : null}
              guestMode={guestMode}
              onExitGuest={exitGuestMode}
              battery={battery}
              onRecalibrate={() => setView("onboarding")}
              sessionWins={sessionWins}
              onUncompleteTask={uncompleteTask}
              fontScale={fontScale}
              onChangeFontScale={val => { setFontScale(val); localStorage.setItem("reflow-font-scale", val); }}
              darkMode={darkMode}
              onToggleDarkMode={() => {
                haptic.light();
                const next = !darkMode;
                setDarkMode(next);
                localStorage.setItem("reflow-dark-mode", String(next));
              }}
              isPro={isPro}
              onOpenPaywall={openPaywall}
              onOpenWaitlist={callJoinWaitlist && !_isNative() ? () => setShowWaitlist(true) : undefined}
              earnedBadges={earnedBadges}
              routines={routines}
            />
          )}

          {view === "history" && (
            isPro
              ? <HistoryView uid={uid} loadHistory={loadHistory} />
              : <ProGate feature="History" detail="See every day's check-in, mood, and shutdown notes." onUpgrade={openPaywall} />
          )}

          {view === "complete" && (
            <div className="complete-screen">
              <span className="complete-icon"><Icon name="leaf" size={48} style={{color:"var(--teal-dark)"}} /></span>
              <div className="complete-title">Your day is closed.</div>
              <div className="complete-msg">{["You've done what you could with what you had. The rest will be there tomorrow — and so will you. Rest well.","Whatever you finished, whatever you didn't — you showed up. That's the whole job.","The day is done. You carried it well. Set it down now.","You kept going until it was time to stop. That's not small. Rest easy.","You brought yourself to today. That's always enough."][shutdownDays.size % 5]}</div>
              {(() => {
                const prefix = new Date().toISOString().slice(0,7);
                const monthCount = [...shutdownDays].filter(d => d.startsWith(prefix)).length;
                if (monthCount === 1) return <div className="complete-streak">Your first shutdown ritual this month. The beginning of something good.</div>;
                if (monthCount >= 2) return <div className="complete-streak">{monthCount} nights you chose rest this month.</div>;
                return null;
              })()}
              <button className="complete-btn" onClick={resetDay}>Start fresh tomorrow</button>
            </div>
          )}

        </main>

        {NAV_TABS && (
          <nav className="bottom-nav">
            {REST_MODE ? (
              <>
                <button className={`bottom-nav-item ${view==="rest-mode"?"active":""}`} onClick={() => setView("rest-mode")}>
                  <svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>
                  <span className="bottom-nav-label">Hibernate</span>
                </button>
                <button className={`bottom-nav-item ${view==="shutdown"?"active":""}`} onClick={() => setView("shutdown")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18.364 5.636a9 9 0 1 1-12.728 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                  <span className="bottom-nav-label">Wind Down</span>
                </button>
              </>
            ) : (
              <>
                <button className={`bottom-nav-item ${view==="node"?"active":""}`} onClick={() => { haptic.medium(); setView("node"); }}>
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="7" r="2"/><circle cx="20" cy="7" r="2"/><circle cx="4" cy="17" r="2"/><circle cx="20" cy="17" r="2"/><line x1="6.3" y1="8.7" x2="10.3" y2="10.7"/><line x1="13.7" y1="10.7" x2="17.7" y2="8.7"/><line x1="6.3" y1="15.3" x2="10.3" y2="13.3"/><line x1="13.7" y1="13.3" x2="17.7" y2="15.3"/></svg>
                  <span className="bottom-nav-label">Routines</span>
                </button>
                <button className={`bottom-nav-item ${view==="circuit"?"active":""}`} onClick={() => { haptic.light(); setView("circuit"); }}>
                  <svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/><line x1="7" y1="9.5" x2="3" y2="9.5"/><line x1="7" y1="14.5" x2="3" y2="14.5"/><line x1="17" y1="9.5" x2="21" y2="9.5"/><line x1="17" y1="14.5" x2="21" y2="14.5"/><line x1="10" y1="7" x2="10" y2="3"/><line x1="14" y1="7" x2="14" y2="3"/><line x1="10" y1="17" x2="10" y2="21"/><line x1="14" y1="17" x2="14" y2="21"/></svg>
                  <span className="bottom-nav-label">Today</span>
                </button>
                <button className={`bottom-nav-item ${view==="calendar"?"active":""}`} onClick={() => { haptic.light(); setView("calendar"); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span className="bottom-nav-label">Calendar</span>
                </button>
                <button className={`bottom-nav-item ${view==="recharge"?"active":""}`} onClick={() => { haptic.success(); setView("recharge"); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2"/><rect x="4" y="9" width="12" height="6" rx="1" fill="currentColor" stroke="none"/></svg>
                  <span className="bottom-nav-label">Wellness</span>
                </button>
                <button className={`bottom-nav-item ${view==="control"?"active":""}`} onClick={() => { haptic.heavy(); setControlTab("settings"); setView("control"); }}>
                  <svg viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
                  <span className="bottom-nav-label">More</span>
                </button>
              </>
            )}
          </nav>
        )}

        {/* Home link footer */}
        {NAV_TABS && (
          <div style={{ textAlign:"center", padding:"6px 0 max(10px,env(safe-area-inset-bottom))", background:"var(--cream)" }}>
            <a
              href="https://mybatteryapp.com/home"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"var(--ink-mute)", letterSpacing:"0.5px", textDecoration:"none", opacity:0.7 }}
            >mybatteryapp.com</a>
          </div>
        )}

        {/* FAB + menu — hidden during onboarding */}
        {view !== "onboarding" && (
          <>
            {showFabMenu && <div className="fab-backdrop" onClick={() => setShowFabMenu(false)} />}
            {showFabMenu && (
              <div className="fab-menu">
                {[
                  { label:"AI Assistant", icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2.5l1.8 5.4 5.4 1.8-5.4 1.8-1.8 5.4-1.8-5.4-5.4-1.8 5.4-1.8z"/><path d="M5.5 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>, action:() => { setShowFabMenu(false); if (isPro) { setShowAICoach(true); } else { openPaywall(); } }, hidden:!callAI },
                  { label:"Brain dump",  icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6l-.7.5V18a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2.5l-.7-.5A7 7 0 0 1 12 2z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>, action:() => { setShowFabMenu(false); setShowBrainDump(true); } },
                  { label:"Log energy",  icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, action:() => { setShowFabMenu(false); setShowLogEnergy(true); } },
                  { label:"Add task",    icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>, action:() => { setShowFabMenu(false); setShowAddTaskModal(true); } },
                ].filter(i => !i.hidden).map(item => (
                  <div key={item.label} className="fab-menu-item">
                    <button className="fab-menu-label" onClick={item.action}>{item.label}</button>
                    <button aria-label={item.label} className="fab-menu-icon" onClick={item.action}>{item.icon}</button>
                  </div>
                ))}
              </div>
            )}
            <button
              className={`ai-fab${showFabMenu ? " open" : ""}`}
              onClick={() => { setShowFabMenu(v => !v); setShowAICoach(false); }}
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </>
        )}
        {showAICoach && callAI && isPro && (
          <ErrorBoundary>
          <AICoachPanel
            battery={battery}
            tasks={tasks}
            energyMap={energyMap}
            userProfile={userProfile}
            callAI={callAI}
            callScheduleGenerator={callScheduleGenerator}
            onClose={() => setShowAICoach(false)}
            onAddTasks={(taskList, parentName, rawTaskObjs) => {
              let newTasks;
              if (rawTaskObjs) {
                newTasks = rawTaskObjs;
              } else {
                const subtasks = taskList.map(name => ({ id: Date.now() + Math.random(), name, done: false }));
                const parent = {
                  id: Date.now(), name: parentName || taskList[0], bucket: "should",
                  energyImpact: -10, duration: 30, done: false, dueDate: null,
                  subtasks: parentName ? subtasks : subtasks.slice(1),
                };
                if (!parentName) parent.name = taskList[0];
                newTasks = [parent];
              }
              if (uid && addTaskDoc) {
                Promise.all(newTasks.map(t => addTaskDoc(uid, t))).catch(reportTaskSyncError);
              } else {
                setTasks(prev => [...prev, ...newTasks]);
              }
            }}
          />
          </ErrorBoundary>
        )}

        {showWelcomeBack && (
          <div className="welcome-back-card" role="status" onClick={() => setShowWelcomeBack(false)}>
            Welcome back 🌿 Glad you're here.
          </div>
        )}
        {toast && <Toast key={toast.id ?? toast.title} type={toast.type} title={toast.title} msg={toast.msg} actionLabel={toast.actionLabel} onAction={toast.onAction} onClose={() => setToast(null)} />}
        {showSOSModal && <SOSModal onDismiss={() => setShowSOSModal(false)} onOpenSafety={() => { setShowSOSModal(false); setControlTab("safety"); setView("control"); }} />}
        {showJumpstart && (
          <JumpstartMode
            onBoost={handleJumpstartBoost}
            onClose={() => setShowJumpstart(false)}
          />
        )}
        {showWeekPlan && view !== "onboarding" && (
          <WeekPlanModal
            weekStartDay={weekStartDay}
            userName={userProfile?.userName}
            onClose={() => {
              setShowWeekPlan(false);
              if (localStorage.getItem("reflow-week-plan-date") === new Date().toLocaleDateString("en-CA")) setWeekPlanDue(false);
            }}
            onSave={plan => {
              if (uid && saveDailyRecord) {
                saveDailyRecord(uid, todayKey(), { weekPlan: plan }).catch(() => {});
              }
            }}
          />
        )}
        {showClearModal && (
          <ConfirmModal
            title="Delete all your data?"
            body="This will permanently remove your tasks, calendar, journal, and daily records from Firestore, then sign you out. Your account stays active."
            confirmLabel="Yes, delete everything"
            onConfirm={handleClearData}
            onCancel={() => setShowClearModal(false)}
          />
        )}
        {showDeleteModal && (
          <DeleteAccountModal
            requirePassword={hasPasswordAuth}
            onConfirm={handleDeleteAccount}
            onCancel={() => setShowDeleteModal(false)}
          />
        )}
        {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
        {showCoach && view === "circuit" && <CoachMarks onDone={() => {
          setShowCoach(false);
          if (uid && saveUserProfile && userProfile) {
            saveUserProfile(uid, { ...userProfile, tutorialSeen: true }).catch(() => {});
          }
        }} />}
        {paralysisTask && (
          <TaskParalysisModal
            task={paralysisTask}
            onClose={() => setParalysisTask(null)}
            onComplete={handleParalysisComplete}
          />
        )}

        {sternPreTask && (
          <SternPreTaskModal
            task={sternPreTask}
            onSelect={strategy => {
              sternStartedRef.current.add(sternPreTask.id);
              setSternPreTask(null);
              setToast({ type:"info", title:"Plan set.", msg:`Strategy: ${strategy}. Now go.` });
            }}
            onDismiss={() => setSternPreTask(null)}
          />
        )}
        {sternPostTask && (
          <SternPostTaskModal
            task={sternPostTask}
            onClose={() => setSternPostTask(null)}
          />
        )}
        {showAddTaskModal && (
          <AddTaskModal
            newTask={newTask} setNewTask={setNewTask}
            newBucket={newBucket} setNewBucket={setNewBucket}
            newPriority={newPriority} setNewPriority={setNewPriority}
            newDueDate={newDueDate} setNewDueDate={setNewDueDate}
            newDuration={newDuration} setNewDuration={setNewDuration}
            impactMode={impactMode} setImpactMode={setImpactMode}
            impactIntensity={impactIntensity} setImpactIntensity={setImpactIntensity}
            newTaskDesc={newTaskDesc} setNewTaskDesc={setNewTaskDesc}
            newTaskTime={newTaskTime} setNewTaskTime={setNewTaskTime}
            newTaskTags={newTaskTags} setNewTaskTags={setNewTaskTags}
            newTagInput={newTagInput} setNewTagInput={setNewTagInput}
            showTagInput={showTagInput} setShowTagInput={setShowTagInput}
            newTaskSubtasks={newTaskSubtasks} setNewTaskSubtasks={setNewTaskSubtasks}
            newSubtaskInput={newSubtaskInput} setNewSubtaskInput={setNewSubtaskInput}
            onAdd={addTask}
            isEditing={!!editingTaskId}
            onClose={() => { resetModalState(); setShowAddTaskModal(false); }}
            callAI={callAI}
            battery={battery}
            aiBreakdown={aiBreakdown} setAiBreakdown={setAiBreakdown}
            aiBreakdownLoading={aiBreakdownLoading}
            breakdownTask={breakdownTask}
            AIBreakdownCard={AIBreakdownCard}
            addSubtask={addSubtask}
            addAllSubtasks={addAllSubtasks}
            newRecurrence={newRecurrence} setNewRecurrence={setNewRecurrence}
          />
        )}
        {showLogEnergy && (
          <LogEnergyModal
            battery={battery}
            onSave={next => {
              const clamped = Math.max(0, Math.min(100, next));
              const delta = Math.round(clamped - battery);
              if (delta !== 0) logEnergy(delta, "Energy check-in", "manual", clamped);
              setBattery(clamped);
            }}
            onClose={() => setShowLogEnergy(false)}
          />
        )}
        {showBrainDump && (
          <BrainDumpModal
            onClose={() => setShowBrainDump(false)}
            callAI={callAI}
            onAddTasks={taskList => {
              taskList.forEach(t => {
                const newT = { id: Date.now() + Math.random(), name: t, bucket: "should", energyImpact: -10, duration: 30, done: false, dueDate: null, subtasks: [] };
                setTasks(prev => [...prev, newT]);
              });
              setShowBrainDump(false);
            }}
          />
        )}
        {showPaywall && (
          <PaywallScreen
            packages={packages}
            offeringsError={offeringsError}
            onRetry={() => { setShowPaywall(false); setTimeout(() => setShowPaywall(true), 100); }}
            onPurchase={purchasePackage}
            onRestore={restorePurchases}
            onClose={() => setShowPaywall(false)}
          />
        )}
        {showWaitlist && callJoinWaitlist && (
          <WaitlistScreen
            callJoinWaitlist={callJoinWaitlist}
            onClose={() => setShowWaitlist(false)}
          />
        )}
      </div>
    </>
  );
}
