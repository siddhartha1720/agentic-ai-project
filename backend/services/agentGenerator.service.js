import { ChatGroq } from "@langchain/groq";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

import {
  AGENT_FIELD_LIMITS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  DEFAULT_TEMPERATURE,
  PROMPT_MAX_LENGTH,
  PROMPT_MIN_LENGTH,
  SUPPORTED_MODELS,
  SUPPORTED_TOOL_IDS,
  getApprovalRequiredTools,
  getIntegrationsForTools,
  getToolCatalogForPrompt,
} from "../constants/agentCapabilities.js";

export class AgentGeneratorError extends Error {
  constructor(message, { statusCode = 500, code = "GENERATOR_ERROR", details } = {}) {
    super(message);
    this.name = "AgentGeneratorError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const GENERATOR_MODEL = DEFAULT_MODEL;

const UNSUPPORTED_CAPABILITY_PATTERNS = [
  {
    id: "resume_parsing",
    label: "Screen / parse resumes or CVs",
    pattern:
      /\b(resumes?|cvs?|curriculum\s*vitae|ats|applicant\s*tracking|screen(?:s|ing)?\s+(?:candidates?|applicants?|resumes?))\b/i,
    reason:
      "No resume/document parsing or ATS tool is available on AutoMate AI.",
  },
  {
    id: "code_execution",
    label: "Execute arbitrary code",
    pattern:
      /\b(execute\s+code|run\s+code|code\s+interpreter|sandbox|shell\s+access)\b/i,
    reason: "Agents cannot execute arbitrary code during generation or runtime via this generator.",
  },
  {
    id: "web_browsing",
    label: "Browse the live web / scrape sites",
    pattern:
      /\b(browse\s+the\s+web|web\s+browsing|web\s+scrape|scrape\s+websites?|crawl\s+the\s+web)\b/i,
    reason: "No general web browsing or scraping tool is available.",
  },
  {
    id: "crm_salesforce",
    label: "Salesforce / external CRM sync",
    pattern: /\b(salesforce|hubspot|zoho\s+crm|pipedrive)\b/i,
    reason: "No Salesforce/HubSpot/CRM integration tool is available.",
  },
  {
    id: "slack_teams",
    label: "Slack / Microsoft Teams messaging",
    pattern: /\b(slack|microsoft\s+teams|ms\s+teams)\b/i,
    reason: "No Slack or Microsoft Teams tool is available.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp messaging",
    pattern: /\b(whatsapp)\b/i,
    reason: "No WhatsApp messaging tool is available.",
  },
  {
    id: "payment_processing",
    label: "Process payments / Stripe charges",
    pattern: /\b(stripe|charge\s+cards?|process\s+payments?)\b/i,
    reason: "No payment-processing agent tool is available for generated agents.",
  },
];

const clampString = (value, max) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
};

const clampTemperature = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_TEMPERATURE;
  return Math.min(2, Math.max(0, num));
};

export const validateGeneratePrompt = (prompt) => {
  if (typeof prompt !== "string") {
    throw new AgentGeneratorError("Prompt must be a string.", {
      statusCode: 400,
      code: "INVALID_PROMPT",
    });
  }

  const trimmed = prompt.trim();

  if (!trimmed) {
    throw new AgentGeneratorError("Prompt is required.", {
      statusCode: 400,
      code: "INVALID_PROMPT",
    });
  }

  if (trimmed.length < PROMPT_MIN_LENGTH) {
    throw new AgentGeneratorError(
      `Prompt must be at least ${PROMPT_MIN_LENGTH} characters.`,
      { statusCode: 400, code: "INVALID_PROMPT" }
    );
  }

  if (trimmed.length > PROMPT_MAX_LENGTH) {
    throw new AgentGeneratorError(
      `Prompt cannot exceed ${PROMPT_MAX_LENGTH} characters.`,
      { statusCode: 400, code: "INVALID_PROMPT" }
    );
  }

  return trimmed;
};

export const detectUnsupportedRequests = (prompt) => {
  const unsupported = [];

  for (const item of UNSUPPORTED_CAPABILITY_PATTERNS) {
    if (item.pattern.test(prompt)) {
      unsupported.push({
        request: item.label,
        reason: item.reason,
        id: item.id,
      });
    }
  }

  return unsupported;
};

