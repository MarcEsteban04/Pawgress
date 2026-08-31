/**
 * The question quality pass (Sprint 48).
 *
 *   npm run practice:test
 *
 * Deterministic, unlike `npm run ai:eval` — no provider, no key, no database.
 * Everything in `features/practice/quality.ts` is string work over fixed input,
 * so a failure here is a real regression rather than a model having a bad day.
 * That is the whole argument for the pass being deterministic: it can be tested
 * like code instead of judged like prose.
 *
 * Loaded directly with `node` because `quality.ts` imports its only dependency
 * as a TYPE, which Node erases — same trick as `md:test`.
 */
import {
  answerIsGrounded,
  answerLeaksIntoPrompt,
  containment,
  contentTokens,
  isDuplicatePrompt,
  isSelfReferential,
  orderChoices,
  selectQuestions,
  similarity,
  usableQuestion,
} from "../src/features/practice/quality.ts";

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ok    ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${name} ${detail}`);
  }
};

const SOURCE = `
# Cell Transport

Osmosis is the movement of water across a semi-permeable membrane from a
region of low solute concentration to one of high solute concentration.
Diffusion is the movement of particles from high to low concentration.
Active transport moves substances against their concentration gradient and
requires ATP. The mitochondrion produces ATP through respiration.
A hypertonic solution has a higher solute concentration than the cell.
`;

const q = (over = {}) => ({
  type: "identification",
  prompt: "Which organelle produces ATP?",
  choices: [],
  answer: "mitochondrion",
  explanation: "Respiration in the mitochondrion yields ATP.",
  ...over,
});

// ---- usableQuestion -------------------------------------------------------
console.log("\nusableQuestion");
check(
  "mcq with the answer among its choices",
  usableQuestion(
    q({
      type: "mcq",
      prompt: "Which process requires ATP?",
      choices: ["Active transport", "Osmosis", "Diffusion"],
      answer: "Active transport",
    }),
  ),
);
check(
  "mcq whose answer is not among its choices is rejected",
  !usableQuestion(
    q({
      type: "mcq",
      prompt: "Which process requires ATP?",
      choices: ["Osmosis", "Diffusion", "Filtration"],
      answer: "Active transport",
    }),
  ),
);
check(
  "mcq with duplicate choices is rejected",
  !usableQuestion(
    q({
      type: "mcq",
      prompt: "Which process requires ATP?",
      choices: ["Osmosis", "osmosis", "Active transport"],
      answer: "Active transport",
    }),
  ),
);
check(
  "true_false with a third answer is rejected",
  !usableQuestion(q({ type: "true_false", answer: "Sometimes" })),
);
check("true_false accepts False", usableQuestion(q({ type: "true_false", answer: "False" })));

// ---- duplicate detection --------------------------------------------------
console.log("\nduplicate detection");
check(
  'short rephrasing caught: "What is osmosis?" / "Define osmosis."',
  isDuplicatePrompt("What is osmosis?", "Define osmosis."),
  `jaccard=${similarity("What is osmosis?", "Define osmosis.").toFixed(2)} containment=${containment("What is osmosis?", "Define osmosis.").toFixed(2)}`,
);
check(
  "mitochondria rephrasing caught",
  isDuplicatePrompt("What is the function of the mitochondria?", "What do the mitochondria do?"),
);
check(
  'genuinely different kept: "Define diffusion." / "Define osmosis."',
  !isDuplicatePrompt("Define diffusion.", "Define osmosis."),
  `containment=${containment("Define diffusion.", "Define osmosis.").toFixed(2)}`,
);
check(
  "two long, unrelated questions are kept",
  !isDuplicatePrompt(
    "Explain why active transport requires energy from ATP.",
    "Describe what happens to a cell placed in a hypertonic solution.",
  ),
);
check(
  "documented limit: a synonym pair is NOT caught (lexical only)",
  !isDuplicatePrompt("Which organelle produces ATP?", "What is the powerhouse of the cell?"),
);

// ---- answer verification --------------------------------------------------
console.log("\nanswer verification");
check(
  "answer quoted inside its own question is caught",
  answerLeaksIntoPrompt(
    q({
      prompt: "What is osmosis, the movement of water across a semi-permeable membrane?",
      answer: "the movement of water across a semi-permeable membrane",
    }),
  ),
);
check(
  "a one-word answer repeated in the question is NOT a leak",
  !answerLeaksIntoPrompt(q({ prompt: "Define osmosis.", answer: "osmosis" })),
);
check(
  "true_false is exempt from the leak check",
  !answerLeaksIntoPrompt(
    q({ type: "true_false", prompt: "Osmosis is true of water only.", answer: "True" }),
  ),
);

const sourceTokens = contentTokens(SOURCE);
check(
  "identification grounded in the material passes",
  answerIsGrounded(q({ answer: "mitochondrion" }), sourceTokens),
);
check(
  "identification naming a term the material never mentions is rejected",
  !answerIsGrounded(q({ answer: "endoplasmic reticulum" }), sourceTokens),
);
check(
  "short_answer paraphrase is not held to the material's wording",
  answerIsGrounded(
    q({ type: "short_answer", answer: "Water moves toward the saltier side until it balances." }),
    sourceTokens,
  ),
);

check(
  "self-referential question is caught",
  isSelfReferential("How many key concepts does this reviewer list?"),
);
check("a normal question is not self-referential", !isSelfReferential("What is osmosis?"));

// ---- choice order ---------------------------------------------------------
console.log("\nchoice order");
const mcq = q({
  type: "mcq",
  prompt: "Which process requires ATP?",
  choices: ["Active transport", "Osmosis", "Diffusion", "Filtration"],
  answer: "Active transport",
});
const onceOrder = orderChoices(mcq).choices;
const twiceOrder = orderChoices(mcq).choices;
check("ordering is stable across calls", onceOrder.join("|") === twiceOrder.join("|"));
check(
  "ordering keeps every choice",
  [...onceOrder].sort().join("|") === [...mcq.choices].sort().join("|"),
);
check("the answer is still among the choices", onceOrder.includes(mcq.answer));

// ---- the whole pipeline ---------------------------------------------------
console.log("\nselectQuestions");
const { kept, dropped } = selectQuestions(
  [
    q({ prompt: "Which organelle produces ATP?", answer: "mitochondrion" }),
    // near-duplicate of the first, by containment
    q({ prompt: "Name the organelle that produces ATP.", answer: "mitochondrion" }),
    q({
      type: "mcq",
      prompt: "Which process moves substances against their gradient?",
      choices: ["Active transport", "Osmosis", "Diffusion"],
      answer: "Active transport",
    }),
    // unusable: answer absent from choices
    q({
      type: "mcq",
      prompt: "Which solution has more solute than the cell?",
      choices: ["Isotonic", "Hypotonic"],
      answer: "Hypertonic",
    }),
    // hallucinated term
    q({ prompt: "Which structure folds proteins here?", answer: "Golgi apparatus" }),
    q({ type: "true_false", prompt: "Diffusion requires ATP.", answer: "False" }),
  ],
  SOURCE,
);

const reasons = dropped.map((d) => d.reason);
console.log("  kept:", kept.length, "| dropped:", reasons.join(", "));

check("keeps the three good questions", kept.length === 3, `got ${kept.length}`);
check(
  "drops the near-duplicate",
  reasons.includes("duplicate") || reasons.includes("duplicate_answer"),
);
check("drops the unusable mcq", reasons.includes("unusable"));
check("drops the ungrounded term", reasons.includes("answer_not_grounded"));
check("no question survives twice", new Set(kept.map((k) => k.prompt)).size === kept.length);

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
