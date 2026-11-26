import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { useAppShell } from "@/components/layout/AppShellContext";
import ApprovalActionDetails from "@/components/workflows/ApprovalActionDetails";
import RunStatusBadge from "@/components/workflows/RunStatusBadge";
import {
  fetchAllWorkflowRunsApi,
  fetchWorkflowsApi,
  resumeWorkflowRunApi,
} from "@/features/workflows/workflowApi";
import { formatDateTime, formatOutput, getErrorMessage } from "@/lib/format";
import { Button } from "@/components/ui/button";

const panelCls =
  "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl";

export default function Approvals() {
  const { refreshPendingApprovals } = useAppShell();

  const [workflows, setWorkflows] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const fetchApprovalsData = useCallback(async () => {
    const [wfRes, runsRes] = await Promise.all([
      fetchWorkflowsApi(),
      fetchAllWorkflowRunsApi(),
    ]);
    return {
      workflows: Array.isArray(wfRes?.workflows) ? wfRes.workflows : [],
      runs: Array.isArray(runsRes?.runs) ? runsRes.runs : [],
    };
  }, []);

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchApprovalsData();
      setWorkflows(data.workflows);
      setRuns(data.runs);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load approval requests."));
    } finally {
      setLoading(false);
    }
  }, [fetchApprovalsData]);

  useEffect(() => {
    let active = true;
    fetchApprovalsData()
      .then((data) => {
        if (!active) return;
        setWorkflows(data.workflows);
        setRuns(data.runs);
      })
      .catch((err) => {
        if (active) {
          setError(getErrorMessage(err, "Failed to load approval requests."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchApprovalsData]);

  const workflowMap = useMemo(() => {
    const map = new Map();
    for (const wf of workflows) {
      map.set(String(wf._id), wf);
    }
    return map;
  }, [workflows]);

  const pendingRuns = useMemo(
    () =>
      runs.filter(
        (run) =>
          run.status === "approval_required" &&
          (!run.approval?.status || run.approval?.status === "pending")
      ),
    [runs]
  );

  const decidedRuns = useMemo(
    () =>
      runs.filter(
        (run) =>
          run.approval?.status === "approved" ||
          run.approval?.status === "rejected"
      ),
    [runs]
  );

  const handleDecision = async (runId, approved) => {
    try {
      const res = await resumeWorkflowRunApi(runId, approved);
      setLastResult({
        runId,
        approved,
        status: approved ? res?.result?.status || "completed" : "rejected",
        output: res?.result?.output ?? null,
      });

      toast.success(
        approved
          ? `Approved & resumed (${res?.result?.status || "completed"}).`
          : "Approval request rejected."
      );

      await Promise.all([loadApprovals(), refreshPendingApprovals()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to process approval decision."));
    }
  };

  return (
    <AppLayout
      title="Approvals"
      subtitle="Review and approve or reject paused workflow runs before protected actions execute."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadApprovals}
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
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {lastResult && (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                <CheckCircle2 size={17} className="text-emerald-300" />
                <span>
                  Run {lastResult.runId} {lastResult.approved ? "approved" : "rejected"}
                </span>
              </div>
              <RunStatusBadge status={lastResult.status} />
            </div>
            {lastResult.output && (
              <pre className="mt-2.5 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-3 font-sans text-xs text-zinc-200">
                {formatOutput(lastResult.output)}
              </pre>
            )}
          </div>
        )}

        {/* Pending Queue */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Pending Approval Requests ({pendingRuns.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-zinc-400">
              <Loader2 size={18} className="mr-2 animate-spin" />
              Checking pending approvals...
            </div>
          ) : pendingRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <ShieldCheck size={22} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                All caught up
              </h3>
              <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
                There are no workflow runs waiting for your approval right now.
              </p>
              <Link
                to="/workflows"
                className="mt-4 inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-xs text-zinc-200 hover:bg-white/10"
              >
                Run a Workflow
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRuns.map((run) => {
                const wf = workflowMap.get(String(run.workflowId));
                return (
                  <ApprovalActionDetails
                    key={run._id}
                    runId={run._id}
                    workflowName={wf?.name || "Workflow"}
                    currentNodeId={run.currentNodeId}
                    proposedOutput={run.currentOutput}
                    proposedAction={
                      run.approval?.toolId
                        ? {
                            toolId: run.approval.toolId,
                            args: run.approval.args || {},
                          }
                        : null
                    }
                    requestedAt={run.approval?.requestedAt || run.createdAt}
                    onDecision={handleDecision}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Decided History */}
        {decidedRuns.length > 0 && (
          <section className={`${panelCls} p-5`}>
            <h2 className="mb-3 text-sm font-semibold text-white">
              Recent Approval Decisions
            </h2>
            <div className="space-y-2.5">
              {decidedRuns.slice(0, 10).map((run) => {
                const wf = workflowMap.get(String(run.workflowId));
                return (
                  <Link
                    key={run._id}
                    to={`/executions?workflowId=${run.workflowId}&runId=${run._id}`}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-white/[0.07] bg-black/20 p-3.5 transition hover:border-white/20 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">
                        {wf?.name || "Workflow"}
                        {run.approval?.toolId && (
                          <span className="ml-2 font-mono text-[11px] font-normal text-zinc-400">
                            ({run.approval.toolId})
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        Decided{" "}
                        {formatDateTime(
                          run.approval?.decidedAt || run.completedAt
                        )}
                      </p>
                    </div>
                    <RunStatusBadge status={run.status} />
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
