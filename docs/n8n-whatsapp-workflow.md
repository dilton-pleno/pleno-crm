# N8N: Workflow de entrada WhatsApp

## Objetivo

Receber eventos da Evolution API e encaminhá-los para o Pleno CRM com autenticação.

---

## Pré-requisitos

- N8N rodando em `https://n8n.meucuidadoessencial.com.br`
- Evolution API configurada com webhook apontando para o N8N
- `INTERNAL_API_SECRET` definido nas variáveis de ambiente do Pleno CRM

---

## Configuração da Evolution API

No painel da Evolution API, configurar o webhook da instância `atendimento`:

```
URL: https://n8n.meucuidadoessencial.com.br/webhook/whatsapp-entrada
Eventos: messages.upsert, messages.update, connection.update
```

---

## Nodes do Workflow N8N

### 1. Webhook Trigger
- **Tipo**: Webhook
- **Path**: `whatsapp-entrada`
- **Método**: POST
- **Authentication**: None (autenticação feita no Pleno CRM via secret)

### 2. Normalize Payload (Code node)
```javascript
// Normaliza o payload da Evolution API para o formato esperado pelo CRM
const body = $input.first().json;

return [{
  json: {
    event: body.event,
    instance: body.instance,
    data: body.data,
  }
}];
```

### 3. HTTP Request → Pleno CRM
- **Método**: POST
- **URL**: `https://crm.meucuidadoessencial.com.br/api/webhooks/whatsapp`
- **Headers**:
  - `Content-Type: application/json`
  - `x-webhook-secret: {{ $env.INTERNAL_API_SECRET }}`
- **Body**: `{{ $json }}`
- **Timeout**: 10000ms

### 4. Error Handler (If node)
- Checar se `$response.statusCode` é diferente de 200
- Em caso de erro: Node de espera (Wait) + retry (loop de até 3 tentativas)

---

## Configuração da variável de ambiente no N8N

Adicionar em Settings > n8n > Environment Variables:
```
INTERNAL_API_SECRET=<mesmo valor do .env do CRM>
```

---

## Eventos processados pelo CRM

| Evento | Ação |
|--------|------|
| `messages.upsert` | Cria ou atualiza Contact, ContactChannel, Conversation e Message |
| `messages.update` | Atualiza status de entrega/leitura da Message |
| `connection.update` | Log apenas, sem ação no banco |

---

## Validação

Após configurar, testar enviando uma mensagem WhatsApp para o número configurado na instância `atendimento`. A mensagem deve aparecer na inbox do CRM em menos de 3 segundos.
