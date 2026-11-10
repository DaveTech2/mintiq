import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, ExternalLink, X, Info } from "lucide-react";

/** Brand mark: the official Mintiq logo (green ribbon M + orbit swoosh, transparent PNG).
 *  `size` is the height; the logo is ~1.93× wider than tall. Falls back to a simple SVG M. */
export const LOGO_RATIO = 512 / 266;
export function Logo({ size = 28 }) {
  const [ok, setOk] = useState(true);
  const w = Math.round(size * LOGO_RATIO);
  return (
    <span className="logo-anim" style={{ width: w, height: size }} aria-hidden="true">
      {ok ? <img src="/mintiq-logo.png" width={w} height={size} alt="" className="logo-mark" onError={() => setOk(false)} />
        : <svg width={size} height={size} viewBox="0 0 32 32" className="logo-mark">
            <path d="M6 25V8l10 9 10-9v17" fill="none" stroke="#94C447" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>}
      {ok && <span className="logo-shine" />}
    </span>
  );
}

export function Skeleton({ w = "100%", h = 16, r = 8, style, className = "" }) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
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
