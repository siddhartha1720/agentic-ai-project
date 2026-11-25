import { evaluateCondition } from "./conditionEvaluator.js";

const config = {
  field: "candidate.score",
  operator: "gte",
  value: 70,
};

for (const score of [85, 70, 45]) {
  const result = evaluateCondition(config, {
    candidate: { score },
  });

  console.log(`Score ${score}: ${result ? "PASS" : "FAIL"}`);
}