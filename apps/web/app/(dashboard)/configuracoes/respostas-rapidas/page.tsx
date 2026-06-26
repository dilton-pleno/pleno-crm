import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RespostasRapidasClient } from "./respostas-rapidas-client";

export default async function RespostasRapidasPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  const replies = await prisma.quickReply.findMany({
    where: { OR: [{ createdBy: session.user.id }, { shared: true }] },
    orderBy: { title: "asc" },
  });

  return (
    <RespostasRapidasClient
      initialReplies={replies.map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        shared: r.shared,
        owned: r.createdBy === session.user.id,
      }))}
    />
  );
}
