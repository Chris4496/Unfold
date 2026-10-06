import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';

/** Allowed values, mirrored from server/CONTRACT.md. */
export const LANGUAGE_OPTIONS = [
  { value: 'zh-HK', label: 'Cantonese (zh-HK)' },
  { value: 'en', label: 'English (en)' },
  { value: 'zh-CN', label: 'Mandarin (zh-CN)' },
  { value: 'other', label: 'Other' },
];

export const EXPERTISE_OPTIONS = [
  { value: 'academic', label: 'Academic stress' },
  { value: 'family', label: 'Family' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'group', label: 'Group dynamics' },
  { value: 'friends', label: 'Friends' },
  { value: 'general', label: 'General (all topics)' },
];

const AuthContext = createContext(null);

const DEMO_AUTO_LOGIN = import.meta.env.DEV && import.meta.env.VITE_DEMO_AUTO_LOGIN === '1';

export function AuthProvider({ children }) {
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()) || DEMO_AUTO_LOGIN);

  // Restore an existing session, or use the seeded local demo account when
  // start-all.sh explicitly enables the local-only auto-login flag.
  useEffect(() => {
    if (!getToken()) {
      if (!DEMO_AUTO_LOGIN) return;
      login('demo.worker@unfold.local', 'demo1234')
        .catch(() => undefined)
        .finally(() => setLoading(false));
      return;
    }
    let cancelled = false;
    api('/workers/me')
      .then((data) => {
        if (!cancelled) setWorker(data.worker);
      })
      .catch(() => {
        // 401 already clears the token and redirects; other errors just
        // leave the user logged out.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email, password) {
    const data = await api('/workers/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(data.token);
    setWorker(data.worker);
    return data.worker;
  }

  async function register({ email, password, name, organisation, languages, expertise, maxActive }) {
    await api('/workers/register', {
      method: 'POST',
      body: { email, password, name, organisation },
    });
    // Registration does not return a token, so log in immediately, then
    // persist the matching preferences collected on the form.
    await login(email, password);
    const data = await api('/workers/me', {
      method: 'PATCH',
      body: { languages, expertise, max_active: maxActive },
    });
    setWorker(data.worker);
    return data.worker;
  }

  async function updateProfile(patch) {
    const data = await api('/workers/me', { method: 'PATCH', body: patch });
    setWorker(data.worker);
    return data.worker;
  }

  function logout() {
    setToken(null);
    setWorker(null);
  }

  return (
    <AuthContext.Provider value={{ worker, loading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
