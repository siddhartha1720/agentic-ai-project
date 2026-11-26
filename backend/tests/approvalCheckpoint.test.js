
import assert from "node:assert/strict";
import mongoose from "mongoose";
import WorkflowRun from "../models/workflowRun.model.js";
import {
  saveWorkflowCheckpoint,
  getPendingWorkflowCheckpoint,
  claimWorkflowApproval,
} from "../workflows/workflowCheckpoint.service.js";
import { hashApprovalAction } from "../workflows/approvalAction.js";




const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI environment variable is required.");
}

// Always use a separate database for integration tests.
const testDbName = "automate_ai_approval_test";

if (process.env.MONGODB_DB_NAME === testDbName) {
  throw new Error(
    "Test database must be different from the application database."
  );
}

await mongoose.connect(mongoUri, {
  dbName: testDbName,
});


const userId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();
const workflowId = new mongoose.Types.ObjectId();

const workflow = {
  name: "Approval Security Test",
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

const proposedAction = {
  toolId: "send_email",
  args: {
    to: "student@example.com",
    subject: "Class Reminder",
    body: "Your class starts at 5 PM.",
  },
};

const run = await WorkflowRun.create({
  userId,
  workflowId,
  status: "running",
});

try {
  await saveWorkflowCheckpoint(
    run._id,
    {
      workflow,
      currentNodeId: "approve",
      currentOutput: "Draft ready",
      history: [],
      steps: 1,
    },
    proposedAction
  );

  const stored = await WorkflowRun.findById(run._id).lean();

  assert.equal(stored.approval.toolId, "send_email");
  assert.deepEqual(stored.approval.args, proposedAction.args);
  assert.equal(
    stored.approval.actionHash,
    hashApprovalAction(proposedAction)
  );
  console.log("PASS: Exact action stored in MongoDB");

  const checkpoint = await getPendingWorkflowCheckpoint(
    run._id,
    userId
  );

  assert.deepEqual(checkpoint.proposedAction, proposedAction);
  console.log("PASS: Checkpoint action retrieved and verified");

  const unauthorized = await getPendingWorkflowCheckpoint(
    run._id,
    otherUserId
  );

  assert.equal(unauthorized, null);
  console.log("PASS: Other user cannot read checkpoint");

  await assert.rejects(
    () => claimWorkflowApproval(run._id, otherUserId, true),
    /Pending approval not found/
  );
  console.log("PASS: Other user cannot approve");

  await WorkflowRun.updateOne(
    { _id: run._id },
    { $set: { "approval.args.body": "Tampered content" } }
  );

  await assert.rejects(
    () => getPendingWorkflowCheckpoint(run._id, userId),
    /integrity check failed/
  );
  console.log("PASS: Tampered action rejected");

  await WorkflowRun.updateOne(
    { _id: run._id },
    { $set: { "approval.args.body": proposedAction.args.body } }
  );

  const claimed = await claimWorkflowApproval(
    run._id,
    userId,
    true
  );

  assert.equal(claimed.approval.status, "approved");
  console.log("PASS: Valid approval claimed");

  await assert.rejects(
    () => claimWorkflowApproval(run._id, userId, true),
    /Pending approval not found/
  );
  console.log("PASS: Duplicate approval rejected");

  console.log("ALL APPROVAL CHECKPOINT TESTS PASSED");
} finally {
  await WorkflowRun.deleteOne({ _id: run._id });
  await mongoose.disconnect();
}
