import { useEffect, useRef, useState } from "react";
import { buildScenarioJeton } from "../algorithms/mutex/ricartToken/ricartTokenScenario";
import RicartTokenTimeline from "../components/RicartTokenTimeline";
import "../styles/ricartToken.css";

const ricartSteps = buildScenarioJeton();

export default function RicartTokenPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentStep = ricartSteps[stepIndex];

  const nextStep = () => {
    setStepIndex((prev) => Math.min(prev + 1, ricartSteps.length - 1));
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
        if (prev >= ricartSteps.length - 1) {
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

    panel.scrollTo({
      top: panel.scrollHeight,
      behavior: "smooth",
    });
  }, [stepIndex]);

  const activeMsg = currentStep.messages[0];

  return (
    <div className="ricart-token-page">
      <header className="algo-header">
        <div>
          <div className="algo-header-title">
            Algorithme de Ricart & Agrawala à jeton
          </div>
          <div className="algo-header-sub">
            exclusion mutuelle · Req[] · Jeton[] · réseau maillé
          </div>
        </div>

        <div className="header-spacer" />

        <div className="header-meta">
          <span className="algo-pill pill-amber">Mutex</span>
          <span className="meta-chip">5 sites</span>
          <span className="meta-chip">REQ / TOKEN</span>
        </div>
      </header>

      <div className="content">
        <section className="sim-wrap">
          <RicartTokenTimeline step={currentStep} previousStep={ricartSteps[stepIndex - 1]} /> 
        </section>

        <aside className="rpanel">
          <div className="rpanel-tabs">
            <button className="rtab active">Étapes</button>
          </div>

          <div className="rpanel-body" ref={panelRef}>
            {ricartSteps.slice(0, stepIndex + 1).map((s, index) => (
              <div
                key={s.id}
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
              <span className="log-ts">SITE</span>
              <span className="log-msg">
                {currentStep.activeSite ? `P${currentStep.activeSite}` : "—"}
              </span>
            </div>

            <div className="log-line">
              <span className="log-ts">JETON</span>
              <span className="log-msg">
                {currentStep.tokenOwner
                  ? `P${currentStep.tokenOwner}`
                  : "en transit"}
              </span>
            </div>

            {activeMsg && (
              <div className="log-line">
                <span className="log-ts">MSG</span>
                <span className="log-msg">
                  {activeMsg.type} : P{activeMsg.from} → P{activeMsg.to}
                </span>
              </div>
            )}

            <div className="log-line">
              <span className="log-ts">TOKEN[]</span>
              <span className="log-msg">[{currentStep.token.join(", ")}]</span>
            </div>
          </div>
        </aside>
      </div>

      <footer className="bottom-bar">
            <div className="step-info">
              Étape {stepIndex + 1} / {ricartSteps.length}
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${((stepIndex + 1) / ricartSteps.length) * 100}%`,
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

              <button className="ctrl-btn icon-btn" onClick={prevStep}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                    stroke="currentColor" strokeWidth="1.6">
                  <path d="M10 4L5 8l5 4"/>
                  <rect x="4" y="4" width="1.5" height="8" rx="0.5"
                        fill="currentColor" stroke="none"/>
                </svg>
              </button>

              <button className="ctrl-btn icon-btn" onClick={nextStep}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 4l5 4-5 4"/><rect x="10.5" y="4" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none"/>
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