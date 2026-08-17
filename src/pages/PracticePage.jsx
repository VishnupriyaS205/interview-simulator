import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";

const PRACTICE_PROGRESS_KEY = "aptivaPracticeProgress";
const PRACTICE_SETUP_KEY = "aptivaPracticeSetup";

function getSavedPracticeProgress() {
  try {
    return JSON.parse(localStorage.getItem(PRACTICE_PROGRESS_KEY) || "null");
  } catch {
    return null;
  }
}

function getSavedPracticeSetup(userId) {
  try {
    const setup = JSON.parse(localStorage.getItem(PRACTICE_SETUP_KEY) || "null");
    return setup?.userId === userId ? setup : null;
  } catch {
    return null;
  }
}

const roles = [
  {
    id: "frontend",
    name: "Frontend Developer",
    skills: ["React", "JavaScript", "HTML and CSS", "UI Debugging"],
  },
  {
    id: "backend",
    name: "Backend Developer",
    skills: ["Node.js", "Express.js", "SQL", "API Design"],
  },
  {
    id: "fullstack",
    name: "Full Stack Developer",
    skills: ["React + Node", "Database Integration", "Authentication", "Deployment"],
  },
  {
    id: "data",
    name: "Data Analyst",
    skills: ["Excel", "SQL Analysis", "Python Basics", "Data Visualization"],
  },
];

const difficulties = ["Easy", "Medium", "Hard"];

