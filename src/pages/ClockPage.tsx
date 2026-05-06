import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import "../styles/ClockPage.css";
import { LAMPORT_STEPS, LAMPORT_RULES, LAMPORT_PROPS } from '../algorithms/clock/lamportClock';
import { VECTOR_STEPS, VECTOR_RULES, VECTOR_PROPS } from '../algorithms/clock/vectorClock';
import { MATRIX_STEPS, MATRIX_RULES, MATRIX_PROPS } from '../algorithms/clock/matrixClock';
import type { ClockAlgo, LamportStep, VectorStep, MatrixStep } from '../types/clock.types';
import SimCanvas from '../components/SimCanvas';
import StepPanel from '../components/StepPanel';
import ControlBar from '../components/ControlBar';

type AnyStep = LamportStep | VectorStep | MatrixStep;
type RTab = 'steps' | 'clocks' | 'props';

interface AlgoConfig {
  id: ClockAlgo;
  label: string;
  icon: string;
  steps: AnyStep[];
  rules: readonly string[];
  props: readonly { name: string; status: 'ok' | 'warn' | 'off'; detail: string }[];
}

const ALGO_CONFIG: Record<ClockAlgo, AlgoConfig> = {
  lamport: { id: 'lamport', label: 'Horloge de Lamport',    icon: '⏱', steps: LAMPORT_STEPS, rules: LAMPORT_RULES, props: LAMPORT_PROPS },
  vector:  { id: 'vector',  label: 'Horloges vectorielles', icon: '→', steps: VECTOR_STEPS,  rules: VECTOR_RULES,  props: VECTOR_PROPS  },
  matrix:  { id: 'matrix',  label: 'Horloges matricielles', icon: '⊞', steps: MATRIX_STEPS,  rules: MATRIX_RULES,  props: MATRIX_PROPS  },
};

const ALGOS: ClockAlgo[] = ['lamport', 'vector', 'matrix'];
const PLAY_DELAY_MS = 750;

const ClockPage: FC = () => {
  const [algo, setAlgo]       = useState<ClockAlgo>('lamport');
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rTab, setRTab]       = useState<RTab>('steps');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config     = ALGO_CONFIG[algo];
  const totalSteps = config.steps.length;

  const nextStep = useCallback(() => {
    setStepIdx(prev => {
      if (prev < totalSteps - 1) return prev + 1;
      setPlaying(false);
      return prev;
    });
  }, [totalSteps]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (playing) timerRef.current = setInterval(nextStep, PLAY_DELAY_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, nextStep]);

  useEffect(() => {
    if (stepIdx >= totalSteps - 1 && playing) {
      const id = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(id);
    }
  }, [stepIdx, totalSteps, playing]);

  const handleSelectAlgo = (a: ClockAlgo) => {
    setAlgo(a); setStepIdx(0); setPlaying(false);
  };

  const handlePlay  = () => { if (stepIdx >= totalSteps - 1) setStepIdx(0); setPlaying(p => !p); };
  const handlePrev  = () => { setPlaying(false); setStepIdx(p => Math.max(0, p - 1)); };
  const handleNext  = () => { setPlaying(false); setStepIdx(p => Math.min(totalSteps - 1, p + 1)); };
  const handleReset = () => { setPlaying(false); setStepIdx(0); };

  return (
    <>
      <nav className="navbar">
        <div className="logo">
          <div className="logo-mark">
            <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="2" fill="white"/>
              <circle cx="2" cy="3" r="1.5" fill="white" opacity="0.7"/>
              <circle cx="12" cy="3" r="1.5" fill="white" opacity="0.7"/>
              <circle cx="2" cy="11" r="1.5" fill="white" opacity="0.7"/>
              <circle cx="12" cy="11" r="1.5" fill="white" opacity="0.7"/>
              <line x1="3.3" y1="3.7" x2="5.7" y2="5.7" stroke="white" strokeWidth="0.8" opacity="0.5"/>
              <line x1="10.7" y1="3.7" x2="8.3" y2="5.7" stroke="white" strokeWidth="0.8" opacity="0.5"/>
              <line x1="3.3" y1="10.3" x2="5.7" y2="8.3" stroke="white" strokeWidth="0.8" opacity="0.5"/>
              <line x1="10.7" y1="10.3" x2="8.3" y2="8.3" stroke="white" strokeWidth="0.8" opacity="0.5"/>
            </svg>
          </div>
          DistribuLab
        </div>
        <button className="nav-tab active"><span className="tab-dot" /> Horloges &amp; causalité</button>
        <button className="nav-tab" style={{ opacity: 0.4, cursor: 'default' }}><span className="tab-dot" /> Snapshots</button>
        <button className="nav-tab" style={{ opacity: 0.4, cursor: 'default' }}><span className="tab-dot" /> Exclusion mutuelle</button>
        <button className="nav-tab" style={{ opacity: 0.4, cursor: 'default' }}><span className="tab-dot" /> Élection</button>
        <div className="nav-spacer" />
        <div className="nav-info">
          <span><span className="status-dot" />Simulateur actif</span>
          <span>5 processus · anneau</span>
        </div>
      </nav>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-group">
            <div className="sidebar-label">Horloges &amp; causalité</div>
            {ALGOS.map(a => (
              <button key={a} className={`algo-btn${algo === a ? ' active' : ''}`} onClick={() => handleSelectAlgo(a)}>
                <span className="algo-icon">{ALGO_CONFIG[a].icon}</span>
                {ALGO_CONFIG[a].label}
              </button>
            ))}
          </div>
        </aside>

        <div className="main">
          <div className="algo-header">
            <div>
              <div className="algo-header-title">{config.label}</div>
              <div className="algo-header-sub">sync · causalité · ordre partiel</div>
            </div>
            <span className="algo-pill">Causalité</span>
            <div className="header-spacer" />
            <div className="header-meta">
              <span className="meta-chip">5 processus</span>
              <span className="meta-chip">anneau</span>
              <span className="meta-chip">
                {algo === 'lamport' ? 'O(1) / msg' : algo === 'vector' ? 'O(N) / msg' : 'O(N²) / msg'}
              </span>
            </div>
          </div>

          <div className="content">
            <div className="sim-wrap">
              <SimCanvas algo={algo} step={stepIdx} steps={config.steps} />
            </div>

            <StepPanel
              algo={algo}
              steps={config.steps}
              currentStep={stepIdx}
              activeTab={rTab}
              onTabChange={setRTab}
              rules={config.rules}
              props={config.props}
            />
          </div>

          <ControlBar
            currentStep={stepIdx}
            totalSteps={totalSteps}
            playing={playing}
            onPlay={handlePlay}
            onPrev={handlePrev}
            onNext={handleNext}
            onReset={handleReset}
          />
        </div>
      </div>
    </>
  );
};

export default ClockPage;