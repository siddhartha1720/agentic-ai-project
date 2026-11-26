import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  CalendarDays,
  Check,
  ArrowUpRight,
  Unplug,
} from "lucide-react";
import { FaInstagram } from "react-icons/fa";

import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api from "@/api";

const integrationList = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Send and manage emails through your AI agent and workflows.",
    icon: Mail,
    provider: "google",
  },
  {
    id: "googleCalendar",
    name: "Google Calendar",
    description: "Manage calendar events using your AI agent.",
    icon: CalendarDays,
    provider: "google",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Publish images with AI-generated captions and hashtags.",
    icon: FaInstagram,
    provider: "instagram",
  },
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("error")
      ? "Account connection failed. Please try again."
      : "";
  });
  const [success, setSuccess] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      return "Google account connected successfully.";
    }
    if (params.get("instagram") === "connected") {
      return "Instagram account connected successfully.";
    }
    return "";
  });

  const fetchIntegrations = useCallback(async () => {
    try {
      setError("");
      const { data } = await api.get("/api/integrations");
      setIntegrations(data.integrations || {});
    } catch (err) {
      console.error("Failed to fetch integrations:", err);
      setError(
        err.response?.data?.message ||
          "Failed to load integrations. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") || params.get("instagram") || params.get("error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    let active = true;
    api
      .get("/api/integrations")
      .then(({ data }) => {
        if (active) setIntegrations(data.integrations || {});
      })
      .catch((err) => {
        console.error("Failed to fetch integrations:", err);
        if (active) {
          setError(
            err.response?.data?.message ||
              "Failed to load integrations. Please try again."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleConnect = async (id) => {
    try {
      setConnecting(id);
      setError("");
      setSuccess("");

      if (id === "gmail" || id === "googleCalendar") {
        const { data } = await api.get("/api/integrations/google/connect");
        if (!data.success || !data.url) {
          throw new Error("Google authorization URL not received.");
        }
        window.location.assign(data.url);
        return;
      }

      if (id === "instagram") {
        const { data } = await api.get("/api/integrations/instagram/auth");
        if (!data.success || !data.url) {
          throw new Error("Instagram authorization URL not received.");
        }
        window.location.assign(data.url);
        return;
      }
    } catch (err) {
      console.error("Integration connection failed:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to connect integration."
      );
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id) => {
    const integration = integrationList.find((item) => item.id === id);
    if (!integration) return;

    const confirmed = window.confirm(
      `Are you sure you want to disconnect ${integration.name}?`
    );
    if (!confirmed) return;

    try {
      setDisconnecting(id);
      setError("");
      setSuccess("");

      if (integration.provider === "google") {
        await api.post("/api/integrations/google/disconnect");
      } else if (integration.provider === "instagram") {
        await api.post("/api/integrations/instagram/disconnect");
      }

      setSuccess(`${integration.name} disconnected successfully.`);
      await fetchIntegrations();
    } catch (err) {
      console.error("Integration disconnection failed:", err);
      setError(
        err.response?.data?.message ||
          `Failed to disconnect ${integration.name}.`
      );
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <AppLayout
      title="Integrations"
      subtitle="Connect your accounts and let AutoMate AI execute tasks securely."
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
            <p className="text-sm text-emerald-300">{success}</p>
          </div>
        )}

        <div className="space-y-4">
          {integrationList.map((item) => {
            const integration = integrations[item.id];
            const connected = Boolean(integration?.connected);
            const Icon = item.icon;

            const isConnecting = connecting === item.id;
            const isDisconnecting =
              disconnecting === item.id ||
              (item.provider === "google" &&
                disconnecting !== null &&
                integrationList.find((entry) => entry.id === disconnecting)
                  ?.provider === "google");

            return (
              <Card
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] text-white shadow-[0_20px_60px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-900 shadow-[0_8px_24px_rgba(255,255,255,0.1)]">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium text-white">{item.name}</h2>

                        {!loading && connected && (
                          <Badge
                            variant="secondary"
                            className="gap-1 border border-emerald-400/20 bg-emerald-400/10 font-normal text-emerald-300"
                          >
                            <Check className="h-3 w-3" />
                            Connected
                          </Badge>
                        )}
                      </div>

                      <CardTitle className="sr-only">{item.name}</CardTitle>

                      <CardDescription className="max-w-md leading-relaxed text-zinc-400">
                        {item.description}
                      </CardDescription>

                      {connected && (
                        <p className="pt-1 text-xs text-zinc-400">
                          {integration.email ||
                            integration.username ||
                            integration.displayName ||
                            ""}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {connected ? (
                      <Button
                        variant="outline"
                        disabled={loading || isDisconnecting}
                        onClick={() => handleDisconnect(item.id)}
                        className="rounded-xl border-red-400/20 bg-red-400/[0.06] text-red-300 hover:bg-red-400/10 hover:text-red-200"
                      >
                        <Unplug className="mr-2 h-4 w-4" />
                        {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                      </Button>
                    ) : (
                      <Button
                        disabled={loading || isConnecting}
                        onClick={() => handleConnect(item.id)}
                        className="rounded-xl border-0 bg-white text-zinc-900 hover:bg-zinc-200 hover:text-zinc-900"
                      >
                        {loading
                          ? "Loading..."
                          : isConnecting
                            ? "Connecting..."
                            : "Connect"}

                        {!loading && !isConnecting && (
                          <ArrowUpRight className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs leading-relaxed text-zinc-500">
          Your account credentials are not displayed here. Connected
          integrations are managed securely by AutoMate AI.
        </p>
      </div>
    </AppLayout>
  );
}
