# Changelog

## Build 0.3.0 - AI Studio local

- Implementado chat funcional no AI Studio.
- Adicionadas mensagens de usuario e assistente com layout dedicado.
- Adicionada resposta simulada com fluxo inicial do VendIAOS.
- Adicionado historico local persistido no navegador via `localStorage`.
- Adicionado estado de carregamento durante a resposta simulada.
- Adicionadas sugestoes de prompts para iniciar conversas.
- Validado com `npm run lint` e `npm run build`.

## Proximo passo

- Criar rota server-side para integrar OpenAI sem expor chaves no cliente.

## Build 0.4.0 - Rota server-side OpenAI

- Criada rota `POST /api/ai/chat` para centralizar chamadas de IA no servidor.
- Frontend do AI Studio passou a chamar a rota interna em vez de simular tudo no cliente.
- Chave `OPENAI_API_KEY` fica restrita ao ambiente server-side.
- Adicionado fallback local quando a chave ainda nao estiver configurada.
- Modelo configuravel via `OPENAI_MODEL`, com padrao `gpt-5`.

## Proximo passo

- Configurar `OPENAI_API_KEY` no ambiente local e no deploy.

## Build 0.5.0 - Orquestrador de marketing

- VendIAOS passou a escolher modo operacional automaticamente: campanha, video, imagem, avatar, analise ou funil.
- Prompt server-side atualizado para responder como orquestrador, nao como chat generico.
- Respostas agora seguem contrato com modo escolhido, objetivo interpretado, plano operacional, artefato inicial e proxima acao.
- Sugestoes do AI Studio atualizadas para cobrir os principais modos de trabalho.
- Fallback local alinhado ao mesmo formato operacional.

## Proximo passo

- Persistir modo, artefato e historico no Supabase.

## Build 0.6.0 - Acoes contextuais do AI Studio

- Adicionados botoes de acao nas respostas do assistente.
- Usuario agora pode copiar, salvar localmente, criar variacoes, transformar em campanha, gerar roteiro de video ou criar prompt de imagem.
- Projetos salvos ficam persistidos temporariamente no `localStorage`.
- Acoes contextuais reenviam o artefato para o orquestrador com instrucao operacional.

## Proximo passo

- Criar area de projetos salvos e persistir no Supabase.

## Build 0.7.0 - Projetos salvos locais

- Criada area de projetos salvos no AI Studio.
- Respostas salvas agora aparecem em uma lista reutilizavel.
- Usuario pode abrir um projeto salvo como contexto atual.
- Usuario pode remover projetos salvos.
- Lista atualiza imediatamente apos salvar uma resposta.

## Proximo passo

- Conectar projetos salvos ao Supabase com workspace e usuario.

## Build 0.8.0 - Biblioteca de projetos

- Criada rota `/projects` para visualizar artefatos salvos.
- Adicionado link Projetos na Sidebar.
- Biblioteca permite buscar por texto ou modo operacional.
- Usuario pode copiar, remover ou abrir um artefato salvo no AI Studio.
- Projetos continuam locais via `localStorage` ate a integracao com Supabase.

## Proximo passo

- Criar schema Supabase para projetos, conversas e artefatos.

## Build 0.9.0 - Schema Supabase

- Criada migration inicial Supabase para workspaces, membros, projetos, conversas, mensagens e artefatos.
- Adicionados enums `project_mode` e `artifact_type`.
- Adicionados indices, triggers de `updated_at` e Row Level Security.
- Criados tipos TypeScript de dominio em `lib/vendiaos-types.ts`.
- Documentadas variaveis Supabase e instrucoes de aplicacao do schema.

## Proximo passo

- Instalar cliente Supabase e criar camada server/client para persistir projetos reais.


## Build 0.10.0 - Health check de integracoes

- Criada rota `GET /api/system/health`.
- Adicionada camada `lib/supabase-config.ts` para validar variaveis Supabase server-side.
- Configuracoes agora exibem status de OpenAI, Supabase publico e Supabase server-side.
- Health check retorna apenas status booleano, sem expor chaves.

## Proximo passo

- Conectar `Salvar projeto` a uma rota server-side com Supabase quando as credenciais estiverem configuradas.

## Build 0.11.0 - Persistencia server-side de projetos

