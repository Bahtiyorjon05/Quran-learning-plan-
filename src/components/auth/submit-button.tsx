"use client";

import { Loader2 } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  label,
  pendingLabel,
  pending,
  disabled,
  className,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={buttonStyles({
        size: "lg",
        className: cn("w-full", className),
      })}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingLabel : label}
    </button>
  );
}
