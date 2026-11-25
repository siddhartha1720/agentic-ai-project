
import { ChatGroq } from "@langchain/groq";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

import { validateWorkflow } from "./workflowSchema.js";
import { WORKFLOW_EXECUTABLE_TOOL_IDS } from "../constants/agentCapabilities.js";

const ALLOWED_TOOL_IDS = WORKFLOW_EXECUTABLE_TOOL_IDS;

const SYSTEM_PROMPT = `
You are a workflow generator for AutoMate AI.

Convert user requirements into a structured workflow JSON.

Return ONLY valid JSON with:
{
  "name": "Workflow name",
  "description": "What the workflow does",
  "nodes": [
    {
      "id": "unique_id",
      "type": "start | ai_task | condition | approval | tool_action | end",
      "name": "Node name",
      "config": {}
    }
  ],
  "edges": [
    {
      "source": "node_id",
      "target": "node_id",
      "condition": "true or false (only for conditional edges)"
    }
  ]
}

Rules:
1. Include exactly one start node and one end node.
2. Every node must have a unique ID.
3. Connect nodes using valid edges.
4. Use ONLY supported tools: ${ALLOWED_TOOL_IDS.join(", ")}.
5. For ai_task nodes, config must include a "prompt" field.
6. For tool_action nodes, config must include a "toolId" field.
7. Before send_email, create_calendar_event or publish_instagram_image,
   include an approval node.
8. Do not invent integrations or unsupported capabilities.
9. Do not generate JavaScript code.
10. Keep workflows small, clear and logically connected.
11. If the request cannot be fulfilled with available capabilities,
    generate only supported steps and explain limitations in the description.
    13. For get_current_time tool actions, use config:
    {"toolId":"get_current_time","args":{}}

14. For list_emails tool actions, use config:
    {"toolId":"list_emails","args":{"query":"in:inbox","maxResults":5}}

15. Never generate email-sending, calendar-writing,
    Instagram-publishing or other unavailable tool actions.

16. Do not include authToken or credentials in workflow JSON.
    The backend supplies authentication during execution.
`;

function parseWorkflowJson(raw) {
  if (typeof raw !== "string") {
    throw new Error("Invalid AI response.");
  }

  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  return JSON.parse(cleaned);
}

export async function generateWorkflow(prompt) {
  if (
    typeof prompt !== "string" ||
    prompt.trim().length < 12 ||
    prompt.trim().length > 2000
  ) {
    throw new Error("Prompt must contain 12 to 2000 characters.");
  }

  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    temperature: 0.2,
  });

  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(prompt.trim()),
  ]);

  const parsed = parseWorkflowJson(response.content);

  const validated = validateWorkflow(parsed);

  if (!validated.success) {
    throw new Error(
      "AI generated an invalid workflow: " +
      validated.error.issues.map((i) => i.message).join("; ")
    );
  }

  return validated.data;
}
