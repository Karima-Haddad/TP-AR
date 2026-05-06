import { useEffect, useRef, useState } from "react";
import { generateLeLannScenario } from "../algorithms/mutex/leLann/leLannScenario";
import LeLannTimeline from "../components/LeLannTimeline";
import "../styles/leLann.css";

const leLannSteps = generateLeLannScenario();

export default function LeLannPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentStep = leLannSteps[stepIndex];

  const nextStep = () => {
    setStepIndex((prev) => Math.min(prev + 1, leLannSteps.length - 1));
  };

  const prevStep = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const resetStep = () => {
    setStepIndex(0);
    setPlaying(false);
  };

  useEffect(() => {
    if (!playing) return;

    const timer = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= leLannSteps.length - 1) {
          setPlaying(false);
          return prev;
        }

        return prev + 1;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (panel.scrollHeight > panel.clientHeight) {
      panel.scrollTo({
        top: panel.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [stepIndex]);

  return (
    <div className="lelann-page">
      <header className="algo-header">
        <div>
          <div className="algo-header-title">Algorithme de Le Lann</div>
          <div className="algo-header-sub">
            exclusion mutuelle · jeton unique · anneau logique
          </div>
        </div>

        <div className="header-spacer" />

        <div className="header-meta">
          <span className="algo-pill pill-amber">Mutex</span>
          <span className="meta-chip">5 sites</span>
          <span className="meta-chip">TOKEN</span>
        </div>
      </header>

      <div className="content">
        <section className="sim-wrap">
          <LeLannTimeline step={currentStep} />
        </section>

        <aside className="rpanel">
          <div className="rpanel-tabs">
            <button className="rtab active">Étapes</button>
          </div>

          <div className="rpanel-body" ref={panelRef}>
            {leLannSteps.slice(0, stepIndex + 1).map((s, index) => (
              <div
                key={index}
                id={`step-${index}`}
                className={`step-item ${index === stepIndex ? "current" : ""}`}
              >
                <div className="step-num">ÉTAPE {index + 1}</div>

                <div className="step-text">{s.title}</div>

                <div className="step-description">{s.description}</div>
              </div>
            ))}
          </div>

          <div className="event-log">
            <div className="log-line">
              <span className="log-ts">TYPE</span>
              <span className="log-msg">{currentStep.eventType}</span>
            </div>

            <div className="log-line">
              <span className="log-ts">SITE</span>
              <span className="log-msg">
                S{(currentStep.activeSite ?? 0) + 1}
              </span>
            </div>

            {currentStep.message && (
              <div className="log-line">
                <span className="log-ts">MSG</span>
                <span className="log-msg">
                  TOKEN : S{currentStep.message.from + 1} → S
                  {currentStep.message.to + 1}
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="bottom-bar">
        <div className="step-info">
          Étape {stepIndex + 1} / {leLannSteps.length}
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${((stepIndex + 1) / leLannSteps.length) * 100}%`,
            }}
          />
        </div>

        <div className="controls">
          <button
            className="ctrl-btn primary play-btn"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? "⏸" : "▶"}
          </button>

          <button className="ctrl-btn" onClick={prevStep}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M10 4L5 8l5 4" />
              <rect
                x="4"
                y="4"
                width="1.5"
                height="8"
                rx="0.5"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </button>

          <button className="ctrl-btn" onClick={nextStep}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M6 4l5 4-5 4" />
              <rect
                x="10.5"
                y="4"
                width="1.5"
                height="8"
                rx="0.5"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </button>

          <button className="ctrl-btn" onClick={resetStep}>
            ↺
          </button>
        </div>
      </footer>
    </div>
  );
}