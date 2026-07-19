export type ProjectMode = "campanha" | "video" | "imagem" | "avatar" | "analise" | "funil";

export type ArtifactType =
  | "briefing"
  | "copy"
  | "script"
  | "image_prompt"
  | "campaign_plan"
  | "funnel_map"
  | "analysis_report"
  | "other";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingProject {
  id: string;
  workspaceId: string;
  createdBy: string;
  title: string;
  mode: ProjectMode;
  objective?: string;
  status: "draft" | "active" | "archived";
  source: "ai_studio" | "import" | "template" | string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  projectId?: string;
  createdBy: string;
  title: string;
  mode?: ProjectMode;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Artifact {
  id: string;
  workspaceId: string;
  projectId?: string;
  conversationId?: string;
  messageId?: string;
  createdBy: string;
  type: ArtifactType;
  mode: ProjectMode;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
