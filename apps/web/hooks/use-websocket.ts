"use client";

import { useEffect, useRef, useCallback } from "react";

type EventName =
  | "conversation:new"
  | "message:new"
  | "conversation:assigned"
  | "conversation:status_changed"
  | "card:moved"
  | "integration:reconnect_requested"
  | "integration:qr_code"
  | "connected";

type EventHandler = (payload: Record<string, unknown>) => void;

export function useWebSocket(handlers: Partial<Record<EventName, EventHandler>>) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as {
          event: EventName;
          payload: Record<string, unknown>;
        };
        const handler = handlersRef.current[parsed.event];
        handler?.(parsed.payload ?? {});
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
}
