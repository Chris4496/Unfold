import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import VerificationPending from './VerificationPending.jsx';
import {
  EmptyState,
  LanguageChip,
  StatusChip,
  TopicChips,
  formatDateTime,
} from '../components/Chips.jsx';

/**
 * Excerpts are JSON on the server; each entry may be a plain string or an
 * object carrying a date. Render them tolerantly.
 */
function excerptDate(ex) {
  if (ex && typeof ex === 'object') {
    return ex.date || ex.event_at || ex.created_at || null;
  }
  return null;
}

function excerptText(ex) {
  if (ex && typeof ex === 'object') {
    return ex.text || ex.deidentified || ex.excerpt || JSON.stringify(ex);
  }
  return String(ex);
}

function Excerpt({ excerpt, index }) {
  const date = excerptDate(excerpt);
  return (
    <details className="excerpt">
      <summary>
        Excerpt {index + 1}
        {date && <span className="muted small"> — {formatDateTime(date)}</span>}
      </summary>
      <blockquote>{excerptText(excerpt)}</blockquote>
    </details>
  );
}

/**
 * Sender label for a thread bubble. Worker messages carry `worker_name`
 * (server contract); "You" is only shown when that name matches the
 * logged-in worker — messages from other workers (e.g. the previous worker
 * on a rematched case) are shown under their own name. Servers predating
 * the contract omit `worker_name`; those threads only ever contain the
 * claiming worker's own messages, so the "You" fallback stays correct.
 */
function senderLabel(message, me) {
  if (message.sender !== 'worker') return 'Student';
  if (message.worker_name) {
    return me && message.worker_name === me.name ? 'You' : message.worker_name;
  }
  return 'You';
}

/** Professional case view: summary, deidentified excerpts, respond + thread. */
export default function CaseDetail() {
  const { id } = useParams();
  const { worker } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [notVerified, setNotVerified] = useState(false);
  // Student withdrew the case: per contract the API answers 404
  // case_not_found, and the detail page must not render any case content.
  const [withdrawn, setWithdrawn] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, thread] = await Promise.all([
        api(`/worker/cases/${id}`),
        api(`/worker/cases/${id}/messages`),
      ]);
      setCaseData(detail.case);
      setMessages(thread.messages);
    } catch (err) {
      if (err.code === 'not_verified') setNotVerified(true);
      else if (err.code === 'not_your_case')
        setError('This case is not assigned to you. Claim it from the queue first.');
      // Withdrawn cases are indistinguishable from never-shared ones by
      // design (404 case_not_found): show the same no-longer-shared notice.
      else if (err.code === 'case_not_found') setWithdrawn(true);
      else setError('Could not load the case. Is the server running?');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const d = await api(`/worker/cases/${id}/respond`, {
        method: 'POST',
        body: { text: text.trim() },
      });
      setCaseData(d.case);
      // The respond response may not echo worker_name yet; stamp our own
      // name so the bubble labels as "You" under the new sender rules.
      const sent =
        d.message && d.message.sender === 'worker' && !d.message.worker_name && worker
          ? { ...d.message, worker_name: worker.name }
          : d.message;
      setMessages((prev) => [...(prev || []), sent]);
      setText('');
    } catch (err) {
      if (err.code === 'invalid_status') {
        setSendError('This case is not waiting for your response right now.');
        load();
      } else if (err.code === 'case_not_found') {
        // Withdrawn between loading the thread and pressing Send.
        setWithdrawn(true);
      } else {
        setSendError('Could not send the message. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }

  if (notVerified) return <VerificationPending />;
  // Withdrawn (404 case_not_found) or — on pre-contract servers that still
  // return 200 — status 'withdrawn': render only the notice, never the
  // summary, excerpts, thread, or reply box.
  if (withdrawn || (caseData && caseData.status === 'withdrawn')) {
    return (
      <div className="page">
        <EmptyState title="This summary is no longer shared.">
          The student has withdrawn this case, so its excerpts and messages
          are no longer available.
        </EmptyState>
        <Link className="btn btn-ghost" to="/cases">
          Back to my cases
        </Link>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
        <Link className="btn btn-ghost" to="/cases">
          Back to my cases
        </Link>
      </div>
    );
  }
  if (!caseData || !messages) return <p className="muted">Loading case…</p>;

  const canRespond = caseData.status === 'claimed' || caseData.status === 'continued';

  return (
    <div className="page">
      <div className="page-head">
        <h1>Case</h1>
        <Link className="btn btn-ghost" to="/cases">
          Back to my cases
        </Link>
      </div>

      <section className="card">
        <div className="case-card-head">
          <span className="case-period">{caseData.period || 'Period unknown'}</span>
          <span className="chip-row">
            <StatusChip status={caseData.status} />
            <LanguageChip language={caseData.language} />
          </span>
        </div>
        <TopicChips topics={caseData.topics} />

        <dl className="summary-grid">
          <div>
            <dt>Main concerns</dt>
            <dd>{caseData.main_concerns || '—'}</dd>
          </div>
          <div>
            <dt>Recent change</dt>
            <dd>{caseData.recent_change || '—'}</dd>
          </div>
          <div>
            <dt>Queued</dt>
            <dd>{formatDateTime(caseData.created_at)}</dd>
          </div>
          <div>
            <dt>Claimed</dt>
            <dd>{formatDateTime(caseData.claimed_at)}</dd>
          </div>
          <div>
            <dt>First response sent</dt>
            <dd>{formatDateTime(caseData.responded_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2>Excerpts</h2>
        <p className="muted small">
          These excerpts are deidentified student text, shared only because the
          student explicitly authorised the cloud organisation. Original
          recordings and transcripts never leave the student's device.
        </p>
        {!caseData.excerpts || caseData.excerpts.length === 0 ? (
          <p className="muted">No excerpts were shared for this case.</p>
        ) : (
          caseData.excerpts.map((ex, i) => <Excerpt key={i} excerpt={ex} index={i} />)
        )}
      </section>

      <section className="card">
        <h2>Respond to the student</h2>
        {!canRespond && (
          <p className="muted small">
            You can send a message while the case is awaiting your response
            (status: {caseData.status}).
          </p>
        )}
        {sendError && <div className="alert alert-error">{sendError}</div>}
        <form onSubmit={send}>
          <textarea
            className="respond-box"
            rows={5}
            placeholder="Write a brief, supportive response…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!canRespond || sending}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!canRespond || sending || !text.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Messages</h2>
        {messages.length === 0 ? (
          <p className="muted">No messages yet. Your first response will appear here.</p>
        ) : (
          <ul className="thread">
            {messages.map((m) => (
              <li key={m.id} className={`bubble bubble-${m.sender}`}>
                <div className="bubble-meta">
                  {senderLabel(m, worker)} · {formatDateTime(m.created_at)}
                </div>
                <div className="bubble-text">{m.text}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
