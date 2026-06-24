import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

type EventName =
  | "conversation:new"
  | "message:new"
  | "conversation:assigned"
  | "conversation:status_changed"
  | "card:moved";

interface WsEvent {
  event: EventName;
  payload: Record<string, unknown>;
}

// O server.ts (executado pelo tsx) e os route handlers do Next (que sao
// empacotados pelo Next em um bundle proprio) importam este modulo como
// instancias SEPARADAS, embora rodem no mesmo processo Node. Sem compartilhar
// estado, o `wss` inicializado no server.ts fica null no contexto das rotas, e
// o emitEvent do webhook nao envia nada. Guardamos o WebSocketServer em
// globalThis (mesmo padrao do singleton do Prisma) para que ambos os contextos
// usem a mesma instancia.
const globalForWs = globalThis as unknown as {
  __wss?: WebSocketServer | null;
};

export function initWebSocketServer(server: import("http").Server): void {
  if (globalForWs.__wss) return;

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: WebSocket, _req: IncomingMessage) => {
    socket.send(JSON.stringify({ event: "connected" }));

    socket.on("error", (err) => {
      console.error("[ws] Erro no cliente:", err);
    });
  });

  globalForWs.__wss = wss;
  console.log("[ws] WebSocket server iniciado em /ws");
}

export function emitEvent(event: EventName, payload: Record<string, unknown>): void {
  const wss = globalForWs.__wss;
  if (!wss) {
    console.warn(
      `[ws] emitEvent("${event}") ignorado: WebSocketServer nao inicializado neste contexto`
    );
    return;
  }

  const data = JSON.stringify({ event, payload } satisfies WsEvent);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
