
import "dotenv/config";
import {
  executeWorkflow,
  resumeWorkflow,
} from "./workflowExecutor.js";

const workflow = {
  name: "Email Approval Workflow",
  description: "Draft an email and request human approval",
  nodes: [
    { id: "start", type: "start", name: "Start", config: {} },
    {
      id: "draft",
      type: "ai_task",
      name: "Draft Interview Email",
      config: {
        prompt: "Write a short professional interview invitation email."
      }
    },
    {
      id: "approve",
      type: "approval",
      name: "Review Email",
      config: {}
    },
    { id: "end", type: "end", name: "End", config: {} }
  ],
  edges: [
    { source: "start", target: "draft" },
    { source: "draft", target: "approve" },
    { source: "approve", target: "end" }
  ]
};

async function main() {
  const result = await executeWorkflow(workflow);

  console.log("\nInitial status:", result.status);
  console.log("Approval required at:", result.currentNode);

  if (result.status !== "approval_required") {
    throw new Error("Workflow did not pause for approval.");
  }

  const resumed = await resumeWorkflow(result.runId, true);

  console.log("\nAfter approval:", resumed.status);
  console.log(
    "Executed path:",
    resumed.history.map((item) => item.nodeId).join(" → ")
  );
  console.log("\nFinal output:", resumed.output);

  // Replay protection test
  try {
    await resumeWorkflow(result.runId, true);
    throw new Error("Replay unexpectedly succeeded.");
  } catch (error) {
    console.log("\nReplay check:", error.message);
  }
}
// Test rejection
const secondRun = await executeWorkflow(workflow);

console.log("\nRejection test initial status:", secondRun.status);

const rejected = await resumeWorkflow(secondRun.runId, false);

console.log("After rejection:", rejected.status);
console.log(
  "Rejected path:",
  rejected.history.map((step) => step.nodeId).join(" → ")
);

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
