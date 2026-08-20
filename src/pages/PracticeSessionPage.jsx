import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageHeader from "../components/PageHeader";

const ROUND_TIME = 16 * 60;
const PRACTICE_PROGRESS_KEY = "aptivaPracticeProgress";
const pendingQuestionRequests = new Map();

function getSavedPracticeProgress() {
  try {
    return JSON.parse(localStorage.getItem(PRACTICE_PROGRESS_KEY) || "null");
  } catch {
    return null;
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getScore(questions, answers) {
  return questions.reduce((score, question, index) => {
    if (question.type === "video") {
      return score + (answers[index]?.score || 0);
    }

    return answers[index] === question.answer ? score + 1 : score;
  }, 0);
}

function formatFillerWords(fillerWords = []) {
  return fillerWords.length ? fillerWords.join(", ") : "None detected";
}

function analyzeVideoAnswer(text, question) {
  const cleanText = text.toLowerCase();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const fillerMatches =
    cleanText.match(/\b(um|uh|like|actually|basically)\b/g) || [];
  const fillerWords = Object.entries(
    fillerMatches.reduce((counts, word) => {
      counts[word] = (counts[word] || 0) + 1;
      return counts;
    }, {}),
  ).map(([word, count]) => `${word} (${count})`);
  const matchedTerms = question.technicalTerms.filter((term) =>
    cleanText.includes(term.toLowerCase()),
  );

  const communicationScore =
    words.length >= 35 ? 2 : words.length >= 18 ? 1 : 0;
  const technicalScore =
    matchedTerms.length >= 2 ? 2 : matchedTerms.length === 1 ? 1 : 0;
  const fillerScore = fillerMatches.length <= 2 ? 1 : 0;
  const rawScore = communicationScore + technicalScore + fillerScore;
  const repeatedWords = words.length - new Set(words).size;
  const looksAiGenerated =
    words.length >= 70 &&
    fillerMatches.length === 0 &&
    repeatedWords < words.length * 0.35 &&
    /\b(firstly|moreover|therefore|in conclusion|overall)\b/.test(cleanText);

  return {
    score: rawScore >= 4 ? 1 : 0,
    communicationScore,
    technicalScore,
    fillerCount: fillerMatches.length,
    fillerWords,
    matchedTerms,
    looksAiGenerated,
    recommendation: looksAiGenerated
      ? "Use your own natural wording and add one personal project detail."
      : rawScore >= 4
        ? "Keep this structure. Add one measurable result to make it stronger."
        : "Use this structure next time: situation, action, technical detail, result.",
    feedback: looksAiGenerated
      ? "This looks highly polished or AI-assisted. Use your own natural wording and add a personal project detail."
      : rawScore >= 4
        ? "Clear answer. You gave enough detail and used relevant technical language."
        : "Improve this answer by adding structure: problem, action, result, and one technical keyword.",
  };
}

function normalizeGeminiAnalysis(analysis) {
  const communicationScore = Number(analysis.communicationScore) || 0;
  const technicalScore = Number(analysis.technicalScore) || 0;

  return {
    score: Number(analysis.score) === 1 ? 1 : 0,
    communicationScore: Math.min(Math.round(communicationScore / 50), 2),
    technicalScore: Math.min(Math.round(technicalScore / 50), 2),
    fillerCount: Number(analysis.fillerCount) || 0,
    matchedTerms: [],
    looksAiGenerated: false,
    recommendation:
      analysis.recommendation ||
      analysis.feedback ||
      "Use this structure next time: situation, action, technical detail, result.",
    feedback: analysis.feedback || "Review your answer and add more detail.",
    fillerWords: Array.isArray(analysis.fillerWords)
      ? analysis.fillerWords
      : [],
    improvementAreas: Array.isArray(analysis.improvementAreas)
      ? analysis.improvementAreas
      : [],
  };
}

function getResultById(results, id) {
  return results.find((item) => item.id === id);
}

function getNextStepSuggestion(results, percentage, skill, difficulty) {
  const lowestRound = [...results]
    .filter((item) => item.total)
    .sort((a, b) => a.score / a.total - b.score / b.total)[0];

  if (percentage >= 80) {
    return difficulty === "Hard"
      ? `Strong work. Try a new ${skill} topic or practice with stricter timing.`
      : `Strong work. Move ${skill} practice to the next difficulty.`;
  }

  if (percentage >= 60) {
    return lowestRound
      ? `Review ${lowestRound.title} first, then repeat one focused ${skill} session.`
      : `Review explanations, then repeat one focused ${skill} session.`;
  }

  return lowestRound
    ? `Start with ${lowestRound.title} basics and answer slowly with reasoning.`
    : `Practice fundamentals first, then try the same setup again.`;
}

async function fetchInterviewQuestionsOnce(params) {
  const key = params.toString();

  if (pendingQuestionRequests.has(key)) {
    return pendingQuestionRequests.get(key);
  }

  const request = fetch(`/api/interview/questions?${params}`).then(
    async (response) => {
      const text = await response.text();
      let data;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          "Backend did not return JSON. Check that the Express server is running.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Interview questions API failed",
        );
      }

      return data;
    },
  );

  pendingQuestionRequests.set(key, request);

  try {
    return await request;
  } finally {
    pendingQuestionRequests.delete(key);
  }
}

