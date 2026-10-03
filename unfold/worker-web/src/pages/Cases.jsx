import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import VerificationPending from './VerificationPending.jsx';
import {
  EmptyState,
  LanguageChip,
  StatusChip,
  TopicChips,
  formatDateTime,
} from '../components/Chips.jsx';

/** "My Cases" — the worker's active cases (claimed / replied / continued). */
export default function Cases() {
  const [cases, setCases] = useState(null);
  const [error, setError] = useState(null);
  const [notVerified, setNotVerified] = useState(false);

  useEffect(() => {
    api('/worker/cases')
      .then((d) => setCases(d.cases))
      .catch((err) => {
        if (err.code === 'not_verified') setNotVerified(true);
        else setError('Could not load your cases. Is the server running?');
      });
  }, []);

  if (notVerified) return <VerificationPending />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!cases) return <p className="muted">Loading your cases…</p>;

  return (
    <div className="page">
      <div className="page-head">
        <h1>My cases</h1>
        <Link className="btn btn-ghost" to="/queue">
          Browse queue
        </Link>
      </div>

      {cases.length === 0 ? (
        <EmptyState title="You have no active cases">
          Claim a case from the queue to start supporting a student.
        </EmptyState>
      ) : (
        <ul className="card-list">
          {cases.map((c) => (
            <li key={c.id} className="card case-card">
              <div className="case-card-head">
                <span className="case-period">{c.period || 'Period unknown'}</span>
                <span className="chip-row">
                  <StatusChip status={c.status} />
                  <LanguageChip language={c.language} />
                </span>
              </div>
              <TopicChips topics={c.topics} />
              {c.main_concerns && <p className="case-summary">{c.main_concerns}</p>}
              {c.lastMessage && (
                <p className="last-message">
                  <span className="muted small">
                    Last message ({c.lastMessage.sender === 'worker' ? 'you' : 'student'},{' '}
                    {formatDateTime(c.lastMessage.created_at)}):
                  </span>{' '}
                  {c.lastMessage.text}
                </p>
              )}
              <div className="case-card-foot">
                <span className="muted small">Updated {formatDateTime(c.updated_at)}</span>
                <Link className="btn btn-secondary" to={`/cases/${c.id}`}>
                  Open case
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
