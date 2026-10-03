import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Header from './components/Header.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerificationPending from './pages/VerificationPending.jsx';
import Queue from './pages/Queue.jsx';
import Cases from './pages/Cases.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import Profile from './pages/Profile.jsx';

function LoadingScreen() {
  return (
    <div className="center-screen">
      <p className="muted">Loading…</p>
    </div>
  );
}

/** Requires a logged-in worker. */
function RequireAuth({ children }) {
  const { worker, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!worker) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Requires a verified worker. Unverified accounts (or a runtime 403
 * `not_verified` from the API) land on the dedicated VerificationPending
 * screen — the organisation must verify the account first.
 */
function RequireVerified({ children }) {
  const { worker, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!worker) return <Navigate to="/login" replace />;
  if (!worker.verified) return <VerificationPending />;
  return children;
}

export default function App() {
  const { worker } = useAuth();
  return (
    <div className="app">
      {worker && <Header />}
      <main className="main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/verification-pending"
            element={
              <RequireAuth>
                <VerificationPending />
              </RequireAuth>
            }
          />
          <Route
            path="/queue"
            element={
              <RequireVerified>
                <Queue />
              </RequireVerified>
            }
          />
          <Route
            path="/cases"
            element={
              <RequireVerified>
                <Cases />
              </RequireVerified>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <RequireVerified>
                <CaseDetail />
              </RequireVerified>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/queue" replace />} />
          <Route path="*" element={<Navigate to="/queue" replace />} />
        </Routes>
      </main>
    </div>
  );
}
