import assert from "node:assert/strict";
import test from "node:test";

import { resolveRelaisOrganizationIdCore } from "./organization-bootstrap.service-core";
import { RELAIS_ORGANIZATION_SLUG } from "@/src/lib/organization";

function fakeClient(organizations: Array<{ id: string; slug: string }>) {
  return {
    organization: {
      findUnique: async ({ where }: { where: { slug: string } }) => {
        const found = organizations.find((org) => org.slug === where.slug);
        return found ? { id: found.id } : null;
      },
    },
  };
}

test("resolves the RELAIS organization id by its stable slug", async () => {
  const client = fakeClient([
    { id: "org-relais", slug: RELAIS_ORGANIZATION_SLUG },
    { id: "org-other", slug: "some-other-tenant" },
  ]);

  const id = await resolveRelaisOrganizationIdCore(client);

  assert.equal(id, "org-relais");
});

test("throws loudly, rather than upserting one, when the RELAIS organization is missing", async () => {
  const client = fakeClient([]);

  await assert.rejects(
    () => resolveRelaisOrganizationIdCore(client),
    (error: unknown) =>
      error instanceof Error && error.message.includes(RELAIS_ORGANIZATION_SLUG),
  );
});

test("never resolves a differently-slugged organization as a substitute for RELAIS", async () => {
  const client = fakeClient([{ id: "org-other", slug: "acme" }]);

  await assert.rejects(() => resolveRelaisOrganizationIdCore(client));
});
