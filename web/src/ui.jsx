import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, ExternalLink, X, Info } from "lucide-react";

/** Brand mark: the user's Mintiq logo (green ribbon M). Falls back to a simple SVG M. */
export function Logo({ size = 28 }) {
  const [ok, setOk] = useState(true);
  if (ok) return <img src="/mintiq-mark.png" width={size} height={size} alt="" aria-hidden="true" className="logo-mark" onError={() => setOk(false)} />;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <path d="M6 25V8l10 9 10-9v17" fill="none" stroke="#94C447" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Skeleton({ w = "100%", h = 16, r = 8, style }) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ explorerTx, children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list.slice(-3), { id, ...t }]);
      setTimeout(() => dismiss(id), t.type === "error" ? 12000 : 8000);
    },
    [dismiss]
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-icon">
              {t.type === "error" ? <XCircle size={20} /> : t.type === "info" ? <Info size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <div className="toast-body">
              <strong>{t.title}</strong>
              {t.body && <p>{t.body}</p>}
              {t.hash && (
                <a href={`${explorerTx}${t.hash}`} target="_blank" rel="noreferrer">
                  View on NearBlocks <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
            <button className="icon-btn" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
