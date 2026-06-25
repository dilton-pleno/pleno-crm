import { NextRequest, NextResponse } from "next/server";

/**
 * Valida o secret de rotas internas (chamadas pelo N8N, não por sessão de
 * usuário). O segredo vem no header `x-internal-secret` e deve casar com
 * `INTERNAL_API_SECRET`.
 *
 * Uso:
 *   const guard = requireInternalSecret(request);
 *   if (guard) return guard; // resposta 401 quando inválido
 */
export function requireInternalSecret(request: NextRequest): NextResponse | null {
  const secret = request.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Secret interno inválido" } },
      { status: 401 }
    );
  }

  return null;
}
