type MediaType = "image" | "audio" | "document" | "sticker" | "video";

interface EvolutionResponse {
  key?: { id: string };
  error?: string;
}

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL não configurada");
  return url.replace(/\/$/, "");
}

function headers(): HeadersInit {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY não configurada");
  return { "Content-Type": "application/json", apikey: key };
}

export async function sendText(
  instanceName: string,
  to: string,
  text: string
): Promise<EvolutionResponse> {
  const res = await fetch(`${baseUrl()}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ number: to, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution sendText falhou [${res.status}]: ${body}`);
  }

  return res.json() as Promise<EvolutionResponse>;
}

export async function sendMedia(
  instanceName: string,
  to: string,
  url: string,
  caption: string,
  type: MediaType
): Promise<EvolutionResponse> {
  const res = await fetch(`${baseUrl()}/message/sendMedia/${instanceName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ number: to, mediatype: type, media: url, caption }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution sendMedia falhou [${res.status}]: ${body}`);
  }

  return res.json() as Promise<EvolutionResponse>;
}
