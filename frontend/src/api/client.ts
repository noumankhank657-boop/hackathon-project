const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const SESSION_KEY = "hcm-session";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === "string" ? parsed.token : null;
  } catch {
    return null;
  }
}

function notifyUnauthorized() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hcm:unauthorized"));
  }
}

async function parseError(response: Response) {
  const text = await response.text();
  if (!text) return new ApiError(`Request failed (${response.status})`, response.status);
  try {
    const body = JSON.parse(text) as { error?: unknown; details?: unknown };
    const message = typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    return new ApiError(message, response.status, body.details);
  } catch {
    return new ApiError(text, response.status);
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && token) notifyUnauthorized();
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function requestBlob(path: string, filename: string): Promise<void> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (response.status === 401 && token) notifyUnauthorized();
  if (!response.ok) throw await parseError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function queryString(values: Record<string, string | number | boolean | undefined | null>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}
