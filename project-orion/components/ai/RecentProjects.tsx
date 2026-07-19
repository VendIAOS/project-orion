"use client";

import { Clock, Database, FolderOpen, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  deleteSyncedProject,
  loadSyncedProjects,
  type SavedProject,
} from "./lib/projects-client";

interface RecentProjectsProps {
  onOpen: (project: SavedProject) => void;
}

function getSummary(content: string) {
  const objective = content.match(/OBJETIVO INTERPRETADO:\s*([^\n]+)/i)?.[1];

  if (objective) {
    return objective.trim();
  }

  return content.replace(/\s+/g, " ").slice(0, 120);
}

export default function RecentProjects({ onOpen }: RecentProjectsProps) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [projectSource, setProjectSource] = useState<"local" | "supabase">("local");

  useEffect(() => {
    async function syncProjects() {
      const result = await loadSyncedProjects();
      setProjects(result.projects);
      setProjectSource(result.source);
    }

    syncProjects();
    window.addEventListener("vendiaos:projects-updated", syncProjects);

    return () => {
      window.removeEventListener("vendiaos:projects-updated", syncProjects);
    };
  }, []);

  async function removeProject(projectId: string) {
    const nextProjects = projects.filter((project) => project.id !== projectId);
    setProjects(nextProjects);
    await deleteSyncedProject(projectId, nextProjects);
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Projetos salvos</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Continue de onde parou</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              projectSource === "supabase" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {projectSource === "supabase" ? <Database size={13} /> : <FolderOpen size={13} />}
            {projectSource === "supabase" ? "Supabase" : "Local"}
          </span>
          <FolderOpen size={20} className="text-blue-600" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {projects.slice(0, 4).map((project) => (
          <article key={project.id} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                {project.mode}
              </span>
              <button
                type="button"
                onClick={() => removeProject(project.id)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remover projeto salvo"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <p className="min-h-12 text-sm leading-6 text-slate-700">{getSummary(project.content)}</p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Clock size={13} />
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(project.createdAt))}
              </span>

              <button
                type="button"
                onClick={() => onOpen(project)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Abrir
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
