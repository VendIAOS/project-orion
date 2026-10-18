# Matriz funcional

## Implementado no codigo

| Area | Evidencia | Limite |
|---|---|---|
| Login e cadastro | Supabase Auth por senha, sessao e logout | token persiste em `localStorage` |
| Workspace | resolucao, criacao inicial, membros e convites | primeiro membership e selecionado; nao ha seletor multiworkspace |
| AI Studio | conversa, modos, prompt e OpenAI Responses API | sem streaming; fallback local e texto simulado |
| Projetos | listar, salvar, editar, arquivar, restaurar e derivar | fallback local pode divergir do Supabase |
| Agentes | fila, status, execucao, retry, locks, logs e ciclos | roda por Route Handlers, sem worker externo |
| Auditoria | ciclos, relatorio e eventos administrativos | depende de migrations/dados Supabase |
| Billing | overview, limites, checkout, portal e webhook | operacao real nao verificada sem Stripe configurado |
| Producao | checklist, deploy-check e smoke test de leitura | nao substitui monitoramento externo |
| Bibliotecas | filtros de projetos para video, imagem e avatar | armazenam artefatos textuais; nao geram midia binaria |
| Pipeline | draft, review, approved e exported | estado em metadata/localStorage; exportacao real nao implementada |

## Parcial ou incompleto

- Documentacao central original (`API`, `ARCHITECTURE`, `PRD`, `ROADMAP`) vazia.
- Sem CI versionada, cobertura, testes end-to-end ou testes de integracao Supabase/Stripe.
- Sem rate limiting distribuido para OpenAI, login, bootstrap ou filas.
- Sem renovacao automatica do refresh token observada no cliente.
- Sessoes em `localStorage`, ampliando impacto de qualquer XSS.
- O uso de service role exige auditoria continua de todos os filtros de workspace.
- Mensagens e conversas existem no schema, mas o AI Studio persiste principalmente no navegador e projetos/artefatos.
- O cabecalho usa titulo estatico `Dashboard` em todas as paginas.
- Os modulos de midia sao bibliotecas de texto, nao integracoes com geradores de video, imagem ou avatar.
- Nao foi encontrada exportacao binaria real, PDF, compartilhamento publico ou pipeline por canal completo.

## Planejado ou apenas documentado

- Deploy externo/Vercel e dominio de producao.
- Validacao de callbacks reais Supabase e webhook Stripe em producao.
- Relatorio dedicado de producao por canal e exportacao.
- Comparacao visual avancada de versoes e compartilhamento por link.

Esses itens nao devem ser apresentados como prontos ate que haja implementacao e evidencia operacional.

