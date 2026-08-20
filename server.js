// server.js
import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// PostgreSQL Connection Pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const SALT_ROUNDS = 10;
const GEMINI_MAX_RETRIES = 3;
const GEMINI_BASE_DELAY_MS = 800;
const pendingGeminiRequests = new Map();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const questionSystemPrompt = `You are an interview practice question generator for a placement preparation app.

Generate interview questions strictly based on:
- role
- selected skill
- difficulty
- round type

Rules:
- Create questions only for the requested role and selected skill.
- Match the requested difficulty exactly: Beginner, Intermediate, or Advanced.
- Match the requested round type exactly, such as Technical, Aptitude, Logical Reasoning, or HR.
- Use simple and clear English suitable for students.
- Questions must test understanding, not just memorization.
- Do not repeat questions or create slightly reworded duplicates.
- Keep questions relevant to real placement interviews.
- For technical questions, focus on practical concepts and problem-solving.
- For aptitude and logical reasoning questions, ensure the question has one logically correct answer.
- For HR questions, keep them professional and relevant to the candidate's role.
- For MCQs, provide exactly 4 options.
- Only one option must be correct.
- Do not reveal the correct answer inside the question or options.
- Add a short, simple explanation of why the correct answer is correct.`;

const analysisSystemPrompt = `You are an interview coach for students preparing for placement interviews.

Analyze the candidate's answer based on the question asked.

Evaluate:
- clarity
- confidence
- communication
- technical correctness
- logical reasoning
- relevance to the question
- answer structure
- filler words
- improvement areas

FILLER WORDS:
Identify the exact filler words or phrases actually used in the candidate's answer.
Examples include: "um", "uh", "actually", "like", "you know", "basically", "so", "I mean", "hmm".
Do NOT add filler words that were not present in the candidate's answer.
Return the exact words/phrases as they appeared.
If there are no filler words, return an empty array.

COMMUNICATION FEEDBACK:
Explain how clearly and confidently the candidate communicated.
Mention sentence clarity, fluency, repetition, unnecessary pauses, and filler-word usage.

TECHNICAL/LOGICAL FEEDBACK:
Evaluate whether the answer is technically correct, logically organized, relevant to the question, and complete.
Mention missing concepts or incorrect information when applicable.

Be supportive and practical.
Use simple English.
Do not be harsh.
Do not assume information that is not present in the answer.`;

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(err) {
  const status = err?.status || err?.code || err?.response?.status;
  const message = String(err?.message || "").toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("rate limit") ||
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("fetch failed")
  );
}

async function generateGeminiContentWithRetry(key, request) {
  if (pendingGeminiRequests.has(key)) {
    return pendingGeminiRequests.get(key);
  }

  const pendingRequest = (async () => {
    let lastError;

    for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
      try {
        return await ai.models.generateContent(request);
      } catch (err) {
        lastError = err;

        if (!isRetryableGeminiError(err) || attempt === GEMINI_MAX_RETRIES) {
          throw err;
        }

        const delay =
          GEMINI_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250);
        console.warn(
          `Temporary Gemini error. Retrying in ${delay}ms (${attempt + 1}/${GEMINI_MAX_RETRIES}).`,
        );
        await sleep(delay);
      }
    }

    throw lastError;
  })();

  pendingGeminiRequests.set(key, pendingRequest);

  try {
    return await pendingRequest;
  } finally {
    pendingGeminiRequests.delete(key);
  }
}

function parseAiJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function normalizeAiQuestion(item, roundKey, index) {
  const options = Array.isArray(item.options) ? item.options.slice(0, 4) : [];

  return {
    id: `ai-${roundKey}-${Date.now()}-${index}`,
    question: String(item.question || "").trim(),
    options,
    answer: String(item.answer || "").trim(),
    explanation: String(item.explanation || "").trim(),
  };
}

function getRoundTitle(roundKey) {
  if (roundKey === "aptitude") {
    return "Aptitude + Logical Reasoning";
  }

  if (roundKey === "english") {
    return "English Communication";
  }

  if (roundKey === "video") {
    return "AI Interview Analysis";
  }

  return "Technical Round";
}

function createSessionName(roleName, skill, difficulty, percentage) {
  const levelText = difficulty || "Practice";
  const scoreText = Number.isFinite(percentage) ? `${percentage}%` : "Practice";
  return `${roleName} ${skill} Interview - ${levelText} - ${scoreText}`;
}

function replaceTokens(text, roleName, skill, difficulty) {
  return text
    .replaceAll("{role}", roleName)
    .replaceAll("{skill}", skill)
    .replaceAll("{difficulty}", difficulty);
}

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

function mapQuestionRow(
  row,
  roleName,
  skill,
  difficulty,
  shouldShuffle = false,
) {
  const answer = replaceTokens(row.correct_answer, roleName, skill, difficulty);
  const options = row.options.map((option) =>
    replaceTokens(option, roleName, skill, difficulty),
  );

  return {
    id: row.id,
    question: replaceTokens(row.question_text, roleName, skill, difficulty),
    options: shouldShuffle ? shuffleOptions(options, answer) : options,
    answer,
    explanation: replaceTokens(row.explanation, roleName, skill, difficulty),
  };
}

