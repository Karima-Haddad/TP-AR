import type { FC } from 'react';

interface Props {
  currentStep: number;
  totalSteps:  number;
  playing:     boolean;
  onPlay:      () => void;
  onPrev:      () => void;
  onNext:      () => void;
  onReset:     () => void;
}

const IconReset = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.6">
    <path d="M2 8a6 6 0 1 0 1.4-3.9"/>
    <path d="M2 2v4h4"/>
  </svg>
);

const IconPrev = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.6">
    <path d="M10 4L5 8l5 4"/>
    <rect x="4" y="4" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

const IconNext = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.6">
    <path d="M6 4l5 4-5 4"/>
    <rect x="10.5" y="4" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
    <path d="M5 3.5l8 4.5-8 4.5z"/>
  </svg>
);

const IconPause = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
    <rect x="4" y="3" width="3" height="10" rx="1"/>
    <rect x="9" y="3" width="3" height="10" rx="1"/>
  </svg>
);

const ControlBar: FC<Props> = ({
  currentStep,
  totalSteps,
  playing,
  onPlay,
  onPrev,
  onNext,
  onReset,
}) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="bottom-bar">
      <div className="step-info">
        Étape {currentStep + 1} / {totalSteps}
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Ordre : Play, Prev, Next, Reset */}
      <div className="controls">
        <button className="ctrl-btn primary" onClick={onPlay} title="Play/Pause">
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="ctrl-btn" onClick={onPrev} title="Précédent">
          <IconPrev />
        </button>
        <button className="ctrl-btn" onClick={onNext} title="Suivant">
          <IconNext />
        </button>
        <button className="ctrl-btn" onClick={onReset} title="Réinitialiser">
          <IconReset />
        </button>
      </div>
    </div>
  );
};

export default ControlBar;