- Criada rota `GET /api/projects` para listar artefatos persistidos no Supabase quando a configuracao estiver pronta.
- Criada rota `POST /api/projects` para salvar projetos e artefatos pelo servidor.
- Adicionada camada REST server-side para Supabase sem expor `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Botao `Salvar` do AI Studio agora tenta persistir no servidor e usa `localStorage` como fallback automatico.
- Adicionadas variaveis `VENDIAOS_DEFAULT_WORKSPACE_ID` e `VENDIAOS_DEFAULT_USER_ID` para bootstrap local antes da autenticacao completa.

## Proximo passo

- Criar onboarding/autenticacao para substituir os IDs locais por workspace e usuario reais.

## Build 0.12.0 - Biblioteca sincronizada

- Criado helper client-side para carregar projetos do servidor e do navegador.
- AI Studio agora sincroniza projetos recentes via `/api/projects`.
- Biblioteca `/projects` agora indica se os dados vieram do Supabase ou do armazenamento local.
- Projetos locais e de servidor sao mesclados e ordenados por data.
- Fallback local continua ativo enquanto Supabase nao estiver configurado.

## Proximo passo

- Configurar Supabase no painel, aplicar migration e criar workspace/usuario inicial para ativar persistencia real.

## Build 0.13.0 - Remocao sincronizada de projetos

- Criado `DELETE /api/projects?id=...` para remover artefatos salvos pelo servidor.
- Remocao agora apaga o artefato e o projeto relacionado no Supabase quando disponivel.
- Remocao local continua funcionando para projetos salvos antes da persistencia real.
- Corrigido fluxo de sincronizacao para carregar projetos sem disparar eventos repetidos.
- AI Studio e biblioteca `/projects` usam o mesmo helper de remocao sincronizada.

## Proximo passo

- Ativar Supabase com credenciais reais e testar salvar/listar/remover diretamente no banco.

## Build 0.14.0 - Sincronizacao manual de projetos locais

- Adicionado botao `Sincronizar` na biblioteca `/projects`.
- Projetos locais ainda nao persistidos podem ser enviados ao servidor quando Supabase estiver ativo.
- Projetos sincronizados recebem IDs reais do banco e substituem os registros locais antigos.
- Quando Supabase ainda nao esta pronto, a sincronizacao mantem tudo local sem perda de dados.
- Biblioteca exibe mensagem curta de resultado da sincronizacao.

## Proximo passo

- Configurar credenciais Supabase e criar workspace/usuario inicial para testar a sincronizacao real.

## Build 0.15.0 - Diagnostico de configuracao Supabase

- Health check agora valida tambem `VENDIAOS_DEFAULT_WORKSPACE_ID` e `VENDIAOS_DEFAULT_USER_ID`.
- Tela de Configuracoes mostra status detalhado das variaveis OpenAI, Supabase publico, Supabase server-side e workspace inicial.
- Cada card exibe quais variaveis estao prontas ou pendentes sem expor valores sensiveis.
- Preparado o painel para orientar a ativacao real da persistencia no Supabase.

## Proximo passo

- Criar o fluxo de bootstrap para workspace/usuario inicial ou conectar autenticacao real.

## Build 0.16.0 - Detalhe de projeto salvo

- Criada rota `/projects/[projectId]` para revisar um artefato salvo em tela completa.
- Adicionado componente de detalhe com objetivo, artefato inicial, proxima acao e resposta completa.
- Biblioteca de projetos ganhou acao `Ver` para abrir o detalhe sem sobrescrever o AI Studio.
- Detalhe permite copiar, abrir no Studio ou remover o projeto.
- Extraida formatacao de projetos para helper compartilhado em `components/projects/project-format.ts`.

## Proximo passo

- Adicionar edicao/versionamento de artefatos salvos antes de reenviar para o orquestrador.

## Build 0.17.0 - Edicao de artefatos salvos

- Detalhe de projeto agora permite editar a resposta completa.
- Alteracoes sao salvas localmente imediatamente e podem ser refletidas no Supabase quando a persistencia estiver ativa.
- Criado helper `updateSyncedProject` para centralizar edicao local/server-side.
- Adicionada rota `PATCH /api/projects?id=...` para atualizar artefatos no Supabase.
- Tela de detalhe ganhou estados de salvar, cancelar e feedback de persistencia.

## Proximo passo

- Adicionar historico de versoes para cada artefato editado.

## Build 0.18.0 - Historico de versoes local

- Edicoes de artefatos agora salvam a versao anterior no navegador.
- Tela de detalhe mostra historico de versoes com data, motivo e preview do conteudo anterior.
- Usuario pode restaurar uma versao anterior com um clique.
- Restauracoes tambem preservam a versao atual antes de substituir o conteudo.
- Criado armazenamento local `vendiaos.project-versions` limitado as ultimas 100 versoes.

## Proximo passo

- Persistir historico de versoes no Supabase e adicionar comparacao visual entre versoes.

## Build 0.19.0 - Comparacao visual de versoes

- Historico de versoes ganhou acao `Comparar`.
- Detalhe do projeto agora mostra versao anterior e versao atual lado a lado.
- Comparacao exibe diferenca aproximada de caracteres.
- Usuario pode fechar a comparacao sem sair da tela ou restaurar a versao comparada.

## Proximo passo

- Persistir versoes no Supabase e evoluir comparacao para destaque de trechos alterados.

## Build 0.20.0 - Exportacao de projetos

- Detalhe de projeto ganhou acao `Exportar`.
- Artefatos salvos agora podem ser baixados em Markdown.
- Exportacao inclui objetivo, modo, data, artefato inicial, proxima acao e resposta completa.
- Nome do arquivo e gerado automaticamente a partir do objetivo do projeto.

## Proximo passo

- Adicionar exportacao em PDF e compartilhamento por link quando Supabase estiver ativo.

## Build 0.21.0 - Transformacoes a partir do projeto

- Detalhe de projeto ganhou a area `Transformar com VendIAOS`.
- Usuario pode enviar um artefato para variacoes, campanha, roteiro de video ou prompts de imagem.
- AI Studio agora aceita um prompt pendente vindo da biblioteca de projetos.
- O artefato original abre como contexto e o novo comando fica pronto no input do Studio.

## Proximo passo

- Permitir executar automaticamente a transformacao ao abrir o AI Studio.

## Build 0.23.0 - Origem da transformacao no AI Studio

- Transformacoes vindas de projetos agora gravam metadados de origem.
- AI Studio exibe um banner informando o projeto que originou a transformacao.
- Banner inclui modo, titulo do projeto e link de volta para o detalhe.
- Limpar conversa tambem remove o contexto visual da origem.

## Proximo passo

- Salvar a relacao entre artefato original e artefato derivado no Supabase.

## Build 0.24.0 - Linhagem local de artefatos

- Botao de salvar no AI Studio agora preserva a origem quando a resposta veio de uma transformacao.
- Artefatos derivados salvos localmente recebem `originProjectId`, `originProjectMode` e `originProjectTitle`.
- Rota `POST /api/projects` aceita metadados de origem para preparar persistencia no Supabase.
- AIMessage, AIConversation e AIMessageActions agora compartilham o contexto do projeto original.
- Botao muda para `Salvar derivado` quando existe origem.

## Proximo passo

- Exibir a origem dos artefatos derivados na biblioteca de projetos e no detalhe.

## Build 0.25.0 - Linhagem visivel de artefatos

- Biblioteca de projetos agora identifica artefatos derivados com marcador visual.
- Cards derivados exibem a origem quando o titulo do projeto original estiver disponivel.
- Detalhe do projeto mostra link de volta para o projeto original.
- Sincronizacao local para Supabase preserva `originProjectId`, `originProjectMode` e `originProjectTitle`.
- Rota `/api/projects` passa a gravar e retornar metadados de origem no Supabase.

## Proximo passo

- Criar visualizacao de cadeia: original, derivados e proximas transformacoes recomendadas.

## Build 0.26.0 - Bootstrap Supabase inicial

- Criada rota server-side `POST /api/system/bootstrap`.
- Configuracoes ganhou card para criar usuario, workspace e membro owner no Supabase.
- Bootstrap retorna os IDs `VENDIAOS_DEFAULT_WORKSPACE_ID` e `VENDIAOS_DEFAULT_USER_ID`.
- Adicionada variavel opcional `VENDIAOS_BOOTSTRAP_SECRET` para proteger a criacao em producao.
- Documentado fluxo para ativar persistencia real apos aplicar a migration.

## Proximo passo

- Aplicar migration no Supabase, configurar chaves reais e executar o bootstrap pela tela de Configuracoes.

## Build 0.27.0 - Feedback de persistencia Supabase

- Botao `Salvar` do AI Studio agora exibe estado de salvamento.
- Respostas salvas no banco mostram `Salvo no Supabase`.
- Fallback continua informando quando o salvamento ficou local.
- Projetos recentes no AI Studio exibem a origem da biblioteca: Supabase ou Local.
- Evitado duplo clique durante a operacao de salvar.

## Proximo passo

- Testar o fluxo visual completo: gerar resposta, salvar no Supabase, abrir em Projetos e transformar em derivado.

## Build 0.28.0 - Cadeia de artefatos

- Detalhe do projeto ganhou a secao `Cadeia de artefatos`.
- Projetos agora mostram origem, artefato atual e derivados salvos a partir dele.
- Derivados aparecem com modo e link direto para continuar o fluxo.
- A visualizacao funciona com dados locais e com artefatos persistidos no Supabase.

## Proximo passo

- Criar recomendacoes automaticas de proxima transformacao com base no modo do artefato atual.

## Build 0.29.0 - Recomendacoes de proxima transformacao

- Detalhe do projeto agora sugere proximas transformacoes com base no modo do artefato.
- Recomendacoes consideram se o projeto ja possui derivados salvos.
- Cada recomendacao envia o artefato direto ao AI Studio com contexto preservado.
- A area `Transformar com VendIAOS` permanece disponivel para comandos manuais.

## Proximo passo

- Criar um painel operacional no Dashboard com atividades recentes e status de persistencia.

## Build 0.30.0 - Dashboard operacional

- Dashboard passou a exibir metricas reais de projetos salvos.
- Adicionada leitura da origem dos dados: Supabase ou Local.
- Atividade recente mostra os ultimos artefatos com links para detalhe.
- Status operacional exibe OpenAI e Supabase no painel principal.
- Home ganhou atalhos claros para AI Studio e biblioteca de projetos.

## Proximo passo

- Criar autenticacao real para substituir o bootstrap local por usuarios e workspaces de producao.
## Build 0.31.0 - Bootstrap concluido em Configuracoes

- A tela de Configuracoes agora consulta o health check antes de exibir o bootstrap.
- Quando Supabase e workspace inicial estao prontos, o card mostra estado concluido.
- O formulario de criacao deixa de aparecer apos o bootstrap estar ativo.
- Reduz risco de criar workspace/usuario inicial duplicado.

Proximo passo:
- Evoluir autenticacao real e troca de workspace por usuario.

## Build 0.32.0 - Projetos como central de transformacao

- Adicionados filtros por modo na biblioteca de Projetos.
- Adicionado contador de projetos exibidos versus total salvo.
- Cada card agora permite transformar artefato em campanha, video, imagem ou funil.
- As transformacoes enviam o contexto para o AI Studio com execucao automatica.
- Ajustado redirecionamento da listagem para evitar escrita direta em `window.location.href`.

Proximo passo:
- Criar estados de status por artefato e historico visual de derivacoes.

## Build 0.33.0 - Status operacional dos artefatos

- Cards de Projetos agora mostram status do artefato: pronto para transformar, em expansao ou derivado.
- Adicionado indicador de proxima transformacao recomendada por modo.
- A biblioteca ficou mais orientada a acao, reduzindo duvida sobre o proximo passo.

Proximo passo:
- Persistir status operacional no Supabase com filas reais de execucao.

## Build 0.34.0 - Biblioteca de projetos compacta

- Cards de Projetos agora mostram preview curto do artefato em vez do conteudo longo completo.
- Adicionado link "Ver detalhe completo" dentro do preview.
- Acao principal do card passou a ser "Ver detalhe".
- "Abrir no Studio" virou acao secundaria para reduzir competicao visual.
- Biblioteca ficou mais escaneavel e com menos rolagem vertical.

Proximo passo:
- Criar status persistido de execucao para transformacoes e filas reais no Supabase.

## Build 0.35.0 - Registro local de execucoes

- Transformacoes iniciadas na biblioteca agora criam um registro local de execucao.
- Cards mostram a ultima execucao enviada ao AI Studio.
- Criada base de UX para futura fila persistida no Supabase.

Proximo passo:
- Criar tabela `agent_runs` no Supabase e mover o registro local para persistencia server-side.

## Build 0.36.0 - Fila de execucoes dos agentes

- Criada migration `agent_runs` para registrar execucoes de agentes por workspace, artefato e modo de destino.
- Criada rota server-side `GET/POST /api/agent-runs`.
- Criado cliente `agent-runs-client` com fallback local quando a migration ainda nao foi aplicada.
- Biblioteca de Projetos agora registra transformacoes antes de enviar para o AI Studio.
- Cards exibem a ultima execucao conhecida do artefato.

Proximo passo:
- Aplicar a migration no Supabase e evoluir status `sent_to_studio` para `running/completed/failed` conforme agentes reais executarem.

## Build 0.37.0 - Historico e status de execucoes

- A rota `/api/agent-runs` agora suporta `PATCH` para atualizar status de execucao.
- O cliente `agent-runs-client` ganhou atualizacao sincronizada com fallback local.
- Detalhe do projeto agora exibe painel "Execucoes dos agentes".
- Execucoes podem ser marcadas como em execucao, concluidas ou com falha.
- Dashboard passou a mostrar total de execucoes registradas.

Proximo passo:
- Conectar execucoes a agentes reais que atualizam status automaticamente.

## Build 0.38.0 - Central operacional de execucoes

- Criada rota `/executions` para acompanhar execucoes dos agentes em uma tela dedicada.
- Adicionados filtros por destino e status operacional.
- Execucoes podem ser atualizadas diretamente na central.
- Sidebar ganhou acesso direto para Execucoes.
- Dashboard agora carrega a quantidade real de execucoes.

Proximo passo:
- Conectar agentes reais e mover execucoes entre fila, processamento e conclusao automaticamente.

## Build 0.39.0 - Execucao real de agente

- Criada rota `POST /api/agent-runs/execute`.
- Uma execucao pode gerar resposta via IA, salvar artefato derivado e marcar status como concluido.
- Fallback local executa via `/api/ai/chat` e salva via `/api/projects` quando a fila server-side ainda nao esta disponivel.
- Central de Execucoes e detalhe do projeto ganharam botao "Executar agente".
- O fluxo agora fecha: projeto salvo -> execucao -> artefato derivado.

Proximo passo:
- Rodar execucoes em background com fila assÃ­ncrona e logs por etapa.

## Build 0.40.0 - Detalhe de execucao

- Criada rota `/executions/[runId]` para inspecionar uma execucao individual.
- Detalhe mostra origem, status, prompt, snapshot de entrada e artefato derivado quando existir.
- Cards da central de Execucoes agora abrem o detalhe da execucao.
- API e cliente passaram a expor `outputArtifactId`, `outputProjectId` e `generationSource`.

Proximo passo:
- Adicionar logs por etapa para cada execucao de agente.
## Build 0.41.0 - Logs por etapa das execucoes

- Criada a tabela `agent_run_logs` para registrar eventos operacionais de cada execucao.
- Criada a rota `GET/POST /api/agent-runs/logs` com fallback local para desenvolvimento.
- O cliente agora salva e sincroniza logs de execucoes com atualizacao na interface.
- A rota server-side de execucao registra etapas principais: recebido, executando, gerado, salvo e concluido.
- O detalhe de execucao ganhou uma timeline de logs para auditoria operacional.

Proximo passo:
- Transformar execucoes em jobs assincronos com fila, retries e cancelamento.
## Build 0.42.0 - Controles operacionais de fila

- Execucoes agora podem ser reenfileiradas pelo operador.
- Execucoes podem ser canceladas sem apagar o historico.
- Central de Execucoes, detalhe de execucao e painel do projeto receberam os mesmos controles operacionais.
- Reenfileirar e cancelar geram logs operacionais quando a Build 0.41.0 esta aplicada.

Proximo passo:
- Criar uma fila assÃ­ncrona real com worker, retries automaticos e bloqueio de execucoes duplicadas.
## Build 0.43.0 - Processador de fila

- Criada rota `POST /api/agent-runs/process` para processar execucoes pendentes em lote.
- A fila busca execucoes `queued` e `sent_to_studio`, respeitando limite por rodada.
- Cada execucao capturada pelo processador recebe log operacional `queue_claimed`.
- A Central de Execucoes ganhou o botao "Processar fila" para disparar o worker manualmente.
- Cliente `agent-runs-client` passou a expor `processAgentRunQueue`.

Proximo passo:
- Adicionar retries automaticos com contador de tentativas e horario da proxima tentativa.

## Build 0.44.0 - Retries automaticos

- Falhas de execucao agora registram `retryCount`, `lastError`, `failedAt` e `nextRetryAt` no metadata da execucao.
- A rota `POST /api/agent-runs/process` tambem considera execucoes `failed` quando ainda ha tentativas disponiveis.
- O processador respeita limite de 3 tentativas por execucao.
- Execucoes concluídas limpam erro anterior e desativam retry pendente.
- Central de Execucoes, detalhe da execucao e painel do projeto exibem informacoes de retry.

Proximo passo:
- Criar bloqueio transacional para impedir duas execucoes simultaneas do mesmo agente.
## Build 0.45.0 - Bloqueio contra execucao duplicada

- Execucoes agora recebem lock operacional antes de serem processadas.
- A rota `POST /api/agent-runs/process` captura cada item com PATCH condicional por status antes de chamar o executor.
- A rota `POST /api/agent-runs/execute` ignora execucoes ja finalizadas ou em andamento quando nao vierem de uma captura de fila.
- Logs `lock_rejected`, `queue_skipped` e `execution_skipped` ajudam a auditar disputas de processamento.
- O detalhe da execucao mostra lock, horario de captura e expiracao do lock.

Proximo passo:
- Criar limpeza automatica de locks expirados e reentrada segura de execucoes travadas.
## Build 0.46.0 - Limpeza de locks expirados

- Criada rota `POST /api/agent-runs/locks` para recuperar execucoes presas em `running` com lock expirado.
- Locks expirados registram eventos `lock_expired`, `lock_released` ou `lock_release_failed`.
- Execucoes recuperadas voltam como `failed` com `nextRetryAt` imediato para entrarem no fluxo de retry.
- A Central de Execucoes ganhou o botao "Limpar travadas".
- O botao "Processar fila" agora limpa locks expirados antes de processar o lote.

Proximo passo:
- Criar painel de saude da fila com contadores de pendentes, rodando, travadas e falhas.
## Build 0.47.0 - Painel de saude da fila

- Criada rota `GET /api/agent-runs/health` para consolidar indicadores operacionais da fila.
- Criado componente `AgentQueueHealthPanel` com contadores de pendentes, rodando, travadas, retries prontos e concluidas.
- Central de Execucoes agora mostra total analisado, execucoes ativas e taxa concluida.
- Cliente `agent-runs-client` ganhou `loadAgentRunHealth`.
- O painel respeita fallback local quando Supabase ainda nao estiver disponivel.

Proximo passo:
- Criar automacao de polling para atualizar saude e fila sem clique manual.

## Build 0.48.0 - Atualizacao automatica da fila

- Central de Execucoes agora sincroniza a lista automaticamente a cada 15 segundos.
- O painel de saude da fila tambem atualiza automaticamente a cada 15 segundos.
- Adicionado controle para pausar ou reativar a sincronizacao automatica da lista.
- Interface mostra o horario da ultima sincronizacao.
- Acoes de limpar locks e processar fila atualizam o carimbo de sincronizacao.

Proximo passo:
- Criar modo operacional com execucao automatica da fila em intervalos controlados.
## Build 0.49.0 - Modo operacional automatico

- Central de Execucoes ganhou modo operacional automatico para processar a fila a cada 60 segundos.
- O modo operacional limpa locks expirados antes de processar cada ciclo.
- Ciclos automaticos usam trava local para evitar sobreposicao entre rodadas.
- Preferencia do modo operacional fica salva no navegador.
- Interface mostra ultimo ciclo, estado manual/automatico e quando uma rodada esta em andamento.

Proximo passo:
- Criar historico resumido dos ciclos operacionais para auditoria de automacao.
## Build 0.50.0 - Historico dos ciclos operacionais

- A Central de Execucoes agora registra historico local dos ciclos manuais e automaticos.
- Cada ciclo mostra modo, horario, locks limpos, execucoes processadas e mensagem operacional.
- Ciclos ignorados por sobreposicao tambem ficam registrados.
- Falhas de ciclo entram no historico com status de erro.
- Historico fica salvo no navegador e pode ser limpo pela interface.

Proximo passo:
- Persistir historico dos ciclos no Supabase para auditoria multiusuario.
## Build 0.51.0 - Historico dos ciclos no Supabase

- Criada migration `agent_run_cycles` para auditoria persistente dos ciclos operacionais.
- Criada rota `GET/POST /api/agent-runs/cycles`.
- Cliente `agent-runs-client` ganhou sincronizacao e criacao de ciclos operacionais.
- Central de Execucoes carrega historico do Supabase quando disponivel e mantem fallback local.
- Cada ciclo manual, automatico, ignorado ou com falha passa a ser enviado para auditoria server-side.

Proximo passo:
- Criar pagina dedicada de auditoria operacional com filtros por ciclo, status e periodo.
## Build 0.52.0 - Pagina de auditoria operacional

- Criada rota `/audit` com pagina dedicada para auditoria dos ciclos operacionais.
- Adicionados filtros por modo, status, periodo e busca textual.
- Pagina exibe metricas de ciclos filtrados, falhas, automaticos, locks limpos e execucoes processadas.
- Sidebar ganhou link direto para Auditoria.
- Auditoria usa ciclos sincronizados via Supabase quando disponivel.

Proximo passo:
- Criar detalhe individual de ciclo com eventos, logs e execucoes impactadas.
## Build 0.53.0 - Detalhe individual de ciclo

- Criada rota `/audit/[cycleId]` para inspecionar um ciclo operacional especifico.
- API `GET /api/agent-runs/cycles` passou a aceitar `?id=` para buscar um unico ciclo.
- Cliente ganhou `loadSyncedAgentRunCycle`.
- Auditoria agora oferece acao "Ver detalhe" em cada ciclo.
- Detalhe exibe status, modo, contagens, mensagem, data, origem e metadata.

Proximo passo:
- Vincular ciclos a execucoes impactadas para rastrear exatamente quais agentes foram processados em cada rodada.
## Build 0.54.0 - Rastreabilidade de ciclos

- Ciclos operacionais agora registram no metadata as execucoes processadas, locks recuperados e erros retornados pela fila.
- Detalhe de ciclo passou a exibir "Execucoes impactadas" com link direto para cada execucao.
- Metadata continua visivel para auditoria tecnica completa.

Proximo passo:
- Criar uma linha do tempo unificada por ciclo, juntando logs das execucoes impactadas.
## Build 0.55.0 - Linha do tempo do ciclo

- Detalhe de ciclo agora carrega logs das execucoes impactadas.
- Criada secao "Linha do tempo do ciclo" com nivel, evento, mensagem, execucao e horario.
- Auditoria de ciclo ganhou botao para atualizar logs sem sair da tela.

Proximo passo:
- Criar agrupamento por execucao dentro da linha do tempo para facilitar investigacao de ciclos grandes.
## Build 0.56.0 - Timeline agrupada por execucao

- Linha do tempo do ciclo agora agrupa logs por execucao impactada.
- Cada grupo mostra alvo, status, titulo, quantidade de logs e link direto para a execucao.
- Logs continuam exibindo nivel, evento, mensagem e horario dentro do grupo correto.

Proximo passo:
- Adicionar filtro de nivel na linha do tempo do ciclo para investigar erros e avisos mais rapidamente.
## Build 0.57.0 - Filtro de nivel na timeline

- Detalhe de ciclo ganhou filtro por nivel de log: todos, erros, avisos, sucessos e info.
- Cada filtro exibe contagem do nivel para acelerar investigacao.
- Timeline agrupada por execucao agora respeita o nivel selecionado.

Proximo passo:
- Adicionar busca textual na timeline por evento, mensagem ou ID da execucao.
## Build 0.58.0 - Busca textual na timeline

- Detalhe de ciclo ganhou busca textual na linha do tempo.
- Busca considera evento, mensagem, nivel, ID da execucao, alvo, status, titulo e ultimo erro.
- Mensagem de vazio agora diferencia ausencia de logs dos filtros atuais.

Proximo passo:
- Adicionar exportacao de auditoria do ciclo em Markdown para compartilhar diagnosticos operacionais.

## Build 0.59.0 - Exportacao Markdown da auditoria

- Detalhe de ciclo ganhou acao para copiar a auditoria completa em Markdown.
- Detalhe de ciclo ganhou acao para baixar arquivo `.md` com resumo, execucoes impactadas, erros, locks e linha do tempo.
- Exportacao usa a linha do tempo completa do ciclo, independente dos filtros visuais aplicados na tela.

Proximo passo:
- Criar exportacao em PDF ou relatorio visual para auditoria executiva.
## Build 0.60.0 - Relatorio executivo imprimivel

- Criada rota `/audit/[cycleId]/report` para relatorio executivo de ciclo.
- Detalhe do ciclo ganhou botao "Relatorio".
- Relatorio exibe resumo operacional, metricas, execucoes impactadas, incidentes e timeline resumida.
- Relatorio tem acao "Imprimir / PDF" usando o navegador.

Proximo passo:
- Criar filtros de periodo e severidade no relatorio executivo para auditorias maiores.
## Build 0.61.0 - Base de autenticacao Supabase

- Criada rota `/login` com entrada e cadastro por email/senha.
- Criado cliente Auth REST para Supabase Auth sem expor service role.
- Header passou a mostrar sessao ativa, entrada e logout.
- Sessao fica persistida no navegador e sincroniza entre abas.
- `.env.example` ganhou `NEXT_PUBLIC_APP_URL`.

Proximo passo:
- Proteger rotas operacionais com guard de sessao e iniciar vinculo real entre usuario autenticado e workspace.
## Build 0.62.0 - Guard de sessao operacional

- Criado `AuthGuard` para proteger telas operacionais com sessao local do Supabase Auth.
- `MainLayout` agora exige sessao antes de renderizar Dashboard, AI Studio, Projetos, Execucoes, Auditoria, Configuracoes e demais areas internas.
- Relatorio executivo de auditoria tambem passa pelo guard de sessao.
- Sessao expirada e limpa automaticamente no navegador antes de liberar a interface.

Proximo passo:
- Migrar protecao para cookies/middleware server-side e vincular usuario autenticado ao workspace ativo.
## Build 0.63.0 - Workspace autenticado

- Criada rota `GET /api/auth/workspace` para validar token Supabase Auth e resolver workspace do usuario.
- Quando o usuario autenticado ainda nao possui workspace, o backend cria workspace e membership owner automaticamente.
- Sessao local passou a armazenar `workspace` com id, nome, slug e papel.
- Login/cadastro agora tentam sincronizar workspace logo apos autenticar.
- Header passou a exibir workspace ativo alem do email da sessao.

Proximo passo:
- Fazer APIs de projetos, execucoes e auditoria aceitarem contexto autenticado para substituir `VENDIAOS_DEFAULT_WORKSPACE_ID` e `VENDIAOS_DEFAULT_USER_ID`.
## Build 0.64.0 - Projetos com contexto autenticado

- Criado helper server-side `auth-workspace-context` para resolver workspace por token Supabase Auth com fallback bootstrap.
- Cliente de projetos passou a enviar `Authorization: Bearer` nas operacoes de listar, salvar, editar, remover e sincronizar.
- API `/api/projects` passou a usar workspace autenticado quando disponivel.
- Projetos salvos por usuario autenticado passam a usar `workspaceId` e `userId` reais do membership.
- Fallback para `VENDIAOS_DEFAULT_WORKSPACE_ID` e `VENDIAOS_DEFAULT_USER_ID` foi preservado.

Proximo passo:
- Migrar APIs de execucoes e auditoria para o mesmo contexto autenticado.
## Build 0.65.0 - Execucoes com workspace autenticado

- Cliente de execucoes passou a enviar `Authorization: Bearer` nas rotas de fila, logs, ciclos, health, locks e processamento.
- APIs de execucoes passaram a resolver workspace por sessao Supabase Auth quando disponivel.
- Logs, ciclos, health, locks e processamento preservam fallback local quando nao ha sessao/workspace configurado.
- Criacao, atualizacao e execucao de agentes passam a gravar com `workspaceId` e `userId` do membership autenticado.

Proximo passo:
- Proteger relatorios/auditoria por membership e adicionar filtros por usuario/workspace na UI.
## Build 0.65.1 - Ajuste de contexto no PATCH de execucoes

- Corrigido o PATCH de `/api/agent-runs` para usar o contexto autenticado em vez do bootstrap antigo.
- Build de validacao recompilado para garantir que a migracao 0.65 ficou consistente.

## Build 0.66.0 - Auditoria protegida e contexto operacional visivel

- Relatorio executivo de auditoria passou a exigir sessao ativa pelo `AuthGuard`.
- `AuthGuard` agora sincroniza workspace autenticado mesmo em paginas sem header.
- Auditoria operacional exibe workspace, perfil e operador para confirmar o contexto multiusuario.

Proximo passo:
- Aplicar o mesmo indicador de workspace em Projetos e Execucoes e adicionar filtros por operador.
## Build 0.67.0 - Contexto operacional em Projetos e Execucoes

- Criado `OperationalContextPanel` reutilizavel para exibir workspace, perfil, operador e persistencia.
- Projetos salvos agora mostram o contexto operacional antes da busca e sincronizacao.
- Execucoes dos agentes agora mostram o mesmo contexto antes dos controles da fila.
- Interface fica mais clara para operacao multiusuario e valida a origem dos dados em tempo real.

Proximo passo:
- Remover duplicacao do painel de contexto da auditoria e reutilizar o mesmo componente compartilhado.

## Build 0.68.0 - Contexto operacional unificado na Auditoria

- Auditoria passou a reutilizar `OperationalContextPanel`.
- Removida duplicacao de estado de sessao e cards manuais da tela de ciclos.
- Projetos, Execucoes e Auditoria agora compartilham o mesmo padrao de contexto operacional.

Proximo passo:
- Adicionar filtros por operador/status de persistencia e preparar exibicao de membros do workspace.
## Build 0.69.0 - Membros do workspace

- Criada rota `GET /api/workspace/members` para listar memberships do workspace autenticado.
- Configuracoes ganharam painel "Membros do workspace" com contagem por role e destaque do usuario atual.
- Tela mostra persistencia ativa e fallback quando Supabase/membership ainda nao estiver disponivel.
- Base preparada para convites e gestao de permissoes em ciclo futuro.

Proximo passo:
- Adicionar convite de membro por email e controle de role para owners/admins.

## Build 0.70.0 - Convites de workspace

- Criada migration `workspace_invites` para convites pendentes por workspace.
- Criada rota `GET/POST /api/workspace/invites` com permissao para owner/admin.
- Painel de membros ganhou formulario para convidar por email com role `member` ou `admin`.
- Configuracoes agora listam convites pendentes com status, role e expiracao.

Proximo passo:
- Criar fluxo de aceite de convite e envio real de email transacional.

## Build 0.71.0 - Aceite de convite

- Criada rota publica `/invite/[token]` para abrir convites de workspace.
- Criada API `GET/POST /api/workspace/invites/accept` para consultar e aceitar convite.
- Aceite valida sessao, email convidado, status pendente e expiracao.
- Ao aceitar, usuario e vinculado ao workspace e a sessao local troca para o workspace aceito.
- Lista de convites em Configuracoes ganhou acao para copiar link de aceite.

Proximo passo:
- Enviar automaticamente o link por email e criar tela de revogacao/reenvio de convites.

## Build 0.72.0 - Gestao operacional de convites

- API `/api/workspace/invites` ganhou `PATCH` para revogar ou renovar convites.
- Convites podem ser renovados com novo token e nova expiracao de 7 dias.
- Convites pendentes podem ser revogados por owner/admin.
- Configuracoes ganharam acoes "Renovar" e "Revogar" na lista de convites.

Proximo passo:
- Integrar envio automatico do link por email transacional e registrar eventos de auditoria de convite.

## Build 0.73.0 - Base de billing e limites

- Criada migration `workspace_billing` para plano, status, limites mensais e IDs Stripe por workspace.
- Criada API `GET /api/billing/overview` com plano atual, periodo e uso de projetos/execucoes.
- Tela Financeiro foi substituida por dashboard de plano, uso e comparativo Starter/Growth/Scale.
- Billing opera em modo pre-Stripe com fallback seguro ate a cobranca real ser conectada.

Proximo passo:
- Integrar Stripe Checkout/Customer Portal e registrar eventos de billing por webhook.

## Build 0.74.0 - Stripe Checkout e Portal server-side

- Criado helper server-side `stripe-config` sem expor chave no frontend.
- Criada rota `POST /api/billing/checkout` para iniciar assinatura Growth/Scale.
- Criada rota `POST /api/billing/portal` para abrir Customer Portal quando o workspace ja tiver cliente Stripe.
- Tela Financeiro ganhou botoes reais para checkout e portal, com mensagens de fallback quando Stripe ainda nao estiver configurado.
- `.env.example` recebeu `STRIPE_SECRET_KEY`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE` e `STRIPE_WEBHOOK_SECRET`.

