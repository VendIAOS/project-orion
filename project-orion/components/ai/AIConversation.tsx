"use client";

import { Bot, Loader2 } from "lucide-react";
import AIMessage, { AIMessageData } from "./AIMessage";
import type { ProjectOrigin } from "./AIMessageActions";

interface AIConversationProps {
  messages: AIMessageData[];
  isThinking: boolean;
  onAction: (prompt: string) => void;
  originProject?: ProjectOrigin | null;
}

export default function AIConversation({ messages, isThinking, onAction, originProject }: AIConversationProps) {
  if (messages.length === 0) {
    return (
      <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Bot size={24} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Seu copiloto de marketing esta pronto</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Informe o objetivo, publico e canal. O VendIAOS vai organizar a proxima acao como um fluxo de campanha.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-72 flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      {messages.map((message) => (
        <AIMessage key={message.id} message={message} onAction={onAction} originProject={originProject} />
      ))}

      {isThinking && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Loader2 size={18} className="animate-spin" />
          </div>
          VendIAOS esta estruturando a resposta...
        </div>
      )}
    </section>
  );
}
