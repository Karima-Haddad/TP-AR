import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import type { ClockAlgo, LamportStep, VectorStep, MatrixStep } from '../types/clock.types';
import { fmtVector } from '../algorithms/clock/vectorClock';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnyStep = LamportStep | VectorStep | MatrixStep;
type RTab = 'steps' | 'clocks' | 'props';

interface Props {
  algo: ClockAlgo;
  steps: AnyStep[];
  currentStep: number;
  activeTab: RTab;
  onTabChange: (t: RTab) => void;
  rules: readonly string[];
  props: readonly { name: string; status: 'ok' | 'warn' | 'off'; detail: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROC_LABELS = ['P1', 'P2', 'P3', 'P4', 'P5'];
const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626'];

const tagInfo: Record<string, { cls: string; label: string }> = {
  local: { cls: 'sb-local', label: 'local' },
  send:  { cls: 'sb-send',  label: 'envoi' },
  recv:  { cls: 'sb-recv',  label: 'réception' },
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function StepsTab({ steps, currentStep }: { steps: AnyStep[]; currentStep: number }) {
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentStep]);

  return (
    <>
      {steps.map((st, i) => {
        const cls = i < currentStep ? 'past' : i === currentStep ? 'current' : 'future';
        const info = tagInfo[st.tag] ?? tagInfo.local;
        return (
          <div key={i} className={`step-item ${cls}`} ref={i === currentStep ? activeRef : null}>
            <div className="step-num">ÉTAPE {i + 1}</div>
            <div className="step-text">{st.t}</div>
            <div className="step-badges">
              <span className={`sbadge ${info.cls}`}>{info.label}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Grille 5×5 pour une matrice d'un processus donné */
function MatrixGrid({ mat, procIdx }: { mat: number[][]; procIdx: number }) {
  const col = COLORS[procIdx];
  return (
    <div style={{ overflowX: 'auto', marginTop: '6px' }}>
      <table style={{
        borderCollapse: 'collapse',
        fontSize: '11px',
        fontFamily: "'DM Mono', monospace",
        width: '100%',
      }}>
        <thead>
          <tr>
            <th style={{ width: '24px' }} />
            {PROC_LABELS.map((p, c) => (
              <th key={c} style={{
                padding: '2px 4px',
                color: COLORS[c],
                fontWeight: 600,
                textAlign: 'center',
                fontSize: '10px',
              }}>{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mat.map((row, r) => (
            <tr key={r}>
              <td style={{
                padding: '2px 4px',
                color: COLORS[r],
                fontWeight: 600,
                fontSize: '10px',
              }}>{PROC_LABELS[r]}</td>
              {row.map((val, c) => {
                const isDiag = r === c;
                const isRow0 = r === procIdx; // ligne du processus observateur
                return (
                  <td key={c} style={{
                    padding: '3px 4px',
                    textAlign: 'center',
                    background: isDiag
                      ? `${col}18`
                      : isRow0
                      ? `${col}09`
                      : 'transparent',
                    color: isDiag ? col : isRow0 ? col : 'var(--text2)',
                    fontWeight: isDiag || isRow0 ? 600 : 400,
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    minWidth: '22px',
                  }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClocksTab({
  algo,
  steps,
  currentStep,
  rules,
}: {
  algo: ClockAlgo;
  steps: AnyStep[];
  currentStep: number;
  rules: readonly string[];
}) {
  const s = steps[Math.min(currentStep, steps.length - 1)];

  return (
    <>
      <div className="clock-section">
        <div className="clock-section-title">Valeurs courantes</div>

        {/* ── Lamport & Vector : cards compactes ── */}
        {algo !== 'matrix' && (
          <div className="clock-cards">
            {PROC_LABELS.map((label, i) => {
              const val = algo === 'lamport'
                ? String((s as LamportStep).clocks[i])
                : fmtVector((s as VectorStep).clocks[i]);
              return (
                <div key={i} className="clock-card">
                  <div className="clock-card-label">{label}</div>
                  <div className="clock-card-val" style={{
                    fontSize: algo === 'lamport' ? '20px' : '9px',
                    wordBreak: 'break-all',
                    lineHeight: 1.3,
                  }}>
                    {val}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Matrix : une grille 5×5 par processus ── */}
        {algo === 'matrix' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {PROC_LABELS.map((label, i) => {
              const mat = (s as MatrixStep).matrices[i];
              return (
                <div key={i} style={{
                  background: 'var(--surface2)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  border: `1px solid ${COLORS[i]}30`,
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: COLORS[i],
                    marginBottom: '4px',
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    HM[{label}]
                  </div>
                  <MatrixGrid mat={mat} procIdx={i} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="clock-section">
        <div className="clock-section-title">Règles de mise à jour</div>
        <div className="clock-rule" style={{ whiteSpace: 'pre-line', fontSize: '11px' }}>
          {rules.join('\n')}
        </div>
      </div>
    </>
  );
}

function PropsTab({
  props,
}: {
  props: readonly { name: string; status: 'ok' | 'warn' | 'off'; detail: string }[];
}) {
  return (
    <>
      <div style={{
        marginBottom: '8px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        color: 'var(--text3)',
      }}>
        Vérification
      </div>
      {props.map((p, i) => (
        <div key={i} className="prop-row">
          <div className={`prop-indicator pi-${p.status}`} />
          <span className="prop-name">{p.name}</span>
          <span className="prop-val">{p.detail}</span>
        </div>
      ))}
    </>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const StepPanel: FC<Props> = ({
  algo,
  steps,
  currentStep,
  activeTab,
  onTabChange,
  rules,
  props,
}) => {
  return (
    <div className="rpanel">
      <div className="rpanel-tabs">
        {(['steps', 'clocks', 'props'] as RTab[]).map(tab => (
          <button
            key={tab}
            className={`rtab${activeTab === tab ? ' active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {tab === 'steps' ? 'Étapes' : tab === 'clocks' ? 'Horloges' : 'Propriétés'}
          </button>
        ))}
      </div>

      <div className="rpanel-body">
        {activeTab === 'steps' && <StepsTab steps={steps} currentStep={currentStep} />}
        {activeTab === 'clocks' && (
          <ClocksTab algo={algo} steps={steps} currentStep={currentStep} rules={rules} />
        )}
        {activeTab === 'props' && <PropsTab props={props} />}
      </div>
    </div>
  );
};

export default StepPanel;