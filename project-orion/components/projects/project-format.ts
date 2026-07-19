export function getProjectObjective(content: string) {
  return content.match(/OBJETIVO INTERPRETADO:\s*([^\n]+)/i)?.[1]?.trim() ?? content.replace(/\s+/g, " ").slice(0, 140);
}

export function getProjectArtifact(content: string) {
  return content.match(/ARTEFATO INICIAL:\s*([\s\S]*?)(?:\n\nPROXIMA ACAO:|$)/i)?.[1]?.trim() ?? content.slice(0, 220);
}

export function getProjectNextAction(content: string) {
  return content.match(/PROXIMA ACAO:\s*([\s\S]*)$/i)?.[1]?.trim() ?? null;
}

export function formatProjectDate(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}
