import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Activity,
  Bot,
  Coins,
  Download,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plug,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  Workflow,
  X,
} from "lucide-react";

import { logoutApi } from "@/features/auth";
import { fetchAllWorkflowRunsApi } from "@/features/workflows/workflowApi";
import { clearUser } from "@/redux/userSlice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { AppShellContext } from "@/components/layout/AppShellContext";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/chat", label: "Agent Chat", icon: MessageSquare },
    ],
  },
  {
    label: "Build & Automate",
    items: [
      { to: "/agents/generate", label: "AI Agent Generator", icon: Sparkles },
      { to: "/agents", label: "My Agents", icon: Bot, exact: true },
      { to: "/workflows/studio", label: "Workflow Studio", icon: GitBranch },
      { to: "/workflows", label: "Workflows", icon: Workflow, exact: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/executions", label: "Execution History", icon: Activity },
      {
        to: "/approvals",
        label: "Approvals",
        icon: ShieldCheck,
        showApprovalBadge: true,
      },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/integrations", label: "Integrations", icon: Plug },
      { to: "/pricing", label: "Pricing & Credits", icon: Coins },
    ],
  },
];

const FUTURE_ITEMS = [
  { label: "Agent Export", icon: Download },
  { label: "Testing Studio", icon: FlaskConical },
];

