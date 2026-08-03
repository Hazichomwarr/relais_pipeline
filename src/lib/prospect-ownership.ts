export type ProspectOwnershipDisplay = {
  agentName: string;
  assignedUser: {
    firstName: string;
    lastName: string;
  } | null;
};

export function getAssignedUserName(prospect: ProspectOwnershipDisplay) {
  return prospect.assignedUser
    ? `${prospect.assignedUser.firstName} ${prospect.assignedUser.lastName}`
    : prospect.agentName;
}
