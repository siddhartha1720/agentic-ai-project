
import "dotenv/config";
import mongoose from "mongoose";
import WorkflowRun from "../models/workflowRun.model.js";

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const run = await WorkflowRun.findById(
      "6b020ca96aeae110ceb5d281"
    ).lean();

    if (!run) {
      console.log("Run not found.");
      return;
    }

    console.log("Status:", run.status);
    console.log("Approval status:", run.approval?.status);
    console.log("Current node:", run.currentNodeId);
    console.log("Workflow snapshot saved:", !!run.workflowSnapshot);
    console.log("Resume state saved:", !!run.resumeState);
    console.log("Executed steps:", run.steps);
  } catch (error) {
    console.error("Checkpoint test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
