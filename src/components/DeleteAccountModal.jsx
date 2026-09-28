import { useState } from "react";

export default function DeleteAccountModal({ requirePassword, onConfirm, onCancel }) {
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleConfirm() {
    if (requirePassword && !password) return;
    setError("");
    setLoading(true);
    try {
      await onConfirm(password);
    } catch (err) {
      setError(err?.message || "Could not delete your account. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Permanently delete your account?</div>
        <div className="modal-body">
          This removes your Firebase Auth profile and all associated tasks, calendar, and journal data. It cannot be undone.
        </div>
        {requirePassword && (
          <div className="auth-field">
            <label className="auth-label">Confirm your password to continue</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleConfirm(); }}
              placeholder="Your password"
              autoComplete="current-password"
              autoFocus
            />
          </div>
        )}
        {error && <div style={{ color: "var(--error)", fontSize: 13, marginTop: -8, marginBottom: 20 }}>{error}</div>}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className="modal-confirm-danger"
            onClick={handleConfirm}
            disabled={loading || (requirePassword && !password)}
          >
            {loading ? "Deleting…" : "Yes, delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}