const extractJsonObject = (raw) => {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new AgentGeneratorError("Model returned an empty response.", {
      statusCode: 502,
      code: "MALFORMED_MODEL_RESPONSE",
    });
  }

  let text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new AgentGeneratorError("Model response did not contain JSON.", {
      statusCode: 502,
      code: "MALFORMED_MODEL_RESPONSE",
    });
  }

  text = text.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(text);
  } catch {
    throw new AgentGeneratorError("Model returned invalid JSON.", {
      statusCode: 502,
      code: "MALFORMED_MODEL_RESPONSE",
    });
  }
};

export const filterSupportedToolIds = (tools) => {
  if (!Array.isArray(tools)) return [];

  const unique = new Set();

  for (const tool of tools) {
    if (typeof tool !== "string") continue;
    const id = tool.trim();
    if (SUPPORTED_TOOL_IDS.includes(id)) {
      unique.add(id);
    }
  }

  return [...unique];
};

export const sanitizeGeneratedDraft = (parsed) => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AgentGeneratorError("Model returned an invalid agent draft.", {
      statusCode: 502,
      code: "MALFORMED_MODEL_RESPONSE",
    });
  }

  const name = clampString(parsed.name, AGENT_FIELD_LIMITS.name);
  const description = clampString(
    parsed.description,
    AGENT_FIELD_LIMITS.description
  );
  const instructions = clampString(
    parsed.instructions,
    AGENT_FIELD_LIMITS.instructions
  );

  if (!name) {
    throw new AgentGeneratorError("Generated agent name is missing.", {
      statusCode: 502,
      code: "MALFORMED_MODEL_RESPONSE",
    });
  }

  if (!instructions) {
    throw new AgentGeneratorError("Generated agent instructions are missing.", {
      statusCode: 502,
      code: "MALFORMED_MODEL_RESPONSE",
    });
  }

  let model = clampString(parsed.model, 80) || DEFAULT_MODEL;
  if (!SUPPORTED_MODELS.includes(model)) {
    model = DEFAULT_MODEL;
  }

  const tools = filterSupportedToolIds(parsed.tools);
  const temperature = clampTemperature(parsed.temperature);

  return {
    name,
    description,
    instructions,
    provider: DEFAULT_PROVIDER,
    model,
    temperature,
    tools,
  };
};

const buildMatchedCapabilities = (toolIds) => {
  const labels = {
    get_current_time: "Resolve relative dates and times",
    list_emails: "Search and list Gmail messages",
    read_email: "Read specific Gmail messages",
    send_email: "Draft and send emails (approval required)",
    list_calendar_events: "List Google Calendar events",
    create_calendar_event: "Schedule calendar events (approval required)",
    analyze_image: "Analyze images with vision",
    publish_instagram_image: "Publish Instagram images (approval required)",
  };

  return toolIds.map((id) => labels[id] || id);
};

const buildSuggestedFirstMessages = (draft, prompt) => {
  const suggestions = [];
  const tools = new Set(draft.tools);
  const lower = prompt.toLowerCase();

  if (tools.has("send_email")) {
    suggestions.push(
      lower.includes("interview")
        ? "Draft an interview invitation email for a candidate and show it for approval."
        : "Draft a professional email for my request and show it for approval before sending."
    );
  }

  if (tools.has("create_calendar_event")) {
    suggestions.push(
      "Schedule a 30-minute meeting tomorrow at 3 PM Asia/Kolkata."
    );
  }

  if (tools.has("list_emails") || tools.has("read_email")) {
    suggestions.push("Show my unread emails from the last 7 days.");
  }

  if (tools.has("list_calendar_events")) {
    suggestions.push("What meetings do I have today?");
  }

  if (tools.has("publish_instagram_image")) {
    suggestions.push(
      "Publish this image to Instagram with a short caption (I will approve first)."
    );
  }

  if (tools.has("analyze_image")) {
    suggestions.push("Describe this image and list the important visible details.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Introduce yourself and summarize what you can help me with.");
  }

  return suggestions.slice(0, 4);
};

