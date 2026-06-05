"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  type IntegrationItem,
  CATEGORY_META,
  groupByCategory,
} from "@/lib/integrations/preview-catalog";
import {
  LogoTile,
  StatusBadge,
  DimWhenComingSoon,
} from "@/components/integrations/hub/integration-visuals";

/**
 * Layout: "Premium logo wall / brand gallery".
 *
 * Evokes a marketing "Connect to everything" section — large logo tiles laid
 * out in airy, flex-wrapped rows under generous category headers. Each tile
 * lifts on hover and casts a soft glow in the integration's own brand colour
 * (an eased shadow fade, not a hard border). Coming-soon items are dimmed via
 * DimWhenComingSoon but stay fully clickable (the hit-area button is never
 * dimmed).
 */
export function LayoutGallery({
  items,
  onOpen,
}: {
  items: IntegrationItem[];
  onOpen: (id: string) => void;
}) {
  const groups = groupByCategory(items);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {items.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No integrations found.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.category}>
                {/* Category header */}
                <div className="mb-5 flex items-baseline gap-2.5">
                  <h2 className="text-[13px] font-semibold text-foreground">
                    {CATEGORY_META[group.category].label}
                  </h2>
                  <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                    {group.items.length}
                  </span>
                </div>

                {/* Logo wall */}
                <div className="flex flex-wrap gap-5">
                  {group.items.map((item) => (
                    <GalleryTile
                      key={item.id}
                      item={item}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// A gentle back-and-forth wobble that loops while the tile is hovered.
const GIGGLE_FRAMES = [
  { transform: "rotate(0deg)" },
  { transform: "rotate(-6deg)" },
  { transform: "rotate(6deg)" },
  { transform: "rotate(0deg)" },
];

function GalleryTile({
  item,
  onOpen,
}: {
  item: IntegrationItem;
  onOpen: (id: string) => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  // Drive the giggle in JS (Web Animations API) so it loops smoothly while the
  // tile is hovered/focused and doesn't depend on a global stylesheet.
  const startGiggle = () => {
    const el = tileRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animRef.current?.cancel();
    animRef.current = el.animate(GIGGLE_FRAMES, {
      duration: 600,
      easing: "ease-in-out",
      iterations: Infinity,
    });
  };
  const stopGiggle = () => {
    animRef.current?.cancel();
    animRef.current = null;
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      onMouseEnter={startGiggle}
      onMouseLeave={stopGiggle}
      onFocus={startGiggle}
      onBlur={stopGiggle}
      title={item.name}
      aria-label={item.name}
      className={cn(
        "group flex w-[112px] cursor-pointer flex-col items-center gap-2.5",
        "rounded-2xl p-2 text-center focus:outline-none",
      )}
    >
      {/* Visual stack — dimmed for coming-soon, but the button stays clickable. */}
      <DimWhenComingSoon
        implemented={item.implemented}
        className="flex w-full flex-col items-center gap-2.5"
      >
        {/* Tile giggles on hover; soft brand glow eases in behind it */}
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{
              boxShadow: `0 10px 28px -6px ${item.brand}66, 0 4px 10px -3px ${item.brand}40`,
            }}
          />
          {/* Wrapper is what we rotate, so the glow stays put behind it. */}
          <div ref={tileRef} className="relative">
            <LogoTile item={item} size={84} />
          </div>
        </div>

        {/* Name */}
        <span className="max-w-[96px] truncate text-[12px] font-medium text-foreground">
          {item.name}
        </span>
      </DimWhenComingSoon>

      {/* Status sits below the dimmed block so the pill stays legible. */}
      <StatusBadge implemented={item.implemented} />
    </button>
  );
}
