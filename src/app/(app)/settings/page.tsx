import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle, QuotaMeter } from "@/components/ui";
import { AvatarField } from "@/features/settings/components/AvatarField";
import { DeleteAccountDialog } from "@/features/settings/components/DeleteAccountDialog";
import { ProfileForm } from "@/features/settings/components/ProfileForm";
import { AI_QUOTAS } from "@/lib/ai/types";
import { getProfile } from "@/server/profile/queries";
import { getSession } from "@/server/auth/session";

export const metadata = { title: "Settings" };

export default async function Page() {
  const [profile, session] = await Promise.all([getProfile(), getSession()]);

  /* A signed-in student with no profile row means the trigger did not fire and
     the backfill missed them. Rather than render a form bound to nothing,
     bounce through sign-in, which recreates the session and surfaces the real
     problem instead of a blank page. */
  if (!profile || !session) redirect("/login");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Account and appearance"
        title="Settings"
        description="Your profile, today's AI usage, and how much of it you have left."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            <AvatarField
              name={profile.displayName}
              avatarUrl={profile.avatarUrl}
              hasAvatar={profile.avatarPath !== null}
            />
            <ProfileForm profile={profile} />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <div>
                <p className="text-sm text-ink-muted">Signed in as</p>
                <p className="mt-0.5 font-medium break-all">{session.email}</p>
              </div>
              {!session.emailVerified && (
                <p className="text-sm text-warn">This address has not been confirmed yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI usage today</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {/* A limit that only appears at the moment it blocks you is a bug
                  (NFR-C1). Real counts arrive with the AI call log in Sprint 31;
                  the limits themselves are already the ones that will apply. */}
              <QuotaMeter
                label="Generations"
                used={0}
                limit={AI_QUOTAS.generationsPerDay}
                resetsAt="midnight"
              />
              <QuotaMeter
                label="Assistant messages"
                used={0}
                limit={AI_QUOTAS.messagesPerDay}
                resetsAt="midnight"
              />
              <p className="text-xs text-ink-subtle">
                Counting starts when the assistant ships in Sprint 31. The limits shown are the ones
                that will apply.
              </p>
            </CardBody>
          </Card>

          <Card className="border-bad/30">
            <CardHeader>
              <CardTitle>Delete account</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-ink-muted">
                Removes your uploads, everything generated from them, and every result. There is no
                copy and no undo.
              </p>
              <div>
                <DeleteAccountDialog />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