async function ensureInterviewData() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS practice_name");
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS career_goal VARCHAR(150)",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS level VARCHAR(50) DEFAULT 'Beginner'",
  );
  await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS weekly_target");
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_role VARCHAR(100)",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_skill VARCHAR(100)",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_difficulty VARCHAR(50) DEFAULT 'Easy'",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fields (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rounds (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      field_id INTEGER REFERENCES fields(id),
      round_id INTEGER REFERENCES rounds(id),
      question_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS practice_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      field_id INTEGER REFERENCES fields(id),
      round_id INTEGER REFERENCES rounds(id),
      status VARCHAR(50) DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS answers (
      id SERIAL PRIMARY KEY,
      practice_session_id INTEGER REFERENCES practice_sessions(id),
      question_id INTEGER REFERENCES questions(id),
      user_answer TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analysis_reports (
      id SERIAL PRIMARY KEY,
      practice_session_id INTEGER UNIQUE REFERENCES practice_sessions(id),
      communication_score INTEGER,
      filler_word_count INTEGER,
      technical_score INTEGER,
      final_score INTEGER,
      feedback TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS round_key VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS role_name VARCHAR(100)",
  );
  await pool.query(
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS skill_name VARCHAR(100)",
  );
  await pool.query(
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS options JSONB",
  );
  await pool.query(
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_answer TEXT",
  );
  await pool.query(
    "ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT",
  );
  await pool.query(
    "ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS role_name VARCHAR(100)",
  );
  await pool.query(
    "ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS skill_name VARCHAR(100)",
  );
  await pool.query(
    "ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS total_score INTEGER DEFAULT 0",
  );
  await pool.query(
    "ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0",
  );
  await pool.query(
    "ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS session_name VARCHAR(180)",
  );
  await pool.query(
    "ALTER TABLE answers ADD COLUMN IF NOT EXISTS round_key VARCHAR(50)",
  );
  await pool.query(
    "ALTER TABLE answers ADD COLUMN IF NOT EXISTS question_text TEXT",
  );
  await pool.query(
    "ALTER TABLE answers ADD COLUMN IF NOT EXISTS correct_answer TEXT",
  );
  await pool.query(
    "ALTER TABLE answers ADD COLUMN IF NOT EXISTS explanation TEXT",
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toPublicUser(row) {
  return {
    id: row.id,
    fullName: row.name,
    email: row.email,
    careerGoal: row.career_goal || "",
    level: row.level || "Beginner",
    profilePicture: row.profile_picture || "",
    preferredRole: row.preferred_role || "",
    preferredSkill: row.preferred_skill || "",
    preferredDifficulty: row.preferred_difficulty || "Easy",
  };
}

function getCookieValue(req, name) {
  const cookies = req.headers.cookie || "";

  return cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function getAuthTokenFromRequest(req) {
  return getCookieValue(req, "authToken") || "";
}

function setAuthCookie(res, token) {
  const secureCookie = process.env.NODE_ENV === "production" ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `authToken=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secureCookie}`,
  );
}

function clearAuthCookie(res) {
  const secureCookie = process.env.NODE_ENV === "production" ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `authToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie}`,
  );
}

async function createAuthToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");

  await pool.query(
    "INSERT INTO auth_sessions (user_id, token) VALUES ($1, $2)",
    [userId, token],
  );

  return token;
}

async function requireAuth(req, res, next) {
  const token = getAuthTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.career_goal,
        u.level, u.profile_picture,
        u.preferred_role, u.preferred_skill, u.preferred_difficulty
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1`,
      [token],
    );

    if (!rows[0]) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.authToken = token;
    req.user = toPublicUser(rows[0]);
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Auth check failed" });
  }
}

function requireSameUser(req, res, next) {
  if (Number(req.params.userId) !== Number(req.user.id)) {
    return res
      .status(403)
      .json({ error: "You cannot access another user's data" });
  }

  next();
}

// POST /api/signup
app.post("/api/signup", async (req, res) => {
  const { fullName, email, password } = req.body;
  const trimmedFullName = fullName?.trim();
  const normalizedEmail = email?.trim().toLowerCase();

  if (!trimmedFullName || !normalizedEmail || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res
      .status(400)
      .json({ error: "Enter a valid email address", field: "email" });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Password must be at least 6 characters",
      field: "password",
    });
  }

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1",
      [normalizedEmail],
    );

    if (existingUser.rows[0]) {
      return res
        .status(409)
        .json({ error: "Email already exists", field: "email" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, career_goal, level,
        profile_picture, preferred_role, preferred_skill, preferred_difficulty`,
      [trimmedFullName, normalizedEmail, passwordHash],
    );

    const user = toPublicUser(rows[0]);
    const token = await createAuthToken(user.id);

    setAuthCookie(res, token);
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Email already exists", field: "email" });
    }

    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// POST /api/signin
