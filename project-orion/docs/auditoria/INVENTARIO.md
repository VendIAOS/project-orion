# Inventario tecnico verificado

## Resumo quantitativo

- 131 arquivos versionados na base original.
- 15 paginas de aplicacao e 26 Route Handlers.
- 10 migrations originais e 1 migration de endurecimento criada nesta auditoria.
- 14 tabelas PostgreSQL declaradas pelas migrations.
- Stack: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 e ESLint 9.

O repositorio possui um diretorio externo e o aplicativo fica em `project-orion/`. Com o checkout em `C:\projetos\project-orion`, a raiz efetiva do aplicativo e `C:\projetos\project-orion\project-orion`.

## Arvore principal

```text
project-orion/
├── app/                         paginas, layout, estilos e APIs Next.js
│   ├── api/                     26 Route Handlers
│   ├── audit/                   auditoria e relatorios de ciclos
│   ├── executions/              fila e detalhe de execucoes
│   ├── invite/                  aceite de convite
│   ├── projects/                biblioteca e detalhe de projetos
│   ├── ai-studio/               interface de orquestracao por IA
│   ├── avatars|images|videos/   visoes filtradas de artefatos textuais
│   └── billing|production|settings/
├── components/
│   ├── ai/                      conversa, prompts, acoes e clientes locais
│   ├── auth/                    login Supabase, sessao local e guardas
│   ├── billing/                 dashboard financeiro
│   ├── dashboard/               pagina inicial e indicadores
│   ├── layout/                  cabecalho, sidebar e layout autenticado
│   ├── production/              checklist e smoke test guiado
│   ├── projects/                projetos, artefatos, execucoes e auditoria
│   └── settings/                status, bootstrap, membros e auditoria admin
├── lib/                         contexto de auth, REST Supabase, Stripe e tipos
├── supabase/migrations/         schema PostgreSQL, RLS e evolucoes
├── tests/                       testes automatizados adicionados na auditoria
├── docs/                        documentacao historica e de auditoria
├── next.config.ts               headers de seguranca e configuracao Next.js
├── package.json                 scripts e dependencias
└── .env.example                 contrato de configuracao sem segredos
```

Arquivos vazios encontrados na base: `components/Card.tsx`, `components/dashboard/QuickActions.tsx`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/ROADMAP.md` e `docs/AGENTS.md`. Os componentes vazios nao eram importados; a documentacao vazia permanece registrada como divida, enquanto esta pasta fornece a referencia externa solicitada.

## Arquitetura

### Frontend

Aplicacao App Router com Server Components para paginas e Client Components para interacao. `MainLayout` envolve as telas operacionais com `AuthGuard`. Estado funcional possui dois caminhos:

1. Supabase, quando ambiente e sessao estao disponiveis.
2. `localStorage`, usado como fallback para projetos, historico do AI Studio, execucoes e estados de pipeline.

Esse fallback torna o prototipo utilizavel sem backend, mas nao oferece isolamento multiusuario, durabilidade, auditoria ou sincronizacao confiavel.

### Backend

Os Route Handlers em `app/api` funcionam como BFF. O servidor valida tokens com Supabase Auth, resolve o primeiro workspace do usuario e acessa tabelas pelo REST do Supabase usando `SUPABASE_SERVICE_ROLE_KEY`. Por usar service role, o backend contorna RLS; o isolamento depende das verificacoes de `workspaceId` em cada handler.

OpenAI e chamado pela Responses API. Stripe e chamado por REST e os webhooks possuem verificacao HMAC. Nao existe servidor separado, ORM, worker dedicado ou broker de filas; o processamento de agentes e implementado por rotas da propria aplicacao.

## Paginas

`/`, `/ai-studio`, `/projects`, `/projects/[projectId]`, `/executions`, `/executions/[runId]`, `/audit`, `/audit/[cycleId]`, `/audit/[cycleId]/report`, `/avatars`, `/images`, `/videos`, `/billing`, `/production`, `/settings`, `/login` e `/invite/[token]`.

## APIs

| Rota | Metodos | Responsabilidade verificada |
|---|---|---|
| `/api/ai/chat` | POST | OpenAI Responses API ou resposta local sem chave |
| `/api/auth/workspace` | GET | valida token e resolve/cria workspace |
| `/api/projects` | GET, POST, PATCH, DELETE | CRUD, arquivamento e restauracao de projetos |
| `/api/projects/stats` | GET | indicadores de projetos |
| `/api/agent-runs` | GET, POST, PATCH | execucoes de agentes |
| `/api/agent-runs/execute` | POST | executa uma transformacao com OpenAI |
| `/api/agent-runs/process` | POST | processa fila pendente |
| `/api/agent-runs/logs` | GET, POST | logs de execucao |
| `/api/agent-runs/locks` | POST | recupera locks expirados |
| `/api/agent-runs/health` | GET | saude e metricas da fila |
| `/api/agent-runs/cycles` | GET, POST | ciclos operacionais |
| `/api/workspace/members` | GET | membros do workspace |
| `/api/workspace/invites` | GET, POST, PATCH | cria, lista e revoga convites |
| `/api/workspace/invites/accept` | GET, POST | valida e aceita convite |
| `/api/billing/overview` | GET | plano, uso e limites |
| `/api/billing/events` | GET | timeline financeira |
| `/api/billing/checkout` | POST | sessao Stripe Checkout |
| `/api/billing/portal` | POST | sessao Stripe Customer Portal |
| `/api/billing/webhook` | POST | eventos Stripe assinados |
| `/api/admin-audit` | GET | eventos administrativos |
| `/api/system/health` | GET | presenca de configuracao |
| `/api/system/bootstrap` | POST | bootstrap inicial protegido por segredo em producao |
| `/api/production/deploy-check` | GET | prontidao de variaveis |
| `/api/production/smoke` | GET | leituras de verificacao operacional |

## Banco e migrations

Banco alvo: PostgreSQL fornecido pelo Supabase. Nao existe banco local, dump de dados ou arquivo SQLite no repositorio.

Tabelas declaradas: `workspaces`, `workspace_members`, `projects`, `conversations`, `messages`, `artifacts`, `agent_runs`, `agent_run_logs`, `agent_run_cycles`, `workspace_invites`, `workspace_billing`, `billing_webhook_events`, `billing_limit_events` e `admin_audit_events`.

RLS e habilitado nas migrations. A base original possuia uma policy insegura de insercao em `workspace_members`; a migration `20261018090000_harden_workspace_membership.sql` remove essa permissao direta. Aplicacao em qualquer Supabase real continua **nao verificada** e deve ocorrer apenas em ambiente controlado.

## Integracoes e configuracao

- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`; endpoint `/v1/responses`.
- Supabase: URL, anon key e service role; Auth REST e PostgREST.
- Stripe: secret key, webhook secret e price IDs Growth/Scale.
- Google Analytics: opcional por `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

O arquivo `.env.example` documenta nomes, mas nao contem valores reais. Nenhuma integracao foi considerada funcional apenas por existir no codigo.

