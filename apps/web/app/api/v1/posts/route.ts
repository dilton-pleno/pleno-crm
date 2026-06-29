import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getRecentPosts, getRecentPagePosts } from "@/lib/meta";
import { getMessagingConfig } from "@/lib/inbox-config";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;

  const { searchParams } = request.nextUrl;
  const platform = searchParams.get("platform") === "facebook" ? "facebook" : "instagram";
  const inboxId = searchParams.get("inbox_id");

  // Credenciais resolvidas do Canal (fallback global). IG usa igId; FB usa pageId.
  const cfg = await getMessagingConfig(inboxId);
  const igUserId = cfg.igId || process.env.META_IG_USER_ID || null;
  const pageId = cfg.pageId || null;

  const target = platform === "facebook" ? pageId : igUserId;
  if (!target) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_CONFIGURED",
          message:
            platform === "facebook"
              ? "Página do Facebook não configurada neste Canal"
              : "Conta do Instagram não configurada neste Canal",
        },
      },
      { status: 422 }
    );
  }

  let posts;
  try {
    posts =
      platform === "facebook"
        ? await getRecentPagePosts(target, inboxId)
        : await getRecentPosts(target, inboxId);
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
