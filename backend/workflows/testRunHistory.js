
import "dotenv/config";
import mongoose from "mongoose";
import WorkflowRun from "../models/workflowRun.model.js";

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const runs = await WorkflowRun.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id status steps history createdAt")
      .lean();

    console.table(
      runs.map((run) => ({
        runId: String(run._id),
        status: run.status,
        steps: run.steps,
        historyEntries: run.history?.length ?? 0,
        createdAt: run.createdAt,
      }))
    );
  } catch (error) {
    console.error("History check failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();
