# PRD: Pleno CRM
**Versão:** 1.0  
**Cliente:** Meu Cuidado Essencial  
**Responsável:** Pleno Digital  
**Data:** Junho 2026

---

## 1. Visão geral do produto

O Pleno CRM é uma plataforma de operações comerciais desenvolvida exclusivamente para o cliente Meu Cuidado Essencial. O objetivo é unificar atendimento omnichannel, inteligência de campanhas e automações em uma única interface, eliminando a necessidade de alternar entre múltiplas ferramentas.

A aplicação é construída sobre a infraestrutura existente do cliente, aproveitando o Chatwoot como gateway de mensagens, o N8N como middleware de automações e a Evolution API como conector WhatsApp.

---

## 2. Contexto técnico e infraestrutura existente

### 2.1 Infraestrutura disponível

```
VPS:           Hostinger KVM 4, Ubuntu 24.04, IP 2.25.134.78
Proxy:         Coolify + Traefik v3 com SSL automático
Email:         Mailcow (Postfix + Dovecot + Rspamd)
Automações:    N8N v2.10.2
WhatsApp:      Evolution API v2.3.7
Atendimento:   Chatwoot v4.14.2 (gateway, não interface principal)
Banco:         PostgreSQL 16 com pgvector (postgres-principal)
Cache:         Redis 7.2
```

### 2.2 Subdomínios configurados

```
crm.meucuidadoessencial.com.br     → aplicação principal (Pleno CRM)
chatwoot.meucuidadoessencial.com.br → gateway de mensagens
n8n.meucuidadoessencial.com.br     → automações
evo.meucuidadoessencial.com.br     → Evolution API
mail.meucuidadoessencial.com.br    → Mailcow
```

### 2.3 Banco de dados compartilhado

```
Host:     postgres-principal (container Docker)
Usuário:  admin
Bancos:   principal, n8n, evolution, chatwoot, pleno_crm (novo)
```

---

## 3. Stack tecnológica

### 3.1 Frontend e mobile

```
Framework:    Next.js 15 (App Router)
Linguagem:    TypeScript
Estilos:      Tailwind CSS
Componentes:  shadcn/ui
Gráficos:     Recharts + Tremor
Monorepo:     Turborepo (compartilhar lógica com React Native futuramente)
```

### 3.2 Backend

```
API:          Next.js API Routes + Server Actions
Jobs:         N8N (sincronização de métricas, processamento de webhooks)
Realtime:     WebSocket via Next.js (novas mensagens e notificações)
```

### 3.3 Persistência

```
ORM:          Prisma
Banco:        PostgreSQL 16 (pgvector disponível para busca semântica futura)
Cache:        Redis (DB 4 reservado para Pleno CRM)
```

### 3.4 Autenticação

```
Biblioteca:   NextAuth v5
Providers:    Credenciais próprias + Google OAuth (necessário para GA4 e Google Ads)
```

### 3.5 Deploy

```
CI/CD:        GitHub + Coolify (auto-deploy via push na branch main)
Subdomínio:   crm.meucuidadoessencial.com.br
```

---

## 4. Modelo de dados central

O contato é o centro do modelo de dados. Toda conversa, mensagem e interação pertence a um contato. Um contato pode ter múltiplas identidades em múltiplos canais.

```
Contact
  id, name, email, phone, created_at, updated_at, organization_id

ContactChannel
  id, contact_id, channel_type (whatsapp|instagram|messenger|email|site), 
  channel_identifier, metadata, created_at

Conversation
  id, contact_id, channel_id, status (open|resolved|pending), 
  assigned_to (user_id), inbox_id, created_at, updated_at

Message
  id, conversation_id, direction (in|out), content, media_url, 
  media_type, sent_at, delivered_at, read_at, sender_id

User
  id, name, email, password_hash, role (admin|gestor|atendente), 
  created_at, active

Pipeline
  id, name, created_by, created_at

PipelineStage
  id, pipeline_id, name, position, color

PipelineCard
  id, stage_id, conversation_id, contact_id, assigned_to, 
  created_at, updated_at

CampaignMetric
  id, platform (meta|google), account_id, campaign_id, campaign_name,
  date, impressions, clicks, spend, reach, cpm, ctr, roas, 
  conversions, created_at

Alert
  id, name, platform, metric, operator, threshold, 
  active, created_by, created_at

Order
  id, contact_id, external_id, platform (wbuy), status, 
  total, created_at, synced_at
```

---

## 5. Sistema de roles e permissões

### 5.1 Definição das roles

**Admin**
Acesso total sem restrições. Gerencia usuários, configurações, automações e todos os módulos.

**Gestor**
Visualiza todos os módulos. Ações que alteram configurações globais (criar automações, editar pipelines, configurar alertas) exigem aprovação de um Admin antes de serem aplicadas.

**Atendente**
Acesso exclusivo aos módulos de atendimento: inbox, conversas, perfil de contato e kanban de atendimento. Não visualiza módulos analíticos ou de configuração.

### 5.2 Matriz de permissões por módulo

| Módulo | Admin | Gestor | Atendente |
|--------|-------|--------|-----------|
| Inbox e conversas | Total | Total | Total |
| Perfil de contato | Total | Total | Leitura |
| Kanban | Total | Total | Total |
| Campanhas analíticas | Total | Leitura | Sem acesso |
| Alertas | Total | Solicitar | Sem acesso |
| Automações | Total | Solicitar | Sem acesso |
| Usuários e configurações | Total | Sem acesso | Sem acesso |

