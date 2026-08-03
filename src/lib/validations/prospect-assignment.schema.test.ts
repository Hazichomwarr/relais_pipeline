import assert from "node:assert/strict";
import test from "node:test";

import { prospectSchema } from "./prospect.schema";

function validProspectInput() {
  return {
    product: "KARMDA",
    name: "École Wend-Panga",
    prospectType: "École privée",
    contactName: "Mme Kaboré",
    phone: "70 12 34 56",
    location: "Ouagadougou",
    interest: "INTERESTED",
    status: "NEW",
    notes: "Le directeur souhaite organiser une démonstration.",
    assignedUserId: "user-commercial-1",
    schoolType: "Privée",
  };
}

test("requires a non-empty assigned User ID for new prospects", () => {
  const missing = prospectSchema.safeParse({
    ...validProspectInput(),
    assignedUserId: "",
  });
  const valid = prospectSchema.parse(validProspectInput());

  assert.equal(missing.success, false);
  assert.equal(valid.assignedUserId, "user-commercial-1");
});

test("does not accept a free-text agentName in place of assignedUserId", () => {
  const result = prospectSchema.safeParse({
    ...validProspectInput(),
    assignedUserId: undefined,
    agentName: "Aminata Ouédraogo",
  });

  assert.equal(result.success, false);
});
