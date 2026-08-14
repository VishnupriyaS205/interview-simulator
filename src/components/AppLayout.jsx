import { Link, NavLink, useNavigate } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "D" },
  { to: "/practice", label: "Practice", icon: "P" },
  { to: "/progress", label: "Progress", icon: "G" },
  { to: "/history", label: "History", icon: "H" },
  { to: "/settings", label: "Settings", icon: "S" },
];

export default function AppLayout({ children }) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.setItem("isAuthenticated", "false");
    localStorage.removeItem("interviewUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("aptivaPracticeProgress");
    navigate("/signin");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/dashboard">
          <span className="brand-mark">A</span>
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
