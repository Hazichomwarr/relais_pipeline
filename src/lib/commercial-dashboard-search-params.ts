export function buildCommercialDashboardUrl(
  currentSearchParams: string,
  name: string,
  value: string,
) {
  const nextParams = new URLSearchParams(currentSearchParams);

  if (value) {
    nextParams.set(name, value);
  } else {
    nextParams.delete(name);
  }

  const query = nextParams.toString();
  return query
    ? `/dashboard/commercial?${query}`
    : "/dashboard/commercial";
}