app.post("/api/signin", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email and password are required", field: "email" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, career_goal,
        level, profile_picture,
        preferred_role, preferred_skill, preferred_difficulty
       FROM users
       WHERE LOWER(email) = $1`,
      [email.toLowerCase().trim()],
    );

    const user = rows[0];

    if (!user) {
      return res
        .status(401)
        .json({ error: "Email was not found.", field: "email" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res
        .status(401)
        .json({ error: "Password is incorrect.", field: "password" });
    }

    const publicUser = toPublicUser(user);
    const token = await createAuthToken(publicUser.id);

    setAuthCookie(res, token);
    res.json({ user: publicUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signin failed" });
  }
});

// POST /api/signout
app.post("/api/signout", async (req, res) => {
  const token = getAuthTokenFromRequest(req);

  try {
    if (token) {
      await pool.query("DELETE FROM auth_sessions WHERE token = $1", [token]);
    }

    clearAuthCookie(res);
    res.json({ message: "Signed out" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signout failed" });
  }
});

// GET /api/me
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// GET /api/fields
app.get("/api/fields", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM fields ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// GET /api/rounds
app.get("/api/rounds", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM rounds ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// GET /api/questions?fieldId=1&roundId=5
app.get("/api/questions", async (req, res) => {
  const { fieldId, roundId } = req.query;

  if (!fieldId || !roundId) {
    return res.status(400).json({ error: "fieldId and roundId are required" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM questions WHERE field_id = $1 AND round_id = $2 ORDER BY id ASC",
      [fieldId, roundId],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database query failed" });
  }
});

async function buildDatabaseInterviewRounds(roleName, skill, difficulty) {
  const difficultyOffsets = {
    Easy: 0,
    Medium: 5,
    Hard: 10,
  };
  const technicalOffset = difficultyOffsets[difficulty] || 0;
  const aptitudeResult = await pool.query(
    `SELECT id, round_key, question_text, options, correct_answer, explanation
     FROM questions
     WHERE round_key = 'aptitude'
     ORDER BY RANDOM()
     LIMIT 15`,
  );
  const englishResult = await pool.query(
    `SELECT id, round_key, question_text, options, correct_answer, explanation
     FROM questions
     WHERE round_key = 'english'
     ORDER BY RANDOM()
     LIMIT 15`,
  );
  const technicalResult = await pool.query(
    `SELECT id, round_key, question_text, options, correct_answer, explanation
     FROM questions
     WHERE round_key = 'technical'
     ORDER BY id ASC
     OFFSET $1
     LIMIT 15`,
    [technicalOffset],
  );

  return [
    {
      id: "aptitude",
      title: getRoundTitle("aptitude"),
      questions: aptitudeResult.rows.map((row) =>
        mapQuestionRow(row, roleName, skill, difficulty, true),
      ),
    },
    {
      id: "english",
      title: getRoundTitle("english"),
      questions: englishResult.rows.map((row) =>
        mapQuestionRow(row, roleName, skill, difficulty),
      ),
    },
    {
      id: "technical",
      title: getRoundTitle("technical"),
      questions: technicalResult.rows.map((row) =>
        mapQuestionRow(row, roleName, skill, difficulty, true),
      ),
    },
  ];
}

async function generateGeminiRound(roundKey, roleName, skill, difficulty) {
  const roundInstruction =
    roundKey === "aptitude"
      ? `Create only aptitude and logical reasoning questions.
Do not mention ${roleName}, ${skill}, programming, coding, React, JavaScript, APIs, databases, frontend, backend, or technical interview topics.
Use topics like percentages, ratios, number series, directions, clocks, calendars, simple probability, odd-one-out, and logical statements.`
      : roundKey === "english"
        ? `Create only English communication questions.
Focus on grammar, sentence correction, vocabulary, professional phrases, interview communication, and clarity.
Do not create coding or technical knowledge questions.`
        : roundKey === "video"
          ? `Create only open-ended interview speaking questions for AI Interview Analysis.
Questions should help a candidate explain experience, motivation, debugging, project work, communication, and role fit.
Do not create multiple-choice questions.`
          : `Create only technical interview questions based on this role and skill.
Role: ${roleName}
Skill: ${skill}`;

  const prompt = `
Generate exactly ${roundKey === "video" ? 5 : 15} ${
    roundKey === "video" ? "open-ended" : "multiple-choice"
  } interview practice questions.

Difficulty: ${difficulty}
Round Type: ${roundKey}

Round instruction:
${roundInstruction}

Rules:
- ${
    roundKey === "video"
      ? "Each question must include exactly 3 technicalTerms."
      : "Each question must have exactly 4 options."
  }
- ${
    roundKey === "video"
      ? "technicalTerms must be useful keywords that can appear in a strong answer."
      : "Exactly one option must be correct."
  }
- Keep the language simple for students.
- ${
    roundKey === "video"
      ? "Use questions that require a spoken or written interview answer."
      : "The answer must exactly match one of the options."
  }
- Do not mix this round with another round type.
- Return only JSON.

JSON shape:
{
  "questions": [
    {
      "question": "Question text",
      ${
        roundKey === "video"
          ? '"technicalTerms": ["term one", "term two", "term three"]'
          : '"options": ["Option 1", "Option 2", "Option 3", "Option 4"],\n      "answer": "Correct option",\n      "explanation": "Short explanation"'
      }
    }
  ]
}
`;

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await generateGeminiContentWithRetry(
        `questions:${roundKey}:${roleName}:${skill}:${difficulty}:${attempt}`,
        {
          model: GEMINI_MODEL,
          config: {
            systemInstruction: questionSystemPrompt,
            responseMimeType: "application/json",
          },
          contents:
            attempt === 1
              ? prompt
              : `${prompt}

Previous output was invalid. Return strict valid JSON only. Every string value must be inside double quotes. ${
                  roundKey === "video"
                    ? "technicalTerms must be an array of 3 strings."
                    : "Options must be an array of 4 strings."
                }`,
        },
      );
      const data = parseAiJson(response.text);

      if (!Array.isArray(data?.questions)) {
        throw new Error(`Gemini did not return questions for ${roundKey}`);
      }

      const questions =
        roundKey === "video"
          ? data.questions
              .map((item, index) => ({
                id: `ai-video-${Date.now()}-${index}`,
                question: String(item.question || "").trim(),
                technicalTerms: Array.isArray(item.technicalTerms)
                  ? item.technicalTerms
                      .map((term) =>
                        String(term || "")
                          .toLowerCase()
                          .trim(),
                      )
                      .filter(Boolean)
                      .slice(0, 3)
                  : [],
                type: "video",
                options: [],
                answer: "Structured interview answer",
                explanation:
                  "A strong interview answer uses clear structure, enough detail, and role-specific technical words.",
              }))
              .filter(
                (item) => item.question && item.technicalTerms.length === 3,
              )
              .slice(0, 5)
          : data.questions
              .map((item, index) => normalizeAiQuestion(item, roundKey, index))
              .filter(
                (item) =>
                  item.question &&
                  item.options.length === 4 &&
                  item.answer &&
                  item.options.includes(item.answer),
              )
              .slice(0, 15);

      const expectedQuestionCount = roundKey === "video" ? 5 : 15;

      if (questions.length !== expectedQuestionCount) {
        throw new Error(
          `Gemini returned ${questions.length} valid ${roundKey} questions`,
        );
      }

      return {
        id: roundKey,
        title: getRoundTitle(roundKey),
        type: roundKey === "video" ? "video" : undefined,
        questions,
      };
    } catch (err) {
      lastError = err;
      console.warn(
        `Gemini ${roundKey} generation attempt ${attempt} failed: ${err.message}`,
      );
    }
  }

  throw lastError;
}

app.get("/api/interview/questions", async (req, res) => {
  const {
    roleName = "Frontend Developer",
    skill = "React",
    difficulty = "Easy",
    fallback = "false",
    focusRound = "",
  } = req.query;
  const allowedDifficulties = ["Easy", "Medium", "Hard"];
  const allowedRounds = ["aptitude", "english", "technical", "video"];
  const allowDatabaseFallback = fallback === "true";
  const roundKeys = focusRound ? [focusRound] : allowedRounds;

  if (!allowedDifficulties.includes(difficulty)) {
    return res.status(400).json({ error: "Invalid difficulty" });
  }

  if (focusRound && !allowedRounds.includes(focusRound)) {
    return res.status(400).json({ error: "Invalid focus round" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const orderedRounds = await Promise.all(
      roundKeys.map((roundKey) =>
        generateGeminiRound(roundKey, roleName, skill, difficulty),
      ),
    );

    res.json({ rounds: orderedRounds, source: "gemini" });
  } catch (err) {
    console.error("question generation failed:", err);

    if (!allowDatabaseFallback) {
      return res.status(502).json({
        error: "Gemini question generation failed",
        details: err.message,
      });
    }

    try {
      const rounds = await buildDatabaseInterviewRounds(
        roleName,
        skill,
        difficulty,
      );
      res.json({ rounds, source: "database-fallback" });
    } catch (fallbackErr) {
      console.error("Database fallback failed:", fallbackErr);
      res.status(500).json({ error: "Could not load interview questions" });
    }
  }
});
app.post("/api/interview/analysis", requireAuth, async (req, res) => {
  const { question, answer, answers, roleName = "", skill = "" } = req.body;
  const analysisItems = Array.isArray(answers)
    ? answers
    : question && answer
      ? [{ question, answer }]
      : [];

  if (!analysisItems.length) {
    return res.status(400).json({
      error: "At least one question and answer are required",
    });
  }

  const prompt = `
Analyze this candidate's interview answer${analysisItems.length > 1 ? "s" : ""}.

Role: ${roleName}
Skill: ${skill}

Answers:
${analysisItems
  .map(
    (item, index) => `
${index + 1}.
Question:
${item.question}

Candidate Answer:
${item.answer}
`,
  )
  .join("\n")}

Evaluate:
- clarity
- confidence
- communication
- technical relevance
- structure
- filler words
- improvement areas

Return ONLY valid JSON:

{
  "analyses": [
    {
      "score": 0,
      "communicationScore": 0,
      "technicalScore": 0,
      "fillerCount": 0,
      "clarity": "",
      "confidence": "",
      "technicalRelevance": "",
      "structure": "",
      "recommendation": "",
      "feedback": "",
      "fillerWords": [],
      "improvementAreas": []
    }
  ]
}

Scores must be integers between 0 and 100.
score must be 1 if the answer is acceptable for an interview, otherwise 0.
Return exactly ${analysisItems.length} analysis item${analysisItems.length === 1 ? "" : "s"} in the same order.
`;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const response = await generateGeminiContentWithRetry(
      `analysis:${req.user.id}:${JSON.stringify(analysisItems)}:${roleName}:${skill}`,
      {
        model: GEMINI_MODEL,
        config: {
          systemInstruction: analysisSystemPrompt,
          responseMimeType: "application/json",
        },
        contents: prompt,
      },
    );

    let analysis;

    try {
      analysis = parseAiJson(response.text);
    } catch (parseError) {
      console.error("Analysis JSON parse error:", parseError);

      return res.status(500).json({
        error: "Gemini returned invalid analysis JSON",
      });
    }

    const rawAnalyses = Array.isArray(analysis?.analyses)
      ? analysis.analyses
      : analysis
        ? [analysis]
        : [];

    if (!rawAnalyses.length) {
      return res.status(500).json({
        error: "Gemini returned empty analysis",
      });
    }

    const normalizedAnalyses = analysisItems.map((_, index) => {
      const item = rawAnalyses[index] || {};

      return {
        score: Number(item.score) === 1 ? 1 : 0,
        communicationScore: Number(item.communicationScore) || 0,
        technicalScore: Number(item.technicalScore) || 0,
        fillerCount: Number(item.fillerCount) || 0,
        clarity: item.clarity || "",
        confidence: item.confidence || "",
        technicalRelevance: item.technicalRelevance || "",
        structure: item.structure || "",
        recommendation:
          item.recommendation ||
          item.feedback ||
          "Add a clear example, explain your action, and finish with the result.",
        feedback: item.feedback || "Review your answer and add more detail.",
        fillerWords: Array.isArray(item.fillerWords) ? item.fillerWords : [],
        improvementAreas: Array.isArray(item.improvementAreas)
          ? item.improvementAreas
          : [],
      };
    });

    res.json({
      analysis: normalizedAnalyses[0],
      analyses: normalizedAnalyses,
    });
  } catch (err) {
    console.error("Gemini analysis failed:", err);

    res.status(500).json({
      error: "Could not analyze interview answer",
      details: err.message,
    });
  }
});
// POST /api/interview/sessions
app.post("/api/interview/sessions", requireAuth, async (req, res) => {
  const { userId, roleName, skill, difficulty, results } = req.body;

  if (!userId || !Array.isArray(results)) {
    return res.status(400).json({ error: "userId and results are required" });
  }

  if (Number(userId) !== Number(req.user.id)) {
    return res
      .status(403)
      .json({ error: "You cannot save another user's data" });
  }

  const incompleteRound = results.find((round) => {
    if (!round?.questions?.length || !round?.answers) {
      return true;
    }

    return round.questions.some((question, index) => {
      const answer = round.answers[String(index)];
      return question.type === "video"
        ? !answer?.text?.trim()
        : !String(answer || "").trim();
    });
  });

  if (incompleteRound) {
    return res
      .status(400)
      .json({ error: "Answer every question before saving the session" });
  }

  const totalScore = results.reduce((sum, round) => sum + round.score, 0);
  const totalQuestions = results.reduce((sum, round) => sum + round.total, 0);
  const percentage = totalQuestions
    ? Math.round((totalScore / totalQuestions) * 100)
    : 0;
  const feedback =
    percentage >= 80
      ? "Strong performance. Keep practicing at a higher difficulty."
      : percentage >= 60
        ? "Good progress. Review the lowest scoring round and try again."
        : "Needs focused practice. Review explanations and repeat one round at a time.";
  const sessionName = createSessionName(
    roleName,
    skill,
    difficulty,
    percentage,
  );
  const videoAnswers = results
    .filter((round) => round.id === "video")
    .flatMap((round) => Object.values(round.answers || {}))
    .filter((answer) => typeof answer === "object");
  const communicationScore = videoAnswers.length
    ? Math.round(
        videoAnswers.reduce(
          (sum, answer) => sum + (answer.communicationScore || 0),
          0,
        ) / videoAnswers.length,
      )
    : percentage;
  const technicalScore = videoAnswers.length
    ? Math.round(
        videoAnswers.reduce(
          (sum, answer) => sum + (answer.technicalScore || 0),
          0,
        ) / videoAnswers.length,
      )
    : percentage;
  const fillerWordCount = videoAnswers.reduce(
    (sum, answer) => sum + (answer.fillerCount || 0),
    0,
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sessionResult = await client.query(
      `INSERT INTO practice_sessions
        (user_id, role_name, skill_name, difficulty, total_score, total_questions, status, session_name)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7)
       RETURNING id, created_at`,
      [
        userId,
        roleName,
        skill,
        difficulty,
        totalScore,
        totalQuestions,
        sessionName,
      ],
    );

    const session = sessionResult.rows[0];

    await client.query(
      `UPDATE users
       SET preferred_role = $1, preferred_skill = $2, preferred_difficulty = $3
       WHERE id = $4`,
      [roleName, skill, difficulty, userId],
    );

    for (const round of results) {
      for (let index = 0; index < round.questions.length; index += 1) {
        const question = round.questions[index];
        const questionId = Number.isInteger(Number(question.id))
          ? Number(question.id)
          : null;
        const savedAnswer = round.answers[String(index)];
        const userAnswer =
          typeof savedAnswer === "object"
            ? `${savedAnswer.text || "Not answered"} | Recommendation: ${
                savedAnswer.recommendation || savedAnswer.feedback || ""
              } | Filler words: ${
                Array.isArray(savedAnswer.fillerWords) &&
                savedAnswer.fillerWords.length
                  ? savedAnswer.fillerWords.join(", ")
                  : "None"
              }${
                savedAnswer.looksAiGenerated
                  ? " | AI-like response detected"
                  : ""
              }`
            : savedAnswer || "Not answered";

        await client.query(
          `INSERT INTO answers
            (practice_session_id, question_id, user_answer, round_key, question_text, correct_answer, explanation)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            session.id,
            questionId,
            userAnswer,
            round.id,
            question.question,
            question.answer,
            question.explanation,
          ],
        );
      }
    }

    await client.query(
      `INSERT INTO analysis_reports
        (practice_session_id, communication_score, filler_word_count, technical_score, final_score, feedback)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        session.id,
        communicationScore,
        fillerWordCount,
        technicalScore,
        percentage,
        feedback,
      ],
    );

    await client.query("COMMIT");
    res.status(201).json({
      session: {
        id: session.id,
        name: sessionName,
        createdAt: session.created_at,
        totalScore,
        totalQuestions,
        percentage,
        feedback,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not save interview session" });
  } finally {
    client.release();
  }
});

// GET /api/users/:userId/dashboard
app.get(
  "/api/users/:userId/dashboard",
  requireAuth,
  requireSameUser,
  async (req, res) => {
    const { userId } = req.params;

    try {
      const { rows } = await pool.query(
        `SELECT
        COUNT(ps.id)::int AS sessions,
        COALESCE(ROUND(AVG((ps.total_score::numeric / NULLIF(ps.total_questions, 0)) * 100)), 0)::int AS average_score
       FROM practice_sessions ps
       WHERE ps.user_id = $1`,
        [userId],
      );

      const recent = await pool.query(
        `SELECT *
       FROM (
        SELECT id, session_name, role_name, skill_name, difficulty,
          total_score, total_questions, created_at,
          ROW_NUMBER() OVER (ORDER BY created_at ASC)::int AS attempt_number
        FROM practice_sessions
        WHERE user_id = $1
       ) ranked
       ORDER BY created_at DESC
       LIMIT 1`,
        [userId],
      );

      res.json({
        summary: rows[0],
        latestSession: recent.rows[0] || null,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Dashboard query failed" });
    }
  },
);

// GET /api/users/:userId/progress
app.get(
  "/api/users/:userId/progress",
  requireAuth,
  requireSameUser,
  async (req, res) => {
    const { userId } = req.params;
    const roundLabels = {
      aptitude: "Aptitude + Logical Reasoning",
      english: "English Communication",
      technical: "Technical Round",
      video: "AI Interview Analysis",
    };

    try {
      const sessions = await pool.query(
        `SELECT ps.id, ps.session_name, ps.role_name, ps.skill_name, ps.difficulty,
          ps.total_score, ps.total_questions, ps.created_at,
          ar.technical_score, ar.communication_score, ar.filler_word_count, ar.feedback
         FROM practice_sessions ps
         LEFT JOIN analysis_reports ar ON ar.practice_session_id = ps.id
         WHERE ps.user_id = $1 AND ps.status = 'completed'
         ORDER BY ps.created_at DESC`,
        [userId],
      );

      if (!sessions.rows.length) {
        return res.json({
          summary: {
            sessions: 0,
            averageScore: 0,
            bestScore: 0,
            latestScore: 0,
            previousScore: 0,
            trend: 0,
          },
          sessions: [],
          roundStats: [],
          suggestions: [
            "Complete one practice session first, then this page will show weak areas.",
          ],
        });
      }

      const sessionIds = sessions.rows.map((session) => session.id);
      const answers = await pool.query(
        `SELECT practice_session_id, round_key, user_answer, correct_answer
         FROM answers
         WHERE practice_session_id = ANY($1::int[])`,
        [sessionIds],
      );

      const sessionScores = sessions.rows.map((session) => ({
        ...session,
        percentage: session.total_questions
          ? Math.round((session.total_score / session.total_questions) * 100)
          : 0,
      }));
      const totalPercent = sessionScores.reduce(
        (sum, session) => sum + session.percentage,
        0,
      );
      const bestScore = Math.max(
        ...sessionScores.map((session) => session.percentage),
      );
      const latest = sessionScores[0];
      const previous = sessionScores[1] || null;
      const first = sessionScores[sessionScores.length - 1];
      const roundMap = answers.rows.reduce((map, answer) => {
        const roundKey = answer.round_key || "other";
        const current = map[roundKey] || {
          roundKey,
          label: roundLabels[roundKey] || roundKey,
          attempted: 0,
          correct: 0,
        };
        const isAnalysisRound = roundKey === "video";
        current.attempted += 1;
        current.correct +=
          !isAnalysisRound && answer.user_answer === answer.correct_answer
            ? 1
            : 0;
        map[roundKey] = current;
        return map;
      }, {});
      const roundStats = Object.values(roundMap)
        .filter((round) => round.roundKey !== "video")
        .map((round) => ({
          ...round,
          accuracy: round.attempted
            ? Math.round((round.correct / round.attempted) * 100)
            : 0,
        }))
        .sort((a, b) => a.accuracy - b.accuracy);
      const videoAttempted = roundMap.video?.attempted || 0;

      if (videoAttempted) {
        const videoScores = sessionScores
          .filter(
            (session) =>
              session.communication_score !== null &&
              session.technical_score !== null,
          )
          .map((session) =>
            Math.round(
              (((session.communication_score || 0) +
                (session.technical_score || 0)) /
                4) *
                100,
            ),
          );
        const videoAccuracy = videoScores.length
          ? Math.round(
              videoScores.reduce((sum, score) => sum + score, 0) /
                videoScores.length,
            )
          : 0;

        roundStats.push({
          roundKey: "video",
          label: roundLabels.video,
          attempted: videoAttempted,
          correct: 0,
          accuracy: videoAccuracy,
          scoreLabel: `${videoAccuracy}% AI score from ${videoAttempted} answers`,
        });
        roundStats.sort((a, b) => a.accuracy - b.accuracy);
      }
      const weakestRound = roundStats[0];
      const suggestions = [];
      const nextDifficulty =
        latest.percentage >= 80 && latest.difficulty === "Easy"
          ? "Medium"
          : latest.percentage >= 80 && latest.difficulty === "Medium"
            ? "Hard"
            : latest.difficulty;

      if (weakestRound) {
        suggestions.push(
          `Next practice: focus on ${weakestRound.label}. Your accuracy there is ${weakestRound.accuracy}%.`,
        );
      }

      if ((latest.technical_score || 0) < 2) {
        suggestions.push(
          `Add more ${latest.skill_name} keywords and project examples in AI Interview Analysis.`,
        );
      }

      if ((latest.filler_word_count || 0) > 3) {
        suggestions.push(
          "Slow down your answers and remove filler words like um, uh, like, and basically.",
        );
      }

      if (previous && latest.percentage < previous.percentage) {
        suggestions.push(
          "Your latest score dropped. Review the latest wrong answers before starting a harder session.",
        );
      } else if (previous && latest.percentage > previous.percentage) {
        suggestions.push(
          `You improved by ${latest.percentage - previous.percentage}%. Keep the same skill and try ${nextDifficulty} level next.`,
        );
      }

      if (!suggestions.length) {
        suggestions.push(
          `Good progress. Practice ${latest.skill_name} at ${nextDifficulty} level next.`,
        );
      }

      res.json({
        summary: {
          sessions: sessionScores.length,
          averageScore: Math.round(totalPercent / sessionScores.length),
          bestScore,
          latestScore: latest.percentage,
          previousScore: previous?.percentage || 0,
          trend: previous ? latest.percentage - previous.percentage : 0,
          firstScore: first.percentage,
          overallChange: latest.percentage - first.percentage,
        },
        nextPractice: {
          roleName: latest.role_name,
          skillName: latest.skill_name,
          difficulty: nextDifficulty,
          focusRound: weakestRound?.roundKey || "",
          focus: weakestRound?.label || "Mixed practice",
          reason: weakestRound
            ? `This is your weakest area at ${weakestRound.accuracy}% accuracy.`
            : "Your previous practice is balanced, so continue building consistency.",
        },
        sessions: sessionScores.slice(0, 12).map((session) => ({
          id: session.id,
          name:
            session.session_name ||
            `${session.role_name} ${session.skill_name} Practice`,
          roleName: session.role_name,
          skillName: session.skill_name,
          difficulty: session.difficulty,
          percentage: session.percentage,
          technicalScore: session.technical_score || 0,
          communicationScore: session.communication_score || 0,
          fillerWordCount: session.filler_word_count || 0,
          createdAt: session.created_at,
        })),
        roundStats,
        suggestions,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Progress query failed" });
    }
  },
);

// GET /api/users/:userId/sessions
app.get(
  "/api/users/:userId/sessions",
  requireAuth,
  requireSameUser,
  async (req, res) => {
    const { userId } = req.params;

    try {
      const { rows } = await pool.query(
        `SELECT ps.id, ps.session_name, ps.role_name, ps.skill_name, ps.difficulty,
          ps.total_score, ps.total_questions, ps.created_at,
          ar.technical_score, ar.feedback,
          ROW_NUMBER() OVER (ORDER BY ps.created_at ASC)::int AS attempt_number
       FROM practice_sessions ps
       LEFT JOIN analysis_reports ar ON ar.practice_session_id = ps.id
       WHERE ps.user_id = $1
       ORDER BY ps.created_at DESC`,
        [userId],
      );

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "History query failed" });
    }
  },
);

// DELETE /api/users/:userId/sessions/:sessionId
app.delete(
  "/api/users/:userId/sessions/:sessionId",
  requireAuth,
  requireSameUser,
  async (req, res) => {
    const { userId, sessionId } = req.params;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const session = await client.query(
        `SELECT id
         FROM practice_sessions
         WHERE id = $1 AND user_id = $2`,
        [sessionId, userId],
      );

      if (!session.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Session not found" });
      }

      await client.query(
        "DELETE FROM analysis_reports WHERE practice_session_id = $1",
        [sessionId],
      );
      await client.query("DELETE FROM answers WHERE practice_session_id = $1", [
        sessionId,
      ]);
      await client.query("DELETE FROM practice_sessions WHERE id = $1", [
        sessionId,
      ]);

      await client.query("COMMIT");
      res.json({ message: "Session removed" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Could not remove session" });
    } finally {
      client.release();
    }
  },
);

// GET /api/users/:userId/sessions/:sessionId
app.get(
  "/api/users/:userId/sessions/:sessionId",
  requireAuth,
  requireSameUser,
  async (req, res) => {
    const { userId, sessionId } = req.params;
    const latestRequested = sessionId === "latest";
    const attemptMatch = /^attempt-(\d+)$/.exec(sessionId);
    const attemptNumber = attemptMatch ? Number(attemptMatch[1]) : null;
    try {
      const sessionQuery = latestRequested
        ? `SELECT ps.id, ps.session_name, ps.role_name, ps.skill_name, ps.difficulty, ps.total_score,
            ps.total_questions, ps.created_at, ar.feedback, ar.final_score,
            ar.communication_score, ar.technical_score, ar.filler_word_count
           FROM practice_sessions ps
           LEFT JOIN analysis_reports ar ON ar.practice_session_id = ps.id
           WHERE ps.user_id = $1 AND ps.status = 'completed'
           ORDER BY ps.created_at DESC
           LIMIT 1`
        : attemptNumber
          ? `SELECT ranked.id, ranked.session_name, ranked.role_name, ranked.skill_name,
              ranked.difficulty, ranked.total_score, ranked.total_questions,
              ranked.created_at, ar.feedback, ar.final_score,
              ar.communication_score, ar.technical_score, ar.filler_word_count
             FROM (
              SELECT ps.*,
                ROW_NUMBER() OVER (ORDER BY ps.created_at ASC)::int AS attempt_number
              FROM practice_sessions ps
              WHERE ps.user_id = $1 AND ps.status = 'completed'
             ) ranked
             LEFT JOIN analysis_reports ar ON ar.practice_session_id = ranked.id
             WHERE ranked.attempt_number = $2
             LIMIT 1`
          : `SELECT ps.id, ps.session_name, ps.role_name, ps.skill_name, ps.difficulty, ps.total_score,
              ps.total_questions, ps.created_at, ar.feedback, ar.final_score,
              ar.communication_score, ar.technical_score, ar.filler_word_count
             FROM practice_sessions ps
             LEFT JOIN analysis_reports ar ON ar.practice_session_id = ps.id
             WHERE ps.user_id = $1
              AND ps.status = 'completed'
              AND (
                ps.id::text = $2
                OR LOWER(REGEXP_REPLACE(CONCAT_WS(' ', ps.role_name, ps.skill_name, ps.difficulty, 'practice'), '[^a-zA-Z0-9]+', '-', 'g')) = $2
              )
             ORDER BY ps.created_at DESC
             LIMIT 1`;
      const session = await pool.query(
        sessionQuery,
        latestRequested ? [userId] : [userId, attemptNumber || sessionId],
      );

      if (!session.rows[0]) {
        return res.status(404).json({ error: "Session not found" });
      }

      const answers = await pool.query(
        `SELECT
          a.user_answer,
          COALESCE(a.round_key, q.round_key) AS round_key,
          COALESCE(a.question_text, q.question_text) AS question_text,
          COALESCE(a.correct_answer, q.correct_answer) AS correct_answer,
          COALESCE(a.explanation, q.explanation) AS explanation
       FROM answers a
       LEFT JOIN questions q ON q.id = a.question_id
       WHERE a.practice_session_id = $1
       ORDER BY a.id ASC`,
        [session.rows[0].id],
      );

      res.json({ session: session.rows[0], answers: answers.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Analysis query failed" });
    }
  },
);

// GET /api/users/:userId/profile
app.get(
  "/api/users/:userId/profile",
  requireAuth,
  requireSameUser,
  async (req, res) => {
    const { userId } = req.params;

    try {
      const { rows } = await pool.query(
        `SELECT id, name, email, career_goal, level,
          profile_picture, preferred_role, preferred_skill, preferred_difficulty
       FROM users
       WHERE id = $1`,
        [userId],
      );

      if (!rows[0]) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ user: toPublicUser(rows[0]) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Profile query failed" });
    }
  },
);

// PATCH /api/users/:userId/profile
app.patch(
  "/api/users/:userId/profile",
  requireAuth,
  requireSameUser,
  async (req, res) => {
    const { userId } = req.params;
    const { fullName, email, careerGoal, level, profilePicture, password } =
      req.body;

    const allowedLevels = ["Beginner", "Intermediate", "Advanced"];

    if (!fullName?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "Name and  email are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }

    if (!allowedLevels.includes(level)) {
      return res.status(400).json({ error: "Choose a valid level" });
    }

    if (password && password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
        field: "password",
      });
    }

    try {
      const passwordHash = password
        ? await bcrypt.hash(password, SALT_ROUNDS)
        : null;
      const { rows } = passwordHash
        ? await pool.query(
            `UPDATE users
           SET name = $1, email = $2, career_goal = $3,
            level = $4, profile_picture = $5, password_hash = $6
           WHERE id = $7
           RETURNING id, name, email, career_goal, level,
            profile_picture, preferred_role, preferred_skill, preferred_difficulty`,
            [
              fullName,
              email,
              careerGoal || "",
              level,
              profilePicture || "",
              passwordHash,
              userId,
            ],
          )
        : await pool.query(
            `UPDATE users
           SET name = $1, email = $2, career_goal = $3,
            level = $4, profile_picture = $5
           WHERE id = $6
           RETURNING id, name, email, career_goal, level,
            profile_picture, preferred_role, preferred_skill, preferred_difficulty`,
            [
              fullName,
              email,
              careerGoal || "",
              level,
              profilePicture || "",
              userId,
            ],
          );

      if (!rows[0]) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ user: toPublicUser(rows[0]) });
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Email already exists" });
      }

      console.error(err);
      res.status(500).json({ error: "Profile update failed" });
    }
  },
);

// PATCH /api/users/:userId/preferences
app.patch(
  "/api/users/:userId/preferences",
  requireAuth,
  requireSameUser,
  async (req, res) => {
    const { userId } = req.params;
    const { roleName, skill, difficulty } = req.body;
    const allowedDifficulties = ["Easy", "Medium", "Hard"];

    if (!roleName?.trim() || !skill?.trim()) {
      return res.status(400).json({ error: "Role and skill are required" });
    }

    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({ error: "Choose a valid difficulty" });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE users
         SET preferred_role = $1, preferred_skill = $2, preferred_difficulty = $3
         WHERE id = $4
         RETURNING id, name, email, career_goal, level,
          profile_picture, preferred_role, preferred_skill, preferred_difficulty`,
        [roleName.trim(), skill.trim(), difficulty, userId],
      );

      if (!rows[0]) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ user: toPublicUser(rows[0]) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Preference update failed" });
    }
  },
);

if (process.env.NODE_ENV === "production") {
  const clientDistPath = path.join(__dirname, "dist");

  app.use(express.static(clientDistPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const PORT = process.env.PORT || 5000;
ensureInterviewData()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Backend server listening on http://localhost:${PORT}`);
      console.log(`Gemini model: ${GEMINI_MODEL}`);
    });
  })
  .catch((err) => {
    console.error("Database setup failed:", err);
    process.exit(1);
  });
