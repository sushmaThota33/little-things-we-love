import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import App from './App.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import SetupCouple from './pages/SetupCouple.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import Landing from './pages/Landing.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import './index.css';

function CenteredLoading() {
  return (
    <div className="app">
      <div className="book"><div className="card"><p>Loading…</p></div></div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <CenteredLoading />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return children;
}

function RequireCouple({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <CenteredLoading />;
  // Unauthenticated visitors see the landing page, not the login form.
  if (!user) return <Navigate to="/welcome" replace />;
  if (!user.couple_id) return <Navigate to="/setup" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <CenteredLoading />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/welcome" element={<RedirectIfAuthed><Landing /></RedirectIfAuthed>} />
          <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
          <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
          <Route path="/invite/:token" element={<RequireAuth><AcceptInvite /></RequireAuth>} />
          <Route path="/setup" element={<RequireAuth><SetupCouple /></RequireAuth>} />
          <Route path="/" element={<RequireCouple><App /></RequireCouple>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
