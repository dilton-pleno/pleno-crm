import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InboxClient } from "./inbox-client";

export default async function AtendimentoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <InboxClient
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
