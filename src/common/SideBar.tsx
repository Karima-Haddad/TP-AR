import { NavLink, useLocation } from "react-router-dom";
import "../styles/sidebar.css";

type IconType =
  | "clock"
  | "vector"
  | "matrix"
  | "lock"
  | "handshake"
  | "token"
  | "ticket"
  | "crown"
  | "ring"
  | "fifo"
  | "causal"
  | "sequencer";
  

const groups = {
  sync: {
    title: "HORLOGES & CAUSALITÉ",
    algos: [
      {
        path: "/lamport-horloge",
        label: "Horloge de Lamport",
        icon: "clock" as const,
      },
      {
        path: "/vector",
        label: "Horloges vectorielles",
        icon: "vector" as const,
      },
      {
        path: "/matrix",
        label: "Horloges matricielles",
        icon: "matrix" as const,
      },
    ],
  },

  mutex: {
    title: "EXCLUSION MUTUELLE",
    algos: [
      {
        path: "/mutex/lamport",
        label: "Lamport Mutex",
        icon: "lock" as const,
      },
      {
        path: "/mutex/ricart",
        label: "Ricart-Agrawala",
        icon: "handshake" as const,
      },
      {
        path: "/mutex/lelann",
        label: "LeLann",
        icon: "token" as const,
      },
      {
        path: "/mutex/ricarttoken",
        label: "Ricart-Token",
        icon: "ticket" as const,
      },
    ],
  },

  election: {
    title: "ALGORITHMES D'ÉLECTION",
    algos: [
      {
        path: "/election/bully",
        label: "Bully",
        icon: "crown" as const,
      },
      {
        path: "/election/chang-roberts",
        label: "Chang-Roberts",
        icon: "ring" as const,
      },
      {
        path: "/election/lelann",
        label: "LeLann Election",
        icon: "token" as const,
      },
    ],
  },
  diffusion: {
    title: "DIFFUSION DE MESSAGES",
    algos: [
      {
        path: "/diffusion/fifo",
        label: "FIFO",
        icon: "fifo" as const,
      },
      {
        path: "/diffusion/causal",
        label: "Causal",
        icon: "causal" as const,
      },
      {
        path: "/diffusion/sequencer",
        label: "Séquenceur",
        icon: "sequencer" as const,
      },
    ],
  },
};

type GroupType = (typeof groups)[keyof typeof groups];

function renderIcon(type: IconType) {
  switch (type) {
    case "clock":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );

    case "vector":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 12h13" />
          <path d="M13 7l5 5-5 5" />
          <circle cx="5" cy="12" r="1.3" />
        </svg>
      );

    case "matrix":
      return (
        <svg viewBox="0 0 24 24">
          <rect x="4" y="4" width="6" height="6" rx="1.2" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" />
          <rect x="4" y="14" width="6" height="6" rx="1.2" />
          <rect x="14" y="14" width="6" height="6" rx="1.2" />
        </svg>
      );

    case "lock":
      return (
        <svg viewBox="0 0 24 24">
          <rect x="5" y="10" width="14" height="10" rx="2.2" />
          <path d="M8 10V8a4 4 0 0 1 8 0v2" />
          <path d="M12 14v2" />
        </svg>
      );

    case "handshake":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 12l4-4 4 4" />
          <path d="M20 12l-4-4-4 4" />
          <path d="M8 12l4 4 4-4" />
          <path d="M7 17h10" />
        </svg>
      );

    case "token":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
        </svg>
      );

    case "ticket":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M5 8h14v8H5z" />
          <path d="M8 8v8" />
          <path d="M16 8v8" />
          <path d="M10 12h4" />
        </svg>
      );

    case "crown":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 18l2-10 6 5 6-5 2 10H4z" />
        </svg>
      );

    case "ring":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4v4" />
        </svg>
      );
    
    case "fifo":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 7h12" />
          <path d="M4 12h10" />
          <path d="M4 17h8" />
          <path d="M17 8l3 4-3 4" />
        </svg>
      );

    case "causal":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="6" cy="7" r="2" />
          <circle cx="18" cy="7" r="2" />
          <circle cx="12" cy="17" r="2" />
          <path d="M8 8.5l3 6" />
          <path d="M16 8.5l-3 6" />
          <path d="M6 9v5" />
        </svg>
      );

    case "sequencer":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="6" r="2.5" />
          <path d="M12 9v4" />
          <path d="M5 18h14" />
          <path d="M7 14h10v4H7z" />
        </svg>
      );
  }
}

export default function Sidebar() {
  const { pathname } = useLocation();

  let group: GroupType = groups.sync;

  if (pathname.includes("/diffusion")) {
    group = groups.diffusion;
  }

  if (pathname.includes("/mutex")) {
    group = groups.mutex;
  }

  if (pathname.includes("/election")) {
    group = groups.election;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-group">
        <div className="sidebar-label">{group.title}</div>

        {group.algos.map((algo) => (
          <NavLink
            key={algo.path}
            to={algo.path}
            className="algo-btn"
          >
            <span className="algo-icon">
              {renderIcon(algo.icon)}
            </span>

            <span className="algo-text">
              {algo.label}
            </span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}