import { useEffect, useRef, useState } from "react";
import "./ui.css";

/**
 * Potvrda radnje unutar kartice, umesto window.confirm/prompt.
 * `withReason` dodaje opciono polje za razlog; `onConfirm(reason)` dobija prazan string kada ga nema.
 */
export default function InlineConfirm({ title, description, confirmLabel = "Da, otkaži", cancelLabel = "Ne, zadrži", withReason = false, reasonPlaceholder = "Razlog (opciono)", danger = true, busy = false, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const firstControl = useRef(null);
  useEffect(() => { firstControl.current?.focus({ preventScroll: true }); }, []);
  return <div className="inline-confirm" role="alertdialog" aria-live="assertive" aria-label={title}>
    <p className="inline-confirm-title">{title}</p>
    {description && <p className="inline-confirm-desc">{description}</p>}
    {withReason && <textarea ref={firstControl} className="textarea inline-confirm-reason" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={reasonPlaceholder} disabled={busy} />}
    <div className="inline-confirm-actions">
      <button ref={withReason ? undefined : firstControl} type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
      <button type="button" className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => onConfirm(reason.trim())} disabled={busy}>{busy ? "Sačekaj…" : confirmLabel}</button>
    </div>
  </div>;
}
