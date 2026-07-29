import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  MAX_PORTAL_CHATS,
  UNTITLED_PORTAL_CHAT,
  type PortalChatSession,
  type PortalChatSummary,
  type PortalChatTurn,
} from "@/lib/ai/client-portal-chat-types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as sbChats from "@/lib/supabase/client-portal-chats-repo";

export { MAX_PORTAL_CHATS, UNTITLED_PORTAL_CHAT };
export type { PortalChatSession, PortalChatSummary, PortalChatTurn };

type UserChatStore = {
  sessions: PortalChatSession[];
};

function getStoreDir(): string {
  return path.join(process.cwd(), ".data", "client-portal-ai-chats");
}

function getStorePath(portalUserId: string): string {
  const safe = portalUserId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getStoreDir(), `${safe}.json`);
}

async function readStore(portalUserId: string): Promise<UserChatStore> {
  try {
    const raw = await readFile(getStorePath(portalUserId), "utf8");
    const data = JSON.parse(raw) as UserChatStore;
    if (!Array.isArray(data.sessions)) return { sessions: [] };
    return data;
  } catch {
    return { sessions: [] };
  }
}

async function writeStore(
  portalUserId: string,
  store: UserChatStore,
): Promise<void> {
  await mkdir(getStoreDir(), { recursive: true });
  store.sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  store.sessions = store.sessions.slice(0, MAX_PORTAL_CHATS);
  await writeFile(
    getStorePath(portalUserId),
    JSON.stringify(store, null, 2),
    "utf8",
  );
}

function makeTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, " ");
  if (!clean) return UNTITLED_PORTAL_CHAT;
  return clean.length > 56 ? `${clean.slice(0, 56)}…` : clean;
}

function isUntitled(title: string): boolean {
  return (
    !title.trim() ||
    title === UNTITLED_PORTAL_CHAT ||
    title === "Новый чат" ||
    title === "Untitled"
  );
}

function sanitizeTurns(messages: PortalChatTurn[]): PortalChatTurn[] {
  return messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 12_000),
    }))
    .slice(-40);
}

function toSummary(session: PortalChatSession): PortalChatSummary {
  const firstUser = session.messages.find((m) => m.role === "user");
  const last = session.messages[session.messages.length - 1];
  const preview =
    last?.content.slice(0, 80) ?? firstUser?.content.slice(0, 80) ?? "";

  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
    preview: preview.length > 80 ? `${preview.slice(0, 80)}…` : preview,
  };
}

export async function listPortalChats(
  portalUserId: string,
): Promise<PortalChatSummary[]> {
  if (isSupabaseConfigured()) {
    try {
      const sessions = await sbChats.sbListPortalChatSessions(portalUserId);
      return sessions.map(toSummary);
    } catch (error) {
      console.error("[portal-chats] supabase list", error);
      return [];
    }
  }

  const store = await readStore(portalUserId);
  return store.sessions
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toSummary);
}

export async function getPortalChat(
  portalUserId: string,
  chatId: string,
): Promise<PortalChatSession | null> {
  let session: PortalChatSession | null = null;
  if (isSupabaseConfigured()) {
    try {
      session = await sbChats.sbGetPortalChatSession(portalUserId, chatId);
    } catch (error) {
      console.error("[portal-chats] supabase get", error);
      return null;
    }
  } else {
    const store = await readStore(portalUserId);
    session = store.sessions.find((s) => s.id === chatId) ?? null;
  }

  if (!session) return null;
  return {
    ...session,
    messages: sanitizeTurns(session.messages),
  };
}

export async function createPortalChat(
  portalUserId: string,
  title: string = UNTITLED_PORTAL_CHAT,
): Promise<PortalChatSession> {
  const now = new Date().toISOString();
  const session: PortalChatSession = {
    id: randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  if (isSupabaseConfigured()) {
    try {
      await sbChats.sbInsertPortalChatSession(portalUserId, session);
      await sbChats.sbTrimPortalChats(portalUserId);
      return session;
    } catch (error) {
      console.error("[portal-chats] supabase create", error);
      throw error;
    }
  }

  const store = await readStore(portalUserId);
  store.sessions.unshift(session);
  await writeStore(portalUserId, store);
  return session;
}

export async function updatePortalChat(
  portalUserId: string,
  chatId: string,
  messages: PortalChatTurn[],
): Promise<PortalChatSession | null> {
  const existing = await getPortalChat(portalUserId, chatId);
  if (!existing) return null;

  const firstUser = messages.find((m) => m.role === "user");
  const title =
    isUntitled(existing.title) && firstUser
      ? makeTitle(firstUser.content)
      : existing.title;

  const updated: PortalChatSession = {
    ...existing,
    title,
    messages: sanitizeTurns(messages),
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      return await sbChats.sbUpdatePortalChatSession(portalUserId, updated);
    } catch (error) {
      console.error("[portal-chats] supabase update", error);
      return null;
    }
  }

  const store = await readStore(portalUserId);
  const index = store.sessions.findIndex((s) => s.id === chatId);
  if (index < 0) return null;
  store.sessions[index] = updated;
  await writeStore(portalUserId, store);
  return updated;
}

export async function deletePortalChat(
  portalUserId: string,
  chatId: string,
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      return await sbChats.sbDeletePortalChatSession(portalUserId, chatId);
    } catch (error) {
      console.error("[portal-chats] supabase delete", error);
      return false;
    }
  }

  const store = await readStore(portalUserId);
  const next = store.sessions.filter((s) => s.id !== chatId);
  if (next.length === store.sessions.length) return false;
  await writeStore(portalUserId, { sessions: next });
  return true;
}
