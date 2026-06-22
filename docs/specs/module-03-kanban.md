# Spec: Módulo 3, Kanban de atendimento

**Depende de:** Módulo 1 concluído  
**Agente responsável:** agente de frontend e board interativo

---

## Objetivo

Criar um board Kanban visual para gestão do funil de atendimento, onde cada card representa uma conversa e pode ser movido entre estágios com drag and drop.

---

## Tasks

### 3.1 Modelo de dados do Kanban

Confirmar que os modelos estão no schema Prisma:

- `Pipeline`: id, name, created_by, created_at
- `PipelineStage`: id, pipeline_id, name, position, color
- `PipelineCard`: id, stage_id, conversation_id, contact_id, assigned_to, created_at, updated_at

Criar seed com pipeline padrão e estágios iniciais:
1. Novo (azul)
2. Em atendimento (amarelo)
3. Aguardando cliente (laranja)
4. Resolvido (verde)

### 3.2 API do Kanban

- Criar endpoint `GET /api/v1/pipelines/:id/board` retornando todos os estágios com seus cards
- Criar endpoint `PATCH /api/v1/cards/:id/move` para mover card entre estágios
- Criar endpoint `POST /api/v1/pipelines/:id/stages` para criar novo estágio (admin)
- Criar endpoint `PATCH /api/v1/stages/:id` para editar estágio (admin)
- Criar endpoint `DELETE /api/v1/stages/:id` para remover estágio (admin)
- Criar card automaticamente quando nova conversa é criada, colocando no estágio "Novo"
- Mover card para "Resolvido" quando status da conversa mudar para `resolved`

### 3.3 Interface do board

- Criar página `app/(dashboard)/kanban/page.tsx`
- Implementar drag and drop com a biblioteca `@dnd-kit/core`
- Exibir colunas lado a lado com scroll horizontal em telas menores
- Cada coluna exibe: nome do estágio, cor, contador de cards
- Cada card exibe:
  - Avatar e nome do contato
  - Canal de origem com ícone (WhatsApp, Instagram, Messenger)
  - Prévia da última mensagem
  - Tempo desde a última interação
  - Avatar do agente responsável
- Ao clicar no card, abrir painel lateral com a conversa completa
- Atualizar board em tempo real via WebSocket quando card é movido por outro agente

### 3.4 Filtros e métricas do board

- Filtrar cards por agente responsável
- Filtrar cards por canal de origem
- Filtrar cards por período de criação
- Exibir no rodapé de cada coluna:
  - Total de cards na coluna
  - Tempo médio de permanência na coluna

### 3.5 Configuração de pipeline (admin)

- Criar página `app/(dashboard)/configuracoes/pipeline/page.tsx` acessível apenas para Admin
- Permitir criar, renomear, reordenar e remover estágios
- Permitir escolher cor do estágio com color picker
- Exibir aviso ao tentar remover estágio com cards ativos

---

## Contratos de API

### GET /api/v1/pipelines/:id/board
```json
Response 200:
{
  "data": {
    "pipeline": {
      "id": "string",
      "name": "string"
    },
    "stages": [
      {
        "id": "string",
        "name": "string",
        "color": "#hexcolor",
        "position": 0,
        "cards": [
          {
            "id": "string",
            "conversation_id": "string",
            "contact": {
              "id": "string",
              "name": "string",
              "avatar_url": "string"
            },
            "channel_type": "whatsapp | instagram | messenger",
            "last_message_preview": "string",
            "last_activity_at": "ISO8601",
            "assigned_to": {
              "id": "string",
              "name": "string",
              "avatar_url": "string"
            }
          }
        ]
      }
    ]
  }
}
```

### PATCH /api/v1/cards/:id/move
```json
Request:
{
  "stage_id": "string",
  "position": 0
}

Response 200:
{
  "data": {
    "card_id": "string",
    "stage_id": "string",
    "moved_at": "ISO8601"
  }
}
```

---

## Critérios de aceitação

- Drag and drop move o card para o novo estágio e persiste no banco
- Outro agente vê o card movido em tempo real sem reload
- Nova conversa cria automaticamente um card no estágio "Novo"
- Conversa resolvida move o card para "Resolvido"
- Filtros por agente e canal funcionam corretamente
- Admin consegue criar e reordenar estágios
- Board carrega em menos de 2 segundos com 100 cards
