import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { requireConversationAccess } from "@/lib/resource-access";
import { prisma } from "@/lib/prisma";

// Content-Type padrão por tipo de mídia, usado quando o mime real não foi
// capturado do Evolution.
const FALLBACK_MIME: Record<string, string> = {
  image: "image/jpeg",
  sticker: "image/webp",
  audio: "audio/ogg",
  video: "video/mp4",
  document: "application/octet-stream",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "read");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const message = await prisma.message.findUnique({
    where: { id },
    select: {
      conversationId: true,
      mediaData: true,
      mediaType: true,
      mediaMimeType: true,
      mediaFileName: true,
    },
  });

  if (!message || !message.mediaData) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Mídia não encontrada" } },
      { status: 404 }
    );
  }

  // Object-level authz: só serve mídia de conversas de Canais visíveis.
  const access = await requireConversationAccess(guard.session, message.conversationId);
  if (!access.ok) return access.response;

  const mime =
    message.mediaMimeType ??
    (message.mediaType ? FALLBACK_MIME[message.mediaType] : undefined) ??
    "application/octet-stream";

  // Documentos são entregues inline com nome de arquivo; demais mídias inline
  // para renderizar direto em <img>/<audio>/<video>.
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Cache-Control": "private, max-age=86400",
  };
  if (message.mediaType === "document" && message.mediaFileName) {
    headers["Content-Disposition"] = `inline; filename="${message.mediaFileName}"`;
  }

  return new NextResponse(new Uint8Array(message.mediaData), { headers });
}
