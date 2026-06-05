"use client";

import { ArrowLeft, Check, Sparkles, ShieldCheck, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showSuccess } from "@/lib/ui/toast";
import { ConnectPanel } from "@/components/integrations/hub/connect-panel";
import {
  CATEGORY_META,
  type IntegrationItem,
} from "@/lib/integrations/preview-catalog";
import {
  LogoImg,
  brandFace,
  brandFill,
} from "@/components/integrations/hub/integration-visuals";

/**
 * Full-page configuration view for a single integration. Opened in place of
 * the browse grid (no modal) when a card is clicked. The browse layout the
 * user ultimately picks plugs into this same detail page.
 */
export function IntegrationDetailPage({
  item,
  onBack,
}: {
  item: IntegrationItem;
  onBack: () => void;
}) {
  const category = CATEGORY_META[item.category].label;

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Hero with brand-tinted backdrop */}
      <div className="relative border-b border-border" style={{ background: brandFace(item.brand) }}>
        <div className="mx-auto max-w-4xl px-6 pb-8 pt-5">
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All integrations
          </button>

          <div className="flex items-start gap-5">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl shadow-lg ring-1 ring-black/5"
              style={{ background: brandFill(item.brand) }}
            >
              <LogoImg item={item} size={40} className="drop-shadow-sm" />
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {item.name}
                </h1>
                {item.implemented ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Available now
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-foreground/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground/80">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
                {item.blurb}
              </p>
              <p className="mt-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {category}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-8 lg:grid-cols-[1fr_320px]">
        {/* Left: capabilities */}
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            What your agents can do
          </h2>
          <ul className="mt-4 space-y-3">
            {item.actions.map((action) => (
              <li key={action} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${item.brand}1f` }}
                >
                  <Check className="h-3 w-3" style={{ color: item.brand }} />
                </span>
                <span className="text-[14px] text-foreground">{action}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Runs through your own CLI
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Cabinet registers this as an MCP server in your agent CLI&apos;s
              config. Secrets stay in <code className="rounded bg-foreground/[0.06] px-1 py-0.5 text-[12px]">.cabinet.env</code> — never
              written into a config file.
            </p>
          </div>
        </div>

        {/* Right: config / status panel */}
        <aside>
          {item.implemented ? (
            <ConnectPanel item={item} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5 text-center">
              <div
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: `${item.brand}1f` }}
              >
                <Sparkles className="h-5 w-5" style={{ color: item.brand }} />
              </div>
              <h3 className="mt-3 text-[14px] font-semibold text-foreground">
                Not available yet
              </h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                We&apos;re building this connector. Want it sooner?
              </p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => showSuccess(`We'll let you know when ${item.name} is ready`)}
              >
                <Bell className="mr-1.5 h-3.5 w-3.5" />
                Notify me
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
