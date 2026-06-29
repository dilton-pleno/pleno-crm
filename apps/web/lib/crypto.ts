import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from "crypto";

/** Comparação de strings em tempo constante (segredos/tokens de webhook). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Criptografia simétrica para segredos guardados no banco (ex.: senha da API
// Wbuy). Usa AES-256-GCM. A chave vem de ENCRYPTION_KEY; derivamos 32 bytes
// com SHA-256 para aceitar qualquer comprimento de chave configurada.
function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY não configurada");
  return createHash("sha256").update(secret).digest();
}

/**
 * Cifra um texto e retorna "iv:authTag:ciphertext" em base64.
 */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decifra o formato produzido por encrypt(). Lança erro se adulterado.
 */
export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de segredo inválido");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
