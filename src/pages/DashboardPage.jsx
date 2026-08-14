import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

function getSessionSlug(session) {
  return [session.role_name, session.skill_name, session.difficulty, "practice"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function DashboardPage() {
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const displayName = user?.fullName || "there";
  const [dashboard, setDashboard] = useState({
    summary: { sessions: 0, average_score: 0 },
    latestSession: null,
  });

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const response = await fetch(`/api/users/${user.id}/dashboard`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });

        if (!response.ok) {
          throw new Error("Dashboard API failed");
        }

        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      }
    };

    fetchDashboard();
  }, [user?.id]);

  const latest = dashboard.latestSession;
  const averageScore = `${dashboard.summary.average_score || 0}%`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome, ${displayName}. This dashboard shows only your practice activity.`}
        actions={
          <Link className="primary-button" to="/practice">
            Start practice
          </Link>
        }
      />

      <section className="stats-grid">
        <StatCard
          label="Sessions"
          value={dashboard.summary.sessions || 0}
          note="your saved sessions"
        />
        <StatCard
          label="Average score"
          value={averageScore}
          note="from your attempts"
        />
        <StatCard label="Account" value={displayName} note="logged-in user" />
        <StatCard
          label="Focus area"
          value={latest?.skill_name || "Not set"}
          note="latest skill"
        />
      </section>

      <section className="dashboard-grid">
        <article className="card large-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Practice flow</p>
              <h2>Role and skill selection</h2>
            </div>
            <Link className="text-link" to="/practice">
              Configure
            </Link>
          </div>
          <div className="flow-list">
            <span>Choose role</span>
            <span>Pick skill</span>
            <span>Select difficulty</span>
            <span>Review report</span>
          </div>
        </article>

        <article className="card">
          <p className="eyebrow">Recent history</p>
          <h2>
            {latest
              ? latest.session_name || `${latest.role_name} Interview Practice`
              : "No saved sessions yet"}
          </h2>
          <p className="muted">
            {latest
              ? `Latest score: ${latest.total_score}/${latest.total_questions}`
              : "Complete an interview to create your first private history item."}
          </p>
          {latest && (
            <Link
              className="secondary-button"
              to={`/analysis/${getSessionSlug(latest)}`}
              state={{ sessionId: latest.id }}
            >
              View analysis
            </Link>
          )}
        </article>
      </section>
    </>
  );
}
