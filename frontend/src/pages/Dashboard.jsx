import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Coins,
  GitBranch,
  MessageSquare,
  Play,
  Plug,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Workflow,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import RunStatusBadge from "@/components/workflows/RunStatusBadge";
import { fetchAgentsApi } from "@/features/agents/agentApi";
import {
  fetchAllWorkflowRunsApi,
  fetchWorkflowsApi,
  runWorkflowApi,
} from "@/features/workflows/workflowApi";
import { fetchIntegrationsApi } from "@/features/integrations/integrationApi";
import { formatRelativeTime, getErrorMessage } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const panelCls =
  "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);

  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [runs, setRuns] = useState([]);
  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickPrompt, setQuickPrompt] = useState("");
  const [runningWorkflowId, setRunningWorkflowId] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    const [agentsRes, workflowsRes, runsRes, integrationsRes] =
      await Promise.all([
        fetchAgentsApi(),
        fetchWorkflowsApi(),
        fetchAllWorkflowRunsApi(),
        fetchIntegrationsApi().catch(() => ({ integrations: {} })),
      ]);

    return {
      agents: Array.isArray(agentsRes?.agents) ? agentsRes.agents : [],
      workflows: Array.isArray(workflowsRes?.workflows)
        ? workflowsRes.workflows
        : [],
      runs: Array.isArray(runsRes?.runs) ? runsRes.runs : [],
      integrations: integrationsRes?.integrations || {},
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchDashboardData();
      setAgents(data.agents);
      setWorkflows(data.workflows);
      setRuns(data.runs);
      setIntegrations(data.integrations);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load dashboard data."));
    } finally {
      setLoading(false);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    const instagram = params.get("instagram");

    if (google === "connected") {
      toast.success("Google account connected successfully.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (instagram === "connected") {
      toast.success("Instagram account connected successfully.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (instagram === "error") {
      toast.error("Instagram connection failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetchDashboardData()
      .then((data) => {
        if (!active) return;
        setAgents(data.agents);
        setWorkflows(data.workflows);
        setRuns(data.runs);
        setIntegrations(data.integrations);
      })
      .catch((err) => {
        if (active) {
          setError(getErrorMessage(err, "Failed to load dashboard data."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchDashboardData]);

  const workflowNameById = useMemo(() => {
    const map = new Map();
    for (const wf of workflows) {
      map.set(String(wf._id), wf.name);
    }
    return map;
  }, [workflows]);

  const pendingApprovals = useMemo(
    () =>
      runs.filter(
        (run) =>
          run.status === "approval_required" &&
          (!run.approval?.status || run.approval?.status === "pending")
      ),
    [runs]
  );

  const connectedIntegrationCount = useMemo(() => {
    return Object.values(integrations).filter((item) => item?.connected).length;
  }, [integrations]);

  const completedRunCount = useMemo(
    () => runs.filter((run) => run.status === "completed").length,
    [runs]
  );

  const handleQuickRunWorkflow = async (workflow) => {
    try {
      setRunningWorkflowId(workflow._id);
      const res = await runWorkflowApi(workflow._id, "");
      const status = res?.result?.status;
      if (status === "approval_required") {
        toast.info(`"${workflow.name}" paused for human approval.`);
      } else {
        toast.success(`"${workflow.name}" executed (${status || "done"}).`);
      }
      await loadDashboard();
    } catch (err) {
      toast.error(getErrorMessage(err, "Workflow execution failed."));
    } finally {
      setRunningWorkflowId(null);
    }
  };

  const firstName = currentUser?.name?.split(" ")[0] || "there";

  return (
    <AppLayout
      title="Dashboard"
      subtitle={`Welcome back, ${firstName}. Monitor agents, workflows, runs, and approvals.`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            disabled={loading}
            className="h-9 rounded-xl border-white/10 bg-white/[0.04] text-xs text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw
              size={14}
              className={`mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Link
            to="/chat"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200"
          >
            <MessageSquare size={14} />
            <span>Open Chat</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Pending Approval Banner */}
        {pendingApprovals.length > 0 && (
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
                <ShieldAlert size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-100">
                  {pendingApprovals.length} workflow{" "}
                  {pendingApprovals.length === 1 ? "run requires" : "runs require"}{" "}
                  approval
                </p>
                <p className="text-xs text-amber-200/75">
                  Review proposed actions or AI outputs before execution continues.
                </p>
              </div>
            </div>
            <Link
              to="/approvals"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-amber-300 px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-200"
            >
              <span>Review Approvals</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Quick AI Builder Launcher */}
        <section className={`${panelCls} p-5 sm:p-6`}>
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-300">
                <Sparkles size={12} />
                <span>AI Automation Builder</span>
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                Describe what you want to automate
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Turn a natural-language prompt into a ready-to-save AI agent or a
                multi-step executable workflow with human approval gates.
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-2.5 lg:max-w-xl">
              <input
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                placeholder="e.g., Check my unread emails and summarize urgent items..."
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400/50"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() =>
                    navigate("/agents/generate", {
                      state: { prompt: quickPrompt },
                    })
                  }
                  className="h-9 rounded-xl bg-white px-3.5 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
                >
                  <Sparkles size={14} className="mr-1.5" />
                  Generate Agent
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate("/workflows/studio", {
                      state: { prompt: quickPrompt },
                    })
                  }
                  className="h-9 rounded-xl border-white/15 bg-white/[0.05] px-3.5 text-xs text-zinc-200 hover:bg-white/10 hover:text-white"
                >
                  <GitBranch size={14} className="mr-1.5 text-violet-300" />
                  Generate Workflow
                </Button>
                <Link
                  to="/agents/new"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Plus size={14} />
                  Manual Agent
                </Link>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            to="/agents"
            className={`${panelCls} p-4 transition hover:border-white/20`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Active Agents
              </span>
              <span className="grid size-8 place-items-center rounded-lg bg-violet-500/15 text-violet-300">
                <Bot size={16} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {loading ? "—" : agents.length}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Configured assistants ready to chat
            </p>
          </Link>

          <Link
            to="/workflows"
            className={`${panelCls} p-4 transition hover:border-white/20`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Saved Workflows
              </span>
              <span className="grid size-8 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
                <Workflow size={16} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {loading ? "—" : workflows.length}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Automated multi-step graphs
            </p>
          </Link>

          <Link
            to="/executions"
            className={`${panelCls} p-4 transition hover:border-white/20`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Workflow Runs
              </span>
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
                <Activity size={16} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {loading ? "—" : runs.length}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {loading
                ? "Loading runs..."
                : `${completedRunCount} completed · ${pendingApprovals.length} pending approval`}
            </p>
          </Link>

          <Link
            to="/integrations"
            className={`${panelCls} p-4 transition hover:border-white/20`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">
                Integrations & Credits
              </span>
              <span className="grid size-8 place-items-center rounded-lg bg-amber-500/15 text-amber-300">
                <Plug size={16} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {loading ? "—" : `${connectedIntegrationCount} / 3`}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
              <Coins size={12} className="text-violet-300" />
              <span>
                {Number(currentUser?.credits ?? 0).toLocaleString("en-IN")} credits
                available
              </span>
            </p>
          </Link>
        </section>

        {/* Main Grid: Agents + Workflows + Recent Activity */}
        <section className="grid gap-6 xl:grid-cols-3">
          {/* Left 2 cols: Agents & Workflows */}
          <div className="space-y-6 xl:col-span-2">
            {/* Agents Card Section */}
            <div className={`${panelCls} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Your AI Agents
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Launch a conversation or generate a new specialized agent
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/agents/generate"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs text-zinc-200 hover:bg-white/10"
                  >
                    <Sparkles size={12} className="text-violet-300" />
                    Generate
                  </Link>
                  <Link
                    to="/agents"
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    View all
                  </Link>
                </div>
              </div>

              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-32 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]"
                    />
                  ))}
                </div>
              ) : agents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center">
                  <p className="text-sm font-medium text-zinc-200">
                    No agents created yet
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Use the AI Agent Generator or create one manually.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Link
                      to="/agents/generate"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-medium text-zinc-900"
                    >
                      <Sparkles size={13} />
                      AI Generator
                    </Link>
                    <Link
                      to="/agents/new"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-xs text-zinc-200"
                    >
                      Manual Setup
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {agents.slice(0, 4).map((agent) => {
                    const id = agent._id ?? agent.id;
                    return (
                      <div
                        key={id}
                        className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-black/20 p-4 transition hover:border-white/20"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-zinc-900">
                                <Bot size={16} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">
                                  {agent.name}
                                </p>
                                <p className="text-[11px] text-zinc-500">
                                  {agent.model || "openai/gpt-oss-120b"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-zinc-400">
                            {agent.description || "No description provided."}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                          <div className="flex flex-wrap gap-1">
                            {(agent.tools || []).slice(0, 2).map((tool) => (
                              <Badge
                                key={tool}
                                variant="outline"
                                className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-300"
                              >
                                {tool}
                              </Badge>
                            ))}
                            {(agent.tools?.length || 0) > 2 && (
                              <Badge
                                variant="outline"
                                className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-400"
                              >
                                +{agent.tools.length - 2}
                              </Badge>
                            )}
                          </div>
                          <Link
                            to="/chat"
                            state={{ selectedAgentId: id }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200"
                          >
                            <span>Chat</span>
                            <ArrowRight size={12} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Workflows Card Section */}
            <div className={`${panelCls} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Saved Workflows
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Inspect graphs in Workflow Studio or execute directly
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/workflows/studio"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-xs text-zinc-200 hover:bg-white/10"
                  >
                    <Plus size={12} />
                    New Workflow
                  </Link>
                  <Link
                    to="/workflows"
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    View all
                  </Link>
                </div>
              </div>

              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-32 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]"
                    />
                  ))}
                </div>
              ) : workflows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center">
                  <p className="text-sm font-medium text-zinc-200">
                    No saved workflows yet
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Generate your first workflow from a prompt in Workflow Studio.
                  </p>
                  <Link
                    to="/workflows/studio"
                    className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-medium text-zinc-900"
                  >
                    <GitBranch size={13} />
                    Open Workflow Studio
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {workflows.slice(0, 4).map((wf) => (
                    <div
                      key={wf._id}
                      className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-black/20 p-4 transition hover:border-white/20"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-300">
                              <GitBranch size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {wf.name}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {wf.nodes?.length || 0} nodes ·{" "}
                                {wf.edges?.length || 0} edges
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-zinc-400">
                          {wf.description || "No description provided."}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                        <Link
                          to={`/workflows/studio/${wf._id}`}
                          className="text-xs text-zinc-400 hover:text-white"
                        >
                          View in Studio
                        </Link>
                        <Button
                          type="button"
                          size="sm"
                          disabled={runningWorkflowId === wf._id}
                          onClick={() => handleQuickRunWorkflow(wf)}
                          className="h-7 rounded-lg bg-white px-2.5 text-[11px] font-medium text-zinc-900 hover:bg-zinc-200"
                        >
                          <Play size={11} className="mr-1" />
                          {runningWorkflowId === wf._id ? "Running..." : "Run"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Recent Activity */}
          <div className={`${panelCls} flex flex-col p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Recent Activity
                </h3>
                <p className="text-xs text-zinc-500">
                  Latest workflow executions & approval states
                </p>
              </div>
              <Link
                to="/executions"
                className="text-xs text-zinc-400 hover:text-white"
              >
                History
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-xl border border-white/5 bg-white/[0.02]"
                  />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                <Activity size={22} className="text-zinc-500" />
                <p className="mt-2 text-sm font-medium text-zinc-300">
                  No workflow runs yet
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Run a workflow from Workflow Studio or Workflows to see live
                  activity here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {runs.slice(0, 8).map((run) => {
                  const wfName =
                    workflowNameById.get(String(run.workflowId)) ||
                    "Workflow Run";
                  const targetLink =
                    run.status === "approval_required"
                      ? "/approvals"
                      : `/executions?workflowId=${run.workflowId}&runId=${run._id}`;

                  return (
                    <Link
                      key={run._id}
                      to={targetLink}
                      className="block rounded-xl border border-white/[0.07] bg-black/20 p-3 transition hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-white">
                          {wfName}
                        </p>
                        <RunStatusBadge status={run.status} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>
                          {run.steps ?? 0}{" "}
                          {run.steps === 1 ? "step" : "steps"}
                          {run.currentNodeId ? ` · at ${run.currentNodeId}` : ""}
                        </span>
                        <span>{formatRelativeTime(run.createdAt)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
