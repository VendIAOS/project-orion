"use client";

import { Check, Copy, Database, FilePlus2, ImageIcon, Layers3, Loader2, Megaphone, Video } from "lucide-react";
import { getAuthHeaders } from "@/components/auth/auth-fetch";
import { useMemo, useState } from "react";

type ActionType = "variations" | "campaign" | "video" | "image";

export interface ProjectOrigin {
  id: string;
  mode: string;
  title: string;
}

interface AIMessageActionsProps {
  content: string;
  onAction: (prompt: string) => void;
  originProject?: ProjectOrigin | null;
}

interface SavedProject {
  id: string;
  mode: string;
  content: string;
  createdAt: string;
  originProjectId?: string;
  originProjectMode?: string;
  originProjectTitle?: string;
}

interface SaveProjectResponse {
  project?: SavedProject;
  source?: "supabase" | "local-fallback";
}

function detectMode(content: string) {
  const match = content.match(/MODO ESCOLHIDO:\s*([^\n]+)/i);
  return match?.[1]?.trim().toLowerCase() ?? "campanha";
}

function createActionPrompt(action: ActionType, content: string) {
  const mode = detectMode(content);

  if (action === "variations") {
    return `Crie 5 variacoes melhores para este artefato em modo ${mode}, mantendo a estrategia central:\n\n${content}`;
  }

  if (action === "campaign") {
    return `Transforme este artefato em uma campanha completa com oferta, publico, canais, calendario, criativos e metricas:\n\n${content}`;
  }

  if (action === "video") {
    return `Transforme este artefato em um roteiro de video curto com gancho, cenas, narracao, B-roll e CTA:\n\n${content}`;
  }

  return `Transforme este artefato em prompts de imagem para 16:9, 1:1 e 9:16, com direcao visual e negative prompts:\n\n${content}`;
}

function applyOrigin(project: SavedProject, originProject?: ProjectOrigin | null): SavedProject {
  if (!originProject) {
    return project;
  }

  return {
    ...project,
    originProjectId: originProject.id,
    originProjectMode: originProject.mode,
    originProjectTitle: originProject.title,
  };
}

export default function AIMessageActions({ content, onAction, originProject }: AIMessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "supabase" | "local">("idle");

  const mode = useMemo(() => detectMode(content), [content]);

  async function copyContent() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function saveProjectLocally(project?: SavedProject) {
    const projects = JSON.parse(window.localStorage.getItem("vendiaos.projects") ?? "[]") as SavedProject[];

    const nextProject = applyOrigin(
      project ?? {
        id: `project-${Date.now()}`,
        mode,
        content,
        createdAt: new Date().toISOString(),
      },
      originProject,
    );

    projects.unshift(nextProject);

    window.localStorage.setItem("vendiaos.projects", JSON.stringify(projects.slice(0, 50)));
    window.dispatchEvent(new Event("vendiaos:projects-updated"));
  }

  async function saveProject() {
    if (saveState === "saving") {
      return;
    }

    setSaveState("saving");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          mode,
          content,
          originProjectId: originProject?.id,
          originProjectMode: originProject?.mode,
          originProjectTitle: originProject?.title,
        }),
      });

      if (!response.ok) {
        saveProjectLocally();
        setSaveState("local");
        window.setTimeout(() => setSaveState("idle"), 2200);
        return;
      }

      const data = (await response.json()) as SaveProjectResponse;
      saveProjectLocally(data.project);
      setSaveState(data.source === "supabase" ? "supabase" : "local");
      window.setTimeout(() => setSaveState("idle"), 2200);
    } catch {
      saveProjectLocally();
      setSaveState("local");
      window.setTimeout(() => setSaveState("idle"), 2200);
    }
  }

  const saveLabel = useMemo(() => {
    if (saveState === "saving") {
      return "Salvando";
    }

    if (saveState === "supabase") {
      return "Salvo no Supabase";
    }

    if (saveState === "local") {
      return "Salvo local";
    }

    return originProject ? "Salvar derivado" : "Salvar";
  }, [originProject, saveState]);

  const actions = [
    { label: "Variacoes", icon: Layers3, prompt: createActionPrompt("variations", content) },
    { label: "Campanha", icon: Megaphone, prompt: createActionPrompt("campaign", content) },
    { label: "Video", icon: Video, prompt: createActionPrompt("video", content) },
    { label: "Imagem", icon: ImageIcon, prompt: createActionPrompt("image", content) },
  ];

  return (
    <div className="mt-2 flex max-w-full flex-wrap gap-2">
      <button
        type="button"
        onClick={copyContent}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copiado" : "Copiar"}
      </button>

      <button
        type="button"
        onClick={saveProject}
        disabled={saveState === "saving"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        {saveState === "saving" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : saveState === "supabase" ? (
          <Database size={14} />
        ) : saveState === "local" ? (
          <Check size={14} />
        ) : (
          <FilePlus2 size={14} />
        )}
        {saveLabel}
      </button>

      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.label}
            type="button"
            onClick={() => onAction(action.prompt)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Icon size={14} />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

