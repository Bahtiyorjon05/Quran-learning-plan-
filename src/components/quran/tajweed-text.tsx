import { parseTajweed, RULE_FAMILY } from "@/core/quran/tajweed";

/**
 * An ayah with its tajweed rules marked.
 *
 * Every ayah renders through here whether colouring is on or not. The spans
 * carry a data attribute and the colour is applied in CSS, so turning tajweed
 * on and off is one attribute on <html> — no re-render, no second copy of the
 * text, and nothing to go out of step between the two states.
 *
 * If the markup is missing for any reason the plain text is rendered instead,
 * because a page of the Qur'an must never fail to appear.
 */
export function TajweedText({ text, marked }: { text: string; marked: string }) {
  if (!marked) return <>{text}</>;

  const segments = parseTajweed(marked);
  if (segments.length === 0) return <>{text}</>;

  return (
    <>
      {segments.map((segment, i) =>
        segment.rule ? (
          <span key={i} data-tj={RULE_FAMILY[segment.rule]} data-rule={segment.rule}>
            {segment.text}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}
