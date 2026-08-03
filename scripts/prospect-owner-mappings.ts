import type { ProspectOwnerMapping } from "@/src/services/prospect-owner-reconciliation";

/**
 * This map must be filled only after a human has reviewed the historical
 * agentName values and confirmed the stable User IDs. Exact spelling variants
 * must be listed deliberately; no normalization or fuzzy matching is applied.
 */
export const prospectOwnerMappings: ProspectOwnerMapping[] = [
  {
    userId: "cmsdjw42700004srq84328xxu",
    historicalAgentNames: ["Jean Imain N'do"],
  },

  {
    // Historical data stored surname first.
    userId: "cmsdjxpci00014srqcngcr02j",
    historicalAgentNames: ["Koane Amidou"],
  },
  {
    // Historical reports sometimes omitted the first name.
    userId: "cmsdjzlux00024srqg5orve9v",
    historicalAgentNames: ["Nignan", "Nignan Abdoulaye"],
  },
  {
    // Historical capitalization.
    userId: "cmsdk1rsu00034srqye58lpeh",
    historicalAgentNames: ["julbert serme"],
  },
];
