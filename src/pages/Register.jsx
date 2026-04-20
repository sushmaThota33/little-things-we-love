import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  // If they were heading somewhere specific (e.g. an invite link), go there;
  // otherwise newly-registered users land on /setup to pair with their partner.
  const redirectTo = location.state?.from || '/setup';
  const fromInvite = typeof redirectTo === 'string' && redirectTo.startsWith('/invite/');
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, displayName);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not register');
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
        <h1>Create your space 💕</h1>
        {fromInvite && (
          <div className="card" style={{ background: '#fff4ea', borderColor: '#f4b183', textAlign: 'center' }}>
            <p style={{ margin: 0 }}>
              💌 <strong>You're accepting an invitation to a shared space.</strong><br />
              Create an account (or <Link to="/login" state={location.state}>log in</Link>) to join your partner.
            </p>
          </div>
        )}
        <form className="card" onSubmit={handleSubmit}>
          <h2>Sign up</h2>
          <input type="text" placeholder="Display name (e.g. Bujji)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} />
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Sign up'}</button>
          {error && <p className="message">{error}</p>}
          <p className="hint">Already have an account? <Link to="/login" state={location.state}>Log in</Link></p>
        </form>
      </div>
    </div>
  );
}
