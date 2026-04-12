/**
 * In-memory question bank: seed items + JSON packs under ../exam-question-banks/
 */

const { loadExamQuestionBanks } = require("./loadExamQuestionBanks");

const seedQuestions = [
  // WAEC - Mathematics - Algebra
  {
    id: "waec-math-algebra-1",
    exam: "WAEC",
    subject: "Mathematics",
    topic: "Algebra",
    year: 2025,
    difficulty: "Medium",
    questionNumber: 1,
    prompt: "If x + 3 = 7, what is the value of x?",
    options: { A: "2", B: "3", C: "4", D: "5", E: "6" },
    correctOption: "C",
  },
  {
    id: "waec-math-algebra-2",
    exam: "WAEC",
    subject: "Mathematics",
    topic: "Algebra",
    year: 2024,
    difficulty: "Easy",
    questionNumber: 2,
    prompt: "Solve for y: 2y = 10.",
    options: { A: "2", B: "3", C: "4", D: "5", E: "6" },
    correctOption: "D",
  },

  // WAEC - Mathematics - Trigonometry
  {
    id: "waec-math-trig-1",
    exam: "WAEC",
    subject: "Mathematics",
    topic: "Trigonometry",
    year: 2023,
    difficulty: "Medium",
    questionNumber: 3,
    prompt: "In a right triangle, the hypotenuse is 10 and one leg is 6. What is the other leg?",
    options: { A: "6", B: "7", C: "8", D: "9", E: "10" },
    correctOption: "C",
  },

  // WAEC - Mathematics - Statistics
  {
    id: "waec-math-stats-1",
    exam: "WAEC",
    subject: "Mathematics",
    topic: "Statistics",
    year: 2022,
    difficulty: "Easy",
    questionNumber: 4,
    prompt: "The mean of 3 numbers is 6. What is their total sum?",
    options: { A: "9", B: "12", C: "15", D: "18", E: "21" },
    correctOption: "C",
  },

  // WAEC - Chemistry - Organic Chemistry
  {
    id: "waec-chem-org-1",
    exam: "WAEC",
    subject: "Chemistry",
    topic: "Organic Chemistry",
    year: 2025,
    difficulty: "Medium",
    questionNumber: 1,
    prompt: "Which of the following is an example of an organic compound?",
    options: { A: "Salt", B: "Water", C: "Ethanol", D: "Sodium chloride", E: "Ammonia" },
    correctOption: "C",
  },

  // JAMB - Physics - Kinematics
  {
    id: "jamb-phys-kin-1",
    exam: "JAMB",
    subject: "Physics",
    topic: "Kinematics",
    year: 2025,
    difficulty: "Medium",
    questionNumber: 1,
    prompt: "A car starts from rest and reaches 20 m/s in 5 seconds. What is its acceleration?",
    options: { A: "2", B: "3", C: "4", D: "5", E: "6" },
    correctOption: "C",
  },
];

const loadedPackQuestions = loadExamQuestionBanks();
const questionBank = [...seedQuestions, ...loadedPackQuestions];

function getQuestionById(id) {
  return questionBank.find((q) => q.id === id) || null;
}

function selectQuestions({ exam, subject, mode, topic, year, difficulty, questionCount }) {
  const requested = questionCount ? Number(questionCount) : 10;
  const take = Number.isFinite(requested) && requested > 0 ? requested : 10;

  const yearNum = year != null && year !== "" ? Number(year) : null;

  const baseFilter = (q) => q.exam === exam && q.subject === subject;

  const modeFilter = (q) => {
    if (mode === "topic") return q.topic === topic;
    if (mode === "year") return yearNum != null && Number(q.year) === yearNum;
    return true;
  };

  const diffFilter = (q) => {
    if (!difficulty) return true;
    return q.difficulty === difficulty;
  };

  let pool = questionBank.filter((q) => baseFilter(q) && modeFilter(q) && diffFilter(q));

  // Fallbacks to keep MVP usable even if question bank is small.
  if (pool.length < take) {
    pool = questionBank.filter((q) => baseFilter(q) && modeFilter(q));
  }
  // Do not drop year/topic filters for exam+subject — would return wrong years/topics.
  if (pool.length < take && mode !== "year" && mode !== "topic") {
    pool = questionBank.filter((q) => baseFilter(q));
  }

  // Deterministic selection: first N for MVP predictability.
  // Later: randomize or shuffle to simulate real tests.
  return pool.slice(0, take).map((q) => ({
    questionId: q.id,
    questionNumber: q.questionNumber ?? null,
    prompt: q.prompt,
    options: q.options,
    topic: q.topic,
    year: q.year,
    difficulty: q.difficulty,
    paperType: q.paperType ?? undefined,
    diagram: q.diagram || undefined,
  }));
}

module.exports = {
  questionBank,
  getQuestionById,
  selectQuestions,
};