export default function AppLayout({
  title,
  subtitle,
  actions,
  fullHeight = false,
  children,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state) => state.auth);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  const refreshPendingApprovals = useCallback(async () => {
    try {
      const data = await fetchAllWorkflowRunsApi("approval_required");
      const runs = Array.isArray(data?.runs) ? data.runs : [];
      const pending = runs.filter(
        (run) =>
          run.status === "approval_required" &&
          (!run.approval?.status || run.approval?.status === "pending")
      );
      setPendingApprovalCount(pending.length);
    } catch {
      // Non-blocking background count
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAllWorkflowRunsApi("approval_required")
      .then((data) => {
        if (!active) return;
        const runs = Array.isArray(data?.runs) ? data.runs : [];
        const pending = runs.filter(
          (run) =>
            run.status === "approval_required" &&
            (!run.approval?.status || run.approval?.status === "pending")
        );
        setPendingApprovalCount(pending.length);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    if (logoutLoading) return;
    try {
      setLogoutLoading(true);
      await logoutApi();
      dispatch(clearUser());
      navigate("/login", { replace: true });
    } finally {
      setLogoutLoading(false);
    }
  };

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to;
    if (item.to === "/workflows/studio") {
      return location.pathname.startsWith("/workflows/studio");
    }
    return (
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`)
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#111318]/95 px-3.5 py-5 backdrop-blur-xl">
      <div className="space-y-6 overflow-y-auto pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Brand */}
        <div className="flex items-center justify-between px-2">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-white text-zinc-900 shadow-[0_6px_20px_rgba(255,255,255,0.16)]">
              <Workflow size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">
                AutoMate AI
              </p>
              <p className="text-[11px] text-zinc-500">Automation Suite</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Create */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <Link
            to="/agents/generate"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-2.5 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200"
          >
            <Sparkles size={13} />
            <span>AI Agent</span>
          </Link>
          <Link
            to="/workflows/studio"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
          >
            <Plus size={13} />
            <span>Workflow</span>
          </Link>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-5" aria-label="Main navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium transition ${
                        active
                          ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          size={16}
                          className={
                            active ? "text-violet-300" : "text-zinc-500"
                          }
                        />
                        <span>{item.label}</span>
                      </span>
                      {item.showApprovalBadge && pendingApprovalCount > 0 && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-400/30">
                          {pendingApprovalCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Future Roadmap Placeholders */}
          <div>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              Upcoming
            </p>
            <div className="space-y-0.5">
              {FUTURE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    aria-disabled="true"
                    title={`${item.label} is a planned future capability`}
                    className="flex cursor-not-allowed items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-zinc-600"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={15} className="text-zinc-600" />
                      <span>{item.label}</span>
                    </span>
                    <Badge
                      variant="outline"
                      className="h-4 border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-zinc-500"
                    >
                      Soon
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* Bottom User Card */}
      <div className="mt-4 space-y-2 border-t border-white/[0.08] pt-3">
        <Link
          to="/pricing"
          className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          <span className="flex items-center gap-2 text-zinc-300">
            <Coins size={14} className="text-violet-300" />
            <span>Credits</span>
          </span>
          <span className="font-semibold text-white">
            {Number(currentUser?.credits ?? 0).toLocaleString("en-IN")}
          </span>
        </Link>

        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.06]">
            {currentUser?.profilePicture ? (
              <img
                src={currentUser.profilePicture}
                alt={currentUser?.name || "Profile"}
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
            ) : (
              <UserRound size={15} className="text-zinc-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-200">
              {currentUser?.name || "User"}
            </p>
            <p className="truncate text-[11px] text-zinc-500">
              {currentUser?.email || ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            title="Logout"
            aria-label="Logout"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AppShellContext.Provider
      value={{ pendingApprovalCount, refreshPendingApprovals }}
    >
      <div
        className={`relative flex ${
          fullHeight ? "h-dvh overflow-hidden" : "min-h-dvh"
        } bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#252934_0%,#15171d_55%,#0e1015_100%)] text-white`}
      >
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)]"
        />

        {/* Desktop Sidebar */}
        <aside className="relative z-20 hidden w-64 shrink-0 border-r border-white/[0.08] lg:block">
          <div className="sticky top-0 h-dvh">{sidebarContent}</div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-10 h-full w-72 border-r border-white/10">
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main Content Column */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          {/* Top Header */}
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/[0.07] bg-[#12141a]/80 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-zinc-300 hover:bg-white/10 hover:text-white lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
                  {title || "AutoMate AI"}
                </h1>
                {subtitle && (
                  <p className="hidden truncate text-xs text-zinc-500 sm:block">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {actions}

              {pendingApprovalCount > 0 && (
                <Link
                  to="/approvals"
                  className="hidden items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 sm:inline-flex"
                >
                  <ShieldCheck size={14} />
                  <span>{pendingApprovalCount} Pending</span>
                </Link>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Account menu"
                    className="size-9 overflow-hidden rounded-xl border-white/10 bg-white/[0.05] p-0 text-zinc-300 hover:bg-white/10 hover:text-white"
                  >
                    {currentUser?.profilePicture ? (
                      <img
                        src={currentUser.profilePicture}
                        alt="Profile"
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    ) : (
                      <UserRound size={16} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 rounded-2xl border border-white/10 bg-[#1d2026]/95 p-1.5 text-zinc-100 shadow-2xl backdrop-blur-xl"
                >
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-medium">
                      {currentUser?.name || "User"}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {currentUser?.email || ""}
                    </p>
                  </div>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => navigate("/pricing")}
                    className="cursor-pointer justify-between rounded-xl py-2 text-zinc-300 focus:bg-white/10 focus:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Coins size={15} className="text-violet-300" />
                      Credits
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                      {Number(currentUser?.credits ?? 0).toLocaleString("en-IN")}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/integrations")}
                    className="cursor-pointer gap-2 rounded-xl py-2 text-zinc-300 focus:bg-white/10 focus:text-white"
                  >
                    <Plug size={15} />
                    Integrations
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    disabled={logoutLoading}
                    className="cursor-pointer gap-2 rounded-xl py-2 text-red-400 focus:bg-red-500/10 focus:text-red-300"
                  >
                    <LogOut size={15} />
                    {logoutLoading ? "Logging out..." : "Logout"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main
            className={
              fullHeight
                ? "flex min-h-0 flex-1 flex-col"
                : "mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
            }
          >
            {children}
          </main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}
