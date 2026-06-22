# Spec: Módulo 5, Integração Wbuy

**Depende de:** Módulo 1 concluído  
**Agente responsável:** agente de integração e-commerce

---

## Objetivo

Sincronizar pedidos da Wbuy com o Pleno CRM e vinculá-los ao perfil unificado de contato, permitindo que agentes vejam o histórico de compras do cliente durante o atendimento.

---

## Pré-requisitos externos

- Credenciais da Wbuy API da Meu Cuidado Essencial
- Documentação da Wbuy API (a ser fornecida pelo cliente)

---

## Tasks

### 5.1 Cliente Wbuy API

- Criar `lib/wbuy.ts` com métodos:
  - `getOrders(page, filters)` para listar pedidos
  - `getOrderById(orderId)` para detalhe do pedido
  - `getCustomerByPhone(phone)` para buscar cliente por telefone
  - `getCustomerByEmail(email)` para buscar cliente por email
- Implementar autenticação conforme documentação da Wbuy API
- Implementar retry com backoff exponencial para erros de rate limit

### 5.2 Job de sincronização no N8N

Criar workflow no N8N com schedule a cada 6 horas:
- Chamar `GET /orders` da Wbuy API com filtro de data
- Para cada pedido, chamar `POST /api/internal/sync/wbuy-orders`
- Tratar paginação para sincronizar todos os pedidos do período

### 5.3 Endpoint de sincronização

- Criar `POST /api/internal/sync/wbuy-orders` protegido por secret
- Para cada pedido recebido:
  - Buscar contato pelo telefone ou email do cliente
  - Criar `Order` vinculando ao `Contact` encontrado
  - Se não encontrar contato, criar um novo com os dados do pedido
  - Fazer upsert usando `external_id` da Wbuy como chave

### 5.4 Exibição no perfil do contato

- No painel de detalhes do contato (coluna direita da inbox), adicionar seção "Histórico de pedidos"
- Exibir lista dos últimos 5 pedidos com:
  - Número do pedido
  - Data
  - Status (aguardando, aprovado, enviado, entregue, cancelado)
  - Valor total
  - Botão "Ver detalhes" que expande os produtos do pedido
- Criar endpoint `GET /api/v1/contacts/:id/orders` para buscar pedidos do contato

### 5.5 Cruzamento de dados com campanhas

- Criar endpoint `GET /api/v1/analytics/revenue` com faturamento por período
- Exibir no dashboard de campanhas uma seção com:
  - Faturamento total do período (via Wbuy)
  - Comparação com investimento em ads (Meta + Google)
  - ROI calculado: `(faturamento - investimento) / investimento * 100`

---

## Contratos de API

### GET /api/v1/contacts/:id/orders
```json
Response 200:
{
  "data": [
    {
      "id": "string",
      "external_id": "string",
      "status": "string",
      "total": 299.90,
      "created_at": "ISO8601",
      "items": [
        {
          "name": "string",
          "quantity": 2,
          "unit_price": 149.95
        }
      ]
    }
  ]
}
```

---

## Critérios de aceitação

- Pedidos sincronizados aparecem no perfil do contato correto
- Vinculação por telefone e email funciona corretamente
- Agente vê histórico de pedidos na tela de atendimento sem sair da conversa
- Faturamento aparece no dashboard de campanhas com ROI calculado
- Novos pedidos aparecem em até 6 horas após criação na Wbuy
