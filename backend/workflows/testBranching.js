
import "dotenv/config";
import { executeWorkflow } from "./workflowExecutor.js";

const workflow = {
  name: "Candidate Screening Workflow",
  description: "Choose interview or review based on score",
  nodes: [
    { id: "start", type: "start", name: "Start", config: {} },
    {
      id: "check",
      type: "condition",
      name: "Check Candidate Score",
      config: {
        field: "candidate.score",
        operator: "gte",
        value: 70
      }
    },
    {
      id: "pass",
      type: "ai_task",
      name: "Prepare Interview",
      config: {
        prompt: "Write one short interview invitation message."
      }
    },
    {
      id: "fail",
      type: "ai_task",
      name: "Prepare Review",
      config: {
        prompt: "Write one short message saying the application needs further review."
      }
    },
    { id: "end", type: "end", name: "End", config: {} }
  ],
  edges: [
    { source: "start", target: "check" },
    { source: "check", target: "pass", condition: "true" },
    { source: "check", target: "fail", condition: "false" },
    { source: "pass", target: "end" },
    { source: "fail", target: "end" }
  ]
};

async function main() {
  for (const score of [85, 45]) {
    const result = await executeWorkflow(workflow, {
      candidate: { score }
    });

    console.log("\nCandidate Score:", score);
    console.log("Status:", result.status);
    console.log(
      "Executed Nodes:",
      result.history.map(step => step.nodeId).join(" → ")
    );
    console.log("Output:", result.output);
  }
}

main().catch(error => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
