"use client";

import { FormEvent, KeyboardEvent } from "react";
import { ArrowUp, Paperclip } from "lucide-react";

interface AIInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function AIInput({ value, onChange, onSubmit, disabled = false }: AIInputProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/70">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ex: Crie uma campanha de lancamento para um produto de IA para pequenos negocios..."
        rows={4}
        className="w-full resize-none border-0 bg-transparent p-2 text-base text-slate-900 outline-none placeholder:text-slate-400"
      />

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <button
          type="button"
          aria-label="Adicionar anexo"
          className="rounded-xl p-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Paperclip size={20} />
        </button>

        <button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label="Enviar mensagem"
          className="rounded-xl bg-blue-600 p-3 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <ArrowUp size={20} />
        </button>
      </div>
    </form>
  );
}
