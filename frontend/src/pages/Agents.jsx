import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Download,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import {
  SUPPORTED_MODELS,
  SUPPORTED_TOOLS,
} from "@/constants/capabilities";
import {
  deleteAgentApi,
  fetchAgentsApi,
  updateAgentApi,
} from "@/features/agents/agentApi";
import { getErrorMessage } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const darkPanel =
  "border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";
const whiteBtn =
  "rounded-xl border-0 bg-white text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900";

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const [editingAgent, setEditingAgent] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetchAgentsApi();
      const agentList = Array.isArray(response)
        ? response
        : response?.agents ??
          response?.data?.agents ??
          response?.data ??
          [];

      setAgents(Array.isArray(agentList) ? agentList : []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load agents."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchAgentsApi()
      .then((response) => {
        if (!active) return;
        const agentList = Array.isArray(response)
          ? response
          : response?.agents ??
            response?.data?.agents ??
            response?.data ??
            [];
        setAgents(Array.isArray(agentList) ? agentList : []);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, "Failed to load agents."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (agent) => {
    const agentId = agent._id ?? agent.id;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${agent.name}"?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(agentId);
      setError("");
      await deleteAgentApi(agentId);
      setAgents((previous) =>
        previous.filter((item) => (item._id ?? item.id) !== agentId)
      );
      toast.success(`Deleted "${agent.name}".`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete agent."));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingAgent) return;
    const agentId = editingAgent._id ?? editingAgent.id;

    if (!editingAgent.name?.trim() || !editingAgent.instructions?.trim()) {
      toast.error("Agent name and instructions are required.");
      return;
    }

    try {
      setSavingEdit(true);
      const res = await updateAgentApi(agentId, {
        name: editingAgent.name.trim(),
        description: editingAgent.description?.trim() || "",
        instructions: editingAgent.instructions.trim(),
        model: editingAgent.model,
        tools: editingAgent.tools || [],
      });
      setAgents((prev) =>
        prev.map((a) => ((a._id ?? a.id) === agentId ? res.agent : a))
      );
      setEditingAgent(null);
      toast.success("Agent updated.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update agent."));
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleEditTool = (toolId) => {
    setEditingAgent((prev) => {
      const tools = prev.tools || [];
      return {
        ...prev,
        tools: tools.includes(toolId)
          ? tools.filter((id) => id !== toolId)
          : [...tools, toolId],
      };
    });
  };

  const filteredAgents = agents.filter((agent) => {
    const query = search.toLowerCase();
    return (
      agent.name?.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query)
    );
  });

  return (
    <AppLayout
      title="My Agents"
      subtitle="Manage your AI agents, edit configurations, or launch a chat."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAgents}
            disabled={loading}
            className="h-9 rounded-xl border-white/10 bg-white/[0.04] text-xs text-zinc-300 hover:bg-white/10"
          >
            <RefreshCw
              size={14}
              className={`mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <span
            title="Agent Export is a planned future feature"
            className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-500 sm:inline-flex"
          >
            <Download size={13} />
            Export · Soon
          </span>
          <Link
            to="/agents/generate"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-medium text-zinc-200 hover:bg-white/10"
          >
            <Sparkles size={14} className="text-violet-300" />
            Generate with AI
          </Link>
          <Link
            to="/agents/new"
            className={`inline-flex h-9 items-center gap-1.5 px-3.5 text-xs font-medium ${whiteBtn}`}
          >
            <Plus size={14} />
            Create Manual
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Search and count */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search agents..."
              className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-9 text-white backdrop-blur-xl placeholder:text-zinc-500 focus-visible:border-white/25 focus-visible:ring-white/10"
            />
          </div>

          <p className="text-xs text-zinc-500">
            {agents.length} {agents.length === 1 ? "agent" : "agents"}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-4 text-sm text-red-300">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-zinc-500">
            <RefreshCw size={22} className="animate-spin text-zinc-300" />
            <p className="text-sm">Loading your agents...</p>
          </div>
        ) : filteredAgents.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => {
              const agentId = agent._id ?? agent.id;

              return (
                <article
                  key={agentId}
                  className={`group flex min-h-56 flex-col rounded-2xl p-5 transition hover:border-white/25 hover:bg-white/[0.06] ${darkPanel}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-white text-zinc-900 shadow-[0_8px_24px_rgba(255,255,255,0.1)]">
                      <Bot size={22} />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingAgent({
                            ...agent,
                            tools: Array.isArray(agent.tools) ? agent.tools : [],
                          })
                        }
                        aria-label={`Edit ${agent.name}`}
                        className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(agent)}
                        disabled={deletingId === agentId}
                        aria-label={`Delete ${agent.name}`}
                        className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      >
                        {deletingId === agentId ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>

                  <h2 className="mt-4 truncate text-base font-medium text-white">
                    {agent.name || "Untitled Agent"}
                  </h2>

                  <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-6 text-zinc-400">
                    {agent.description || "No description provided."}
                  </p>

                  {agent.tools?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {agent.tools.slice(0, 3).map((tool) => (
                        <Badge
                          key={tool}
                          variant="outline"
                          className="border-white/10 bg-black/25 text-[10px] text-zinc-300"
                        >
                          {tool}
                        </Badge>
                      ))}
                      {agent.tools.length > 3 && (
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-black/25 text-[10px] text-zinc-400"
                        >
                          +{agent.tools.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3.5">
                    <span className="text-[11px] text-zinc-500">
                      {agent.model || "openai/gpt-oss-120b"}
                    </span>

                    <Link
                      to="/chat"
                      state={{ selectedAgentId: agentId }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <span>Use agent</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 text-center">
            <div className="grid size-12 place-items-center rounded-xl bg-white text-zinc-900">
              <Bot size={23} />
            </div>

            <h2 className="mt-4 text-base font-medium text-white">
              {search ? "No agents found" : "No agents yet"}
            </h2>

            <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
              {search
                ? "Try searching with another name or keyword."
                : "Generate an AI agent from a prompt or create one manually."}
            </p>

            {search ? (
              <Button
                variant="outline"
                onClick={() => setSearch("")}
                className="mt-5 rounded-xl border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/10 hover:text-white"
              >
                Clear search
              </Button>
            ) : (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  to="/agents/generate"
                  className={`inline-flex h-10 items-center gap-2 px-4 text-xs font-medium ${whiteBtn}`}
                >
                  <Sparkles size={15} />
                  <span>AI Agent Generator</span>
                </Link>
                <Link
                  to="/agents/new"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-xs font-medium text-zinc-200 hover:bg-white/10"
                >
                  <Plus size={15} />
                  <span>Create manual</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#171920] p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold">Edit Agent</h3>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Name *
                </label>
                <Input
                  value={editingAgent.name || ""}
                  maxLength={100}
                  onChange={(e) =>
                    setEditingAgent((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="h-10 rounded-xl border-white/10 bg-black/30 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Description
                </label>
                <Input
                  value={editingAgent.description || ""}
                  maxLength={500}
                  onChange={(e) =>
                    setEditingAgent((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="h-10 rounded-xl border-white/10 bg-black/30 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Model
                </label>
                <select
                  value={editingAgent.model || "openai/gpt-oss-120b"}
                  onChange={(e) =>
                    setEditingAgent((prev) => ({
                      ...prev,
                      model: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none [color-scheme:dark] [&>option]:bg-[#1d2026]"
                >
                  {SUPPORTED_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">
                  Instructions *
                </label>
                <Textarea
                  value={editingAgent.instructions || ""}
                  onChange={(e) =>
                    setEditingAgent((prev) => ({
                      ...prev,
                      instructions: e.target.value,
                    }))
                  }
                  className="min-h-36 rounded-xl border-white/10 bg-black/30 text-sm text-white"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-zinc-300">Tools</p>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_TOOLS.map((tool) => {
                    const active = editingAgent.tools?.includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggleEditTool(tool.id)}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                          active
                            ? "border-violet-400/50 bg-violet-500/20 text-white"
                            : "border-white/10 bg-black/25 text-zinc-400 hover:border-white/25"
                        }`}
                      >
                        {tool.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingAgent(null)}
                  className="rounded-xl text-xs text-zinc-400 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-xl bg-white px-4 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
                >
                  {savingEdit && (
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
