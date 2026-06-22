# Spec: Módulo 0, Setup e infraestrutura do projeto

**Dependências:** nenhuma  
**Pré-requisito para:** todos os outros módulos  
**Agente responsável:** agente de infraestrutura e configuração

---

## Objetivo

Criar a base do projeto Pleno CRM com estrutura de pastas, autenticação, banco de dados e deploy automático funcionando antes de qualquer funcionalidade de negócio.

---

## Tasks

### 0.1 Repositório e monorepo

- Criar repositório no GitHub: `dilton-pleno/pleno-crm`
- Inicializar Turborepo com os workspaces `apps/web` e `packages/types`
- Configurar `.gitignore` excluindo `.env*`, `node_modules`, `.next`
- Criar branch `main` como branch de produção e `develop` como branch de desenvolvimento

### 0.2 Aplicação Next.js

- Inicializar Next.js 15 com App Router e TypeScript no workspace `apps/web`
- Instalar e configurar Tailwind CSS
- Instalar e inicializar shadcn/ui com tema neutro
- Configurar alias de imports `@/` apontando para `apps/web/src/`
- Criar arquivo `apps/web/.env.example` com todas as variáveis listadas no PRD seção 10.2

### 0.3 Banco de dados e Prisma

- Criar banco `pleno_crm` no `postgres-principal`
- Instalar Prisma no workspace `apps/web`
- Criar `prisma/schema.prisma` com todos os modelos definidos no PRD seção 4
- Executar `prisma migrate dev` para criar as tabelas
- Criar cliente Prisma singleton em `lib/prisma.ts`
- Validar conexão com o banco via script de teste

### 0.4 Autenticação com NextAuth v5

- Instalar NextAuth v5
- Configurar provider de credenciais (email e senha) com bcrypt
- Configurar provider Google OAuth para uso futuro com GA4 e Google Ads
- Criar middleware de proteção de rotas em `middleware.ts`
- Criar layout de autenticação em `app/(auth)/layout.tsx`
- Criar página de login em `app/(auth)/login/page.tsx`
- Implementar lógica de redirect após login baseada na role do usuário
- Criar seed de usuário admin inicial via `prisma/seed.ts`

### 0.5 Estrutura de roles e permissões

- Criar enum de roles no schema Prisma: `ADMIN`, `GESTOR`, `ATENDENTE`
- Criar helper `lib/permissions.ts` com funções:
  - `canAccess(role, module)` retorna boolean
  - `requireRole(role)` middleware de server action
- Criar componente `<PermissionGate role="admin">` para proteger elementos na UI
- Implementar redirecionamento automático quando usuário tenta acessar rota sem permissão

### 0.6 Layout base da aplicação

- Criar layout principal do dashboard em `app/(dashboard)/layout.tsx`
- Criar sidebar com navegação pelos módulos, respeitando permissões por role
- Criar header com nome do usuário, role e botão de logout
- Criar página inicial do dashboard com redirecionamento para inbox

### 0.7 Deploy no Coolify

- Conectar repositório GitHub ao Coolify
- Criar serviço Next.js no Coolify apontando para `apps/web`
- Configurar variáveis de ambiente no Coolify
- Configurar domínio `crm.meucuidadoessencial.com.br`
- Validar auto-deploy via push na branch `main`
- Adicionar rede `coolify` no container para acesso ao postgres-principal e redis

---

## Contratos de API

### POST /api/auth/login
```json
Request:
{
  "email": "string",
  "password": "string"
}

Response 200:
{
  "data": {
    "user": {
      "id": "string",
      "name": "string",
      "email": "string",
      "role": "ADMIN | GESTOR | ATENDENTE"
    }
  }
}

Response 401:
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email ou senha inválidos"
  }
}
```

---

## Critérios de aceitação

- Login com credenciais válidas redireciona para o dashboard correto por role
- Login com credenciais inválidas exibe mensagem de erro
- Acesso a rota protegida sem sessão redireciona para login
- Atendente acessando rota de campanhas é redirecionado
- Push na branch `main` dispara deploy automático no Coolify
- Dashboard carrega em `crm.meucuidadoessencial.com.br` com SSL
