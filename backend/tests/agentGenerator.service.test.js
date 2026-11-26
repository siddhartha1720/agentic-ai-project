import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import {
  AgentGeneratorError,
  createAgentGenerator,
  detectUnsupportedRequests,
  filterSupportedToolIds,
  sanitizeGeneratedDraft,
  validateGeneratePrompt,
} from "../services/agentGenerator.service.js";
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  SUPPORTED_TOOL_IDS,
} from "../constants/agentCapabilities.js";

const validLlmPayload = {
  name: "HR Recruitment Agent",
  description: "Helps with interview emails and scheduling.",
  instructions:
    "You are an HR recruitment assistant. Draft interview emails with send_email and schedule interviews with create_calendar_event. Always wait for app approval for side effects.",
  model: "openai/gpt-oss-120b",
  temperature: 0.4,
  tools: [
    "get_current_time",
    "list_emails",
    "read_email",
    "send_email",
    "create_calendar_event",
    "list_calendar_events",
    "fake_resume_parser",
    "salesforce_sync",
  ],
};

const createMockLlm = (content) => ({
  invoke: mock.fn(async () => ({ content })),
});

describe("validateGeneratePrompt", () => {
  it("rejects empty and non-string prompts", () => {
    assert.throws(
      () => validateGeneratePrompt(""),
      (error) =>
        error instanceof AgentGeneratorError && error.statusCode === 400
    );

    assert.throws(
      () => validateGeneratePrompt("   "),
      (error) =>
        error instanceof AgentGeneratorError && error.code === "INVALID_PROMPT"
    );

    assert.throws(
      () => validateGeneratePrompt(null),
      (error) =>
        error instanceof AgentGeneratorError && error.code === "INVALID_PROMPT"
    );
  });

  it("rejects prompts that are too short or too long", () => {
    assert.throws(
      () => validateGeneratePrompt("short"),
      (error) =>
        error instanceof AgentGeneratorError && error.statusCode === 400
    );

    assert.throws(
      () => validateGeneratePrompt("a".repeat(2001)),
      (error) =>
        error instanceof AgentGeneratorError && error.statusCode === 400
    );
  });

  it("trims a valid prompt", () => {
    const prompt = validateGeneratePrompt(
      "  Create an email assistant for outreach.  "
    );
    assert.equal(prompt, "Create an email assistant for outreach.");
  });
});

describe("detectUnsupportedRequests", () => {
  it("flags resume screening and CRM requests", () => {
    const unsupported = detectUnsupportedRequests(
      "Create an HR agent that screens resumes and syncs to Salesforce."
    );

    const ids = unsupported.map((item) => item.id);
    assert.ok(ids.includes("resume_parsing"));
    assert.ok(ids.includes("crm_salesforce"));
  });
});

describe("filterSupportedToolIds", () => {
  it("keeps only real platform tool IDs", () => {
    const filtered = filterSupportedToolIds([
      "send_email",
      "send_email",
      "fake_tool",
      "create_calendar_event",
      123,
      " ",
    ]);

    assert.deepEqual(filtered, ["send_email", "create_calendar_event"]);
    for (const id of filtered) {
      assert.ok(SUPPORTED_TOOL_IDS.includes(id));
    }
  });
});

describe("sanitizeGeneratedDraft", () => {
  it("strips unsupported tools and forces groq provider", () => {
    const draft = sanitizeGeneratedDraft(validLlmPayload);

    assert.equal(draft.provider, DEFAULT_PROVIDER);
    assert.equal(draft.model, DEFAULT_MODEL);
    assert.ok(!draft.tools.includes("fake_resume_parser"));
    assert.ok(!draft.tools.includes("salesforce_sync"));
    assert.ok(draft.tools.includes("send_email"));
  });

  it("falls back to default model for unknown model IDs", () => {
    const draft = sanitizeGeneratedDraft({
      ...validLlmPayload,
      model: "gpt-4o-mini",
    });

    assert.equal(draft.model, DEFAULT_MODEL);
  });
});

