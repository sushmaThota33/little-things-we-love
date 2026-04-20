import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import {
  newSaltB64,
  deriveKey,
  makeVerificationBlob,
  rememberPassphrase,
} from '../lib/crypto.js';

export default function SetupCouple() {
  const navigate = useNavigate();
  const { user, refresh, logout } = useAuth();
  const [mode, setMode] = useState('choose'); // choose | created
  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [token, setToken] = useState('');
  const [inviteToken, setInviteToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If the user is already paired, they have no business being on /setup.
  // Send them to the notes page (which shows the passphrase gate).
  useEffect(() => {
    if (user?.couple_id) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  async function createCouple(e) {
    e.preventDefault();
    setError('');

    if (passphrase.length < 12) {
      setError('Diary passphrase must be at least 12 characters');
      return;
    }
    if (passphrase !== confirm) {
      setError("Passphrases don't match");
      return;
    }

    setLoading(true);
    try {
      // Derive the encryption key entirely client-side, then send the
      // server only the salt and a verification blob (an encrypted known
      // string). The server cannot decrypt notes with these alone.
      const salt = newSaltB64();
      const key = await deriveKey(passphrase, salt);
      const check = await makeVerificationBlob(key);

      await api('/api/couple/create', {
        method: 'POST',
        body: {
          name: name || null,
          encryption_salt: salt,
          encryption_check: check,
        },
      });

      // Persist the passphrase for this browser session so the user
      // doesn't have to re-enter it for every action.
      rememberPassphrase(passphrase);

      const { token } = await api('/api/couple/invite', { method: 'POST' });
      setInviteToken(token);
      setMode('created');
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not create couple');
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvite(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/couple/accept', { method: 'POST', body: { token: token.trim() } });
      await refresh();
      // The notes page will prompt for the diary passphrase when it loads.
      navigate('/');
    } catch (err) {
      setError(err.message || 'Could not accept invitation');
    } finally {
      setLoading(false);
    }
  }

  const inviteLink = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : '';

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink); } catch { /* ignore */ }
  }

  return (
    <div className="app">
      <div className="hearts-bg">
        {Array.from({ length: 16 }).map((_, i) => <span key={i}>{['❤️','💗','💕','💖','💘','💞'][i % 6]}</span>)}
      </div>
      <div className="book">
        <h1>Pair up 💞</h1>
        <p className="hint" style={{ textAlign: 'center' }}>
          Hi {user?.display_name}! Create a shared space, or join your partner's space with the invite they sent you.
        </p>

        {mode === 'choose' && (
          <>
            <form className="card" onSubmit={createCouple}>
              <h2>Start a new space</h2>
              <input
                type="text"
                placeholder="Optional name (e.g. Bujji & Kanna)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="password"
                placeholder="Diary passphrase (12+ chars)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                minLength={12}
                required
              />
              <input
                type="password"
                placeholder="Confirm diary passphrase"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={12}
                required
              />
              <p className="hint">
                This passphrase encrypts every note. Pick something long — a few random words work well
                (e.g. "orange piano coffee river"). Share it with your partner separately (the app never sees it).
                <strong> If you both forget it, your notes are gone forever.</strong>
              </p>
              <button type="submit" disabled={loading}>
                {loading ? 'Creating…' : 'Create our space'}
              </button>
            </form>

            <form className="card" onSubmit={acceptInvite}>
              <h2>Join your partner's space</h2>
              <input
                type="text"
                placeholder="Paste the invite token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="hint">Or open the invite link they sent you. You'll set the diary passphrase next.</p>
              <button type="submit" disabled={loading || !token.trim()}>
                {loading ? 'Joining…' : 'Join'}
              </button>
            </form>
          </>
        )}

        {mode === 'created' && (
          <div className="card">
            <h2>Invite your partner 💌</h2>
            <p>Send them this link. It's good for 7 days.</p>
            <textarea readOnly value={inviteLink} style={{ minHeight: 70 }} />
            <button onClick={copyLink}>Copy link</button>
            <button className="active" onClick={() => navigate('/')}>Continue</button>
            <p className="hint">
              <strong>Important:</strong> share the diary passphrase with your partner through a different channel
              (text, voice, etc.). Without it, they can't read any notes.
            </p>
          </div>
        )}

        {error && <p className="message" style={{ textAlign: 'center' }}>{error}</p>}

        <div className="card" style={{ textAlign: 'center' }}>
          <button onClick={logout}>Log out</button>
        </div>
      </div>
    </div>
  );
}
