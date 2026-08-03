import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import ProspectActivityForm from "@/component/propects/prospect-activity-form";
import ProspectActivityTimeline from "@/component/propects/prospect-activity-timeline";
import ProspectFollowUpForm from "@/component/propects/prospect-follow-up-form";
import Sidebar from "@/component/dashboard/Sidebar";
import { getProspectActivities } from "@/src/services/prospect-activity.service";
import {
  getProspectById,
  type ProspectDetail,
} from "@/src/services/prospect.service";

type ProspectDetailPageProps = {
  params: Promise<{
    prospectId: string;
  }>;
};

export default async function ProspectDetailPage({
  params,
}: ProspectDetailPageProps) {
  const { prospectId } = await params;
  const prospect = await getProspectById(prospectId);

  if (!prospect) {
    notFound();
  }

  const activitiesResult = await getProspectActivities(prospect.id);

  if (!activitiesResult.success && activitiesResult.code === "NOT_FOUND") {
    notFound();
  }

  return (
    <section className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <div className="flex">
        <Sidebar />

        <main className="min-w-0 flex-1 px-5 py-7 lg:px-10 lg:py-9">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/admin"
              className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#0f2557]"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au tableau de bord
            </Link>

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
                  <p className="text-blue-100">Commercial responsable</p>
                  <p className="mt-1 font-semibold text-white">
                    {prospect.agentName}
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
                      value={prospect.phone}
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
                    <InfoField label="Commercial" value={prospect.agentName} />
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
              <ProspectActivityForm
                prospectId={prospect.id}
                initialAgentName={prospect.agentName}
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
        </main>
      </div>
    </section>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <h2 className="mb-6 text-xl font-bold text-[#0f2557]">{title}</h2>
      {children}
    </section>
  );
}

function InfoField({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode | null | undefined;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 font-semibold text-slate-800">
        {value ?? <span className="font-normal text-slate-400">Non renseigné</span>}
      </div>
    </div>
  );
}

function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {children}
    </span>
  );
}

function ProductDetailSection({ prospect }: { prospect: ProspectDetail }) {
  const fields = getProductFields(prospect);

  return (
    <DetailSection title={`Informations ${getProductLabel(prospect.product)}`}>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <InfoField key={field.label} label={field.label} value={field.value} />
        ))}
      </div>
    </DetailSection>
  );
}

function getProductFields(prospect: ProspectDetail) {
  switch (prospect.product) {
    case "KARMDA":
      return [
        { label: "Type d’établissement", value: prospect.schoolType },
        {
          label: "Nombre estimé d’élèves",
          value: prospect.estimatedStudentCount,
        },
        {
          label: "Système scolaire actuel",
          value: prospect.currentSchoolSystem,
        },
        { label: "Rôle du contact", value: prospect.contactRole },
      ];
    case "LOKARI":
      return [
        { label: "Type de propriétaire", value: prospect.propertyOwnerType },
        {
          label: "Nombre estimé de biens",
          value: prospect.estimatedPropertyCount,
        },
        { label: "Pays des propriétés", value: prospect.propertyCountries },
        {
          label: "Système immobilier actuel",
          value: prospect.currentPropertySystem,
        },
      ];
    case "NIA":
      return [
        { label: "Type de groupe", value: prospect.savingsGroupType },
        {
          label: "Nombre estimé de membres",
          value: prospect.estimatedMemberCount,
        },
        {
          label: "Fréquence des cotisations",
          value: prospect.contributionFrequency,
        },
        {
          label: "Système d’épargne actuel",
          value: prospect.currentSavingsSystem,
        },
      ];
    case "DIGITAL_SERVICES":
      return [
        { label: "Catégorie d’activité", value: prospect.businessCategory },
        { label: "Service demandé", value: prospect.requestedService },
      ];
  }
}

function getProductLabel(product: ProspectDetail["product"]) {
  return {
    KARMDA: "KARMDA",
    LOKARI: "LOKARI",
    NIA: "NIA",
    DIGITAL_SERVICES: "Services digitaux",
  }[product];
}

function getInterestLabel(interest: ProspectDetail["interest"]) {
  return {
    NOT_INTERESTED: "Pas intéressé",
    MAYBE: "Peut-être",
    NEEDS_INFORMATION: "Veut plus d’informations",
    INTERESTED: "Intéressé",
    READY_TO_DISCUSS: "Prêt à discuter",
  }[interest];
}

function getInterestStyles(interest: ProspectDetail["interest"]) {
  if (interest === "INTERESTED" || interest === "READY_TO_DISCUSS") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (interest === "NOT_INTERESTED") {
    return "bg-red-100 text-red-800";
  }
  if (interest === "NEEDS_INFORMATION") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
}

function getStatusLabel(status: ProspectDetail["status"]) {
  return {
    NEW: "Nouveau",
    TO_FOLLOW_UP: "À suivre",
    CONTACTED: "Contacté",
    QUALIFIED: "Qualifié",
    PROPOSAL_SENT: "Proposition envoyée",
    WON: "Gagné",
    LOST: "Perdu",
  }[status];
}

function getOnlinePresenceLabel(
  presence: ProspectDetail["onlinePresence"],
) {
  if (!presence) {
    return null;
  }

  return {
    NONE: "Aucune",
    WHATSAPP: "WhatsApp Business",
    SOCIAL_MEDIA: "Réseaux sociaux",
    WEBSITE: "Site internet",
    MULTIPLE: "Plusieurs plateformes",
  }[presence];
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
