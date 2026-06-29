// Regras e geração de senha — ISOMÓRFICO (usa Web Crypto via globalThis.crypto,
// disponível no browser e no Node 20+). Pode ser importado por client e server.

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I/O ambíguos
const LOWER = "abcdefghijkmnopqrstuvwxyz"; // sem l
const DIGITS = "23456789"; // sem 0/1
const SYMBOLS = "!@#$%&*?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

export const PASSWORD_MIN_LENGTH = 8;

function randInt(maxExclusive: number): number {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % maxExclusive;
}

function pick(set: string): string {
  return set[randInt(set.length)]!;
}

/**
 * Gera uma senha forte que SEMPRE atende às regras (maiúscula + minúscula +
 * número + símbolo) com o tamanho informado.
 */
export function generatePassword(length = 14): string {
  const size = Math.max(PASSWORD_MIN_LENGTH, length);
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < size) chars.push(pick(ALL));
  // Fisher-Yates.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

export interface PasswordCheck {
  key: string;
  label: string;
  ok: boolean;
}

/** Avalia a senha contra as regras (checklist na UI e validação no server). */
export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { key: "len", label: `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`, ok: pw.length >= PASSWORD_MIN_LENGTH },
    { key: "upper", label: "Letra maiúscula", ok: /[A-Z]/.test(pw) },
    { key: "lower", label: "Letra minúscula", ok: /[a-z]/.test(pw) },
    { key: "number", label: "Número", ok: /[0-9]/.test(pw) },
    { key: "symbol", label: "Símbolo (!@#$…)", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export function isPasswordValid(pw: string): boolean {
  return passwordChecks(pw).every((c) => c.ok);
}
