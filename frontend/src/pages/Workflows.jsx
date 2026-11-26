import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  GitBranch,
  History,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { useAppShell } from "@/components/layout/AppShellContext";
import ApprovalActionDetails from "@/components/workflows/ApprovalActionDetails";
import RunStatusBadge from "@/components/workflows/RunStatusBadge";
import WorkflowGraph from "@/components/workflows/WorkflowGraph";
import {
  fetchWorkflowsApi,
  resumeWorkflowRunApi,
  runWorkflowApi,
} from "@/features/workflows/workflowApi";
import { formatDateTime, formatOutput, getErrorMessage } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const panelCls =
  "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl";

export default function Workflows() {
  const { refreshPendingApprovals } = useAppShell();

  const [workflows, setWorkflows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [runInput, setRunInput] = useState("");
  const [running, setRunning] = useState(false);
  const [latestRun, setLatestRun] = useState(null);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchWorkflowsApi();
      const list = Array.isArray(data?.workflows) ? data.workflows : [];
      setWorkflows(list);
      setSelectedId((prev) => prev || list[0]?._id || null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load workflows."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchWorkflowsApi()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data?.workflows) ? data.workflows : [];
        setWorkflows(list);
        setSelectedId((prev) => prev || list[0]?._id || null);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, "Failed to load workflows."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter(
      (wf) =>
        wf.name?.toLowerCase().includes(q) ||
        wf.description?.toLowerCase().includes(q)
    );
  }, [workflows, search]);

  const selectedWorkflow =
    workflows.find((wf) => wf._id === selectedId) || filtered[0] || null;

  const handleExecute = async () => {
    if (!selectedWorkflow || running) return;
    try {
      setRunning(true);
      const res = await runWorkflowApi(selectedWorkflow._id, runInput);
      const result = res.result || {};
      setLatestRun({
        runId: res.runId,
        workflowId: selectedWorkflow._id,
        status: result.status,
        currentNode: result.currentNode || null,
        output: result.output ?? result.proposedOutput ?? null,
        proposedAction: result.proposedAction || null,
        history: result.history || [],
      });
      await refreshPendingApprovals();

      if (result.status === "approval_required") {
        toast.info(`"${selectedWorkflow.name}" paused for approval.`);
      } else {
        toast.success(`"${selectedWorkflow.name}" completed (${result.status}).`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Workflow execution failed."));
    } finally {
      setRunning(false);
    }
  };

  const handleResumeRun = async (runId, approved) => {
    try {
      const res = await resumeWorkflowRunApi(runId, approved);
      await refreshPendingApprovals();

      if (!approved) {
        setLatestRun((prev) =>
          prev ? { ...prev, status: res.status || "rejected" } : null
        );
        toast.info("Workflow run rejected.");
        return;
      }

      const result = res.result || {};
      setLatestRun((prev) => ({
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
      title="Workflow Management"
      subtitle="Browse saved workflows, inspect their node graphs, and execute runs."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadWorkflows}
            disabled={loading}
            className="h-9 rounded-xl border-white/10 bg-white/[0.04] text-xs text-zinc-300 hover:bg-white/10"
          >
            <RefreshCw
              size={14}
              className={`mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Link
            to="/workflows/studio"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
          >
            <Plus size={14} />
            New Workflow
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-zinc-400">
            <Loader2 size={18} className="mr-2 animate-spin" />
            Loading workflows...
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-white text-zinc-900">
              <GitBranch size={22} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-white">
              No saved workflows yet
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
              Generate your first AI-powered workflow in Workflow Studio.
            </p>
            <Link
              to="/workflows/studio"
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
            >
              <Sparkles size={14} />
              Open Workflow Studio
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left List */}
            <div className={`${panelCls} flex flex-col p-4`}>
              <div className="relative mb-3">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search workflows..."
                  className="h-9 rounded-xl border-white/10 bg-black/25 pl-9 text-xs text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2">
                {filtered.map((wf) => {
                  const active = selectedWorkflow?._id === wf._id;
                  return (
                    <button
                      key={wf._id}
                      type="button"
                      onClick={() => {
                        setSelectedId(wf._id);
                        setLatestRun(null);
                      }}
                      className={`w-full rounded-xl border p-3.5 text-left transition ${
                        active
                          ? "border-violet-400/40 bg-violet-500/10"
                          : "border-white/[0.07] bg-black/20 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {wf.name}
                        </p>
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-300"
                        >
                          {wf.nodes?.length || 0} nodes
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                        {wf.description || "No description provided."}
                      </p>
                      <p className="mt-2 text-[10px] text-zinc-500">
                        Created {formatDateTime(wf.createdAt)}
                      </p>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-xs text-zinc-500">
                    No workflows match "{search}".
                  </p>
                )}
              </div>
            </div>

            {/* Right Detail & Execution Panel */}
            {selectedWorkflow && (
              <div className="space-y-5 lg:col-span-2">
                <div className={`${panelCls} space-y-4 p-5`}>
                  <div className="flex flex-col justify-between gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {selectedWorkflow.name}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">
                        {selectedWorkflow.description ||
                          "No description provided."}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        to={`/executions?workflowId=${selectedWorkflow._id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-zinc-200 hover:bg-white/10"
                      >
                        <History size={14} />
                        History
                      </Link>
                      <Link
                        to={`/workflows/studio/${selectedWorkflow._id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-zinc-200 hover:bg-white/10"
                      >
                        <GitBranch size={14} />
                        Open in Studio
                      </Link>
                    </div>
                  </div>

                  {/* Run Trigger */}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={runInput}
                      onChange={(e) => setRunInput(e.target.value)}
                      placeholder="Optional initial input for this run..."
                      className="h-10 flex-1 rounded-xl border-white/10 bg-black/25 text-sm text-white placeholder:text-zinc-500"
                    />
                    <Button
                      type="button"
                      disabled={running}
                      onClick={handleExecute}
                      className="h-10 rounded-xl bg-white px-5 text-xs font-semibold text-zinc-900 hover:bg-zinc-200"
                    >
                      {running ? (
                        <>
                          <Loader2 size={14} className="mr-1.5 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play size={14} className="mr-1.5" />
                          Execute Workflow
                        </>
                      )}
                    </Button>
                  </div>

                  <WorkflowGraph
                    nodes={selectedWorkflow.nodes}
                    edges={selectedWorkflow.edges}
                    executionHistory={
                      latestRun?.workflowId === selectedWorkflow._id
                        ? latestRun.history
                        : []
                    }
                    currentNodeId={
                      latestRun?.workflowId === selectedWorkflow._id
                        ? latestRun.currentNode
                        : null
                    }
                    runStatus={
                      latestRun?.workflowId === selectedWorkflow._id
                        ? latestRun.status
                        : null
                    }
                  />
                </div>

                {/* Live Run Result */}
                {latestRun?.workflowId === selectedWorkflow._id && (
                  <div className={`${panelCls} space-y-4 p-5`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        Execution Result
                      </h3>
                      <RunStatusBadge status={latestRun.status} />
                    </div>

                    {latestRun.status === "approval_required" && (
                      <ApprovalActionDetails
                        runId={latestRun.runId}
                        workflowName={selectedWorkflow.name}
                        currentNodeId={latestRun.currentNode}
                        proposedOutput={latestRun.output}
                        proposedAction={latestRun.proposedAction}
                        onDecision={handleResumeRun}
                      />
                    )}

                    {latestRun.output !== null &&
                      latestRun.output !== undefined &&
                      latestRun.status !== "approval_required" && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-zinc-400">
                            Output
                          </p>
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-3.5 font-sans text-xs text-zinc-200">
                            {formatOutput(latestRun.output)}
                          </pre>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
