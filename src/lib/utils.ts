import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Format an integer with locale-aware grouping (604 → "604", 9060 → "9,060"). */
export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-US").format(value);
}
