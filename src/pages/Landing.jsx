import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="landing">
      {/* Top nav */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <span className="brand-heart">💞</span>
          <span>Little Things We Love</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="nav-link">Log in</Link>
          <Link to="/register" className="nav-cta">Sign up</Link>
        </div>
      </nav>

      {/* Hero (only section) */}
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">A monthly love time-capsule · for two</p>
          <h1 className="hero-title">
            Write the little things.<br/>
            <span className="accent">Unlock them together.</span>
          </h1>
          <p className="hero-sub">
            A private little space for couples to save your sweetest moments ❤️
            Write small notes, memories, and feelings for each other through
            the month — then, on the 3rd of the next month, everything unlocks
            together, giving you both a chance to relive the love, the laughs,
            and the little things that mattered most.
          </p>
          <div className="hero-ctas">
            <Link to="/register" className="btn-primary">Start your space →</Link>
            <Link to="/login" className="btn-secondary">I already have one</Link>
          </div>
          <p className="hero-privacy">
            🔒 End-to-end encrypted · not even the server can read your notes
          </p>
        </div>

        <div className="hero-media">
          <div className="video-frame">
            <video
              src="/ltwl_video.mp4"
              autoPlay
              loop
              muted
              playsInline
              controls
            />
          </div>
          <p className="video-caption">
            A 57-second peek — how your notes stay private, only between the two of you.
          </p>
        </div>
      </section>
    </div>
  );
}
