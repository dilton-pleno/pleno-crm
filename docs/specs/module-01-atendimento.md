# Spec: Módulo 1, Atendimento omnichannel

**Depende de:** Módulo 0 concluído  
**Pré-requisito para:** Módulo 2 (Instagram e Messenger)  
**Agente responsável:** agente de atendimento e mensageria

---

## Objetivo

Criar a inbox unificada do Pleno CRM onde agentes recebem e respondem mensagens de WhatsApp em tempo real, com perfil unificado de contato vinculando todos os canais do mesmo cliente.

---

## Contexto de integração

O fluxo de mensagens funciona da seguinte forma:

```
WhatsApp → Evolution API → Webhook N8N → POST /api/webhooks/whatsapp → Salva no DB → WebSocket → UI

UI → POST /api/messages/send → Evolution API → WhatsApp
```

O N8N já está instalado em `n8n.meucuidadoessencial.com.br`. O webhook do N8N deve chamar o endpoint do Pleno CRM com um secret de autenticação.

---

## Tasks

### 1.1 Modelo de dados de atendimento

Confirmar que os seguintes modelos estão criados no schema Prisma (definidos no Módulo 0):
- `Contact` com campos: id, name, email, phone, avatar_url, notes, created_at
- `ContactChannel` com campos: id, contact_id, channel_type, channel_identifier, metadata
- `Conversation` com campos: id, contact_id, channel_id, status, assigned_to, inbox_name, created_at, updated_at
- `Message` com campos: id, conversation_id, direction, content, media_url, media_type, sent_at, delivered_at, read_at, sender_id, external_id

Criar migration e validar no banco `pleno_crm`.

### 1.2 Webhook de entrada do WhatsApp

- Criar endpoint `POST /api/webhooks/whatsapp` com validação do header `x-webhook-secret`
- Processar payload da Evolution API com os seguintes eventos:
  - `messages.upsert`: nova mensagem recebida
  - `messages.update`: atualização de status (entregue, lido)
  - `connection.update`: status da conexão WhatsApp
- Para cada mensagem recebida:
  - Buscar ou criar `Contact` pelo número de telefone
  - Buscar ou criar `ContactChannel` para o canal WhatsApp
  - Buscar ou criar `Conversation` aberta para esse contato
  - Criar `Message` com direction `in`
  - Emitir evento WebSocket para atualizar a UI em tempo real
- Retornar `200 OK` imediatamente para evitar timeout do N8N

### 1.3 Configuração do N8N

Criar workflow no N8N com:
- Trigger: Webhook recebendo eventos da Evolution API
- Node de transformação normalizando o payload
- Node HTTP Request chamando `POST /api/webhooks/whatsapp` com o secret
- Node de tratamento de erros com retry em caso de falha

### 1.4 Envio de mensagens

- Criar endpoint `POST /api/v1/messages` para envio
- Validar que o usuário tem permissão para a conversa
- Chamar Evolution API para enviar a mensagem
- Salvar `Message` com direction `out` no banco
- Suportar tipos: texto, imagem, áudio, documento, sticker
- Criar cliente `lib/evolution.ts` com métodos:
  - `sendText(instanceName, to, text)`
  - `sendMedia(instanceName, to, url, caption, type)`

### 1.5 Interface da inbox

- Criar página `app/(dashboard)/atendimento/page.tsx`
- Layout em três colunas:
  - Coluna 1 (280px): lista de conversas com filtros
  - Coluna 2 (flex): linha do tempo de mensagens da conversa selecionada
  - Coluna 3 (320px): painel de detalhes do contato
- Lista de conversas:
  - Exibir avatar, nome do contato, prévia da última mensagem, horário e canal
  - Badge com contador de mensagens não lidas
  - Filtros: Minhas, Não atribuídas, Todas
  - Busca por nome ou número de contato
- Linha do tempo de mensagens:
  - Agrupar mensagens por data
  - Exibir horário, status de entrega e leitura para mensagens enviadas
  - Suporte a renderização de imagens, áudios e documentos
  - Campo de resposta na parte inferior com botão de envio e upload de mídia
  - Indicador de digitação
