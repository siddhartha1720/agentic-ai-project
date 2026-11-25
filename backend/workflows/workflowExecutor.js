
import { randomUUID } from "node:crypto";
import { ChatGroq } from "@langchain/groq";
import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { validateWorkflow } from "./workflowSchema.js";
import { evaluateCondition } from "./conditionEvaluator.js";
import { executeWorkflowTool } from "./workflowToolExecutor.js";
import { validateApprovalAction } from "./approvalAction.js";

import {
  APPROVAL_REQUIRED_TOOL_IDS,
  WORKFLOW_EXECUTABLE_TOOL_IDS,
} from "../constants/agentCapabilities.js";

// Temporary in-memory approvals for local tests only.
const pendingApprovals = new Map();

const MAX_STEPS = 30;

async function runWorkflow(
  state,
  approvalDecision,
  onApproval = null,
  onApprovedAction = null
) {
  const { workflow, history } = state;
  const { nodes, edges } = workflow;

  const nodeMap = new Map(
    nodes.map((node) => [node.id, node])
  );

  while (state.steps < MAX_STEPS) {
    const node = nodeMap.get(state.currentNodeId);

    if (!node) {
      throw new Error("Workflow node not found.");
    }

    let output = state.currentOutput;
    let decision;

    // ----------------------------------------
    // AI TASK
    // ----------------------------------------
    if (node.type === "ai_task") {
      const prompt = node.config?.prompt;

      if (!prompt || typeof prompt !== "string") {
        throw new Error("AI task requires a prompt.");
      }

      const model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: "openai/gpt-oss-120b",
        temperature: 0.2,
      });

      const response = await model.invoke([
        new SystemMessage(
          "You are an AI workflow task executor. Complete the task accurately."
        ),
        new HumanMessage(
          `${prompt}\n\nPrevious step output:\n${
            typeof output === "string"
              ? output
              : JSON.stringify(output)
          }`
        ),
      ]);

      output = response.content;
    }

    // ----------------------------------------
    // CONDITION
    // ----------------------------------------
    else if (node.type === "condition") {
      decision = evaluateCondition(
        node.config,
        state.currentOutput
      );

      output = state.currentOutput;
    }

    // ----------------------------------------
    // HUMAN APPROVAL NODE
    // ----------------------------------------
    else if (node.type === "approval") {
      if (approvalDecision === undefined) {
        if (onApproval) {
          await onApproval(state);

          return {
            status: "approval_required",
            currentNode: node.id,
            proposedOutput: state.currentOutput,
            history: [...history],
          };
        }

        // Local testing fallback only.
        const runId = randomUUID();
        pendingApprovals.set(runId, state);

        return {
          status: "approval_required",
          runId,
          currentNode: node.id,
          proposedOutput: state.currentOutput,
          history: [...history],
        };
      }

      if (approvalDecision !== true) {
        history.push({
          nodeId: node.id,
          type: node.type,
          status: "rejected",
        });

        return {
          status: "rejected",
          output: state.currentOutput,
          history,
        };
      }

      approvalDecision = undefined;
    }

    // ----------------------------------------
    // TOOL ACTION
    // ----------------------------------------
    else if (node.type === "tool_action") {
      const toolName = node.config?.toolId;

      if (APPROVAL_REQUIRED_TOOL_IDS.includes(toolName)) {
        // Validate exact action before saving approval.
        const proposedAction = validateApprovalAction(
          toolName,
          node.config?.args ?? {}
        );

        // First execution: pause before external action.
        if (approvalDecision === undefined) {
          if (typeof onApproval !== "function") {
            throw new Error(
              "Protected action requires persistent approval."
            );
          }

          await onApproval(state, proposedAction);

          return {
            status: "approval_required",
            currentNode: node.id,
            proposedAction,
            history: [...history],
          };
        }

        // Explicit rejection means no execution.
        if (approvalDecision !== true) {
          history.push({
            nodeId: node.id,
            type: node.type,
            status: "rejected",
          });

          return {
            status: "rejected",
            output: state.currentOutput,
            history,
          };
        }

        // Approved actions must use a trusted handler.
        // Never call Gmail/Calendar directly here.
        if (typeof onApprovedAction !== "function") {
          throw new Error(
            "Verified approved-action handler required."
          );
        }

        const result = await onApprovedAction(
          proposedAction,
          state.userId
        );

        if (
          !result ||
          !Object.prototype.hasOwnProperty.call(
            result,
            "output"
          )
        ) {
          throw new Error(
            "Approved-action handler returned invalid result."
          );
        }

        output = result.output;
        approvalDecision = undefined;
      } else {
        // Read-only workflow tools.
        if (!WORKFLOW_EXECUTABLE_TOOL_IDS.includes(toolName)) {
          throw new Error(
            `Tool "${toolName}" is not enabled.`
          );
        }

        const result = await executeWorkflowTool(
          toolName,
          node.config?.args ?? {},
          state.userId
        );

        output = result.output;
      }
    }

    // ----------------------------------------
    // RECORD COMPLETED NODE
    // ----------------------------------------
    history.push({
      nodeId: node.id,
      type: node.type,
      status: "completed",
      output,
      ...(decision !== undefined ? { decision } : {}),
    });

    state.currentOutput = output;
    state.steps++;

    if (node.type === "end") {
      return {
        status: "completed",
        output,
        history,
      };
    }

    // ----------------------------------------
    // DETERMINE NEXT NODE
    // ----------------------------------------
    const outgoingEdges = edges.filter(
      (edge) => edge.source === node.id
    );

    let selectedEdge;

    if (node.type === "condition") {
      const branch = decision ? "true" : "false";

      selectedEdge = outgoingEdges.find(
        (edge) => edge.condition === branch
      );

      if (!selectedEdge) {
        throw new Error(
          `Missing ${branch} branch for ${node.id}`
        );
      }
    } else {
      if (outgoingEdges.length !== 1) {
        throw new Error(
          `Node ${node.id} must have exactly one outgoing edge.`
        );
      }

      selectedEdge = outgoingEdges[0];
    }

    if (!nodeMap.has(selectedEdge.target)) {
      throw new Error("Next node does not exist.");
    }

    state.currentNodeId = selectedEdge.target;
  }

  throw new Error(
    "Workflow exceeded maximum execution steps."
  );
}

