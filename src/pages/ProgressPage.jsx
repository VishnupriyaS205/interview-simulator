import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

export default function ProgressPage() {
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${user.id}/progress`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Progress API failed");
        }

        setProgress(data);
        setError("");
      } catch (err) {
        console.error("Progress Fetch Error:", err);
        setError("Could not load your progress right now.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, [user?.id]);

  const summary = progress?.summary;
  const sessions = progress?.sessions || [];
  const roundStats = progress?.roundStats || [];
  const suggestions = progress?.suggestions || [];
  const nextPractice = progress?.nextPractice;
  const trendText =
    summary?.trend > 0
      ? `+${summary.trend}% from previous`
      : summary?.trend < 0
        ? `${summary.trend}% from previous`
        : "No change yet";

  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Practice progress"
        description="Compare your recent sessions and choose what to practice next."
        actions={
          <Link className="primary-button" to="/practice">
            Start practice
          </Link>
        }
      />

      {error && (
        <section className="card">
          <p className="error-text">{error}</p>
        </section>
      )}

      {isLoading && (
        <section className="card">
          <p className="status-text">Loading your saved practice progress...</p>
        </section>
      )}

      {summary && (
        <>
          <section className="stats-grid">
            <StatCard label="Sessions" value={summary.sessions} note="all saved practice" />
            <StatCard label="Latest score" value={`${summary.latestScore}%`} note={trendText} />
            <StatCard
              label="Overall change"
              value={`${summary.overallChange > 0 ? "+" : ""}${summary.overallChange || 0}%`}
              note={`from first score ${summary.firstScore || 0}%`}
            />
            <StatCard label="Average score" value={`${summary.averageScore}%`} note="all-session average" />
            <StatCard label="Best score" value={`${summary.bestScore}%`} note="best saved result" />
          </section>

          {nextPractice && (
            <section className="card">
              <p className="eyebrow">Practice Suggestions</p>
              <h2>
                Do {nextPractice.skillName} at {nextPractice.difficulty} level next
              </h2>
              <p className="muted">
                Focus: {nextPractice.focus}. {nextPractice.reason}
              </p>
              <Link className="primary-button small" to="/practice">
                Start suggested practice
              </Link>
            </section>
          )}

          <section className="dashboard-grid">
            <article className="card large-card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Overall practice</p>
                  <h2>Progress across sessions</h2>
                </div>
              </div>
              {sessions.length === 0 ? (
                <p className="muted">Complete one practice session to see progress.</p>
              ) : (
                <div className="progress-session-list">
                  {sessions.map((session) => (
                    <div className="progress-session-item" key={session.id}>
                      <div>
                        <strong>{session.name}</strong>
                        <span>
                          {session.skillName} - {session.difficulty}
                        </span>
                      </div>
                      <div className="progress-bar" aria-label={`${session.percentage}%`}>
                        <span style={{ width: `${session.percentage}%` }} />
                      </div>
                      <strong>{session.percentage}%</strong>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="card">
              <p className="eyebrow">Based on previous practice</p>
              <h2>What to do next</h2>
              <ul className="check-list">
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="card list-card">
            <p className="eyebrow">Weak areas</p>
            <h2>Round performance</h2>
            {roundStats.length === 0 ? (
              <p className="muted">Round-level results will appear after a saved session.</p>
            ) : (
              roundStats.map((round) => (
                <article className="history-item" key={round.roundKey}>
                  <div>
                    <h2>{round.label}</h2>
                    <p className="muted">
                      {round.correct} correct out of {round.attempted}
                    </p>
                  </div>
                  <strong>{round.accuracy}%</strong>
                </article>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
