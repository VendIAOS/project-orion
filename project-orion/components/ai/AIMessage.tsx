"use client";

import { Bot, UserRound } from "lucide-react";
import AIMessageActions, { type ProjectOrigin } from "./AIMessageActions";

export type AIMessageRole = "user" | "assistant";

export interface AIMessageData {
  id: string;
  role: AIMessageRole;
  content: string;
  createdAt: string;
}

interface AIMessageProps {
  message: AIMessageData;
  onAction?: (prompt: string) => void;
  originProject?: ProjectOrigin | null;
}

export default function AIMessage({ message, onAction, originProject }: AIMessageProps) {
  const isUser = message.role === "user";
  const sentAt = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(message.createdAt));

  return (
    <article className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Bot size={18} />
        </div>
      )}

      <div className={`flex max-w-[78%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm whitespace-pre-line ${
            isUser
              ? "rounded-tr-md bg-blue-600 text-white"
              : "rounded-tl-md border border-slate-200 bg-white text-slate-800"
          }`}
        >
          {message.content}
        </div>
        <span className="mt-1 text-xs text-slate-400">{sentAt}</span>
        {!isUser && onAction && <AIMessageActions content={message.content} onAction={onAction} originProject={originProject} />}
      </div>

      {isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
          <UserRound size={18} />
        </div>
      )}
    </article>
  );
}
