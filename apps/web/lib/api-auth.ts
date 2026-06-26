import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { Module, Role } from "@pleno-crm/types";
import { auth } from "@/lib/auth";
import { getAccessLevel } from "@/lib/permissions";

type GuardResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/**
 * Valida sessão e permissão de role para uma rota de API.
 *
 * @param module módulo da matriz de permissões (ex.: "atendimento", "contatos")
 * @param level  "read" libera quem tem qualquer acesso (read/full/request);
 *               "full" exige acesso total (bloqueia quem é só leitura).
 *               Use "full" para mutações.
 *
 * Uso:
 *   const guard = await requireAccess("atendimento", "full");
 *   if (!guard.ok) return guard.response;
 *   const session = guard.session;
 */
export async function requireAccess(
  module: Module,
  level: "read" | "full" = "read"
): Promise<GuardResult> {
  const session = await auth();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Não autenticado" } },
        { status: 401 }
      ),
    };
  }

  const access = getAccessLevel(session.user.role, module);
  const allowed = level === "read" ? access !== "none" : access === "full";

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão para esta ação" } },
        { status: 403 }
      ),
    };
  }

  return { ok: true, session };
}

/**
 * Valida sessão e exige que o papel esteja na lista permitida. Útil para ações
 * cujo módulo é `full` para todos os papéis (ex.: kanban) mas que só ADMIN/GESTOR
 * podem executar — como CRUD de pipelines, tags e respostas rápidas.
 */
export async function requireRoles(roles: Role[]): Promise<GuardResult> {
  const session = await auth();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Não autenticado" } },
        { status: 401 }
      ),
    };
  }
  if (!roles.includes(session.user.role as Role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão para esta ação" } },
        { status: 403 }
      ),
    };
  }
  return { ok: true, session };
}
