export type PortalChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type PortalChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: PortalChatTurn[];
};

export type PortalChatSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
};

export const MAX_PORTAL_CHATS = 50;
export const UNTITLED_PORTAL_CHAT = "New chat";
