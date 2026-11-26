import {
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";

const STATUS_STYLES = {
  completed: {
    label: "Completed",
    cls: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    icon: CheckCircle2,
  },
  approval_required: {
    label: "Approval Required",
    cls: "border-amber-400/30 bg-amber-500/15 text-amber-300",
    icon: ShieldAlert,
  },
  running: {
    label: "Running",
    cls: "border-sky-400/25 bg-sky-500/10 text-sky-300",
    icon: Loader2,
    spin: true,
  },
  rejected: {
    label: "Rejected",
    cls: "border-orange-400/25 bg-orange-500/10 text-orange-300",
    icon: XCircle,
  },
  failed: {
    label: "Failed",
    cls: "border-red-400/25 bg-red-500/10 text-red-300",
    icon: XCircle,
  },
};

export default function RunStatusBadge({ status }) {
  const cfg = STATUS_STYLES[status] || {
    label: status || "Unknown",
    cls: "border-white/10 bg-white/[0.05] text-zinc-300",
    icon: Clock,
  };
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.cls}`}
    >
      <Icon size={12} className={cfg.spin ? "animate-spin" : ""} />
      <span>{cfg.label}</span>
    </span>
  );
}
