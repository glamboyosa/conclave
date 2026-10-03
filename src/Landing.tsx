import { ArrowRight, Moon, Sun } from "lucide-react";
import { useRef, useState } from "react";
import { ConclaveMark } from "./components/product/ConclaveMark";

type LandingProps = {
  dark: boolean;
  onEnter: () => void;
  onGuide: () => void;
  onToggleTheme: () => void;
};

export const Landing = ({ dark, onEnter, onGuide, onToggleTheme }: LandingProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(2);

  const toggleSpeed = () => {
    const next = speed === 2 ? 1 : 2;
    setSpeed(next);

    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-brand">
          <ConclaveMark />
          <span>Conclave</span>
        </div>
        <div className="landing-header-actions">
          <button
            className="landing-theme-toggle"
            aria-label={dark ? "Use light theme" : "Use dark theme"}
            onClick={onToggleTheme}
          >
            {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          <button className="landing-header-link" onClick={onEnter}>
            Open app <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <span className="landing-eyebrow">A decision room for difficult calls</span>
          <h1 id="landing-title">Get an AI recommendation you can argue with.</h1>
          <p>
            Give Conclave the decision you’re facing. An AI council weighs the
            opportunity, evidence, and risk, then writes a memo you can question
            and refine.
          </p>
          <div className="landing-actions">
            <button className="landing-primary" onClick={onEnter}>
              Try Conclave <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button className="landing-secondary" onClick={onGuide}>
              How it works
            </button>
          </div>
        </section>

        <section className="landing-feature" aria-labelledby="landing-feature-title">
          <div>
            <span className="landing-feature-label">New · Model handoff</span>
            <h2 id="landing-feature-title">Change models without losing the thread.</h2>
          </div>
          <p>
            Start a decision with one model. Switch providers or models between
            follow-up messages, and Conclave brings the memo and conversation
            along. Each reply shows which model answered.
          </p>
        </section>

        <section className="landing-demo" aria-labelledby="landing-demo-title">
          <div className="landing-demo-heading">
            <h2 id="landing-demo-title">See a decision unfold</h2>
            <div className="landing-demo-meta">
              <span>Product walkthrough · 2 min at 1×</span>
              <button
                onClick={toggleSpeed}
                aria-label={`Playback speed ${speed}×. Switch to ${speed === 2 ? "1×" : "2×"}`}
              >
                {speed}× speed
              </button>
            </div>
          </div>
          <video
            ref={videoRef}
            controls
            playsInline
            preload="none"
            poster="/conclave-product-demo-poster.jpg"
            aria-label="Conclave product walkthrough"
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = speed;
            }}
            onRateChange={(event) => setSpeed(event.currentTarget.playbackRate)}
          >
            <source src="/conclave-product-demo.mp4" type="video/mp4" />
            Your browser does not support this video.
          </video>
        </section>

        <div className="landing-notes">
          <p>Bring your own provider key, use a local model, or try the offline preview.</p>
          <a href="https://github.com/glamboyosa/conclave" target="_blank" rel="noopener noreferrer">
            Open source on GitHub
          </a>
        </div>
      </main>

      <footer className="landing-footer">
        A project by <a href="https://glamboyosa.xyz" target="_blank" rel="noopener noreferrer">Osa Ogbemudia</a>
      </footer>
    </div>
  );
};
