import { getAuthHeaders } from "@/components/auth/auth-fetch";

export interface SavedProject {
  id: string;
  mode: string;
  content: string;
  createdAt: string;
  archivedAt?: string;
  originProjectId?: string;
  originProjectMode?: string;
  originProjectTitle?: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  reason: "edit" | "restore";
}

interface ProjectsResponse {
  projects?: SavedProject[];
  source?: "supabase" | "local-fallback";
  permissions?: {
    role: string;
    canRestoreProjects: boolean;
  };
}

interface SaveProjectResponse {
  project?: SavedProject;
  source?: "supabase" | "local-fallback";
}

interface PersistOptions {
  notify?: boolean;
}

export const PROJECTS_KEY = "vendiaos.projects";
export const PROJECT_VERSIONS_KEY = "vendiaos.project-versions";

export function loadLocalProjects() {
  try {
    return JSON.parse(window.localStorage.getItem(PROJECTS_KEY) ?? "[]") as SavedProject[];
  } catch {
    window.localStorage.removeItem(PROJECTS_KEY);
    return [];
  }
}

export function persistLocalProjects(projects: SavedProject[], options: PersistOptions = {}) {
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects.slice(0, 50)));

  if (options.notify ?? true) {
    window.dispatchEvent(new Event("vendiaos:projects-updated"));
  }
}

export function loadProjectVersions(projectId: string) {
  try {
    const versions = JSON.parse(window.localStorage.getItem(PROJECT_VERSIONS_KEY) ?? "[]") as ProjectVersion[];

    return versions
      .filter((version) => version.projectId === projectId)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  } catch {
    window.localStorage.removeItem(PROJECT_VERSIONS_KEY);
    return [];
  }
}

function loadAllProjectVersions() {
  try {
    return JSON.parse(window.localStorage.getItem(PROJECT_VERSIONS_KEY) ?? "[]") as ProjectVersion[];
  } catch {
    window.localStorage.removeItem(PROJECT_VERSIONS_KEY);
    return [];
  }
}

