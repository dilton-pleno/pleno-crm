import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PipelineConfigClient } from "./pipeline-client";

export default async function PipelineConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  // Configuração de pipeline é restrita a Admin.
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  const pipelines = await prisma.pipeline.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });
  const first = pipelines[0];
  if (!first) redirect("/configuracoes");

  const { pipeline: requested } = await searchParams;
  const selectedId =
    (requested && pipelines.some((p) => p.id === requested) && requested) ||
    pipelines.find((p) => p.isDefault)?.id ||
    first.id;

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: selectedId },
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
      pipelines={pipelines.map((p) => ({ id: p.id, name: p.name, is_default: p.isDefault }))}
      initialStages={stages}
    />
  );
}
