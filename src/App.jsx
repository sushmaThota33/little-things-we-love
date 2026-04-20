import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api.js";
import { useAuth } from "./lib/auth.jsx";
import {
  deriveKey,
  decryptText,
  encryptText,
  verifyKey,
  rememberPassphrase,
  recallPassphrase,
  forgetPassphrase,
} from "./lib/crypto.js";
import "./index.css";

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function App() {
  const { user, logout } = useAuth();
  const [text, setText] = useState("");
  const [entries, setEntries] = useState([]);
  const [partner, setPartner] = useState(null);
  const [coupleMeta, setCoupleMeta] = useState(null); // { encryption_salt, encryption_check }
  const [cryptoKey, setCryptoKey] = useState(null);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedMonths, setExpandedMonths] = useState({});
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const currentMonth = formatMonth(new Date());

  // Load couple metadata, then attempt auto-unlock from sessionStorage.
  useEffect(() => {
    (async () => {
      try {
        const { couple, partner } = await api("/api/couple/me");
        setPartner(partner);
        setCoupleMeta(couple);
        const stored = recallPassphrase();
        if (stored && couple?.encryption_salt && couple?.encryption_check) {
          const k = await deriveKey(stored, couple.encryption_salt);
          if (await verifyKey(k, couple.encryption_check)) {
            setCryptoKey(k);
          } else {
            forgetPassphrase();
          }
        }
      } catch (err) {
        setError(err.message || "Could not load couple info");
      }
    })();
  }, []);

  // Once we have a key, fetch entries and decrypt them.
  useEffect(() => {
    if (cryptoKey) fetchAndDecryptEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoKey]);

  async function fetchAndDecryptEntries() {
    try {
      const { entries: raw } = await api("/api/entries");
      const decrypted = await Promise.all(
        raw.map(async (item) => {
          if (item.text == null) return item; // locked month
          try {
            return { ...item, text: await decryptText(cryptoKey, item.text) };
          } catch {
            return { ...item, text: "⚠️ could not decrypt" };
          }
        }),
      );
      setEntries(decrypted);
    } catch (err) {
      setError(err.message || "Could not load notes");
    }
  }

  async function unlock(e) {
    e.preventDefault();
    setError("");
    if (!coupleMeta?.encryption_salt) {
      setError(
        "Couple has no encryption set up — try logging out and back in.",
      );
      return;
    }
    setUnlocking(true);
    try {
      const k = await deriveKey(passphraseInput, coupleMeta.encryption_salt);
      const ok = await verifyKey(k, coupleMeta.encryption_check);
      if (!ok) {
        setError("Wrong passphrase");
        return;
      }
      rememberPassphrase(passphraseInput);
      setPassphraseInput("");
      setCryptoKey(k);
    } catch (err) {
      setError(err.message || "Could not unlock");
    } finally {
      setUnlocking(false);
    }
  }

  function lock() {
    forgetPassphrase();
    setCryptoKey(null);
    setEntries([]);
  }

  async function handleSave() {
    if (!text.trim()) {
      setMessage("Please write something first");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const cipher = await encryptText(cryptoKey, text.trim());
      await api("/api/entries", { method: "POST", body: { text: cipher } });
      setText("");
      setMessage("Saved 💛");
      await fetchAndDecryptEntries();
    } catch (err) {
      setMessage(err.message || "Could not save note");
    } finally {
      setLoading(false);
    }
  }

  async function unlockMonth(month) {
    try {
      await api("/api/entries/unlock-month", {
        method: "POST",
        body: { month },
      });
      setExpandedMonths((p) => ({ ...p, [month]: true }));
      await fetchAndDecryptEntries();
    } catch (err) {
      setMessage(err.message || "Could not unlock month");
    }
  }

  async function generateInvite() {
    try {
      const { token } = await api("/api/couple/invite", { method: "POST" });
      setInviteLink(`${window.location.origin}/invite/${token}`);
      setShowInvite(true);
    } catch (err) {
      setMessage(err.message || "Could not generate invite");
    }
  }

  async function copyInvite() {
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

  const currentMonthEntries = useMemo(
    () => entries.filter((item) => item.written_month === currentMonth),
    [entries, currentMonth],
  );

  const counts = useMemo(() => {
    const map = {};
    for (const e of currentMonthEntries)
      map[e.writer] = (map[e.writer] || 0) + 1;
    return map;
  }, [currentMonthEntries]);

  const groupedMonths = useMemo(() => {
    return entries.reduce((acc, item) => {
      if (!item.written_month) return acc;
      const month = item.written_month;
      if (!acc[month])
        acc[month] = {
          unlockDate: item.unlock_date,
          notes: [],
          unlocked: false,
          canUnlock: false,
        };
      acc[month].notes.push(item);
      if (item.month_unlocked) acc[month].unlocked = true;
      if (item.can_unlock) acc[month].canUnlock = true;
      return acc;
    }, {});
  }, [entries]);

  // -------- Render: passphrase gate --------
  if (!cryptoKey) {
    return (
      <div className="app">
        <div className="hearts-bg">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i}>{["❤️", "💗", "💕", "💖", "💘", "💞"][i % 6]}</span>
          ))}
        </div>
        <div className="book">
          <h1>Unlock the diary 🔐</h1>
          <form className="card" onSubmit={unlock}>
            <h2>Diary passphrase</h2>
            <p className="hint">
              Notes are end-to-end encrypted. Enter the passphrase you and your
              partner share. The app never sends it anywhere.
            </p>
            <input
              type="password"
              placeholder="Diary passphrase"
              value={passphraseInput}
              onChange={(e) => setPassphraseInput(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" disabled={unlocking || !passphraseInput}>
              {unlocking ? "Unlocking…" : "Unlock"}
            </button>
            {error && <p className="message">{error}</p>}
          </form>
          <div className="card" style={{ textAlign: "center" }}>
            <button onClick={logout}>Log out</button>
          </div>
        </div>
      </div>
    );
  }

  // -------- Render: notes view --------
  return (
    <div className="app">
      <div className="hearts-bg">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i}>{["❤️", "💗", "💕", "💖", "💘", "💞"][i % 6]}</span>
        ))}
      </div>

      <div className="book">
        <h1>Little Things We Love ❤️</h1>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <strong>{user?.display_name}</strong>
              {partner ? (
                <p className="month-subtext">
                  paired with {partner.display_name} · 🔒 encrypted
                </p>
              ) : (
                <p className="month-subtext">
                  waiting for your partner to join · 🔒 encrypted
                </p>
              )}
            </div>
            <div>
              {!partner && (
                <button onClick={generateInvite}>Invite partner</button>
              )}
              <button onClick={lock}>Lock 🔒</button>
              <button onClick={logout}>Log out</button>
            </div>
          </div>
          {showInvite && (
            <div style={{ marginTop: 12 }}>
              <textarea readOnly value={inviteLink} style={{ minHeight: 60 }} />
              <div style={{ position: "relative", display: "inline-block" }}>
                <button onClick={copyInvite}>Copy link</button>

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
              <p className="hint">
                Send this to your partner.{" "}
                <strong>Also share the diary passphrase separately</strong> —
                without it they can't read notes.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Write a note</h2>
          <p className="hint">
            Writing as <strong>{user?.display_name}</strong>
          </p>

          <textarea
            placeholder="Write something sweet..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <p className="hint">
            This note will unlock automatically on next month's 3rd.
          </p>

          <button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save note"}
          </button>

          {message && <p className="message">{message}</p>}
        </div>

        <div className="card">
          <h2>This Month Count</h2>
          {Object.keys(counts).length === 0 ? (
            <p className="hint">No notes yet this month</p>
          ) : (
            Object.entries(counts).map(([writer, count]) => (
              <p key={writer}>
                {writer}: {count} point{count === 1 ? "" : "s"}
              </p>
            ))
          )}
        </div>

        <div className="card">
          <h2>Monthly Notes 📖</h2>

          {Object.keys(groupedMonths).length === 0 ? (
            <p>No notes yet</p>
          ) : (
            Object.entries(groupedMonths)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([month, group]) => {
                const isExpanded = expandedMonths[month] || false;
                return (
                  <div key={month} className="month-section-custom">
                    <div className="month-header">
                      <div>
                        <strong>{month}</strong>
                        <p className="month-subtext">
                          {group.notes.length} note
                          {group.notes.length > 1 ? "s" : ""}
                        </p>
                      </div>

                      {!group.unlocked ? (
                        group.canUnlock ? (
                          <button
                            className="unlock-btn"
                            onClick={() => unlockMonth(month)}
                          >
                            Unlock Notes 🔓
                          </button>
                        ) : (
                          <span className="locked-badge">
                            Opens on {group.unlockDate}
                          </span>
                        )
                      ) : (
                        <button
                          className="unlock-btn secondary"
                          onClick={() =>
                            setExpandedMonths((p) => ({
                              ...p,
                              [month]: !p[month],
                            }))
                          }
                        >
                          {isExpanded ? "Collapse Notes" : "View Notes"}
                        </button>
                      )}
                    </div>

                    {group.unlocked && isExpanded && (
                      <div className="month-notes">
                        {group.notes.map((item) => (
                          <div key={item.id} className="note">
                            <p>
                              <strong>{item.writer}</strong>
                            </p>
                            <p>{item.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
