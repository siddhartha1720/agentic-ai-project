import { useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  Loader2,
  Mail,
  ShieldAlert,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime, formatOutput } from "@/lib/format";

export default function ApprovalActionDetails({
  runId,
  workflowName,
  currentNodeId,
  proposedOutput,
  proposedAction,
  requestedAt,
  onDecision,
  disabled = false,
}) {
  const [submitting, setSubmitting] = useState(null);

  const handleAction = async (approved) => {
    if (!onDecision || submitting) return;
    try {
      setSubmitting(approved ? "approve" : "reject");
      await onDecision(runId, approved);
    } finally {
      setSubmitting(null);
    }
  };

  const toolId = proposedAction?.toolId;
  const args = proposedAction?.args || {};

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
            {toolId === "send_email" ? (
              <Mail size={19} />
            ) : toolId === "create_calendar_event" ? (
              <CalendarDays size={19} />
            ) : (
              <ShieldAlert size={19} />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                {toolId === "send_email"
                  ? "Approve Email Send"
                  : toolId === "create_calendar_event"
                    ? "Approve Calendar Event"
                    : "Human Approval Required"}
              </h3>
              {workflowName && (
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-zinc-300">
                  {workflowName}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              Run <span className="font-mono text-zinc-300">{runId}</span>
              {currentNodeId ? ` · Node: ${currentNodeId}` : ""}
              {requestedAt ? ` · Requested ${formatDateTime(requestedAt)}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Action / Output Details */}
      <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/30 p-3.5 text-xs">
        {toolId === "send_email" ? (
          <>
            <div>
              <p className="text-[11px] text-zinc-500">To</p>
              <p className="mt-0.5 break-all font-medium text-zinc-100">
                {args.to || "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Subject</p>
              <p className="mt-0.5 font-medium text-zinc-100">
                {args.subject || "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Body</p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-zinc-300">
                {args.body || "—"}
              </pre>
            </div>
          </>
        ) : toolId === "create_calendar_event" ? (
          <>
            <div>
              <p className="text-[11px] text-zinc-500">Event Title</p>
              <p className="mt-0.5 font-medium text-zinc-100">
                {args.summary || "—"}
              </p>
            </div>
            {args.description && (
              <div>
                <p className="text-[11px] text-zinc-500">Description</p>
                <p className="mt-0.5 whitespace-pre-wrap text-zinc-300">
                  {args.description}
                </p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] text-zinc-500">Start</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-zinc-200">
                  <Clock size={12} />
                  {args.startDateTime
                    ? formatDateTime(args.startDateTime)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500">End</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-zinc-200">
                  <Clock size={12} />
                  {args.endDateTime ? formatDateTime(args.endDateTime) : "—"}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Timezone: {args.timeZone || "Asia/Kolkata"}
            </p>
          </>
        ) : (
          <div>
            <p className="text-[11px] text-zinc-500">
              Proposed Output / Context to Review
            </p>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-5 text-zinc-200">
              {formatOutput(proposedOutput) || "No output payload generated yet."}
            </pre>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || Boolean(submitting)}
          onClick={() => handleAction(false)}
          className="h-9 rounded-xl border-red-400/30 bg-red-500/10 px-4 text-xs font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200"
        >
          {submitting === "reject" ? (
            <Loader2 size={14} className="mr-1.5 animate-spin" />
          ) : (
            <X size={14} className="mr-1.5" />
          )}
          Reject
        </Button>
        <Button
          type="button"
          disabled={disabled || Boolean(submitting)}
          onClick={() => handleAction(true)}
          className="h-9 rounded-xl bg-white px-4 text-xs font-semibold text-zinc-900 hover:bg-zinc-200"
        >
          {submitting === "approve" ? (
            <Loader2 size={14} className="mr-1.5 animate-spin" />
          ) : (
            <Check size={14} className="mr-1.5" />
          )}
          Approve & Resume
        </Button>
      </div>
    </div>
  );
}
