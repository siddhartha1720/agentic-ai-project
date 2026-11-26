import api from "@/api";

// Generate a workflow draft from a natural-language prompt
export const generateWorkflowApi = async (prompt) => {
  const response = await api.post("/api/workflows/generate", { prompt });
  return response.data;
};

// Save a workflow
export const createWorkflowApi = async (workflowData) => {
  const response = await api.post("/api/workflows", workflowData);
  return response.data;
};

// List all workflows for the authenticated user
export const fetchWorkflowsApi = async () => {
  const response = await api.get("/api/workflows");
  return response.data;
};

// Get single workflow by ID
export const fetchWorkflowByIdApi = async (workflowId) => {
  const response = await api.get(`/api/workflows/${workflowId}`);
  return response.data;
};

// Execute a saved workflow
export const runWorkflowApi = async (workflowId, input = "") => {
  const response = await api.post(`/api/workflows/${workflowId}/run`, {
    input,
  });
  return response.data;
};

// Get execution history for a single workflow
export const fetchWorkflowRunsApi = async (workflowId) => {
  const response = await api.get(`/api/workflows/${workflowId}/runs`);
  return response.data;
};

// Get all workflow runs across the authenticated user's workflows
export const fetchAllWorkflowRunsApi = async (status) => {
  const response = await api.get("/api/workflows/runs", {
    params: status ? { status } : undefined,
  });
  return response.data;
};

// Approve or reject a paused workflow run
export const resumeWorkflowRunApi = async (runId, approved) => {
  const response = await api.post(`/api/workflows/runs/${runId}/resume`, {
    approved,
  });
  return response.data;
};
