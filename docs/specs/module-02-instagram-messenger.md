# Spec: Módulo 2, Instagram e Messenger

**Depende de:** Módulo 1 concluído  
**Agente responsável:** agente de integração Meta

---

## Objetivo

Integrar Instagram Direct, comentários em posts e Messenger ao Pleno CRM, permitindo que agentes respondam todos esses canais pela mesma interface de atendimento, com histórico unificado no perfil do contato.

---

## Pré-requisitos externos

Antes de iniciar o desenvolvimento, os seguintes itens devem estar configurados:

1. App criado no Meta Developers com permissões listadas abaixo
2. Conta Instagram Business da Meu Cuidado Essencial vinculada ao Meta Business Manager
3. Token de acesso de longa duração gerado e armazenado nas variáveis de ambiente

Permissões necessárias no Meta App:
- `instagram_basic`
- `instagram_manage_messages`
- `instagram_manage_comments`
- `pages_messaging`
- `pages_read_engagement`
- `pages_show_list`

---

## Tasks

### 2.1 Configuração do Meta App e webhook

- Criar endpoint `GET /api/webhooks/meta` para verificação do webhook pelo Meta (challenge)
- Criar endpoint `POST /api/webhooks/meta` para receber eventos
- Registrar o webhook no Meta App Dashboard apontando para `https://crm.meucuidadoessencial.com.br/api/webhooks/meta`
- Configurar assinatura dos campos: `messages`, `messaging_postbacks`, `comments`, `mentions`
- Criar cliente `lib/meta.ts` com métodos para Graph API

### 2.2 Instagram Direct

- Processar evento `messages` do webhook para Instagram Direct
- Para cada mensagem recebida:
  - Buscar ou criar `Contact` pelo Instagram user ID
  - Criar ou atualizar `ContactChannel` com `channel_type: instagram`
  - Criar `Conversation` e `Message` seguindo o mesmo padrão do WhatsApp
  - Emitir evento WebSocket para atualizar a UI
- Criar método em `lib/meta.ts`:
  - `sendInstagramDirect(recipientId, text)` para responder via Graph API
- Exibir Direct do Instagram na inbox junto com WhatsApp
- Identificar o canal com ícone do Instagram na lista de conversas

### 2.3 Messenger (Facebook)

- Processar evento `messages` do webhook para Messenger
- Seguir o mesmo fluxo do Instagram Direct
- Criar método `sendMessengerMessage(recipientId, text)` em `lib/meta.ts`
- Exibir Messenger na inbox com ícone do Facebook Messenger

### 2.4 Módulo de comentários em posts

- Processar evento `comments` do webhook
- Criar modelo `PostComment` no schema Prisma:
  - id, post_id, post_caption, post_media_url, comment_id, author_name, author_id, content, created_at, replied_at, reply_content
- Criar página `app/(dashboard)/atendimento/comentarios/page.tsx`
- Layout inspirado no ManyChat:
  - Lista de posts recentes com thumbnail, legenda e contador de comentários
  - Ao clicar em um post, exibir lista de comentários com autor e conteúdo
  - Campo de resposta inline para cada comentário
  - Badge indicando comentários sem resposta
- Criar endpoint `POST /api/v1/comments/:id/reply` para responder via Graph API
- Criar método `replyToComment(commentId, message)` em `lib/meta.ts`
- Opção de converter comentário em Direct para continuação da conversa

### 2.5 Vinculação de canais ao contato unificado

- Quando uma mensagem chega do Instagram ou Messenger, verificar se existe contato com mesmo nome ou histórico no WhatsApp
- Exibir sugestão de vinculação na interface: "Este usuário do Instagram pode ser o mesmo contato que +55 22 99999-9999 no WhatsApp. Deseja vincular?"
- Criar endpoint `POST /api/v1/contacts/:id/channels` para confirmar a vinculação
- Após vinculação, exibir histórico de todos os canais na linha do tempo unificada do contato

### 2.6 Respostas a Stories

- Processar evento de resposta a Story (é tratado como mensagem direta pela Meta API)
- Identificar mensagens com `story_reply` nos metadados
- Exibir no contexto da conversa que a mensagem é uma resposta a um Story
- Mostrar thumbnail do Story quando disponível pela API

---

## Contratos de API

### GET /api/webhooks/meta
```
Query params: hub.mode, hub.verify_token, hub.challenge
Response: hub.challenge (string) quando verificação válida
```

### POST /api/webhooks/meta
```json
Header: x-hub-signature-256: sha256=HASH

Request (exemplo de Direct do Instagram):
{
  "object": "instagram",
  "entry": [{
    "id": "PAGE_ID",
    "time": 1718000000,
    "messaging": [{
      "sender": { "id": "USER_ID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1718000000,
      "message": {
        "mid": "MESSAGE_ID",
        "text": "Olá, quero informações sobre o produto"
      }
    }]
  }]
}

Response: 200 OK
```

### GET /api/v1/posts
```json
Response 200:
{
  "data": [
    {
      "id": "string",
      "media_url": "string",
      "caption": "string",
      "timestamp": "ISO8601",
      "comment_count": 0,
      "unanswered_comments": 0
    }
  ]
}
```

### GET /api/v1/posts/:id/comments
```json
Response 200:
{
  "data": [
    {
      "id": "string",
      "author_name": "string",
      "author_id": "string",
      "content": "string",
      "created_at": "ISO8601",
      "replied": false,
      "reply_content": "string | null"
    }
  ]
}
```

### POST /api/v1/comments/:id/reply
```json
Request:
{
  "message": "string"
}

Response 201:
{
  "data": {
    "comment_id": "string",
    "reply": "string",
    "replied_at": "ISO8601"
  }
}
```

---

## Critérios de aceitação

- Mensagem recebida no Instagram Direct aparece na inbox em menos de 5 segundos
- Agente responde pelo Pleno CRM e a mensagem chega no Direct do Instagram
- Mensagem do Messenger aparece na inbox com ícone identificador correto
- Módulo de comentários exibe posts recentes com contadores corretos
- Resposta a comentário é enviada e registrada com horário
- Vinculação de canais unifica o histórico na linha do tempo do contato
- Stories respondidos aparecem com contexto indicando que é resposta a Story
