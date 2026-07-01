# Pleno CRM — Contexto para Codex

Projeto exclusivo para **Meu Cuidado Essencial**, desenvolvido pela **Pleno Digital**.
Este arquivo deve ser lido pelo agente antes de qualquer tarefa de desenvolvimento.

---

## Produto

Plataforma de operações comerciais que unifica atendimento omnichannel, inteligência de campanhas e automações em uma única interface. Substitui o uso direto do Chatwoot como interface principal, usando-o como gateway nos bastidores.

---

## Stack

```
Framework:    Next.js 15 (App Router)
Linguagem:    TypeScript estrito (sem any)
Estilos:      Tailwind CSS + shadcn/ui
Gráficos:     Recharts + Tremor
ORM:          Prisma
Auth:         NextAuth v5
Monorepo:     Turborepo
```

---

## Infraestrutura

```
VPS:          Hostinger KVM 4, Ubuntu 24.04, IP 2.25.134.78
Proxy:        Coolify + Traefik v3
Banco prod:   postgres-principal (PostgreSQL 16 + pgvector), banco pleno_crm
Redis prod:   redis-principal, DB 4 reservado para este projeto
Evolution:    https://evo.meucuidadoessencial.com.br
Chatwoot:     https://chatwoot.meucuidadoessencial.com.br (gateway)
N8N:          https://n8n.meucuidadoessencial.com.br
CRM URL:      https://crm.meucuidadoessencial.com.br
GitHub:       https://github.com/dilton-pleno/pleno-crm
```

---

## Ambientes

### Local (desenvolvimento)
- PostgreSQL via Docker em `localhost:5432`, banco `pleno_crm_dev`
- Redis via Docker em `localhost:6379`, DB 4
- Subir com: `docker compose up -d` na raiz do projeto
- `.env.local` com `DATABASE_URL` apontando para localhost
- URL local: `http://localhost:3000`

### Produção (VPS)
- Variáveis configuradas no painel do Coolify
- Migrations aplicadas automaticamente no deploy via `prisma migrate deploy`
- O agente NUNCA roda migrations diretamente no banco de produção

---

## Setup inicial do ambiente local

Executar na ordem ao clonar o projeto pela primeira vez:

```bash
# 1. Subir banco e redis locais
docker compose up -d

# 2. Instalar dependências
npm install

# 3. Copiar variáveis de ambiente
cp .env.example .env.local
# Preencher .env.local com os valores corretos

# 4. Criar tabelas no banco local
npx prisma migrate dev

# 5. Popular banco com dados iniciais
npx prisma db seed

# 6. Iniciar o servidor de desenvolvimento
npm run dev
```

---

## Documentação do projeto

```
docs/pleno-crm-prd.md              → PRD completo com visão geral e modelo de dados
docs/specs/module-00-setup.md      → Spec do Módulo 0: Setup e infraestrutura
docs/specs/module-01-atendimento.md → Spec do Módulo 1: Atendimento omnichannel
docs/specs/module-02-instagram-messenger.md → Spec do Módulo 2: Instagram e Messenger
docs/specs/module-03-kanban.md     → Spec do Módulo 3: Kanban
docs/specs/module-04-campanhas.md  → Spec do Módulo 4: CRM analítico
docs/specs/module-05-wbuy.md       → Spec do Módulo 5: Wbuy
docs/specs/module-06-automacoes.md → Spec do Módulo 6: Automações
```

Antes de iniciar qualquer módulo, ler a spec correspondente em `docs/specs/`.

---

## Estrutura de pastas

```
apps/
  web/
    app/
      (auth)/           → login, registro
      (dashboard)/      → rotas protegidas
        atendimento/    → inbox omnichannel
        kanban/         → board de atendimento
        campanhas/      → analytics de ads
        contatos/       → perfil unificado
        configuracoes/  → admin e gestor
    components/
      ui/               → shadcn/ui
      inbox/
      kanban/
      analytics/
    lib/
      prisma.ts         → cliente Prisma singleton
      auth.ts           → configuração NextAuth
      permissions.ts    → helpers de role
      evolution.ts      → cliente Evolution API
      meta.ts           → cliente Meta Graph API
      n8n.ts            → cliente N8N API
    prisma/
      schema.prisma
      seed.ts
packages/
  types/                → tipos TypeScript compartilhados
docker/
  init.sql              → inicialização do banco local
docker-compose.yml      → ambiente de desenvolvimento local
```

---

## Regras obrigatórias de desenvolvimento

1. **TypeScript estrito**: sem `any`, sem `@ts-ignore`
2. **Server Actions para mutações**: não usar fetch client-side para operações de escrita
3. **Validar permissões**: toda action e API route deve verificar a role do usuário antes de executar
4. **Contratos de API**: seguir exatamente os contratos definidos nas specs de cada módulo
5. **Nomenclatura de branches**: `feature/module-XX-nome-da-feature`
6. **Commits em português**: descritivos e no imperativo. Exemplo: `Adiciona modelo de Contact no schema Prisma`
7. **Migrations**: nunca rodar `prisma migrate dev` em produção, apenas `prisma migrate deploy`
8. **Variáveis de ambiente**: nunca hardcodar valores, sempre usar `process.env`
9. **Erros**: sempre tratar erros nas API routes e retornar o contrato de erro definido no PRD
10. **Seed**: o arquivo `prisma/seed.ts` deve criar um usuário Admin inicial com email e senha configuráveis via `.env.local`

---

## Roles e permissões

```
ADMIN     → acesso total, sem restrições
GESTOR    → visualiza tudo, ações de configuração exigem aprovação do Admin
ATENDENTE → acesso apenas a atendimento, kanban e contatos
```

Usar o helper `canAccess(role, module)` de `lib/permissions.ts` em toda verificação de permissão.

---

## Integrações disponíveis

| Serviço | Cliente | Variável de ambiente |
|---------|---------|---------------------|
| Evolution API | `lib/evolution.ts` | `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` |
| Meta Graph API | `lib/meta.ts` | `META_ACCESS_TOKEN` |
| N8N | `lib/n8n.ts` | `N8N_API_URL` + `N8N_API_KEY` |
| Chatwoot | API REST nativa | `CHATWOOT_API_TOKEN` |

---

## Padrão de resposta das APIs

```typescript
// Sucesso
{ data: T, meta?: { total: number, page: number, limit: number } }

// Erro
{ error: { code: string, message: string } }
```

---

## Referência visual

Inspiração: Reportana (https://reportana.com/pt)
Design é secundário na fase inicial. Prioridade é API bem estruturada e funcional.
