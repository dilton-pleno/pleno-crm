import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PipelineConfigClient } from "./pipeline-client";

export default async function PipelineConfigPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // Configuração de pipeline é restrita a Admin.
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: "default-pipeline" },
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: { _count: { select: { cards: true } } },
      },
    },
  });

  if (!pipeline) redirect("/configuracoes");

  const stages = pipeline.stages.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    position: s.position,
    card_count: s._count.cards,
  }));

  return (
    <PipelineConfigClient
      pipelineId={pipeline.id}
      pipelineName={pipeline.name}
      initialStages={stages}
    />
  );
}
