import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import api from "../services/api";
import { formatTimeLatn, formatTimestampDateLatn } from "../utils/srLatnDates";
import "./CancelBookingPage.css";

const DELIVERY_LABELS = { online: "Online", in_person: "U centru" };
const SESSION_LABELS = { individual: "Individualni", group: "Grupni" };

function CancelBookingPage() {
  const { token } = useParams();
  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.get(`/public/bookings/cancel/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(setBooking)
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  const cancelBooking = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api.post("/public/bookings/cancel", {
        token,
        reason: reason.trim() || null,
      });
      setResult(response);
      setConfirmOpen(false);
      setBooking((current) => ({ ...current, status: "cancelled", can_cancel: false }));
    } catch (requestError) {
      setError(requestError.message);
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="cancel-page"><div className="cancel-card"><Spinner text="Proveravamo rezervaciju…" /></div></div>;

  if (!booking) {
    return <div className="cancel-page"><section className="cancel-card cancel-card--center"><span className="cancel-status-icon cancel-status-icon--error">!</span><h1>Link nije važeći</h1><Alert type="error">{error || "Rezervacija nije pronađena."}</Alert><Link to="/booking" className="btn btn-primary">Zakaži novi čas</Link></section></div>;
  }

  if (result) {
    const mailStatus = result.notification_delivery?.status;
    const mailMessage = mailStatus === "sent"
      ? "Obaveštenje je poslato svim učesnicima."
      : mailStatus === "partial"
        ? "Otkazivanje je sačuvano, ali deo email obaveštenja nije isporučen."
        : mailStatus === "captured"
          ? "Slanje email obaveštenja još nije podešeno, ali otkazivanje je sačuvano."
          : "Email obaveštenje trenutno nije poslato, ali otkazivanje je sačuvano.";
    return <div className="cancel-page"><section className="cancel-card cancel-card--center">
      <span className="cancel-status-icon">✓</span><p className="cancel-eyebrow">Rezervacija #{result.booking_id}</p><h1>Čas je otkazan.</h1>
      <p>Termin je ponovo oslobođen. {mailMessage}</p>
      <Link to="/booking" className="btn btn-primary">Zakaži drugi termin</Link>
    </section></div>;
  }

  const alreadyCancelled = booking.status === "cancelled";
  return (
    <div className="cancel-page">
      <section className="cancel-card" aria-labelledby="cancel-title">
        <header className="cancel-heading"><p className="cancel-eyebrow">Upravljanje rezervacijom #{booking.booking_id}</p><h1 id="cancel-title">Otkazivanje časa</h1><p>Proveri detalje pre nego što oslobodiš termin.</p></header>
        {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
        <div className="cancel-ticket">
          <div className="cancel-ticket-date"><span>{formatTimestampDateLatn(booking.start_time)}</span><strong>{formatTimeLatn(booking.start_time)}</strong><small>do {formatTimeLatn(booking.end_time)}</small></div>
          <dl><div><dt>Predmet</dt><dd>{booking.subject_name}</dd></div><div><dt>Profesor</dt><dd>{booking.teacher_name}</dd></div><div><dt>Trajanje</dt><dd>{booking.duration_minutes} minuta</dd></div><div><dt>Vrsta</dt><dd>{DELIVERY_LABELS[booking.delivery_mode]} · {SESSION_LABELS[booking.session_type]}</dd></div></dl>
        </div>

        {alreadyCancelled ? <div className="cancel-info cancel-info--done"><span>✓</span><div><strong>Ovaj čas je već otkazan</strong><p>Nije potrebna dodatna radnja.</p></div></div> : !booking.can_cancel ? <div className="cancel-info cancel-info--warning"><span>!</span><div><strong>Rok za online otkazivanje je istekao</strong><p>Čas se može besplatno otkazati do {formatTimestampDateLatn(booking.cancellation_deadline)} u {formatTimeLatn(booking.cancellation_deadline)}. Obrati se direktno centru.</p></div></div> : <>
          <div className="form-group cancel-reason"><label className="form-label" htmlFor="cancel-reason">Razlog <span>opciono</span></label><textarea id="cancel-reason" className="textarea" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Pomaže nam da bolje organizujemo buduće termine." /><small>{reason.length}/500</small></div>
          {!confirmOpen ? <button type="button" className="btn btn-danger cancel-primary" onClick={() => setConfirmOpen(true)}>Želim da otkažem čas</button> : <div className="cancel-confirm" role="alert"><p><strong>Da li si siguran/na?</strong><span>Ova radnja odmah oslobađa termin za druge učenike.</span></p><div><button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>Ne, zadrži čas</button><button type="button" className="btn btn-danger" onClick={cancelBooking} disabled={submitting}>{submitting ? "Otkazujem…" : "Da, otkaži"}</button></div></div>}
        </>}
        <Link to="/" className="cancel-back">← Nazad na početnu</Link>
      </section>
    </div>
  );
}

export default CancelBookingPage;
