import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EXPERTISE_OPTIONS, LANGUAGE_OPTIONS, useAuth } from '../auth.jsx';

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [languages, setLanguages] = useState(['zh-HK']);
  const [expertise, setExpertise] = useState(['general']);
  const [maxActive, setMaxActive] = useState(5);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (languages.length === 0) return setError('Select at least one language.');
    if (expertise.length === 0) return setError('Select at least one area of expertise.');
    setBusy(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        organisation: organisation.trim(),
        languages,
        expertise,
        maxActive: Number(maxActive),
      });
      // New accounts are unverified; routing to /queue renders the
      // VerificationPending screen until the organisation verifies us.
      navigate('/queue', { replace: true });
    } catch (err) {
      if (err.code === 'email_already_registered') {
        setError('This email is already registered. Try signing in instead.');
      } else if (err.body && err.body.error) {
        setError(`Registration failed: ${err.body.error}`);
      } else {
        setError('Could not register. Is the server running?');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Register</h1>
        <p className="muted">
          Your organisation must verify your account before you can pick up cases.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password (min. 8 characters)</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Full name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Organisation</span>
          <input value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
        </label>

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
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="muted small">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
