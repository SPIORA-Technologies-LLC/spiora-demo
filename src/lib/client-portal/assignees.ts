import "server-only";

import { listTeamMembers } from "@/lib/team/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sbListActiveUserProfiles } from "@/lib/supabase/user-profiles-repo";
import {
  canEmployeeAssignTo,
  type ClientInvitationAssignee,
  type EmployeeInvitationContext,
} from "./assignee-context";

export type { ClientInvitationAssignee, EmployeeInvitationContext };
export { canEmployeeAssignTo, isAssigneeIdInPool } from "./assignee-context";

export async function listClientInvitationAssignees(): Promise<
  ClientInvitationAssignee[]
> {
  if (isSupabaseConfigured()) {
    const profiles = await sbListActiveUserProfiles();
    return profiles
      .filter((p) => p.role === "owner" || p.role === "manager")
      .map((p) => ({
        id: p.id,
        name: p.displayName,
        role: p.role as "owner" | "manager",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const members = await listTeamMembers();
  return members
    .filter((m) => m.role === "owner" || m.role === "manager")
    .map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
    }));
}

export async function isValidClientInvitationAssignee(
  assigneeId: string,
  context: EmployeeInvitationContext,
): Promise<boolean> {
  const assignees = await listClientInvitationAssignees();
  return canEmployeeAssignTo(assigneeId, context, assignees);
}

export async function resolveAssigneeDisplayName(
  assigneeId: string | null,
): Promise<string | null> {
  if (!assigneeId) return null;
  const assignees = await listClientInvitationAssignees();
  return assignees.find((a) => a.id === assigneeId)?.name ?? null;
}
