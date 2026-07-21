export type ClientInvitationAssignee = {
  id: string;
  name: string;
  role: "owner" | "manager";
};

/** Authenticated employee creating an invitation (phase 1: single-tenant pool). */
export type EmployeeInvitationContext = {
  employeeId: string;
  employeeRole: "owner" | "manager";
};

export function isAssigneeIdInPool(
  assigneeId: string,
  pool: readonly ClientInvitationAssignee[],
): boolean {
  const trimmed = assigneeId.trim();
  if (!trimmed) return false;
  return pool.some((a) => a.id === trimmed);
}

export function canEmployeeAssignTo(
  assigneeId: string,
  context: EmployeeInvitationContext,
  pool: readonly ClientInvitationAssignee[],
): boolean {
  if (context.employeeRole !== "owner" && context.employeeRole !== "manager") {
    return false;
  }
  if (!isAssigneeIdInPool(context.employeeId, pool)) {
    return false;
  }
  return isAssigneeIdInPool(assigneeId, pool);
}
