import assert from "node:assert/strict";
import test from "node:test";

import {
  findProfessionalContributionTrait,
  isExtremeProfessionalContributionLevel,
  isRoleSupportedForProfessionalContribution,
  professionalContributionAnchorLevels,
  PROFESSIONAL_CONTRIBUTION_CATALOG,
  PROFESSIONAL_CONTRIBUTION_MAX_SCORE,
} from "./professional-contribution-catalog";

test("§52: total max points across the shared catalog is exactly 10", () => {
  const total = PROFESSIONAL_CONTRIBUTION_CATALOG.reduce(
    (sum, trait) => sum + trait.maxPoints,
    0,
  );
  assert.equal(total, PROFESSIONAL_CONTRIBUTION_MAX_SCORE);
});

test("§52: every trait has exactly five anchors, levels 1-5 in order, no duplicates or omissions", () => {
  for (const trait of PROFESSIONAL_CONTRIBUTION_CATALOG) {
    assert.deepEqual(
      trait.anchors.map((anchor) => anchor.level),
      professionalContributionAnchorLevels,
      `${trait.key} anchor levels must exactly match professionalContributionAnchorLevels in order`,
    );
  }
});

test("§52: anchor keys are globally unique", () => {
  const keys = PROFESSIONAL_CONTRIBUTION_CATALOG.map((trait) => trait.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("§52: no anchor text is empty — every level has a real behavioral description", () => {
  for (const trait of PROFESSIONAL_CONTRIBUTION_CATALOG) {
    for (const anchor of trait.anchors) {
      assert.ok(
        anchor.text.trim().length > 10,
        `${trait.key} level ${anchor.level} anchor text is missing or too short`,
      );
    }
  }
});

test("no anchor uses personality, intelligence, or moralistic language (Ticket 25J §2/§16)", () => {
  const forbidden = [
    /\blazy\b/i,
    /\bunmotivated\b/i,
    /\bpoor attitude\b/i,
    /\bsmart\b/i,
    /\bcares?\b/i,
    /\bmotivated\b/i,
    /\bpersonnalit[ée]\b/i,
    /attitude/i,
  ];
  for (const trait of PROFESSIONAL_CONTRIBUTION_CATALOG) {
    for (const anchor of trait.anchors) {
      for (const pattern of forbidden) {
        assert.doesNotMatch(
          anchor.text,
          pattern,
          `${trait.key} level ${anchor.level} anchor uses forbidden language: ${pattern}`,
        );
      }
    }
  }
});

test("the top anchor never rewards overstepping role authority (Ticket 25J §13)", () => {
  const initiative = findProfessionalContributionTrait("INITIATIVE");
  const topAnchor = initiative?.anchors.find((anchor) => anchor.level === 5);
  assert.match(topAnchor!.text, /dans les limites de son rôle/);
});

test("COMMERCIAL and MANAGER are both supported by the same shared catalog; ADMIN is not (Ticket 25J §6/§7)", () => {
  assert.equal(isRoleSupportedForProfessionalContribution("COMMERCIAL"), true);
  assert.equal(isRoleSupportedForProfessionalContribution("MANAGER"), true);
  assert.equal(isRoleSupportedForProfessionalContribution("ADMIN"), false);
});

test("findProfessionalContributionTrait returns the exact match or undefined, never a fuzzy fallback", () => {
  assert.equal(findProfessionalContributionTrait("INITIATIVE")?.maxPoints, 4);
  assert.equal(findProfessionalContributionTrait("NOT_A_REAL_KEY"), undefined);
});

test("isExtremeProfessionalContributionLevel is true only for levels 1 and 5", () => {
  assert.equal(isExtremeProfessionalContributionLevel(1), true);
  assert.equal(isExtremeProfessionalContributionLevel(5), true);
  assert.equal(isExtremeProfessionalContributionLevel(2), false);
  assert.equal(isExtremeProfessionalContributionLevel(3), false);
  assert.equal(isExtremeProfessionalContributionLevel(4), false);
});
