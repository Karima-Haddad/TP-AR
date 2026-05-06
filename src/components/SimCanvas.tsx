import { useMemo } from 'react';
import type { FC } from 'react';
import type { LamportStep, VectorStep, MatrixStep, ClockAlgo } from '../types/clock.types';
import { fmtVector } from '../algorithms/clock/vectorClock';

type AnyStep = LamportStep | VectorStep | MatrixStep;

interface Props {
  algo: ClockAlgo;
  step: number;
  steps: AnyStep[];
}

const N_PROCS  = 5;
const COLORS   = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626'];
const PROC_IDS = ['P1', 'P2', 'P3', 'P4', 'P5'];

const LABEL_W  = 40;
const MARGIN_R = 20;

// Grille
const CELL = 16;
const GW   = 5 * CELL;   // 80px par grille
const GH   = 5 * CELL;   // 80px de hauteur

// Espacement minimal entre deux grilles sur la même ligne
const GAP  = 18;
const SLOT = GW + GAP;    // 98px par événement

// Layout vertical
const ROW_H_NORMAL = 72;
const ROW_H_MATRIX = GH + 40;  // hauteur = grille + espace sous la grille
const MATRIX_ABOVE = GH + 16;  // espace au-dessus de la timeline
const TOP          = 30;

function lineY(algo: ClockAlgo, i: number) {
  return algo === 'matrix'
    ? TOP + MATRIX_ABOVE + i * ROW_H_MATRIX
    : TOP + 14 + i * ROW_H_NORMAL;
}

function activeProc(s: AnyStep): number {
  const st = s as LamportStep;
  if (st.tag === 'recv' && st.to !== undefined) return st.to;
  if (st.from !== undefined) return st.from;
  const m = st.t.match(/P([1-5])/);
  if (m) return parseInt(m[1]) - 1;
  return 0;
}

function buildEventPositions(steps: AnyStep[]) {
  const counts = [0, 0, 0, 0, 0];
  return steps.map((s, globalIdx) => {
    const proc = activeProc(s);
    const occ  = counts[proc];
    counts[proc] += 1;
    return { proc, occ, globalIdx };
  });
}

// En mode matrix : X basé sur l'index global * SLOT pour garantir l'espacement
// En mode normal : X basé sur la largeur disponible / total
function eventX(globalIdx: number, total: number, algo: ClockAlgo, svgW: number): number {
  if (algo === 'matrix') {
    return LABEL_W + globalIdx * SLOT + SLOT / 2;
  }
  const spacing = (svgW - LABEL_W - MARGIN_R) / (total + 1);
  return LABEL_W + (globalIdx + 1) * spacing;
}

function clockLabel(algo: ClockAlgo, s: AnyStep, proc: number): string {
  if (algo === 'lamport') return String((s as LamportStep).clocks[proc]);
  if (algo === 'vector')  return fmtVector((s as VectorStep).clocks[proc]);
  return '';
}

// ─── Grille matricielle ───────────────────────────────────────────────────────