Proximo passo:
- Criar webhook Stripe para atualizar `workspace_billing` automaticamente apos checkout e mudancas de assinatura.

## Build 0.75.0 - Webhook Stripe para billing

- Criada migration `billing_webhook_events` para idempotencia e rastreabilidade de eventos Stripe.
- Helper Stripe ganhou verificacao HMAC de assinatura `stripe-signature` usando `STRIPE_WEBHOOK_SECRET`.
- Criada rota `POST /api/billing/webhook` para processar checkout e eventos de assinatura.
- Webhook atualiza `workspace_billing` em checkout concluido, assinatura criada/atualizada/removida.
- Planos Growth/Scale passam a atualizar limites mensais automaticamente a partir do evento Stripe.

Proximo passo:
- Adicionar UI de historico financeiro e logs de eventos de billing no painel Financeiro.

## Build 0.76.0 - Historico financeiro

- Criada rota `GET /api/billing/events` para listar os ultimos eventos Stripe do workspace.
- Tela Financeiro passou a carregar plano, uso e historico em paralelo.
- Adicionado painel "Eventos de cobranca" com estado vazio e lista dos eventos recebidos pelo webhook.
- Billing agora tem rastreabilidade visual para checkout, assinatura e cancelamento.

Proximo passo:
- Criar alertas de limite de uso e bloquear novas execucoes quando o workspace ultrapassar o plano.