---

## 6. Integrações externas

### 6.1 WhatsApp via Evolution API

Tipo de conexão: QR Code (Baileys) para uso imediato. Meta Cloud API oficial planejada para fase posterior.

Webhook: Evolution API envia eventos para o N8N, que processa e encaminha para o endpoint do Pleno CRM.

### 6.2 Instagram e Messenger via Meta Graph API

Permissões necessárias no Meta App:
- `instagram_basic`
- `instagram_manage_messages`
- `instagram_manage_comments`
- `pages_messaging`
- `pages_read_engagement`

Eventos recebidos via webhook: mensagens diretas, comentários em posts, respostas a stories.

### 6.3 Meta Ads API

Autenticação: token de longa duração gerado via Meta Business Manager.

Métricas sincronizadas: impressions, reach, clicks, spend, cpm, ctr, roas, conversions, frequency.

Frequência de sincronização: job N8N diário às 06h00.

### 6.4 Google Ads API

Autenticação: OAuth2 via Google Cloud Console com escopos de leitura.

Métricas sincronizadas: impressions, clicks, cost, ctr, average_cpc, conversions, conversion_value.

Frequência de sincronização: job N8N diário às 06h30.

### 6.5 Google Analytics 4

Autenticação: mesma conta OAuth do Google Ads.

Dados sincronizados: sessions, users, pageviews, bounce_rate, conversions por source/medium.

### 6.6 Google Merchant Center

Dados sincronizados: produtos aprovados, reprovados, pendentes e performance de shopping.

### 6.7 Wbuy API

Dados sincronizados: pedidos por cliente, status, valor total, produtos comprados.

Vinculação: por número de telefone ou email do contato.

---

## 7. Arquitetura de mensagens em tempo real

```
WhatsApp → Evolution API → Webhook N8N → POST /api/webhooks/whatsapp → Pleno CRM DB
Instagram → Meta Webhook → N8N → POST /api/webhooks/instagram → Pleno CRM DB
Messenger → Meta Webhook → N8N → POST /api/webhooks/messenger → Pleno CRM DB

Pleno CRM → Evolution API → WhatsApp (envio de mensagem)
Pleno CRM → Meta Graph API → Instagram Direct / Comentário (envio)
```

---

## 8. Módulos do produto

### Módulo 0: Setup e infraestrutura
**Spec:** `specs/module-00-setup.md`

### Módulo 1: Atendimento omnichannel
**Spec:** `specs/module-01-atendimento.md`

### Módulo 2: Instagram e Messenger
**Spec:** `specs/module-02-instagram-messenger.md`

### Módulo 3: Kanban de atendimento
**Spec:** `specs/module-03-kanban.md`

### Módulo 4: CRM analítico de campanhas
**Spec:** `specs/module-04-campanhas.md`

### Módulo 5: Integração Wbuy
**Spec:** `specs/module-05-wbuy.md`

### Módulo 6: Automações
**Spec:** `specs/module-06-automacoes.md`

---

## 9. Referência visual

Inspiração: Reportana (https://reportana.com/pt)

Prioridade: a API e estrutura de dados têm prioridade sobre o design na fase inicial. O design será refinado após a API estar estruturada.

---

## 10. Convenções de desenvolvimento

### 10.1 Estrutura de pastas

```
apps/
  web/                    → Next.js (Pleno CRM)
    app/
      (auth)/             → rotas de autenticação
      (dashboard)/        → rotas protegidas
        atendimento/
        kanban/
        campanhas/
        contatos/
        configuracoes/
    components/
      ui/                 → shadcn/ui
      inbox/
      kanban/
      analytics/
    lib/
      prisma.ts
      auth.ts
      evolution.ts        → cliente Evolution API
      meta.ts             → cliente Meta Graph API
    prisma/
      schema.prisma
    api/
      webhooks/
        whatsapp/
        instagram/
        messenger/
packages/
  types/                  → tipos compartilhados TypeScript
  utils/                  → utilitários compartilhados
```

### 10.2 Variáveis de ambiente obrigatórias

```env
DATABASE_URL=postgresql://admin:SENHA@postgres-principal:5432/pleno_crm
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://crm.meucuidadoessencial.com.br
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EVOLUTION_API_URL=https://evo.meucuidadoessencial.com.br
EVOLUTION_API_KEY=
CHATWOOT_URL=https://chatwoot.meucuidadoessencial.com.br
CHATWOOT_API_TOKEN=
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
N8N_WEBHOOK_SECRET=
```

### 10.3 Padrões de API

Todas as rotas de API seguem o padrão REST com prefixo `/api/v1/`.

Respostas de sucesso: `{ data: {}, meta: {} }`

Respostas de erro: `{ error: { code: string, message: string } }`

Autenticação via Bearer token em rotas de webhook, sessão NextAuth nas rotas internas.

---

## 11. Critérios de aceitação por módulo

Cada módulo só é considerado concluído quando:
1. Todas as tasks da spec estão implementadas.
2. Os endpoints da API retornam os contratos definidos.
3. O fluxo completo de ponta a ponta foi testado manualmente.
4. As permissões por role foram validadas.

---

## 12. O que não está no escopo desta versão

- Multi-tenancy (planejado para versão SaaS futura)
- App mobile React Native (planejado para fase posterior)
- Integração com TikTok Ads
- Chat ao vivo no site (widget)
- Módulo financeiro ou de faturamento
