"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RotateCcw, Sparkles } from "lucide-react";
import AIConversation from "./AIConversation";
import AIInput from "./AIInput";
import PromptSuggestions from "./PromptSuggestions";
import RecentProjects from "./RecentProjects";
import { AIMessageData } from "./AIMessage";
import type { ProjectOrigin } from "./AIMessageActions";
import type { SavedProject } from "./lib/projects-client";

const STORAGE_KEY = "vendiaos.ai-studio.messages";
const PENDING_PROMPT_KEY = "vendiaos.ai-studio.pending-prompt";
const PENDING_AUTO_RUN_KEY = "vendiaos.ai-studio.pending-auto-run";
const PENDING_SOURCE_KEY = "vendiaos.ai-studio.pending-source";

function createMessage(role: AIMessageData["role"], content: string): AIMessageData {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function createSimulatedResponse(prompt: string) {
  const objective = prompt.length > 150 ? `${prompt.slice(0, 147)}...` : prompt;

  return [
    "MODO ESCOLHIDO: campanha",
    `OBJETIVO INTERPRETADO: ${objective}`,
    "PLANO OPERACIONAL:",
    "1. Diagnosticar canal, publico e oferta principal.",
    "2. Transformar o pedido em um plano de marketing executavel.",
    "3. Preparar a proxima acao para o agente correto: texto, imagem, video, avatar ou campanha.",
    "ARTEFATO INICIAL: primeira versao de briefing pronta para refinamento.",
    "PROXIMA ACAO: confirme publico, canal e oferta.",
  ].join("\n\n");
}

async function requestAssistantMessage(messages: AIMessageData[]) {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });

  const data = (await response.json()) as { message?: string; error?: string };

  if (!response.ok || !data.message) {
    throw new Error(data.error ?? "Nao foi possivel gerar a resposta da IA.");
  }

  return data.message;
}

function parsePendingSource(rawPendingSource: string | null) {
  if (!rawPendingSource) {
    return null;
  }

  try {
    return JSON.parse(rawPendingSource) as ProjectOrigin;
  } catch {
    return null;
  }
}

export default function AIStudio() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<AIMessageData[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingSource, setPendingSource] = useState<ProjectOrigin | null>(null);
  const hasLoadedHistory = useRef(false);

  const hasMessages = messages.length > 0;

  async function sendMessageFromBase(text: string, baseMessages: AIMessageData[]) {
    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    const userMessage = createMessage("user", cleanText);
    const nextMessages = [...baseMessages, userMessage];

    setMessages(nextMessages);
    setPrompt("");
    setIsThinking(true);

    try {
      const assistantResponse = await requestAssistantMessage(nextMessages);
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", assistantResponse),
      ]);
    } catch {
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", createSimulatedResponse(cleanText)),
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  useEffect(() => {
    const storedMessages = window.localStorage.getItem(STORAGE_KEY);
    const pendingPrompt = window.localStorage.getItem(PENDING_PROMPT_KEY);
    const shouldAutoRun = window.localStorage.getItem(PENDING_AUTO_RUN_KEY) === "true";
    const rawPendingSource = window.localStorage.getItem(PENDING_SOURCE_KEY);
    const parsedPendingSource = parsePendingSource(rawPendingSource);

    window.localStorage.removeItem(PENDING_SOURCE_KEY);

    if (pendingPrompt) {
      window.localStorage.removeItem(PENDING_PROMPT_KEY);
      window.localStorage.removeItem(PENDING_AUTO_RUN_KEY);
    }

    if (!storedMessages) {
      queueMicrotask(() => {
        hasLoadedHistory.current = true;
        setPendingSource(parsedPendingSource);

        if (pendingPrompt && shouldAutoRun) {
          void sendMessageFromBase(pendingPrompt, []);
          return;
        }

        if (pendingPrompt) {
          setPrompt(pendingPrompt);
        }
      });
      return;
    }

    try {
      const parsedMessages = JSON.parse(storedMessages) as AIMessageData[];
      queueMicrotask(() => {
        hasLoadedHistory.current = true;
        setPendingSource(parsedPendingSource);

        if (pendingPrompt && shouldAutoRun) {
          void sendMessageFromBase(pendingPrompt, parsedMessages);
          return;
        }

        setMessages(parsedMessages);

        if (pendingPrompt) {
          setPrompt(pendingPrompt);
        }
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      queueMicrotask(() => {
        hasLoadedHistory.current = true;
        setPendingSource(parsedPendingSource);

        if (pendingPrompt && shouldAutoRun) {
          void sendMessageFromBase(pendingPrompt, []);
          return;
        }

        if (pendingPrompt) {
          setPrompt(pendingPrompt);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedHistory.current) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  async function sendMessage(text: string) {
    if (isThinking) {
      return;
    }

    await sendMessageFromBase(text, messages);
  }

  function clearConversation() {
    setMessages([]);
    setPendingSource(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function openProject(project: SavedProject) {
    setMessages([createMessage("assistant", project.content)]);
  }

  const conversationStatus = useMemo(() => {
    if (isThinking) {
      return "Gerando resposta da IA";
    }

    if (hasMessages) {
      return `${messages.length} mensagens no historico`;
    }

    return "Pronto para criar";
  }, [hasMessages, isThinking, messages.length]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            <Sparkles size={16} />
            AI Studio
          </div>

          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            O que voce deseja criar hoje?
          </h1>

          <p className="mt-4 max-w-2xl text-slate-600">
            Descreva seu objetivo. O VendIAOS decide o fluxo, organiza o plano e prepara a proxima acao de marketing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
            {conversationStatus}
          </span>
          {hasMessages && (
            <button
              type="button"
              onClick={clearConversation}
              className="rounded-xl border border-slate-200 bg-white p-3 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="Limpar conversa"
            >
              <RotateCcw size={18} />
            </button>
          )}
        </div>
      </header>

      <AIConversation messages={messages} isThinking={isThinking} onAction={sendMessage} originProject={pendingSource} />

      {pendingSource && (
        <section className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Transformacao em andamento</p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              Origem: <span className="capitalize">{pendingSource.mode}</span> - {pendingSource.title}
            </p>
          </div>

          <Link
            href={`/projects/${encodeURIComponent(pendingSource.id)}`}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <ExternalLink size={14} />
            Ver projeto
          </Link>
        </section>
      )}

      <AIInput value={prompt} onChange={setPrompt} onSubmit={() => sendMessage(prompt)} disabled={isThinking} />

      {!hasMessages && <PromptSuggestions onSelect={sendMessage} />}
      <RecentProjects onOpen={openProject} />
    </div>
  );
}
