import { NavLink } from "react-router-dom";
import "../styles/header.css";

export default function Header() {
  return (
    <nav className="navbar">
      <div className="logo">
        <div className="logo-icon">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="2" />
            <circle cx="6" cy="18" r="2" />
            <circle cx="18" cy="18" r="2" />

            <line x1="12" y1="6" x2="6" y2="18" />
            <line x1="12" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="18" />
          </svg>
        </div>

        <span className="logo-text gradient-text">
          DistribuLab
        </span>
      </div>

      <NavLink to="/lamport" className="nav-tab">
        <span className="tab-dot"></span>
        Horloges & causalité
      </NavLink>

      <NavLink to="/snapshot" className="nav-tab">
        <span className="tab-dot"></span>
        Snapshots
      </NavLink>

      <NavLink to="/ricart" className="nav-tab">
        <span className="tab-dot"></span>
        Exclusion mutuelle
      </NavLink>

      <NavLink to="/election" className="nav-tab">
        <span className="tab-dot"></span>
        Élection
      </NavLink>

      <div className="nav-spacer"></div>

      <div className="nav-info">
        <span className="status-dot"></span>
        Simulateur actif
      </div>
    </nav>
  );
}