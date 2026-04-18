import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState('confirming'); // confirming | done | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (user?.couple_id) {
        setStatus('error');
        setMessage('You are already part of a couple. Log out first if you want to join a new one.');
        return;
      }
      try {
        await api('/api/couple/accept', { method: 'POST', body: { token } });
        if (cancelled) return;
        await refresh();
        setStatus('done');
        setTimeout(() => navigate('/'), 800);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err.message || 'Could not accept invitation');
      }
    }
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="app">
      <div className="hearts-bg">
        {Array.from({ length: 16 }).map((_, i) => <span key={i}>{['❤️','💗','💕','💖','💘','💞'][i % 6]}</span>)}
      </div>
      <div className="book">
        <h1>Accepting invitation 💌</h1>
        <div className="card">
          {status === 'confirming' && <p>Linking your account to your partner…</p>}
          {status === 'done' && <p className="message">Connected! Taking you in…</p>}
          {status === 'error' && (
            <>
              <p className="message">{message}</p>
              <button onClick={() => navigate('/setup')}>Back</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
