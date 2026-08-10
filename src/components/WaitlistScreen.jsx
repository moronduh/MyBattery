import { useState } from "react";

/**
 * WaitlistScreen — full-screen modal overlay for joining the MyBattery
 * mobile app waitlist from inside the web preview app.
 *
 * Props:
 *   onClose          () => void
 *   callJoinWaitlist ({ email, source }) => Promise<{ ok, duplicate }>
 *   uid              string | null  — pre-fill source tag
 */
export default function WaitlistScreen({ onClose, callJoinWaitlist }) {
  const [email,     setEmail]     = useState("");
  const [state,     setState]     = useState("idle"); // idle | loading | done | error
  const [duplicate, setDuplicate] = useState(false);
  const [errMsg,    setErrMsg]    = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrMsg("Please enter a valid email address.");
      setState("error");
      return;
    }
    setState("loading");
    setErrMsg("");
    try {
      const result = await callJoinWaitlist({ email: trimmed, source: "app" });
      setDuplicate(!!result?.duplicate);
      setState("done");
    } catch (err) {
      console.error("Waitlist error:", err);
      setErrMsg("Something went wrong — please try again or email us at info@mybatteryapp.com.");
      setState("error");
    }
  }

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.sheet}>
        {/* Close */}
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>

        {state !== "done" ? (
          <>
            {/* Header */}
            <div style={styles.pill}>Coming soon</div>
            <h2 style={styles.heading}>A dedicated mobile app<br />is on the way</h2>
            <p style={styles.sub}>
              Be the first to know when it drops. One email, no spam.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} style={styles.form} noValidate>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
                placeholder="you@example.com"
                autoComplete="email"
                style={styles.input}
                disabled={state === "loading"}
              />
              <button
                type="submit"
                style={{ ...styles.submitBtn, opacity: state === "loading" ? 0.6 : 1 }}
                disabled={state === "loading"}
              >
                {state === "loading" ? "Joining…" : "Notify me at launch"}
              </button>
            </form>

            {state === "error" && (
              <p style={styles.error}>{errMsg}</p>
            )}

            <p style={styles.note}>No spam, ever. Unsubscribe any time.</p>
          </>
        ) : (
          /* Success state */
          <div style={styles.successWrap}>
            <div style={styles.successIcon}>🎉</div>
            <h2 style={styles.heading}>
              {duplicate ? "You're already on the list!" : "You're on the list!"}
            </h2>
            <p style={styles.sub}>
              {duplicate
                ? "We already have your email. We'll reach out the moment the app is live."
                : "We'll send you one email the moment the mobile app launches."}
            </p>
            <button style={styles.doneBtn} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position:        "fixed",
    inset:           0,
    background:      "rgba(0,0,0,0.45)",
    zIndex:          9000,
    display:         "flex",
    alignItems:      "flex-end",
    justifyContent:  "center",
    animation:       "fadeIn 0.18s ease both",
  },
  sheet: {
    position:        "relative",
    background:      "var(--card, #fff)",
    borderRadius:    "28px 28px 0 0",
    padding:         "36px 32px 48px",
    width:           "100%",
    maxWidth:        520,
    boxShadow:       "0 -8px 40px rgba(0,0,0,0.12)",
    animation:       "slideUp 0.28s cubic-bezier(0.22,1,0.36,1) both",
  },
  closeBtn: {
    position:        "absolute",
    top:             16,
    right:           20,
    background:      "var(--warm, #f0ebe0)",
    border:          "none",
    borderRadius:    "50%",
    width:           32,
    height:          32,
    fontSize:        20,
    lineHeight:      "32px",
    textAlign:       "center",
    cursor:          "pointer",
    color:           "var(--ink-mute, #9aab9a)",
    padding:         0,
  },
  pill: {
    display:         "inline-block",
    background:      "var(--teal-pale, rgba(107,142,90,0.12))",
    color:           "var(--teal-dark, #4a7a5a)",
    fontFamily:      "'DM Mono', monospace",
    fontSize:        10,
    letterSpacing:   "1.5px",
    textTransform:   "uppercase",
    borderRadius:    20,
    padding:         "4px 12px",
    marginBottom:    16,
  },
  heading: {
    fontFamily:      "'Playfair Display', serif",
    fontSize:        24,
    fontWeight:      400,
    color:           "var(--ink, #2d3b2d)",
    lineHeight:      1.3,
    margin:          "0 0 10px",
  },
  sub: {
    fontSize:        14,
    color:           "var(--ink-soft, #6b7c6b)",
    lineHeight:      1.6,
    margin:          "0 0 28px",
  },
  form: {
    display:         "flex",
    flexDirection:   "column",
    gap:             10,
  },
  input: {
    width:           "100%",
    padding:         "14px 18px",
    borderRadius:    32,
    border:          "1.5px solid var(--warm, #e8e0d0)",
    background:      "var(--cream, #f9f7f2)",
    fontFamily:      "'DM Sans', sans-serif",
    fontSize:        14,
    color:           "var(--ink, #2d3b2d)",
    outline:         "none",
    boxSizing:       "border-box",
    transition:      "border-color 0.15s",
  },
  submitBtn: {
    width:           "100%",
    padding:         "14px",
    borderRadius:    32,
    border:          "none",
    background:      "var(--teal-dark, #4a7a5a)",
    color:           "#fff",
    fontFamily:      "'DM Sans', sans-serif",
    fontSize:        14,
    fontWeight:      500,
    cursor:          "pointer",
    transition:      "opacity 0.15s, transform 0.15s",
  },
  error: {
    fontSize:        12,
    color:           "var(--error, #c4726a)",
    margin:          "8px 0 0",
    lineHeight:      1.5,
  },
  note: {
    fontSize:        11,
    color:           "var(--ink-mute, #9aab9a)",
    textAlign:       "center",
    margin:          "16px 0 0",
    fontFamily:      "'DM Mono', monospace",
    letterSpacing:   "0.3px",
  },
  successWrap: {
    textAlign:       "center",
    paddingTop:      8,
  },
  successIcon: {
    fontSize:        48,
    marginBottom:    16,
    lineHeight:      1,
  },
  doneBtn: {
    marginTop:       28,
    padding:         "13px 40px",
    borderRadius:    32,
    border:          "none",
    background:      "var(--teal-dark, #4a7a5a)",
    color:           "#fff",
    fontFamily:      "'DM Sans', sans-serif",
    fontSize:        14,
    fontWeight:      500,
    cursor:          "pointer",
  },
};
