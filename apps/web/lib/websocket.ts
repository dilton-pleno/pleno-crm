import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

type EventName =
  | "conversation:new"
  | "message:new"
  | "conversation:assigned"
  | "conversation:status_changed";

interface WsEvent {
  event: EventName;
  payload: Record<string, unknown>;
}

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: import("http").Server): void {
  if (wss) return;

  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: WebSocket, _req: IncomingMessage) => {
    socket.send(JSON.stringify({ event: "connected" }));

    socket.on("error", (err) => {
      console.error("[ws] Erro no cliente:", err);
    });
  });

  console.log("[ws] WebSocket server iniciado em /ws");
}

export function emitEvent(event: EventName, payload: Record<string, unknown>): void {
  if (!wss) return;

  const data = JSON.stringify({ event, payload } satisfies WsEvent);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
