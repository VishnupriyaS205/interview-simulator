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

async function fetchInterviewQuestionsOnce(params) {
  const key = params.toString();

  if (pendingQuestionRequests.has(key)) {
    return pendingQuestionRequests.get(key);
  }

  const request = fetch(`/api/interview/questions?${params}`).then(
    async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Interview questions API failed");
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

const aptitudeQuestions = [
  {
    question:
      "If 8 people complete 24 tasks in one day, how many tasks can 4 people complete at the same rate?",
    options: ["8", "12", "16", "20"],
    answer: "12",
    explanation:
      "4 people are half of 8 people, so they complete half of 24 tasks. Half of 24 is 12.",
  },
  {
    question: "Find the next number: 3, 6, 12, 24, ?",
    options: ["30", "36", "42", "48"],
    answer: "48",
    explanation: "Each number is doubled. 24 doubled is 48.",
  },
  {
    question:
      "A train travels 60 km in 1 hour. How far will it travel in 4 hours at the same speed?",
    options: ["120 km", "180 km", "240 km", "300 km"],
    answer: "240 km",
    explanation: "Distance equals speed multiplied by time. 60 x 4 = 240 km.",
  },
  {
    question: "Which word does not belong: Apple, Mango, Carrot, Banana?",
    options: ["Apple", "Mango", "Carrot", "Banana"],
    answer: "Carrot",
    explanation: "Apple, mango, and banana are fruits. Carrot is a vegetable.",
  },
  {
    question: "If A is taller than B, and B is taller than C, who is tallest?",
    options: ["A", "B", "C", "Cannot say"],
    answer: "A",
    explanation: "A is above B, and B is above C, so A is tallest.",
  },
  {
    question: "What is 25% of 200?",
    options: ["25", "40", "50", "75"],
    answer: "50",
    explanation: "25% means one-fourth. One-fourth of 200 is 50.",
  },
  {
    question: "Find the odd one out: Square, Circle, Triangle, Cube.",
    options: ["Square", "Circle", "Triangle", "Cube"],
    answer: "Cube",
    explanation: "Cube is a 3D shape. The others are 2D shapes.",
  },
  {
    question: "If today is Monday, what day will it be after 10 days?",
    options: ["Wednesday", "Thursday", "Friday", "Saturday"],
    answer: "Thursday",
    explanation:
      "10 days after Monday is Thursday because 7 days returns to Monday, then 3 more days is Thursday.",
  },
  {
    question:
      "A shop gives a 10% discount on Rs. 500. What is the discount amount?",
    options: ["Rs. 25", "Rs. 40", "Rs. 50", "Rs. 100"],
    answer: "Rs. 50",
    explanation: "10% of 500 is 50.",
  },
  {
    question: "Complete the analogy: Book is to reading as fork is to ____.",
    options: ["Writing", "Eating", "Drawing", "Running"],
    answer: "Eating",
    explanation: "A book is used for reading. A fork is used for eating.",
  },
  {
    question: "Which number is the largest?",
    options: ["0.7", "0.07", "0.77", "0.707"],
    answer: "0.77",
    explanation: "0.77 is greater than 0.707, 0.7, and 0.07.",
  },
  {
    question:
      "If 5 boxes hold 60 books, how many books can 1 box hold equally?",
    options: ["10", "12", "15", "20"],
    answer: "12",
    explanation: "60 divided by 5 is 12.",
  },
  {
    question: "Find the missing number: 2, 5, 8, 11, ?",
    options: ["12", "13", "14", "15"],
    answer: "14",
    explanation: "The pattern adds 3 each time. 11 + 3 = 14.",
  },
  {
    question:
      "If all roses are flowers and some flowers are red, which statement is definitely true?",
    options: [
      "All roses are red",
      "Some roses are red",
      "Roses are flowers",
      "No flowers are roses",
    ],
    answer: "Roses are flowers",
    explanation: "The first statement directly says all roses are flowers.",
  },
  {
    question:
      "A clock shows 3:00. What is the angle between the hour and minute hands?",
    options: ["45 degrees", "60 degrees", "90 degrees", "120 degrees"],
    answer: "90 degrees",
    explanation:
      "At 3:00, the minute hand is at 12 and the hour hand is at 3, making a right angle.",
  },
];

const englishQuestions = [
  {
    question: "Choose the correct sentence.",
    options: [
      "She go to office.",
      "She goes to office.",
      "She going office.",
      "She gone office.",
    ],
    answer: "She goes to office.",
    explanation:
      "For he, she, or it in simple present tense, we usually add s or es to the verb.",
  },
  {
    question: "Choose the best meaning of 'confident'.",
    options: ["Unsure", "Certain", "Silent", "Angry"],
    answer: "Certain",
    explanation: "Confident means feeling sure or certain about something.",
  },
  {
    question: "Fill in the blank: I am interested ____ web development.",
    options: ["on", "in", "at", "for"],
    answer: "in",
    explanation: "The correct phrase is 'interested in'.",
  },
  {
    question: "Which is the most professional greeting?",
    options: ["Hey boss", "Good morning", "What up", "Listen"],
    answer: "Good morning",
    explanation: "'Good morning' is polite and professional.",
  },
  {
    question: "Choose the correct spelling.",
    options: ["Comunication", "Communication", "Comminication", "Comnication"],
    answer: "Communication",
    explanation: "Communication is the correct spelling.",
  },
  {
    question: "What is the opposite of 'increase'?",
    options: ["Improve", "Decrease", "Create", "Include"],
    answer: "Decrease",
    explanation:
      "Decrease means to become less, which is the opposite of increase.",
  },
  {
    question: "Choose the best interview answer opening.",
    options: [
      "I do not know anything.",
      "My strength is clear problem solving.",
      "No idea.",
      "Ask someone else.",
    ],
    answer: "My strength is clear problem solving.",
    explanation: "This answer is positive, specific, and professional.",
  },
  {
    question: "Fill in the blank: We completed the task ____ time.",
    options: ["on", "in", "by", "at"],
    answer: "on",
    explanation: "'On time' means at the planned time.",
  },
  {
    question: "Choose the correct past tense: I ____ the bug yesterday.",
    options: ["fix", "fixed", "fixes", "fixing"],
    answer: "fixed",
    explanation: "Yesterday needs past tense, so 'fixed' is correct.",
  },
  {
    question: "Which phrase is best for asking clarification?",
    options: [
      "Repeat fast.",
      "I cannot understand you.",
      "Could you please explain that again?",
      "Say it properly.",
    ],
    answer: "Could you please explain that again?",
    explanation: "This is polite and clear.",
  },
  {
    question: "Choose the correct article: I built ____ app.",
    options: ["a", "an", "the", "no article"],
    answer: "an",
    explanation:
      "Use 'an' before a vowel sound. App starts with a vowel sound.",
  },
  {
    question: "What does 'deadline' mean?",
    options: [
      "Start date",
      "Final date to finish",
      "Meeting place",
      "Break time",
    ],
    answer: "Final date to finish",
    explanation:
      "A deadline is the final time or date by which work should be completed.",
  },
  {
    question: "Choose the sentence with clear communication.",
    options: [
      "Done thing.",
      "I finished the login form and tested it.",
      "Maybe okay.",
      "Code all set something.",
    ],
    answer: "I finished the login form and tested it.",
    explanation: "It clearly says what was finished and what was checked.",
  },
  {
    question: "Fill in the blank: Thank you ____ your feedback.",
    options: ["for", "from", "to", "with"],
    answer: "for",
    explanation: "The correct phrase is 'thank you for'.",
  },
  {
    question: "Which is the best closing line in an interview?",
    options: [
      "I am done, bye.",
      "Thank you for your time.",
      "No more questions.",
      "Okay leave.",
    ],
    answer: "Thank you for your time.",
    explanation: "This is polite and professional.",
  },
];

const technicalTemplates = [
  [
    "Which task is commonly handled with {skill} in a {role} role?",
    "Building and improving application features",
  ],
  [
    "What should be checked first when a {skill} feature gives the wrong result?",
    "The input values and current state",
  ],
  [
    "Which debugging step is most useful for a {skill} issue?",
    "Test one small part at a time",
  ],
  [
    "What makes a {difficulty} level {skill} answer stronger?",
    "Clear reasoning with a practical example",
  ],
  [
    "Before coding a {skill} solution, what should be clarified?",
    "The expected result and constraints",
  ],
  [
    "Which practice improves maintainability in {skill} work?",
    "Clear names and small focused functions",
  ],
  [
    "If a {skill} feature works in one case but fails in another, what should be added?",
    "Additional test cases",
  ],
  [
    "How should a {role} candidate explain a {skill} project?",
    "Goal, approach, tools used, and result",
  ],
  [
    "What is the best response to technical feedback on {skill} work?",
    "Ask clarifying questions and improve the solution",
  ],
  [
    "Which answer style should be avoided in a technical interview?",
    "Guessing without explaining the approach",
  ],
  [
    "How can a candidate handle being stuck on a {skill} question?",
    "Break the problem into smaller steps",
  ],
  [
    "What matters most when choosing a technical solution as a {role}?",
    "The user need and project requirement",
  ],
  [
    "Why is readable code important in {skill} work?",
    "It helps others understand and update the code",
  ],
  [
    "What should a complete technical answer include?",
    "Reasoning, result, and possible improvement",
  ],
  [
    "How should an unknown {skill} question be handled?",
    "State known points and ask a clarifying question",
  ],
];

function shuffleOptions(options, correctAnswer) {
  const shuffled = [...options];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  if (shuffled[0] === correctAnswer && shuffled.length > 1) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

function buildVideoQuestions(roleName, skill, difficulty) {
  return [
    {
      question: "Tell me about yourself.",
      technicalTerms: [
        skill.toLowerCase(),
        roleName.toLowerCase().split(" ")[0],
        "project",
      ],
    },
    {
      question: `Why are you interested in the ${roleName} role?`,
      technicalTerms: [roleName.toLowerCase().split(" ")[0], "role", "learn"],
    },
    {
      question: `Explain one ${skill} project or feature you built. Mention the problem, approach, and result.`,
      technicalTerms: [skill.toLowerCase(), "problem", "result"],
    },
    {
      question: `Describe how you would debug a ${difficulty.toLowerCase()} ${skill} issue during work.`,
      technicalTerms: [skill.toLowerCase(), "debug", "check"],
    },
    {
      question: `What makes you suitable for a ${roleName} role? Give one technical strength and one communication strength.`,
      technicalTerms: [
        roleName.toLowerCase().split(" ")[0],
        "technical",
        "communication",
      ],
    },
  ];
}

function buildTechnicalQuestions(roleName, skill, difficulty) {
  return technicalTemplates.map(([question, answer]) => {
    const finalQuestion = question
      .replace("{role}", roleName)
      .replace("{skill}", skill)
      .replace("{difficulty}", difficulty);
    const finalAnswer = answer
      .replace("{role}", roleName)
      .replace("{skill}", skill)
      .replace("{difficulty}", difficulty);

    return {
      question: finalQuestion,
      options: shuffleOptions(
        [
          finalAnswer,
          "Ignore the problem and move ahead",
          "Use random changes until it works",
          "Only memorize the definition",
        ],
        finalAnswer,
      ),
      answer: finalAnswer,
      explanation: `${finalAnswer} is correct because it shows practical technical judgment for the selected role and skill.`,
    };
  });
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

function buildPracticeRounds(roleName, skill, difficulty) {
  return [
    {
      id: "aptitude",
      title: "Aptitude + Logical Reasoning",
      questions: aptitudeQuestions,
    },
    {
      id: "english",
      title: "English Communication",
      questions: englishQuestions,
    },
    {
      id: "technical",
      title: "Technical Round",
      questions: buildTechnicalQuestions(roleName, skill, difficulty),
    },
    {
      id: "video",
      title: "AI Interview Analysis",
      type: "video",
      questions: buildVideoQuestions(roleName, skill, difficulty).map(
        (item) => ({
          ...item,
          type: "video",
          options: [],
          answer: "Structured interview answer",
          explanation:
            "A strong interview answer uses clear structure, enough detail, and role-specific technical words.",
        }),
      ),
    },
  ];
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

export default function PracticeSessionPage() {
  const { state } = useLocation();
  const user = JSON.parse(localStorage.getItem("interviewUser"));
  const rawSavedProgress = state?.fresh ? null : getSavedPracticeProgress();
  const savedProgress =
    rawSavedProgress?.userId === user?.id ? rawSavedProgress : null;
  const roleName =
    savedProgress?.setup?.roleName || state?.roleName || "Frontend Developer";
  const skill = savedProgress?.setup?.skill || state?.skill || "React";
  const difficulty =
    savedProgress?.setup?.difficulty || state?.difficulty || "Easy";

  const fallbackRounds = useMemo(
    () => buildPracticeRounds(roleName, skill, difficulty),
    [difficulty, roleName, skill],
  );

  const [rounds, setRounds] = useState(() =>
    savedProgress?.rounds
      ? normalizeSavedRounds(savedProgress.rounds)
      : buildPracticeRounds(roleName, skill, difficulty),
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
  const [activeReportSection, setActiveReportSection] = useState("aptitude");
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const fetchInterviewQuestions = async () => {
      if (savedProgress) {
        setIsLoadingQuestions(false);
        return;
      }

      const params = new URLSearchParams({
        roleName,
        skill,
        difficulty,
      });

      try {
        const data = await fetchInterviewQuestionsOnce(params);
        const aiRounds = data.rounds || [];
        const fallbackAnalysisRound = fallbackRounds.find(
          (round) => round.id === "video",
        );
        const orderedRounds = ["aptitude", "english", "technical", "video"]
          .map((roundId) => aiRounds.find((round) => round.id === roundId))
          .filter(Boolean);
        const hasAiRounds =
          orderedRounds.length === 4 &&
          orderedRounds.every((round) =>
            round.id === "video"
              ? round.questions.length === 5
              : round.questions.length === 15,
          );
        const nonVideoRounds = orderedRounds.filter(
          (round) => round.id !== "video",
        );
        const mixedRounds =
          nonVideoRounds.length === 3 && fallbackAnalysisRound
            ? [...nonVideoRounds, fallbackAnalysisRound]
            : fallbackRounds;

        setRounds(
          hasAiRounds
            ? [
                orderedRounds[0],
                orderedRounds[1],
                orderedRounds[2],
                {
                  ...orderedRounds[3],
                  type: "video",
                  questions: orderedRounds[3].questions.map((question) => ({
                    ...question,
                    type: "video",
                    options: [],
                    answer: "Structured interview answer",
                    explanation:
                      question.explanation ||
                      "A strong interview answer uses clear structure, enough detail, and role-specific technical words.",
                  })),
                },
              ]
            : mixedRounds,
        );
      } catch (err) {
        console.error("Interview Questions Fetch Error:", err);
        setRoundError(
          "Could not load AI questions. Check Gemini setup and restart the backend.",
        );
      } finally {
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
    };

    fetchInterviewQuestions();
  }, [difficulty, fallbackRounds, roleName, savedProgress, skill]);

  const activeRound = rounds[roundIndex];
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
  ];

  useEffect(() => {
    if (view === "final") {
      localStorage.setItem(
        PRACTICE_PROGRESS_KEY,
        JSON.stringify({
          setup: {
            roleName,
            skill,
            difficulty,
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
              : activeRound.title
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
            Generating fresh AI aptitude questions...
          </p>
        </section>
      )}

      {!isLoadingQuestions && view === "questions" && (
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
