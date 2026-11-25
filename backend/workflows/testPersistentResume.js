
import "dotenv/config";
import {
  executeWorkflow,
  resumeWorkflowFromCheckpoint,
} from "./workflowExecutor.js";

const workflow = {
  name: "Persistent Approval Test",
  description: "Tests resuming from saved approval state",
  nodes: [
    { id: "start", type: "start", name: "Start", config: {} },
    { id: "approval", type: "approval", name: "Approval", config: {} },
    { id: "end", type: "end", name: "End", config: {} },
  ],
  edges: [
    { source: "start", target: "approval" },
    { source: "approval", target: "end" },
  ],
};

async function main() {
  let capturedState;

  const paused = await executeWorkflow(
    workflow,
    "Test approval",
    async (state) => {
      capturedState = structuredClone(state);
    }
  );

  console.log("Paused:", paused.status);

  if (!capturedState) {
    throw new Error("Checkpoint was not captured.");
  }

  const resumed = await resumeWorkflowFromCheckpoint(
    capturedState.workflow,
    capturedState,
    true
  );

  console.log("Resumed:", resumed.status);
  console.log(
    "Path:",
    resumed.history.map((h) => h.nodeId).join(" → ")
  );

  if (
    paused.status !== "approval_required" ||
    resumed.status !== "completed"
  ) {
    throw new Error("Persistent resume test failed.");
  }
}

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
