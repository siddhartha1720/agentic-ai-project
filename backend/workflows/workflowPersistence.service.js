
import mongoose from "mongoose";
import Workflow from "../models/workflow.model.js";
import { validateWorkflow } from "./workflowSchema.js";

// Save a validated workflow for the logged-in user.
export async function saveWorkflow(userId, workflowData) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Valid user ID required.");
  }

  const validated = validateWorkflow(workflowData);

  if (!validated.success) {
    throw new Error(
      "Invalid workflow: " +
        validated.error.issues
          .map((issue) => issue.message)
          .join("; ")
    );
  }

  const workflow = await Workflow.create({
    userId,
    ...validated.data,
  });

  return workflow;
}

// Get workflows belonging to one user.
export async function getUserWorkflows(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Valid user ID required.");
  }

  return Workflow.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
}

// Get one workflow with ownership verification.
export async function getWorkflowById(userId, workflowId) {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(workflowId)
  ) {
    throw new Error("Invalid user or workflow ID.");
  }

  return Workflow.findOne({
    _id: workflowId,
    userId,
  }).lean();
}
