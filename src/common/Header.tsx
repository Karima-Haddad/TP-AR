import { NavLink } from "react-router-dom";
import "../styles/header.css";

export default function Header() {
  return (
    <nav className="navbar">
      <div className="logo">
        <div className="logo-mark">⌘</div>
        DistribuLab
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