
import "dotenv/config";
import mongoose from "mongoose";

import {
  saveWorkflow,
  getUserWorkflows,
  getWorkflowById,
} from "./workflowPersistence.service.js";

const testWorkflow = {
  name: "Python Interview Workflow",
  description: "Generate interview questions",
  nodes: [
    { id: "start", type: "start", name: "Start", config: {} },
    {
      id: "ai",
      type: "ai_task",
      name: "Generate Questions",
      config: {
        prompt: "Generate five Python interview questions.",
      },
    },
    { id: "end", type: "end", name: "End", config: {} },
  ],
  edges: [
    { source: "start", target: "ai" },
    { source: "ai", target: "end" },
  ],
};

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Temporary test user IDs; no real account is modified.
    const userId = new mongoose.Types.ObjectId();
    const anotherUserId = new mongoose.Types.ObjectId();

    const saved = await saveWorkflow(userId, testWorkflow);
    console.log("Workflow saved:", saved.name);

    const workflows = await getUserWorkflows(userId);
    console.log("User workflow count:", workflows.length);

    const retrieved = await getWorkflowById(userId, saved._id);
    console.log("Workflow retrieved:", retrieved?.name);

    const unauthorized = await getWorkflowById(
      anotherUserId,
      saved._id
    );
    console.log("Other user access blocked:", unauthorized === null);

    // Remove only the workflow created by this test.
    await saved.deleteOne();
    console.log("Test workflow cleaned up.");
  } catch (error) {
    console.error("Persistence test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
