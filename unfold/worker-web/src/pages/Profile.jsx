import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXPERTISE_OPTIONS, LANGUAGE_OPTIONS, useAuth } from '../auth.jsx';

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Edit languages / expertise / capacity (PATCH /api/workers/me) and log out. */
export default function Profile() {
  const { worker, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [languages, setLanguages] = useState(worker.languages || []);
  const [expertise, setExpertise] = useState(worker.expertise || []);
  const [maxActive, setMaxActive] = useState(worker.max_active || 5);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (languages.length === 0) return setError('Select at least one language.');
    if (expertise.length === 0) return setError('Select at least one area of expertise.');
    setBusy(true);
    try {
      await updateProfile({
        languages,
        expertise,
        max_active: Number(maxActive),
      });
      setMessage('Profile saved.');
    } catch (err) {
      setError(
        err.body && err.body.error
          ? `Could not save: ${err.body.error}`
          : 'Could not save your profile. Is the server running?'
      );
    } finally {
      setBusy(false);
    }
  }

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Profile</h1>
        <button className="btn btn-ghost" onClick={onLogout}>
          Log out
        </button>
      </div>

      <section className="card">
        <dl className="summary-grid">
          <div>
            <dt>Name</dt>
            <dd>{worker.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{worker.email}</dd>
          </div>
          <div>
            <dt>Organisation</dt>
            <dd>{worker.organisation || '—'}</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd>
              {worker.verified ? (
                <span className="badge badge-green">verified</span>
              ) : (
                <span className="badge badge-amber">pending verification</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <form className="card" onSubmit={onSubmit}>
        <h2>Case matching preferences</h2>
        <p className="muted small">
          The queue matches cases to your languages and expertise, up to your
          maximum number of active cases.
        </p>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <fieldset className="field checkbox-group">
          <legend>Languages you can support</legend>
          {LANGUAGE_OPTIONS.map((opt) => (
            <label key={opt.value} className="checkbox">
              <input
                type="checkbox"
                checked={languages.includes(opt.value)}
                onChange={() => setLanguages(toggle(languages, opt.value))}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="field checkbox-group">
          <legend>Areas of expertise</legend>
          {EXPERTISE_OPTIONS.map((opt) => (
            <label key={opt.value} className="checkbox">
              <input
                type="checkbox"
                checked={expertise.includes(opt.value)}
                onChange={() => setExpertise(toggle(expertise, opt.value))}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>

        <label className="field">
          <span>Maximum active cases (1–20)</span>
          <input
            type="number"
            min={1}
            max={20}
            required
            value={maxActive}
            onChange={(e) => setMaxActive(e.target.value)}
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
