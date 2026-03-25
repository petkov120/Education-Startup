require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { createRequireUser } = require('./src/authMiddleware');
const { selectQuestions, getQuestionById } = require('./src/questionBank');
const { getTopicStrategy } = require('./src/topicStrategies');
const { createAttempt, markFinished, getAttempt, upsertAnswer, getAnswers } = require('./src/attemptStore');
const { computeFocusTopics, buildLearningPath } = require('./src/learningPath');
const app = express();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


// Middleware
app.use(cors()); // Allows your frontend to talk to backend
app.use(express.json()); // Parse JSON request bodies

// Basic hardening for a simple MVP API.
app.disable('x-powered-by');

// In-memory "database" (for learning - replace with real DB later)
let users = [];

const requireUser = createRequireUser(supabase);

function normalizeSelectedOption(val) {
  if (!val) return null;
  const v = String(val).trim().toUpperCase();
  const allowed = new Set(["A", "B", "C", "D", "E"]);
  return allowed.has(v) ? v : null;
}

function requireRequestBodyFields(req, res, fields) {
  for (const f of fields) {
    if (req.body?.[f] === undefined || req.body?.[f] === null || req.body?.[f] === "") {
      res.status(400).json({ success: false, message: `Missing required field: ${f}` });
      return false;
    }
  }
  return true;
}

// Sign up endpoint
app.post('/api/auth/signup', (req, res) => {
  const { fullName, email, username, password } = req.body;
  
  // Validation (server-side too!)
  if (!fullName || !email || !username || !password) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
  
  // Check if email already exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({
      success: false,
      message: 'Email already registered'
    });
  }
  
  // Check if username already exists
  if (users.find(u => u.username === username)) {
    return res.status(400).json({
      success: false,
      message: 'Username already taken'
    });
  }
  
  // In real app, hash password with bcrypt before saving
  const newUser = {
    id: Date.now(),
    fullName,
    email,
    username,
    password, // ⚠️ In production, hash this!
    createdAt: new Date()
  };
  
  users.push(newUser);
  
  res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    user: { id: newUser.id, email: newUser.email, username: newUser.username }
  });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });
  }
  
  res.json({
    success: true,
    message: 'Login successful',
    user: { id: user.id, email: user.email, username: user.username }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

/**
 * Learning-path / attempts API (JWT secured).
 * Frontend must send: Authorization: Bearer <supabase_access_token>
 */

app.post('/api/attempts/start', requireUser, (req, res) => {
  if (!requireRequestBodyFields(req, res, ["exam", "subject", "mode"])) return;

  const userId = req.user.id;
  const exam = String(req.body.exam).trim().toUpperCase();
  const subject = String(req.body.subject).trim();
  const mode = String(req.body.mode).trim().toLowerCase(); // "topic" | "year"
  const topic = req.body.topic ? String(req.body.topic).trim() : null;
  const year = req.body.year ? String(req.body.year).trim() : null;
  const difficulty = req.body.difficulty ? String(req.body.difficulty).trim() : null;
  const questionCount = req.body.questionCount ?? 10;

  if (!["topic", "year"].includes(mode)) {
    return res.status(400).json({ success: false, message: "Invalid mode. Use 'topic' or 'year'." });
  }
  if (mode === "topic" && !topic) {
    return res.status(400).json({ success: false, message: "Missing topic for topic mode." });
  }
  if (mode === "year" && !year) {
    return res.status(400).json({ success: false, message: "Missing year for year mode." });
  }

  const attempt = createAttempt({
    userId,
    exam,
    subject,
    mode,
    topic,
    year,
    difficulty,
    questionCount,
  });

  const questions = selectQuestions({
    exam,
    subject,
    mode,
    topic,
    year: year ? Number(year) : null,
    difficulty,
    questionCount,
  });

  return res.json({
    success: true,
    attemptId: attempt.id,
    attempt: {
      id: attempt.id,
      exam,
      subject,
      mode,
      topic: attempt.topic,
      year: attempt.year,
      difficulty: attempt.difficulty,
      questionCount: attempt.questionCount,
      startedAt: attempt.startedAt,
    },
    questions,
  });
});

app.post('/api/attempts/:attemptId/answers', requireUser, (req, res) => {
  const { attemptId } = req.params;
  const attempt = getAttempt(attemptId);
  if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
  if (attempt.userId !== req.user.id) return res.status(403).json({ success: false, message: "Forbidden." });

  const answers = Array.isArray(req.body?.answers) ? req.body.answers : null;
  if (!answers || answers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide { answers: [{ questionId, selectedOption, timeSpentMs? }] }",
    });
  }

  for (const item of answers) {
    const questionId = item?.questionId;
    const selectedOption = normalizeSelectedOption(item?.selectedOption);
    const timeSpentMs = item?.timeSpentMs ?? 0;

    if (!questionId || !selectedOption) {
      return res.status(400).json({
        success: false,
        message: "Each answer requires questionId and selectedOption (A-E).",
      });
    }

    const q = getQuestionById(questionId);
    if (!q) {
      return res.status(400).json({
        success: false,
        message: `Unknown questionId: ${questionId}`,
      });
    }

    // Compute correctness on the server (so the client can't lie).
    const isCorrect = selectedOption === q.correctOption;

    upsertAnswer({
      attemptId,
      questionId: q.id,
      questionNumber: q.questionNumber ?? null,
      selectedOption,
      isCorrect,
      timeSpentMs,
      answeredAt: item.answeredAt || null,
    });
  }

  return res.json({ success: true });
});

