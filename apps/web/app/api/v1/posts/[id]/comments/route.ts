import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPostComments } from "@/lib/meta";
import { upsertPostComment } from "@/lib/post-comment";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;

  const { id: postId } = await params;
  const { searchParams } = request.nextUrl;
  const inboxId = searchParams.get("inbox_id");
  const platform = searchParams.get("platform") === "facebook" ? "facebook" : "instagram";

  let comments;
  try {
    comments = await getPostComments(postId, inboxId);
  } catch (err) {
    console.error("[posts/comments] Erro ao buscar comentários:", err);
    return NextResponse.json(
      { error: { code: "GRAPH_ERROR", message: "Falha ao buscar comentários" } },
      { status: 502 }
    );
  }

  // Registra os comentários no CRM para acompanhar estado de resposta.
  await Promise.all(
    comments.map((c) =>
      upsertPostComment({
        commentId: c.id,
        postId,
        authorId: c.from?.id ?? "",
        authorName: c.username ?? c.from?.username ?? "Desconhecido",
        content: c.text ?? "",
        createdAt: c.timestamp ? new Date(c.timestamp) : undefined,
        inboxId,
        platform,
      })
    )
  );

  // Estado de resposta a partir do que está gravado.
  const stored = await prisma.postComment.findMany({
    where: { commentId: { in: comments.map((c) => c.id) } },
    select: { commentId: true, repliedAt: true, replyContent: true },
  });
  const storedMap = Object.fromEntries(stored.map((s) => [s.commentId, s]));

  const data = comments.map((c) => {
    const s = storedMap[c.id];
    return {
      id: c.id,
      author_name: c.username ?? c.from?.username ?? "Desconhecido",
      author_id: c.from?.id ?? "",
      content: c.text ?? "",
      created_at: c.timestamp ?? null,
      replied: Boolean(s?.repliedAt),
      reply_content: s?.replyContent ?? null,
    };
  });

  return NextResponse.json({ data });
}
