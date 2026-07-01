import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getGoogleAccessToken } from "@/lib/google-config";

export async function POST(): Promise<NextResponse> {
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;

  try {
    // Sucesso na troca do refresh token por access token = credenciais OAuth OK.
    await getGoogleAccessToken();
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error("[integrations/google] Teste falhou:", err);
    const detail =
      err instanceof Error
        ? err.message
        : "Falha na conexão com o Google (verifique client/secret/refresh token)";
    return NextResponse.json(
      { error: { code: "GOOGLE_ERROR", message: detail } },
      { status: 502 }
    );
  }
}
