/**
 * Loads JSON question packs from backend/exam-question-banks/
 * Layout: exam-question-banks/<exam-slug>/<year>/*.json
 * Each file: array of questions OR { "questions": [...] }.
 *
 * Import shape (example): exam WASSCE/WAEC, options array, correctOption index, correctLetter.
 * Normalized to internal shape: exam WAEC|JAMB, options { A, B, ... }, correctOption letter string.
 */

const fs = require("fs");
const path = require("path");

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const BANKS_ROOT = path.join(__dirname, "..", "exam-question-banks");

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * Map source exam labels to canonical values used by the API / exam-home.
 */
function canonicalExam(rawExam) {
  const e = String(rawExam || "")
    .trim()
    .toUpperCase();
  if (e === "WASSCE" || e === "WAEC" || e === "WASSCE/NECO") return "WAEC";
  if (e === "JAMB" || e === "UTME") return "JAMB";
  return e || "WAEC";
}

function optionsArrayToObject(options) {
  if (!Array.isArray(options)) return null;
  const out = {};
  options.forEach((text, i) => {
    const L = LETTERS[i];
    if (L) out[L] = String(text);
  });
  return out;
}

function normalizeImportedQuestion(raw) {
  if (!raw || typeof raw !== "object") throw new Error("invalid row");

  const exam = canonicalExam(raw.exam);
  const subject = String(raw.subject || "").trim();
  if (!subject) throw new Error("missing subject");

  const year = Number(raw.year);
  if (!Number.isFinite(year)) throw new Error("missing year");

  let options = raw.options;
  if (Array.isArray(options)) {
    options = optionsArrayToObject(options);
  }
  if (!options || typeof options !== "object") options = {};

  let correct =
    raw.correctOption !== undefined && raw.correctOption !== null
      ? raw.correctOption
      : null;
  if (typeof correct === "number" && LETTERS[correct]) {
    correct = LETTERS[correct];
  }
  if (typeof correct === "string" && /^[A-Z]$/i.test(correct)) {
    correct = correct.toUpperCase();
  }
  if (raw.correctLetter && typeof raw.correctLetter === "string") {
    const L = raw.correctLetter.trim().toUpperCase();
    if (/^[A-Z]$/.test(L)) correct = L;
  }
  if (!correct) throw new Error("missing correct option");

  const qn = Number(raw.questionNumber);
  const paper = raw.paperType ? slug(raw.paperType) : "paper";
  const id =
    raw.id ||
    `${slug(exam)}-${year}-${slug(subject)}-${paper}-q${Number.isFinite(qn) ? qn : "x"}`;

  return {
    id,
    exam,
    subject,
    topic: raw.topic != null && String(raw.topic).trim() ? String(raw.topic).trim() : null,
    paperType: raw.paperType != null ? String(raw.paperType) : null,
    year,
    difficulty: raw.difficulty != null ? String(raw.difficulty) : null,
    questionNumber: Number.isFinite(qn) ? qn : null,
    prompt: String(raw.prompt || ""),
    options,
    correctOption: correct,
    diagram: Boolean(raw.diagram),
    note: raw.note != null ? String(raw.note) : null,
  };
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.questions)) return data.questions;
  if (data && typeof data === "object") return [data];
  return [];
}

function loadExamQuestionBanks() {
  const out = [];
  if (!fs.existsSync(BANKS_ROOT)) return out;

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".json")) {
        let rows;
        try {
          rows = readJsonFile(full);
        } catch (e) {
          console.warn(`[exam-question-banks] invalid JSON: ${full}`, e.message);
          continue;
        }
        for (const raw of rows) {
          try {
            out.push(normalizeImportedQuestion(raw));
          } catch (e) {
            console.warn(`[exam-question-banks] skip row in ${full}:`, e.message);
          }
        }
      }
    }
  };

  walk(BANKS_ROOT);
  return out;
}

module.exports = {
  loadExamQuestionBanks,
  BANKS_ROOT,
  canonicalExam,
};
