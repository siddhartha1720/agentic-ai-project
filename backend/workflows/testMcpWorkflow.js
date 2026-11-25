
import "dotenv/config";
import { executeWorkflow } from "./workflowExecutor.js";
import { closeMCPAdapter } from "../mcp/langgraph-mcp.js";

const workflow = {
  name: "MCP Current Time Test",
  description: "Test MCP tool execution inside a workflow",
  nodes: [
    {
      id: "start",
      type: "start",
      name: "Start",
      config: {},
    },
    {
      id: "time",
      type: "tool_action",
      name: "Get Current Time",
      config: {
        toolId: "get_current_time",
      },
    },
    {
      id: "end",
      type: "end",
      name: "End",
      config: {},
    },
  ],
  edges: [
    { source: "start", target: "time" },
    { source: "time", target: "end" },
  ],
};

try {
  const result = await executeWorkflow(workflow, "");

  console.log("Status:", result.status);
  console.log("Output:", result.output);
  console.log(
    "Path:",
    result.history.map((step) => step.nodeId).join(" → ")
  );

  if (
    result.status !== "completed" ||
    result.history.length !== 3 ||
    !Number.isFinite(Date.parse(result.output))
  ) {
    throw new Error("MCP workflow test failed.");
  }

  console.log("MCP WORKFLOW TEST PASSED");
} catch (error) {
  console.error("TEST FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await closeMCPAdapter();
}
