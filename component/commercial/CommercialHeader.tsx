import { dashboardGreeting } from "@/src/lib/commercial-dashboard-presentation";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function CommercialHeader({
  firstName,
  today = new Date(),
}: {
  firstName: string;
  today?: Date;
}) {
  const formattedDate = dateFormatter.format(today);
  const capitalizedDate =
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{capitalizedDate}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0f2557] sm:text-4xl">
        {dashboardGreeting(firstName, today)}
      </h1>
      <p className="mt-2 text-slate-500">
        Voici les actions et opportunités qui demandent votre attention.
      </p>
    </div>
  );
}
