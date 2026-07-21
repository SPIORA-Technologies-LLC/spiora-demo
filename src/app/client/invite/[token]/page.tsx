import type { Metadata } from "next";
import { ClientInvitePage } from "@/components/client-portal/ClientInvitePage";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Spiora Client invitation",
  robots: { index: false, follow: false },
  other: {
    "referrer": "no-referrer",
  },
};

export default async function InviteTokenPage({ params }: Props) {
  const { token: raw } = await params;
  let token = raw;
  try {
    token = decodeURIComponent(raw);
  } catch {
    token = "";
  }

  return <ClientInvitePage token={token} />;
}
