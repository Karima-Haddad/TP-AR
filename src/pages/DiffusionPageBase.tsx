import { useState, useEffect, useRef } from 'react';
import type { AlgoDef } from '../types/diffusion';
import SimCanvas from '../components/SimCanvas';
import RemarksPanel from '../components/RemarksPanel';
import "../styles/diffusion.css";
interface Props {
  algo: AlgoDef;
}

export default function DiffusionPageBase({ algo }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = algo.steps;
  const currentStep = steps[stepIndex];

  const next  = () => setStepIndex(i => Math.min(i + 1, steps.length - 1));
  const prev  = () => setStepIndex(i => Math.max(i - 1, 0));
  const reset = () => { setStepIndex(0); setPlaying(false); };

  // Auto-play : avance toutes les 1.2s, s'arrête à la dernière étape
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setStepIndex(i => {
          if (i >= steps.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 1200);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, steps.length]);

  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
  <div className="diffusion-page">
    <div className="algo-header">
      <div>
        <div className="algo-header-title">{algo.label}</div>
        <div className="algo-header-sub">{algo.description}</div>
      </div>

      <span className={`algo-pill ${algo.pillClass}`}>{algo.pill}</span>

      <div className="header-spacer" />

      <div className="header-meta">
        <span className="meta-chip">4 processus</span>
        <span className="meta-chip">
          {algo.id === "sequencer"
            ? "séquenceur central"
            : algo.id === "fifo"
            ? "canal FIFO"
            : "horloge vectorielle"}
        </span>
      </div>
    </div>

    <div className="content">
      <div className="sim-wrap">
        <SimCanvas
          step={currentStep}
          algoId={algo.id}
          stepIndex={stepIndex}
        />
      </div>

      <div className="rpanel">
        <div className="rpanel-tabs">
          <button className="rtab active">Étapes</button>
        </div>

        <RemarksPanel
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={steps.length}
        />
      </div>
    </div>

    <div className="bottom-bar">
      <div className="step-info">
        Étape {stepIndex + 1} / {steps.length}
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="controls">
        {/* PLAY / PAUSE */}
        <button
          className="ctrl-btn primary"
          onClick={() => setPlaying((p) => !p)}
          title={playing ? "Pause" : "Lecture automatique"}
          disabled={stepIndex >= steps.length - 1 && !playing}
        >
          {playing ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="white"
              stroke="none"
            >
              <rect x="3" y="3" width="3.5" height="10" rx="1" />
              <rect x="9.5" y="3" width="3.5" height="10" rx="1" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="white"
              stroke="none"
            >
              <path d="M4 3l10 5-10 5z" />
            </svg>
          )}
        </button>

        {/* PREV */}
        <button
          className="ctrl-btn"
          onClick={prev}
          title="Précédent"
          disabled={stepIndex === 0 || playing}
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

        {/* NEXT */}
        <button
          className="ctrl-btn"
          onClick={next}
          title="Suivant"
          disabled={stepIndex >= steps.length - 1 || playing}
        >
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

        {/* RESET */}
        <button
          className="ctrl-btn"
          onClick={reset}
          title="Réinitialiser"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M2 8a6 6 0 1 0 1.4-3.9" />
            <path d="M2 2v4h4" />
          </svg>
        </button>
      </div>
    </div>
  </div>
);
}