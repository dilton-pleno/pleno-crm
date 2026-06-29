import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";
import { connectInstance } from "@/lib/evolution";
import { getWhatsappConfig, mergeWhatsappConfig } from "@/lib/whatsapp-config";

const RECONNECT_THROTTLE_MS = 2 * 60 * 1000; // tenta reconectar no máx. 1x/2min
const ALERT_THROTTLE_MS = 10 * 60 * 1000; // avisa no sino no máx. 1x/10min
const LOGGED_OUT = 401; // DisconnectReason.loggedOut → precisa reescanear QR

/**
 * Reage ao evento connection.update da Evolution. Em "close", tenta reconectar
 * automaticamente (sessão ainda válida volta sozinha); se precisar de novo QR
 * (logout), cria um alerta no sino para o Admin reconectar. Tudo com throttle
 * para não martelar a Evolution nem poluir as notificações.
 */
export async function handleConnectionUpdate(
  instanceName: string,
  state: string | undefined,
  reason: number | undefined
): Promise<void> {
  if (!state) return;

  const cfg = await getWhatsappConfig();
  const prev = (cfg.connection as { state?: string } | undefined)?.state;
  if (state !== prev) {
    await mergeWhatsappConfig({ connection: { state, at: new Date().toISOString() } });
  }

  if (state !== "close") return;

  const now = Date.now();
  const lastReconnectAt = Number(cfg.lastReconnectAt ?? 0);
  if (now - lastReconnectAt < RECONNECT_THROTTLE_MS) return;
  await mergeWhatsappConfig({ lastReconnectAt: now });

  // Logout exige novo QR; nos demais casos, tenta reconectar a sessão atual.
  let needsQr = reason === LOGGED_OUT;
  if (!needsQr) {
    try {
      const result = await connectInstance(instanceName);
      needsQr = result.kind === "qr";
    } catch (err) {
      console.error("[whatsapp-connection] Falha ao reconectar:", err);
      needsQr = true;
    }
  }

  if (!needsQr) return;

  const lastAlertAt = Number(cfg.lastAlertAt ?? 0);
  if (now - lastAlertAt < ALERT_THROTTLE_MS) return;
  await mergeWhatsappConfig({ lastAlertAt: now });

  const message = "WhatsApp desconectado — reconecte e escaneie o QR Code";
  const notification = await prisma.alertNotification.create({
    data: { message, link: "/configuracoes/integracoes" },
  });
  emitEvent("alert:triggered", { notificationId: notification.id, message });
}
