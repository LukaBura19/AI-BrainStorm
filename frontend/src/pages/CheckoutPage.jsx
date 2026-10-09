import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, Lock, PlayCircle, Receipt, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import api from "../services/api";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import JourneyProgress from "../components/JourneyProgress";
import { formatTimestampDateLatn } from "../utils/srLatnDates";
import { plural } from "../utils/plural";
import "./CheckoutPage.css";

const STEPS = ["Podaci", "Plaćanje", "Gotovo"];
// Lažni procesor na backendu prihvata ovu karticu (payment_service.TEST_CARDS).
const TEST_CARD = { number: "4242 4242 4242 4242", exp: "12/30", cvc: "123" };
const EMPTY_CARD = { number: "", holder: "", exp: "", cvc: "" };
const FIELD_IDS = {
  fullName: "checkout-name", email: "checkout-email", password: "checkout-password",
  number: "checkout-card-number", holder: "checkout-card-holder", exp: "checkout-card-exp", cvc: "checkout-card-cvc",
};
const STEP_FOCUS = { 1: FIELD_IDS.fullName, 2: FIELD_IDS.number, 3: "checkout-step-title" };

const digits = (value) => value.replace(/\D/g, "");
const groupCard = (value) => digits(value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
/** „5“ → „05“, „123“ → „12/3“: mesec uvek ima dve cifre, kosa crta stiže sama. */
function groupExp(value) {
  const raw = digits(value);
  const d = (raw.length === 1 && raw > "1" ? `0${raw}` : raw).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** 4 → Visa; 51–55 ili 2221–2720 → Mastercard (isto kao na backendu). */
function cardBrand(number) {
  const d = digits(number);
  if (d.startsWith("4")) return "Visa";
  const two = Number(d.slice(0, 2));
  const four = Number(d.slice(0, 4));
  if ((d.length >= 2 && two >= 51 && two <= 55) || (d.length >= 4 && four >= 2221 && four <= 2720)) return "Mastercard";
  return "";
}

function validateDetails({ fullName, email, password }) {
  const errors = {};
  if (fullName.trim().length < 2) errors.fullName = "Unesi ime i prezime.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Unesi ispravnu email adresu.";
  if (password.length < 8) errors.password = "Lozinka mora imati najmanje 8 karaktera.";
  return errors;
}

function validateCard(card) {
  const errors = {};
  if (digits(card.number).length !== 16) errors.number = "Broj kartice ima 16 cifara.";
  if (card.holder.trim().length < 2) errors.holder = "Unesi ime kako piše na kartici.";
  const [mm, yy] = card.exp.split("/");
  const month = Number(mm);
  const year = 2000 + Number(yy);
  const now = new Date();
  if (!(mm?.length === 2 && yy?.length === 2 && month >= 1 && month <= 12)) errors.exp = "Unesi datum u obliku MM/GG, npr. 12/30.";
  else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.exp = "Kartica je istekla.";
  if (!/^\d{3,4}$/.test(card.cvc)) errors.cvc = "CVC je trocifreni broj sa poleđine kartice.";
  return errors;
}

/** Platna kartica koja se popunjava dok učenik kuca; fokus na CVC je okreće na poleđinu. */
function CardPreview({ card, flipped }) {
  const brand = cardBrand(card.number);
  const number = digits(card.number);
  const groups = [0, 1, 2, 3].map((i) => number.slice(i * 4, i * 4 + 4).padEnd(4, "•"));
  return (
    <div className={`checkout-card3d ${flipped ? "is-flipped" : ""}`} aria-hidden="true">
      <div className="checkout-card3d-inner">
        <div className="checkout-card3d-face checkout-card3d-front" data-brand={brand}>
          <span className="checkout-card3d-chip" />
          <span className="checkout-card3d-brand">{brand === "Mastercard" ? <span className="checkout-card3d-mc"><i /><i /></span> : brand || "Kartica"}</span>
          <span className="checkout-card3d-number">{groups.map((group, i) => <span key={i}>{group}</span>)}</span>
          <span className="checkout-card3d-row">
            <span><small>Ime na kartici</small><strong>{card.holder.trim().toUpperCase() || "IME PREZIME"}</strong></span>
            <span><small>Važi do</small><strong>{card.exp || "MM/GG"}</strong></span>
          </span>
        </div>
        <div className="checkout-card3d-face checkout-card3d-back">
          <span className="checkout-card3d-stripe" />
          <span className="checkout-card3d-sign"><i>{card.cvc || "•••"}</i></span>
          <small>CVC</small>
        </div>
      </div>
    </div>
  );
}

function SuccessMark() {
  return (
    <svg className="checkout-mark" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="33" />
      <path d="M22 37.5 31.5 47 50 27" />
    </svg>
  );
}

/** Plaćanje pristupa snimcima jedne pripreme: podaci → kartica → račun. Nalog se pravi tek kad naplata prođe. */
export default function CheckoutPage({ exam }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState({ fullName: "", email: "", password: "" });
  const [card, setCard] = useState(EMPTY_CARD);
  const [errors, setErrors] = useState({});
  const [flipped, setFlipped] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [result, setResult] = useState(null);
  const [owned, setOwned] = useState(false);
  const focusNext = useRef(null);

  const signedIn = Boolean(data?.access.signed_in);
  const checkoutPath = `/${exam}/kupovina`;
  const loginHref = `/ucenik/prijava?dalje=${checkoutPath}`;

  useEffect(() => {
    let active = true;
    setData(null); setMe(null); setLoadError(""); setStep(1); setResult(null); setOwned(false); setPayError(null); setErrors({});
    api.get(`/public/prep/${exam}`)
      .then(async (prep) => {
        if (!active) return;
        if (prep.access.signed_in) {
          const student = await api.get("/student/me").catch(() => null);
          if (active) setMe(student);
        } else if (localStorage.getItem("role") === "student") {
          // Istekao učenički token: skloni ga, kupovina ide kao za novog učenika.
          localStorage.removeItem("token"); localStorage.removeItem("role");
        }
        if (active) { setData(prep); setOwned(prep.access.purchased); }
      })
      .catch((err) => { if (active) setLoadError(err.status === 404 ? "Ova priprema ne postoji." : err.message); });
    return () => { active = false; };
  }, [exam, reload]);

  // Posle prelaska na drugi korak: tok se vraća u vidno polje, a fokus ide na prvo polje.
  // Pri prvom učitavanju nema fokusa, da telefon sam ne otvori tastaturu.
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return undefined;
    focusNext.current = null;
    const timer = window.setTimeout(() => {
      const flow = document.getElementById("checkout-flow");
      if (flow && flow.getBoundingClientRect().top < 80) flow.scrollIntoView({ block: "start" });
      document.getElementById(id)?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [step, owned]);

  const goTo = (next, focusId) => {
    focusNext.current = focusId || (next === 1 && signedIn ? "checkout-continue" : STEP_FOCUS[next]);
    setPayError(null);
    setStep(next);
  };

  // Ista adresa, nova stavka istorije: Layout ponovo čita token, pa meni pokazuje „Moj panel“ ili „Prijava“.
  const refreshHeader = () => navigate(checkoutPath, { replace: true });

  const clearError = (key) => setErrors((prev) => {
    if (!prev[key]) return prev;
    const rest = { ...prev };
    delete rest[key];
    return rest;
  });
  const setDetail = (key) => (event) => { setDetails((prev) => ({ ...prev, [key]: event.target.value })); clearError(key); };
  const setCardField = (key, format = (value) => value) => (event) => { setCard((prev) => ({ ...prev, [key]: format(event.target.value) })); clearError(key); };
  const fieldProps = (key, hintId) => ({
    id: FIELD_IDS[key],
    className: `input ${errors[key] ? "error" : ""}`,
    required: true,
    "aria-invalid": errors[key] ? "true" : undefined,
    "aria-describedby": errors[key] ? `${FIELD_IDS[key]}-error` : hintId,
  });
  const fieldError = (key) => errors[key] && <p className="form-error" id={`${FIELD_IDS[key]}-error`}>{errors[key]}</p>;
  const focusFirstError = (found) => {
    const first = Object.keys(found)[0];
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
    return Boolean(first);
  };

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    refreshHeader();
    setReload((n) => n + 1);
  };

  const submitDetails = (event) => {
    event.preventDefault();
    const found = signedIn ? {} : validateDetails(details);
    setErrors(found);
    if (!focusFirstError(found)) goTo(2);
  };

  const changeEmail = () => {
    goTo(1, FIELD_IDS.email);
    setErrors({ email: "Na ovu adresu već postoji nalog. Prijavi se ili unesi drugu adresu." });
  };

  const fillTestCard = () => {
    const name = (signedIn ? me?.full_name : details.fullName) || "";
    setCard({ ...TEST_CARD, holder: name.trim().toUpperCase() || "ANA PROBA" });
    setErrors({});
    setPayError(null);
    document.getElementById("checkout-pay")?.focus();
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (paying) return;
    const found = validateCard(card);
    setErrors(found);
    setPayError(null);
    if (focusFirstError(found)) return;
    const [mm, yy] = card.exp.split("/");
    const body = {
      card: { number: card.number, exp_month: Number(mm), exp_year: Number(yy), cvc: card.cvc, holder_name: card.holder.trim() },
      ...(signedIn ? {} : { full_name: details.fullName.trim(), email: details.email.trim(), password: details.password }),
    };
    setPaying(true);
    try {
      const paid = await api.post(`/public/prep/${exam}/checkout`, body);
      localStorage.setItem("token", paid.access_token);
      localStorage.setItem("role", "student");
      setResult(paid);
      setCard(EMPTY_CARD); // podaci kartice ne ostaju u memoriji posle plaćanja
      refreshHeader();
      goTo(3);
    } catch (err) {
      if (err.details?.code === "already_purchased") { focusNext.current = "checkout-open"; setOwned(true); return; }
      setPayError({ code: err.details?.code, message: err.message || "Plaćanje nije prošlo. Pokušaj ponovo." });
    } finally {
      setPaying(false);
    }
  };

  if (loadError) {
    return (
      <div className="checkout-page checkout-page--state">
        <Alert type="error">{loadError}</Alert>
        <Link to={`/${exam}`} className="btn btn-secondary"><ArrowLeft size={16} aria-hidden="true" /> Nazad na snimke</Link>
      </div>
    );
  }
  if (!data) return <div className="checkout-page checkout-page--state"><Spinner text="Učitavam ponudu…" /></div>;

  const { title, access } = data;
  const lectureCount = data.subjects.reduce((sum, subject) => sum + subject.groups.reduce((inner, group) => inner + group.lectures.length, 0), 0);
  const price = `${access.price_eur} €`;
  const accountEmail = signedIn ? me?.email : details.email.trim();
  const stepValues = [signedIn ? me?.full_name : details.fullName.trim(), result ? `${result.purchase.card_brand} •••• ${result.purchase.card_last4}` : ""];
  const heading = owned ? "Snimci su već tvoji" : result ? "Snimci su otključani" : "Otključaj sve snimke";

  return (
    <div className="checkout-page">
      <nav className="checkout-crumbs" aria-label="Putanja">
        <Link to={`/${exam}`}><ArrowLeft size={16} aria-hidden="true" /> {title}</Link>
      </nav>
      <h1 className="checkout-title">{heading}</h1>

      <div className={`checkout-layout ${owned ? "checkout-layout--single" : ""}`}>
        <div className="checkout-flow" id="checkout-flow">
          {owned ? (
            <section className="checkout-panel checkout-owned" aria-labelledby="checkout-owned-title">
              <span className="checkout-owned-icon"><BadgeCheck size={30} strokeWidth={1.8} aria-hidden="true" /></span>
              <h2 id="checkout-owned-title">Već imaš pristup</h2>
              <p>Paket {title} je vezan za {accountEmail ? <>nalog <strong>{accountEmail}</strong></> : "tvoj nalog"} i važi bez ograničenja, pa nema šta da se plaća ponovo.</p>
              <div className="checkout-actions">
                <Link to={`/${exam}`} className="btn btn-primary btn-lg" id="checkout-open"><PlayCircle size={19} aria-hidden="true" /> Otvori snimke</Link>
                <Link to="/ucenik/panel" className="btn btn-secondary btn-lg">Moj panel</Link>
              </div>
            </section>
          ) : (
            <>
              <JourneyProgress steps={STEPS} currentStep={step} values={stepValues} onStepClick={step < 3 && !paying ? (next) => goTo(next) : undefined} />

              {step === 1 && (
                <form className="checkout-panel" onSubmit={submitDetails} noValidate aria-labelledby="checkout-step-title">
                  {signedIn ? (
                    <>
                      <h2 id="checkout-step-title">Kupuješ sa naloga</h2>
                      <div className="checkout-account">
                        <span className="checkout-account-icon"><UserRound size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                        <span><strong>{me?.full_name || "Učenik"}</strong><small>{me?.email}</small></span>
                      </div>
                      <p className="checkout-note">Snimci se vezuju za ovaj nalog čim plaćanje prođe.</p>
                      <div className="checkout-actions">
                        <button type="submit" className="btn btn-primary btn-lg" id="checkout-continue">Nastavi na plaćanje <ArrowRight size={18} aria-hidden="true" /></button>
                        <p className="checkout-aside-link">Nisi ti? <button type="button" onClick={signOut}>Odjavi se</button></p>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 id="checkout-step-title">Tvoji podaci</h2>
                      <p className="checkout-note">Čim plaćanje prođe, napravićemo ti učenički nalog sa ovim podacima. Snimke posle gledaš kad se prijaviš na njega.</p>
                      <div className="form-group">
                        <label className="form-label" htmlFor={FIELD_IDS.fullName}>Ime i prezime <span className="required" aria-hidden="true">*</span></label>
                        <input {...fieldProps("fullName")} value={details.fullName} onChange={setDetail("fullName")} autoComplete="name" placeholder="Npr. Ana Jovanović" />
                        {fieldError("fullName")}
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor={FIELD_IDS.email}>Email <span className="required" aria-hidden="true">*</span></label>
                        <input {...fieldProps("email")} type="email" value={details.email} onChange={setDetail("email")} autoComplete="email" inputMode="email" placeholder="ana@email.com" />
                        {fieldError("email")}
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor={FIELD_IDS.password}>Lozinka za nalog <span className="required" aria-hidden="true">*</span></label>
                        <input {...fieldProps("password", "checkout-password-hint")} type="password" value={details.password} onChange={setDetail("password")} autoComplete="new-password" placeholder="Najmanje 8 karaktera" />
                        {errors.password ? fieldError("password") : <p className="form-hint" id="checkout-password-hint">Sa ovom lozinkom se posle prijavljuješ na nalog.</p>}
                      </div>
                      <div className="checkout-actions">
                        <button type="submit" className="btn btn-primary btn-lg">Nastavi na plaćanje <ArrowRight size={18} aria-hidden="true" /></button>
                        <p className="checkout-aside-link">Već imaš nalog? <Link to={loginHref}>Prijavi se</Link></p>
                      </div>
                    </>
                  )}
                </form>
              )}

              {step === 2 && (
                <form className="checkout-panel" onSubmit={submitPayment} noValidate aria-labelledby="checkout-step-title" aria-busy={paying}>
                  <h2 id="checkout-step-title">Platna kartica</h2>
                  <CardPreview card={card} flipped={flipped} />
                  <div className="checkout-testmode">
                    <ShieldCheck size={18} strokeWidth={1.9} aria-hidden="true" />
                    <p><strong>Test režim.</strong> Ništa se ne naplaćuje, a prolazi kartica <span className="checkout-nowrap">4242 4242 4242 4242</span>.</p>
                    <button type="button" className="checkout-testfill" onClick={fillTestCard} disabled={paying}><Sparkles size={15} strokeWidth={2} aria-hidden="true" /> Popuni test karticu</button>
                  </div>
                  {payError && (
                    <Alert type="error" onClose={() => setPayError(null)}>
                      <p>{payError.message}</p>
                      {payError.code === "account_exists" && (
                        <p className="checkout-alert-actions">
                          <Link to={loginHref}>Prijavi se <ArrowRight size={14} aria-hidden="true" /></Link>
                          <button type="button" onClick={changeEmail}>Promeni email</button>
                        </p>
                      )}
                    </Alert>
                  )}
                  <div className="form-group">
                    <label className="form-label" htmlFor={FIELD_IDS.number}>Broj kartice <span className="required" aria-hidden="true">*</span></label>
                    <input {...fieldProps("number")} className={`${fieldProps("number").className} checkout-input-number`} value={card.number} onChange={setCardField("number", groupCard)} inputMode="numeric" autoComplete="cc-number" maxLength={19} placeholder="0000 0000 0000 0000" />
                    {fieldError("number")}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor={FIELD_IDS.holder}>Ime na kartici <span className="required" aria-hidden="true">*</span></label>
                    <input {...fieldProps("holder")} value={card.holder} onChange={setCardField("holder")} autoComplete="cc-name" autoCapitalize="characters" placeholder="ANA JOVANOVIĆ" />
                    {fieldError("holder")}
                  </div>
                  <div className="checkout-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor={FIELD_IDS.exp}>Važi do <span className="required" aria-hidden="true">*</span></label>
                      <input {...fieldProps("exp")} value={card.exp} onChange={setCardField("exp", groupExp)} inputMode="numeric" autoComplete="cc-exp" maxLength={5} placeholder="MM/GG" />
                      {fieldError("exp")}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={FIELD_IDS.cvc}>CVC <span className="required" aria-hidden="true">*</span></label>
                      <input {...fieldProps("cvc")} value={card.cvc} onChange={setCardField("cvc", (value) => digits(value).slice(0, 4))} onFocus={() => setFlipped(true)} onBlur={() => setFlipped(false)} inputMode="numeric" autoComplete="cc-csc" maxLength={4} placeholder="123" />
                      {fieldError("cvc")}
                    </div>
                  </div>
                  <button type="submit" id="checkout-pay" className="btn btn-primary btn-lg checkout-paybtn" disabled={paying}>
                    {paying ? <><span className="checkout-spinner" aria-hidden="true" /> Obrađujem plaćanje…</> : <><Lock size={18} aria-hidden="true" /> Plati {price}</>}
                  </button>
                  {!signedIn && accountEmail && <p className="checkout-fineprint">Nalog se pravi na adresi {accountEmail}.</p>}
                </form>
              )}

              {step === 3 && result && (
                <section className="checkout-panel checkout-done" aria-labelledby="checkout-step-title">
                  <SuccessMark />
                  <h2 id="checkout-step-title" tabIndex={-1}>Hvala na uplati</h2>
                  <p>Paket {title} je aktivan i svi snimci su ti dostupni odmah. Potvrdu smo poslali na <strong>{result.student.email}</strong>.</p>
                  {result.account_created && <p className="checkout-done-account"><UserRound size={16} strokeWidth={2} aria-hidden="true" /> Napravili smo ti učenički nalog. Prijavljuješ se ovim emailom i lozinkom iz prvog koraka.</p>}
                  <dl className="checkout-receipt">
                    <div><dt><Receipt size={15} aria-hidden="true" /> Broj računa</dt><dd>{result.purchase.receipt_number}</dd></div>
                    <div><dt>Paket</dt><dd>{result.purchase.exam.name}, svi snimci</dd></div>
                    <div><dt>Kartica</dt><dd>{result.purchase.card_brand} •••• {result.purchase.card_last4}</dd></div>
                    <div><dt>Iznos</dt><dd>{result.purchase.amount_eur} €</dd></div>
                    <div><dt>Datum</dt><dd>{formatTimestampDateLatn(result.purchase.paid_at)}</dd></div>
                  </dl>
                  <div className="checkout-actions">
                    <Link to={`/${exam}`} className="btn btn-primary btn-lg" id="checkout-open"><PlayCircle size={19} aria-hidden="true" /> Otvori snimke</Link>
                    <Link to="/ucenik/panel" className="btn btn-secondary btn-lg">Moj panel</Link>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {!owned && (
          <aside className={`checkout-summary ${result ? "is-paid" : ""}`} aria-labelledby="checkout-summary-title">
            <h2 id="checkout-summary-title">{title}</h2>
            <p className="checkout-summary-count"><PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" /> {lectureCount} {plural(lectureCount, "snimak", "snimka", "snimaka")} sa zadacima</p>
            <ul className="checkout-summary-list">
              {access.includes.map((item) => <li key={item}><Check size={16} strokeWidth={2.4} aria-hidden="true" /> {item}</li>)}
            </ul>
            <div className="checkout-summary-price">
              <strong>{price}</strong>
              {result
                ? <span className="checkout-summary-paid"><Check size={14} strokeWidth={2.8} aria-hidden="true" /> Plaćeno</span>
                : <span>jednokratno, bez pretplate</span>}
            </div>
            <p className="checkout-summary-fine"><ShieldCheck size={14} aria-hidden="true" /> Test režim: kartica se ne naplaćuje</p>
          </aside>
        )}
      </div>
    </div>
  );
}
