export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8002").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function detailToMessage(detail) {
  if (typeof detail === "string") return detail;
  // Greške sa kodom, npr. { code: "account_exists", message: "…" }; kod ostaje u ApiError.details.code.
  if (detail && typeof detail === "object" && typeof detail.message === "string") return detail.message;
  if (Array.isArray(detail)) {
    const message = detail
      .map((item) => item?.msg || item?.message || JSON.stringify(item))
      .join("; ");
    if (/valid email address/i.test(message)) return "Unesite ispravnu email adresu.";
    return message;
  }
  return "Došlo je do greške. Pokušajte ponovo.";
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      if (externalSignal?.aborted) throw error;
      throw new ApiError("Server se nije odazvao na vreme. Pokušajte ponovo.", 0);
    }
    throw new ApiError(
      "Ne možemo da se povežemo sa serverom. Proverite vezu i pokušajte ponovo.",
      0,
    );
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

async function parseError(response) {
  const payload = await response.json().catch(() => ({}));
  return new ApiError(
    detailToMessage(payload.detail) || `HTTP ${response.status}`,
    response.status,
    payload.detail,
  );
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return null;
  return response.json();
}

async function downloadBlob(endpoint, filenameFallback = "prilog") {
  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetchWithTimeout(`${API_URL}${endpoint}`, { headers });
  if (!response.ok) throw await parseError(response);

  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = filenameFallback;
  const match = contentDisposition
    ? /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(contentDisposition)
    : null;
  if (match) {
    try {
      filename = decodeURIComponent(match[1].replace(/"/g, "").trim());
    } catch {
      filename = filenameFallback;
    }
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export const api = {
  get: (endpoint, options = {}) => request(endpoint, options),
  post: (endpoint, data, options = {}) =>
    request(endpoint, { ...options, method: "POST", body: JSON.stringify(data) }),
  postFormData: (endpoint, formData, options = {}) =>
    request(endpoint, { ...options, method: "POST", body: formData }),
  patch: (endpoint, data, options = {}) =>
    request(endpoint, {
      ...options,
      method: "PATCH",
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: "DELETE" }),
  downloadBlob,
};

export default api;
