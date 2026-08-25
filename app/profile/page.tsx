import { redirect } from "next/navigation";

import ChangePasswordForm from "@/component/profile/ChangePasswordForm";
import ProfileSummary from "@/component/profile/ProfileSummary";
import { assertActiveAccountAccess } from "@/src/services/account-access.service";
import { AccountAccessError } from "@/src/services/account-access.service-core";
import { requireAuthenticatedUser } from "@/src/services/authorization.service";

/**
 * Ticket 25F: the shared personal-account page for every authenticated
 * role. Deliberately minimal — read-only identity (name/email/role/status,
 * reusing ProfileSummary) plus the one shared password-change workflow.
 * No employee profile editing and no ADMIN user-management powers live
 * here; that boundary stays at /admin/users, a completely separate
 * authorization path.
 */
export default async function ProfilePage() {
  const user = await requireAuthenticatedUser();

  let account;

  try {
    account = await assertActiveAccountAccess(user.id);
  } catch (error) {
    if (error instanceof AccountAccessError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl">
          Mon profil
        </h1>
        <p className="mt-2 text-slate-500">
          Vos informations personnelles et l’accès à votre compte.
        </p>
      </div>

      <ProfileSummary
        firstName={account.firstName}
        lastName={account.lastName}
        email={account.email}
        phone={account.phone}
        role={account.role}
        active={account.active}
      />

      <ChangePasswordForm />
    </div>
  );
}
