import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  GitBranch,
  Loader2,
  RefreshCw,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { useAppShell } from "@/components/layout/AppShellContext";
import ApprovalActionDetails from "@/components/workflows/ApprovalActionDetails";
import RunStatusBadge from "@/components/workflows/RunStatusBadge";
import {
  fetchAllWorkflowRunsApi,
  fetchWorkflowRunsApi,
  fetchWorkflowsApi,
  resumeWorkflowRunApi,
} from "@/features/workflows/workflowApi";
import {
  formatDateTime,
  formatOutput,
  formatRelativeTime,
  getErrorMessage,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const panelCls =
  "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "approval_required", label: "Approval Required" },
  { id: "rejected", label: "Rejected" },
  { id: "failed", label: "Failed" },
];

export default function ExecutionHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshPendingApprovals } = useAppShell();

  const initialWorkflowId = searchParams.get("workflowId") || "all";
  const initialRunId = searchParams.get("runId") || null;

  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] =
    useState(initialWorkflowId);
  const [statusFilter, setStatusFilter] = useState("all");
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(initialRunId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistoryData = useCallback(async () => {
    const [wfRes, runsRes] = await Promise.all([
      fetchWorkflowsApi(),
      selectedWorkflowId !== "all"
        ? fetchWorkflowRunsApi(selectedWorkflowId)
        : fetchAllWorkflowRunsApi(),
    ]);

    return {
      wfList: Array.isArray(wfRes?.workflows) ? wfRes.workflows : [],
      runList: Array.isArray(runsRes?.runs) ? runsRes.runs : [],
    };
  }, [selectedWorkflowId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { wfList, runList } = await fetchHistoryData();
      setWorkflows(wfList);
      setRuns(runList);
      setSelectedRunId((prev) => {
        if (prev && runList.some((r) => r._id === prev)) return prev;
        return runList[0]?._id || null;
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load execution history."));
    } finally {
      setLoading(false);
    }
  }, [fetchHistoryData]);

  useEffect(() => {
    let active = true;
    fetchHistoryData()
      .then(({ wfList, runList }) => {
        if (!active) return;
        setWorkflows(wfList);
        setRuns(runList);
        setSelectedRunId((prev) => {
          if (prev && runList.some((r) => r._id === prev)) return prev;
          return runList[0]?._id || null;
        });
      })
      .catch((err) => {
        if (active) {
          setError(getErrorMessage(err, "Failed to load execution history."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchHistoryData]);

  const workflowMap = useMemo(() => {
    const map = new Map();
    for (const wf of workflows) {
      map.set(String(wf._id), wf);
    }
    return map;
  }, [workflows]);

  const filteredRuns = useMemo(() => {
    if (statusFilter === "all") return runs;
    return runs.filter((r) => r.status === statusFilter);
  }, [runs, statusFilter]);

  const selectedRun =
    filteredRuns.find((r) => r._id === selectedRunId) ||
    filteredRuns[0] ||
    null;

  const handleWorkflowFilterChange = (nextWorkflowId) => {
    setSelectedWorkflowId(nextWorkflowId);
    setSelectedRunId(null);
    if (nextWorkflowId === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ workflowId: nextWorkflowId });
    }
  };

  const handleResume = async (runId, approved) => {
    try {
      await resumeWorkflowRunApi(runId, approved);
      toast.success(
        approved
          ? "Approval granted and workflow resumed."
          : "Workflow run rejected."
      );
      await Promise.all([loadData(), refreshPendingApprovals()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Unable to process approval."));
    }
  };

  return (
    <AppLayout
      title="Execution History"
      subtitle="Inspect workflow run statuses, executed nodes, step outputs, and errors."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="h-9 rounded-xl border-white/10 bg-white/[0.04] text-xs text-zinc-300 hover:bg-white/10"
        >
          <RefreshCw
            size={14}
            className={`mr-1.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <section
          className={`${panelCls} flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === filter.id
                    ? "bg-white text-zinc-900"
                    : "border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="wf-filter"
              className="text-xs text-zinc-400 shrink-0"
            >
              Workflow:
            </label>
            <select
              id="wf-filter"
              value={selectedWorkflowId}
              onChange={(e) => handleWorkflowFilterChange(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-xs text-zinc-200 outline-none [color-scheme:dark] [&>option]:bg-[#1d2026]"
            >
              <option value="all">All Workflows</option>
              {workflows.map((wf) => (
                <option key={wf._id} value={wf._id}>
                  {wf.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-zinc-400">
            <Loader2 size={18} className="mr-2 animate-spin" />
            Loading execution runs...
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
            <Activity size={28} className="text-zinc-500" />
            <h2 className="mt-4 text-base font-semibold text-white">
              No execution runs found
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
              Execute a workflow from Workflows or Workflow Studio to inspect run
              traces and outputs here.
            </p>
            <Link
              to="/workflows"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-medium text-zinc-900"
            >
              Go to Workflows
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Run List */}
            <div className={`${panelCls} space-y-2 p-4`}>
              <p className="px-1 text-xs font-medium text-zinc-400">
                {filteredRuns.length}{" "}
                {filteredRuns.length === 1 ? "run" : "runs"}
              </p>
              <div className="space-y-2">
                {filteredRuns.map((run) => {
                  const wf = workflowMap.get(String(run.workflowId));
                  const active = selectedRun?._id === run._id;
                  return (
                    <button
                      key={run._id}
                      type="button"
                      onClick={() => setSelectedRunId(run._id)}
                      className={`w-full rounded-xl border p-3.5 text-left transition ${
                        active
                          ? "border-violet-400/40 bg-violet-500/10"
                          : "border-white/[0.07] bg-black/20 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-white">
                          {wf?.name || "Workflow"}
                        </p>
                        <RunStatusBadge status={run.status} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>
                          {run.steps ?? run.history?.length ?? 0} steps
                        </span>
                        <span>{formatRelativeTime(run.createdAt)}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">
                        {run._id}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Run Details */}
            {selectedRun && (
              <div className="space-y-5 lg:col-span-2">
                <div className={`${panelCls} space-y-5 p-5`}>
                  <div className="flex flex-col justify-between gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-base font-semibold text-white">
                          {workflowMap.get(String(selectedRun.workflowId))
                            ?.name || "Workflow Run"}
                        </h2>
                        <RunStatusBadge status={selectedRun.status} />
                      </div>
                      <p className="mt-1 font-mono text-xs text-zinc-500">
                        Run ID: {selectedRun._id}
                      </p>
                    </div>
                    {selectedRun.workflowId && (
                      <Link
                        to={`/workflows/studio/${selectedRun.workflowId}`}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-zinc-200 hover:bg-white/10"
                      >
                        <GitBranch size={13} />
                        Open Workflow
                      </Link>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                      <p className="text-[11px] text-zinc-500">Started</p>
                      <p className="mt-1 text-xs font-medium text-zinc-200">
                        {formatDateTime(selectedRun.createdAt)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                      <p className="text-[11px] text-zinc-500">Completed</p>
                      <p className="mt-1 text-xs font-medium text-zinc-200">
                        {formatDateTime(selectedRun.completedAt)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                      <p className="text-[11px] text-zinc-500">Steps Run</p>
                      <p className="mt-1 text-xs font-medium text-zinc-200">
                        {selectedRun.steps ?? selectedRun.history?.length ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
                      <p className="text-[11px] text-zinc-500">Current Node</p>
                      <p className="mt-1 truncate font-mono text-xs font-medium text-zinc-200">
                        {selectedRun.currentNodeId || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Pending Approval Prompt if paused */}
                  {selectedRun.status === "approval_required" &&
                    (!selectedRun.approval?.status ||
                      selectedRun.approval?.status === "pending") && (
                      <ApprovalActionDetails
                        runId={selectedRun._id}
                        workflowName={
                          workflowMap.get(String(selectedRun.workflowId))?.name
                        }
                        currentNodeId={selectedRun.currentNodeId}
                        proposedOutput={selectedRun.currentOutput}
                        proposedAction={
                          selectedRun.approval?.toolId
                            ? {
                                toolId: selectedRun.approval.toolId,
                                args: selectedRun.approval.args || {},
                              }
                            : null
                        }
                        requestedAt={selectedRun.approval?.requestedAt}
                        onDecision={handleResume}
                      />
                    )}

                  {/* Error */}
                  {selectedRun.error && (
                    <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3.5 text-xs text-red-200">
                      <p className="font-semibold">Execution Error</p>
                      <p className="mt-1 text-red-300">{selectedRun.error}</p>
                    </div>
                  )}

                  {/* Approved Action Result */}
                  {selectedRun.actionExecution?.status && (
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-300">
                          Protected Action Execution
                        </span>
                        <Badge
                          variant="outline"
                          className="border-white/15 text-[11px] text-zinc-200"
                        >
                          {selectedRun.actionExecution.status}
                        </Badge>
                      </div>
                      {selectedRun.actionExecution.result && (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-zinc-300">
                          {formatOutput(selectedRun.actionExecution.result)}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Final / Current Output */}
                  {selectedRun.currentOutput !== null &&
                    selectedRun.currentOutput !== undefined &&
                    selectedRun.currentOutput !== "" && (
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-zinc-300">
                          {selectedRun.status === "completed"
                            ? "Final Output"
                            : "Current Output"}
                        </p>
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-3.5 font-sans text-xs leading-5 text-zinc-200">
                          {formatOutput(selectedRun.currentOutput)}
                        </pre>
                      </div>
                    )}

                  {/* Executed Nodes */}
                  <div>
                    <p className="mb-2.5 text-xs font-medium text-zinc-300">
                      Executed Nodes ({selectedRun.history?.length || 0})
                    </p>
                    {!selectedRun.history?.length ? (
                      <p className="rounded-xl border border-white/[0.06] bg-black/20 p-4 text-xs text-zinc-500">
                        No completed node entries recorded for this run.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedRun.history.map((step, index) => (
                          <div
                            key={`${step.nodeId}-${index}`}
                            className="rounded-xl border border-white/[0.08] bg-black/25 p-3.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="grid size-5 place-items-center rounded-md bg-white/10 text-[11px] font-semibold text-zinc-200">
                                  {index + 1}
                                </span>
                                <span className="text-xs font-semibold text-white">
                                  {step.nodeId}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="border-white/10 bg-white/[0.03] text-[10px] text-zinc-400"
                                >
                                  {step.type}
                                </Badge>
                                {step.decision !== undefined && (
                                  <Badge
                                    variant="outline"
                                    className="border-violet-400/25 bg-violet-500/10 text-[10px] text-violet-300"
                                  >
                                    decision: {String(step.decision)}
                                  </Badge>
                                )}
                              </div>
                              <RunStatusBadge status={step.status} />
                            </div>
                            {step.output !== undefined &&
                              step.output !== null &&
                              step.output !== "" && (
                                <pre className="mt-2.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-white/[0.06] bg-black/30 p-2.5 font-sans text-[11px] leading-5 text-zinc-300">
                                  {formatOutput(step.output)}
                                </pre>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
