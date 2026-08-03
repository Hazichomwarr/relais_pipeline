export default function FollowUpsLoading() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] px-6 py-8 lg:px-10">
      <div className="h-12 w-80 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-3xl bg-white"
          />
        ))}
      </div>
      <div className="mt-8 h-96 animate-pulse rounded-4xl bg-white" />
    </div>
  );
}
