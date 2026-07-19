import type { ArtifactType, ProjectMode } from "./vendiaos-types";

const validModes = ["campanha", "video", "imagem", "avatar", "analise", "funil"] as const;

export function normalizeProjectMode(mode: string): ProjectMode {
  const normalizedMode = mode.trim().toLowerCase();

  if (validModes.some((validMode) => validMode === normalizedMode)) {
    return normalizedMode as ProjectMode;
  }

  return "campanha";
}

export function getProjectObjective(content: string) {
  return content.match(/OBJETIVO INTERPRETADO:\s*([^\n]+)/i)?.[1]?.trim() ?? content.replace(/\s+/g, " ").slice(0, 140);
}

export function getProjectTitle(content: string) {
  const objective = getProjectObjective(content);

  return objective.length > 96 ? `${objective.slice(0, 93)}...` : objective;
}

export function detectArtifactType(mode: ProjectMode): ArtifactType {
  if (mode === "video") {
    return "script";
  }

  if (mode === "imagem") {
    return "image_prompt";
  }

  if (mode === "funil") {
    return "funnel_map";
  }

  if (mode === "analise") {
    return "analysis_report";
  }

  if (mode === "campanha") {
    return "campaign_plan";
  }

  return "other";
}
