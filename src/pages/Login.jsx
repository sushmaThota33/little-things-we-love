import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';
  const fromInvite = typeof redirectTo === 'string' && redirectTo.startsWith('/invite/');
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not log in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="hearts-bg">
        {Array.from({ length: 16 }).map((_, i) => <span key={i}>{['❤️','💗','💕','💖','💘','💞'][i % 6]}</span>)}
      </div>
      <div className="book">
        <Link to="/welcome" className="back-link">← Back</Link>
        <h1>Welcome back ❤️</h1>
        {fromInvite && (
          <div className="card" style={{ background: '#fff4ea', borderColor: '#f4b183', textAlign: 'center' }}>
            <p style={{ margin: 0 }}>
              💌 <strong>You're accepting an invitation to a shared space.</strong><br />
              Log in (or <Link to="/register" state={location.state}>create an account</Link>) to join your partner.
            </p>
          </div>
        )}
        <form className="card" onSubmit={handleSubmit}>
          <h2>Log in</h2>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
          {error && <p className="message">{error}</p>}
          <p className="hint">No account yet? <Link to="/register" state={location.state}>Create one</Link></p>
        </form>
      </div>
    </div>
  );
}
