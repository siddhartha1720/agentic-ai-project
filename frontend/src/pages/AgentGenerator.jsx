import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Plug,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import {
  AGENT_FIELD_LIMITS,
  DEFAULT_MODEL,
  INTEGRATION_LABELS,
  SUPPORTED_MODELS,
  SUPPORTED_TOOLS,
} from "@/constants/capabilities";
import { createAgentApi, generateAgentApi } from "@/features/agents/agentApi";
import { fetchIntegrationsApi } from "@/features/integrations/integrationApi";
import { getErrorMessage } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const panelCls =
  "rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl";
const fieldCls =
  "rounded-xl border-white/10 bg-black/25 text-sm text-white placeholder:text-zinc-500 focus-visible:border-white/25 focus-visible:ring-0";

const SAMPLE_PROMPTS = [
  "Create an HR recruitment assistant that reads candidate emails, drafts interview invitations for approval, and schedules interviews on Google Calendar.",
  "Build an inbox triage assistant that checks my unread Gmail messages, reads important threads, and summarizes action items with current dates.",
  "Create a social media assistant that analyzes uploaded product images and prepares Instagram posts with captions for my approval.",
];

export default function AgentGenerator() {
  const location = useLocation();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState(location.state?.prompt || "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [unsupportedDetails, setUnsupportedDetails] = useState([]);

  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState(null);
  const [savedAgent, setSavedAgent] = useState(null);
  const [integrations, setIntegrations] = useState({});

  useEffect(() => {
    fetchIntegrationsApi()
      .then((res) => setIntegrations(res?.integrations || {}))
      .catch(() => {});
  }, []);

  const trimmedPrompt = prompt.trim();
  const promptTooShort =
    trimmedPrompt.length > 0 && trimmedPrompt.length < AGENT_FIELD_LIMITS.promptMin;

  const isIntegrationConnected = (key) => {
    if (key === "gmail") return Boolean(integrations?.gmail?.connected);
    if (key === "google_calendar")
      return Boolean(integrations?.googleCalendar?.connected);
    if (key === "instagram") return Boolean(integrations?.instagram?.connected);
    return false;
  };

  const requiredIntegrations = useMemo(() => {
    if (!draft) return [];
    const set = new Set();
    for (const tool of SUPPORTED_TOOLS) {
      if ((draft.tools || []).includes(tool.id)) {
        for (const integ of tool.integrations) {
          set.add(integ);
        }
      }
    }
    return [...set];
  }, [draft]);

  const handleGenerate = async (event) => {
    event.preventDefault();
    setError("");
    setUnsupportedDetails([]);
    setSavedAgent(null);

    if (trimmedPrompt.length < AGENT_FIELD_LIMITS.promptMin) {
      setError(
        `Please enter at least ${AGENT_FIELD_LIMITS.promptMin} characters describing your agent.`
      );
      return;
    }

    try {
      setGenerating(true);
      const data = await generateAgentApi(trimmedPrompt);
      setDraft({
        name: data.draft?.name || "",
        description: data.draft?.description || "",
        instructions: data.draft?.instructions || "",
        model: data.draft?.model || DEFAULT_MODEL,
        temperature:
          typeof data.draft?.temperature === "number"
            ? data.draft.temperature
            : 0.7,
        tools: Array.isArray(data.draft?.tools) ? data.draft.tools : [],
      });
      setMeta(data.meta || null);
      toast.success("Agent configuration generated. Review and customize before saving.");
    } catch (err) {
      const details = err?.response?.data?.details?.unsupportedRequests;
      if (Array.isArray(details)) {
        setUnsupportedDetails(details);
      }
      setError(getErrorMessage(err, "Failed to generate agent configuration."));
    } finally {
      setGenerating(false);
    }
  };

  const updateDraft = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const toggleTool = (toolId) => {
    setDraft((prev) => {
      const current = prev.tools || [];
      return {
        ...prev,
        tools: current.includes(toolId)
          ? current.filter((id) => id !== toolId)
          : [...current, toolId],
      };
    });
  };

  const handleSaveAgent = async () => {
    if (!draft) return;
    setError("");

    if (!draft.name.trim() || !draft.instructions.trim()) {
      setError("Agent name and instructions are required before saving.");
      return;
    }

    try {
      setSaving(true);
      const res = await createAgentApi({
        name: draft.name.trim(),
        description: draft.description.trim(),
        instructions: draft.instructions.trim(),
        model: draft.model,
        temperature: Number(draft.temperature),
        tools: draft.tools,
      });
      setSavedAgent(res.agent);
      toast.success(`Agent "${res.agent?.name}" saved!`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save agent."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="AI Agent Generator"
      subtitle="Describe your agent in plain English, review & edit the generated configuration, and save."
      actions={
        <Link
          to="/agents/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          Manual Agent Form
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Prompt Input Card */}
        <section className={`${panelCls} p-5 sm:p-6`}>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="flex items-center justify-between">
              <label
                htmlFor="agent-prompt"
                className="flex items-center gap-2 text-sm font-medium text-white"
              >
                <Sparkles size={16} className="text-violet-300" />
                <span>What should this agent do?</span>
              </label>
              <span
                className={`text-xs ${
                  promptTooShort ? "text-amber-300" : "text-zinc-500"
                }`}
              >
                {trimmedPrompt.length} / {AGENT_FIELD_LIMITS.promptMax} chars
              </span>
            </div>

            <Textarea
              id="agent-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={AGENT_FIELD_LIMITS.promptMax}
              placeholder="Describe the agent's role, tasks, and which tools it should use (minimum 12 characters)..."
              className={`min-h-28 resize-y leading-6 ${fieldCls}`}
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-zinc-500">Examples:</span>
              {SAMPLE_PROMPTS.map((sample, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setPrompt(sample)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-left text-[11px] text-zinc-300 transition hover:border-white/25 hover:bg-white/[0.07]"
                >
                  {sample.slice(0, 52)}...
                </button>
              ))}
            </div>

            {error && (
              <div className="space-y-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3.5 text-xs text-red-200">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
                {unsupportedDetails.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-red-300/90">
                    {unsupportedDetails.map((item, idx) => (
                      <li key={idx}>
                        <span className="font-medium">{item.request}:</span>{" "}
                        {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button
                type="submit"
                disabled={generating || trimmedPrompt.length < AGENT_FIELD_LIMITS.promptMin}
                className="h-10 rounded-xl bg-white px-5 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
              >
                {generating ? (
                  <>
                    <Loader2 size={15} className="mr-2 animate-spin" />
                    Generating config...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} className="mr-2" />
                    {draft ? "Regenerate Draft" : "Generate Agent Config"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </section>

        {/* Saved Banner */}
        {savedAgent && (
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-emerald-100">
                  "{savedAgent.name}" is saved and active
                </p>
                <p className="text-xs text-emerald-200/75">
                  Start chatting with your new agent right away or manage it in My Agents.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/agents")}
                className="h-9 rounded-xl border-white/15 bg-white/[0.05] text-xs text-white hover:bg-white/10"
              >
                My Agents
              </Button>
              <Button
                type="button"
                onClick={() =>
                  navigate("/chat", {
                    state: { selectedAgentId: savedAgent._id },
                  })
                }
                className="h-9 rounded-xl bg-white px-3.5 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
              >
                <MessageSquare size={14} className="mr-1.5" />
                Chat Now
              </Button>
            </div>
          </div>
        )}

        {/* Draft Preview & Editor */}
        {draft && (
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Left 2 cols: Editable Configuration */}
            <div className={`${panelCls} space-y-5 p-5 sm:p-6 lg:col-span-2`}>
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-white text-zinc-900">
                    <Bot size={18} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Generated Agent Preview
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Edit any field before saving to your workspace
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-violet-400/25 bg-violet-500/10 text-[11px] text-violet-300"
                >
                  Groq Runtime
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Agent Name *
                  </label>
                  <Input
                    value={draft.name}
                    maxLength={AGENT_FIELD_LIMITS.name}
                    onChange={(e) => updateDraft("name", e.target.value)}
                    className={`h-10 ${fieldCls}`}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Model
                  </label>
                  <select
                    value={draft.model}
                    onChange={(e) => updateDraft("model", e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-zinc-200 outline-none [color-scheme:dark] focus:border-white/25 [&>option]:bg-[#1d2026]"
                  >
                    {SUPPORTED_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.hint})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Description
                </label>
                <Input
                  value={draft.description}
                  maxLength={AGENT_FIELD_LIMITS.description}
                  onChange={(e) => updateDraft("description", e.target.value)}
                  className={`h-10 ${fieldCls}`}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">
                    Temperature ({Number(draft.temperature).toFixed(1)})
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    0 = deterministic · 2 = creative
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={draft.temperature}
                  onChange={(e) =>
                    updateDraft("temperature", parseFloat(e.target.value))
                  }
                  className="w-full accent-violet-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  System Instructions *
                </label>
                <Textarea
                  value={draft.instructions}
                  maxLength={AGENT_FIELD_LIMITS.instructions}
                  onChange={(e) => updateDraft("instructions", e.target.value)}
                  className={`min-h-48 resize-y leading-6 ${fieldCls}`}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-zinc-300">
                  Selected Capabilities ({draft.tools.length})
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUPPORTED_TOOLS.map((tool) => {
                    const selected = draft.tools.includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggleTool(tool.id)}
                        className={`flex items-start justify-between gap-2.5 rounded-xl border p-3 text-left transition ${
                          selected
                            ? "border-violet-400/40 bg-violet-500/10"
                            : "border-white/10 bg-black/20 hover:border-white/20"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-medium text-white">
                              {tool.name}
                            </p>
                            {tool.requiresApproval && (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                                Approval
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-4 text-zinc-400">
                            {tool.description}
                          </p>
                        </div>
                        <span
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                            selected
                              ? "border-white bg-white text-zinc-900"
                              : "border-white/20"
                          }`}
                        >
                          {selected && <Check size={11} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveAgent}
                  className="h-10 rounded-xl bg-white px-5 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      Saving Agent...
                    </>
                  ) : (
                    <>
                      <Save size={14} className="mr-2" />
                      Save Agent
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right col: Meta Insights & Integration Readiness */}
            <div className="space-y-4">
              {/* Required Integrations */}
              <div className={`${panelCls} p-5`}>
                <div className="mb-3 flex items-center gap-2">
                  <Plug size={15} className="text-violet-300" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Required Integrations
                  </h3>
                </div>
                {requiredIntegrations.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No external OAuth integration required for the current tool selection.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {requiredIntegrations.map((integKey) => {
                      const connected = isIntegrationConnected(integKey);
                      return (
                        <div
                          key={integKey}
                          className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5"
                        >
                          <span className="text-xs font-medium text-zinc-200">
                            {INTEGRATION_LABELS[integKey] || integKey}
                          </span>
                          {connected ? (
                            <span className="text-[11px] font-medium text-emerald-300">
                              Connected
                            </span>
                          ) : (
                            <Link
                              to="/integrations"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 hover:underline"
                            >
                              Connect
                              <ArrowRight size={11} />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Warnings / Unsupported Requests */}
              {(meta?.warnings?.length > 0 ||
                meta?.unsupportedRequests?.length > 0) && (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5">
                  <div className="mb-2 flex items-center gap-2 text-amber-200">
                    <AlertTriangle size={15} />
                    <h3 className="text-xs font-semibold uppercase tracking-wider">
                      Capability Notes
                    </h3>
                  </div>
                  {meta?.warnings?.map((warn, i) => (
                    <p key={i} className="text-xs leading-5 text-amber-100/90">
                      {warn}
                    </p>
                  ))}
                  {meta?.unsupportedRequests?.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5 border-t border-amber-400/20 pt-2.5 text-xs text-amber-200/80">
                      {meta.unsupportedRequests.map((item, i) => (
                        <li key={i}>
                          <span className="font-medium text-amber-100">
                            {item.request}:
                          </span>{" "}
                          {item.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Approval Tools */}
              {meta?.approvalRequiredTools?.length > 0 && (
                <div className={`${panelCls} p-5`}>
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldAlert size={15} className="text-amber-300" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      Human-in-the-Loop
                    </h3>
                  </div>
                  <p className="text-xs leading-5 text-zinc-400">
                    These tools always pause for explicit approval before side
                    effects run:
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {meta.approvalRequiredTools.map((toolId) => (
                      <Badge
                        key={toolId}
                        variant="outline"
                        className="border-amber-400/25 bg-amber-500/10 text-[11px] text-amber-200"
                      >
                        {toolId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested First Prompts */}
              {meta?.suggestedFirstMessages?.length > 0 && (
                <div className={`${panelCls} p-5`}>
                  <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Suggested Test Prompts
                  </h3>
                  <ul className="space-y-2">
                    {meta.suggestedFirstMessages.map((msg, i) => (
                      <li
                        key={i}
                        className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 text-xs leading-5 text-zinc-300"
                      >
                        "{msg}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
