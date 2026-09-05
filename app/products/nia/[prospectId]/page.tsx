import {
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import ProspectActivityTimeline from "@/component/propects/prospect-activity-timeline";
import {
  Badge,
  DetailSection,
  InfoField,
  ProductDetailSection,
  ReadOnlyNotice,
  ResponsibleUserInfo,
  formatDateTime,
  getInterestLabel,
  getInterestStyles,
  getOnlinePresenceLabel,
  getStatusLabel,
} from "@/component/propects/prospect-detail-sections";
import { resolveSafeReturnTo } from "@/src/lib/callback-url";
import { getResponsibleUserDisplay } from "@/src/lib/prospect-responsible-display";
import { requireRole } from "@/src/services/authorization.service";
import { getProspectActivities } from "@/src/services/prospect-activity.service";
import { getNiaProspectById } from "@/src/services/generic-product-directory.service";

type NiaSummaryPageProps = {
  params: Promise<{ prospectId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

/**
 * Ticket 28C — the NIA equivalent of /products/lokari/[id]. See that
 * page's comment for the full rationale; the only difference here is the
 * product scope.
 */
export default async function NiaSummaryPage({
  params,
  searchParams,
}: NiaSummaryPageProps) {
  await requireRole("ADMIN", "MANAGER", "COMMERCIAL");
  const { prospectId } = await params;
  const { returnTo } = await searchParams;

  const prospect = await getNiaProspectById(prospectId);

  if (!prospect) {
    notFound();
  }

  const activitiesResult = await getProspectActivities(prospect.id);

  if (!activitiesResult.success && activitiesResult.code === "NOT_FOUND") {
    notFound();
  }

  const safeReturnTo = resolveSafeReturnTo(returnTo, "/products/nia");
  const responsible = getResponsibleUserDisplay(prospect);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={safeReturnTo}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#0f2557]"
      >
        ← Retour au répertoire
      </Link>

      <ReadOnlyNotice responsible={responsible} />

      <header className="rounded-4xl bg-[#0f2557] px-6 py-7 text-white shadow-[0_18px_50px_rgba(15,37,87,0.18)] md:px-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-white/15 text-white">
            {getStatusLabel(prospect.status)}
          </Badge>
          <Badge className={getInterestStyles(prospect.interest)}>
            {getInterestLabel(prospect.interest)}
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
            <InfoField
              label="Responsable du suivi"
              value={<ResponsibleUserInfo responsible={responsible} />}
            />
          </div>
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

        <ProspectActivityTimeline
          activities={activitiesResult.success ? activitiesResult.activities : []}
          errorMessage={
            activitiesResult.success ? undefined : activitiesResult.message
          }
        />
      </div>
    </main>
  );
}
