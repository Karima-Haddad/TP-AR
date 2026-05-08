import { useRef, useEffect, useState } from "react";
import { generateRicartAgrawalaSteps } from "../algorithms/mutex/ricart-agrawala/ricartAgrawalaAlgo";
import RicartTimeline from "../components/RicartTimeline";
import "../styles/ricart.css";

const ricartSteps = generateRicartAgrawalaSteps();

export default function RicartPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentStep = ricartSteps[stepIndex];

  const messageStats = currentStep.events.reduce(
    (acc, event) => {
      if (event.type === "SEND_REQUEST") acc.request += 1;
      if (event.type === "SEND_REPLY") acc.reply += 1;

      return acc;
    },
    {
      request: 0,
      reply: 0,
    }
  );

  const totalMessages = messageStats.request + messageStats.reply;

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

  return (
    // <div className="app-shell">
    //   <div className="layout">
    //     <main className="main">
    <div className="ricart-page">
          <header className="algo-header">
            <div>
              <div className="algo-header-title">
                Algorithme de Ricart–Agrawala
              </div>

              <div className="algo-header-sub">
                exclusion mutuelle · horloges de Lamport · REQUEST / REPLY
              </div>
            </div>

            <div className="header-spacer" />

            <div className="header-meta">
              <span className="algo-pill pill-amber">Mutex</span>
              <span className="meta-chip">3 processus</span>
              <span className="meta-chip">REQUEST / REPLY</span>
            </div>
          </header>

          <div className="content">
            <section className="sim-wrap">
              <RicartTimeline step={currentStep} />
            </section>

            <aside className="rpanel">
              <div className="rpanel-tabs">
                <button className="rtab active">Étapes</button>
              </div>

              <div className="rpanel-body" ref={panelRef}>
                {ricartSteps.slice(1, stepIndex + 1).map((s, index) => {
                  const realIndex = index + 1;

                  return (
                    <div
                      key={realIndex}
                      id={`step-${realIndex}`}
                      className="step-item current"
                    >
                      <div className="step-num">ÉTAPE {realIndex}</div>

                      <div className="step-text">{s.title}</div>

                      <div className="step-description">
                        {s.description}
                      </div>
                    </div>
                  );
                })}
              </div>

                <div className="ricart-message-stats-card">
                  <div className="ricart-stats-header">
                    <span className="ricart-stats-title">Messages échangés</span>
                    <span className="ricart-stats-total">{totalMessages}</span>
                  </div>

                  <div className="ricart-stats-grid">
                    <div className="ricart-stat-box ricart-stat-req">
                      <span className="ricart-stat-label">REQUEST</span>
                      <strong>{messageStats.request}</strong>
                    </div>

                    <div className="ricart-stat-box ricart-stat-reply">
                      <span className="ricart-stat-label">REPLY</span>
                      <strong>{messageStats.reply}</strong>
                    </div>
                  </div>
                </div>
                
              {/* <div className="event-log">
                {currentStep.logs.map((log, index) => (
                  <div className="log-line" key={index}>
                    <span className="log-ts">00:0{index}</span>
                    <span className="log-msg">{log}</span>
                  </div>
                ))}
              </div> */}
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

