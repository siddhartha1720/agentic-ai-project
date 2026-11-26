import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  Code2,
  FlaskConical,
  GitBranch,
  History,
  Loader2,
  Play,
  Save,
  Sparkles,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { useAppShell } from "@/components/layout/AppShellContext";
import ApprovalActionDetails from "@/components/workflows/ApprovalActionDetails";
import RunStatusBadge from "@/components/workflows/RunStatusBadge";
import WorkflowGraph from "@/components/workflows/WorkflowGraph";
import { WORKFLOW_NODE_META, WORKFLOW_TOOLS } from "@/constants/capabilities";
import {
  createWorkflowApi,
  fetchWorkflowByIdApi,
  generateWorkflowApi,
  resumeWorkflowRunApi,
  runWorkflowApi,
} from "@/features/workflows/workflowApi";
import { formatOutput, getErrorMessage } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const panelCls =
  "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl";
const fieldCls =
  "rounded-xl border-white/10 bg-black/25 text-sm text-white placeholder:text-zinc-500 focus-visible:border-white/25 focus-visible:ring-0";

const SAMPLE_WORKFLOW_PROMPTS = [
  "Get the current date and time, list my latest 5 inbox emails, summarize urgent messages, and pause for human approval.",
  "Check my unread emails and draft a daily briefing summary for me.",
  "Fetch the current time and draft a weekly status update with an approval step before finishing.",
];

export default function WorkflowStudio() {
  const { id: routeWorkflowId } = useParams();
  return <WorkflowStudioInner key={routeWorkflowId || "new"} routeWorkflowId={routeWorkflowId} />;
}