## Build 0.77.0 - Trava de limite de execucoes

- Criado helper server-side `billing-limits` para calcular cota mensal de execucoes por workspace.
- A API `POST /api/agent-runs` agora consulta plano, status e uso antes de criar uma nova execucao.
- Workspaces com assinatura cancelada ou limite mensal esgotado recebem bloqueio `402` com codigo operacional.
- A fila fica protegida contra excesso de novas execucoes sem expor regras de billing no frontend.

Proximo passo:
- Exibir alertas proativos no Financeiro e nos pontos de criacao de execucao quando o uso estiver perto do limite.

## Build 0.78.0 - Alertas de limite de uso

- Financeiro ganhou alerta visual quando execucoes de agentes chegam a 80% ou 100% do limite mensal.
- O alerta oferece acao direta para ajustar plano ou gerenciar assinatura.
- Cliente de agentes passou a tratar bloqueio `402` como limite real de plano, sem manter execucao local falsa.
- Projetos mostra a mensagem de limite ao tentar transformar artefatos quando a cota estiver esgotada.

Proximo passo:
- Levar o mesmo contexto de billing para a Central de Execucoes e para o Dashboard principal.

## Build 0.79.0 - Billing no Dashboard e Execucoes

- Central de Execucoes passou a carregar o resumo de billing junto da fila de agentes.
- Adicionado alerta operacional de cota saudavel, perto do limite ou esgotada.
- Botao "Processar fila" e ativacao operacional ficam bloqueados quando a cota mensal esta esgotada.
- Dashboard principal ganhou resumo de plano, status e uso de execucoes do periodo.

