
import assert from "node:assert/strict";
import { validateWorkflow } from "../workflows/workflowSchema.js";
import { executeWorkflowTool } from "../workflows/workflowToolExecutor.js";

const protectedTools = [
  "send_email",
  "create_calendar_event",
  "publish_instagram_image",
];

for (const toolId of protectedTools) {
  const workflow = {
    name: "Security Test",
    nodes: [
      { id: "start", type: "start", name: "Start", config: {} },
      {
        id: "action",
        type: "tool_action",
        name: "Protected Action",
        config: { toolId },
      },
      { id: "end", type: "end", name: "End", config: {} },
    ],
    edges: [
      { source: "start", target: "action" },
      { source: "action", target: "end" },
    ],
  };

  const schemaResult = validateWorkflow(workflow);

  // Gmail and Calendar writes may be defined in workflows,
  // but Instagram publishing remains unsupported.
  assert.equal(
    schemaResult.success,
    toolId !== "publish_instagram_image"
  );

  // Direct execution must remain blocked.
  await assert.rejects(
    () => executeWorkflowTool(toolId, {}),
    /not allowed/i
  );

  console.log(`PASS: ${toolId} cannot execute directly`);
}

console.log("ALL WRITE SAFETY TESTS PASSED");
