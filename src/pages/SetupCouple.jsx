import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import {
  newSaltB64,
  deriveKey,
  makeVerificationBlob,
  rememberPassphrase,
} from "../lib/crypto.js";

export default function SetupCouple() {
  const navigate = useNavigate();
  const { user, refresh, logout } = useAuth();
  const [mode, setMode] = useState("choose"); // choose | created
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState("");
  const [inviteToken, setInviteToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // If the user is already paired when they land on /setup (e.g. arrived here
  // from a stale redirectTo or direct URL), send them to the notes page.
  // We skip this when mode === 'created' so the user who just created a space
  // can stay on the "Invite your partner" screen until they click Continue.
  useEffect(() => {
    if (user?.couple_id && mode !== "created") {
      navigate("/", { replace: true });
    }
  }, [user, navigate, mode]);

  async function createCouple(e) {
    e.preventDefault();
    setError("");

    if (passphrase.length < 12) {
      setError("Diary passphrase must be at least 12 characters");
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

      await api("/api/couple/create", {
        method: "POST",
        body: {
          name: user?.display_name || null,
          encryption_salt: salt,
          encryption_check: check,
        },
      });

      // Persist the passphrase for this browser session so the user
      // doesn't have to re-enter it for every action.
      rememberPassphrase(passphrase);

      const { token } = await api("/api/couple/invite", { method: "POST" });
      setInviteToken(token);
      setMode("created");
      await refresh();
    } catch (err) {
      setError(err.message || "Could not create couple");
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvite(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/couple/accept", {
        method: "POST",
        body: { token: token.trim() },
      });
      await refresh();
      // The notes page will prompt for the diary passphrase when it loads.
      navigate("/");
    } catch (err) {
      setError(err.message || "Could not accept invitation");
    } finally {
      setLoading(false);
    }
  }

  const inviteLink = inviteToken
    ? `${window.location.origin}/invite/${inviteToken}`
    : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="app">
      <div className="hearts-bg">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i}>{["❤️", "💗", "💕", "💖", "💘", "💞"][i % 6]}</span>
        ))}
      </div>
      <div className="book">
        <h1>Pair up 💞</h1>
        <p className="hint" style={{ textAlign: "center" }}>
          Hi {user?.display_name}! Create a shared space, or join your partner's
          space with the invite they sent you.
        </p>

        {mode === "choose" && (
          <>
            <form className="card" onSubmit={createCouple}>
              <h2>Start a new space</h2>
              {/* <input
                type="text"
                placeholder="Optional name (e.g. Bujji & Kanna)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              /> */}
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
                🔒 <strong>Private & Encrypted</strong>
                <br />
                Your notes are encrypted in your browser before reaching our
                server, so no one else — not hackers, not the server, not even
                the developer — can read them without your passphrase. Choose a
                secure passphrase that is hard to guess.{" "}
                <strong>
                  If you both forget it, your notes cannot be recovered.
                </strong>
              </p>
              <button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create our space"}
              </button>
            </form>
          </>
        )}

        {mode === "created" && (
          <div className="card">
            <h2>Invite your partner 💌</h2>
            <p>Send them this link. It's good for 7 days.</p>
            <textarea readOnly value={inviteLink} style={{ minHeight: 70 }} />
            <div style={{ position: "relative", display: "inline-block" }}>
              <button onClick={copyLink}>Copy link</button>

              {copied && (
                <span
                  style={{
                    position: "absolute",
                    top: "-30px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#333",
                    color: "#fff",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                  }}
                >
                  Copied!
                </span>
              )}
            </div>
            <button className="active" onClick={() => navigate("/")}>
              Continue
            </button>
            <p className="hint">
              <strong>Important:</strong> share the diary passphrase with your
              partner through a different channel (text, voice, etc.). Without
              it, they can't read any notes.
            </p>
          </div>
        )}

        {error && (
          <p className="message" style={{ textAlign: "center" }}>
            {error}
          </p>
        )}

        <div className="card" style={{ textAlign: "center" }}>
          <button onClick={logout}>Log out</button>
        </div>
      </div>
    </div>
  );
}