function WorkflowStudioInner({ routeWorkflowId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshPendingApprovals } = useAppShell();

  const [prompt, setPrompt] = useState(location.state?.prompt || "");
  const [workflow, setWorkflow] = useState(null);
  const [savedWorkflowId, setSavedWorkflowId] = useState(routeWorkflowId || null);
  const [isDirty, setIsDirty] = useState(false);

  const [loadingWorkflow, setLoadingWorkflow] = useState(Boolean(routeWorkflowId));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [lastRun, setLastRun] = useState(null);

  useEffect(() => {
    if (!routeWorkflowId) return;
    let active = true;
    fetchWorkflowByIdApi(routeWorkflowId)
      .then((data) => {
        if (!active || !data?.workflow) return;
        setWorkflow(data.workflow);
        setSavedWorkflowId(data.workflow._id);
        setSelectedNodeId(data.workflow.nodes?.[0]?.id || null);
        setIsDirty(false);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, "Failed to load workflow."));
      })
      .finally(() => {
        if (active) setLoadingWorkflow(false);
      });

    return () => {
      active = false;
    };
  }, [routeWorkflowId]);

  const selectedNode =
    workflow?.nodes?.find((node) => node.id === selectedNodeId) || null;

  const handleGenerate = async (event) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    setError("");

    if (trimmed.length < 12 || trimmed.length > 2000) {
      setError("Prompt must contain 12 to 2000 characters.");
      return;
    }

    try {
      setGenerating(true);
      const data = await generateWorkflowApi(trimmed);
      setWorkflow(data.workflow);
      setSavedWorkflowId(null);
      setIsDirty(true);
      setLastRun(null);
      setSelectedNodeId(data.workflow?.nodes?.[0]?.id || null);
      toast.success("Workflow graph generated! Inspect nodes, save, and run.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to generate workflow."));
    } finally {
      setGenerating(false);
    }
  };

  const updateWorkflowMeta = (field, value) => {
    setWorkflow((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const updateSelectedNode = (updater) => {
    if (!selectedNodeId) return;
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === selectedNodeId ? updater(node) : node
      ),
    }));
    setIsDirty(true);
  };

  const handleSaveWorkflow = async () => {
    if (!workflow) return null;
    setError("");

    try {
      setSaving(true);
      const payload = {
        name: workflow.name?.trim() || "Untitled Workflow",
        description: workflow.description || "",
        nodes: workflow.nodes,
        edges: workflow.edges,
      };
      const data = await createWorkflowApi(payload);
      const saved = data.workflow;
      setWorkflow(saved);
      setSavedWorkflowId(saved._id);
      setIsDirty(false);
      toast.success(`Workflow "${saved.name}" saved!`);
      navigate(`/workflows/studio/${saved._id}`, { replace: true });
      return saved;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save workflow."));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleRunWorkflow = async () => {
    if (!workflow) return;
    setError("");

    let targetId = savedWorkflowId;
    if (!targetId || isDirty) {
      const saved = await handleSaveWorkflow();
      if (!saved?._id) return;
      targetId = saved._id;
    }

    try {
      setRunning(true);
      const res = await runWorkflowApi(targetId, runInput);
      const result = res.result || {};
      setLastRun({
        runId: res.runId,
        workflowId: targetId,
        status: result.status,
        currentNode: result.currentNode || null,
        output: result.output ?? result.proposedOutput ?? null,
        proposedAction: result.proposedAction || null,
        history: result.history || [],
      });
      await refreshPendingApprovals();

      if (result.status === "approval_required") {
        toast.info("Workflow paused for human approval.");
      } else {
        toast.success(`Workflow finished with status: ${result.status}`);
      }
    } catch (err) {
      const msg = getErrorMessage(err, "Workflow execution failed.");
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const handleResumeRun = async (runId, approved) => {
    try {
      const res = await resumeWorkflowRunApi(runId, approved);
      await refreshPendingApprovals();

      if (!approved) {
        setLastRun((prev) =>
          prev
            ? {
                ...prev,
                status: res.status || "rejected",
              }
            : null
        );
        toast.info("Workflow run rejected.");
        return;
      }

      const result = res.result || {};
      setLastRun((prev) => ({
        ...(prev || {}),
        runId,
        status: result.status,
        currentNode: result.currentNode || null,
        output: result.output ?? result.proposedOutput ?? null,
        proposedAction: result.proposedAction || null,
        history: result.history || prev?.history || [],
      }));
      toast.success(`Workflow resumed (${result.status}).`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Unable to resume workflow."));
    }
  };

  return (
    <AppLayout
      title="Workflow Studio"
      subtitle="Generate workflows from natural language, inspect nodes & edges, save, and execute."
      actions={
        <div className="flex items-center gap-2">
          <span
            title="Advanced Testing Studio is a planned future feature"
            className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-500 sm:inline-flex"
          >
            <FlaskConical size={13} />
            Testing Studio · Soon
          </span>
          {savedWorkflowId && (
            <Link
              to={`/executions?workflowId=${savedWorkflowId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-zinc-200 hover:bg-white/10"
            >
              <History size={14} />
              Run History
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Prompt-to-Workflow Generator Bar */}
        <section className={`${panelCls} p-5`}>
          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="workflow-prompt"
                className="flex items-center gap-2 text-sm font-medium text-white"
              >
                <Sparkles size={16} className="text-violet-300" />
                <span>Prompt-to-Workflow Generator</span>
              </label>
              <span className="text-[11px] text-zinc-500">
                Supported executable tools: get_current_time, list_emails (+
                approval gates)
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Textarea
                id="workflow-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the steps, conditions, AI tasks, and approval gates you want..."
                className={`min-h-20 flex-1 resize-y ${fieldCls}`}
              />
              <Button
                type="submit"
                disabled={generating || prompt.trim().length < 12}
                className="h-auto min-h-11 shrink-0 rounded-xl bg-white px-5 text-xs font-semibold text-zinc-900 hover:bg-zinc-200 sm:self-stretch"
              >
                {generating ? (
                  <>
                    <Loader2 size={15} className="mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <GitBranch size={15} className="mr-2" />
                    Generate Workflow
                  </>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-zinc-500">Try:</span>
              {SAMPLE_WORKFLOW_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(sample)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/25 hover:bg-white/[0.07]"
                >
                  {sample.slice(0, 56)}...
                </button>
              ))}
            </div>
          </form>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-200">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loadingWorkflow ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-zinc-400">
            <Loader2 size={18} className="mr-2 animate-spin" />
            Loading workflow...
          </div>
        ) : !workflow ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-white text-zinc-900">
              <GitBranch size={22} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-white">
              Generate or open a workflow
            </h2>
            <p className="mt-1 max-w-md text-xs leading-5 text-zinc-500">
              Enter a prompt above to generate a structured workflow graph, or{" "}
              <Link to="/workflows" className="text-violet-300 hover:underline">
                open an existing workflow
              </Link>{" "}
              to inspect and run it.
            </p>
          </div>
        ) : (
          <>
            {/* Workflow Header & Save/Run Controls */}
            <section className={`${panelCls} p-5`}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      Workflow Name
                    </label>
                    <Input
                      value={workflow.name || ""}
                      maxLength={100}
                      onChange={(e) => updateWorkflowMeta("name", e.target.value)}
                      className={`h-10 ${fieldCls}`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      Description
                    </label>
                    <Input
                      value={workflow.description || ""}
                      maxLength={500}
                      onChange={(e) =>
                        updateWorkflowMeta("description", e.target.value)
                      }
                      className={`h-10 ${fieldCls}`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowJson((prev) => !prev)}
                    className="h-10 rounded-xl border-white/10 bg-white/[0.05] text-xs text-zinc-200 hover:bg-white/10"
                  >
                    <Code2 size={14} className="mr-1.5" />
                    {showJson ? "Canvas View" : "Inspect JSON"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={handleSaveWorkflow}
                    className="h-10 rounded-xl border-white/15 bg-white/[0.06] text-xs text-white hover:bg-white/15"
                  >
                    {saving ? (
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                    ) : (
                      <Save size={14} className="mr-1.5" />
                    )}
                    {savedWorkflowId && !isDirty ? "Saved" : "Save Workflow"}
                  </Button>
                </div>
              </div>

              {/* Execution Input Bar */}
              <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center">
                <Input
                  value={runInput}
                  onChange={(e) => setRunInput(e.target.value)}
                  placeholder="Optional initial input passed to the start node..."
                  className={`h-10 flex-1 ${fieldCls}`}
                />
                <Button
                  type="button"
                  disabled={running || saving}
                  onClick={handleRunWorkflow}
                  className="h-10 shrink-0 rounded-xl bg-emerald-400 px-5 text-xs font-semibold text-zinc-950 hover:bg-emerald-300"
                >
                  {running ? (
                    <>
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play size={14} className="mr-1.5" />
                      {!savedWorkflowId || isDirty
                        ? "Save & Run Workflow"
                        : "Run Workflow"}
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* Graph + Node Inspector */}
            <section className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-400">
                    {workflow.nodes?.length || 0} nodes ·{" "}
                    {workflow.edges?.length || 0} edges
                    {isDirty && (
                      <span className="ml-2 text-amber-300">· Unsaved changes</span>
                    )}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Click any node to inspect or configure
                  </p>
                </div>

                {showJson ? (
                  <pre className="max-h-[460px] overflow-auto rounded-2xl border border-white/10 bg-[#0d0f14] p-4 text-xs leading-5 text-zinc-300">
                    {JSON.stringify(
                      {
                        name: workflow.name,
                        description: workflow.description,
                        nodes: workflow.nodes,
                        edges: workflow.edges,
                      },
                      null,
                      2
                    )}
                  </pre>
                ) : (
                  <WorkflowGraph
                    nodes={workflow.nodes}
                    edges={workflow.edges}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(node) => setSelectedNodeId(node.id)}
                    executionHistory={lastRun?.history}
                    currentNodeId={lastRun?.currentNode}
                    runStatus={lastRun?.status}
                  />
                )}
              </div>

              {/* Node Inspector */}
              <div className={`${panelCls} p-5`}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Node Inspector
                </h3>

                {!selectedNode ? (
                  <p className="mt-4 text-xs text-zinc-500">
                    Select a node on the canvas to view or edit its configuration.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="border-white/15 bg-white/[0.05] text-xs text-zinc-200"
                      >
                        {WORKFLOW_NODE_META[selectedNode.type]?.label ||
                          selectedNode.type}
                      </Badge>
                      <span className="font-mono text-[11px] text-zinc-500">
                        id: {selectedNode.id}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500">
                      {WORKFLOW_NODE_META[selectedNode.type]?.description}
                    </p>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-300">
                        Node Name
                      </label>
                      <Input
                        value={selectedNode.name || ""}
                        onChange={(e) =>
                          updateSelectedNode((n) => ({
                            ...n,
                            name: e.target.value,
                          }))
                        }
                        className={`h-9 ${fieldCls}`}
                      />
                    </div>

                    {selectedNode.type === "ai_task" && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-300">
                          Task Prompt
                        </label>
                        <Textarea
                          value={selectedNode.config?.prompt || ""}
                          onChange={(e) =>
                            updateSelectedNode((n) => ({
                              ...n,
                              config: { ...n.config, prompt: e.target.value },
                            }))
                          }
                          className={`min-h-32 ${fieldCls}`}
                        />
                      </div>
                    )}

                    {selectedNode.type === "tool_action" && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-300">
                            Tool ID
                          </label>
                          <select
                            value={selectedNode.config?.toolId || "get_current_time"}
                            onChange={(e) => {
                              const nextTool = WORKFLOW_TOOLS.find(
                                (t) => t.id === e.target.value
                              );
                              updateSelectedNode((n) => ({
                                ...n,
                                config: {
                                  toolId: e.target.value,
                                  args: nextTool?.defaultArgs || {},
                                },
                              }));
                            }}
                            className="h-9 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-zinc-200 outline-none [color-scheme:dark] [&>option]:bg-[#1d2026]"
                          >
                            {WORKFLOW_TOOLS.map((tool) => (
                              <option key={tool.id} value={tool.id}>
                                {tool.label}
                                {tool.requiresApproval ? " (Approval)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-300">
                            Tool Arguments (JSON)
                          </label>
                          <Textarea
                            value={JSON.stringify(
                              selectedNode.config?.args || {},
                              null,
                              2
                            )}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value || "{}");
                                updateSelectedNode((n) => ({
                                  ...n,
                                  config: { ...n.config, args: parsed },
                                }));
                              } catch {
                                // Ignore invalid intermediate JSON typing
                              }
                            }}
                            className={`min-h-24 font-mono text-xs ${fieldCls}`}
                          />
                        </div>
                      </div>
                    )}

                    {selectedNode.type === "condition" && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-300">
                            Field Path
                          </label>
                          <Input
                            value={selectedNode.config?.field || ""}
                            placeholder="e.g. count"
                            onChange={(e) =>
                              updateSelectedNode((n) => ({
                                ...n,
                                config: { ...n.config, field: e.target.value },
                              }))
                            }
                            className={`h-9 ${fieldCls}`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-300">
                              Operator
                            </label>
                            <select
                              value={selectedNode.config?.operator || "eq"}
                              onChange={(e) =>
                                updateSelectedNode((n) => ({
                                  ...n,
                                  config: {
                                    ...n.config,
                                    operator: e.target.value,
                                  },
                                }))
                              }
                              className="h-9 w-full rounded-xl border border-white/10 bg-black/25 px-2.5 text-xs text-zinc-200 outline-none [color-scheme:dark] [&>option]:bg-[#1d2026]"
                            >
                              {["eq", "neq", "gt", "gte", "lt", "lte"].map((op) => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-300">
                              Value
                            </label>
                            <Input
                              value={String(selectedNode.config?.value ?? "")}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const num = Number(raw);
                                const parsed =
                                  raw !== "" && !Number.isNaN(num) ? num : raw;
                                updateSelectedNode((n) => ({
                                  ...n,
                                  config: { ...n.config, value: parsed },
                                }));
                              }}
                              className={`h-9 ${fieldCls}`}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Live Execution Result & Inline Approval */}
            {lastRun && (
              <section className={`${panelCls} space-y-4 p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Latest Execution Result
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Run ID: <span className="font-mono">{lastRun.runId}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RunStatusBadge status={lastRun.status} />
                    <Link
                      to={`/executions?workflowId=${lastRun.workflowId}&runId=${lastRun.runId}`}
                      className="text-xs text-violet-300 hover:underline"
                    >
                      Open in History
                    </Link>
                  </div>
                </div>

                {lastRun.status === "approval_required" && (
                  <ApprovalActionDetails
                    runId={lastRun.runId}
                    workflowName={workflow.name}
                    currentNodeId={lastRun.currentNode}
                    proposedOutput={lastRun.output}
                    proposedAction={lastRun.proposedAction}
                    onDecision={handleResumeRun}
                  />
                )}

                {lastRun.history?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-300">
                      Executed Nodes ({lastRun.history.length})
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {lastRun.history.map((step, i) => (
                        <div
                          key={`${step.nodeId}-${i}`}
                          className="rounded-xl border border-white/[0.08] bg-black/25 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-white">
                              {i + 1}. {step.nodeId}{" "}
                              <span className="text-zinc-500">
                                ({step.type})
                              </span>
                            </span>
                            <RunStatusBadge status={step.status} />
                          </div>
                          {step.output !== undefined && step.output !== "" && (
                            <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-5 text-zinc-300">
                              {formatOutput(step.output)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lastRun.output !== null &&
                  lastRun.output !== undefined &&
                  lastRun.status !== "approval_required" && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-zinc-300">
                        Final Output
                      </p>
                      <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-3.5 font-sans text-xs leading-5 text-zinc-200">
                        {formatOutput(lastRun.output)}
                      </pre>
                    </div>
                  )}
              </section>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
