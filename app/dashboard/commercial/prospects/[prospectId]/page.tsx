import {
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { notFound } from "next/navigation";

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
import {
  createCommercialActivityAction,
  updateCommercialProspectFollowUpAction,
} from "@/src/actions/commercial-prospect.actions";
import { getAssignedUserName } from "@/src/lib/prospect-ownership";
import { requireCommercial } from "@/src/services/authorization.service";
import { getProspectActivities } from "@/src/services/prospect-activity.service";
import { getCommercialProspectById } from "@/src/services/commercial-prospect.service";

type CommercialProspectDetailPageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function CommercialProspectDetailPage({
  params,
}: CommercialProspectDetailPageProps) {
  const user = await requireCommercial();
  const { prospectId } = await params;

  const prospect = await getCommercialProspectById(user.id, prospectId);

  if (!prospect) {
    notFound();
  }

  const activitiesResult = await getProspectActivities(prospect.id);

  if (!activitiesResult.success && activitiesResult.code === "NOT_FOUND") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="rounded-4xl bg-[#0f2557] px-6 py-7 text-white shadow-[0_18px_50px_rgba(15,37,87,0.18)] md:px-8">
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
      </header>

      <div className="mt-6 flex flex-col gap-6">
        <DetailSection title="Informations générales">
          <div className="grid gap-5 sm:grid-cols-2">
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
          </div>
        </DetailSection>

        <DetailSection title="Suivi commercial">
          <ProspectFollowUpForm
            prospectId={prospect.id}
            action={updateCommercialProspectFollowUpAction}
            initialValues={{
              interest: prospect.interest,
              status: prospect.status,
              nextAction: prospect.nextAction,
              followUpDate: prospect.followUpDate
                ? formatDateInput(prospect.followUpDate)
                : "",
            }}
          />
        </DetailSection>

        <ProductDetailSection prospect={prospect} />

        <DetailSection title="Observation initiale du terrain">
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
            {prospect.notes}
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

        <ProspectActivityForm
          prospectId={prospect.id}
          action={createCommercialActivityAction}
          initialAgentName={getAssignedUserName(prospect)}
        />

        <ProspectActivityTimeline
          activities={
            activitiesResult.success ? activitiesResult.activities : []
          }
          errorMessage={
            activitiesResult.success ? undefined : activitiesResult.message
          }
        />
      </div>
    </main>
  );
}
