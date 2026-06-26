import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EtiquetasClient } from "./etiquetas-client";

export default async function EtiquetasPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });

  return (
    <EtiquetasClient
      initialTags={tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        contact_count: t._count.contacts,
      }))}
    />
  );
}
