import { useAuth } from '../auth.jsx';

/**
 * Shown when the API answers 403 `not_verified` (or the loaded profile has
 * verified = false). The worker's organisation must verify the account
 * before any case route becomes available.
 */
export default function VerificationPending() {
  const { worker } = useAuth();
  return (
    <div className="center-screen">
      <div className="card pending-card">
        <h1>Verification pending</h1>
        <p>
          Thank you, {worker?.name || 'colleague'}. Your account
          {worker?.organisation ? (
            <>
              {' '}
              at <strong>{worker.organisation}</strong>
            </>
          ) : null}{' '}
          has been created, but it is not verified yet.
        </p>
        <p>
          Your organisation must verify your account before you can view or claim
          student cases. Please contact your organisation administrator.
        </p>
        <p className="muted small">
          You can still update your languages, expertise and capacity on the
          Profile page while you wait.
        </p>
      </div>
    </div>
  );
}
