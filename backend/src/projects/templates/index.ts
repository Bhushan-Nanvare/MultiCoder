import { cppStarter } from '@/projects/templates/cppStarter.js';
import { javascriptStarter } from '@/projects/templates/javascriptStarter.js';
import { nodeTwoFile } from '@/projects/templates/nodeTwoFile.js';
import { pythonStarter } from '@/projects/templates/pythonStarter.js';
import type {
  ProjectTemplate,
  ProjectTemplateId,
  ProjectTemplateSummary,
} from '@/projects/templates/types.js';
import { createEmptyProjectDocument, validateProjectDocument } from '@/realtime/documentHelpers.js';
import type { ProjectDocument } from '@/realtime/types.js';
import type { SupportedLanguage } from '@/constants/index.js';
import { ValidationError } from '@/utils/errors.js';

export {
  PROJECT_TEMPLATE_IDS,
  type ProjectTemplateId,
  type ProjectTemplateSummary,
} from '@/projects/templates/types.js';

const TEMPLATES: readonly ProjectTemplate[] = [
  javascriptStarter,
  pythonStarter,
  nodeTwoFile,
  cppStarter,
];

for (const template of TEMPLATES) {
  validateProjectDocument(template.document);
}

const BY_ID = new Map<string, ProjectTemplate>(TEMPLATES.map((template) => [template.id, template]));

export function listProjectTemplates(): ProjectTemplateSummary[] {
  return TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    language: template.language,
    entryPoint: template.document.entryPoint,
    fileCount: Object.keys(template.document.files).length,
  }));
}

export function cloneProjectDocument(doc: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(doc)) as ProjectDocument;
}

export function projectDocumentForNewRoom(
  language: SupportedLanguage,
  templateId?: ProjectTemplateId,
): { language: SupportedLanguage; document: ProjectDocument } {
  if (!templateId) {
    return { language, document: createEmptyProjectDocument(language) };
  }

  const template = BY_ID.get(templateId);
  if (!template) {
    throw new ValidationError(`Unknown template "${templateId}"`);
  }

  return {
    language: template.language,
    document: cloneProjectDocument(template.document),
  };
}
