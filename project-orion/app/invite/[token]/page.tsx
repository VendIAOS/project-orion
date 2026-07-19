import InviteAcceptPanel from "@/components/auth/InviteAcceptPanel";

interface InvitePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return <InviteAcceptPanel token={token} />;
}