describe("generateAgentConfig", () => {
  it("returns a schema-ready draft and platform meta for a valid prompt", async () => {
    const llm = createMockLlm(JSON.stringify(validLlmPayload));
    const { generateAgentConfig } = createAgentGenerator({ llm });

    const result = await generateAgentConfig(
      "Create an HR recruitment agent that screens resumes, drafts interview emails and schedules interviews."
    );

    assert.equal(result.draft.name, "HR Recruitment Agent");
    assert.equal(result.draft.provider, "groq");
    assert.ok(result.draft.instructions.length > 20);
    assert.ok(result.draft.tools.includes("send_email"));
    assert.ok(result.draft.tools.includes("create_calendar_event"));
    assert.ok(!result.draft.tools.includes("fake_resume_parser"));

    assert.ok(
      result.meta.unsupportedRequests.some((item) =>
        /resume/i.test(item.request)
      )
    );
    assert.ok(result.meta.requiredIntegrations.includes("gmail"));
    assert.ok(result.meta.requiredIntegrations.includes("google_calendar"));
    assert.ok(result.meta.approvalRequiredTools.includes("send_email"));
    assert.ok(result.meta.suggestedFirstMessages.length > 0);
    assert.equal(llm.invoke.mock.callCount(), 1);
  });

  it("handles markdown-fenced model responses", async () => {
    const llm = createMockLlm(
      "```json\n" + JSON.stringify(validLlmPayload) + "\n```"
    );
    const { generateAgentConfig } = createAgentGenerator({ llm });

    const result = await generateAgentConfig(
      "Create a Gmail and calendar productivity agent for my team."
    );

    assert.equal(result.draft.name, "HR Recruitment Agent");
  });

  it("rejects invalid prompts before calling the LLM", async () => {
    const llm = createMockLlm("{}");
    const { generateAgentConfig } = createAgentGenerator({ llm });

    await assert.rejects(
      () => generateAgentConfig(""),
      (error) =>
        error instanceof AgentGeneratorError && error.code === "INVALID_PROMPT"
    );

    assert.equal(llm.invoke.mock.callCount(), 0);
  });

  it("rejects unsupported-only requests with no actionable tools", async () => {
    const llm = createMockLlm(
      JSON.stringify({
        name: "Salesforce Bot",
        description: "CRM only",
        instructions: "You sync Salesforce records.",
        model: "openai/gpt-oss-120b",
        temperature: 0.5,
        tools: ["salesforce_sync"],
      })
    );
    const { generateAgentConfig } = createAgentGenerator({ llm });

    await assert.rejects(
      () =>
        generateAgentConfig(
          "Build a Salesforce CRM agent that syncs HubSpot and Pipedrive deals."
        ),
      (error) =>
        error instanceof AgentGeneratorError &&
        error.code === "UNSUPPORTED_CAPABILITIES" &&
        error.statusCode === 400
    );
  });

  it("maps malformed model JSON to a controlled error", async () => {
    const llm = createMockLlm("this is not json at all");
    const { generateAgentConfig } = createAgentGenerator({ llm });

    await assert.rejects(
      () =>
        generateAgentConfig(
          "Create an email drafting agent for customer support replies."
        ),
      (error) =>
        error instanceof AgentGeneratorError &&
        error.code === "MALFORMED_MODEL_RESPONSE" &&
        error.statusCode === 502
    );
  });

  it("maps Groq API failures to a controlled error", async () => {
    const llm = {
      invoke: mock.fn(async () => {
        throw new Error("upstream timeout");
      }),
    };
    const { generateAgentConfig } = createAgentGenerator({ llm });

    await assert.rejects(
      () =>
        generateAgentConfig(
          "Create an Instagram content agent that can publish images."
        ),
      (error) =>
        error instanceof AgentGeneratorError &&
        error.code === "GROQ_API_FAILURE" &&
        error.statusCode === 503
    );
  });
});
