import { cn } from "@/lib/utils";

/**
 * Gold motes, drifting up through a panel.
 *
 * The covenant card is the one panel in the app that is not a readout — it is
 * a promise — and a promise should look alive rather than printed. Six specks,
 * each with its own delay, drift and speed, so the eye never catches a loop.
 *
 * Deliberately tiny and slow: at this size it reads as dust in a shaft of
 * light, which is the intent. Anything faster would be snow.
 */
const MOTES = [
  { left: "12%", delay: "0s", drift: "18px", duration: "15s" },
  { left: "27%", delay: "3.5s", drift: "-14px", duration: "18s" },
  { left: "44%", delay: "7s", drift: "22px", duration: "13s" },
  { left: "61%", delay: "1.8s", drift: "-20px", duration: "17s" },
  { left: "78%", delay: "9.5s", drift: "10px", duration: "14s" },
  { left: "91%", delay: "5.2s", drift: "-16px", duration: "16s" },
];

export function Motes({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("ahd-motes", className)}>
      {MOTES.map((mote) => (
        <i
          key={mote.left}
          style={
            {
              left: mote.left,
              animationDelay: mote.delay,
              animationDuration: mote.duration,
              "--drift": mote.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
