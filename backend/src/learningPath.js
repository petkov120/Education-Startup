function computeFocusTopics({ questionsById, answers, minTopicAttempts = 5, maxFocus = 4 }) {
  // Group per topic.
  const byTopic = new Map();

  for (const ans of answers) {
    const q = questionsById.get(ans.questionId);
    if (!q) continue;

    const topic = q.topic || "Unknown";

    if (!byTopic.has(topic)) {
      byTopic.set(topic, {
        topic,
        subject: q.subject,
        exam: q.exam,
        attempted: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0,
      });
    }

    const row = byTopic.get(topic);
    row.attempted += 1;
    if (ans.isCorrect) row.correct += 1;
    else row.wrong += 1;
  }

  const rows = Array.from(byTopic.values())
    .filter((r) => r.attempted >= minTopicAttempts)
    .map((r) => {
      r.accuracy = r.correct / Math.max(1, r.attempted);
      return r;
    });

  // Rank: lowest accuracy first, then most wrong answers.
  rows.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return b.wrong - a.wrong;
  });

  return rows.slice(0, maxFocus);
}

function buildLearningPath({ attempt, focusTopics, recommendedQuestionCount = 10 }) {
  // MVP: return actions that can start a new topic drill.
  const nextActions = focusTopics.map((t) => ({
    action: "Start Topic Drill",
    exam: attempt.exam,
    subject: attempt.subject,
    mode: "topic",
    topic: t.topic,
    difficulty: attempt.difficulty || "Medium",
    questionCount: recommendedQuestionCount,
    rationale: `Based on your results: ${Math.round((t.accuracy || 0) * 100)}% accuracy on ${t.topic}.`,
  }));

  return {
    attemptId: attempt.id,
    focusTopics,
    nextActions,
  };
}

module.exports = {
  computeFocusTopics,
  buildLearningPath,
};

