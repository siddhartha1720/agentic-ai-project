/**
 * Single source of truth for agent generation + runtime compatibility.
 * Keep tool IDs aligned with MCP tools exposed via agentGraph.service.js.
 */

export const SUPPORTED_MODELS = Object.freeze([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
]);

export const DEFAULT_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_PROVIDER = "groq";
export const DEFAULT_TEMPERATURE = 0.7;

export const PROMPT_MIN_LENGTH = 12;
export const PROMPT_MAX_LENGTH = 2000;

export const AGENT_FIELD_LIMITS = Object.freeze({
  name: 100,
  description: 500,
  instructions: 12000,
});

/** Tools the platform can actually wire into an agent. */
export const SUPPORTED_TOOLS = Object.freeze([
  {
    id: "get_current_time",
    description:
      "Get the current date and time (UTC ISO). Useful for relative dates.",
    integrations: [],
    requiresApproval: false,
    keywords: ["time", "date", "today", "tomorrow", "schedule", "timezone"],
  },
  {
    id: "list_emails",
    description:
      "Search or list emails from the user's connected Gmail account.",
    integrations: ["gmail"],
    requiresApproval: false,
    keywords: ["email", "gmail", "inbox", "unread", "mail", "recruit", "hr"],
  },
  {
    id: "read_email",
    description: "Read the full content of a specific Gmail message.",
    integrations: ["gmail"],
    requiresApproval: false,
    keywords: ["email", "gmail", "read", "mail", "thread", "recruit", "hr"],
  },
  {
    id: "send_email",
    description:
      "Send an email via the user's Gmail. Requires explicit user approval.",
    integrations: ["gmail"],
    requiresApproval: true,
    keywords: [
      "email",
      "gmail",
      "send",
      "draft",
      "mail",
      "interview",
      "recruit",
      "hr",
    ],
  },
  {
    id: "list_calendar_events",
    description: "List events from the user's primary Google Calendar.",
    integrations: ["google_calendar"],
    requiresApproval: false,
    keywords: ["calendar", "meeting", "schedule", "interview", "availability"],
  },
  {
    id: "create_calendar_event",
    description:
      "Create a Google Calendar event. Requires explicit user approval.",
    integrations: ["google_calendar"],
    requiresApproval: true,
    keywords: [
      "calendar",
      "meeting",
      "schedule",
      "interview",
      "book",
      "appoint",
    ],
  },
  {
    id: "analyze_image",
    description: "Analyze an image with vision (describe, OCR, explain).",
    integrations: [],
    requiresApproval: false,
    keywords: ["image", "photo", "screenshot", "vision", "analyze", "ocr"],
  },
  {
    id: "publish_instagram_image",
    description:
      "Publish an image to Instagram. Requires explicit user approval.",
    integrations: ["instagram"],
    requiresApproval: true,
    keywords: ["instagram", "insta", "post", "publish", "social", "caption"],
  },
]);

export const SUPPORTED_TOOL_IDS = Object.freeze(
  SUPPORTED_TOOLS.map((tool) => tool.id)
);

export const APPROVAL_REQUIRED_TOOL_IDS = Object.freeze(
  SUPPORTED_TOOLS.filter((tool) => tool.requiresApproval).map((tool) => tool.id)
);

export const getToolCatalogForPrompt = () =>
  SUPPORTED_TOOLS.map(
    (tool) =>
      `- ${tool.id}: ${tool.description}` +
      (tool.requiresApproval ? " [approval required]" : "") +
      (tool.integrations.length
        ? ` [integrations: ${tool.integrations.join(", ")}]`
        : "")
  ).join("\n");

export const getIntegrationsForTools = (toolIds = []) => {
  const integrations = new Set();

  for (const tool of SUPPORTED_TOOLS) {
    if (toolIds.includes(tool.id)) {
      for (const integration of tool.integrations) {
        integrations.add(integration);
      }
    }
  }

  return [...integrations];
};

export const getApprovalRequiredTools = (toolIds = []) =>
  toolIds.filter((id) => APPROVAL_REQUIRED_TOOL_IDS.includes(id));

/**
 * Tools currently enabled for workflow execution.
 * Expand only after implementing and testing each tool.
 */
export const WORKFLOW_EXECUTABLE_TOOL_IDS = Object.freeze([
  "get_current_time",
  "list_emails",
]);
