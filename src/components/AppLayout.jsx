import { Link, NavLink, useNavigate } from "react-router-dom";
import aptivaMark from "../assets/aptiva-mark.png";

function DashboardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 13h6v7H4z" />
      <path d="M14 4h6v16h-6z" />
      <path d="M4 4h6v5H4z" />
    </svg>
  );
}

function PracticeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
      <path d="M4 5h2v14H4z" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 17l5-5 4 4 7-8" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 7v5l3 2" />
      <path d="M5 6a9 9 0 1 1-1 11" />
      <path d="M4 4v5h5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z" />
    </svg>
  );
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { to: "/practice", label: "Practice", icon: <PracticeIcon /> },
  { to: "/progress", label: "Progress", icon: <ProgressIcon /> },
  { to: "/history", label: "History", icon: <HistoryIcon /> },
  { to: "/settings", label: "Settings", icon: <SettingsIcon /> },
];

export default function AppLayout({ children }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await fetch("/api/signout", {
        method: "POST",
      });
    } catch (err) {
      console.error("Signout Error:", err);
    }

    localStorage.removeItem("interviewUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("aptivaPracticeProgress");
    navigate("/signin");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/dashboard">
          <span className="brand-mark">
            <img src={aptivaMark} alt="" />
          </span>
          <span>
            <strong>Aptiva</strong>
          </span>
        </Link>

        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">Workspace</p>
          </div>
          <div className="topbar-actions">
            <Link className="ghost-button" to="/analysis/latest">
              Latest analysis
            </Link>
            <Link
              className="primary-button small"
              to="/practice"
            >
              Start practice
            </Link>
            <button
              className="secondary-button small"
              type="button"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
