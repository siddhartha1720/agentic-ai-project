
import jwt from "jsonwebtoken";
import { getMCPTools } from "../mcp/langgraph-mcp.js";
import { WORKFLOW_EXECUTABLE_TOOL_IDS } from "../constants/agentCapabilities.js";
import { validateApprovalAction } from "./approvalAction.js";
// Only read-only tools for this development stage.
const ALLOWED_TOOLS = new Set(
  WORKFLOW_EXECUTABLE_TOOL_IDS
);
function createMCPToken(userId) {
  if (!userId || !process.env.AUTOMATE_MCP_SECRET) {
    throw new Error("MCP authentication is not configured.");
  }

  return jwt.sign({}, process.env.AUTOMATE_MCP_SECRET, {
    algorithm: "HS256",
    subject: String(userId),
    expiresIn: "2m",
    issuer: "automate-backend",
    audience: "automate-mcp",
  });
}

export async function executeWorkflowTool(
  toolName,
  args = {},
  userId
) {
  if (!ALLOWED_TOOLS.has(toolName)) {
    throw new Error(`Tool "${toolName}" is not allowed.`);
  }

  if (
    !args ||
    typeof args !== "object" ||
    Array.isArray(args)
  ) {
    throw new Error("Invalid tool arguments.");
  }

  let toolArgs;

  if (toolName === "get_current_time") {
    if (Object.keys(args).length !== 0) {
      throw new Error("Time tool does not accept arguments.");
    }

    toolArgs = {};
  } else if (toolName === "list_emails") {
    if (!userId) {
      throw new Error("Authenticated user required.");
    }

    if (
      Object.keys(args).some(
        (key) => !["query", "maxResults"].includes(key)
      )
    ) {
      throw new Error("Unsupported Gmail arguments.");
    }

    const query = args.query ?? "in:inbox";
    const maxResults = args.maxResults ?? 10;

    if (
      typeof query !== "string" ||
      query.length > 500 ||
      !Number.isInteger(maxResults) ||
      maxResults < 1 ||
      maxResults > 25
    ) {
      throw new Error("Invalid Gmail search parameters.");
    }

    toolArgs = {
      query,
      maxResults,
      authToken: createMCPToken(userId),
    };
  }

  const tools = await getMCPTools();

  const tool = tools.find(
    (item) =>
      item.name === toolName ||
      item.name === `automate_${toolName}`
  );

  if (!tool) {
    throw new Error(`MCP tool "${toolName}" not found.`);
  }

  const result = await tool.invoke(toolArgs);

  if (result?.isError) {
    throw new Error("MCP tool execution failed.");
  }

  const content =
    typeof result === "string"
      ? result
      : Array.isArray(result?.content)
        ? result.content
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n")
        : JSON.stringify(result);

  return {
    toolName,
    output: content,
  };
}

export async function executeApprovedWorkflowTool(
  action,
  userId
) {
  if (!userId) {
    throw new Error("Authenticated user required.");
  }

  // Import validateApprovalAction at the top of this file
  // before using this function.
  const validated = validateApprovalAction(
    action?.toolId,
    action?.args
  );

  const { toolId, args } = validated;

  if (!["send_email", "create_calendar_event"].includes(toolId)) {
    throw new Error("Unsupported approved workflow tool.");
  }

  const tools = await getMCPTools();

  const tool = tools.find(
    (item) =>
      item.name === toolId ||
      item.name === `automate_${toolId}`
  );

  if (!tool) {
    throw new Error(`MCP tool "${toolId}" not found.`);
  }

  const result = await tool.invoke({
    ...args,
    authToken: createMCPToken(userId),
  });

  
  // MCP can return a structured response or serialized JSON.
  let parsedResult = result;

  if (typeof result === "string") {
    try {
      parsedResult = JSON.parse(result);
    } catch {
      // Plain-text responses remain unchanged.
    }
  }

  if (
    parsedResult?.isError === true ||
    parsedResult?.error === true
  ) {
    throw new Error(
      `Approved action ${toolId} failed. ` +
      "External outcome may be uncertain."
    );
  }

  // Detect structured error responses inside MCP content.
  if (Array.isArray(parsedResult?.content)) {
    for (const item of parsedResult.content) {
      if (item.type !== "text") continue;

      try {
        const payload = JSON.parse(item.text);

        if (
          payload?.isError === true ||
          payload?.error === true
        ) {
          throw new Error(
            `Approved action ${toolId} failed. ` +
            "External outcome may be uncertain."
          );
        }
      } catch (error) {
        if (
          error.message.includes(
            "External outcome may be uncertain."
          )
        ) {
          throw error;
        }
      }
    }
  }


  const output =
    typeof result === "string"
      ? result
      : Array.isArray(result?.content)
        ? result.content
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n")
        : JSON.stringify(result);

  return { toolName: toolId, output };
}