Proximo passo:
- Criar logs/auditoria para bloqueios de billing e preparar politicas de permissao por role.

## Build 0.80.0 - Auditoria de bloqueios de billing

- Criada migration `billing_limit_events` para registrar bloqueios por cota ou assinatura cancelada.
- API `POST /api/agent-runs` agora grava evento de billing sempre que bloqueia uma nova execucao.
- Rota `GET /api/billing/events` passou a unificar webhooks Stripe e eventos de limite em uma timeline financeira.
- Painel Financeiro diferencia eventos de Stripe e bloqueios de limite no historico.
- Documentacao de banco atualizada com a nova tabela de auditoria.

Proximo passo:
- Implementar permissoes por role para billing, convites e operacoes criticas.

## Build 0.81.0 - Permissoes de billing por role

- Criados helpers server-side para permissao de billing e membros por role do workspace.
- Rotas `POST /api/billing/checkout` e `POST /api/billing/portal` passaram a usar permissao centralizada.
- `GET /api/billing/overview` agora retorna `permissions.canManageBilling` para orientar a UI.
- Tela Financeiro bloqueia checkout/portal para usuarios sem permissao e mostra mensagem clara.
- Modo bootstrap/local continua operando como owner inicial para nao travar desenvolvimento.

Proximo passo:
- Aplicar permissoes centralizadas tambem nas telas de membros, convites e acoes destrutivas de projetos.

