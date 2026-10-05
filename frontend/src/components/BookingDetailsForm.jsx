import { FileText, Mail } from "lucide-react";
import "./BookingDetailsForm.css";

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DetailsHeading({ number, id, children }) {
  return <header className="booking-details-section-head">
    <span className="booking-details-section-number" aria-hidden="true">{number}</span>
    <h3 id={id}>{children}</h3>
  </header>;
}

function MaterialsFolder() {
  return <span className="booking-details-folder" aria-hidden="true">
    <span className="booking-details-folder-back" />
    <span className="booking-details-paper booking-details-paper--back"><i /><i /><i /></span>
    <span className="booking-details-paper booking-details-paper--front"><span>BS</span><i /><i /></span>
    <span className="booking-details-folder-front"><small>ZA TVOJ ČAS</small><span>Materijali</span><i>+</i></span>
  </span>;
}

/** Controlled booking details: parent owns all values, validation and file limits. */
export default function BookingDetailsForm({
  clientName,
  clientEmail,
  clientCategory,
  clientNote,
  formErrors,
  setClientName,
  setClientEmail,
  setClientCategory,
  setClientNote,
  setFormErrors,
  selectedSubject,
  selectedDuration,
  categories,
  attachmentFiles,
  setAttachmentFiles,
  attachmentInputRef,
  dragActive,
  setDragActive,
  addAttachments,
  maxAttachments,
}) {
  return <div className="booking-details">
    <div className="booking-details-columns">
      <section className="booking-form-panel booking-details-panel booking-details-panel--contact" aria-labelledby="booking-contact-heading">
        <DetailsHeading number="01" id="booking-contact-heading">Kontakt</DetailsHeading>
        <div className="booking-details-contact-fields">
          <div className="form-group">
            <label className="form-label" htmlFor="client-name">Ime i prezime <span className="required">*</span></label>
            <input id="client-name" className={`input ${formErrors.name ? "error" : ""}`} value={clientName} autoComplete="name" placeholder="Npr. Ana Jovanović" aria-required="true" aria-invalid={Boolean(formErrors.name)} aria-describedby={formErrors.name ? "booking-details-name-error" : undefined} onChange={(event) => { setClientName(event.target.value); setFormErrors((current) => ({ ...current, name: undefined })); }} />
            {formErrors.name && <p id="booking-details-name-error" className="form-error" role="alert">{formErrors.name}</p>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="client-email">Email adresa <span className="required">*</span></label>
            <input id="client-email" type="email" className={`input ${formErrors.email ? "error" : ""}`} value={clientEmail} autoComplete="email" inputMode="email" placeholder="ana@email.com" aria-required="true" aria-invalid={Boolean(formErrors.email)} aria-describedby={`booking-details-email-hint${formErrors.email ? " booking-details-email-error" : ""}`} onChange={(event) => { setClientEmail(event.target.value); setFormErrors((current) => ({ ...current, email: undefined })); }} />
            {formErrors.email && <p id="booking-details-email-error" className="form-error" role="alert">{formErrors.email}</p>}
          </div>
        </div>
        <div className="booking-details-contact-note"><Mail size={15} strokeWidth={1.5} aria-hidden="true" /><p id="booking-details-email-hint">Email za detalje časa i link za otkazivanje.</p></div>
      </section>

      <section className="booking-form-panel booking-details-panel booking-details-panel--learning" aria-labelledby="booking-learning-heading">
        <DetailsHeading number="02" id="booking-learning-heading">O času</DetailsHeading>
        <div className="booking-details-context">
          <div><small>Pripremamo tvoj čas</small><strong>{selectedSubject?.name}</strong></div>
          <span className="booking-details-duration"><strong>{selectedDuration}</strong> min</span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="client-category">Nivo obrazovanja <span className="required">*</span></label>
          <select id="client-category" className={`select ${formErrors.category ? "error" : ""}`} value={clientCategory} aria-required="true" aria-invalid={Boolean(formErrors.category)} aria-describedby={formErrors.category ? "booking-details-category-error" : undefined} onChange={(event) => { setClientCategory(event.target.value); setFormErrors((current) => ({ ...current, category: undefined })); }}>
            <option value="">Izaberi nivo</option>
            {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          {formErrors.category && <p id="booking-details-category-error" className="form-error" role="alert">{formErrors.category}</p>}
        </div>
        <div className="form-group booking-details-note">
          <label className="form-label" htmlFor="client-note">Šta želiš da radite? <span className="booking-optional">opciono</span></label>
          <textarea id="client-note" className="textarea" maxLength={1000} value={clientNote} placeholder="Oblast, zadatak ili cilj časa…" aria-describedby="booking-details-note-count" onChange={(event) => setClientNote(event.target.value)} />
          <p id="booking-details-note-count" className="form-hint booking-char-count">{clientNote.length}/1000</p>
        </div>
      </section>

      <section className="booking-form-panel booking-details-panel booking-details-panel--materials" aria-labelledby="booking-materials-heading">
        <DetailsHeading number="03" id="booking-materials-heading">Materijali</DetailsHeading>
        <div className="form-group booking-details-materials">
          <span id="booking-details-material-label" className="form-label">Materijal za profesora <span className="booking-optional">opciono</span></span>
          <div className={`booking-dropzone ${dragActive ? "active" : ""} ${formErrors.attachment ? "error" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }} onDrop={(event) => { event.preventDefault(); setDragActive(false); addAttachments(event.dataTransfer.files); }}>
            <input ref={attachmentInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" aria-labelledby="booking-details-material-label" aria-describedby={`booking-details-material-hint${formErrors.attachment ? " booking-details-material-error" : ""}`} onChange={(event) => { addAttachments(event.target.files); event.target.value = ""; }} />
            <MaterialsFolder />
            <p><strong>Prevuci fajlove ovde</strong> ili <button type="button" aria-describedby={`booking-details-material-hint${formErrors.attachment ? " booking-details-material-error" : ""}`} onClick={() => attachmentInputRef.current?.click()}>izaberi sa uređaja</button></p>
            <small id="booking-details-material-hint">PDF, JPG, PNG ili WEBP · do 25 MB · najviše {maxAttachments}</small>
          </div>
          {attachmentFiles.length > 0 && <>
            <div className="booking-details-files-heading"><span>Priloženi materijali</span><span>{attachmentFiles.length} / {maxAttachments}</span></div>
            <ul className="booking-file-list">{attachmentFiles.map((file, index) => <li key={`${file.name}-${file.lastModified}`}>
              <span aria-hidden="true"><FileText size={21} strokeWidth={1.4} /></span>
              <p><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></p>
              <button type="button" aria-label={`Ukloni ${file.name}`} onClick={() => setAttachmentFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}>×</button>
            </li>)}</ul>
          </>}
          {formErrors.attachment && <p id="booking-details-material-error" className="form-error" role="alert">{formErrors.attachment}</p>}
        </div>
      </section>
    </div>
    <p className="booking-details-footer"><span aria-hidden="true">*</span> Obavezna polja</p>
  </div>;
}
