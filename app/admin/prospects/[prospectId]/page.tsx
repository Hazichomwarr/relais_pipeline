import {
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getAssignedUserName } from "@/src/lib/prospect-ownership";

import { ProspectRecordNavigation } from "@/component/propects/ProspectRecordNavigation";
import ProspectActionForm from "@/component/propects/prospect-action-form";
import ProspectActionList from "@/component/propects/prospect-action-list";
import ProspectActivityForm from "@/component/propects/prospect-activity-form";
import ProspectActivityTimeline from "@/component/propects/prospect-activity-timeline";
import ProspectFollowUpForm from "@/component/propects/prospect-follow-up-form";
import {
  Badge,
  DetailSection,
  InfoField,
  ProductDetailSection,
  formatDateInput,
  formatDateTime,
  getInterestLabel,
  getInterestStyles,
  getOnlinePresenceLabel,
  getProductLabel,
  getStatusLabel,
} from "@/component/propects/prospect-detail-sections";
import AdminShell from "@/component/dashboard/AdminShell";
import { resolveSafeReturnTo } from "@/src/lib/callback-url";
import { buildProspectRecordNavigationProps } from "@/src/lib/prospect-record-navigation";
import { requireRole } from "@/src/services/authorization.service";
import { getProspectActivities } from "@/src/services/prospect-activity.service";
import { getAdjacentProspects } from "@/src/services/prospect-navigation.service";
import { listProspectActionsForProspect } from "@/src/services/prospect-action.service";
import { getProspectById } from "@/src/services/prospect.service";
import { listActiveUsersForTaskAssignment } from "@/src/services/user.service";

type ProspectDetailPageProps = {
  params: Promise<{
    prospectId: string;
  }>;
  searchParams: Promise<{
    returnTo?: string;
  }>;
};

export default async function ProspectDetailPage({
  params,
  searchParams,
}: ProspectDetailPageProps) {
  const { prospectId } = await params;
  const { returnTo } = await searchParams;
  const viewer = await requireRole("ADMIN", "MANAGER");
  const prospect = await getProspectById(prospectId);

  if (!prospect) {
    notFound();
  }

  const [activitiesResult, actions, assignableUsers] = await Promise.all([
    getProspectActivities(prospect.id),
    listProspectActionsForProspect(prospect.id),
    listActiveUsersForTaskAssignment(),
  ]);

  if (!activitiesResult.success && activitiesResult.code === "NOT_FOUND") {
    notFound();
  }

  const safeReturnTo = resolveSafeReturnTo(returnTo, "/admin");
  const adjacent = await getAdjacentProspects({
    id: prospect.id,
    createdAt: prospect.createdAt,
    assignedUserId: prospect.assignedUserId,
    assignedUserName: getAssignedUserName(prospect),
  });
  const navProps = buildProspectRecordNavigationProps({
    role: "admin",
    basePath: "/admin/prospects",
    adjacent,
    safeReturnTo,
  });

  return (
    <AdminShell>
      <div className="mx-auto max-w-7xl">
        <ProspectRecordNavigation {...navProps} />

            <header className="rounded-4xl bg-[#0f2557] px-6 py-7 text-white shadow-[0_18px_50px_rgba(15,37,87,0.18)] md:px-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge className="bg-white/15 text-white">
                      {getProductLabel(prospect.product)}
                    </Badge>
                    <Badge className={getInterestStyles(prospect.interest)}>
                      {getInterestLabel(prospect.interest)}
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-800">
                      {getStatusLabel(prospect.status)}
                    </Badge>
                  </div>

                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    {prospect.name}
                  </h1>
                  <p className="mt-2 text-blue-100">{prospect.prospectType}</p>
                </div>

                <div className="rounded-2xl bg-white/10 px-5 py-4 text-sm backdrop-blur-sm">
                  <p className="text-blue-100">Commercial assigné</p>
                  <p className="mt-1 font-semibold text-white">
                    {getAssignedUserName(prospect)}
                  </p>
                </div>
              </div>
            </header>

            <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-7">
                <DetailSection title="Informations générales">
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoField
                      icon={<UserRound className="h-5 w-5" />}
                      label="Personne de contact"
                      value={prospect.contactName}
                    />
                    <InfoField
                      icon={<Phone className="h-5 w-5" />}
                      label="Téléphone / WhatsApp"
                      value={
                        prospect.phone ? (
                          <a
                            href={`tel:${prospect.phone}`}
                            className="text-blue-700 hover:underline"
                          >
                            {prospect.phone}
                          </a>
                        ) : null
                      }
                    />
                    <InfoField
                      icon={<MapPin className="h-5 w-5" />}
                      label="Localisation"
                      value={prospect.location}
                    />
                    <InfoField
                      icon={<Building2 className="h-5 w-5" />}
                      label="Type de prospect"
                      value={prospect.prospectType}
                    />
                    <InfoField
                      label="Présence en ligne"
                      value={getOnlinePresenceLabel(prospect.onlinePresence)}
                    />
                    <InfoField
                      label="Commercial assigné"
                      value={getAssignedUserName(prospect)}
                    />
                  </div>
                </DetailSection>

                <ProductDetailSection prospect={prospect} />

                <DetailSection title="Observation initiale du terrain">
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
                    {prospect.notes}
                  </p>
                  <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
                    Cette observation est conservée telle qu’elle a été saisie
                    pendant la prospection.
                  </p>
                </DetailSection>

                <DetailSection title="Historique du dossier">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <InfoField
                      icon={<CalendarDays className="h-5 w-5" />}
                      label="Prospect créé le"
                      value={formatDateTime(prospect.createdAt)}
                    />
                    <InfoField
                      icon={<Clock3 className="h-5 w-5" />}
                      label="Dernière mise à jour"
                      value={formatDateTime(prospect.updatedAt)}
                    />
                  </div>
                </DetailSection>
              </div>

              <aside className="h-fit rounded-4xl border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-7">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                    Commande de suivi
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[#0f2557]">
                    Prochaine étape
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Ajustez uniquement le plan commercial actuel. L’observation
                    terrain reste intacte.
                  </p>
                </div>

                <ProspectFollowUpForm
                  prospectId={prospect.id}
                  initialValues={{
                    interest: prospect.interest,
                    status: prospect.status,
                    nextAction: prospect.nextAction,
                    followUpDate: prospect.followUpDate
                      ? formatDateInput(prospect.followUpDate)
                      : "",
                  }}
                />
              </aside>
            </div>

            <div className="mt-7 grid items-start gap-7 2xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
              <ProspectActionForm
                prospectId={prospect.id}
                assignableUsers={assignableUsers}
              />
              <ProspectActionList actions={actions} viewer={viewer} />
            </div>

            <div className="mt-7 grid items-start gap-7 2xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
              <ProspectActivityForm
                prospectId={prospect.id}
                initialAgentName={getAssignedUserName(prospect)}
              />
              <ProspectActivityTimeline
                activities={
                  activitiesResult.success ? activitiesResult.activities : []
                }
                errorMessage={
                  activitiesResult.success
                    ? undefined
                    : activitiesResult.message
                }
              />
            </div>
      </div>
    </AdminShell>
  );
}
