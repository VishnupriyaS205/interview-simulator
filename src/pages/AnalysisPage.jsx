import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

export default function AnalysisPage() {
  const { id } = useParams();
  const location = useLocation();
  const sessionId = location.state?.sessionId || id || "latest";
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("aptitude");

  useEffect(() => {
    const fetchReport = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const response = await fetch(
          `/api/users/${user.id}/sessions/${sessionId}`,
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Session not found");
          setReport(null);
          return;
        }

        setReport(data);
        setError("");
      } catch (err) {
        console.error("Analysis Fetch Error:", err);
        setError("Could not load this analysis.");
      }
    };

    fetchReport();
  }, [sessionId, user?.id]);

  const session = report?.session;
  const score = session?.total_questions
    ? Math.round((session.total_score / session.total_questions) * 100)
    : 0;
  const groupedAnswers = (report?.answers || []).reduce((groups, answer) => {
    const key = answer.round_key || "other";
    return {
      ...groups,
      [key]: [...(groups[key] || []), answer],
    };
  }, {});
  const analysisAnswers = groupedAnswers.video || [];
  const sections = [
    { id: "aptitude", label: "Aptitude" },
    { id: "english", label: "English" },
    { id: "technical", label: "Technical" },
    { id: "ai-video", label: "AI Interview Analysis" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Analysis"
        title={
          session ? `${session.role_name} analysis` : "Latest session analysis"
        }
        description={
          session
            ? `${session.skill_name} at ${session.difficulty} level.`
            : "Viewing your latest completed private performance report."
        }
        actions={
          <Link className="secondary-button" to="/history">
            History
          </Link>
        }
      />

      {error && (
        <section className="card">
          <p className="error-text">{error}</p>
        </section>
      )}

      {session && (
        <>
          <section className="stats-grid">
            <StatCard
              label="Final score"
              value={`${score}%`}
              note="your saved result"
            />
            <StatCard
              label="Correct"
              value={session.total_score}
              note="answers matched"
            />
            <StatCard
              label="Questions"
              value={session.total_questions}
              note={session.skill_name}
            />
            <StatCard
              label="Technical"
              value={session.technical_score || 0}
              note="AI content score"
            />
            <StatCard
              label="AI feedback"
              value={`${session.final_score || score}%`}
              note={`${session.filler_word_count || 0} filler words`}
            />
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Feedback</p>
                <h2>
                  {session.session_name ||
                    `${session.role_name} - ${session.skill_name}`}
                </h2>
              </div>
            </div>
            <p className="muted">
              {session.feedback || "Review the explanations and try again."}
            </p>
          </section>

          <section className="card list-card">
            <p className="eyebrow">Report View</p>
            <h2>Detailed sections</h2>
            <div className="result-grid">
              {sections.map((section) => (
                <button
                  className={
                    activeSection === section.id
                      ? "result-card report-section-button is-active"
                      : "result-card report-section-button"
                  }
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                >
                  <p className="eyebrow">{section.label}</p>
                </button>
              ))}
            </div>

            {activeSection !== "ai-video" &&
              (groupedAnswers[activeSection]?.length ? (
                groupedAnswers[activeSection].map((answer, index) => {
                  const needsReview =
                    answer.user_answer !== answer.correct_answer;

                  return (
                    <article
                      className="explanation-item"
                      key={`${answer.question_text}-${index}`}
                    >
                      <strong>
                        {index + 1}. {answer.question_text}
                      </strong>
                      <p>Your answer: {answer.user_answer}</p>
                      <p>Correct answer: {answer.correct_answer}</p>
                      {needsReview && (
                        <p className="error-text">Need review</p>
                      )}
                      <p>{answer.explanation}</p>
                    </article>
                  );
                })
              ) : (
                <p className="muted">No saved details for this section.</p>
              ))}

            {activeSection === "ai-video" && (
              <>
                <article className="explanation-item">
                  <strong>Overall recommendation</strong>
                  <p>
                    {session.feedback ||
                      "Review your interview answers and add more detail."}
                  </p>
                </article>
                {analysisAnswers.map((answer, index) => (
                  <article
                    className="explanation-item"
                    key={`${answer.question_text}-${index}`}
                  >
                    <strong>
                      {index + 1}. {answer.question_text}
                    </strong>
                    <p>{answer.user_answer}</p>
                  </article>
                ))}
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}