// ----------------------------------------
// START WORKFLOW
// ----------------------------------------
export async function executeWorkflow(
  workflow,
  initialInput = "",
  onApproval = null,
  userId = null
) {
  const parsed = validateWorkflow(workflow);

  if (!parsed.success) {
    throw new Error(
      "Invalid workflow: " +
        parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")
    );
  }

  const startNode = parsed.data.nodes.find(
    (node) => node.type === "start"
  );

  const state = {
    workflow: parsed.data,
    currentNodeId: startNode.id,
    currentOutput: initialInput,
    history: [],
    steps: 0,
    userId,
  };

  return runWorkflow(state, undefined, onApproval);
}

// ----------------------------------------
// LOCAL TEST RESUME
// ----------------------------------------
export async function resumeWorkflow(runId, approved) {
  if (typeof runId !== "string" || !runId) {
    throw new Error("Valid runId required.");
  }

  if (typeof approved !== "boolean") {
    throw new Error("Approval must be true or false.");
  }

  const state = pendingApprovals.get(runId);

  if (!state) {
    throw new Error(
      "Pending workflow not found or already resumed."
    );
  }

  pendingApprovals.delete(runId);

  return runWorkflow(state, approved);
}

// ----------------------------------------
// PERSISTENT CHECKPOINT RESUME
// ----------------------------------------
export async function resumeWorkflowFromCheckpoint(
  workflow,
  resumeState,
  approved,
  userId = null,
  onApprovedAction = null
) {
  if (typeof approved !== "boolean") {
    throw new Error("Approval must be true or false.");
  }

  const validated = validateWorkflow(workflow);

  if (!validated.success) {
    throw new Error("Invalid stored workflow snapshot.");
  }

  if (
    !resumeState ||
    typeof resumeState.currentNodeId !== "string" ||
    !Array.isArray(resumeState.history) ||
    !Number.isInteger(resumeState.steps) ||
    resumeState.steps < 0 ||
    resumeState.steps >= MAX_STEPS
  ) {
    throw new Error("Invalid saved resume state.");
  }

  const node = validated.data.nodes.find(
    (item) => item.id === resumeState.currentNodeId
  );

  const isNormalApproval = node?.type === "approval";

  const isProtectedAction =
    node?.type === "tool_action" &&
    ["send_email", "create_calendar_event"].includes(
      node.config?.toolId
    );

  if (!isNormalApproval && !isProtectedAction) {
    throw new Error(
      "Resume state is not at an approvable node."
    );
  }

  // Fail closed if approval handler is missing.
  if (
    isProtectedAction &&
    approved === true &&
    typeof onApprovedAction !== "function"
  ) {
    throw new Error(
      "Verified approved-action handler required."
    );
  }

  const state = {
    workflow: validated.data,
    currentNodeId: resumeState.currentNodeId,
    currentOutput: resumeState.currentOutput,
    history: [...resumeState.history],
    steps: resumeState.steps,
    userId,
  };

  return runWorkflow(
    state,
    approved,
    null,
    onApprovedAction
  );
}