const buildSystemPrompt = () => `
You are the AutoMate AI Agent Generator.

Your job is to convert a user's natural-language agent request into a structured agent configuration for the AutoMate platform.

You MUST:
- Return ONLY valid JSON (no markdown, no commentary).
- Use ONLY tool IDs from the catalog below.
- Never invent tools, integrations, APIs, or capabilities that are not listed.
- Keep instructions scoped to the user's legitimate request.
- Write instructions that work with AutoMate's approval flow for send_email, create_calendar_event, and publish_instagram_image (the app shows approval cards; do not ask for passwords/tokens).
- Prefer Asia/Kolkata timezone defaults for scheduling unless the user specifies otherwise.
- If the user asks for unsupported capabilities, still design the best agent possible with available tools, and omit unsupported tools.

Supported models (choose one):
${SUPPORTED_MODELS.map((m) => `- ${m}`).join("\n")}

Supported tools:
${getToolCatalogForPrompt()}

JSON schema to return:
{
  "name": "string (max 100)",
  "description": "string (max 500)",
  "instructions": "detailed system instructions string",
  "model": "one supported model id",
  "temperature": number between 0 and 2,
  "tools": ["supported tool ids only"]
}

Instructions content guidelines:
- Role and goal
- Step-by-step workflow for the use case
- When to use each selected tool
- What to ask when essential info is missing
- Never claim a side-effect succeeded without tool confirmation
- Never invent tool results
`.trim();

/**
 * Optional injectable LLM for tests.
 * @param {{ invoke: Function }} llm
 */
export const createAgentGenerator = ({ llm } = {}) => {
  const resolveLlm = () => {
    if (llm) return llm;

    if (!process.env.GROQ_API_KEY) {
      throw new AgentGeneratorError("GROQ_API_KEY is not configured.", {
        statusCode: 503,
        code: "GROQ_NOT_CONFIGURED",
      });
    }

    return new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: GENERATOR_MODEL,
      temperature: 0.2,
      maxRetries: 2,
      timeout: 45000,
    });
  };

  const generateAgentConfig = async (rawPrompt) => {
    const prompt = validateGeneratePrompt(rawPrompt);
    const unsupportedRequests = detectUnsupportedRequests(prompt);

    let response;
    try {
      const model = resolveLlm();
      response = await model.invoke([
        new SystemMessage(buildSystemPrompt()),
        new HumanMessage(
          `User agent request:\n${prompt}\n\nReturn the JSON agent draft now.`
        ),
      ]);
    } catch (error) {
      if (error instanceof AgentGeneratorError) throw error;

      throw new AgentGeneratorError(
        "Failed to generate agent configuration from Groq.",
        {
          statusCode: 503,
          code: "GROQ_API_FAILURE",
          details: error?.message,
        }
      );
    }

    const content =
      typeof response?.content === "string"
        ? response.content
        : Array.isArray(response?.content)
          ? response.content
              .map((part) =>
                typeof part === "string" ? part : part?.text || ""
              )
              .join("\n")
          : String(response?.content ?? "");

    const parsed = extractJsonObject(content);
    const draft = sanitizeGeneratedDraft(parsed);

    // If nothing actionable remains after tool filtering and the prompt
    // only asked for unsupported things, reject clearly.
    if (draft.tools.length === 0 && unsupportedRequests.length > 0) {
      const actionableHints = /email|gmail|calendar|schedule|instagram|image|photo|meeting|inbox/i.test(
        prompt
      );

      if (!actionableHints) {
        throw new AgentGeneratorError(
          "This request relies on capabilities AutoMate AI does not support yet.",
          {
            statusCode: 400,
            code: "UNSUPPORTED_CAPABILITIES",
            details: { unsupportedRequests },
          }
        );
      }
    }

    const warnings = [];

    if (unsupportedRequests.length > 0) {
      warnings.push(
        "Some requested capabilities are not available; the draft uses only supported AutoMate tools."
      );
    }

    if (
      Array.isArray(parsed.tools) &&
      parsed.tools.some(
        (t) => typeof t === "string" && !SUPPORTED_TOOL_IDS.includes(t.trim())
      )
    ) {
      warnings.push(
        "Unsupported tool IDs from the model were removed from the draft."
      );
    }

    const meta = {
      matchedCapabilities: buildMatchedCapabilities(draft.tools),
      unsupportedRequests: unsupportedRequests.map(({ request, reason }) => ({
        request,
        reason,
      })),
      requiredIntegrations: getIntegrationsForTools(draft.tools),
      approvalRequiredTools: getApprovalRequiredTools(draft.tools),
      suggestedFirstMessages: buildSuggestedFirstMessages(draft, prompt),
      warnings,
    };

    return { draft, meta };
  };

  return {
    generateAgentConfig,
  };
};

const defaultGenerator = createAgentGenerator();

export const generateAgentConfig = (prompt) =>
  defaultGenerator.generateAgentConfig(prompt);
