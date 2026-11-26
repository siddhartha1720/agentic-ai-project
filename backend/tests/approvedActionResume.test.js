
import assert from "node:assert/strict";
import {
  executeWorkflow,
  resumeWorkflowFromCheckpoint,
} from "../workflows/workflowExecutor.js";
import {
  hashApprovalAction,
} from "../workflows/approvalAction.js";

const actions = [
  {
    toolId: "send_email",
    args: {
      to: "student@example.com",
      subject: "Class Reminder",
      body: "Your class starts at 5 PM.",
    },
  },
  {
    toolId: "create_calendar_event",
    args: {
      summary: "Demo Class",
      startDateTime: "2026-12-01T17:00:00+05:30",
      endDateTime: "2026-12-01T18:00:00+05:30",
      timeZone: "Asia/Kolkata",
    },
  },
];

for (const action of actions) {
  const workflow = {
    name: "Approved Action Resume Test",
    description: "Mock approved action",
    nodes: [
      {
        id: "start",
        type: "start",
        name: "Start",
        config: {},
      },
      {
        id: "action",
        type: "tool_action",
        name: "Protected Action",
        config: action,
      },
      {
        id: "end",
        type: "end",
        name: "End",
        config: {},
      },
    ],
    edges: [
      { source: "start", target: "action" },
      { source: "action", target: "end" },
    ],
  };

  let checkpoint = null;
  let savedAction = null;

  const paused = await executeWorkflow(
    workflow,
    "Test input",
    async (state, proposedAction) => {
      checkpoint = structuredClone({
        currentNodeId: state.currentNodeId,
        currentOutput: state.currentOutput,
        history: state.history,
        steps: state.steps,
      });

      savedAction = structuredClone(proposedAction);
    },
    "test-user"
  );

  assert.equal(paused.status, "approval_required");
  assert.ok(checkpoint);
  assert.deepEqual(savedAction, action);

  const approvedHash = hashApprovalAction(savedAction);
  let executionCount = 0;

  const result = await resumeWorkflowFromCheckpoint(
    workflow,
    checkpoint,
    true,
    "test-user",
    async (proposedAction, userId) => {
      assert.equal(userId, "test-user");

      assert.equal(
        hashApprovalAction(proposedAction),
        approvedHash
      );

      executionCount++;

      return {
        output: "MOCK_ACTION_EXECUTED",
      };
    }
  );

  assert.equal(result.status, "completed");
  assert.equal(executionCount, 1);

  assert.deepEqual(
    result.history.map((step) => step.nodeId),
    ["start", "action", "end"]
  );

  console.log(
    `PASS: ${action.toolId} resumed with mock execution`
  );

  await assert.rejects(
    () =>
      resumeWorkflowFromCheckpoint(
        workflow,
        checkpoint,
        true,
        "test-user"
      ),
    /handler required/i
  );

  console.log(
    `PASS: ${action.toolId} blocked without handler`
  );
}

console.log("ALL APPROVED ACTION RESUME TESTS PASSED");
