import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { getMetaConfig, type MetaConfig } from "@/lib/meta-config";
import { metaCredsFromIntegration } from "@/lib/integrations";

// Credenciais Meta de mensageria POR CANAL (Inbox). page/IG ficam em colunas
// próprias (metaPageId/metaIgId); o token de acesso da página é cifrado em
// Inbox.metaConfig. appId/appSecret/verifyToken são de nível do app (1 app
// Meta) e permanecem globais (lib/meta-config.ts).
interface StoredInboxMeta {
  accessTokenEnc?: string;
}

function dec(v: string | undefined): string | null {
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

/**
 * Config de mensageria Meta a usar para um Canal (envio/perfil). Quando o Canal
 * tem page/token próprios, usa-os; senão cai na config global (getMetaConfig).
 * Sem inboxId, retorna a config global — comportamento idêntico ao anterior.
 */
export async function getMessagingConfig(inboxId?: string | null): Promise<MetaConfig> {
  const global = await getMetaConfig();
  if (!inboxId) return global;

  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { metaPageId: true, metaIgId: true, metaConfig: true, metaIntegration: true },
  });
  if (!inbox) return global;

  // Preferir a INTEGRAÇÃO Meta vinculada (novo modelo); App ID/Secret/Verify globais.
  if (inbox.metaIntegration) {
    const c = metaCredsFromIntegration(inbox.metaIntegration);
    return {
      appId: global.appId,
      appSecret: global.appSecret,
      accessToken: c.accessToken ?? global.accessToken,
      pageId: c.pageId || global.pageId,
      igId: c.igId || global.igId,
      verifyToken: global.verifyToken,
    };
  }

  // Fallback: colunas antigas do Canal (transição).
  const s = (inbox.metaConfig as StoredInboxMeta | null) ?? {};
  return {
    appId: global.appId,
    appSecret: global.appSecret,
    accessToken: dec(s.accessTokenEnc) ?? global.accessToken,
    pageId: inbox.metaPageId || global.pageId,
    igId: inbox.metaIgId || global.igId,
    verifyToken: global.verifyToken,
  };
}

/**
 * Mescla o token Meta (cifrado) no metaConfig atual do Canal. Token vazio
 * mantém o valor existente. Retorna o JSON pronto para gravar.
 */
export function buildInboxMetaConfig(
  current: Prisma.JsonValue | null,
  accessToken?: string
): Prisma.InputJsonValue {
  const next: StoredInboxMeta = { ...((current as StoredInboxMeta | null) ?? {}) };
  if (accessToken) next.accessTokenEnc = encrypt(accessToken);
  return next as unknown as Prisma.InputJsonValue;
}

/** Indica se o Canal tem token Meta próprio guardado. */
export function inboxHasMetaToken(metaConfig: Prisma.JsonValue | null): boolean {
  return Boolean((metaConfig as StoredInboxMeta | null)?.accessTokenEnc);
}
