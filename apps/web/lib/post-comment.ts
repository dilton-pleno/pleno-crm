import { prisma } from "@/lib/prisma";
import { getPostById } from "@/lib/meta";

export interface IncomingComment {
  commentId: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt?: Date;
}

/**
 * Registra (ou atualiza) um comentário de post de forma idempotente.
 * Resolve caption/mídia do post via Graph apenas quando ainda não temos
 * esses dados gravados, evitando chamadas desnecessárias.
 */
export async function upsertPostComment(c: IncomingComment): Promise<void> {
  const existing = await prisma.postComment.findUnique({
    where: { commentId: c.commentId },
  });

  // Busca metadados do post só se for um comentário novo (sem registro).
  let postCaption: string | null = existing?.postCaption ?? null;
  let postMediaUrl: string | null = existing?.postMediaUrl ?? null;
  if (!existing) {
    const post = await getPostById(c.postId);
    postCaption = post?.caption ?? null;
    postMediaUrl = post?.media_url ?? null;
  }

  await prisma.postComment.upsert({
    where: { commentId: c.commentId },
    update: {
      content: c.content,
      authorName: c.authorName,
      authorId: c.authorId,
    },
    create: {
      commentId: c.commentId,
      postId: c.postId,
      postCaption,
      postMediaUrl,
      authorId: c.authorId,
      authorName: c.authorName,
      content: c.content,
      createdAt: c.createdAt ?? new Date(),
    },
  });
}
