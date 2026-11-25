
import {
  saveWorkflow,
  getUserWorkflows,
  getWorkflowById,
  claimApprovedActionExecution,
recordApprovedActionResult,
} from "../workflows/workflowPersistence.service.js";
import {
  executeApprovedWorkflowTool,
} from "../workflows/workflowToolExecutor.js";

import {
  hashApprovalAction,
} from "../workflows/approvalAction.js";
import { generateWorkflow } from "../workflows/workflowGenerator.service.js";

import {
  executeWorkflow,
  resumeWorkflowFromCheckpoint,
} from "../workflows/workflowExecutor.js";

import WorkflowRun from "../models/workflowRun.model.js";

import {
  saveWorkflowCheckpoint,
  getPendingWorkflowCheckpoint,
  claimWorkflowApproval,
} from "../workflows/workflowCheckpoint.service.js";

// Generate workflow draft using AI
export const generateWorkflowDraft = async (req, res) => {
  try {
    const workflow = await generateWorkflow(req.body.prompt);

    return res.status(200).json({
      success: true,
      workflow,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Save workflow
export const createWorkflow = async (req, res) => {
  try {
    const workflow = await saveWorkflow(req.user._id, req.body);

    return res.status(201).json({
      success: true,
      workflow,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all workflows for authenticated user
export const listWorkflows = async (req, res) => {
  try {
    const workflows = await getUserWorkflows(req.user._id);

    return res.status(200).json({
      success: true,
      workflows,
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve workflows.",
    });
  }
};

// Get workflow by ID
export const getWorkflow = async (req, res) => {
  try {
    const workflow = await getWorkflowById(
      req.user._id,
      req.params.id
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: "Workflow not found.",
      });
    }

    return res.status(200).json({
      success: true,
      workflow,
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid workflow ID.",
    });
  }
};

// Execute workflow
export const runWorkflow = async (req, res) => {
  let run = null;

  try {
    const workflow = await getWorkflowById(
      req.user._id,
      req.params.id
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: "Workflow not found.",
      });
    }

    // Create execution record in MongoDB
    run = await WorkflowRun.create({
      userId: req.user._id,
      workflowId: workflow._id,
      status: "running",
      history: [],
      steps: 0,
    });

    // Execute workflow with authenticated user context
    
    // Execute workflow with authenticated user context
    const result = await executeWorkflow(
      workflow,
      req.body?.input ?? "",
      async (state, proposedAction = null) => {
        await saveWorkflowCheckpoint(
          run._id,
          state,
          proposedAction
        );
      },
      req.user._id
    );


  if (
      !["completed", "approval_required", "rejected"].includes(
        result.status
      )
    ) {
      throw new Error("Unexpected workflow execution status.");
    }

    // Save execution result
    run.status = result.status;
    run.history = result.history ?? [];
    run.steps = run.history.length;
    run.currentNodeId = result.currentNode ?? null;
    run.currentOutput =
      result.output ?? result.proposedOutput ?? null;

    if (["completed", "rejected"].includes(result.status)) {
      run.completedAt = new Date();
    }

    await run.save();

    return res
      .status(result.status === "approval_required" ? 202 : 200)
      .json({
        success: true,
        runId: run._id,
        result,
      });
  } catch (error) {
    console.error("Workflow execution failed:", error.message);

    if (run) {
      try {
        run.status = "failed";
        run.error = "Workflow execution failed.";
        run.completedAt = new Date();

        await run.save();
      } catch (saveError) {
        console.error(
          "Failed to save run:",
          saveError.message
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Workflow execution failed.",
      ...(run ? { runId: run._id } : {}),
    });
  }
};

// Get workflow execution history
export const getWorkflowRuns = async (req, res) => {
  try {
    const workflow = await getWorkflowById(
      req.user._id,
      req.params.id
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: "Workflow not found.",
      });
    }

    const runs = await WorkflowRun.find({
      userId: req.user._id,
      workflowId: workflow._id,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select(
        "_id status steps currentNodeId createdAt completedAt"
      )
      .lean();

    return res.status(200).json({
      success: true,
      runs,
    });
  } catch (error) {
    console.error(
      "Get workflow runs failed:",
      error.message
    );

    return res.status(400).json({
      success: false,
      message: "Unable to retrieve workflow runs.",
    });
  }
};

// Resume workflow after approval
export const resumeWorkflowRun = async (req, res) => {
  const { runId } = req.params;
  const { approved } = req.body ?? {};

  let approvalClaimed = false;

  if (typeof approved !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "approved must be true or false.",
    });
  }

  try {
    const checkpoint = await getPendingWorkflowCheckpoint(
      runId,
      req.user._id
    );

    if (!checkpoint) {
      return res.status(404).json({
        success: false,
        message: "Pending approval not found.",
      });
    }

    // Atomically claim approval
    const claimed = await claimWorkflowApproval(
      runId,
      req.user._id,
      approved
    );

    approvalClaimed = true;

    if (!approved) {
      return res.status(200).json({
        success: true,
        runId: claimed._id,
        status: "rejected",
      });
    }

    // Resume with authenticated user context
   
    const result = await resumeWorkflowFromCheckpoint(
      checkpoint.workflow,
      checkpoint.state,
      true,
      req.user._id,

      async (proposedAction, userId) => {
        // The action being resumed must match the exact
        // action originally saved for approval.
        if (!checkpoint.proposedAction) {
          throw new Error(
            "Approved action snapshot is missing."
          );
        }

        const expectedHash = hashApprovalAction(
          checkpoint.proposedAction
        );

        if (
          hashApprovalAction(proposedAction) !== expectedHash
        ) {
          throw new Error(
            "Workflow action differs from approved action."
          );
        }

        // Atomically allow only one execution attempt.
        const claimed = await claimApprovedActionExecution(
          runId,
          userId,
          expectedHash
        );

        let toolResult;

        try {
          // Execute the action returned by the trusted
          // MongoDB claim, not client-provided arguments.
          toolResult = await executeApprovedWorkflowTool(
            claimed.action,
            userId
          );
        } catch (error) {
          // External outcome may be unknown after a failure.
          // Do not automatically retry the action.
          await recordApprovedActionResult(
            runId,
            userId,
            expectedHash,
            "uncertain",
            { message: "External execution outcome unknown." }
          );

          throw error;
        }

        await recordApprovedActionResult(
          runId,
          userId,
          expectedHash,
          "completed",
          { output: toolResult.output }
        );

        return toolResult;
      }
    );


    await WorkflowRun.updateOne(
      {
        _id: runId,
        userId: req.user._id,
        status: "running",
      },
      {
        $set: {
          status: result.status,
          history: result.history,
          steps: result.history.length,
          currentOutput: result.output ?? null,
          currentNodeId: result.currentNode ?? null,
          ...(result.status === "completed"
            ? { completedAt: new Date() }
            : {}),
        },
      }
    );

    return res.status(200).json({
      success: true,
      runId,
      result,
    });
  } catch (error) {
    console.error("Workflow resume failed:", error.message);

    if (approvalClaimed && approved === true) {
      try {
        await WorkflowRun.updateOne(
          {
            _id: runId,
            userId: req.user._id,
            status: "running",
          },
          {
            $set: {
              status: "failed",
              error: "Workflow resume execution failed.",
              completedAt: new Date(),
            },
          }
        );
      } catch (saveError) {
        console.error(
          "Failed to persist workflow resume failure:",
          saveError.message
        );
      }
    }

    return res
      .status(approvalClaimed ? 500 : 409)
      .json({
        success: false,
        message: "Unable to resume workflow.",
      });
  }
};
