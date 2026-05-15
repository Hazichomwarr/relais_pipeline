import { BusinessStatType } from "@/app/admin/page";

export default function BusinessType({
  businessStats,
}: {
  businessStats: BusinessStatType[];
}) {
  return (
    <div className="mt-8 rounded-4xl border border-slate-200 bg-white p-6">
      <h2 className="mb-6 text-2xl font-bold">
        Répartition par type de business
      </h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {businessStats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${item.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>

                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-3xl font-bold">{item.value}</span>

                    <span className="text-sm text-slate-500">
                      {item.percent}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
