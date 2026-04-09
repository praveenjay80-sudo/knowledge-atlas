const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export async function fetchJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text;

    try {
      const parsed = JSON.parse(text);
      detail = parsed.detail || text;
    } catch {
      detail = text;
    }

    throw new Error(detail || `Request failed for ${path}`);
  }
  return response.json();
}