function normalizeSavedRounds(rounds) {
  return rounds.map((round) =>
    round.id === "video"
      ? {
          ...round,
          questions: round.questions.slice(0, 5),
        }
      : round,
  );
}

function hasValidSavedRounds(savedProgress) {
  const rounds = savedProgress?.rounds;
  const focusedRound = savedProgress?.setup?.focusRound;

  return (
    Array.isArray(rounds) &&
    rounds.length === (focusedRound ? 1 : 4) &&
    rounds.every((round) =>
      round?.id === "video"
        ? round.questions?.length === 5
        : round?.questions?.length === 15,
    )
  );
}

export default function PracticeSessionPage() {
  const { state } = useLocation();
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const rawSavedProgress = state?.fresh ? null : getSavedPracticeProgress();
  const savedProgress =
    rawSavedProgress?.userId === user?.id &&
    hasValidSavedRounds(rawSavedProgress)
      ? rawSavedProgress
      : null;
  const roleName =
    savedProgress?.setup?.roleName || state?.roleName || "Frontend Developer";
  const skill = savedProgress?.setup?.skill || state?.skill || "React";
  const difficulty =
    savedProgress?.setup?.difficulty || state?.difficulty || "Easy";
  const focusRound = savedProgress?.setup?.focusRound || state?.focusRound || "";

  const [rounds, setRounds] = useState(() =>
    savedProgress?.rounds
      ? normalizeSavedRounds(savedProgress.rounds)
      : [],
  );
  const [roundIndex, setRoundIndex] = useState(savedProgress?.roundIndex || 0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(
    savedProgress?.rounds?.[savedProgress?.roundIndex || 0]?.id === "video"
      ? Math.min(savedProgress?.currentQuestionIndex || 0, 4)
      : savedProgress?.currentQuestionIndex || 0,
  );
  const [answers, setAnswers] = useState(savedProgress?.answers || {});
  const [results, setResults] = useState(savedProgress?.results || []);
  const [timeLeft, setTimeLeft] = useState(
    savedProgress?.timeLeft || ROUND_TIME,
  );
  const [view, setView] = useState(
    savedProgress?.view === "review"
      ? "questions"
      : savedProgress?.view || "questions",
  );
  const [savedSessionId, setSavedSessionId] = useState(
    savedProgress?.savedSessionId || null,
  );
  const [saveError, setSaveError] = useState("");
  const [roundError, setRoundError] = useState("");
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(!savedProgress);
  const [questionRetryCount, setQuestionRetryCount] = useState(0);
  const [activeReportSection, setActiveReportSection] = useState(
    focusRound === "video" ? "ai-video" : focusRound || "aptitude",
  );
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (savedProgress) {
      return;
    }

    let isCancelled = false;

    const fetchInterviewQuestions = async () => {
      const params = new URLSearchParams({
        roleName,
        skill,
        difficulty,
        requestId: Date.now().toString(),
      });
      const expectedRoundIds = focusRound
        ? [focusRound]
        : ["aptitude", "english", "technical", "video"];

      if (focusRound) {
        params.set("focusRound", focusRound);
      }

      try {
        setRoundError("");
        setIsLoadingQuestions(true);

        const data = await fetchInterviewQuestionsOnce(params);
        const aiRounds = data.rounds || [];
        const orderedRounds = expectedRoundIds
          .map((roundId) => aiRounds.find((round) => round.id === roundId))
          .filter(Boolean);
        const hasAiRounds =
          orderedRounds.length === expectedRoundIds.length &&
          orderedRounds.every((round) =>
            round.id === "video"
              ? round.questions.length === 5
              : round.questions.length === 15,
          );

        if (!hasAiRounds) {
          throw new Error("Gemini did not return the selected fresh round.");
        }

        if (isCancelled) {
          return;
        }

        setRounds(
          orderedRounds.map((round) =>
            round.id === "video"
              ? {
                  ...round,
                  type: "video",
                  questions: round.questions.map((question) => ({
                    ...question,
                    type: "video",
                    options: [],
                    answer: "Structured interview answer",
                    explanation:
                      question.explanation ||
                      "A strong interview answer uses clear structure, enough detail, and role-specific technical words.",
                  })),
                }
              : round,
          ),
        );
      } catch (err) {
        console.error("Interview Questions Fetch Error:", err);

        if (!isCancelled) {
          setRounds([]);
          setRoundError(
            `Gemini question generation failed. ${err.message || "Please check your API key, model, or quota."}`,
          );
        }
      } finally {
        if (!isCancelled) {
          setRoundIndex(0);
          setCurrentQuestionIndex(0);
          setAnswers({});
          setResults([]);
          setSavedSessionId(null);
          setSaveError("");
          setSaveAttempted(false);
          setTimeLeft(ROUND_TIME);
          setView("questions");
          setIsLoadingQuestions(false);
        }
      }
    };

    fetchInterviewQuestions();

    return () => {
      isCancelled = true;
    };
  }, [difficulty, focusRound, questionRetryCount, roleName, savedProgress, skill]);

  const emptyRound = useMemo(() => ({ id: "", title: "", questions: [] }), []);
  const activeRound = rounds[roundIndex] || emptyRound;
  const currentQuestion = activeRound.questions[currentQuestionIndex];
  const isVideoRound = activeRound.type === "video";
  const activeAnswers = useMemo(
    () => answers[activeRound.id] || {},
    [activeRound.id, answers],
  );
  const score = getScore(activeRound.questions, activeAnswers);
  const answeredCount = activeRound.questions.filter((question, index) => {
    const answer = activeAnswers[index];
    return question.type === "video"
      ? Boolean(answer?.text?.trim())
      : Boolean(String(answer || "").trim());
  }).length;
  const isRoundComplete = answeredCount === activeRound.questions.length;
  const isLastRound = roundIndex === rounds.length - 1;
  const videoAnalytics = useMemo(() => {
    if (!isVideoRound) {
      return null;
    }

    const answersList = Object.values(activeAnswers);
    const totalWords = answersList.reduce((sum, answer) => {
      const words = answer.text?.trim().split(/\s+/).filter(Boolean) || [];
      return sum + words.length;
    }, 0);
    const totalCommunication = answersList.reduce(
      (sum, answer) => sum + (answer.communicationScore || 0),
      0,
    );
    const totalTechnical = answersList.reduce(
      (sum, answer) => sum + (answer.technicalScore || 0),
      0,
    );
    const totalFillers = answersList.reduce(
      (sum, answer) => sum + (answer.fillerCount || 0),
      0,
    );
    const possibleScore = activeRound.questions.length * 4;
    const currentScore = totalCommunication + totalTechnical;
    const readiness = possibleScore
      ? Math.round((currentScore / possibleScore) * 100)
      : 0;

    return {
      answered: answersList.length,
      totalWords,
      totalFillers,
      communicationPercent: Math.round(
        (totalCommunication / (activeRound.questions.length * 2)) * 100,
      ),
      technicalPercent: Math.round(
        (totalTechnical / (activeRound.questions.length * 2)) * 100,
      ),
      readiness,
      pace:
        totalWords >= answersList.length * 35
          ? "Good detail"
          : totalWords >= answersList.length * 18
            ? "Add examples"
            : "Too short",
    };
  }, [activeAnswers, activeRound.questions.length, isVideoRound]);
  const overallAnalytics = useMemo(() => {
    const completedResults = results.filter(
      (item) => item.id !== activeRound.id,
    );
    const completedScore = completedResults.reduce(
      (sum, item) => sum + item.score,
      0,
    );
    const completedQuestions = completedResults.reduce(
      (sum, item) => sum + item.total,
      0,
    );
    const totalInterviewQuestions = rounds.reduce(
      (sum, round) => sum + round.questions.length,
      0,
    );
    const activeAnswerCount = Object.values(activeAnswers).filter((answer) => {
      if (typeof answer === "string") {
        return answer.length > 0;
      }

      return Boolean(answer?.text?.trim());
    }).length;
    const totalAnswered =
      completedQuestions + (answers[activeRound.id] ? activeAnswerCount : 0);
    const liveScore = completedScore + score;
    const livePossible = completedQuestions + activeRound.questions.length;
    const readiness = livePossible
      ? Math.round((liveScore / livePossible) * 100)
      : 0;
    const currentRoundAccuracy = activeRound.questions.length
      ? Math.round((score / activeRound.questions.length) * 100)
      : 0;
    const totalProgress = totalInterviewQuestions
      ? Math.round((totalAnswered / totalInterviewQuestions) * 100)
      : 0;
    const timeUsedPercent = Math.round(
      ((ROUND_TIME - timeLeft) / ROUND_TIME) * 100,
    );

    return {
      completedRounds: completedResults.length,
      currentRoundAccuracy,
      readiness,
      timeUsedPercent,
      totalAnswered,
      totalInterviewQuestions,
      totalProgress,
    };
  }, [activeAnswers, activeRound, answers, results, rounds, score, timeLeft]);

  const requestInterviewAnalyses = useCallback(
    async (items) => {
      const fallbackAnalyses = items.map((item) =>
        analyzeVideoAnswer(item.text, item.question),
      );

      try {
        const response = await fetch("/api/interview/analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answers: items.map((item) => ({
              question: item.question.question,
              answer: item.text,
            })),
            roleName,
            skill,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Gemini analysis failed");
        }

        const analyses = Array.isArray(data.analyses)
          ? data.analyses
          : data.analysis
            ? [data.analysis]
            : [];

        return items.map((_, index) =>
          analyses[index]
            ? normalizeGeminiAnalysis(analyses[index])
            : fallbackAnalyses[index],
        );
      } catch (err) {
        console.error("Interview Analysis Error:", err);
        return fallbackAnalyses;
      }
    },
    [roleName, skill],
  );

  const finishRound = useCallback(async () => {
    if (!isRoundComplete) {
      setRoundError("Answer every question in this round before submitting.");
      return;
    }

    let finalAnswers = activeAnswers;

    if (isVideoRound) {
      setIsAnalyzingVideo(true);
      setRoundError("Analyzing your interview answers with Gemini...");

      const analysisItems = activeRound.questions.map((question, index) => ({
        question,
        text: activeAnswers[index]?.text || "",
      }));
      const analyses = await requestInterviewAnalyses(analysisItems);

      const analyzedEntries = activeRound.questions.map((question, index) => [
        index,
        {
          ...activeAnswers[index],
          text: analysisItems[index].text,
          ...analyses[index],
        },
      ]);

      finalAnswers = Object.fromEntries(analyzedEntries);
      setAnswers((current) => ({
        ...current,
        [activeRound.id]: finalAnswers,
      }));
      setIsAnalyzingVideo(false);
    }

    const finalScore = getScore(activeRound.questions, finalAnswers);
    const roundResult = {
      id: activeRound.id,
      title: activeRound.title,
      score: finalScore,
      total: activeRound.questions.length,
      answers: finalAnswers,
      questions: activeRound.questions,
    };

    const nextResults = [
      ...results.filter((item) => item.id !== activeRound.id),
      roundResult,
    ];

    setAnswers((current) => ({
      ...current,
      [activeRound.id]: finalAnswers,
    }));
    setResults(nextResults);
    setRoundError("");
    setCurrentQuestionIndex(0);
    if (isLastRound) {
      setView("final");
      return;
    }

    const nextRound = rounds[roundIndex + 1];

    setRoundIndex((current) => current + 1);
    setAnswers((current) => {
      const updatedAnswers = {
        ...current,
        [activeRound.id]: finalAnswers,
      };
      delete updatedAnswers[nextRound.id];
      return updatedAnswers;
    });
    setResults(nextResults);
    setTimeLeft(ROUND_TIME);
    setView("questions");
  }, [
    activeAnswers,
    activeRound,
    isRoundComplete,
    isLastRound,
    isVideoRound,
    results,
    roundIndex,
    rounds,
    requestInterviewAnalyses,
  ]);

  useEffect(() => {
    const setupMedia = async () => {
      if (!isVideoRound || view !== "questions") {
        return;
      }

      if (!user?.id) {
        setMediaError("Sign in with a registered account before starting the video interview.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError("Camera recording is not supported in this browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setMediaError("");
      } catch (err) {
        console.error("Media Error:", err);
        setMediaError("Camera or microphone permission is needed for the video interview.");
      }
    };

    setupMedia();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
    };
  }, [isVideoRound, user?.id, view]);

  useEffect(() => {
    if (view !== "questions") {
      return undefined;
    }

    const timerId = setTimeout(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          setTimeout(finishRound, 0);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearTimeout(timerId);
  }, [finishRound, timeLeft, view]);

  const handleAnswerChange = (questionIndex, selectedOption) => {
    setRoundError("");
    setAnswers((current) => ({
      ...current,
      [activeRound.id]: {
        ...(current[activeRound.id] || {}),
        [questionIndex]: selectedOption,
      },
    }));
  };

  const handleVideoAnswerChange = (questionIndex, text) => {
    setRoundError("");

    setAnswers((current) => ({
      ...current,
      [activeRound.id]: {
        ...(current[activeRound.id] || {}),
        [questionIndex]: {
          ...(current[activeRound.id]?.[questionIndex] || {}),
          text,
        },
      },
    }));
  };

  const handleStartRecording = () => {
    if (!streamRef.current) {
      setMediaError("Allow camera and microphone before recording.");
      return;
    }

    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setMediaError("");
    } catch (err) {
      console.error("Recording Error:", err);
      setMediaError("Could not start recording in this browser.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const totalScore = results.reduce((sum, item) => sum + item.score, 0);
  const totalQuestions = results.reduce((sum, item) => sum + item.total, 0);
  const percentage = totalQuestions
    ? Math.round((totalScore / totalQuestions) * 100)
    : 0;
  const nextStepSuggestion = getNextStepSuggestion(
    results,
    percentage,
    skill,
    difficulty,
  );
  const reportSections = [
    { id: "aptitude", label: "Aptitude" },
    { id: "english", label: "English" },
    { id: "technical", label: "Technical" },
    { id: "ai-video", label: "AI Interview Analysis" },
  ].filter((section) =>
    rounds.some((round) =>
      section.id === "ai-video"
        ? round.id === "video"
        : round.id === section.id,
    ),
  );

  useEffect(() => {
    if (view === "final") {
      localStorage.setItem(
        PRACTICE_PROGRESS_KEY,
        JSON.stringify({
          setup: {
            roleName,
            skill,
            difficulty,
            focusRound,
          },
          userId: user?.id,
          rounds,
          roundIndex,
          currentQuestionIndex,
          answers,
          results,
          timeLeft,
          view,
          savedSessionId,
          completed: true,
          progress: {
            answeredCount,
            currentQuestion: currentQuestionIndex + 1,
            totalProgress: 100,
          },
        }),
      );
      return;
    }

    localStorage.setItem(
      PRACTICE_PROGRESS_KEY,
      JSON.stringify({
        setup: {
          roleName,
          skill,
          difficulty,
          focusRound,
        },
        userId: user?.id,
        rounds,
        roundIndex,
        currentQuestionIndex,
        answers,
        results,
        timeLeft,
        view,
        savedSessionId,
        progress: {
          answeredCount,
          currentQuestion: currentQuestionIndex + 1,
          totalProgress: overallAnalytics.totalProgress,
        },
      }),
    );
  }, [
    answers,
    answeredCount,
    currentQuestionIndex,
    difficulty,
    focusRound,
    overallAnalytics.totalProgress,
    results,
    roleName,
    roundIndex,
    rounds,
    savedSessionId,
    skill,
    timeLeft,
    user?.id,
    view,
  ]);

  useEffect(() => {
    const saveInterviewSession = async () => {
      if (
        !user?.id ||
        savedSessionId ||
        saveAttempted ||
        results.length !== rounds.length
      ) {
        return;
      }

      try {
        setSaveAttempted(true);
        const response = await fetch("/api/interview/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            roleName,
            skill,
            difficulty,
            results,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not save session");
        }

        setSavedSessionId(data.session.id);
        setSaveError("");
      } catch (err) {
        console.error("Save Session Error:", err);
        setSaveError(
          "This result is shown here, but it was not saved to history.",
        );
      }
    };

    if (view === "final") {
      saveInterviewSession();
    }
  }, [
    difficulty,
    results,
    focusRound,
    roleName,
    rounds.length,
    saveAttempted,
    savedSessionId,
    skill,
    user?.id,
    view,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Interview"
        title={
          view === "final"
            ? "Report View"
            : view === "review"
              ? `Round score: ${score} / ${activeRound.questions.length}`
              : activeRound.title || "Generating questions"
        }
        description={`${roleName} interview for ${skill} at ${difficulty} level.`}
        actions={
          <Link className="secondary-button" to="/practice">
            Change setup
          </Link>
        }
      />

      {isLoadingQuestions && (
        <section className="card">
          <p className="status-text">
            Generating fresh Gemini interview questions...
          </p>
        </section>
      )}

      {!isLoadingQuestions && view === "questions" && rounds.length === 0 && (
        <section className="card">
          <p className="error-text">
            {roundError ||
              "Questions are not available right now. Try again."}
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              localStorage.removeItem(PRACTICE_PROGRESS_KEY);
              setQuestionRetryCount((count) => count + 1);
            }}
          >
            Retry Gemini
          </button>
        </section>
      )}

      {!isLoadingQuestions && view === "questions" && rounds.length > 0 && (
        <section className="interview-grid">
          <article className="card question-card">
            <div className="round-meta">
              <p className="eyebrow">
                Round {roundIndex + 1} of {rounds.length}
              </p>
              <strong>
                Question {currentQuestionIndex + 1} of{" "}
                {activeRound.questions.length}
              </strong>
            </div>

            <div className="question-list">
              {isVideoRound && (
                <div className="video-interview-panel">
                  <div className="video-interview-layout">
                    <div className="video-recorder-panel">
                      <video ref={videoRef} autoPlay muted playsInline />
                      <div className="button-row">
                        <button
                          className="primary-button"
                          type="button"
                          onClick={handleStartRecording}
                          disabled={isRecording}
                        >
                          Start recording
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={handleStopRecording}
                          disabled={!isRecording}
                        >
                          Stop recording
                        </button>
                      </div>
                      <p>
                        Record your practice answer, then type the same answer
                        below so the app can analyze recommendation and filler
                        words.
                      </p>
                    </div>

                    <aside className="live-analytics-panel">
                      <div>
                        <p className="eyebrow">Answer analysis</p>
                        <h3>{videoAnalytics.readiness}% readiness</h3>
                      </div>
                      <div className="analytics-meter">
                        <span
                          style={{ width: `${videoAnalytics.readiness}%` }}
                        />
                      </div>
                      <div className="analytics-list">
                        <span>Answered</span>
                        <strong>
                          {videoAnalytics.answered}/
                          {activeRound.questions.length}
                        </strong>
                        <span>Words</span>
                        <strong>{videoAnalytics.totalWords}</strong>
                        <span>Fillers</span>
                        <strong>{videoAnalytics.totalFillers}</strong>
                        <span>Communication</span>
                        <strong>{videoAnalytics.communicationPercent}%</strong>
                        <span>Technical</span>
                        <strong>{videoAnalytics.technicalPercent}%</strong>
                        <span>Pace</span>
                        <strong>{videoAnalytics.pace}</strong>
                      </div>
                    </aside>
                  </div>
                  <p className="status-text">
                    Verified registered user:{" "}
                    {user?.email || "signed-in account"}
                  </p>
                  {mediaError && <p className="error-text">{mediaError}</p>}
                </div>
              )}

              {currentQuestion && (
                <fieldset
                  className="question-block"
                  key={currentQuestion.question}
                >
                  <legend>
                    {currentQuestionIndex + 1}. {currentQuestion.question}
                  </legend>

                  {currentQuestion.type === "video" ? (
                    <>
                      <textarea
                        className="compact-textarea"
                        placeholder="Type your interview answer here so the app can analyze communication and technical coverage."
                        value={activeAnswers[currentQuestionIndex]?.text || ""}
                        onChange={(e) =>
                          handleVideoAnswerChange(
                            currentQuestionIndex,
                            e.target.value,
                          )
                        }
                      />
                      {activeAnswers[currentQuestionIndex] && (
                        <div className="video-feedback-grid">
                          <p>
                            Recommendation:{" "}
                            {activeAnswers[currentQuestionIndex]
                              .recommendation ||
                              activeAnswers[currentQuestionIndex].feedback}
                          </p>
                          <p>
                            Filler words used:{" "}
                            {formatFillerWords(
                              activeAnswers[currentQuestionIndex].fillerWords,
                            )}
                          </p>
                          {activeAnswers[currentQuestionIndex]
                            .looksAiGenerated && (
                            <span>AI-like response detected</span>
                          )}
                          {activeAnswers[currentQuestionIndex].improvementAreas
                            ?.length > 0 && (
                            <p>
                              Improve:{" "}
                              {activeAnswers[
                                currentQuestionIndex
                              ].improvementAreas.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    currentQuestion.options.map((option) => (
                      <label className="radio-option" key={option}>
                        <input
                          type="radio"
                          name={`${activeRound.id}-${currentQuestionIndex}`}
                          value={option}
                          checked={
                            activeAnswers[currentQuestionIndex] === option
                          }
                          onChange={(e) =>
                            handleAnswerChange(
                              currentQuestionIndex,
                              e.target.value,
                            )
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))
                  )}
                </fieldset>
              )}
            </div>

            <div className="button-row">
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setCurrentQuestionIndex((current) => current - 1)
                }
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </button>
              {currentQuestionIndex < activeRound.questions.length - 1 &&
                !isRoundComplete && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      setCurrentQuestionIndex((current) => current + 1)
                    }
                  >
                    Next
                  </button>
                )}
              <button
                className="primary-button"
                type="button"
                onClick={finishRound}
                disabled={!isRoundComplete || isAnalyzingVideo}
              >
                {isAnalyzingVideo ? "Analyzing..." : "Submit round"}
              </button>
            </div>
            <p className="status-text">
              {answeredCount} / {activeRound.questions.length} answered in this
              round.
            </p>
            {roundError && <p className="error-text">{roundError}</p>}
          </article>

          <aside className="card side-panel">
            <p className="eyebrow">Live overall analytics</p>
            <div className="timer-box">{formatTime(timeLeft)}</div>
            <div className="performance-score">
              <strong>{overallAnalytics.readiness}%</strong>
              <span>overall readiness</span>
            </div>
            <div className="analytics-meter">
              <span style={{ width: `${overallAnalytics.readiness}%` }} />
            </div>
            <div className="detail-row">
              <span>Total progress</span>
              <strong>
                {overallAnalytics.totalAnswered}/
                {overallAnalytics.totalInterviewQuestions}
              </strong>
            </div>
            <div className="detail-row">
              <span>Current round score</span>
              <strong>{overallAnalytics.currentRoundAccuracy}%</strong>
            </div>
            <div className="detail-row">
              <span>Rounds completed</span>
              <strong>{overallAnalytics.completedRounds}</strong>
            </div>
            <div className="detail-row">
              <span>Current round</span>
              <strong>
                {roundIndex + 1} of {rounds.length}
              </strong>
            </div>
            <div className="detail-row">
              <span>Time used</span>
              <strong>{overallAnalytics.timeUsedPercent}%</strong>
            </div>
            <div className="analytics-meter muted-meter">
              <span style={{ width: `${overallAnalytics.totalProgress}%` }} />
            </div>
            <div className="round-progress-list">
              {rounds.map((round, index) => {
                const isCompleted = results.some(
                  (item) => item.id === round.id,
                );
                const isCurrent = round.id === activeRound.id;

                return (
                  <span
                    className={
                      isCompleted
                        ? "round-progress-item is-complete"
                        : isCurrent
                          ? "round-progress-item is-current"
                          : "round-progress-item"
                    }
                    key={round.id}
                  >
                    {index + 1}. {round.title}
                  </span>
                );
              })}
            </div>
          </aside>
        </section>
      )}

      {view === "final" && (
        <section className="card report-panel">
          <p className="eyebrow">Report View</p>
          <h2>
            {totalScore} / {totalQuestions} correct - {percentage}%
          </h2>
          <div className="result-grid">
            {reportSections.map((section) => {
              const resultId = section.id === "ai-video" ? "video" : section.id;
              const result = getResultById(results, resultId);

              return (
                <button
                  className={
                    activeReportSection === section.id
                      ? "result-card report-section-button is-active"
                      : "result-card report-section-button"
                  }
                  key={section.id}
                  type="button"
                  onClick={() => setActiveReportSection(section.id)}
                >
                  <p className="eyebrow">{section.label}</p>
                  <strong>
                    {result ? `${result.score} / ${result.total}` : "Open"}
                  </strong>
                  {result && (
                    <span>
                      {Math.round((result.score / result.total) * 100)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="status-text">{nextStepSuggestion}</p>
          <div className="report-detail-panel">
            {activeReportSection !== "ai-video" &&
              (() => {
                const result = getResultById(results, activeReportSection);

                if (!result) {
                  return (
                    <p className="muted">No report data for this section.</p>
                  );
                }

                return (
                  <>
                    <h3>{result.title}</h3>
                    {result.questions.map((question, index) => {
                      const answer = result.answers[index] || "Not answered";
                      const isVideoQuestion = question.type === "video";
                      const needsReview =
                        !isVideoQuestion && answer !== question.answer;

                      return (
                        <article
                          className="explanation-item"
                          key={question.question}
                        >
                          <strong>
                            {index + 1}. {question.question}
                          </strong>
                          <p>
                            Your answer:{" "}
                            {isVideoQuestion
                              ? answer.text || "Not answered"
                              : answer}
                          </p>
                          {!isVideoQuestion && (
                            <p>Correct answer: {question.answer}</p>
                          )}
                          {needsReview && (
                            <p className="error-text">Need review</p>
                          )}
                          <p>
                            {isVideoQuestion
                              ? answer.feedback || question.explanation
                              : question.explanation}
                          </p>
                        </article>
                      );
                    })}
                  </>
                );
              })()}
            {activeReportSection === "ai-video" &&
              (() => {
                const result = getResultById(results, "video");

                if (!result) {
                  return (
                    <p className="muted">
                      No AI interview analysis is available yet.
                    </p>
                  );
                }

                return (
                  <>
                    <h3>AI Interview Analysis</h3>
                    {result.questions.map((question, index) => {
                      const answer = result.answers[index] || {};

                      return (
                        <article
                          className="explanation-item"
                          key={question.question}
                        >
                          <strong>
                            {index + 1}. {question.question}
                          </strong>
                          <p>
                            Recommendation:{" "}
                            {answer.recommendation ||
                              answer.feedback ||
                              "Add more structure and specific examples."}
                          </p>
                          <p>
                            Filler words used:{" "}
                            {formatFillerWords(answer.fillerWords)}
                          </p>
                          {answer.improvementAreas?.length > 0 && (
                            <p>
                              Next improvement:{" "}
                              {answer.improvementAreas.join(", ")}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </>
                );
              })()}
          </div>
          {savedSessionId && (
            <p className="status-text">Saved to your history.</p>
          )}
          {saveError && <p className="error-text">{saveError}</p>}
          <Link className="primary-button" to="/practice">
            Start another interview
          </Link>
        </section>
      )}
    </>
  );
}