function MatrixGrid({ mat, cx, timelineY, col, isCur, procIdx }: {
  mat: number[][];
  cx: number;
  timelineY: number;
  col: string;
  isCur: boolean;
  procIdx: number;
}) {
  const ox = cx - GW / 2;
  const oy = timelineY - GH - 10;

  return (
    <g opacity={isCur ? 1 : 0.6}>
      <rect x={ox - 2} y={oy - 2} width={GW + 4} height={GH + 4}
        rx="4" fill="#f6f7fb"
        stroke={col} strokeWidth={isCur ? 1.5 : 0.7}
      />
      {mat.map((row, r) =>
        row.map((val, c) => {
          const cellX  = ox + c * CELL;
          const cellY  = oy + r * CELL;
          const isDiag = r === c;
          const isRow  = r === procIdx;
          return (
            <g key={`${r}-${c}`}>
              {(isDiag || isRow) && (
                <rect x={cellX} y={cellY} width={CELL} height={CELL}
                  fill={col} opacity={isDiag ? 0.2 : 0.08} />
              )}
              <text
                x={cellX + CELL / 2} y={cellY + CELL / 2}
                textAnchor="middle" dominantBaseline="middle"
                fill={isDiag ? col : isRow ? col : '#475569'}
                fontSize="9"
                fontFamily="'DM Mono', monospace"
                fontWeight={isDiag ? '700' : isRow ? '600' : '400'}
              >
                {val}
              </text>
            </g>
          );
        })
      )}
      {Array.from({ length: 6 }, (_, k) => (
        <g key={k}>
          <line x1={ox} y1={oy + k * CELL} x2={ox + GW} y2={oy + k * CELL}
            stroke={col} strokeWidth="0.4" opacity="0.35" />
          <line x1={ox + k * CELL} y1={oy} x2={ox + k * CELL} y2={oy + GH}
            stroke={col} strokeWidth="0.4" opacity="0.35" />
        </g>
      ))}
      {/* Trait pointillé grille → point */}
      <line x1={cx} y1={oy + GH + 2} x2={cx} y2={timelineY - 9}
        stroke={col} strokeWidth="0.8" strokeDasharray="3,2" opacity="0.45" />
    </g>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const SimCanvas: FC<Props> = ({ algo, step, steps }) => {
  const eventPositions = useMemo(() => buildEventPositions(steps), [steps]);
  const total          = steps.length;
  const visibleSteps   = steps.slice(0, step + 1);

  // Largeur SVG : en mode matrix, calculée pour tenir tous les événements
  const svgW = algo === 'matrix'
    ? LABEL_W + total * SLOT + MARGIN_R
    : 640;

  const LY = (i: number) => lineY(algo, i);
  const EX = (gi: number) => eventX(gi, total, algo, svgW);

  const arrows = useMemo(() => {
    const result: {
      x1: number; y1: number;
      x2: number; y2: number;
      col: string; isLast: boolean;
    }[] = [];
    const vis = steps.slice(0, step + 1);
    for (let i = 0; i < vis.length; i++) {
      const s = vis[i] as LamportStep;
      if (s.tag !== 'send') continue;
      for (let j = i + 1; j < vis.length; j++) {
        const r = vis[j] as LamportStep;
        if (r.tag === 'recv' && r.from === s.from && r.to === s.to) {
          const eps = eventPositions[i];
          const epr = eventPositions[j];
          result.push({
            x1: eventX(eps.globalIdx, total, algo, svgW),
            y1: lineY(algo, eps.proc),
            x2: eventX(epr.globalIdx, total, algo, svgW),
            y2: lineY(algo, epr.proc),
            col: COLORS[s.from!],
            isLast: j === step,
          });
          break;
        }
      }
    }
    return result;
  }, [algo, step, steps, eventPositions, total, svgW]);

  const SVG_H = algo === 'matrix'
    ? TOP + MATRIX_ABOVE + (N_PROCS - 1) * ROW_H_MATRIX + 40
    : TOP + 14 + (N_PROCS - 1) * ROW_H_NORMAL + 36;
import type { SimStep, AlgoId } from '../types/diffusion';

interface Props {
  step: SimStep;
  algoId: AlgoId;
  stepIndex: number;
}

// 4 processus en cercle + séquenceur au centre pour algo sequencer
// CY = 205 pour centrer dans viewBox 640×420 en tenant compte de la légende (25px bas)
const CX = 320, CY = 205, R = 148;
const PROCS = Array.from({ length: 4 }, (_, i) => {
  const a = -Math.PI / 2 + (2 * Math.PI / 4) * i;
  return { id: `P${i}`, x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
});
const SEQ = { id: 'S', x: CX, y: CY }; // séquenceur au centre

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed'];
const SEQ_COLOR = '#dc2626';

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default function SimCanvas({ step, algoId, stepIndex }: Props) {
  const isSeq = algoId === 'sequencer';
  const crashed = (step as { crashed?: number }).crashed ?? -1;

  // Calcul des arêtes
  const renderEdges = () => {
    if (isSeq) {
      // Arêtes vers séquenceur central
      return PROCS.map((p, i) => (
        <line
          key={i}
          x1={p.x} y1={p.y}
          x2={SEQ.x} y2={SEQ.y}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="1"
        />
      ));
    }
    // Topologie anneau pour FIFO et causal
    return PROCS.map((p, i) => {
      const j = (i + 1) % 4;
      return (
        <line
          key={i}
          x1={p.x} y1={p.y}
          x2={PROCS[j].x} y2={PROCS[j].y}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="1"
        />
      );
    });
  };

  // Message en transit animé
  const renderTransit = () => {
    const m = step.transitMsg;
    if (!m) return null;

    const from = m.from;
    const to = m.to;

    // Broadcast : dessiner vers tous les autres
    if (to === -1) {
      return PROCS.map((p, i) => {
        if (i === from) return null;
        const src = from === -1 ? SEQ : PROCS[from];
        const dst = p;
        const col = from === -1 ? SEQ_COLOR : COLORS[from];
        return (
          <g key={`transit-${i}`}>
            <line
              x1={src.x} y1={src.y}
              x2={dst.x} y2={dst.y}
              stroke={col}
              strokeWidth="1.5"
              strokeDasharray="4,3"
              opacity="0.5"
            />
            <circle r="5" fill={col} opacity="0.9">
              <animateMotion
                key={`anim-${stepIndex}-${i}`}
                dur="0.7s"
                repeatCount="1"
                path={`M${src.x},${src.y} L${dst.x},${dst.y}`}
              />
            </circle>
          </g>
        );
      });
    }

    // Point à point
    const src = from === -1 ? SEQ : PROCS[from];
    const dst = to === -1 ? SEQ : PROCS[to];
    const col = from === -1 ? SEQ_COLOR : COLORS[from];

    return (
      <g>
        <defs>
          <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill={col} />
          </marker>
        </defs>
        <line
          x1={src.x} y1={src.y}
          x2={dst.x} y2={dst.y}
          stroke={col}
          strokeWidth="1.5"
          opacity="0.6"
          markerEnd="url(#arr)"
        />
        <circle r="5" fill={col} opacity="0.9">
          <animateMotion
            key={`anim-${stepIndex}`}
            dur="0.7s"
            repeatCount="1"
            path={`M${src.x},${src.y} L${dst.x},${dst.y}`}
          />
        </circle>
        {/* Label du message */}
        <text
          x={(src.x + dst.x) / 2 + 8}
          y={(src.y + dst.y) / 2 - 8}
          fontSize="10"
          fontFamily="DM Mono, monospace"
          fill={col}
          opacity="0.9"
        >
          {m.content}{m.seqNum !== undefined ? `(${m.seqNum})` : ''}{m.globalSeq !== undefined ? `[${m.globalSeq}]` : ''}
        </text>
      </g>
    );
  };

  // Nœuds
  const renderNodes = () => {
    const nodes = PROCS.map((p, i) => {
      const col = COLORS[i];
      const isCrashed = crashed === i;
      const isActive = step.activeFrom === i || step.activeTo === i;
      const isWaiting = step.waiting?.includes(i);
      const clock = step.clocks[i] ?? '?';

      return (
        <g key={i}>
          {/* Anneau de glow si actif */}
          {isActive && !isCrashed && (
            <>
              <circle cx={p.x} cy={p.y} r="38" fill={col} opacity="0.05" />
              <circle
                cx={p.x} cy={p.y} r="32"
                fill="none"
                stroke={col}
                strokeWidth="1.5"
                opacity="0.2"
                strokeDasharray="4,3"
              />
            </>
          )}
          {/* Badge attente */}
          {isWaiting && (
            <g>
              <rect
                x={p.x - 20} y={p.y - 54}
                width="40" height="16" rx="8"
                fill="rgba(217,119,6,0.12)"
                stroke="rgba(217,119,6,0.4)"
                strokeWidth="1"
              />
              <text
                x={p.x} y={p.y - 45}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight="600"
                fontFamily="DM Mono, monospace"
                fill="#d97706"
              >
                WAIT
              </text>
            </g>
          )}
          {/* Cercle principal */}
          <circle
            cx={p.x} cy={p.y} r="28"
            fill={isCrashed ? 'rgba(220,38,38,0.05)' : `rgba(${hexToRgb(col)},0.09)`}
            stroke={isCrashed ? '#f87171' : col}
            strokeWidth={isActive ? 2 : 1}
            opacity={isCrashed ? 0.5 : 1}
          />
          {isCrashed && (
            <>
              <line x1={p.x - 10} y1={p.y - 10} x2={p.x + 10} y2={p.y + 10} stroke="#dc2626" strokeWidth="1.5" />
              <line x1={p.x + 10} y1={p.y - 10} x2={p.x - 10} y2={p.y + 10} stroke="#dc2626" strokeWidth="1.5" />
            </>
          )}
          {/* Label */}
          <text
            x={p.x} y={p.y - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="13"
            fontWeight="600"
            fontFamily="DM Sans, sans-serif"
            fill={isCrashed ? '#dc2626' : col}
          >
            {p.id}
          </text>
          <text
            x={p.x} y={p.y + 13}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9.5"
            fontFamily="DM Mono, monospace"
            fill={isCrashed ? '#dc2626' : col}
            opacity="0.75"
          >
            {isCrashed ? '✗' : clock}
          </text>
        </g>
      );
    });

    // Séquenceur (centre) si algo séquenceur
    if (isSeq) {
      const isSeqActive = step.activeFrom === -1 || step.activeTo === -1;
      nodes.push(
        <g key="seq">
          {isSeqActive && (
            <>
              <circle cx={SEQ.x} cy={SEQ.y} r="38" fill={SEQ_COLOR} opacity="0.05" />
              <circle
                cx={SEQ.x} cy={SEQ.y} r="32"
                fill="none"
                stroke={SEQ_COLOR}
                strokeWidth="1.5"
                opacity="0.2"
                strokeDasharray="4,3"
              />
            </>
          )}
          <circle
            cx={SEQ.x} cy={SEQ.y} r="28"
            fill={`rgba(${hexToRgb(SEQ_COLOR)},0.08)`}
            stroke={SEQ_COLOR}
            strokeWidth={isSeqActive ? 2 : 1}
          />
          <text
            x={SEQ.x} y={SEQ.y - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="13"
            fontWeight="600"
            fontFamily="DM Sans, sans-serif"
            fill={SEQ_COLOR}
          >
            S
          </text>
          <text
            x={SEQ.x} y={SEQ.y + 13}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fontFamily="DM Mono, monospace"
            fill={SEQ_COLOR}
            opacity="0.75"
          >
            séquenceur
          </text>
        </g>
      );
    }

    return nodes;
  };

  // Légende
  const TAG_LEGEND: Record<string, { color: string; label: string }> = {
    send:    { color: '#2563eb', label: 'envoi' },
    recv:    { color: '#059669', label: 'réception' },
    deliver: { color: '#059669', label: 'livraison' },
    wait:    { color: '#d97706', label: 'attente' },
    order:   { color: '#7c3aed', label: 'ordre' },
  };
  const legend = TAG_LEGEND[step.tag];

  return (
    <svg
      id="simSvg"
      viewBox={`0 0 ${svgW} ${SVG_H}`}
      preserveAspectRatio="xMinYMid meet"
      style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
    >
      <defs>
        {COLORS.map((col, i) => (
          <marker key={`arr-${i}`} id={`arr-${i}`}
            markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M1,1 L7,4 L1,7 Z" fill={col} />
          </marker>
        ))}
      </defs>

      {/* ── Titre ── */}
      <text x="20" y="18" fill="#2563eb" fontSize="11"
        fontFamily="'DM Mono', monospace" opacity="0.5">
        {algo === 'lamport' ? 'Horloge de Lamport'
          : algo === 'vector' ? 'Horloge vectorielle'
          : 'Horloge matricielle'} · étape {step + 1}
      </text>

      {/* ── Timelines ── */}
      {PROC_IDS.map((pid, i) => {
        const y   = LY(i);
        const col = COLORS[i];
        return (
          <g key={`proc-${i}`}>
            <line x1={LABEL_W} y1={y} x2={svgW - MARGIN_R} y2={y}
              stroke={col} strokeWidth="1.5" opacity="0.22" />
            <polygon
              points={`${svgW-MARGIN_R-1},${y-4} ${svgW-MARGIN_R+7},${y} ${svgW-MARGIN_R-1},${y+4}`}
              fill={col} opacity="0.35"
            />
            <text x={LABEL_W - 8} y={y}
              textAnchor="end" dominantBaseline="middle"
              fill={col} fontSize="13" fontWeight="600"
              fontFamily="'DM Sans', sans-serif">
              {pid}
            </text>
          </g>
        );
      })}

      {/* ── Flèches ── */}
      {arrows.map((arr, idx) => (
        <line key={`arrow-${idx}`}
          x1={arr.x1} y1={arr.y1} x2={arr.x2} y2={arr.y2}
          stroke={arr.col}
          strokeWidth={arr.isLast ? 2 : 1.5}
          opacity={arr.isLast ? 1 : 0.55}
          markerEnd={`url(#arr-${COLORS.indexOf(arr.col)})`}
        />
      ))}

      {/* ── Événements ── */}
      {visibleSteps.map((s, i) => {
        const ep    = eventPositions[i];
        const x     = EX(ep.globalIdx);
        const y     = LY(ep.proc);
        const col   = COLORS[ep.proc];
        const isCur = i === step;
        const tag   = (s as LamportStep).tag;
        const r     = tag === 'local' ? 5 : 7;

        return (
          <g key={`ev-${i}`}>
            {/* Grille matricielle au-dessus du point */}
            {algo === 'matrix' && (
              <MatrixGrid
                mat={(s as MatrixStep).matrices[ep.proc]}
                cx={x}
                timelineY={y}
                col={col}
                isCur={isCur}
                procIdx={ep.proc}
              />
            )}
            {isCur && (
              <circle cx={x} cy={y} r={r + 9} fill={col} opacity="0.10" />
            )}
            <circle cx={x} cy={y} r={r}
              fill={col}
              opacity={isCur ? 1 : 0.65}
              stroke={isCur ? '#fff' : 'none'}
              strokeWidth={isCur ? 1.5 : 0}
            />
            {algo !== 'matrix' && (
              <text x={x} y={y - r - 5}
                textAnchor="middle" dominantBaseline="auto"
                fill={col}
                fontSize={algo === 'lamport' ? 10 : 8}
                fontFamily="'DM Mono', monospace"
                fontWeight={isCur ? '600' : '400'}
                opacity={isCur ? 1 : 0.65}
              >
                {clockLabel(algo, s, ep.proc)}
              </text>
            )}
          </g>
        );
      })}

      {/* ── Légende ── */}
      <g transform={`translate(20, ${SVG_H - 14})`}>
        <circle cx="4" cy="4" r="5" fill="#64748b" opacity="0.7" />
        <text x="13" y="8" fill="#94a3b8" fontSize="10"
          fontFamily="'DM Mono', monospace">envoi / réception</text>
        <circle cx="148" cy="4" r="4" fill="#94a3b8" opacity="0.7" />
        <text x="157" y="8" fill="#94a3b8" fontSize="10"
          fontFamily="'DM Mono', monospace">local</text>
        {algo === 'matrix' && (
          <text x="210" y="8" fill="#94a3b8" fontSize="10"
            fontFamily="'DM Mono', monospace">· diag surlignée = événements locaux</text>
        )}
      </g>
    </svg>
  );
};

export default SimCanvas;
      viewBox="0 0 640 420"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
    >
      {/* Titre */}
      <text x="20" y="22" fontSize="11" fontFamily="DM Mono, monospace" fill="#2563eb" opacity="0.5">
        {step.title} · étape {stepIndex + 1}
      </text>

      {/* Arêtes */}
      {renderEdges()}

      {/* Transit */}
      {renderTransit()}

      {/* Nœuds */}
      {renderNodes()}

      {/* Légende tag courant */}
      {legend && (
        <g transform="translate(20, 395)">
          <rect width="8" height="8" rx="2"
            fill={`rgba(${hexToRgb(legend.color)},0.12)`}
            stroke={legend.color}
            strokeWidth="0.8"
          />
          <text x="12" y="7" fontSize="10" fontFamily="DM Mono, monospace" fill="#94a3b8">
            {legend.label}
          </text>
        </g>
      )}
    </svg>
  );
}
