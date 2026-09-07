import { getCurrentUser } from "@/auth/session";
import { juzProgress } from "@/core/milestones/juz";
import { JuzCelebration } from "@/components/app/juz-celebration";

/**
 * Everything under /app, plus anything owed.
 *
 * The celebration used to live on the dashboard alone, which meant a juz
 * finished in the mushaf — where juz are actually finished — was announced
 * only if the reader happened to go home afterwards. A milestone is owed to
 * the person, not to a route, so it is waiting on whatever screen they are on:
 * the reader, practice, weak spots, settings.
 *
 * The guard here is deliberately soft. Every page underneath does its own
 * `requireOnboardedUser`, and a layout that redirected as well would race
 * them — sending somebody halfway through onboarding to the login screen for
 * the crime of not having finished it yet.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return children;

  const juz = await juzProgress(user.id);

  return (
    <>
      {children}
      {juz.unseen.length > 0 && (
        <JuzCelebration
          juz={juz.unseen}
          total={juz.held.length}
          name={user.displayName || user.email}
        />
      )}
    </>
  );
}
