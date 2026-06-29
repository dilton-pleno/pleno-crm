// Rate limiter simples em memória (janela fixa), sem dependências externas.
// Suficiente para mitigar força bruta de login num deploy single-instance.
// Observação: o estado é por processo e zera em redeploy; para múltiplas
// instâncias, migrar para Redis (REDIS_URL já existe no ambiente).

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

function sweep(now: number): void {
  if (store.size < 5000) return;
  for (const [k, e] of store) if (now > e.resetAt) store.delete(k);
}

/**
 * Registra uma tentativa para `key` e diz se está dentro do limite.
 * @returns allowed=false quando excedeu `max` tentativas na janela.
 */
export function hitRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  sweep(now);
  const e = store.get(key);
  if (!e || now > e.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (e.count >= max) {
    return { allowed: false, retryAfterMs: e.resetAt - now };
  }
  e.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Limpa o contador (ex.: após login bem-sucedido). */
export function clearRateLimit(key: string): void {
  store.delete(key);
}
