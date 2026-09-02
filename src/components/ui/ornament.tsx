import { cn } from "@/lib/utils";

/**
 * Four gold brackets, one at each corner of a panel.
 *
 * A manuscript page answers its corners; a CSS card does not. These are the
 * cheapest possible version of that idea — a border on two sides of an empty
 * span — and they do the work an outline cannot, which is to say "this panel
 * is the important one" without drawing a heavier box around it.
 *
 * Done as four elements rather than two pseudo-elements because a frame with
 * only two corners answered does not read as restraint, it reads as a bug.
 * They arrive a beat after the panel does, so the panel lands first and is
 * then illuminated.
 */
export function Corners({ className }: { className?: string }) {
  const shared =
    "pointer-events-none absolute h-7 w-7 border-[color-mix(in_oklab,var(--gold)_42%,transparent)] opacity-0 [animation:ahd-corner-in_1.1s_var(--ease-settle)_0.35s_forwards]";

  return (
    <div aria-hidden className={cn("absolute inset-0", className)}>
      <span className={cn(shared, "top-3.5 left-3.5 rounded-tl-lg border-t border-l")} />
      <span className={cn(shared, "top-3.5 right-3.5 rounded-tr-lg border-t border-r [animation-delay:0.45s]")} />
      <span className={cn(shared, "bottom-3.5 left-3.5 rounded-bl-lg border-b border-l [animation-delay:0.55s]")} />
      <span className={cn(shared, "right-3.5 bottom-3.5 rounded-br-lg border-r border-b [animation-delay:0.65s]")} />
    </div>
  );
}
