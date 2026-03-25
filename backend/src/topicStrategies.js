/**
 * Deterministic topic strategy content (NO AI).
 * Used by the explanation sheet + learning path next steps.
 */

const topicStrategies = {
  Algebra: {
    steps: [
      "Rewrite the equation so the variable is on one side.",
      "Undo operations in reverse order (add/subtract, then multiply/divide).",
      "Check your answer by substituting back into the original equation.",
    ],
    microExample: "If x + 3 = 7, subtract 3 from both sides: x = 4.",
  },
  Trigonometry: {
    steps: [
      "Identify the right triangle and label hypotenuse vs legs.",
      "Use Pythagoras: a^2 + b^2 = c^2.",
      "Take the square root and verify the units/value.",
    ],
    microExample: "If hypotenuse is 10 and one leg is 6: other^2 = 10^2 - 6^2 = 64, so other = 8.",
  },
  Statistics: {
    steps: [
      "Recall: mean = total ÷ number of values.",
      "Compute total = mean × count.",
      "Write the final answer with correct units.",
    ],
    microExample: "Mean 6 for 3 numbers => total = 6 × 3 = 18.",
  },
  "Organic Chemistry": {
    steps: [
      "Organic compounds contain carbon-hydrogen (C–H) structures.",
      "Identify examples like alcohols, acids, alkanes/alkenes (as taught).",
      "Eliminate obvious inorganic alternatives (salts, water).",
    ],
    microExample: "Ethanol is an organic compound (an alcohol).",
  },
  Kinematics: {
    steps: [
      "Pick the right kinematics formula for the given information.",
      "If starting from rest, use v = u + at (u = 0).",
      "Rearrange to solve for a, then check reasonableness.",
    ],
    microExample: "u = 0, v = 20, t = 5 => a = (20-0)/5 = 4 m/s^2.",
  },
};

function getTopicStrategy(topic) {
  return topicStrategies[topic] || {
    steps: ["Review the topic notes.", "Solve similar questions.", "Retry after a short break."],
    microExample: "Focus on identifying the exact method used to reach the correct option.",
  };
}

module.exports = { getTopicStrategy, topicStrategies };

