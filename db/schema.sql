CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  career_goal VARCHAR(150),
  level VARCHAR(50) DEFAULT 'Beginner',
  profile_picture TEXT,
  preferred_role VARCHAR(100),
  preferred_skill VARCHAR(100),
  preferred_difficulty VARCHAR(50) DEFAULT 'Easy',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fields (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE rounds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  field_id INTEGER REFERENCES fields(id),
  round_id INTEGER REFERENCES rounds(id),
  round_key VARCHAR(50),
  role_name VARCHAR(100),
  skill_name VARCHAR(100),
  difficulty VARCHAR(50),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE practice_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  field_id INTEGER REFERENCES fields(id),
  round_id INTEGER REFERENCES rounds(id),
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE answers (
  id SERIAL PRIMARY KEY,
  practice_session_id INTEGER REFERENCES practice_sessions(id),
  question_id INTEGER REFERENCES questions(id),
  user_answer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE analysis_reports (
  id SERIAL PRIMARY KEY,
  practice_session_id INTEGER UNIQUE REFERENCES practice_sessions(id),
  communication_score INTEGER,
  filler_word_count INTEGER,
  technical_score INTEGER,
  final_score INTEGER,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
