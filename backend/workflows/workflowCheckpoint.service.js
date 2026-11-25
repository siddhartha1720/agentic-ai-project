import WorkflowRun from "../models/workflowRun.model.js";
import {
  validateApprovalAction,
  hashApprovalAction,
} from "./approvalAction.js";


export async function saveWorkflowCheckpoint(
  runId,
  state,
  proposedAction = null
) {
  if (!runId) {
    throw new Error("Workflow run ID required.");
  }

  const action = proposedAction
    ? validateApprovalAction(
        proposedAction.toolId,
        proposedAction.args
      )
    : null;

  const actionHash = action
    ? hashApprovalAction(action)
    : null;

  const updated = await WorkflowRun.findOneAndUpdate(
    {
      _id: runId,
      status: "running",
    },
    {
$set: {
  status: "approval_required",
  currentNodeId: state.currentNodeId,
  currentOutput: state.currentOutput,
  history: state.history,
  steps: state.steps,

  workflowSnapshot: state.workflow,

  resumeState: {
    currentNodeId: state.currentNodeId,
    currentOutput: state.currentOutput,
    steps: state.steps,
    history: state.history,
  },

  // These fields belong to approval, NOT resumeState.
  "approval.toolId": action?.toolId ?? null,
  "approval.args": action?.args ?? null,
  "approval.actionHash": actionHash,
  "approval.status": "pending",
  "approval.requestedAt": new Date(),
  "approval.decidedAt": null,
},

    },
   { returnDocument: "after" }
  );

  if (!updated) {
    throw new Error("Unable to save workflow checkpoint.");
  }

  return updated;
}
export async function getPendingWorkflowCheckpoint(runId, userId) {
  const run = await WorkflowRun.findOne({
    _id: runId,
    userId,
    status: "approval_required",
    "approval.status": "pending",
  }).lean();

  if (!run) {
    return null;
  }

  if (!run.workflowSnapshot || !run.resumeState) {
    throw new Error("Workflow checkpoint data is missing.");
  }

  let proposedAction = null;

  if (run.approval?.toolId) {
    if (!run.approval.args || !run.approval.actionHash) {
      throw new Error("Approval action data is incomplete.");
    }

    proposedAction = validateApprovalAction(
      run.approval.toolId,
      run.approval.args
    );

    const calculatedHash = hashApprovalAction(proposedAction);

    if (calculatedHash !== run.approval.actionHash) {
      throw new Error("Approval action integrity check failed.");
    }
  }
return {
  runId: run._id,
  workflow: run.workflowSnapshot,
  state: run.resumeState,
  proposedAction,
};
}

export async function claimWorkflowApproval(runId, userId, approved) {
  if (typeof approved !== "boolean") {
    throw new Error("Approval decision must be true or false.");
  }

  // Verify the pending action before claiming approval.
  const checkpoint = await getPendingWorkflowCheckpoint(
    runId,
    userId
  );

  if (!checkpoint) {
    throw new Error(
      "Pending approval not found or already processed."
    );
  }

  if (checkpoint.proposedAction) {
    const action = checkpoint.proposedAction;

    if (
      !action.toolId ||
      !action.args ||
      !hashApprovalAction(action)
    ) {
      throw new Error("Invalid proposed action.");
    }
  }


  const run = await WorkflowRun.findOneAndUpdate(
    {
      _id: runId,
      userId,
      status: "approval_required",
      "approval.status": "pending",
      "approval.actionHash": checkpoint.proposedAction
  ? hashApprovalAction(checkpoint.proposedAction)
  : null,
      workflowSnapshot: { $ne: null },
      resumeState: { $ne: null },
    },
    {
      $set: {
        status: approved ? "running" : "rejected",
        "approval.status": approved ? "approved" : "rejected",
        "approval.decidedAt": new Date(),
        ...(approved ? {} : { completedAt: new Date() }),
      },
    },
   { returnDocument: "after" }
  ).lean();

  if (!run) {
    throw new Error(
      "Pending approval not found, unauthorized, or already processed."
    );
  }

  return run;
}

export async function claimApprovedActionExecution(
  runId,
  userId,
  expectedActionHash
) {
  if (
    !runId ||
    !userId ||
    typeof expectedActionHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(expectedActionHash)
  ) {
    throw new Error("Invalid execution claim parameters.");
  }

  // Only one request can change execution status
  // from pending/unclaimed to executing.
  const run = await WorkflowRun.findOneAndUpdate(
    {
      _id: runId,
      userId,
      status: "running",
      "approval.status": "approved",
      "approval.toolId": {
        $in: ["send_email", "create_calendar_event"],
      },
      "approval.actionHash": expectedActionHash,
      "actionExecution.status": {
        $in: [null, "pending"],
      },
    },
    {
      $set: {
        "actionExecution.status": "executing",
        "actionExecution.actionHash": expectedActionHash,
        "actionExecution.startedAt": new Date(),
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!run) {
    throw new Error(
      "Action is not approved, already claimed, or unauthorized."
    );
  }

  // Verify the claimed action before returning it.
  const action = validateApprovalAction(
    run.approval.toolId,
    run.approval.args
  );

  if (hashApprovalAction(action) !== expectedActionHash) {
    // Never execute when saved arguments differ.
    await WorkflowRun.updateOne(
      {
        _id: runId,
        userId,
        "actionExecution.status": "executing",
        "actionExecution.actionHash": expectedActionHash,
      },
      {
        $set: {
          "actionExecution.status": "failed",
        },
      }
    );

    throw new Error("Approved action integrity check failed.");
  }

  return {
    runId: run._id,
    action,
  };
}

export async function recordApprovedActionResult(
  runId,
  userId,
  actionHash,
  status,
  result = null
) {
  if (!["completed", "uncertain", "failed"].includes(status)) {
    throw new Error("Invalid action execution status.");
  }

  if (
    typeof actionHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(actionHash)
  ) {
    throw new Error("Invalid action hash.");
  }

  const updated = await WorkflowRun.findOneAndUpdate(
    {
      _id: runId,
      userId,
      "approval.status": "approved",
      "approval.actionHash": actionHash,
      "actionExecution.status": "executing",
      "actionExecution.actionHash": actionHash,
    },
    {
      $set: {
        "actionExecution.status": status,
        "actionExecution.completedAt": new Date(),
        "actionExecution.result": result,
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!updated) {
    throw new Error(
      "Execution result cannot be recorded or was already finalized."
    );
  }

  return updated;
}