## Build 0.82.0 - Permissoes centralizadas para membros

- Convites de workspace passaram a usar `canManageWorkspaceMembers` em vez de regra local duplicada.
- API de membros agora retorna `permissions.canManageMembers` e papel efetivo do usuario.
- Configuracoes mostram o papel atual do operador e se ele pode gerenciar convites.
- UI de convites usa a permissao centralizada para habilitar/desabilitar criacao, renovacao e revogacao.
- Modo bootstrap/local continua reconhecido como owner local no painel.

Proximo passo:
- Implementar auditoria de acoes administrativas e protecao para remocao/exclusao de artefatos.

## Build 0.83.0 - Auditoria administrativa base

- Criada migration `admin_audit_events` para registrar acoes administrativas sensiveis.
- Criado helper server-side `admin-audit` para gravar eventos sem bloquear a acao principal.
- Convites de workspace agora registram auditoria ao criar, reutilizar, renovar ou revogar convite.
- Criada rota `GET /api/admin-audit` protegida por owner/admin para listar eventos administrativos recentes.
- Documentacao de banco atualizada com a nova tabela de auditoria.

Proximo passo:
- Exibir a timeline de auditoria administrativa em Configuracoes e auditar remocoes de projetos/artefatos.

## Build 0.84.0 - Timeline de auditoria em Configuracoes

