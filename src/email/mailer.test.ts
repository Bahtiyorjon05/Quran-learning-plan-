import { describe, expect, it, vi } from "vitest";

/**
 * Mail that can never arrive must never be posted.
 *
 * The verification scripts sign up real accounts at `@…​.ahd.test`, and the
 * sign-up flow really does send a code to them. Handed to a live SMTP server
 * that is a guaranteed failure — the server accepts the message, cannot
 * resolve the domain, and mails a bounce back to the account Ahd sends from.
 * A run of the sign-up check filled a real inbox with "message not delivered".
 *
 * RFC 2606 and RFC 6761 set these domains aside precisely so nothing tries.
 *
 * The transport is configured here rather than left to the environment: with
 * no SMTP host the mailer answers "console" for every address, so a test that
 * did not force one would pass without the guard existing at all.
 */

vi.mock("@/lib/env", () => ({
  env: { SMTP_HOST: "smtp.example.com", SMTP_PORT: 587, EMAIL_FROM: "ahd@example.com" },
  isProd: false,
}));

const { sendMail, activeTransport } = await import("./mailer");

const letter = (to: string) => ({
  to,
  subject: "a code",
  text: "123456",
  html: "<p>123456</p>",
});

describe("undeliverable domains", () => {
  it("is configured to use a real transport, or this proves nothing", () => {
    expect(activeTransport()).toBe("smtp");
  });

  it("refuses reserved domains instead of posting them", async () => {
    for (const address of [
      "someone@signup.ahd.test",
      "someone@ahd.invalid",
      "someone@thing.example",
      "SOMEONE@SHOUTY.TEST",
    ]) {
      const result = await sendMail(letter(address));
      expect(result.via, `${address} reached a real transport`).toBe("console");
      expect(result.sent, `${address} was reported as a failure`).toBe(true);
    }
  });

  it("still hands an ordinary address to the transport", async () => {
    /* It cannot connect to smtp.example.com and will report a failure — the
       point is that it *tried*, which is what separates this from the case
       above. */
    const result = await sendMail(letter("someone@gmail.com"));
    expect(result.via).toBe("smtp");
  }, 30_000);
});