app.post('/api/attempts/:attemptId/finish', requireUser, (req, res) => {
  const { attemptId } = req.params;
  const attempt = getAttempt(attemptId);
  if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
  if (attempt.userId !== req.user.id) return res.status(403).json({ success: false, message: "Forbidden." });

  const answers = getAnswers(attemptId);
  const questionsById = new Map();
  for (const ans of answers) {
    const q = getQuestionById(ans.questionId);
    if (q) questionsById.set(ans.questionId, q);
  }

  const totalAttempted = answers.length;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const wrongCount = totalAttempted - correctCount;
  const accuracy = totalAttempted > 0 ? correctCount / totalAttempted : 0;

  // Anti-"fake analytics": start strict; if not enough data, fallback and mark early signal.
  let focusTopics = computeFocusTopics({
    questionsById,
    answers,
    minTopicAttempts: 3,
    maxFocus: 4,
  });

  let earlySignal = false;
  if (focusTopics.length === 0) {
    earlySignal = true;
    focusTopics = computeFocusTopics({
      questionsById,
      answers,
      minTopicAttempts: 1,
      maxFocus: 4,
    });
  }

  const learningPath = buildLearningPath({
    attempt,
    focusTopics,
    recommendedQuestionCount: 10,
  });

  markFinished(attemptId);

  return res.json({
    success: true,
    summary: {
      attemptId,
      totalAttempted,
      correctCount,
      wrongCount,
      accuracy,
      earlySignal,
    },
    learningPath: {
      ...learningPath,
      earlySignal,
    },
  });
});

app.get('/api/explanation-sheet', requireUser, (req, res) => {
  const attemptId = req.query.attemptId;
  const questionId = req.query.questionId;

  if (!attemptId || !questionId) {
    return res.status(400).json({ success: false, message: "Provide attemptId and questionId." });
  }

  const attempt = getAttempt(attemptId);
  if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
  if (attempt.userId !== req.user.id) return res.status(403).json({ success: false, message: "Forbidden." });

  const answers = getAnswers(attemptId);
  const answer = answers.find((a) => a.questionId === questionId);
  const q = getQuestionById(questionId);

  if (!q) return res.status(404).json({ success: false, message: "Question not found." });
  if (!answer) return res.status(404).json({ success: false, message: "No answer recorded for this question." });

  const topicStrategy = getTopicStrategy(q.topic);

  return res.json({
    success: true,
    question: {
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
      topic: q.topic,
      subject: q.subject,
      exam: q.exam,
      year: q.year,
      difficulty: q.difficulty,
    },
    result: {
      selectedOption: answer.selectedOption,
      correctOption: q.correctOption,
      isCorrect: answer.isCorrect,
    },
    strategySheet: {
      topic: q.topic,
      steps: topicStrategy.steps,
      microExample: topicStrategy.microExample,
    },
  });
});

app.get('/api/learning-path', requireUser, (req, res) => {
  const attemptId = req.query.attemptId;
  if (!attemptId) return res.status(400).json({ success: false, message: "Provide attemptId." });

  const attempt = getAttempt(attemptId);
  if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
  if (attempt.userId !== req.user.id) return res.status(403).json({ success: false, message: "Forbidden." });

  const answers = getAnswers(attemptId);
  const questionsById = new Map();
  for (const ans of answers) {
    const q = getQuestionById(ans.questionId);
    if (q) questionsById.set(ans.questionId, q);
  }

  const focusTopics = computeFocusTopics({
    questionsById,
    answers,
    minTopicAttempts: 1,
    maxFocus: 4,
  });

  const learningPath = buildLearningPath({
    attempt,
    focusTopics,
    recommendedQuestionCount: 10,
  });

  return res.json({ success: true, learningPath });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Signup endpoint: http://localhost:${PORT}/api/auth/signup`);
});