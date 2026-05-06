import { useState, useEffect, useRef, useCallback } from 'react';
import type { ElectionStep, Process } from '../algorithms/election/bully';

const CX = 320, CY = 200, R = 140;
const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626'];

const TAG_LABELS: Record<string, { cls: string; label: string }> = {
  send:  { cls: 'sb-send',  label: 'envoi' },
  recv:  { cls: 'sb-recv',  label: 'réception' },
  local: { cls: 'sb-local', label: 'local' },
  elect: { cls: 'sb-elect', label: 'élection' },
  coord: { cls: 'sb-sc',    label: 'coordinateur' },
  crash: { cls: 'sb-crash', label: 'panne' },
};

interface Props {
  steps: ElectionStep[];
  algoLabel: string;
  algoSub?: string;
  algoTag?: string;
  algoTagClass?: string;
  metaProcs?: string;
  metaTopo?: string;
}

function procPos(n: number, i: number) {
  const a = -Math.PI / 2 + (2 * Math.PI / n) * i;
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
}

function hexToRgb(hex: string) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ].join(',');
}

export default function ElectionSimulator({
  steps,
  algoLabel,
  algoSub = 'leader · tolérance aux pannes',
  algoTag = 'Élection',
  algoTagClass = 'pill-purple',
  metaProcs,
  metaTopo = 'anneau',
}: Props) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const miniListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [steps]);

  const stopPlay = useCallback(() => {
    setPlaying(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setStep(s => {
        if (s >= steps.length - 1) { stopPlay(); return s; }
        return s + 1;
      });
    }, 900);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, steps.length, stopPlay]);

  // Scroll la mini-liste vers l'étape courante
  useEffect(() => {
    if (!miniListRef.current) return;
    const el = miniListRef.current.querySelectorAll<HTMLDivElement>('.mini-step')[step];
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [step]);

  const cur = steps[Math.min(step, steps.length - 1)];
  const total = steps.length;
  const nProcs = metaProcs ?? `${cur?.processes?.length ?? 5} processus`;

  // ─── SVG ──────────────────────────────────────────
  function renderSVG() {
    if (!cur) return null;
    const procs: Process[] = cur.processes;
    const n = procs.length;

    return (
      <>
        {/* Titre dans le canvas */}
        <text x={20} y={22} fill="#2563eb" fontSize={11}
          fontFamily="DM Mono, monospace" opacity={0.5}>
          {algoLabel} · étape {step + 1}
        </text>

        {/* Arêtes */}
        {procs.map((_, i) => {
          const j = (i + 1) % n;
          const a = procPos(n, i), b = procPos(n, j);
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
          );
        })}

        {/* Messages animés */}
        {cur.messages?.map((msg, mi) => {
          const fi = procs.findIndex(p => p.id === msg.from);
          const ti = procs.findIndex(p => p.id === msg.to);
          if (fi < 0 || ti < 0) return null;
          const pf = procPos(n, fi), pt = procPos(n, ti);
          const dx = pt.x - pf.x, dy = pt.y - pf.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const x1 = pf.x + dx / dist * 30, y1 = pf.y + dy / dist * 30;
          const x2 = pt.x - dx / dist * 30, y2 = pt.y - dy / dist * 30;
          const col = COLORS[fi % COLORS.length];
          return (
            <g key={mi}>
              <defs>
                <marker id={`arr${mi}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill={col} />
                </marker>
              </defs>
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={col} strokeWidth={1.5}
                markerEnd={`url(#arr${mi})`} opacity={0.75} />
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8}
                textAnchor="middle" fill={col}
                fontSize={9} fontFamily="DM Mono, monospace" fontWeight={600}>
                {msg.type}
              </text>
              <circle r={4} fill={col} opacity={0.9}>
                <animateMotion dur="0.7s" repeatCount="1"
                  path={`M${x1},${y1} L${x2},${y2}`} />
              </circle>
            </g>
          );
        })}

        {/* Nœuds */}
        {procs.map((p, i) => {
          const pos = procPos(n, i);
          const col = COLORS[i % COLORS.length];
          const isHi = cur.highlight?.includes(p.id) ?? false;
          const isCoord = p.isCoordinator;
          const isCrashed = !p.isAlive;
          return (
            <g key={p.id}>
              {isHi && !isCrashed && (
                <>
                  <circle cx={pos.x} cy={pos.y} r={38} fill={col} opacity={0.05} />
                  <circle cx={pos.x} cy={pos.y} r={32} fill="none" stroke={col}
                    strokeWidth={1.5} opacity={0.2} strokeDasharray="4,3" />
                </>
              )}
              {isCoord && (
                <g>
                  <rect x={pos.x - 22} y={pos.y - 55} width={44} height={17} rx={8.5}
                    fill="rgba(37,99,235,0.1)" stroke="rgba(37,99,235,0.35)" strokeWidth={1} />
                  <text x={pos.x} y={pos.y - 46}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#2563eb" fontSize={9} fontWeight={700}
                    fontFamily="DM Mono,monospace">COORD</text>
                </g>
              )}
              <circle cx={pos.x} cy={pos.y} r={28}
                fill={isCrashed ? 'rgba(220,38,38,0.05)' : `rgba(${hexToRgb(col)},0.09)`}
                stroke={isCrashed ? '#f87171' : col}
                strokeWidth={isHi ? 2.5 : isCoord ? 2 : 1}
                opacity={isCrashed ? 0.5 : 1} />
              {isCrashed && (
                <>
                  <line x1={pos.x - 10} y1={pos.y - 10} x2={pos.x + 10} y2={pos.y + 10}
                    stroke="#dc2626" strokeWidth={1.8} />
                  <line x1={pos.x + 10} y1={pos.y - 10} x2={pos.x - 10} y2={pos.y + 10}
                    stroke="#dc2626" strokeWidth={1.8} />
                </>
              )}
              <text x={pos.x} y={pos.y - 3}
                textAnchor="middle" dominantBaseline="middle"
                fill={isCrashed ? '#dc2626' : col}
                fontSize={13} fontWeight={600} fontFamily="DM Sans,sans-serif">
                P{p.id}
              </text>
              <text x={pos.x} y={pos.y + 13}
                textAnchor="middle" dominantBaseline="middle"
                fill={isCrashed ? '#dc2626' : col}
                fontSize={10} fontFamily="DM Mono,monospace"
                opacity={isCrashed ? 0.5 : 0.7}>
                {isCrashed ? '✗' : isCoord ? '★' : `id:${p.id}`}
              </text>
            </g>
          );
        })}

        {/* Légende */}
        <g transform="translate(20, 395)">
          <rect width={7} height={7} rx={2} fill="rgba(37,99,235,0.12)" stroke="#2563eb" strokeWidth={0.8} />
          <text x={11} y={6} fill="#94a3b8" fontSize={10} fontFamily="DM Mono,monospace">envoi</text>
          <rect x={52} width={7} height={7} rx={2} fill="rgba(220,38,38,0.08)" stroke="#dc2626" strokeWidth={0.8} />
          <text x={63} y={6} fill="#94a3b8" fontSize={10} fontFamily="DM Mono,monospace">panne</text>
          <rect x={113} width={7} height={7} rx={2} fill="rgba(37,99,235,0.1)" stroke="#2563eb" strokeWidth={0.8} />
          <text x={124} y={6} fill="#94a3b8" fontSize={10} fontFamily="DM Mono,monospace">coordinateur</text>
        </g>
      </>
    );
  }

  const tagInfo = TAG_LABELS[cur?.tag ?? 'local'] ?? TAG_LABELS.local;

  // ─── RENDER ───────────────────────────────────────
  return (
    <div className="sim-layout">

      {/* ── En-tête algo ── */}
      <div className="algo-header">
        <div>
          <div className="algo-header-title">{algoLabel}</div>
          <div className="algo-header-sub">{algoSub}</div>
        </div>
        <span className={`algo-pill ${algoTagClass}`}>{algoTag}</span>
        <div className="header-spacer" />
        <div className="header-meta">
          <span className="meta-chip">{nProcs}</span>
          <span className="meta-chip">{metaTopo}</span>
        </div>
      </div>

      {/* ── Zone centrale ── */}
      <div className="sim-content">

        {/* Canvas SVG */}
        <div className="sim-wrap">
          <svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
            {renderSVG()}
          </svg>
        </div>

        {/* ── Panneau droit ── */}
        <div className="rpanel">
          <div className="rpanel-tabs">
            <span className="rpanel-tab-label">Étapes</span>
          </div>

          <div className="rpanel-body">

            {/* Étape courante — grande carte */}
            {cur && (
              <div className="step-card-current">
                <div className="step-num">ÉTAPE {step + 1} / {total}</div>
                <div className="step-title">{cur.title ?? cur.description}</div>
                {cur.code && (
                  <pre className="step-code">{cur.code}</pre>
                )}
                {!cur.code && (
                  <div className="step-desc">{cur.description}</div>
                )}
                <div className="step-badges">
                  <span className={`sbadge ${tagInfo.cls}`}>{tagInfo.label}</span>
                </div>
              </div>
            )}

            {/* Remarques */}
            {cur?.remarques && cur.remarques.length > 0 && (
              <div className="remarques-section">
                <div className="remarques-title">REMARQUES</div>
                {cur.remarques.map((r, i) => (
                  <div key={i} className="remarque-item">
                    <span className="remarque-bullet">•</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Mini-liste de toutes les étapes */}
            <div className="mini-steps-section">
              <div className="remarques-title">TOUTES LES ÉTAPES</div>
              <div ref={miniListRef}>
                {steps.map((st, i) => {
                  const cls = i < step ? 'past' : i === step ? 'current' : '';
                  return (
                    <div
                      key={i}
                      className={`mini-step ${cls}`}
                      onClick={() => { stopPlay(); setStep(i); }}
                    >
                      <div className="mini-step-num">ÉTAPE {i + 1}</div>
                      <div className="mini-step-text">{st.title ?? st.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Barre de contrôle ── */}
      <div className="bottom-bar">
        <div className="step-info">Étape {step + 1} / {total}</div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <div className="controls">
          <button
            className="ctrl-btn primary play-btn"
            onClick={() => setPlaying((p) => !p)}
            title="Play/Pause"
          >
            {playing ? "⏸" : "▶"}
          </button>

          <button
            className="ctrl-btn"
            onClick={() => {
              stopPlay();
              setStep((s) => Math.max(0, s - 1));
            }}
            title="Précédent"
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
            onClick={() => {
              stopPlay();
              setStep((s) => Math.min(total - 1, s + 1));
            }}
            title="Suivant"
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

          <button
            className="ctrl-btn"
            onClick={() => {
              stopPlay();
              setStep(0);
            }}
            title="Réinitialiser"
          >
            ↺
          </button>
        </div>
      </div>
    </div>
  );
}
