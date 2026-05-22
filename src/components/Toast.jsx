import { useEffect } from "react";

export default function Toast({ type, title, msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, []);
  return (
    <div className={`toast ${type}`}>
      <button className="toast-close" onClick={onClose}>×</button>
      <div className="toast-title">{title}</div>
      <div className="toast-msg">{msg}</div>
    </div>
  );
}
