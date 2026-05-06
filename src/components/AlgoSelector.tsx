import type { AlgoDef, AlgoId } from '../types/diffusion';

interface Props {
  algos: AlgoDef[];
  current: AlgoId;
  onSelect: (id: AlgoId) => void;
  stepIndex: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
}

export default function AlgoSelector({
  algos, current, onSelect,
  stepIndex, totalSteps,
  onPrev, onNext, onReset,
}: Props) {
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <>
  

      {/* Bottom bar */}
      <div className="bottom-bar">
        <div className="step-info">
          Étape {stepIndex + 1} / {totalSteps}
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="controls">
          {/* Reset */}
          <button className="ctrl-btn" onClick={onReset} title="Réinitialiser">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 8a6 6 0 1 0 1.4-3.9" />
              <path d="M2 2v4h4" />
            </svg>
          </button>
          {/* Précédent */}
          <button className="ctrl-btn" onClick={onPrev} title="Précédent" disabled={stepIndex === 0}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 4L5 8l5 4" />
              <rect x="4" y="4" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
          {/* Suivant */}
          <button className="ctrl-btn primary" onClick={onNext} title="Suivant" disabled={stepIndex >= totalSteps - 1}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.6">
              <path d="M6 4l5 4-5 4" />
              <rect x="10.5" y="4" width="1.5" height="8" rx="0.5" fill="white" stroke="none" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}