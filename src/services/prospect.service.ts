import "server-only";

import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ValidatedProspectInput } from "@/src/lib/validations/prospect.schema";
import { ProspectFilters } from "../types/propect.-filters";

export type CreateProspectResult =
  | {
      success: true;
      prospectId: string;
    }
  | {
      success: false;
      code: "CREATE_FAILED";
      message: string;
    };

export async function createProspect(
  input: ValidatedProspectInput,
): Promise<CreateProspectResult> {
  try {
    const prospect = await prisma.prospect.create({
      data: buildProspectData(input),
      select: {
        id: true,
      },
    });

    return {
      success: true,
      prospectId: prospect.id,
    };
  } catch (error) {
    console.error("Unable to create prospect:", error);

    return {
      success: false,
      code: "CREATE_FAILED",
      message: "Le rapport n’a pas pu être enregistré. Veuillez réessayer.",
    };
  }
}

export async function getProspects(filters: ProspectFilters = {}) {
  const where: Prisma.ProspectWhereInput = {};

  if (filters.product) {
    where.product = filters.product;
  }

  if (filters.interest) {
    where.interest = filters.interest;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.agent) {
    where.agentName = filters.agent;
  }

  if (filters.search) {
    where.OR = [
      {
        name: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        contactName: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        phone: {
          contains: filters.search,
        },
      },
      {
        location: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(start);

    end.setDate(end.getDate() + 1);

    where.createdAt = {
      gte: start,
      lt: end,
    };
  }

  return prisma.prospect.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
  });
}

export type ProspectListItem = Awaited<ReturnType<typeof getProspects>>[number];

function buildProspectData(input: ValidatedProspectInput) {
  const sharedData = {
    product: input.product,
    name: input.name,
    prospectType: input.prospectType,
    contactName: input.contactName,
    phone: input.phone,
    location: input.location,
    interest: input.interest,
    status: input.status,
    onlinePresence: input.onlinePresence,
    nextAction: input.nextAction,
    followUpDate: input.followUpDate,
    notes: input.notes,
    agentName: input.agentName,
  };

  switch (input.product) {
    case "KARMDA":
      return {
        ...sharedData,
        schoolType: input.schoolType,
        estimatedStudentCount: input.estimatedStudentCount,
        currentSchoolSystem: input.currentSchoolSystem,
        contactRole: input.contactRole,
      };

    case "LOKARI":
      return {
        ...sharedData,
        propertyOwnerType: input.propertyOwnerType,
        estimatedPropertyCount: input.estimatedPropertyCount,
        propertyCountries: input.propertyCountries,
        currentPropertySystem: input.currentPropertySystem,
      };

    case "NIA":
      return {
        ...sharedData,
        savingsGroupType: input.savingsGroupType,
        estimatedMemberCount: input.estimatedMemberCount,
        contributionFrequency: input.contributionFrequency,
        currentSavingsSystem: input.currentSavingsSystem,
      };

    case "DIGITAL_SERVICES":
      return {
        ...sharedData,
        businessCategory: input.businessCategory,
        requestedService: input.requestedService,
      };
  }
}
