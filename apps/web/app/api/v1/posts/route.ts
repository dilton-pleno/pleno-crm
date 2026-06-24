import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getRecentPosts } from "@/lib/meta";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;

  const igUserId = process.env.META_IG_USER_ID;
  if (!igUserId) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "META_IG_USER_ID não configurada" } },
      { status: 500 }
    );
  }

  let posts;
  try {
    posts = await getRecentPosts(igUserId);
  } catch (err) {
    console.error("[posts] Erro ao buscar posts na Graph API:", err);
    return NextResponse.json(
      { error: { code: "GRAPH_ERROR", message: "Falha ao buscar posts" } },
      { status: 502 }
    );
  }

  // Comentários sem resposta por post, a partir do que foi registrado no CRM.
  const unanswered = await prisma.postComment.groupBy({
    by: ["postId"],
    where: { postId: { in: posts.map((p) => p.id) }, repliedAt: null },
    _count: { id: true },
  });
  const unansweredMap = Object.fromEntries(
    unanswered.map((u) => [u.postId, u._count.id])
  );

  const data = posts.map((p) => ({
    id: p.id,
    media_url: p.media_url ?? null,
    caption: p.caption ?? null,
    timestamp: p.timestamp ?? null,
    comment_count: p.comments_count ?? 0,
    unanswered_comments: unansweredMap[p.id] ?? 0,
  }));

  return NextResponse.json({ data });
}
