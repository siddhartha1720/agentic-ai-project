export const SUPPORTED_MODELS = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    hint: "Higher reasoning quality",
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    hint: "Faster responses",
  },
];

export const DEFAULT_MODEL = "openai/gpt-oss-120b";

export const AGENT_FIELD_LIMITS = {
  name: 100,
  description: 500,
  instructions: 12000,
  promptMin: 12,
  promptMax: 2000,
};

export const SUPPORTED_TOOLS = [
  {
    id: "get_current_time",
    name: "Get Current Time",
    description: "Resolve current UTC ISO date and time for relative dates.",
    integrations: [],
    requiresApproval: false,
  },
  {
    id: "list_emails",
    name: "List & Search Emails",
    description: "Search or list emails from the connected Gmail inbox.",
    integrations: ["gmail"],
    requiresApproval: false,
  },
  {
    id: "read_email",
    name: "Read Email",
    description: "Read the full content of a specific Gmail message.",
    integrations: ["gmail"],
    requiresApproval: false,
  },
  {
    id: "send_email",
    name: "Send Email",
    description: "Draft and send an email via Gmail (requires approval).",
    integrations: ["gmail"],
    requiresApproval: true,
  },
  {
    id: "list_calendar_events",
    name: "List Calendar Events",
    description: "List upcoming events from Google Calendar.",
    integrations: ["google_calendar"],
    requiresApproval: false,
  },
  {
    id: "create_calendar_event",
    name: "Create Calendar Event",
    description: "Schedule a Google Calendar event (requires approval).",
    integrations: ["google_calendar"],
    requiresApproval: true,
  },
  {
    id: "analyze_image",
    name: "Analyze Image",
    description: "Describe, inspect, or extract text from images with vision.",
    integrations: [],
    requiresApproval: false,
  },
  {
    id: "publish_instagram_image",
    name: "Publish to Instagram",
    description: "Publish an image with caption to Instagram (requires approval).",
    integrations: ["instagram"],
    requiresApproval: true,
  },
];

export const WORKFLOW_NODE_META = {
  start: {
    label: "Start",
    description: "Entry point receiving optional workflow input.",
    accent: "emerald",
  },
  ai_task: {
    label: "AI Task",
    description: "Runs an LLM prompt using the previous step output.",
    accent: "violet",
  },
  condition: {
    label: "Condition",
    description: "Routes execution along true/false branches.",
    accent: "amber",
  },
  approval: {
    label: "Approval",
    description: "Pauses the workflow until a human approves or rejects.",
    accent: "orange",
  },
  tool_action: {
    label: "Tool Action",
    description: "Executes a platform integration tool.",
    accent: "sky",
  },
  end: {
    label: "End",
    description: "Completes the workflow and returns final output.",
    accent: "zinc",
  },
};

export const WORKFLOW_TOOLS = [
  {
    id: "get_current_time",
    label: "Get Current Time",
    requiresApproval: false,
    defaultArgs: {},
  },
  {
    id: "list_emails",
    label: "List Emails (Gmail)",
    requiresApproval: false,
    defaultArgs: { query: "in:inbox", maxResults: 5 },
  },
  {
    id: "send_email",
    label: "Send Email (Gmail)",
    requiresApproval: true,
    defaultArgs: { to: "", subject: "", body: "" },
  },
  {
    id: "create_calendar_event",
    label: "Create Calendar Event",
    requiresApproval: true,
    defaultArgs: {
      summary: "",
      description: "",
      startDateTime: "",
      endDateTime: "",
      timeZone: "Asia/Kolkata",
    },
  },
];

export const INTEGRATION_LABELS = {
  gmail: "Gmail",
  google_calendar: "Google Calendar",
  instagram: "Instagram",
};
