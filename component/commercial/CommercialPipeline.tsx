import { prospectStatusOptions } from "@/src/lib/constants/prospect-options";
import type { CommercialDashboard } from "@/src/services/commercial-dashboard.service";

type CommercialPipelineProps = {
  pipeline: CommercialDashboard["pipeline"];
};

function statusLabel(status: string) {
  return (
    prospectStatusOptions.find((option) => option.value === status)?.label ??
    status
  );
}

export default function CommercialPipeline({
  pipeline,
}: CommercialPipelineProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[#0f2557]">Pipeline personnel</h2>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {pipeline.map((stage) => (
          <div
            key={stage.status}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <p className="text-2xl font-bold text-slate-900">{stage.count}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {statusLabel(stage.status)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {Math.round(stage.percentage)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
