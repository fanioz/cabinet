"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Check, X, ExternalLink, Copy } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useLocale } from "@/i18n/use-locale";
import { WebTerminal, type WebTerminalHandle } from "@/components/terminal/web-terminal";
import { ProviderSetupSteps, type SetupStep } from "@/components/settings/provider-setup-steps";

// Get a provider from "not installed" to "ready" without leaving the app.
// Two columns: the official numbered steps on the left (the SAME component the
// Settings guide uses, so they never differ), and a live, theme-colored
// terminal on the right that the Install / Sign in / Run buttons drive — the
// user watches it work instead of typing into it.

interface ProviderInfo {
  id: string;
  name: string;
  installSteps?: SetupStep[];
}
interface ProviderStatus {
  id: string; name: string; available: boolean; authenticated: boolean;
}

// Single-API-key providers get an inline key field (writes .cabinet.env) rather
// than a throwaway `export` in the terminal.
const API_KEY_ENV: Record<string, string> = { "grok-cli": "XAI_API_KEY" };

const findStep = (steps: SetupStep[] | undefined, re: RegExp) =>
  steps?.find((s) => s.command && re.test(s.title)) ?? null;

// When a provider becomes the ONLY ready one while the configured default isn't
// ready, point new agents at it. Full read-modify-write — the providers PUT
// resets disabledProviderIds/migrations on a partial write.
async function promoteSoleReadyDefault(providerId: string): Promise<void> {
  try {
    const [provRes, statRes] = await Promise.all([
      fetch("/api/agents/providers", { cache: "no-store" }),
      fetch("/api/agents/providers/status", { cache: "no-store" }),
    ]);
    if (!provRes.ok || !statRes.ok) return;
    const prov = (await provRes.json()) as {
      providers: Array<{ id: string; enabled?: boolean }>;
      defaultProvider?: string; defaultModel?: string; defaultEffort?: string;
    };
    const stat = (await statRes.json()) as {
      providers: Array<{ id: string; available: boolean; authenticated: boolean }>;
    };
    const readyIds = stat.providers.filter((p) => p.available && p.authenticated).map((p) => p.id);
    if (readyIds.length !== 1 || readyIds[0] !== providerId) return;
    if (prov.defaultProvider && readyIds.includes(prov.defaultProvider)) return;
    await fetch("/api/agents/providers", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultProvider: providerId, defaultModel: prov.defaultModel, defaultEffort: prov.defaultEffort,
        disabledProviderIds: prov.providers.filter((p) => p.enabled === false).map((p) => p.id),
        migrations: [],
      }),
    });
  } catch { /* best-effort */ }
}

