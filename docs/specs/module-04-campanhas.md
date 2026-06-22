# Spec: Módulo 4, CRM analítico de campanhas

**Depende de:** Módulo 0 concluído  
**Acesso:** Admin (total), Gestor (leitura), Atendente (sem acesso)  
**Agente responsável:** agente de analytics e integrações de ads

---

## Objetivo

Criar o painel analítico que consolida métricas de Meta Ads, Google Ads, Google Analytics 4 e Google Merchant Center em uma única interface, com sistema de alertas configuráveis para métricas críticas.

---

## Pré-requisitos externos

Antes de iniciar o desenvolvimento:

1. Meta Business Manager com acesso à conta de anúncios da Meu Cuidado Essencial
2. Token de acesso de longa duração para Meta Ads API
3. Google Cloud Console com app OAuth criado
4. Google Ads Developer Token aprovado
5. Google Analytics 4 property configurada
6. Google Merchant Center vinculado ao Google Ads

---

## Tasks

### 4.1 Jobs de sincronização no N8N

Criar os seguintes workflows no N8N, cada um com schedule diário:

**Job Meta Ads (06h00)**
- Chamar Meta Ads API para buscar métricas de campanhas do dia anterior
- Endpoint: `GET /act_{ad_account_id}/campaigns?fields=name,insights{impressions,reach,clicks,spend,cpm,ctr,actions,action_values}`
- Salvar no banco via `POST /api/internal/sync/meta-ads` com secret de autenticação

**Job Google Ads (06h30)**
- Chamar Google Ads API com GAQL query para métricas do dia anterior
- Salvar no banco via `POST /api/internal/sync/google-ads`

**Job Google Analytics 4 (07h00)**
- Chamar GA4 Data API para métricas de sessões e conversões
- Salvar no banco via `POST /api/internal/sync/ga4`

**Job Google Merchant Center (07h30)**
- Chamar Content API para status de produtos
- Salvar no banco via `POST /api/internal/sync/merchant`

### 4.2 Endpoints de sincronização

Criar endpoints internos protegidos por secret (não por sessão de usuário):

- `POST /api/internal/sync/meta-ads`
- `POST /api/internal/sync/google-ads`
- `POST /api/internal/sync/ga4`
- `POST /api/internal/sync/merchant`

Cada endpoint deve fazer upsert no banco usando a combinação `platform + campaign_id + date` como chave única para evitar duplicação.

### 4.3 Clientes de API de anúncios

- Criar `lib/meta-ads.ts` com método `getCampaignInsights(accountId, dateRange)`
- Criar `lib/google-ads.ts` com método `getCampaignMetrics(customerId, dateRange)`
- Criar `lib/ga4.ts` com método `getSessionMetrics(propertyId, dateRange)`
- Criar `lib/merchant.ts` com método `getProductStatus(merchantId)`

Esses clientes são usados pelos jobs do N8N via endpoints internos.

### 4.4 API analítica para a UI

- Criar endpoint `GET /api/v1/analytics/overview` com métricas consolidadas
- Criar endpoint `GET /api/v1/analytics/campaigns` com lista de campanhas e métricas
- Criar endpoint `GET /api/v1/analytics/campaigns/:id` com histórico diário da campanha
- Criar endpoint `GET /api/v1/analytics/google` com métricas do Google Ads
- Criar endpoint `GET /api/v1/analytics/ga4` com sessões e conversões
- Suportar filtro por período: `?start=YYYY-MM-DD&end=YYYY-MM-DD`
- Suportar comparação com período anterior: `?compare=true`

### 4.5 Dashboard analítico

- Criar página `app/(dashboard)/campanhas/page.tsx`
- Layout inspirado no Reportana com cards de métricas no topo e gráficos abaixo
- Seletor de período com opções: Hoje, Ontem, Últimos 7 dias, Últimos 30 dias, Personalizado
- Toggle de comparação com período anterior

