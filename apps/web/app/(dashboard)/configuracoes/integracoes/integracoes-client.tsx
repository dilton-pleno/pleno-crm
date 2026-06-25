"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, X, QrCode, MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";

interface WhatsAppStatus {
  status: "connected" | "disconnected";
  number: string | null;
  instanceName: string;
}

interface Props {
  currentUserId: string;
  canManage: boolean;
}

export function IntegracoesClient({ currentUserId, canManage }: Props) {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [working, setWorking] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [confirmingForce, setConfirmingForce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = status?.status === "connected";

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/integrations/whatsapp/status");
      const json = await res.json();
      if (res.ok) {
        setStatus(json.data as WhatsAppStatus);
      } else {
        setError(json.error?.message ?? "Falha ao consultar status");
      }
    } catch {
      setError("Falha ao consultar status");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Atendente: recebe o QR Code automaticamente após a aprovação do gestor.
  useWebSocket({
    "integration:qr_code": (payload) => {
      if (payload.targetUserId === currentUserId && typeof payload.qrcode === "string") {
        setQrcode(payload.qrcode);
        setShowModal(true);
        setRequestSent(false);
      }
    },
  });

  const handleReconnect = useCallback(async (force: boolean) => {
    setWorking(true);
    setError(null);
    try {
      const url = force
        ? "/api/v1/integrations/whatsapp/qrcode?force=true"
        : "/api/v1/integrations/whatsapp/qrcode";
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) {
        setQrcode(json.data.qrcode as string);
        setShowModal(true);
        setConfirmingForce(false);
      } else {
        setError(json.error?.message ?? "Falha ao gerar QR Code");
      }
    } finally {
      setWorking(false);
    }
  }, []);

  // Conectado: reconectar derruba a sessão atual, então pede confirmação.
  // Desconectado: gera o QR Code direto.
  const onReconnectClick = useCallback(() => {
    setError(null);
    if (connected) {
      setConfirmingForce(true);
    } else {
      void handleReconnect(false);
    }
  }, [connected, handleReconnect]);

  const handleRequestReconnect = useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/integrations/whatsapp/request-reconnect", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setRequestSent(true);
      } else {
        setError(json.error?.message ?? "Falha ao enviar solicitação");
      }
    } finally {
      setWorking(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setQrcode(null);
    void fetchStatus();
  }, [fetchStatus]);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-foreground">Integrações</h1>

      <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">WhatsApp</p>
            <p className="text-xs text-muted-foreground">
              Conexão da instância de atendimento via Evolution API
            </p>
          </div>
          <button
            onClick={() => void fetchStatus()}
            disabled={loadingStatus}
            className="p-2 text-muted-foreground hover:bg-accent rounded-md disabled:opacity-50"
            title="Atualizar status"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStatus ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-4">
          {loadingStatus ? (
            <span className="text-sm text-muted-foreground">Consultando status...</span>
          ) : connected ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">Conectado</span>
              {status?.number && (
                <span className="text-xs text-muted-foreground">· {status.number}</span>
              )}
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-600">Desconectado</span>
            </>
          )}
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {requestSent && (
          <div className="text-xs text-foreground bg-primary/5 border border-primary/30 rounded-md px-3 py-2">
            Solicitação enviada. Aguardando aprovação.
          </div>
        )}

        {confirmingForce && (
          <div className="text-xs bg-yellow-500/10 border border-yellow-500/40 rounded-md px-3 py-2.5 flex flex-col gap-2">
            <p className="text-foreground">
              A instância está conectada{status?.number ? ` (${status.number})` : ""}.
              Reconectar vai <span className="font-medium">desconectar a sessão atual</span> e
              gerar um novo QR Code. Deseja continuar?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleReconnect(true)}
                disabled={working}
                className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
              >
                {working ? "Gerando..." : "Desconectar e gerar QR"}
              </button>
              <button
                onClick={() => setConfirmingForce(false)}
                disabled={working}
                className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {canManage ? (
            <button
              onClick={onReconnectClick}
              disabled={working || confirmingForce}
              className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 disabled:opacity-50"
            >
              <QrCode className="w-3.5 h-3.5" />
              {working ? "Gerando..." : "Reconectar"}
            </button>
          ) : (
            <button
              onClick={() => void handleRequestReconnect()}
              disabled={working || requestSent}
              className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {working ? "Enviando..." : "Solicitar reconexão"}
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <QrCodeModal qrcode={qrcode} onClose={closeModal} />
      )}
    </div>
  );
}

function QrCodeModal({
  qrcode,
  onClose,
}: {
  qrcode: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xs bg-background border border-border rounded-lg shadow-xl p-5 flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-sm font-semibold text-foreground">Escanear QR Code</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {qrcode ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrcode}
            alt="QR Code do WhatsApp"
            className="w-56 h-56 object-contain rounded-md border border-border bg-white"
          />
        ) : (
          <div className="w-56 h-56 flex items-center justify-center text-sm text-muted-foreground">
            Gerando QR Code...
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Abra o WhatsApp no celular, vá em Aparelhos conectados e escaneie o
          código acima.
        </p>
      </div>
    </div>
  );
}