// Open a URL in the OS default browser. Under Electron route through the
// CabinetDesktop bridge (shell.openExternal) so it never opens an in-app window.
function openExternal(url: string) {
  const bridge = (window as unknown as { CabinetDesktop?: { openExternal?: (u: string) => void } }).CabinetDesktop;
  if (bridge?.openExternal) bridge.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

export function ProviderSetupDialog() {
  const providerId = useAppStore((s) => s.providerSetupId);
  if (!providerId) return null;
  return <ProviderSetupPanel key={providerId} providerId={providerId} />;
}

function ProviderSetupPanel({ providerId }: { providerId: string }) {
  const { t } = useLocale();
  const close = useAppStore((s) => s.closeProviderSetup);
  const setSection = useAppStore((s) => s.setSection);
  const loadProviders = useAppStore((s) => s.loadProviders);

  const [info, setInfo] = useState<ProviderInfo | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [verify, setVerify] = useState<null | { status: string; hint?: string; failedStepTitle?: string }>(null);
  const termRef = useRef<WebTerminalHandle>(null);
  const outBuf = useRef("");
  const [termSessionId] = useState(() => `provider-setup-${Date.now()}`);

  const refreshStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/agents/providers/status", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { providers: ProviderStatus[] };
      setStatus(data.providers.find((p) => p.id === providerId) ?? null);
    } catch { /* ignore */ }
  }, [providerId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/agents/providers", { cache: "no-store" });
        if (r.ok) {
          const data = (await r.json()) as { providers: ProviderInfo[] };
          if (alive) setInfo(data.providers.find((p) => p.id === providerId) ?? null);
        }
      } catch { /* ignore */ }
      await refreshStatus();
    })();
    return () => { alive = false; };
  }, [providerId, refreshStatus]);

  const steps = info?.installSteps ?? [];
  const installStep = findStep(steps, /install/i);
  const loginStep = findStep(steps, /^log\s?in$/i);
  const available = status?.available ?? false;
  const authed = status?.authenticated ?? false;
  const ready = available && authed;
  const apiKeyEnv = API_KEY_ENV[providerId];

  const runInTerminal = (command: string) => {
    setLoginUrl(null);
    outBuf.current = "";
    termRef.current?.sendInput(command + "\r");
  };

  // Scrape the first sign-in URL a login command prints so we can open it in the
  // OS browser (reliable under Electron) and offer copy.
  const handleTermData = (text: string) => {
    outBuf.current = (outBuf.current + text).slice(-4000);
    if (loginUrl) return;
    const m = outBuf.current.match(/https?:\/\/[^\s"'`\x1b]+/);
    if (m) setLoginUrl(m[0].replace(/[)\].,]+$/, ""));
  };

  const onReady = async () => {
    await refreshStatus();
    await loadProviders();
    await promoteSoleReadyDefault(providerId);
  };

  const runVerify = async () => {
    setVerify({ status: "running" });
    try {
      const r = await fetch(`/api/agents/providers/${providerId}/verify`, { method: "POST" });
      const d = await r.json();
      setVerify({ status: d.status, hint: d.hint, failedStepTitle: d.failedStepTitle });
      if (d.status === "pass") void onReady();
    } catch (e) {
      setVerify({ status: "other_error", hint: e instanceof Error ? e.message : String(e) });
    }
  };

  const statusLabel = ready
    ? t("settings:providerSetup.ready")
    : available ? t("settings:providerSetup.notLoggedIn") : t("settings:providerSetup.notInstalled");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t("settings:providerSetup.title", { name: info?.name ?? providerId })}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              ready ? "bg-green-500/15 text-green-600 dark:text-green-400"
              : available ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-muted text-muted-foreground"}`}>{statusLabel}</span>
          </div>
          <button onClick={close} aria-label={t("status:common.close")} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {ready ? (
          <div className="p-6">
            <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" /> {t("settings:providerSetup.allSet", { name: info?.name ?? providerId })}
            </p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-2">
            {/* LEFT — smart action + official steps + verify */}
            <div className="min-h-0 space-y-3 overflow-y-auto border-b border-border p-4 md:border-b-0 md:border-e">
              {/* Smart action for the current state */}
              {!available && installStep && (
                <PrimaryAction
                  label={t("settings:providerSetup.installForMe")}
                  hint={t("settings:providerSetup.installIntro")}
                  onClick={() => runInTerminal(installStep.command!)}
                />
              )}
              {available && !authed && providerId === "claude-code" && <ClaudeLogin onDone={onReady} />}
              {available && !authed && providerId !== "claude-code" && loginStep && (
                <PrimaryAction
                  label={t("settings:providerSetup.signIn")}
                  hint={t("settings:providerSetup.signInHint")}
                  onClick={() => runInTerminal(loginStep.command!)}
                />
              )}
              {available && !authed && !loginStep && apiKeyEnv && <ApiKeyLogin envVar={apiKeyEnv} onDone={onReady} />}

              {/* Captured sign-in link → open in OS browser / copy */}
              {loginUrl && (
                <div className="space-y-1 rounded-md border border-border bg-muted/40 p-2">
                  <p className="text-[11px] text-muted-foreground">{t("settings:providerSetup.openLinkHint")}</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openExternal(loginUrl)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
                      <ExternalLink className="h-3.5 w-3.5" /> {t("settings:providerSetup.openInBrowser")}
                    </button>
                    <span className="flex-1 truncate rounded border border-border bg-background px-2 py-1 font-mono text-[10.5px]">{loginUrl}</span>
                    <CopyButton text={loginUrl} />
                  </div>
                </div>
              )}

              {/* Official steps — same component as Settings; Run drives the terminal → */}
              <div className="rounded-lg bg-muted/40 p-2">
                <ProviderSetupSteps
                  steps={steps}
                  onRunCommand={runInTerminal}
                  failedStepTitle={verify?.failedStepTitle}
                  passed={verify?.status === "pass"}
                />
              </div>

              {/* Verify */}
              <div className="flex items-center gap-2 border-t border-border pt-2">
                <button onClick={runVerify} disabled={verify?.status === "running"} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50">
                  {verify?.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t("settings:providerSetup.verify")}
                </button>
                {verify && verify.status !== "running" && (
                  <span className={`text-[11px] ${verify.status === "pass" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {verify.status === "pass" ? t("settings:providerSetup.verifyPass") : (verify.hint || verify.status)}
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT — the live terminal (theme-colored, not green/black) */}
            <div className="flex min-h-0 flex-col p-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{t("settings:providerSetup.terminalLabel")}</p>
              <div className="min-h-[300px] flex-1 overflow-hidden rounded-md border border-border">
                <WebTerminal
                  ref={termRef}
                  sessionId={termSessionId}
                  adapterType="shell"
                  themeSurface="page"
                  onData={handleTermData}
                  onClose={() => { /* user drives via buttons */ }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <button onClick={() => { setSection({ type: "settings", slug: "providers" }); close(); }} className="text-[11px] text-muted-foreground underline hover:text-foreground">
            {t("settings:providerSetup.openSettings")}
          </button>
          <button onClick={close} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
            {ready ? t("settings:providerSetup.done") : t("status:common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrimaryAction({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
      <p className="text-[12px] text-muted-foreground">{hint}</p>
      <button onClick={onClick} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
        {label}
      </button>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ClaudeLogin({ onDone }: { onDone: () => void }) {
  const { t } = useLocale();
  const [phase, setPhase] = useState<"idle" | "starting" | "await-code" | "submitting">("idle");
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const start = async () => {
    setPhase("starting"); setErr("");
    try {
      const r = await fetch("/api/agents/claude-login/start", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not start Claude login");
      setUrl(d.url); setPhase("await-code");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase("idle"); }
  };
  const submit = async () => {
    setPhase("submitting"); setErr("");
    try {
      const r = await fetch("/api/agents/claude-login/code", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not connect");
      void onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase("await-code"); }
  };

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
      <p className="text-[12px] font-medium">{t("settings:providerSetup.loginTitle")}</p>
      {phase === "idle" && (
        <button onClick={start} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          {t("settings:providerSetup.connectClaude")}
        </button>
      )}
      {phase === "starting" && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("settings:providerSetup.preparingLink")}</p>
      )}
      {(phase === "await-code" || phase === "submitting") && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => openExternal(url)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
              <ExternalLink className="h-3.5 w-3.5" />{t("settings:providerSetup.openClaudeLogin")}
            </button>
            <CopyButton text={url} />
          </div>
          <p className="text-[11px] text-muted-foreground">{t("settings:providerSetup.pasteCodeHint")}</p>
          <div className="flex items-center gap-1.5">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("settings:providerSetup.codePlaceholder")}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring/60" />
            <button onClick={submit} disabled={!code.trim() || phase === "submitting"}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {phase === "submitting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("settings:providerSetup.connect")}
            </button>
          </div>
        </div>
      )}
      {err && <p className="text-[11px] text-destructive">{err}</p>}
    </div>
  );
}

function ApiKeyLogin({ envVar, onDone }: { envVar: string; onDone: () => void }) {
  const { t } = useLocale();
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/agents/config/cabinet-env", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: envVar, value: key.trim() }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Could not save key"); }
      setKey(""); void onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
      <p className="text-[12px] font-medium">{t("settings:providerSetup.loginTitle")}</p>
      <p className="text-[11px] text-muted-foreground">{t("settings:providerSetup.apiKeyFieldHint", { envVar })}</p>
      <div className="flex items-center gap-1.5">
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={envVar}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring/60" />
        <button onClick={save} disabled={!key.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t("settings:providerSetup.saveKey")}
        </button>
      </div>
      {err && <p className="text-[11px] text-destructive">{err}</p>}
    </div>
  );
}
