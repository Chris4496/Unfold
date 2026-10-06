import { useCallback, useEffect, useRef, useState } from 'react';
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
import { buildTimelineEvents, excerptDate, excerptText, filterMapEvents, matchingTopics } from '../viewModel.js';

function senderLabel(message, me) {
  if (message.sender !== 'worker') return 'Student';
  if (message.worker_name) return me && message.worker_name === me.name ? 'You' : message.worker_name;
  return 'Worker (name not recorded)';
}

function eventDateLabel(event) {
  return event.dateKnown ? formatDateTime(event.date) : 'Date not recorded';
}

function ApprovedRecords({ excerpts }) {
  const records = Array.isArray(excerpts) ? excerpts : [];
  return (
    <section className="card approved-records" aria-labelledby="approved-records-heading">
      <h2 id="approved-records-heading">Complete student-approved source records</h2>
      <p className="muted small">These are the complete de-identified text entries authorized for this case, with their source IDs and dates. Original audio and transcripts are not available.</p>
      {records.length === 0 ? (
        <p className="muted">No source records were included.</p>
      ) : (
        <ol className="approved-record-list">
          {records.map((record, index) => {
            const id = record && typeof record === 'object' && record.id ? record.id : `record-${index + 1}`;
            const eventDate = excerptDate(record);
            const recordedAt = record && typeof record === 'object' ? (record.recordedAt ?? record.recorded_at) : null;
            return (
              <li key={id}>
                <div className="approved-record-meta">
                  <strong>Source {id}</strong>
                  <span>{eventDate ? `Event ${formatDateTime(eventDate)}` : 'Event date not recorded'}</span>
                  {recordedAt && recordedAt !== eventDate ? <span>Recorded {formatDateTime(recordedAt)}</span> : null}
                </div>
                <p>{excerptText(record)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Timeline({ events }) {
  return (
    <section className="card case-timeline" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Support timeline</h2>
      {events.length === 0 ? (
        <p className="muted">No timeline information is available.</p>
      ) : (
        <ol className="timeline-list">
          {events.map((event) => (
            <li className={`timeline-item timeline-${event.kind}${event.chronologicalNext ? ' chronological-next' : ''}`} key={event.id}>
              <div className="timeline-date">{eventDateLabel(event)}</div>
              <span className="timeline-marker" aria-hidden="true" />
              <div className="timeline-content">
                <strong>{event.label}</strong>
                <p>{event.text || 'No text was included.'}</p>
                {event.kind === 'excerpt' && <span className="badge badge-green">Student-approved excerpt</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function EventMap({ events, topics, selectedId, onSelect, range, onRangeChange, selectedTopic, onTopicChange }) {
  const visibleEvents = filterMapEvents(events, { topic: selectedTopic, range }, topics);
  const selectedEvent = visibleEvents.find((event) => event.id === selectedId);

  return (
    <section className="event-map-layout" aria-labelledby="event-map-heading">
      <div className="event-map-main">
        <div className="map-controls card">
          <label className="map-range-label" htmlFor="event-range">Date range</label>
          <select id="event-range" value={range} onChange={(event) => onRangeChange(event.target.value)}>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All available dates</option>
          </select>
          <div className="topic-filters" role="group" aria-label="Filter by case-level theme">
            <button className={`filter-chip${selectedTopic ? '' : ' selected'}`} type="button" aria-pressed={!selectedTopic} onClick={() => onTopicChange('')}>All themes</button>
            {topics.map((topic) => (
              <button className={`filter-chip${selectedTopic === topic ? ' selected' : ''}`} key={topic} type="button" aria-pressed={selectedTopic === topic} onClick={() => onTopicChange(selectedTopic === topic ? '' : topic)}>{topic}</button>
            ))}
          </div>
        </div>

        <div className="alert alert-info map-explanation">
          <strong>Exploratory view — not a conclusion.</strong> Items are connected only by their recorded chronological order. Theme matches use explicit excerpt tags or literal, case-insensitive text matches; this does not imply causality or clinical judgment. Themes without excerpt matches remain case-level only.
        </div>
        <p className="muted small map-undated-note">Items with no recorded date remain visible and are marked “Date not recorded”; their order is unknown and they are not linked by chronology.</p>

        {topics.length > 0 && <div className="map-theme-row"><span className="muted small">Case-level themes:</span> <TopicChips topics={topics} /></div>}
        {visibleEvents.length === 0 ? (
          <EmptyState title="No items match these filters">
            {selectedTopic ? 'No approved excerpt or message has an explicit tag or literal text match for this theme.' : 'Try a wider date range.'}
          </EmptyState>
        ) : (
          <ol className="event-map-list" aria-label="Case items in recorded chronological order">
            {visibleEvents.map((event, index) => {
              const itemTopics = matchingTopics(event, topics);
              const next = visibleEvents[index + 1];
              return (
                <li className="event-map-list-item" key={event.id}>
                  <button
                    type="button"
                    className={`event-map-node${selectedId === event.id ? ' selected' : ''}`}
                    aria-pressed={selectedId === event.id}
                    onClick={() => onSelect(selectedId === event.id ? null : event.id)}
                  >
                    <span className={`event-kind-icon event-kind-${event.kind}`} aria-hidden="true">{event.kind === 'excerpt' ? '▤' : event.kind === 'message' ? '◌' : '○'}</span>
                    <span className="event-map-node-body">
                      <span className="event-map-node-heading"><strong>{event.label}</strong><time>{eventDateLabel(event)}</time></span>
                      <span className="event-map-text">{event.text || 'No text was included.'}</span>
                      {itemTopics.length > 0 && <span className="event-map-match">{itemTopics.join(', ')} · explicit tag or literal text match</span>}
                    </span>
                  </button>
                  {event.dateKnown && next?.dateKnown && <div className="chronology-link" aria-label="Next item follows by recorded date"><span aria-hidden="true">↓</span> Next by recorded date only</div>}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <aside className="event-map-aside card" aria-labelledby="event-map-heading">
        <h2 id="event-map-heading">Event map</h2>
        <p className="muted">This view brings together approved excerpts and authorized support messages for this case.</p>
        {topics.length === 0 ? (
          <p className="muted small">No case-level themes were provided.</p>
        ) : (
          <div className="map-legend">
            <strong>Case-level themes</strong>
            <p className="muted small">The case has these themes, but the API does not provide event-level assignments unless an excerpt is explicitly tagged or literally mentions the theme.</p>
            <TopicChips topics={topics} />
          </div>
        )}
        <div className="map-legend">
          <strong>Recorded chronology</strong>
          <p className="muted small">Connections mean earlier/later timestamps only. Undated items have no chronological connection.</p>
        </div>
        {selectedEvent && (
          <div className="selected-event" aria-live="polite">
            <h3>Selected item</h3>
            <p className="muted small">{selectedEvent.label} · {eventDateLabel(selectedEvent)}</p>
            <p>{selectedEvent.text || 'No text was included.'}</p>
          </div>
        )}
        {!selectedEvent && <p className="muted small">Select an item to inspect its approved text.</p>}
      </aside>
    </section>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const { worker } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [messages, setMessages] = useState(null);
  const [loadedId, setLoadedId] = useState(null);
  const [error, setError] = useState(null);
  const [notVerified, setNotVerified] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const version = ++requestVersion.current;
    setLoadedId(null);
    setCaseData(null);
    setMessages(null);
    setError(null);
    setNotVerified(false);
    setWithdrawn(false);
    setAccessLost(false);
    setSendError(null);
    setText('');
    setSending(false);
    setActiveTab('timeline');
    setSelectedTopic('');
    setSelectedEventId(null);

    Promise.all([
      api(`/worker/cases/${id}`, { signal: controller.signal }),
      api(`/worker/cases/${id}/messages`, { signal: controller.signal }),
    ])
      .then(([detail, thread]) => {
        if (version !== requestVersion.current) return;
        if (detail.case.status === 'withdrawn') {
          setWithdrawn(true);
          return;
        }
        setCaseData(detail.case);
        setMessages(thread.messages || []);
        setLoadedId(id);
      })
      .catch((err) => {
        if (err.name === 'AbortError' || version !== requestVersion.current) return;
        setCaseData(null);
        setMessages(null);
        if (err.code === 'not_verified') setNotVerified(true);
        else if (err.code === 'case_not_found') setWithdrawn(true);
        else if (err.code === 'not_your_case') setAccessLost(true);
        else setError('Could not load this case. Please try again.');
      });

    return () => controller.abort();
  }, [id, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  async function send(event) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    const version = requestVersion.current;
    setSending(true);
    setSendError(null);
    try {
      const result = await api(`/worker/cases/${id}/respond`, {
        method: 'POST',
        body: { text: text.trim() },
      });
      if (version !== requestVersion.current) return;
      setCaseData(result.case);
      const sent = result.message && result.message.sender === 'worker' && !result.message.worker_name && worker
        ? { ...result.message, worker_name: worker.name }
        : result.message;
      if (sent) setMessages((current) => [...(current || []), sent]);
      setText('');
    } catch (err) {
      if (version !== requestVersion.current) return;
      if (err.code === 'case_not_found') {
        setCaseData(null);
        setMessages(null);
        setLoadedId(null);
        setWithdrawn(true);
      } else if (err.code === 'not_verified') {
        setCaseData(null);
        setMessages(null);
        setLoadedId(null);
        setNotVerified(true);
      } else if (err.code === 'not_your_case') {
        setCaseData(null);
        setMessages(null);
        setLoadedId(null);
        setAccessLost(true);
      } else if (err.code === 'invalid_status') {
        setSendError('This case is not waiting for a response from you. Its latest status will be refreshed.');
        setCaseData(null);
        setMessages(null);
        setLoadedId(null);
        retry();
      } else if (err.status === 401) {
        setCaseData(null);
        setMessages(null);
        setLoadedId(null);
      } else {
        setSendError('Could not send the message. Please try again.');
      }
    } finally {
      if (version === requestVersion.current) setSending(false);
    }
  }

  if (notVerified) return <VerificationPending />;
  if (loadedId !== id) {
    if (withdrawn) {
      return (
        <div className="page">
          <EmptyState title="This summary is no longer available.">It may have been withdrawn or is otherwise no longer shared. No excerpts or messages are displayed.</EmptyState>
          <Link className="btn btn-ghost" to="/cases">Back to my cases</Link>
        </div>
      );
    }
    if (accessLost) {
      return (
        <div className="page">
          <EmptyState title="This case is no longer available to you.">No case summary, excerpts, or messages are displayed.</EmptyState>
          <Link className="btn btn-ghost" to="/cases">Back to my cases</Link>
        </div>
      );
    }
    if (error) {
      return (
        <div className="page">
          <div className="alert alert-error" role="alert">{error}</div>
          <button className="btn btn-secondary" onClick={retry}>Try again</button>
          <Link className="btn btn-ghost" to="/cases">Back to my cases</Link>
        </div>
      );
    }
    return <p className="muted" role="status">Loading case…</p>;
  }

  if (!caseData || !messages || caseData.status === 'withdrawn') {
    return (
      <div className="page">
        <EmptyState title="This summary is no longer available.">It may have been withdrawn or is otherwise no longer shared. No excerpts or messages are displayed.</EmptyState>
        <Link className="btn btn-ghost" to="/cases">Back to my cases</Link>
      </div>
    );
  }

  const topics = Array.isArray(caseData.topics) ? caseData.topics : [];
  const events = buildTimelineEvents(caseData, messages);
  const canRespond = caseData.status === 'claimed' || caseData.status === 'continued';
  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'records', label: 'Authorized records' },
    { id: 'map', label: 'Event map' },
    { id: 'messages', label: 'Messages' },
  ];

  function handleTabKeyDown(event, currentId) {
    const currentIndex = tabs.findIndex((tab) => tab.id === currentId);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.id);
    document.getElementById(`tab-${nextTab.id}`)?.focus();
  }

  return (
    <div className="page case-detail-page">
      <div className="page-head case-detail-heading">
        <div>
          <h1>{caseData.period || 'Case details'}</h1>
          <div className="chip-row"><StatusChip status={caseData.status} /><LanguageChip language={caseData.language} /><TopicChips topics={topics} /></div>
        </div>
        <Link className="btn btn-ghost" to="/cases">Back to my cases</Link>
      </div>

      <div className="alert alert-info privacy-summary"><strong>Student-approved, de-identified summary.</strong> The student may withdraw sharing at any time. If access is withdrawn, this view is removed.</div>
      {caseData.period?.startsWith('Fictional student demo') && <div className="alert alert-info"><strong>Fictional teaching case.</strong> All diary records and messages are simulated; no real student data, original audio, or transcript is present.</div>}

      <section className="card case-context" aria-label="Case context">
        <div>
          <h2>Main concern</h2>
          <p>{caseData.main_concerns || 'No main concern was provided.'}</p>
        </div>
        <div>
          <h2>Recent change</h2>
          <p>{caseData.recent_change || 'No recent change was provided.'}</p>
        </div>
        <dl className="summary-grid case-meta-grid">
          <div><dt>Case shared</dt><dd>{formatDateTime(caseData.created_at)}</dd></div>
          <div><dt>Case claimed</dt><dd>{formatDateTime(caseData.claimed_at)}</dd></div>
          <div><dt>First response</dt><dd>{formatDateTime(caseData.responded_at)}</dd></div>
        </dl>
      </section>

      <div className="case-tabs" role="tablist" aria-label="Case information">
        {tabs.map((tab) => (
          <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" tabIndex={activeTab === tab.id ? 0 : -1} aria-selected={activeTab === tab.id} aria-controls="case-tab-panel" onKeyDown={(event) => handleTabKeyDown(event, tab.id)} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div id="case-tab-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="case-tab-panel">
        {activeTab === 'timeline' && <Timeline events={events} />}
        {activeTab === 'records' && <ApprovedRecords excerpts={caseData.excerpts} />}
        {activeTab === 'map' && (
          <EventMap
            events={events}
            topics={topics}
            selectedId={selectedEventId}
            onSelect={setSelectedEventId}
            range={range}
            onRangeChange={(value) => { setRange(value); setSelectedEventId(null); }}
            selectedTopic={selectedTopic}
            onTopicChange={(value) => { setSelectedTopic(value); setSelectedEventId(null); }}
          />
        )}
        {activeTab === 'messages' && (
          <section className="card conversation" aria-labelledby="messages-heading">
            <h2 id="messages-heading">Authorized case messages</h2>
            <p className="muted small">Messages shown here are available only while this case remains assigned to you and shared by the student.</p>
            {messages.length === 0 ? (
              <p className="muted">No messages yet. Your first response will appear here.</p>
            ) : (
              <ul className="thread">
                {messages.map((message, index) => (
                  <li key={message.id ?? `message-${index}`} className={`bubble bubble-${message.sender}`}>
                    <div className="bubble-meta">{senderLabel(message, worker)} · {formatDateTime(message.created_at)}</div>
                    <div className="bubble-text">{message.text}</div>
                  </li>
                ))}
              </ul>
            )}
            <form className="composer" onSubmit={send}>
              {!canRespond && <p className="muted small">Your response has been sent. You can reply again when the student continues the conversation.</p>}
              {sendError && <div className="alert alert-error" role="alert">{sendError}</div>}
              <label className="field" htmlFor="case-response"><span>Your supportive reply</span></label>
              <textarea id="case-response" className="respond-box" rows={4} maxLength={1000} placeholder="Write a brief, supportive response…" value={text} onChange={(event) => setText(event.target.value)} disabled={!canRespond || sending} />
              <span className="muted small">{text.length}/1000 characters</span>
              <button className="btn btn-primary" type="submit" disabled={!canRespond || sending || !text.trim()}>{sending ? 'Sending…' : 'Send reply'}</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