- Criado componente `AdminAuditTimeline` para exibir eventos administrativos recentes.
- Configuracoes agora mostra a timeline protegida por owner/admin usando `/api/admin-audit`.
- Timeline lida com estado vazio, erro de permissao e fallback local.
- Eventos de convite aparecem com tipo, alvo, data e metadados principais.

Proximo passo:
- Auditar remocoes de projetos/artefatos e adicionar confirmacao mais segura para exclusoes.

## Build 0.85.0 - Remocao segura de projetos

- API `DELETE /api/projects` agora registra evento `project_artifact_deleted` na auditoria administrativa.
- Auditoria de exclusao grava artifact, projeto vinculado, modo e titulo quando disponiveis.
- Lista de Projetos passou a exigir segundo clique para confirmar remocao.
- Detalhe do Projeto tambem exige confirmacao antes de excluir e exibe mensagem clara.
- Fluxo reduz exclusoes acidentais e passa a aparecer na timeline administrativa.

Proximo passo:
- Criar acao de restauracao/arquivamento para evitar exclusao definitiva em fluxos criticos.

## Build 0.86.0 - Arquivamento seguro de projetos

- Criada migration `project_archiving` com `archived_at` e `archived_by` em `projects` e `artifacts`.
- `GET /api/projects` passou a ocultar artefatos arquivados.
- `DELETE /api/projects` agora arquiva projeto/artefato em vez de apagar definitivamente.
- Auditoria administrativa registra `project_artifact_archived`.
- UI de Projetos e Detalhe trocou exclusao por arquivamento com confirmacao de segundo clique.

Proximo passo:
- Criar tela/filtro de itens arquivados com restauracao controlada por owner/admin.

## Build 0.87.0 - Arquivados e restauracao

- `GET /api/projects?status=archived` lista artefatos arquivados.
- `PATCH /api/projects` ganhou `action: "restore"` protegida por owner/admin.
- Restauracao remove `archived_at`/`archived_by` de artefato e projeto vinculado.
- Auditoria administrativa registra `project_artifact_restored`.
- Tela Projetos ganhou painel de arquivados com acao Restaurar.

Proximo passo:
- Melhorar busca/filtros dos arquivados e adicionar permissao visual para restauracao.

## Build 0.88.0 - Filtros e permissao visual em arquivados

- API de projetos agora retorna `permissions.canRestoreProjects` na listagem.
- Client de projetos propaga permissao de restauracao para a UI.
- Painel de arquivados ganhou busca independente.
- Arquivados podem ser filtrados por modo.
- Botao Restaurar fica desabilitado para usuarios sem permissao owner/admin e exibe aviso claro.

Proximo passo:
- Criar metricas de arquivamento/restauracao no Dashboard e finalizar endurecimento de permissoes operacionais.

## Build 0.89.0 - Metricas de arquivamento no Dashboard

- Criada rota `GET /api/projects/stats` para contar artefatos ativos, arquivados e restauracoes.
- Dashboard principal passou a carregar metricas de projeto junto de billing, saude e execucoes.
- Adicionados cards de ativos no Supabase, arquivados e restauracoes.
- Restauracoes sao contabilizadas a partir de `admin_audit_events`.

