import "server-only";

import { getSupabaseAdmin } from "./server";
import {
  MAX_PORTAL_CHATS,
  type PortalChatSession,
  type PortalChatTurn,
} from "@/lib/ai/client-portal-chat-types";

type ChatRow = {
  id: string;
  portal_user_id: string;
  title: string;
  messages: PortalChatTurn[];
  created_at: string;
  updated_at: string;
};

function mapSession(row: ChatRow): PortalChatSession {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: Array.isArray(row.messages) ? row.messages : [],
  };
}

export async function sbListPortalChatSessions(
  portalUserId: string,
): Promise<PortalChatSession[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_portal_ai_chats")
    .select("*")
    .eq("portal_user_id", portalUserId)
    .order("updated_at", { ascending: false })
    .limit(MAX_PORTAL_CHATS);

  if (error) throw error;
  return (data as ChatRow[]).map(mapSession);
}

export async function sbGetPortalChatSession(
  portalUserId: string,
  chatId: string,
): Promise<PortalChatSession | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_portal_ai_chats")
    .select("*")
    .eq("portal_user_id", portalUserId)
    .eq("id", chatId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSession(data as ChatRow) : null;
}

export async function sbInsertPortalChatSession(
  portalUserId: string,
  session: PortalChatSession,
): Promise<PortalChatSession> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_portal_ai_chats")
    .insert({
      id: session.id,
      portal_user_id: portalUserId,
      title: session.title,
      messages: session.messages,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapSession(data as ChatRow);
}

export async function sbUpdatePortalChatSession(
  portalUserId: string,
  session: PortalChatSession,
): Promise<PortalChatSession> {
  const { data, error } = await getSupabaseAdmin()
    .from("client_portal_ai_chats")
    .update({
      title: session.title,
      messages: session.messages,
      updated_at: session.updatedAt,
    })
    .eq("portal_user_id", portalUserId)
    .eq("id", session.id)
    .select("*")
    .single();

  if (error) throw error;
  return mapSession(data as ChatRow);
}

export async function sbDeletePortalChatSession(
  portalUserId: string,
  chatId: string,
): Promise<boolean> {
  const { error, count } = await getSupabaseAdmin()
    .from("client_portal_ai_chats")
    .delete({ count: "exact" })
    .eq("portal_user_id", portalUserId)
    .eq("id", chatId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function sbTrimPortalChats(portalUserId: string): Promise<void> {
  const sessions = await sbListPortalChatSessions(portalUserId);
  if (sessions.length <= MAX_PORTAL_CHATS) return;

  const toDelete = sessions.slice(MAX_PORTAL_CHATS);
  for (const session of toDelete) {
    await sbDeletePortalChatSession(portalUserId, session.id);
  }
}
