"use client";

import { useState } from "react";
import { Copy, Check, MapPin } from "lucide-react";

interface Address {
  local?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface Props {
  document: string | null;
  document2: string | null;
  birthDate: string | null;
  gender: string | null;
  secondaryPhone: string | null;
  city: string | null;
  uf: string | null;
  addresses: Address[];
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard indisponível */
        }
      }}
      className="p-0.5 text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-foreground flex items-center gap-1.5 truncate">
        <span className="truncate">{value}</span>
        {copy && <CopyButton value={value} />}
      </span>
    </div>
  );
}

const GENDER_LABELS: Record<string, string> = { M: "Masculino", F: "Feminino" };

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatAddress(a: Address): string {
  const line1 = [a.endereco, a.numero].filter(Boolean).join(", ");
  const parts = [
    line1,
    a.complemento,
    a.bairro,
    [a.cidade, a.uf].filter(Boolean).join("/"),
    a.cep ? `CEP ${a.cep}` : null,
  ].filter((p) => p && String(p).trim());
  return parts.join(" · ");
}

export function ContactWbuyData({
  document,
  document2,
  birthDate,
  gender,
  secondaryPhone,
  city,
  uf,
  addresses,
}: Props) {
  const birth = formatDate(birthDate);
  const location = city ? `${city}${uf ? `/${uf}` : ""}` : null;
  const hasFields = document || document2 || birth || gender || secondaryPhone || location;
  const validAddresses = addresses.filter((a) => formatAddress(a).trim());

  if (!hasFields && validAddresses.length === 0) return null;

  return (
    <>
      {hasFields && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Dados do cliente (Wbuy)</h2>
          <div className="flex flex-col gap-2">
            {document && <Row label="CPF/CNPJ" value={document} copy />}
            {document2 && <Row label="RG/IE" value={document2} />}
            {secondaryPhone && <Row label="Telefone 2" value={secondaryPhone} copy />}
            {birth && <Row label="Nascimento" value={birth} />}
            {gender && <Row label="Gênero" value={GENDER_LABELS[gender] ?? gender} />}
            {location && <Row label="Cidade/UF" value={location} />}
          </div>
        </div>
      )}

      {validAddresses.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Endereços ({validAddresses.length})
          </h2>
          <div className="flex flex-col gap-3">
            {validAddresses.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  {a.local && <p className="text-xs font-medium text-foreground">{a.local}</p>}
                  <p className="text-xs text-muted-foreground">{formatAddress(a)}</p>
                </div>
                <div className="ml-auto">
                  <CopyButton value={formatAddress(a)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
