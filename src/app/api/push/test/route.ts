import { NextResponse } from "next/server";

import { getCurrentUser } from "@/auth/session";
import { pushToUser } from "@/push/send";

/**
 * "Send one to me, now."
 *
 * Permission being granted and a notification actually arriving are different
 * facts, and only the second one matters. This lets the settings screen prove
 * the second rather than claim it.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const delivered = await pushToUser(user.id, {
    title: "Ahd",
    body:
      user.locale === "ru"
        ? "Уведомления работают. Так будет выглядеть напоминание."
        : user.locale === "en"
          ? "Notifications work. This is what a reminder will look like."
          : "Eslatmalar ishlayapti. Kunlik eslatma shunday koʻrinadi.",
    url: "/app",
    tag: "ahd-test",
  });

  return NextResponse.json({ ok: delivered > 0, delivered });
}
