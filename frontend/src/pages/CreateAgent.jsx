import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Check, Plus, Sparkles } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import {
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  SUPPORTED_TOOLS,
} from "@/constants/capabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAgentApi } from "@/features/agents/agentApi";

const darkPanel =
  "border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";

const fieldCls =
  "rounded-xl border-white/10 bg-white/[0.04] text-sm text-white backdrop-blur-xl placeholder:text-zinc-500 focus-visible:border-white/25 focus-visible:ring-0";

export default function CreateAgent() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    description: "",
    instructions: "",
    model: DEFAULT_MODEL,
    temperature: 0.7,
    tools: [],
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toggleTool = (toolId) => {
    setForm((previous) => ({
      ...previous,
      tools: previous.tools.includes(toolId)
        ? previous.tools.filter((item) => item !== toolId)
        : [...previous.tools, toolId],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim() || !form.instructions.trim()) {
      setError("Agent name and instructions are required.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        model: form.model,
        temperature: Number(form.temperature),
        tools: form.tools,
      };

      await createAgentApi(payload);

      navigate("/agents", {
        replace: true,
        state: {
          successMessage: "Agent created successfully!",
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to create agent. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="Create Agent (Manual)"
      subtitle="Manually configure your AI agent's instructions, model, and capabilities."
      actions={
        <Link
          to="/agents/generate"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-zinc-200 hover:bg-white/10"
        >
          <Sparkles size={14} className="text-violet-300" />
          Try AI Generator
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-white text-zinc-900 shadow-[0_10px_40px_rgba(255,255,255,0.12)]">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Manual Agent Configuration
            </h2>
            <p className="text-xs text-zinc-500">
              Define exact instructions, model parameters, and tools.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`space-y-7 rounded-3xl p-5 sm:p-7 ${darkPanel}`}
        >
          {/* Basic details */}
          <section className="space-y-5">
            <div>
              <label
                htmlFor="agent-name"
                className="mb-2 block text-xs font-medium text-zinc-300"
              >
                Agent name <span className="text-violet-300">*</span>
              </label>

              <Input
                id="agent-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="e.g. Research Assistant"
                maxLength={100}
                required
                className={`h-11 ${fieldCls}`}
              />
            </div>

            <div>
              <label
                htmlFor="agent-description"
                className="mb-2 block text-xs font-medium text-zinc-300"
              >
                Description
              </label>

              <Input
                id="agent-description"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="What does your agent do?"
                maxLength={500}
                className={`h-11 ${fieldCls}`}
              />
            </div>

            <div>
              <label
                htmlFor="agent-instructions"
                className="mb-2 block text-xs font-medium text-zinc-300"
              >
                Instructions <span className="text-violet-300">*</span>
              </label>

              <Textarea
                id="agent-instructions"
                value={form.instructions}
                onChange={(event) =>
                  updateField("instructions", event.target.value)
                }
                placeholder="You are a helpful AI assistant. Your job is to..."
                required
                className={`min-h-40 resize-y leading-6 ${fieldCls}`}
              />
            </div>
          </section>

          {/* Model & Temperature */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="agent-model"
                className="mb-2 block text-xs font-medium text-zinc-300"
              >
                AI model
              </label>

              <select
                id="agent-model"
                value={form.model}
                onChange={(event) => updateField("model", event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-200 outline-none transition [color-scheme:dark] focus:border-white/25 [&>option]:bg-[#1d2026] [&>option]:text-zinc-200"
              >
                {SUPPORTED_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="agent-temp"
                className="mb-2 block text-xs font-medium text-zinc-300"
              >
                Temperature ({Number(form.temperature).toFixed(1)})
              </label>
              <input
                id="agent-temp"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={(e) =>
                  updateField("temperature", parseFloat(e.target.value))
                }
                className="mt-3 w-full accent-violet-400"
              />
            </div>
          </section>

          {/* Tools */}
          <section>
            <div className="mb-3">
              <h2 className="text-xs font-medium text-zinc-300">Tools</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Select the platform capabilities available to your agent.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              {SUPPORTED_TOOLS.map((tool, index) => {
                const selected = form.tools.includes(tool.id);

                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => toggleTool(tool.id)}
                    className={`flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition ${
                      index !== 0 ? "border-t border-white/[0.08]" : ""
                    } ${
                      selected
                        ? "bg-white/[0.09]"
                        : "bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-zinc-100">
                          {tool.name}
                        </p>
                        {tool.requiresApproval && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                            Approval
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] text-zinc-500">
                        {tool.description}
                      </p>
                    </div>

                    <span
                      className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border ${
                        selected
                          ? "border-white bg-white text-zinc-900"
                          : "border-white/20 text-transparent"
                      }`}
                    >
                      {selected && <Check size={12} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-xs text-red-300"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/agents")}
              className="rounded-xl text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="h-10 rounded-xl bg-white px-5 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
            >
              {saving ? "Creating..." : "Create agent"}
              {!saving && <Plus size={15} className="ml-2" />}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
