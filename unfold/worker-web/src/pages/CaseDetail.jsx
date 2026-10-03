import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import VerificationPending from './VerificationPending.jsx';
import {
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

/** Professional case view: summary, deidentified excerpts, respond + thread. */
export default function CaseDetail() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [notVerified, setNotVerified] = useState(false);
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
      else if (err.code === 'case_not_found') setError('Case not found.');
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
      setMessages((prev) => [...(prev || []), d.message]);
      setText('');
    } catch (err) {
      if (err.code === 'invalid_status') {
        setSendError('This case is not waiting for your response right now.');
        load();
      } else {
        setSendError('Could not send the message. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }

  if (notVerified) return <VerificationPending />;
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
                  {m.sender === 'worker' ? 'You' : 'Student'} ·{' '}
                  {formatDateTime(m.created_at)}
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
