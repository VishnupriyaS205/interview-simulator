import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";

function formatScore(session) {
  if (!session.total_questions) {
    return "0%";
  }

  return `${Math.round((session.total_score / session.total_questions) * 100)}%`;
}

function getSessionSlug(session) {
  return [
    session.role_name,
    session.skill_name,
    session.difficulty,
    "practice",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function HistoryPage() {
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const fetchHistoryData = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const headers = {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        };
        const sessionsResponse = await fetch(`/api/users/${user.id}/sessions`, {
          headers,
        });

        if (!sessionsResponse.ok) {
          throw new Error("History API failed");
        }

        const sessionsData = await sessionsResponse.json();

        setSessions(sessionsData);
        setError("");
      } catch (err) {
        console.error("History Fetch Error:", err);
        setError("Could not load your interview history.");
      }
    };

    fetchHistoryData();
  }, [user?.id]);

  const handleRemoveSession = async (sessionId) => {
    setDeletingId(sessionId);
    setDeleteError("");

    try {
      const response = await fetch(`/api/users/${user.id}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Remove session API failed");
      }

      setSessions((current) =>
        current.filter((session) => session.id !== sessionId),
      );
    } catch (err) {
      console.error("History Remove Error:", err);
      setDeleteError("Could not remove this session. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageHeader
       
        title="Your interview history"
        description="Only sessions saved under your account are shown here."
      />

      <section className="card list-card">
        {error && <p className="error-text">{error}</p>}
        {deleteError && <p className="error-text">{deleteError}</p>}
        {!error && sessions.length === 0 && (
          <p className="muted">No saved sessions yet. Start an interview to build your history.</p>
        )}
        {sessions.map((session) => (
          <article className="history-item" key={session.id}>
            <div>
              <h2>{session.session_name || `${session.role_name} Interview Practice`}</h2>
            <p className="muted">
              {session.skill_name || "Skill practice"} - {session.difficulty || "Easy"}
            </p>
            <p className="muted">
              Technical: {session.technical_score ?? 0} | Feedback:{" "}
              {session.feedback || "Open report for feedback"}
            </p>
          </div>
            <strong>{formatScore(session)}</strong>
            <Link
              className="secondary-button small"
              to={`/analysis/${getSessionSlug(session)}`}
              state={{ sessionId: session.id }}
            >
              Open
            </Link>
            <button
              className="primary-button small"
              type="button"
              onClick={() => handleRemoveSession(session.id)}
              disabled={deletingId === session.id}
            >
              {deletingId === session.id ? "Removing" : "Remove"}
            </button>
          </article>
        ))}
      </section>
    </>
  );
}
