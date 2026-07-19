import { NextResponse } from "next/server";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages?: ClientMessage[];
};

type OrchestrationMode = "campanha" | "video" | "imagem" | "avatar" | "analise" | "funil";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-5";

const modePlaybooks: Record<OrchestrationMode, string> = {
  campanha:
    "Modo campanha: construir oferta, publico, promessa, canais, calendario, criativos e metricas de campanha.",
  video:
    "Modo video: transformar objetivo em roteiro, gancho, cenas, narracao, B-roll, CTA e formato por canal.",
  imagem:
    "Modo imagem: definir conceito visual, prompt de imagem, variacoes, formato, composicao, texto e criterio de aprovacao.",
  avatar:
    "Modo avatar: planejar apresentador, roteiro falado, tom de voz, cenas de apoio, pausas, CTA e instrucoes para geracao.",
  analise:
    "Modo analise: diagnosticar dados, mercado, concorrentes, gargalos, hipoteses, metricas e recomendacoes priorizadas.",
  funil:
    "Modo funil: desenhar jornada completa de captura, nutricao, oferta, checkout, retencao, automacoes e indicadores.",
};

const baseDeveloperInstructions = [
  "Voce e o VendIAOS, um sistema operacional de marketing com IA.",
  "Voce nao e um chat generico. Voce e um orquestrador de marketing que decide o modo operacional, define o fluxo e prepara o proximo artefato.",
  "O usuario informa objetivo; voce decide o caminho entre campanha, video, imagem, avatar, analise e funil.",
  "Responda em portugues do Brasil, com clareza, objetividade e foco em execucao.",
  "Nao pergunte tudo antes de agir. Se faltar informacao, assuma uma configuracao sensata e marque o que precisa ser confirmado.",
  "Toda resposta deve produzir progresso operacional: briefing, plano, copy, roteiro, prompt, funil, diagnostico ou checklist acionavel.",
  "Evite respostas longas demais. Seja denso, organizado e util.",
  "Nao mencione qual provedor de IA esta sendo usado.",
].join("\n");

function detectMode(messages: ClientMessage[]): OrchestrationMode {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content.toLowerCase() ?? "";

  if (/\b(video|vídeo|short|reels|tiktok|youtube|roteiro|b-roll|narracao|narração)\b/.test(lastUserMessage)) {
    return "video";
  }

  if (/\b(imagem|criativo|thumbnail|banner|arte|visual|prompt|foto|design)\b/.test(lastUserMessage)) {
    return "imagem";
  }

  if (/\b(avatar|apresentador|heygen|porta-voz|voz|elevenlabs)\b/.test(lastUserMessage)) {
    return "avatar";
  }

  if (/\b(analisar|analise|análise|dados|metricas|métricas|concorrente|mercado|diagnostico|diagnóstico|relatorio|relatório)\b/.test(lastUserMessage)) {
    return "analise";
  }

  if (/\b(funil|landing|lead|checkout|email|whatsapp|nutricao|nutrição|conversao|conversão|upsell)\b/.test(lastUserMessage)) {
    return "funil";
  }

  return "campanha";
}

function createDeveloperInstructions(mode: OrchestrationMode) {
  return [
    baseDeveloperInstructions,
    modePlaybooks[mode],
    "Formato obrigatorio da resposta:",
    "MODO ESCOLHIDO: [campanha | video | imagem | avatar | analise | funil]",
    "OBJETIVO INTERPRETADO: uma frase clara.",
    "PLANO OPERACIONAL: 3 a 6 passos numerados, orientados para execucao.",
    "ARTEFATO INICIAL: entregue uma primeira versao concreta do que o usuario pediu ou do melhor primeiro ativo.",
    "PROXIMA ACAO: uma acao curta que o usuario pode aprovar, editar ou executar agora.",
    "Se o pedido for vago, comece com a melhor direcao provavel em vez de responder com perguntas soltas.",
  ].join("\n");
}

function isValidMessage(message: unknown): message is ClientMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<ClientMessage>;

  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    candidate.content.trim().length > 0
  );
}

function normalizeMessages(messages: ClientMessage[]) {
  return messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
}

function createLocalFallback(messages: ClientMessage[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const objective = lastUserMessage?.content ?? "novo objetivo de marketing";
  const mode = detectMode(messages);

  return [
    `MODO ESCOLHIDO: ${mode}`,
    `OBJETIVO INTERPRETADO: ${objective}`,
    "PLANO OPERACIONAL:",
    "1. Definir publico, oferta e canal principal.",
    "2. Criar uma primeira versao da campanha.",
    "3. Separar o trabalho por agente: texto, imagem, video, avatar ou midia paga.",
    "ARTEFATO INICIAL: briefing de marketing pronto para refinamento.",
    "PROXIMA ACAO: confirme o publico-alvo e o canal principal.",
  ].join("\n\n");
}

function getOpenAIText(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const outputText = (data as { output_text?: unknown }).output_text;

  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = (data as {
    output?: Array<{
      content?: Array<{
        text?: unknown;
        type?: unknown;
      }>;
    }>;
  }).output;

  if (!Array.isArray(output)) {
    return null;
  }

  const text = output
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((content): content is string => typeof content === "string" && content.trim().length > 0)
    .join("\n\n")
    .trim();

  if (text) {
    return text;
  }

  return null;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisicao invalido." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.filter(isValidMessage) : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: "Envie pelo menos uma mensagem." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      message: createLocalFallback(messages),
      source: "local-fallback",
    });
  }

  const mode = detectMode(messages);

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: createDeveloperInstructions(mode),
      input: normalizeMessages(messages),
      reasoning: {
        effort: "low",
      },
      max_output_tokens: 1400,
    }),
  });

  const data = (await response.json()) as unknown;

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Nao foi possivel gerar a resposta da IA agora.",
        details: data,
      },
      { status: response.status },
    );
  }

  const message = getOpenAIText(data);

  if (!message) {
    return NextResponse.json(
      { error: "A IA retornou uma resposta sem texto utilizavel." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    message,
    source: "openai",
  });
}
