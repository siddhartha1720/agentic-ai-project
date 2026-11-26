
import assert from "node:assert/strict";
import mongoose from "mongoose";
import WorkflowRun from "../models/workflowRun.model.js";
import {
  saveWorkflowCheckpoint,
  claimWorkflowApproval,
  claimApprovedActionExecution,
  recordApprovedActionResult,
} from "../workflows/workflowCheckpoint.service.js";
import { hashApprovalAction } from "../workflows/approvalAction.js";

const uri = process.env.MONGODB_URI;
const testDbName = "automate_ai_approval_test";

if (!uri) throw new Error("MONGODB_URI missing");

if (process.env.MONGODB_DB_NAME === testDbName) {
  throw new Error("Test DB must differ from app DB");
}

const userId = new mongoose.Types.ObjectId();
const workflowId = new mongoose.Types.ObjectId();

const action = {
  toolId: "send_email",
  args: {
    to: "student@example.com",
    subject: "Test",
    body: "Concurrency test — do not send",
  },
};

const workflow = {
  name: "Concurrency Test",
  nodes: [
    { id: "start", type: "start", name: "Start", config: {} },
    { id: "approve", type: "approval", name: "Approve", config: {} },
    { id: "end", type: "end", name: "End", config: {} },
  ],
  edges: [
    { source: "start", target: "approve" },
    { source: "approve", target: "end" },
  ],
};

let runId;

try {
  await mongoose.connect(uri, { dbName: testDbName });

  const run = await WorkflowRun.create({
    userId,
    workflowId,
    status: "running",
  });

  runId = run._id;

  await saveWorkflowCheckpoint(
    runId,
    {
      workflow,
      currentNodeId: "approve",
      currentOutput: "",
      history: [],
      steps: 1,
    },
    action
  );

  await claimWorkflowApproval(runId, userId, true);

  const hash = hashApprovalAction(action);

  const attempts = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      claimApprovedActionExecution(runId, userId, hash)
    )
  );

  const successes = attempts.filter(
    (result) => result.status === "fulfilled"
  );

  const rejected = attempts.filter(
    (result) => result.status === "rejected"
  );

  assert.equal(successes.length, 1);
  assert.equal(rejected.length, 9);

  const stored = await WorkflowRun.findById(runId).lean();

  assert.equal(stored.actionExecution.status, "executing");
  assert.equal(stored.actionExecution.actionHash, hash);

  console.log("PASS: Exactly one execution claim succeeded");
  console.log("PASS: Nine concurrent claims rejected");
  console.log("PASS: Execution claim persisted in MongoDB");

  // Record successful execution without calling Gmail.
  const finalized = await recordApprovedActionResult(
    runId,
    userId,
    hash,
    "completed",
    { mock: true, messageId: "test-message-001" }
  );

  assert.equal(
    finalized.actionExecution.status,
    "completed"
  );

  console.log("PASS: Execution result persisted");

  // The same execution cannot be finalized twice.
  await assert.rejects(
    () =>
      recordApprovedActionResult(
        runId,
        userId,
        hash,
        "completed",
        { mock: true }
      ),
    /already finalized/
  );

  console.log("PASS: Duplicate result finalization blocked");

  console.log("ALL CONCURRENCY TESTS PASSED");
} finally {
  if (runId) {
    await WorkflowRun.deleteOne({ _id: runId }).catch(() => {});
  }

  await mongoose.disconnect();
}
