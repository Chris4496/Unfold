/**
 * Fetch wrapper for the Unfold server API.
 *
 * The worker JWT is kept in localStorage and sent as a Bearer token on every
 * request. The worker-web client never sees any GenAI key — all LLM calls
 * happen server-side (see server/CONTRACT.md).
 */

const TOKEN_KEY = 'unfold.worker.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/** Error carrying the HTTP status and the server's machine-readable code. */
export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error) || `Request failed (${status})`);
    this.status = status;
    this.code = body && body.error;
    this.body = body;
  }
}

/**
 * Call the API. `path` is relative to /api, e.g. api('/worker/queue').
 * On 401 the token is cleared and the app is sent back to /login
 * (except for the auth endpoints themselves, where 401 means bad credentials).
 */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response body; data stays null.
  }

  if (res.status === 401) {
    setToken(null);
    const isAuthEndpoint =
      path.startsWith('/workers/login') || path.startsWith('/workers/register');
    if (!isAuthEndpoint && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new ApiError(401, data);
  }

  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
