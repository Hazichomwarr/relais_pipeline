import type { UserRole } from "@prisma/client";

export type ProspectOwnerMapping = {
  userId: string;
  historicalAgentNames: string[];
};

export type ReconciliationResult = {
  userId: string;
  historicalAgentNames: string[];
  matched: number;
  updated: number;
};

export type ReconciliationTransaction = {
  findUsersByIds: (
    userIds: string[],
  ) => Promise<Array<{ id: string; role: UserRole }>>;
  countUnassigned: (historicalAgentNames: string[]) => Promise<number>;
  assignUnassigned: (
    userId: string,
    historicalAgentNames: string[],
  ) => Promise<number>;
};

export type ReconciliationDependencies = {
  runTransaction: <T>(
    work: (transaction: ReconciliationTransaction) => Promise<T>,
  ) => Promise<T>;
};

export async function reconcileProspectOwners(
  mappings: ProspectOwnerMapping[],
  dependencies: ReconciliationDependencies,
): Promise<ReconciliationResult[]> {
  validateMappings(mappings);

  return dependencies.runTransaction(async (transaction) => {
    const userIds = [...new Set(mappings.map((mapping) => mapping.userId))];
    const users = await transaction.findUsersByIds(userIds);
    const usersById = new Map(users.map((user) => [user.id, user]));

    for (const userId of userIds) {
      const user = usersById.get(userId);

      if (!user) {
        throw new Error(`Mapped User not found: ${userId}`);
      }

      if (user.role !== "COMMERCIAL") {
        throw new Error(`Mapped User is not COMMERCIAL: ${userId}`);
      }
    }

    const results: ReconciliationResult[] = [];

    for (const mapping of mappings) {
      const historicalAgentNames = [...new Set(mapping.historicalAgentNames)];
      const matched = await transaction.countUnassigned(
        historicalAgentNames,
      );
      const updated = await transaction.assignUnassigned(
        mapping.userId,
        historicalAgentNames,
      );

      if (matched !== updated) {
        throw new Error(
          `Reconciliation count changed for User ${mapping.userId}: matched ${matched}, updated ${updated}`,
        );
      }

      results.push({
        userId: mapping.userId,
        historicalAgentNames,
        matched,
        updated,
      });
    }

    return results;
  });
}

export function validateMappings(mappings: ProspectOwnerMapping[]) {
  const mappedNames = new Map<string, string>();

  for (const mapping of mappings) {
    if (!mapping.userId.trim()) {
      throw new Error("Every reconciliation mapping requires a User ID.");
    }

    if (mapping.historicalAgentNames.length === 0) {
      throw new Error(
        `Mapping for User ${mapping.userId} has no historical names.`,
      );
    }

    for (const historicalName of mapping.historicalAgentNames) {
      if (!historicalName) {
        throw new Error(
          `Mapping for User ${mapping.userId} contains an empty historical name.`,
        );
      }

      const previousUserId = mappedNames.get(historicalName);

      if (previousUserId && previousUserId !== mapping.userId) {
        throw new Error(
          `Historical name "${historicalName}" maps to both ${previousUserId} and ${mapping.userId}.`,
        );
      }

      mappedNames.set(historicalName, mapping.userId);
    }
  }
}