- Painel de detalhes do contato:
  - Nome, telefone, email, canais vinculados
  - Histórico de pedidos Wbuy (placeholder para Módulo 5)
  - Campo de anotações internas sobre o contato
  - Botão para vincular outro canal ao mesmo contato

### 1.6 Atribuição de conversas

- Criar endpoint `PATCH /api/v1/conversations/:id/assign`
- Permitir que admin e gestor atribuam conversa a qualquer agente
- Permitir que atendente assuma conversa não atribuída
- Exibir nome do agente responsável na lista de conversas
- Notificar o agente via WebSocket quando uma conversa é atribuída a ele

### 1.7 Status de conversa

- Implementar transições de status: `open`, `pending`, `resolved`
- Criar endpoint `PATCH /api/v1/conversations/:id/status`
- Exibir filtros por status na lista de conversas
- Reabrir conversa automaticamente quando nova mensagem chega em conversa resolvida

### 1.8 Perfil unificado de contato

- Criar página `app/(dashboard)/contatos/[id]/page.tsx`
- Exibir todos os canais vinculados ao contato
- Exibir linha do tempo unificada de todas as conversas em todos os canais
- Criar endpoint `POST /api/v1/contacts/:id/channels` para vincular novo canal
- Criar fluxo de sugestão automática de vinculação quando mesmo telefone aparece em canais diferentes

### 1.9 WebSocket para tempo real

- Configurar WebSocket no Next.js usando a biblioteca `ws` ou `socket.io`
- Emitir eventos:
  - `conversation:new`: nova conversa criada
  - `message:new`: nova mensagem em conversa existente
  - `conversation:assigned`: conversa atribuída a agente
  - `conversation:status_changed`: status da conversa alterado
- Conectar WebSocket na UI e atualizar estado sem reload

---

## Contratos de API

### POST /api/webhooks/whatsapp
```json
Header: x-webhook-secret: string

Request (exemplo de mensagem recebida):
{
  "event": "messages.upsert",
  "instance": "atendimento",
  "data": {
    "key": {
      "remoteJid": "5522999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "MESSAGE_ID"
    },
    "message": {
      "conversation": "Olá, preciso de ajuda"
    },
    "messageTimestamp": 1718000000
  }
}

Response: 200 OK
```

### GET /api/v1/conversations
```json
Query params: status, assigned_to, page, limit

Response 200:
{
  "data": [
    {
      "id": "string",
      "contact": {
        "id": "string",
        "name": "string",
        "avatar_url": "string"
      },
      "last_message": {
        "content": "string",
        "direction": "in | out",
        "sent_at": "ISO8601"
      },
      "unread_count": 0,
      "status": "open | pending | resolved",
      "channel_type": "whatsapp | instagram | messenger",
      "assigned_to": {
        "id": "string",
        "name": "string"
      }
    }
  ],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20
  }
}
```

### GET /api/v1/conversations/:id/messages
```json
Response 200:
{
  "data": [
    {
      "id": "string",
      "direction": "in | out",
      "content": "string",
      "media_url": "string | null",
      "media_type": "image | audio | document | null",
      "sent_at": "ISO8601",
      "delivered_at": "ISO8601 | null",
      "read_at": "ISO8601 | null",
      "sender": {
        "id": "string",
        "name": "string",
        "type": "contact | agent"
      }
    }
  ]
}
```

### POST /api/v1/messages
```json
Request:
{
  "conversation_id": "string",
  "content": "string",
  "media_url": "string | null",
  "media_type": "image | audio | document | null"
}

Response 201:
{
  "data": {
    "id": "string",
    "direction": "out",
    "content": "string",
    "sent_at": "ISO8601"
  }
}
```

---

## Critérios de aceitação

- Mensagem enviada pelo WhatsApp aparece na inbox em menos de 3 segundos
- Agente responde pela interface e a mensagem chega no WhatsApp do contato
- Filtros de inbox funcionam corretamente: Minhas, Não atribuídas, Todas
- Atribuição de conversa notifica o agente em tempo real
- Resolução de conversa move ela para o filtro de resolvidas
- Nova mensagem em conversa resolvida a reabre automaticamente
- Dois canais diferentes do mesmo contato aparecem vinculados no perfil
- Imagens e áudios são renderizados corretamente na linha do tempo
