import { useEffect, useState } from "react";
import { Briefcase, Download } from "lucide-react";
import api from "../../services/api";
import Alert from "../../components/Alert";
import Spinner from "../../components/Spinner";
import { pluralLatn } from "../../utils/bookings";
import { formatTimestampDateLatn } from "../../utils/srLatnDates";

/** Prijave za posao sa stranice O nama, najnovije prve, sa preuzimanjem CV-a. */
export default function ApplicationsTab() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/job-applications").then(setItems).catch((err) => setError(err.message || "Prijave nisu učitane."));
  }, []);

  const download = (item) => api.downloadBlob(`/admin/job-applications/${item.id}/cv`, item.cv_original_name).catch((err) => setError(err.message));

  return <div className="admin-section">
    <div className="section-top">
      <div>
        <h2 className="section-title">Prijave za posao</h2>
        {items && <p className="section-sub">{pluralLatn(items.length, "prijava", "prijave", "prijava")}</p>}
      </div>
    </div>
    {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
    {!items && !error ? <Spinner text="Učitavanje prijava…" /> : items?.length === 0 ? (
      <div className="empty-state">
        <div className="empty-state-icon"><Briefcase size={30} strokeWidth={1.5} aria-hidden="true" /></div>
        <p>Još nema prijava. Stižu iz upitnika na stranici O nama.</p>
      </div>
    ) : (
      <div className="job-applications">
        {items?.map((item) => (
          <article key={item.id} className="job-application">
            <header>
              <div><h3>{item.full_name}</h3><a href={`tel:${item.phone}`}>{item.phone}</a>{item.email && <span> · {item.email}</span>}</div>
              <time>{formatTimestampDateLatn(item.created_at, true)}</time>
            </header>
            <dl>
              <div><dt>Stručna sprema</dt><dd>{item.degree}</dd></div>
              <div><dt>Iskustvo</dt><dd>{item.experience || "—"}</dd></div>
              <div className="wide"><dt>Predmeti</dt><dd>{item.subjects}</dd></div>
              {item.about && <div className="wide"><dt>O sebi</dt><dd>{item.about}</dd></div>}
            </dl>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => download(item)}><Download size={15} aria-hidden="true" /> CV: {item.cv_original_name}</button>
          </article>
        ))}
      </div>
    )}
  </div>;
}
