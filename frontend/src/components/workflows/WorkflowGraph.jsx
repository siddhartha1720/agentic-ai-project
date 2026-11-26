import { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Flag,
  GitFork,
  PlayCircle,
  ShieldAlert,
  Wrench,
  XCircle,
} from "lucide-react";

const NODE_WIDTH = 228;
const NODE_HEIGHT = 92;
const COL_GAP = 84;
const ROW_GAP = 42;
const PAD_X = 36;
const PAD_Y = 36;

const NODE_STYLES = {
  start: {
    icon: PlayCircle,
    label: "Start",
    ring: "border-emerald-400/35 bg-emerald-500/[0.08]",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  ai_task: {
    icon: Bot,
    label: "AI Task",
    ring: "border-violet-400/35 bg-violet-500/[0.08]",
    badge: "bg-violet-500/20 text-violet-300",
  },
  condition: {
    icon: GitFork,
    label: "Condition",
    ring: "border-amber-400/35 bg-amber-500/[0.08]",
    badge: "bg-amber-500/20 text-amber-300",
  },
  approval: {
    icon: ShieldAlert,
    label: "Approval",
    ring: "border-orange-400/35 bg-orange-500/[0.08]",
    badge: "bg-orange-500/20 text-orange-300",
  },
  tool_action: {
    icon: Wrench,
    label: "Tool Action",
    ring: "border-sky-400/35 bg-sky-500/[0.08]",
    badge: "bg-sky-500/20 text-sky-300",
  },
  end: {
    icon: Flag,
    label: "End",
    ring: "border-zinc-400/30 bg-white/[0.05]",
    badge: "bg-white/10 text-zinc-300",
  },
};

function computeLayout(nodes = [], edges = []) {
  if (!nodes.length) {
    return { positions: new Map(), width: 400, height: 220 };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const outgoing = new Map();
  const inDegree = new Map();

  for (const n of nodes) {
    outgoing.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      outgoing.get(e.source).push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  }

  // BFS topological depth assignment (handles cycles safely via visited cap)
  const startNode = nodes.find((n) => n.type === "start") || nodes[0];
  const depth = new Map();
  const queue = [];

  if (startNode) {
    depth.set(startNode.id, 0);
    queue.push(startNode.id);
  }

  for (const n of nodes) {
    if ((inDegree.get(n.id) || 0) === 0 && !depth.has(n.id)) {
      depth.set(n.id, 0);
      queue.push(n.id);
    }
  }

  let iterations = 0;
  const maxIterations = nodes.length * nodes.length + 20;
  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const current = queue.shift();
    const currentDepth = depth.get(current) ?? 0;
    for (const next of outgoing.get(current) || []) {
      const candidate = currentDepth + 1;
      if ((depth.get(next) ?? -1) < candidate && candidate < nodes.length + 2) {
        depth.set(next, candidate);
        queue.push(next);
      }
    }
  }

  for (const n of nodes) {
    if (!depth.has(n.id)) depth.set(n.id, 0);
  }

  // Group into columns by depth
  const columns = new Map();
  for (const n of nodes) {
    const col = depth.get(n.id) ?? 0;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col).push(n);
  }

  const sortedCols = [...columns.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(
    1,
    ...sortedCols.map((col) => columns.get(col).length)
  );

  const totalHeight = Math.max(
    240,
    PAD_Y * 2 + maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP
  );
  const totalWidth = Math.max(
    520,
    PAD_X * 2 +
      sortedCols.length * NODE_WIDTH +
      Math.max(0, sortedCols.length - 1) * COL_GAP
  );

  const positions = new Map();
  sortedCols.forEach((colKey, colIndex) => {
    const group = columns.get(colKey);
    const groupHeight =
      group.length * NODE_HEIGHT + Math.max(0, group.length - 1) * ROW_GAP;
    const startY = (totalHeight - groupHeight) / 2;
    const x = PAD_X + colIndex * (NODE_WIDTH + COL_GAP);

    group.forEach((node, rowIndex) => {
      const y = startY + rowIndex * (NODE_HEIGHT + ROW_GAP);
      positions.set(node.id, { x, y });
    });
  });

  return { positions, width: totalWidth, height: totalHeight };
}

function summarizeConfig(node) {
  const cfg = node.config || {};
  if (node.type === "ai_task") {
    return cfg.prompt ? String(cfg.prompt) : "No prompt configured";
  }
  if (node.type === "tool_action") {
    return cfg.toolId ? `Tool: ${cfg.toolId}` : "No tool configured";
  }
  if (node.type === "condition") {
    if (cfg.field && cfg.operator) {
      return `${cfg.field} ${cfg.operator} ${JSON.stringify(cfg.value ?? "")}`;
    }
    return "Branch condition";
  }
  if (node.type === "approval") {
    return "Human review required";
  }
  if (node.type === "start") {
    return "Workflow trigger / input";
  }
  return "Final workflow output";
}

export default function WorkflowGraph({
  nodes = [],
  edges = [],
  selectedNodeId = null,
  onSelectNode,
  executionHistory = [],
  currentNodeId = null,
  runStatus = null,
}) {
  const { positions, width, height } = useMemo(
    () => computeLayout(nodes, edges),
    [nodes, edges]
  );

  const nodeStatusMap = useMemo(() => {
    const map = new Map();
    for (const step of executionHistory || []) {
      if (step?.nodeId) {
        map.set(step.nodeId, step.status || "completed");
      }
    }
    if (currentNodeId && runStatus === "approval_required") {
      map.set(currentNodeId, "approval_required");
    }
    return map;
  }, [executionHistory, currentNodeId, runStatus]);

  if (!nodes.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-xs text-zinc-500">
        No workflow nodes to display.
      </div>
    );
  }

  return (
    <div className="relative overflow-auto rounded-2xl border border-white/10 bg-[#0d0f14] bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:20px_20px]">
      <div
        className="relative"
        style={{ width: `${width}px`, height: `${height}px`, minWidth: "100%" }}
      >
        {/* SVG Edges Layer */}
        <svg
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0"
        >
          <defs>
            <marker
              id="wf-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,1 L7,4 L0,7 Z" fill="rgba(161,161,170,0.65)" />
            </marker>
            <marker
              id="wf-arrow-true"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,1 L7,4 L0,7 Z" fill="rgba(52,211,153,0.85)" />
            </marker>
            <marker
              id="wf-arrow-false"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,1 L7,4 L0,7 Z" fill="rgba(251,146,60,0.85)" />
            </marker>
          </defs>

          {edges.map((edge, idx) => {
            const from = positions.get(edge.source);
            const to = positions.get(edge.target);
            if (!from || !to) return null;

            const startX = from.x + NODE_WIDTH;
            const startY = from.y + NODE_HEIGHT / 2;
            const endX = to.x;
            const endY = to.y + NODE_HEIGHT / 2;

            const isBackward = endX <= startX;
            const dx = Math.max(48, Math.abs(endX - startX) * 0.5);
            const pathD = isBackward
              ? `M ${startX} ${startY} C ${startX + 60} ${startY - 60}, ${endX - 60} ${endY - 60}, ${endX} ${endY}`
              : `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

            const stroke =
              edge.condition === "true"
                ? "rgba(52,211,153,0.65)"
                : edge.condition === "false"
                  ? "rgba(251,146,60,0.65)"
                  : "rgba(161,161,170,0.45)";

            const markerEnd =
              edge.condition === "true"
                ? "url(#wf-arrow-true)"
                : edge.condition === "false"
                  ? "url(#wf-arrow-false)"
                  : "url(#wf-arrow)";

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            return (
              <g key={`${edge.source}-${edge.target}-${idx}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2"
                  markerEnd={markerEnd}
                />
                {edge.condition && (
                  <g transform={`translate(${midX - 18}, ${midY - 10})`}>
                    <rect
                      width="36"
                      height="20"
                      rx="6"
                      fill="#151821"
                      stroke={stroke}
                      strokeWidth="1"
                    />
                    <text
                      x="18"
                      y="13"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill={
                        edge.condition === "true" ? "#6ee7b7" : "#fdba74"
                      }
                    >
                      {edge.condition}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* HTML Nodes Layer */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const style = NODE_STYLES[node.type] || NODE_STYLES.ai_task;
          const Icon = style.icon;
          const isSelected = selectedNodeId === node.id;
          const execStatus = nodeStatusMap.get(node.id);

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode?.(node)}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
              }}
              className={`absolute flex flex-col justify-between rounded-xl border p-3 text-left backdrop-blur-md transition ${style.ring} ${
                isSelected
                  ? "ring-2 ring-white/80 shadow-[0_0_24px_rgba(167,139,250,0.28)]"
                  : "hover:brightness-110"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
                >
                  <Icon size={11} />
                  {style.label}
                </span>

                {execStatus === "completed" && (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                )}
                {execStatus === "approval_required" && (
                  <ShieldAlert
                    size={14}
                    className="animate-pulse text-amber-300"
                  />
                )}
                {execStatus === "rejected" && (
                  <XCircle size={14} className="text-orange-400" />
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">
                  {node.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                  {summarizeConfig(node)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
