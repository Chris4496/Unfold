import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import VerificationPending from './VerificationPending.jsx';
import { LanguageChip, TopicChips, formatDateTime } from '../components/Chips.jsx';
import { awaitingWorkerReplyCount, buildRecentActivity } from '../viewModel.js';

export default function Dashboard() {
  const { worker } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notVerified, setNotVerified] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    setNotVerified(false);
    Promise.all([
      api('/worker/queue', { signal: controller.signal }),
      api('/worker/cases', { signal: controller.signal }),
    ])
      .then(([queue, owned]) => setData({ queue, cases: owned.cases || [] }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (err.code === 'not_verified') setNotVerified(true);
        else setError('Could not load your dashboard. Please try again.');
      });
    return () => controller.abort();
  }, [reloadKey]);

  if (notVerified) return <VerificationPending />;
  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error" role="alert">{error}</div>
        <button className="btn btn-secondary" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
      </div>
    );
  }
  if (!data) return <p className="muted" role="status">Loading your dashboard…</p>;

  const { queue, cases } = data;
  const queuedCases = queue.cases || [];
  const awaitingReply = awaitingWorkerReplyCount(cases);
  const activity = buildRecentActivity(cases, queuedCases);

  return (
    <div className="page dashboard-page">
      <div className="dashboard-heading">
        <div>
          <h1>Welcome, {worker.name}</h1>
          <p className="muted">Your support workspace</p>
        </div>
        <p className="privacy-note"><span aria-hidden="true">◆</span> Only student-approved, de-identified case information is shown.</p>
      </div>

      <section className="metric-grid" aria-label="Case overview">
        <Link className="metric-card" to="/cases" aria-label={`Active cases: ${queue.activeCount} of ${queue.maxActive}. View my cases`}>
          <span className="metric-icon metric-blue" aria-hidden="true">●</span>
          <span className="metric-copy"><span className="metric-label">Active cases</span><strong>{queue.activeCount} / {queue.maxActive}</strong><span className="muted small">Your active case capacity</span></span>
          <span className="metric-chevron" aria-hidden="true">›</span>
        </Link>
        <Link className="metric-card" to="/queue" aria-label={`${queuedCases.length} matched cases in your queue. View case queue`}>
          <span className="metric-icon metric-violet" aria-hidden="true">▤</span>
          <span className="metric-copy"><span className="metric-label">Matched queue</span><strong>{queuedCases.length}</strong><span className="muted small">Available cases matched to you</span></span>
          <span className="metric-chevron" aria-hidden="true">›</span>
        </Link>
        <Link className="metric-card" to="/cases" aria-label={`${awaitingReply} cases awaiting your reply. View my cases`}>
          <span className="metric-icon metric-green" aria-hidden="true">↩</span>
          <span className="metric-copy"><span className="metric-label">Awaiting your reply</span><strong>{awaitingReply}</strong><span className="muted small">Students who continued the conversation</span></span>
          <span className="metric-chevron" aria-hidden="true">›</span>
        </Link>
      </section>

      {queue.atCapacity && (
        <div className="alert alert-warn">You are at capacity ({queue.activeCount}/{queue.maxActive}). You can review your active cases while no new cases are available to claim.</div>
      )}

      <div className="dashboard-panels">
        <section className="card dashboard-activity">
          <div className="section-heading"><h2>Recent activity</h2><Link to="/cases">View my cases <span aria-hidden="true">›</span></Link></div>
          <p className="muted small">Based on case timestamps and the latest message provided for each active case.</p>
          {activity.length === 0 ? (
            <p className="muted dashboard-empty">No recent activity is available yet.</p>
          ) : (
            <ol className="activity-list">
              {activity.map((item) => (
                <li key={item.id}>
                  <span className="activity-dot" aria-hidden="true" />
                  <div className="activity-body">
                    <div className="activity-topline"><strong>{item.label}</strong><time>{item.date ? formatDateTime(item.date) : 'Date not recorded'}</time></div>
                    <span className="muted small">{item.detail}</span>
                    {item.caseId ? <Link className="activity-open" to={`/cases/${item.caseId}`}>Open case</Link> : <Link className="activity-open" to={item.href}>Open queue</Link>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card dashboard-queue-preview">
          <div className="section-heading"><h2>Matched case queue</h2><Link to="/queue">View all <span aria-hidden="true">›</span></Link></div>
          {queuedCases.length === 0 ? (
            <p className="muted dashboard-empty">No matched cases are available in your queue right now.</p>
          ) : (
            <ul className="preview-list">
              {queuedCases.slice(0, 3).map((item) => (
                <li className="queue-preview-card" key={item.id}>
                  <div className="case-card-head">
                    <strong>{item.period || 'Case period not provided'}</strong>
                    <span className="chip-row"><TopicChips topics={item.topics} /><LanguageChip language={item.language} /></span>
                  </div>
                  {item.main_concerns && <p>{item.main_concerns}</p>}
                  <div className="preview-foot">
                    <span className="muted small">Shared {formatDateTime(item.created_at)}</span>
                    <Link className="btn btn-secondary" to="/queue">Review in queue</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