function saveProjectVersion(project: SavedProject, reason: ProjectVersion["reason"]) {
  const versions = loadAllProjectVersions();
  const version: ProjectVersion = {
    id: `version-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    projectId: project.id,
    content: project.content,
    createdAt: new Date().toISOString(),
    reason,
  };

  const nextVersions = [version, ...versions].slice(0, 100);
  window.localStorage.setItem(PROJECT_VERSIONS_KEY, JSON.stringify(nextVersions));

  return version;
}

function mergeProjects(primary: SavedProject[], secondary: SavedProject[]) {
  const projectsById = new Map<string, SavedProject>();

  [...primary, ...secondary].forEach((project) => {
    projectsById.set(project.id, project);
  });

  return Array.from(projectsById.values()).sort((first, second) => {
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function loadSyncedProjects() {
  const localProjects = loadLocalProjects();

  try {
    const response = await fetch("/api/projects", {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        projects: localProjects,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as ProjectsResponse;

    if (data.source !== "supabase") {
      return {
        projects: localProjects,
        source: "local" as const,
      };
    }

    const serverProjects = data.projects ?? [];
    const projects = mergeProjects(serverProjects, localProjects);
    persistLocalProjects(projects, { notify: false });

    return {
      projects,
      source: "supabase" as const,
    };
  } catch {
    return {
      projects: localProjects,
      source: "local" as const,
    };
  }
}

export async function loadArchivedProjects() {
  try {
    const response = await fetch("/api/projects?status=archived", {
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        projects: [],
        canRestoreProjects: false,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as ProjectsResponse;

    if (data.source !== "supabase") {
      return {
        projects: [],
        canRestoreProjects: false,
        source: "local" as const,
      };
    }

    return {
      projects: data.projects ?? [],
      canRestoreProjects: data.permissions?.canRestoreProjects ?? false,
      source: "supabase" as const,
    };
  } catch {
    return {
      projects: [],
      canRestoreProjects: false,
      source: "local" as const,
    };
  }
}

export async function restoreArchivedProject(projectId: string) {
  if (!isUuid(projectId)) {
    return {
      project: null,
      source: "local" as const,
    };
  }

  try {
    const response = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        action: "restore",
      }),
    });

    if (!response.ok) {
      return {
        project: null,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as SaveProjectResponse;

    if (data.source !== "supabase" || !data.project) {
      return {
        project: null,
        source: "local" as const,
      };
    }

    return {
      project: data.project,
      source: "supabase" as const,
    };
  } catch {
    return {
      project: null,
      source: "local" as const,
    };
  }
}

export async function deleteSyncedProject(projectId: string, nextProjects: SavedProject[]) {
  persistLocalProjects(nextProjects);

  if (!isUuid(projectId)) {
    return {
      source: "local" as const,
    };
  }

  try {
    const response = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return {
        source: "local" as const,
      };
    }

    return {
      source: "supabase" as const,
    };
  } catch {
    return {
      source: "local" as const,
    };
  }
}

export async function updateSyncedProject(
  projectId: string,
  content: string,
  currentProjects: SavedProject[],
  options: { saveVersion?: boolean; versionReason?: ProjectVersion["reason"] } = {},
) {
  const currentProject = currentProjects.find((project) => project.id === projectId);

  if (!currentProject) {
    return {
      project: null,
      projects: currentProjects,
      source: "local" as const,
    };
  }

  if (options.saveVersion ?? true) {
    saveProjectVersion(currentProject, options.versionReason ?? "edit");
  }

  const localProject: SavedProject = {
    ...currentProject,
    content,
  };

  let nextProjects = currentProjects.map((project) => (project.id === projectId ? localProject : project));
  persistLocalProjects(nextProjects);

  if (!isUuid(projectId)) {
    return {
      project: localProject,
      projects: nextProjects,
      source: "local" as const,
    };
  }

  try {
    const response = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: getAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        mode: currentProject.mode,
        content,
      }),
    });

    if (!response.ok) {
      return {
        project: localProject,
        projects: nextProjects,
        source: "local" as const,
      };
    }

    const data = (await response.json()) as SaveProjectResponse;

    if (data.source !== "supabase" || !data.project) {
      return {
        project: localProject,
        projects: nextProjects,
        source: "local" as const,
      };
    }

    nextProjects = currentProjects.map((project) => (project.id === projectId ? data.project! : project));
    persistLocalProjects(nextProjects);

    return {
      project: data.project,
      projects: nextProjects,
      source: "supabase" as const,
    };
  } catch {
    return {
      project: localProject,
      projects: nextProjects,
      source: "local" as const,
    };
  }
}

export async function syncLocalProjectsToServer() {
  const localProjects = loadLocalProjects();
  const alreadySynced = localProjects.filter((project) => isUuid(project.id));
  const pendingProjects = localProjects.filter((project) => !isUuid(project.id));

  if (pendingProjects.length === 0) {
    const result = await loadSyncedProjects();

    return {
      ...result,
      syncedCount: 0,
      failedCount: 0,
    };
  }

  const syncedProjects: SavedProject[] = [];
  const failedProjects: SavedProject[] = [];

  for (const project of pendingProjects) {
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: project.mode,
          content: project.content,
          originProjectId: project.originProjectId,
          originProjectMode: project.originProjectMode,
          originProjectTitle: project.originProjectTitle,
        }),
      });

      if (!response.ok) {
        failedProjects.push(project);
        continue;
      }

      const data = (await response.json()) as SaveProjectResponse;

      if (data.source !== "supabase" || !data.project) {
        failedProjects.push(project);
        continue;
      }

      syncedProjects.push(data.project);
    } catch {
      failedProjects.push(project);
    }
  }

  const nextProjects = mergeProjects([...syncedProjects, ...alreadySynced], failedProjects);
  persistLocalProjects(nextProjects);

  return {
    projects: nextProjects,
    source: syncedProjects.length > 0 ? ("supabase" as const) : ("local" as const),
    syncedCount: syncedProjects.length,
    failedCount: failedProjects.length,
  };
}

