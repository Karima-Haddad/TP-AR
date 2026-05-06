import type { LeLannStep } from "../algorithms/mutex/leLann/leLannScenario";
import "../styles/leLann.css";

type Props = {
  step: LeLannStep;
};

const positions: Record<number, { x: number; y: number }> = {
  0: { x: 320, y: 70 },
  1: { x: 470, y: 180 },
  2: { x: 410, y: 350 },
  3: { x: 230, y: 350 },
  4: { x: 170, y: 180 },
};

const colors = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626"];

function stateLabel(state: string) {
  if (state === "dehors") return "OUT";
  if (state === "demandeur") return "REQ";
  return "SC";
}

export default function LeLannTimeline({ step }: Props) {
  return (
    <svg
      className="lelann-svg"
      viewBox="0 0 640 420"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="lelannArrow"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#3b82f6" />
        </marker>

        <filter id="scGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="
              1 0 0 0 0.98
              0 0.45 0 0 0.45
              0 0 0 0 0.13
              0 0 0 0.6 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="tokenGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Anneau */}
      {step.sites.map((site) => {
        const from = positions[site.id];
        const to = positions[(site.id + 1) % step.sites.length];
        return (
          <line
            key={`ring-${site.id}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className="lelann-ring-edge"
          />
        );
      })}

      {/* Flèche active + paquet animé */}
      {step.message && (
        <g>
          <line
            x1={positions[step.message.from].x}
            y1={positions[step.message.from].y}
            x2={positions[step.message.to].x}
            y2={positions[step.message.to].y}
            className="lelann-active-edge"
            markerEnd="url(#lelannArrow)"
          />
        </g>
      )}

      {/* Nœuds */}
      {step.sites.map((site) => {
        const pos = positions[site.id];
        const color = colors[site.id];
        const isActive = step.activeSite === site.id;
        const isReq = site.state === "demandeur";
        const isSC = site.state === "dedans";

        return (
          <g key={site.id}>
            {/* Halo actif (hors SC) */}
            {isActive && !isSC && (
              <>
                <circle cx={pos.x} cy={pos.y} r="38" fill={color} opacity="0.05" />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="32"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                  opacity="0.3"
                />
              </>
            )}

            {/* Anneau + badge WAIT (demandeur) */}
            {isReq && (
              <>
                <circle cx={pos.x} cy={pos.y} r="40" className="lelann-req-ring" />
                <rect
                  x={pos.x - 22}
                  y={pos.y - 55}
                  width="44"
                  height="16"
                  rx="8"
                  className="lelann-req-badge"
                />
                <text x={pos.x} y={pos.y - 47} className="lelann-req-text">
                  WAIT
                </text>
              </>
            )}

            {/* Aura + anneau rotatif + badge IN SC */}
            {isSC && (
              <>
                <circle cx={pos.x} cy={pos.y} r="50" className="lelann-sc-light" />
                <circle cx={pos.x} cy={pos.y} r="42" className="lelann-sc-ring" />
                <rect
                  x={pos.x - 22}
                  y={pos.y - 57}
                  width="44"
                  height="17"
                  rx="8.5"
                  className="lelann-sc-badge"
                />
                <text x={pos.x} y={pos.y - 48} className="lelann-sc-text">
                  IN SC
                </text>
              </>
            )}

            {/* Cercle principal du nœud */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={isSC ? 30 : 26}
              fill={isSC ? "rgba(255, 247, 237, 0.96)" : `${color}10`}
              stroke={isSC ? "#f97316" : isReq ? "#f59e0b" : color}
              strokeWidth={isSC ? 2.5 : isReq ? 2 : isActive ? 2 : 1.2}
              filter={isSC ? "url(#scGlow)" : undefined}
            />

            {/* Label S1 … S5 */}
            <text
              x={pos.x}
              y={pos.y - 4}
              className="lelann-node-title"
              fill={isSC ? "#ea580c" : isReq ? "#d97706" : color}
            >
              S{site.id + 1}
            </text>

            {/* État OUT / REQ / SC */}
            <text
              x={pos.x}
              y={pos.y + 12}
              className="lelann-node-state"
              fill={isSC ? "#ea580c" : isReq ? "#d97706" : color}
            >
              {stateLabel(site.state)}
            </text>

            {/* Pill TOKEN */}
            {site.tokenPresent && (
              <g className="lelann-token" filter="url(#tokenGlow)">
                <rect
                  x={pos.x + 16}
                  y={pos.y - 40}
                  width="44"
                  height="20"
                  rx="10"
                  className="lelann-token-box"
                />
                <circle
                  cx={pos.x + 28}
                  cy={pos.y - 30}
                  r="5"
                  className="lelann-token-dot"
                />
                <text x={pos.x + 44} y={pos.y - 30} className="lelann-token-label">
                  TOKEN
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
