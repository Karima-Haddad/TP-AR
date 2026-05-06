import {useRef, useEffect, useState } from "react";
import { lamportSteps } from "../algorithms/mutex/lamport/lamportAlgo"; 
import LamportTimeline from "../components/LamportTimeline"; 
import "../styles/lamport.css";

export default function LamportPage() {
  const [stepIndex,setStepIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentStep = lamportSteps[stepIndex];

  const messageStats = currentStep.events.reduce(
    (acc, event) => {
      if (event.type === "REQ") acc.req += 1;
      if (event.type === "ACQ") acc.ack += 1;
      if (event.type === "REL") acc.lib += 1;

      return acc;
    },
    {
      req: 0,
      ack: 0,
      lib: 0,
    }
  );

  const totalMessages =
    messageStats.req + messageStats.ack + messageStats.lib;

  const nextStep = () => {
    setStepIndex((prev) => Math.min(prev + 1, lamportSteps.length - 1));
  };

  const prevStep = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const resetStep = () => {
    setStepIndex(0);
  };

  useEffect(() => {
    if(!playing) return;

    const timer=setInterval(() => {
    setStepIndex(prev => {
        if(prev >= lamportSteps.length-1){
            setPlaying(false);
            return prev;
        }
        return prev+1;
    });
    },1500);

    return ()=>clearInterval(timer);

    },[playing]);

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
    // <div className="app-shell">

    //   <div className="layout">

    //     <main className="main">
    <div className="lamport-page">
          <header className="algo-header">
            <div>
              <div className="algo-header-title">Algorithme de Lamport</div>
              <div className="algo-header-sub">
                exclusion mutuelle · horloges logiques · file distribuée
              </div>
            </div>

            {/* <span className="algo-pill pill-amber">Mutex</span> */}

            <div className="header-spacer" />

            <div className="header-meta">
              <span className="algo-pill pill-amber">Mutex</span>
              <span className="meta-chip">3 processus</span>
              <span className="meta-chip">REQ / ACK / LIB</span>
            </div>
          </header>

          <div className="content">
            <section className="sim-wrap">
              <LamportTimeline step={currentStep} />
            </section>

            <aside className="rpanel">
              <div className="rpanel-tabs">
                <button className="rtab active">Étapes</button>
              </div>

              <div className="rpanel-body" id="stepsPanel" ref={panelRef}>
                {lamportSteps.slice(1, stepIndex + 1).map((s, index) => {
                    const realIndex = index + 1;

                    return (
                        <div
                        key={realIndex}
                        id={`step-${realIndex}`}
                        className="step-item current"
                        >
                        <div className="step-num">
                            ÉTAPE {realIndex + 1}
                        </div>

                        <div className="step-text">
                            {s.title}
                        </div>

                        <div className="step-description">
                            {s.description}
                        </div>
                        </div>
                    );
                    })}
                </div>


                <div className="message-stats-card">
                  <div className="stats-header">
                    <span className="stats-title">Messages échangés</span>
                    <span className="stats-total">{totalMessages}</span>
                  </div>

                  <div className="stats-grid">
                    <div className="stat-box stat-req">
                      <span className="stat-label">REQ</span>
                      <strong>{messageStats.req}</strong>
                    </div>

                    <div className="stat-box stat-ack">
                      <span className="stat-label">ACK</span>
                      <strong>{messageStats.ack}</strong>
                    </div>

                    <div className="stat-box stat-lib">
                      <span className="stat-label">LIB</span>
                      <strong>{messageStats.lib}</strong>
                    </div>
                  </div>
                </div>


              <div className="event-log">
                {currentStep.state.logs.map((log, index) => (
                  <div className="log-line" key={index}>
                    <span className="log-ts">00:0{index}</span>
                    <span className="log-msg">{log}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <footer className="bottom-bar">

            <div className="step-info">
            Étape {stepIndex+1} / {lamportSteps.length}
            </div>

            <div className="progress-track">
                <div
                    className="progress-fill"
                    style={{
                    width:`${((stepIndex+1)/lamportSteps.length)*100}%`
                    }}
                    />
                </div>

                <div className="controls">

                <button
                    className="ctrl-btn primary play-btn"
                    onClick={()=>setPlaying(!playing)}
                    >
                    {playing ? "⏸" : "▶"}
                </button>

                <button
                  className="ctrl-btn"
                  onClick={prevStep}
                >
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

                <button
                  className="ctrl-btn"
                  onClick={nextStep}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M6 4l5 4-5 4"></path>
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
   
                <button
                    className="ctrl-btn"
                    onClick={resetStep}
                    >
                    ↺
                </button>

            </div>

            </footer>
        {/* </main>
      </div> */}
    </div>
  );
}