**Cards de métricas (topo)**
- Investimento total (Meta + Google)
- Alcance total
- Cliques totais
- CPM médio
- CTR médio
- ROAS consolidado
- Cada card exibe variação percentual em relação ao período anterior

**Gráficos (Recharts)**
- Gráfico de linha: investimento diário por plataforma (Meta vs Google)
- Gráfico de barras: cliques por campanha (top 10)
- Gráfico de pizza: distribuição de investimento por plataforma
- Gráfico de linha: sessões GA4 por dia

**Tabela de campanhas**
- Colunas: nome, plataforma, status, investimento, alcance, cliques, CTR, ROAS
- Ordenação por coluna
- Paginação com 20 campanhas por página
- Expandir campanha para ver histórico diário

### 4.6 Sistema de alertas

- Criar modelo `Alert` no schema Prisma:
  - id, name, platform, metric, operator (`gt | lt | eq`), threshold, active, notified_at, created_by
- Criar página `app/(dashboard)/campanhas/alertas/page.tsx`
- Permitir criar alerta com:
  - Nome descritivo
  - Plataforma (Meta, Google, ambos)
  - Métrica (CPM, CTR, ROAS, Investimento, etc.)
  - Operador (maior que, menor que)
  - Valor de threshold
- Criar job N8N diário que:
  - Busca alertas ativos via `GET /api/v1/alerts`
  - Compara métricas do dia com os thresholds
  - Chama `POST /api/internal/alerts/trigger` quando threshold é atingido
- Quando alerta é disparado:
  - Criar notificação na UI (badge no sino do header)
  - Opcional: enviar mensagem via Evolution API para número configurado
- Criar endpoint `GET /api/v1/alerts/notifications` para listar notificações não lidas
- Criar endpoint `PATCH /api/v1/alerts/notifications/:id/read` para marcar como lida

**Exemplos de alertas úteis:**
- CPM acima de R$ 50
- CTR abaixo de 1%
- ROAS abaixo de 2
- Campanha com investimento zerado
- Alcance diário abaixo de 1000

---

## Contratos de API

### GET /api/v1/analytics/overview
```json
Query: ?start=2026-06-01&end=2026-06-22&compare=true

Response 200:
{
  "data": {
    "period": {
      "start": "2026-06-01",
      "end": "2026-06-22"
    },
    "metrics": {
      "total_spend": 15000.00,
      "total_reach": 250000,
      "total_clicks": 8500,
      "avg_cpm": 60.00,
      "avg_ctr": 3.4,
      "avg_roas": 4.2
    },
    "comparison": {
      "spend_change_pct": 12.5,
      "reach_change_pct": -5.2,
      "clicks_change_pct": 8.1
    },
    "by_platform": {
      "meta": { "spend": 10000, "reach": 180000 },
      "google": { "spend": 5000, "reach": 70000 }
    }
  }
}
```

### POST /api/internal/sync/meta-ads
```json
Header: x-internal-secret: string

Request:
{
  "date": "2026-06-21",
  "campaigns": [
    {
      "id": "string",
      "name": "string",
      "status": "ACTIVE",
      "impressions": 10000,
      "reach": 8000,
      "clicks": 350,
      "spend": 500.00,
      "cpm": 50.00,
      "ctr": 3.5,
      "roas": 4.2,
      "conversions": 28
    }
  ]
}

Response 200:
{
  "data": { "synced": 5, "upserted": 5 }
}
```

---

## Critérios de aceitação

- Jobs N8N sincronizam métricas diariamente sem erros
- Dashboard carrega métricas do banco em menos de 2 segundos
- Comparação com período anterior calcula variação percentual corretamente
- Alerta disparado aparece como notificação no header em menos de 1 minuto após o job
- Gestor visualiza o dashboard mas não consegue criar ou editar alertas sem aprovação do Admin
- Gráficos renderizam corretamente com dados de 30 dias
- Tabela de campanhas ordena por ROAS e exibe histórico ao expandir