export default function PracticePage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const displayName = user?.fullName || "there";
  const [savedPractice, setSavedPractice] = useState(getSavedPracticeProgress());
  const rawSavedProgress = savedPractice;
  const savedProgress =
    rawSavedProgress?.userId === user?.id && rawSavedProgress?.view !== "final"
      ? rawSavedProgress
      : null;
  const [savedSetup, setSavedSetup] = useState(getSavedPracticeSetup(user?.id));
  const [isConfiguring, setIsConfiguring] = useState(!savedSetup && !savedProgress);
  const initialRole = roles.find(
    (role) =>
      role.name ===
      (savedProgress?.setup?.roleName || savedSetup?.roleName || user?.preferredRole),
  );
  const [selectedRole, setSelectedRole] = useState(initialRole?.id || "");
  const [selectedSkill, setSelectedSkill] = useState(
    savedProgress?.setup?.skill || savedSetup?.skill || user?.preferredSkill || "",
  );
  const [difficulty, setDifficulty] = useState(
    savedProgress?.setup?.difficulty ||
      savedSetup?.difficulty ||
      user?.preferredDifficulty ||
      "Easy",
  );
  const activeRole = roles.find((role) => role.id === selectedRole);
  const selectedSkillIsValid = activeRole?.skills.includes(selectedSkill);
  const completedRounds = savedProgress?.results?.length || 0;
  const currentRound = savedProgress?.roundIndex
    ? savedProgress.roundIndex + 1
    : 1;
  const currentQuestion = savedProgress?.currentQuestionIndex
    ? savedProgress.currentQuestionIndex + 1
    : 1;
  const totalRounds = savedProgress?.rounds?.length || 4;
  const canStartNewPractice = useMemo(
    () => Boolean(activeRole && selectedSkillIsValid && difficulty),
    [activeRole, difficulty, selectedSkillIsValid],
  );

  const handleRoleChange = (e) => {
    setSelectedRole(e.target.value);
    setSelectedSkill("");
  };

  const saveSelectedSetup = () => {
    const setup = {
      userId: user?.id,
      roleId: activeRole.id,
      roleName: activeRole.name,
      skill: selectedSkill,
      difficulty,
    };

    localStorage.setItem(PRACTICE_SETUP_KEY, JSON.stringify(setup));
    setSavedSetup(setup);
    setIsConfiguring(false);
    return setup;
  };

  const handleStartPractice = async (e) => {
    e.preventDefault();

    if (savedProgress) {
      navigate("/practice/session", {
        state: {
          resume: true,
        },
      });
      return;
    }

    if (!canStartNewPractice) {
      return;
    }

    const setup = saveSelectedSetup();

    try {
      const response = await fetch(`/api/users/${user.id}/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleName: setup.roleName,
          skill: setup.skill,
          difficulty: setup.difficulty,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("interviewUser", JSON.stringify(data.user));
      }
    } catch (err) {
      console.error("Preference Save Error:", err);
    }

    navigate("/practice/session", {
      state: {
        roleId: setup.roleId,
        roleName: setup.roleName,
        skill: setup.skill,
        difficulty: setup.difficulty,
      },
    });
  };

  const handleStartFreshPractice = async () => {
    if (!canStartNewPractice) {
      return;
    }

    localStorage.removeItem(PRACTICE_PROGRESS_KEY);
    setSavedPractice(null);
    const setup = saveSelectedSetup();

    try {
      const response = await fetch(`/api/users/${user.id}/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleName: setup.roleName,
          skill: setup.skill,
          difficulty: setup.difficulty,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("interviewUser", JSON.stringify(data.user));
      }
    } catch (err) {
      console.error("Preference Save Error:", err);
    }

    navigate("/practice/session", {
      state: {
        roleId: setup.roleId,
        roleName: setup.roleName,
        skill: setup.skill,
        difficulty: setup.difficulty,
        fresh: true,
      },
    });
  };

  const handleStartNewSetup = () => {
    localStorage.removeItem(PRACTICE_PROGRESS_KEY);
    localStorage.removeItem(PRACTICE_SETUP_KEY);
    setSavedPractice(null);
    setSavedSetup(null);
    setIsConfiguring(true);
  };

  const handleContinueSavedSetup = () => {
    if (!savedSetup) {
      return;
    }

    navigate("/practice/session", {
      state: {
        roleId: savedSetup.roleId,
        roleName: savedSetup.roleName,
        skill: savedSetup.skill,
        difficulty: savedSetup.difficulty,
        fresh: true,
      },
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Practice"
        description={`Welcome, ${displayName}. Choose a target role, select one matching skill, then start your interview practice.`}
      />

      <section className="practice-layout">
        <article className="card form-panel">
          {!isConfiguring && savedSetup ? (
            <div className="saved-setup-panel">
              <p className="eyebrow">Saved setup</p>
              <h2>{savedSetup.roleName}</h2>
              <div className="detail-row">
                <span>Skill</span>
                <strong>{savedSetup.skill}</strong>
              </div>
              <div className="detail-row">
                <span>Level</span>
                <strong>{savedSetup.difficulty}</strong>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={savedProgress ? handleStartPractice : handleContinueSavedSetup}
              >
                {savedProgress ? "Resume Practice" : "Continue Practice"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={handleStartNewSetup}
              >
                Start New
              </button>
            </div>
          ) : (
          <form onSubmit={handleStartPractice}>
            <label>
              Target role
              <select value={selectedRole} onChange={handleRoleChange} required>
                <option value="" disabled>
                  Select a target role
                </option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            {activeRole && (
              <fieldset className="radio-group">
                <legend>Skill</legend>
                {activeRole.skills.map((skill) => (
                  <label className="radio-option" key={skill}>
                    <input
                      type="radio"
                      name="skill"
                      value={skill}
                      checked={selectedSkill === skill}
                      onChange={(e) => setSelectedSkill(e.target.value)}
                      required
                    />
                    <span>{skill}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <label>
              Difficulty level
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                required
              >
                {difficulties.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="primary-button"
              type="submit"
              disabled={!savedProgress && !canStartNewPractice}
            >
              {savedProgress ? "Resume Practice" : "Continue Practice"}
            </button>
            {savedProgress && (
              <button
                className="secondary-button"
                type="button"
                onClick={handleStartFreshPractice}
                disabled={!canStartNewPractice}
              >
                Start Fresh Practice
              </button>
            )}
          </form>
          )}
        </article>

        <aside className="card side-panel">
          <p className="eyebrow">Progress</p>
          <h2>Four timed rounds</h2>
          <div className="detail-row">
            <span>Rounds completed</span>
            <strong>{completedRounds}</strong>
          </div>
          <div className="detail-row">
            <span>Current round</span>
            <strong>
              {currentRound} of {totalRounds}
            </strong>
          </div>
          <div className="detail-row">
            <span>Current question</span>
            <strong>{currentQuestion}</strong>
          </div>
          {savedProgress?.setup && (
            <div className="detail-row">
              <span>Saved setup</span>
              <strong>
                {savedProgress.setup.skill} - {savedProgress.setup.difficulty}
              </strong>
            </div>
          )}
          <ul className="check-list">
            <li>Aptitude + Logical Reasoning: 15 questions, 16 minutes.</li>
            <li>English Communication: 15 questions, 16 minutes.</li>
            <li>Technical Round: 15 questions based on role, skill, and level.</li>
            <li>AI Interview Analysis: written interview answers with AI feedback.</li>
          </ul>
        </aside>
      </section>
    </>
  );
}
