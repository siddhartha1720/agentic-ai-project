
import assert from "node:assert/strict";
import {
  executeWorkflow,
} from "../workflows/workflowExecutor.js";

const protectedActions = [
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

for (const action of protectedActions) {
  const workflow = {
    name: "Protected Action Test",
    description: "Verify mandatory approval pause",
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

  let capturedAction = null;
  let capturedState = null;

  const result = await executeWorkflow(
    workflow,
    "Test input",
    async (state, proposedAction) => {
      capturedAction = proposedAction;
      capturedState = state;
    },
    "test-user-id"
  );

  assert.equal(result.status, "approval_required");
  assert.equal(result.currentNode, "action");

  assert.deepEqual(capturedAction, action);
  assert.equal(capturedState.currentNodeId, "action");

  assert.equal(
    result.history.some(
      (step) => step.nodeId === "action"
    ),
    false
  );

  console.log(
    `PASS: ${action.toolId} paused before execution`
  );
}

console.log("ALL AUTO-APPROVAL TESTS PASSED");
