/** Small presentational helpers shared by the case pages. */

export function TopicChips({ topics }) {
  if (!topics || topics.length === 0) return null;
  return (
    <span className="chip-row">
      {topics.map((t) => (
        <span key={t} className="chip chip-topic">
          {t}
        </span>
      ))}
    </span>
  );
}

export function LanguageChip({ language }) {
  if (!language) return null;
  return <span className="chip chip-lang">{language}</span>;
}

const STATUS_LABELS = {
  queued: 'Queued',
  claimed: 'Awaiting your response',
  replied: 'Replied',
  continued: 'Student replied — action needed',
  rematch: 'Rematch',
  withdrawn: 'Withdrawn',
};

export function StatusChip({ status }) {
  return (
    <span className={`chip chip-status chip-status-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/** Waiting-time badge; red once the case has waited past the timeout. */
export function WaitingBadge({ waitingHours, thresholdHours = 72 }) {
  if (waitingHours == null) return null;
  const overdue = waitingHours > thresholdHours;
  const label =
    waitingHours >= 48
      ? `${Math.round(waitingHours / 24)}d waiting`
      : `${waitingHours.toFixed(waitingHours < 10 ? 1 : 0)}h waiting`;
  return (
    <span className={overdue ? 'badge badge-red' : 'badge badge-grey'}>
      {label}
    </span>
  );
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
