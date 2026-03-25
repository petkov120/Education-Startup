const crypto = require("crypto");

// In-memory MVP storage.
// Later: replace with Postgres tables (attempts, attempt_answers).
const attempts = new Map(); // attemptId -> attempt
const answersByAttempt = new Map(); // attemptId -> Map(questionId -> answer)

function createAttempt({ userId, exam, subject, mode, topic, year, difficulty, questionCount }) {
  const attemptId = crypto.randomUUID();

  const attempt = {
    id: attemptId,
    userId,
    exam,
    subject,
    mode,
    topic: topic || null,
    year: year || null,
    difficulty: difficulty || null,
    questionCount: Number(questionCount || 0) || 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };

  attempts.set(attemptId, attempt);
  answersByAttempt.set(attemptId, new Map());

  return attempt;
}

function markFinished(attemptId) {
  const attempt = attempts.get(attemptId);
  if (!attempt) return null;
  attempt.finishedAt = new Date().toISOString();
  attempts.set(attemptId, attempt);
  return attempt;
}

function getAttempt(attemptId) {
  return attempts.get(attemptId) || null;
}

function upsertAnswer({ attemptId, questionId, questionNumber, selectedOption, isCorrect, timeSpentMs, answeredAt }) {
  const attemptAnswers = answersByAttempt.get(attemptId);
  if (!attemptAnswers) return null;

  const answer = {
    questionId,
    questionNumber: questionNumber ?? null,
    selectedOption,
    isCorrect: Boolean(isCorrect),
    timeSpentMs: Number(timeSpentMs || 0) || 0,
    answeredAt: answeredAt || new Date().toISOString(),
  };

  attemptAnswers.set(questionId, answer);
  return answer;
}

function getAnswers(attemptId) {
  const attemptAnswers = answersByAttempt.get(attemptId);
  if (!attemptAnswers) return [];
  return Array.from(attemptAnswers.values()).sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0));
}

module.exports = {
  createAttempt,
  markFinished,
  getAttempt,
  upsertAnswer,
  getAnswers,
};

