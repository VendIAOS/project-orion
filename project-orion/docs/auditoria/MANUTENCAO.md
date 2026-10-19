# Instalacao, execucao e manutencao

## Requisitos

- Node.js compativel com Next.js 16.
- npm e acesso ao registry para instalacao.
- Supabase, OpenAI e Stripe sao opcionais para desenvolvimento parcial, mas obrigatorios para validar os fluxos reais correspondentes.

## Instalacao reproduzivel

```powershell
cd C:\projetos\project-orion\project-orion
Copy-Item .env.example .env.local
npm ci
```

Preencha apenas as variaveis necessarias. Nunca versione `.env.local`, service role, chave OpenAI ou segredos Stripe.

## Desenvolvimento

```powershell
npm run dev
```

Acesse `http://localhost:3000`. Sem OpenAI, o AI Studio usa resposta local. Sem Supabase, diversas telas usam fallback local; isso e comportamento de desenvolvimento e nao evidencia prontidao para producao.

## Validacao

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

O atalho `npm run check` executa lint, typecheck, testes e build.

## Banco

As migrations devem ser aplicadas em ordem cronologica. Antes de qualquer ambiente com dados:

1. gerar backup recuperavel;
2. revisar SQL e plano de rollback;
3. aplicar primeiro em staging;
4. validar dois usuarios em workspaces diferentes;
5. confirmar que inserts diretos em `workspace_members` sao negados;
6. somente entao promover a producao.

Esta auditoria nao executou `supabase db push`.

## Rotina de manutencao

- Semanal: Dependabot/Renovate, `npm audit` e revisao de advisories Next.js.
- Por PR: `npm run check`, revisao de autorizacao e verificacao de migrations.
- Por release: smoke test em staging, Stripe test mode, isolamento multiworkspace e rollback ensaiado.
- Trimestral: rotacao de segredos, revisao de acessos Supabase/Stripe/OpenAI e teste de restauracao de backup.

## Regras para novos endpoints

- Autenticar e autorizar no proprio handler.
- Derivar `workspaceId` da sessao, nunca do corpo sem validacao.
- Limitar tamanho de entrada, frequencia e custo.
- Nao devolver erros brutos de provedores ao cliente.
- Nunca importar segredos em Client Components.
- Adicionar teste de acesso anonimo, role insuficiente e isolamento entre workspaces.

