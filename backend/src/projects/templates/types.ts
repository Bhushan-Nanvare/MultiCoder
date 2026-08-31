import type { SupportedLanguage } from '@/constants/index.js';
import type { ProjectDocument } from '@/realtime/types.js';

export const PROJECT_TEMPLATE_IDS = [
  'javascript-starter',
  'python-starter',
  'node-two-file',
  'cpp-starter',
] as const;

export type ProjectTemplateId = (typeof PROJECT_TEMPLATE_IDS)[number];

export interface ProjectTemplate {
  id: ProjectTemplateId;
  name: string;
  description: string;
  language: SupportedLanguage;
  document: ProjectDocument;
}

export interface ProjectTemplateSummary {
  id: ProjectTemplateId;
  name: string;
  description: string;
  language: SupportedLanguage;
  entryPoint: string;
  fileCount: number;
}
