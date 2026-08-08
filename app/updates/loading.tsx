export default function UpdatesLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="mb-8">
        <div className="h-9 w-40 rounded-xl bg-slate-200" />
        <div className="mt-3 h-5 w-80 max-w-full rounded bg-slate-200" />
      </div>

      <div className="space-y-8">
        {Array.from({ length: 2 }, (_, groupIndex) => (
          <div key={groupIndex}>
            <div className="mb-3 h-4 w-28 rounded bg-slate-200" />

            <div className="space-y-4">
              {Array.from({ length: 3 }, (_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-4 w-1/2 rounded bg-slate-200" />
                    <div className="h-3 w-24 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
