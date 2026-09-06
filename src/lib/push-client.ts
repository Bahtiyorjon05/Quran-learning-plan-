/**
 * Registering this device with the push service.
 *
 * Permission and a subscription are two different things, and only the second
 * one can actually be delivered to. A browser can hold permission for months
 * and have no subscription at all — after a reinstall, a cleared site, a key
 * rotation — which is exactly the state where notifications are "on" in
 * settings and nothing ever arrives. So this is called whenever permission is
 * granted, not only the first time it is asked for.
 */

/** The VAPID public key, as the raw bytes `pushManager.subscribe` wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushResult = "subscribed" | "unsupported" | "denied" | "failed";

export async function subscribeThisDevice(): Promise<PushResult> {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission !== "granted") return "denied";

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "unsupported";

  try {
    /* `ready` rather than `register`: the worker is registered by the layout on
       load, and subscribing before it is in control silently produces nothing. */
    const registration = await navigator.serviceWorker.ready;

    /* An existing subscription is reused unless it was made for a different
       key, in which case it can never be delivered to and has to go. */
    const existing = await registration.pushManager.getSubscription();
    const wanted = urlBase64ToUint8Array(key);
    if (existing) {
      const same =
        existing.options.applicationServerKey &&
        new Uint8Array(existing.options.applicationServerKey).every((b, i) => b === wanted[i]);
      if (!same) await existing.unsubscribe().catch(() => {});
    }

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        /* Required by every browser: a push must always be shown. */
        userVisibleOnly: true,
        applicationServerKey: wanted as BufferSource,
      }));

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    return response.ok ? "subscribed" : "failed";
  } catch {
    return "failed";
  }
}

/** Stop this one device without touching the others. */
export async function unsubscribeThisDevice(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  } catch {
    /* Nothing to undo. */
  }
}

/** Whether this device currently has a live subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}
