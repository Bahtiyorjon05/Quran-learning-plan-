/**
 * The reciters offered at launch. Mishary Alafasy is the default: he is the
 * most widely recognised voice and has the best word-level timing data, which
 * the karaoke highlighting in Phase 2 depends on.
 *
 * Names are proper nouns and stay the same in every locale, so they live here
 * rather than in the message files.
 */
export const RECITERS = [
  { id: "alafasy", name: "Mishary Alafasy", arabic: "مشاري العفاسي" },
  { id: "alijon", name: "Alijon Qori", arabic: "علي جان قاري" },
  { id: "badr", name: "Badr al-Turki", arabic: "بدر التركي" },
  { id: "husary", name: "Mahmoud al-Husary", arabic: "محمود الحصري" },
  { id: "minshawi", name: "Mohamed al-Minshawi", arabic: "محمد المنشاوي" },
] as const;

export type ReciterId = (typeof RECITERS)[number]["id"];

export const DEFAULT_RECITER: ReciterId = "alafasy";

export function isReciterId(value: string): value is ReciterId {
  return RECITERS.some((r) => r.id === value);
}
