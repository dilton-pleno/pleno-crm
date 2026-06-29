import { lookup } from "dns/promises";
import net from "net";

// Proteção contra SSRF: garante que uma URL de webhook (configurada pelo Admin)
// não aponte para a rede interna/loopback/metadata. Resolve o host (anti
// DNS-rebinding) e rejeita IPs privados.

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + metadata (169.254.169.254)
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a >= 224) return true; // multicast/reservado
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const x = ip.toLowerCase();
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80");
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) {
    const mapped = ip.toLowerCase().match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
    return isPrivateIPv6(ip);
  }
  return false;
}

/** Lança erro se a URL não for um destino HTTP(S) público e seguro. */
export async function assertSafeWebhookUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL de webhook inválida");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Webhook: protocolo não permitido (use http/https)");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Webhook: destino interno bloqueado");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Webhook: IP interno bloqueado");
    return;
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error("Webhook: host não resolúvel");
  }
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error("Webhook: host resolve para IP interno (bloqueado)");
  }
}
