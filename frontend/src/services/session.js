/**
 * Jedna prijavljena uloga u isto vreme (token + role u localStorage), plus "vezani" tokeni
 * za osobu koja je i profesor i admin: prebacivanje između panela bez nove prijave.
 */
const TOKEN = "token";
const ROLE = "role";
const LINKED = "linkedTokens";

export const ROLE_HOME = { student: "/ucenik/panel", teacher: "/teacher/dashboard", admin: "/admin/dashboard" };
export const ROLE_LOGIN = { student: "/ucenik/prijava", teacher: "/teacher/login", admin: "/admin/login" };
export const ROLE_LABEL = { student: "Učenik", teacher: "Profesor", admin: "Administrator" };

function readLinked() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LINKED) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** { token, role, linked: { admin?: token, teacher?: token } } ili null kada niko nije prijavljen. */
export function getSession() {
  const token = localStorage.getItem(TOKEN);
  const role = localStorage.getItem(ROLE);
  return token && role ? { token, role, linked: readLinked() } : null;
}

export const isSignedInAs = (role) => getSession()?.role === role;

/** Posle uspešne prijave: `data` je odgovor na login (admin, profesor, učenik) ili na registraciju učenika. */
export function startSession(role, data) {
  const linked = { ...(data.linked_tokens || {}) };
  delete linked[role];
  localStorage.setItem(TOKEN, data.access_token);
  localStorage.setItem(ROLE, role);
  localStorage.setItem(LINKED, JSON.stringify(linked));
}

/** Prebaci se na drugu ulogu iste osobe. Vraća false ako za nju nema vezanog tokena. */
export function switchRole(targetRole) {
  const session = getSession();
  const token = session?.linked?.[targetRole];
  if (!token) return false;
  const linked = { ...session.linked, [session.role]: session.token };
  delete linked[targetRole];
  localStorage.setItem(TOKEN, token);
  localStorage.setItem(ROLE, targetRole);
  localStorage.setItem(LINKED, JSON.stringify(linked));
  return true;
}

export function endSession() {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem(ROLE);
  localStorage.removeItem(LINKED);
}
