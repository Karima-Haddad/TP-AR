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