import type { InterestLevel, ProspectStatus } from "@prisma/client";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export type FollowUpPriorityInput = {
  followUpDate: Date | null;
  createdAt: Date;
};

export function getOverdueDays(followUpDate: Date, today = new Date()) {
  return dayNumber(today) - dayNumber(followUpDate);
}

export function isOverdue(followUpDate: Date | null, today = new Date()) {
  return followUpDate !== null && getOverdueDays(followUpDate, today) > 0;
}

export function isToday(followUpDate: Date | null, today = new Date()) {
  return followUpDate !== null && getOverdueDays(followUpDate, today) === 0;
}

export function getFollowUpLabel(
  followUpDate: Date | null,
  today = new Date(),
) {
  if (!followUpDate) {
    return "Date à planifier";
  }

  const overdueDays = getOverdueDays(followUpDate, today);

  if (overdueDays === 0) {
    return "Aujourd’hui";
  }
  if (overdueDays > 0) {
    return `En retard de ${overdueDays} jour${overdueDays > 1 ? "s" : ""}`;
  }
  if (overdueDays === -1) {
    return "Demain";
  }

  return `Dans ${Math.abs(overdueDays)} jours`;
}

export function queuePriority(
  followUpDate: Date | null,
  today = new Date(),
) {
  if (!followUpDate) {
    return 3;
  }
  if (isOverdue(followUpDate, today)) {
    return 0;
  }
  if (isToday(followUpDate, today)) {
    return 1;
  }
  return 2;
}

export function isFollowUpQueueCandidate(
  prospect: {
    status: ProspectStatus;
    followUpDate: Date | null;
  },
  today = new Date(),
) {
  if (prospect.status === "WON" || prospect.status === "LOST") {
    return false;
  }

  return (
    prospect.status === "TO_FOLLOW_UP" ||
    (prospect.followUpDate !== null &&
      getOverdueDays(prospect.followUpDate, today) >= 0)
  );
}

export function compareFollowUpPriority(
  left: FollowUpPriorityInput,
  right: FollowUpPriorityInput,
) {
  if (left.followUpDate && right.followUpDate) {
    const dateDifference =
      left.followUpDate.getTime() - right.followUpDate.getTime();
    if (dateDifference !== 0) {
      return dateDifference;
    }
  } else if (left.followUpDate) {
    return -1;
  } else if (right.followUpDate) {
    return 1;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

export function getFollowUpQueueKpis(
  items: Array<{
    followUpDate: Date | null;
    interest: InterestLevel;
  }>,
  today = new Date(),
) {
  return {
    dueToday: items.length,
    overdue: items.filter((item) => isOverdue(item.followUpDate, today)).length,
    thisWeek: items.filter((item) => {
      if (!item.followUpDate) {
        return false;
      }
      const overdueDays = getOverdueDays(item.followUpDate, today);
      return overdueDays <= 0 && overdueDays >= -7;
    }).length,
    readyToDiscuss: items.filter(
      (item) => item.interest === "READY_TO_DISCUSS",
    ).length,
  };
}

export function startOfCalendarDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfNextCalendarDay(date: Date) {
  const nextDay = startOfCalendarDay(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

function dayNumber(date: Date) {
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
    DAY_IN_MILLISECONDS
  );
}
