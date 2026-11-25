import { z } from "zod";

import {
  WORKFLOW_EXECUTABLE_TOOL_IDS,
  APPROVAL_REQUIRED_TOOL_IDS,
} from "../constants/agentCapabilities.js";


export const NODE_TYPES = [
  "start",
  "ai_task",
  "condition",
  "approval",
  "tool_action",
  "end",
];

const nodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(NODE_TYPES),
  name: z.string().min(1).max(100),
  config: z.record(z.string(), z.unknown()).default({}),
});

const edgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  condition: z.enum(["true", "false"]).optional(),
});

export const workflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  nodes: z.array(nodeSchema).min(2).max(30),
  edges: z.array(edgeSchema),
}).superRefine((workflow, ctx) => {
  const ids = workflow.nodes.map((node) => node.id);
  const idSet = new Set(ids);

  if (ids.length !== idSet.size) {
    ctx.addIssue({
      code: "custom",
      message: "Duplicate node IDs are not allowed.",
    });
  }

  const starts = workflow.nodes.filter((node) => node.type === "start");
  const ends = workflow.nodes.filter((node) => node.type === "end");

  if (starts.length !== 1 || ends.length !== 1) {
    ctx.addIssue({
      code: "custom",
      message: "Workflow must have exactly one start and one end node.",
    });
  }

  for (const edge of workflow.edges) {
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) {
      ctx.addIssue({
        code: "custom",
        message: "Every edge must reference existing nodes.",
      });
    }
  }

  for (const node of workflow.nodes) {
    if (
      node.type === "tool_action" &&
     !(
  WORKFLOW_EXECUTABLE_TOOL_IDS.includes(node.config.toolId) ||
  ["send_email", "create_calendar_event"].includes(
    node.config.toolId
  )
)
    ) {
      ctx.addIssue({
        code: "custom",
        message: `Unsupported tool: ${node.config.toolId}`,
      });
    }
  }
});

export const validateWorkflow = (data) =>
  workflowSchema.safeParse(data);