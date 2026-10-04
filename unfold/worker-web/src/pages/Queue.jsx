import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import VerificationPending from './VerificationPending.jsx';
import {
  EmptyState,
  LanguageChip,
  StatusChip,
  TopicChips,
  WaitingBadge,
  formatDateTime,
} from '../components/Chips.jsx';

/**
 * Times a case was returned to the queue. The server increments
 * claim_count both on every successful claim AND on every return
 * (student rematch or sweeper timeout), so a queued/rematch case has an
 * even claim_count and the return count is half of it.
 */
function rematchCount(claimCount) {
  return Math.floor((claimCount || 0) / 2);
}

/**
 * Matched case queue. The server matches cases to this worker by language,
 * expertise ('general' matches everything) and remaining capacity.
 */
export default function Queue() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notVerified, setNotVerified] = useState(false);
  const [notice, setNotice] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api('/worker/queue');
      setData(d);
    } catch (err) {
      if (err.code === 'not_verified') {
        setNotVerified(true);
      } else {
        setError('Could not load the queue. Is the server running?');
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(caseId) {
    setClaimingId(caseId);
    setNotice(null);
    try {
      const d = await api(`/worker/cases/${caseId}/claim`, { method: 'POST' });
      navigate(`/cases/${d.case.id}`);
    } catch (err) {
      if (err.code === 'already_claimed') {
        setNotice('This case was just claimed by another worker.');
      } else if (err.code === 'capacity_reached') {
        setNotice('You are at capacity and cannot claim more cases right now.');
      } else {
        setNotice('Could not claim this case. Please try again.');
      }
      load();
    } finally {
      setClaimingId(null);
    }
  }

  if (notVerified) return <VerificationPending />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p className="muted">Loading queue…</p>;

  const { cases, atCapacity, activeCount, maxActive } = data;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Case queue</h1>
        <span className="muted">
          Active cases: {activeCount} / {maxActive}
        </span>
      </div>

      {atCapacity && (
        <div className="alert alert-warn">
          You are at capacity ({activeCount}/{maxActive} active cases). New matches
          will appear once you have free capacity.
        </div>
      )}
      {notice && <div className="alert alert-info">{notice}</div>}

      {cases.length === 0 && !atCapacity ? (
        <EmptyState title="No cases match you right now">
          New cases are matched on your languages and expertise. Check back later,
          or widen your profile settings.
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
                  <WaitingBadge waitingHours={c.waitingHours} thresholdHours={72} />
                  {rematchCount(c.claim_count) > 0 && (
                    <span className="badge badge-amber" title="Previously claimed and returned to the queue">
                      rematch ×{rematchCount(c.claim_count)}
                    </span>
                  )}
                </span>
              </div>
              <TopicChips topics={c.topics} />
              {c.main_concerns && <p className="case-summary">{c.main_concerns}</p>}
              <div className="case-card-foot">
                <span className="muted small">Queued {formatDateTime(c.created_at)}</span>
                <button
                  className="btn btn-primary"
                  disabled={atCapacity || claimingId === c.id}
                  title={atCapacity ? 'You are at capacity' : 'Claim this case'}
                  onClick={() => claim(c.id)}
                >
                  {claimingId === c.id
                    ? 'Claiming…'
                    : atCapacity
                      ? 'You are at capacity'
                      : 'Claim'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
