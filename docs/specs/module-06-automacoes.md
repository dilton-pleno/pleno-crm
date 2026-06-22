# Spec: Módulo 6, Automações

**Depende de:** Módulos 1 e 2 concluídos  
**Acesso:** Admin (total), Gestor (solicitar), Atendente (sem acesso)  
**Agente responsável:** agente de automações e N8N

---

## Objetivo

Criar interface visual de builder de automações no Pleno CRM que permite ao Admin criar fluxos de atendimento automático integrados ao N8N, sem necessidade de acessar o N8N diretamente.

---

## Tasks

### 6.1 Modelo de dados de automações

Criar modelos no schema Prisma:

```
Automation
  id, name, active, trigger_type, trigger_config (JSON), created_by, created_at

AutomationAction
  id, automation_id, position, action_type, action_config (JSON)
```

Tipos de trigger:
- `new_message`: nova mensagem recebida
- `keyword`: mensagem contém palavra-chave específica
- `new_contact`: novo contato criado
- `conversation_opened`: conversa aberta
- `schedule`: horário específico (cron)

Tipos de ação:
- `send_message`: enviar mensagem automática
- `assign_agent`: atribuir a agente específico
- `add_tag`: adicionar etiqueta ao contato
- `move_kanban`: mover card de estágio no Kanban
- `webhook`: chamar URL externa
- `wait`: aguardar X minutos antes da próxima ação

### 6.2 API de automações

- Criar `GET /api/v1/automations` para listar automações
- Criar `POST /api/v1/automations` para criar automação
- Criar `PATCH /api/v1/automations/:id` para editar (Admin) ou solicitar edição (Gestor)
- Criar `PATCH /api/v1/automations/:id/toggle` para ativar ou desativar
- Criar `DELETE /api/v1/automations/:id` para remover (Admin)

Quando uma automação é criada ou editada pelo Admin, o Pleno CRM deve:
1. Salvar no banco local
2. Criar ou atualizar o workflow correspondente no N8N via API do N8N
3. Retornar confirmação de ambos

### 6.3 Cliente N8N API

- Criar `lib/n8n.ts` com métodos:
  - `createWorkflow(automation)` para criar workflow no N8N a partir de uma automação
  - `updateWorkflow(workflowId, automation)` para atualizar
  - `activateWorkflow(workflowId)` para ativar
  - `deactivateWorkflow(workflowId)` para desativar
  - `deleteWorkflow(workflowId)` para remover

### 6.4 Execução das automações

Criar endpoint `POST /api/internal/automations/trigger` chamado pelo N8N quando uma automação é disparada.

O endpoint deve:
1. Receber o evento e identificar qual automação foi disparada
2. Executar as ações em sequência respeitando `position`
3. Para ação `send_message`: chamar Evolution API ou Meta Graph API conforme o canal
4. Para ação `assign_agent`: chamar endpoint de atribuição
5. Para ação `move_kanban`: mover card no pipeline
6. Para ação `wait`: o N8N já gerencia o delay, o endpoint é chamado novamente após o tempo

### 6.5 Interface do builder

- Criar página `app/(dashboard)/configuracoes/automacoes/page.tsx`
- Lista de automações com status ativo/inativo, nome e tipo de trigger
- Botão para criar nova automação que abre formulário em painel lateral
- Formulário em etapas:

**Etapa 1: Trigger**
- Selecionar tipo de trigger
- Configurar parâmetros (exemplo: para keyword, qual palavra-chave)
- Selecionar canal de entrada (WhatsApp, Instagram, Messenger, todos)

**Etapa 2: Ações**
- Lista de ações com drag and drop para reordenar
- Botão "Adicionar ação" com dropdown dos tipos disponíveis
- Para cada ação, formulário específico de configuração

**Etapa 3: Revisão**
- Resumo legível da automação
- Opção de ativar imediatamente ao salvar

### 6.6 Biblioteca de templates

- Criar seção "Templates" com automações pré-configuradas prontas para usar
- Templates iniciais:
  - Boas-vindas: responde automaticamente na primeira mensagem do contato
  - Fora do horário: responde fora do horário comercial com mensagem de ausência
  - Triagem por keyword: direciona para agente específico baseado em palavra-chave
  - Follow-up: envia mensagem após 24h sem resposta do contato

---

## Contratos de API

### POST /api/v1/automations
```json
Request:
{
  "name": "Boas-vindas WhatsApp",
  "trigger_type": "new_contact",
  "trigger_config": {
    "channel": "whatsapp"
  },
  "actions": [
    {
      "position": 1,
      "action_type": "send_message",
      "action_config": {
        "message": "Olá! Seja bem-vindo à Meu Cuidado Essencial. Como posso ajudar?"
      }
    },
    {
      "position": 2,
      "action_type": "add_tag",
      "action_config": {
        "tag": "novo-contato"
      }
    }
  ]
}

Response 201:
{
  "data": {
    "id": "string",
    "name": "string",
    "active": false,
    "n8n_workflow_id": "string",
    "created_at": "ISO8601"
  }
}
```

---

## Critérios de aceitação

- Automação criada pelo Admin é replicada automaticamente no N8N
- Trigger de nova mensagem com keyword dispara a automação corretamente
- Ação de envio de mensagem automática funciona no WhatsApp
- Ação de atribuição muda o agente responsável na conversa
- Admin pode ativar e desativar automações pelo toggle
- Gestor ao tentar criar automação recebe mensagem de que precisa de aprovação
- Templates aparecem na biblioteca e podem ser aplicados com um clique
