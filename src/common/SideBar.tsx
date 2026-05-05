import { NavLink, useLocation } from "react-router-dom";
import "../styles/sidebar.css";

const groups = {
  sync: {
    title: "HORLOGES & CAUSALITÉ",
    algos: [
      { path: "/lamport", label: "Horloge de Lamport", icon: "⏱" },
      { path: "/vector", label: "Horloges vectorielles", icon: "→" },
      { path: "/matrix", label: "Horloges matricielles", icon: "⊞" },
    ],
  },
  mutex: {
    title: "EXCLUSION MUTUELLE",
    algos: [
      { path: "/lamport-mutex", label: "Lamport Mutex", icon: "🔑" },
      { path: "/ricart", label: "Ricart-Agrawala", icon: "🤝" },
      { path: "/lelann", label: "LeLann", icon: "🎨" },
      { path: "/ricarttoken", label: "Ricart-Token", icon: "🎫" },
    ],
  },
};

export default function Sidebar() {
  const { pathname } = useLocation();

  const group =
    pathname.includes("ricart") || pathname.includes("mutex")
      ? groups.mutex
      : groups.sync;

  return (
    <aside className="sidebar">
      <div className="sidebar-group">
        <div className="sidebar-label">{group.title}</div>

        {group.algos.map((algo) => (
          <NavLink key={algo.path} to={algo.path} className="algo-btn">
            <span className="algo-icon">{algo.icon}</span>
            {algo.label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}