Proximo passo:
- Endurecer permissoes operacionais de fila/execucao e preparar checklist final de producao.

## Build 0.90.0 - Permissoes operacionais da fila

- Criado helper centralizado `canOperateAgentRuns` para operacoes criticas de agentes.
- Rotas de processar fila, limpar locks, executar agentes e alterar status agora exigem owner/admin.
- `GET /api/agent-runs` passou a retornar permissao operacional para orientar a interface.
- Central de Execucoes mostra aviso quando o usuario pode acompanhar, mas nao operar a fila.
- Botoes criticos ficam bloqueados visualmente para usuarios sem permissao.

Proximo passo:
- Criar checklist final de producao e teste guiado das rotas principais antes do deploy.

## Build 0.91.0 - Checklist de producao

- Criada rota `/production` com painel de prontidao operacional.
- Checklist valida OpenAI, Supabase, workspace, billing, fila de agentes, projetos e auditoria.
- Painel calcula status geral e porcentagem de prontidao com base nas rotas reais do sistema.
- Sidebar ganhou link Producao para acesso direto ao checklist.
- Cada item aponta para a area responsavel pela correcao operacional.

Proximo passo:
- Adicionar teste guiado de smoke test para validar fluxos principais com um clique.

## Build 0.92.0 - Smoke test guiado

- Criada rota `GET /api/production/smoke` para validar ambiente, workspace, permissoes e tabelas essenciais.
- Smoke test executa apenas leituras seguras, sem criar dados ou consumir OpenAI.
- Painel `/production` ganhou botao "Rodar smoke test" com resultado por item.
- Checklist de producao foi ajustado para ler corretamente o formato real de `/api/system/health` e `/api/projects/stats`.
- Resultado mostra passagens, avisos, falhas e tempo de cada verificacao.

Proximo passo:
- Criar tela de release notes/versao interna e preparar o pacote para primeiro deploy externo.

## Build 0.93.0 - Release interna

- Painel `/production` ganhou bloco de release interna `VendIAOS MVP Build 0.93.0`.
- Release notes resumem as principais entregas do MVP: AI Studio, projetos, agentes, billing, workspace e auditoria.
- Painel mostra progresso atual, quantidade de rotas no build e areas core entregues.
- Adicionada lista objetiva de bloqueios antes do deploy publico.
- Area de Producao passa a servir como centro de comando para prontidao, smoke test e release.

Proximo passo:
- Preparar deploy externo controlado e validar dominio, variaveis e webhook Stripe em producao.

## Build 0.94.0 - Plano de deploy externo

- Painel `/production` ganhou secao de deploy externo controlado.
- Checklist cobre ambiente, variaveis obrigatorias, dominio/callbacks, Stripe producao e validacao pos-deploy.
- Lista de variaveis essenciais foi consolidada no produto para reduzir risco de configuracao incompleta.
- Secao aponta para Configuracoes para conferir credenciais antes da publicacao.
- Producao agora concentra release, deploy, smoke test e prontidao operacional.

Proximo passo:
- Criar verificacao server-side dedicada para variaveis de deploy e segredos Stripe.

## Build 0.95.0 - Verificacao automatica de deploy

- Criada rota `GET /api/production/deploy-check` para validar variaveis obrigatorias e opcionais sem expor valores.
- Verificacao cobre OpenAI, Supabase, workspace inicial, URL publica e Stripe.
- Painel `/production` passou a carregar o status automatico do deploy junto do checklist manual.
- Variaveis faltantes aparecem com nome, categoria e status visual.
- A verificacao alerta quando `NEXT_PUBLIC_APP_URL` ainda aponta para ambiente local.

Proximo passo:
- Preparar export/commit do pacote e instrucoes finais para publicar em producao.

## Build 0.96.0 - Pacote final de publicacao

- README substituido pelo guia real do VendIAOS/Project Orion.
- Criado `docs/DEPLOYMENT.md` com passo a passo de deploy externo controlado.
- Documentadas variaveis obrigatorias, Supabase, Stripe, dominio, smoke test e rollback.
- Release interna no painel `/production` atualizada para Build 0.96.0.
- Painel ajustado para refletir 82% do MVP robusto e 39 rotas no build atual.

Proximo passo:
- Revisar estado git, preparar commit e publicar o pacote no repositorio remoto.

## Build 0.97.0 - Preparacao Vercel

- Guia de deploy atualizado com `Root Directory: project-orion`.
- README passou a destacar os comandos corretos para plataformas de deploy.
- Documentado que `NEXT_PUBLIC_APP_URL` deve usar a URL publica da plataforma no primeiro deploy.
- Registrado o cuidado com a estrutura atual do repositorio para evitar build no diretorio errado.

Proximo passo:
- Criar o projeto na Vercel, configurar variaveis e rodar smoke test na URL publica.

## Build 0.98.0 - Bibliotecas de midia operacionais

- Criada biblioteca operacional reutilizavel para Videos, Imagens e Avatares.
- Conectadas as rotas `/videos`, `/images` e `/avatars` aos artefatos salvos no VendIAOS.
- Adicionadas metricas, busca, estados vazios, copia, detalhe e abertura direta no AI Studio por tipo de artefato.

Proximo passo:
- Evoluir os hubs de midia para pipelines de producao com status, aprovacao e exportacao por canal.

## Build 0.99.0 - Dashboard de midia e release atualizada

- Dashboard principal ganhou atalhos operacionais para Videos, Imagens e Avatares com contagem real de artefatos.
- Painel `/production` foi atualizado para Build 0.98.0, 83% do MVP robusto e 7 areas core.
- Release interna passou a reconhecer as bibliotecas de midia como parte do escopo entregue.

Proximo passo:
- Criar pipeline de producao para aprovar, exportar e acompanhar artefatos por canal.

## Build 1.0.0 - Pipeline de producao de artefatos

- Adicionado status operacional por artefato: Rascunho, Em revisao, Aprovado e Exportado.
- Bibliotecas de Videos, Imagens e Avatares agora permitem mover artefatos pelo pipeline.
- Detalhe de projeto mostra e atualiza o status de producao do artefato.
- Dashboard principal passou a contar artefatos prontos para producao.

Proximo passo:
- Persistir o pipeline no Supabase metadata e adicionar filtros por status em Projetos.

## Build 1.1.0 - Pipeline persistido no Supabase

- Status de producao dos artefatos passou a sincronizar com Supabase via `metadata`.
- API `/api/projects` agora le e grava `productionStatus` e `productionStatusUpdatedAt` sem migration nova.
- Alteracoes de pipeline registram evento administrativo `artifact_production_status_updated`.
- Frontend mantem fallback local quando o artefato ainda nao tem UUID ou Supabase esta indisponivel.

Proximo passo:
- Adicionar filtros de pipeline na tela Projetos e relatorio operacional por status.
