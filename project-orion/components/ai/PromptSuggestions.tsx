"use client";

import { BarChart3, Bot, ImageIcon, Megaphone, Route, Video } from "lucide-react";

const suggestions = [
  {
    title: "Campanha",
    prompt: "Crie uma campanha de Instagram para vender um produto digital de marketing com IA.",
    icon: Megaphone,
  },
  {
    title: "Video",
    prompt: "Gere um roteiro de video curto para apresentar o VendIAOS em 45 segundos.",
    icon: Video,
  },
  {
    title: "Imagem",
    prompt: "Crie um prompt de imagem para um criativo premium do VendIAOS em formato Instagram.",
    icon: ImageIcon,
  },
  {
    title: "Avatar",
    prompt: "Monte um roteiro para avatar apresentar o VendIAOS como sistema operacional de marketing com IA.",
    icon: Bot,
  },
  {
    title: "Analise",
    prompt: "Analise uma estrategia para vender o VendIAOS para pequenos negocios e priorize oportunidades.",
    icon: BarChart3,
  },
  {
    title: "Funil",
    prompt: "Desenhe um funil completo para captar leads e vender uma assinatura do VendIAOS.",
    icon: Route,
  },
];

interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void;
}

export default function PromptSuggestions({ onSelect }: PromptSuggestionsProps) {
  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Comece com uma sugestao
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon;

          return (
            <button
              key={suggestion.title}
              type="button"
              onClick={() => onSelect(suggestion.prompt)}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                <Icon size={19} />
              </span>
              <span>
                <span className="block font-semibold text-slate-900">{suggestion.title}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">{suggestion.prompt}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
