import { PROJECT_DOCUMENT_VERSION } from '@/constants/index.js';
import type { ProjectDocument } from '@/realtime/types.js';
import type { ProjectTemplate } from '@/projects/templates/types.js';

export const pythonStarter: ProjectTemplate = {
  id: 'python-starter',
  name: 'Python starter',
  description: 'main.py imports greet from utils.py.',
  language: 'python',
  document: {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint: 'main.py',
    files: {
      'main.py': {
        language: 'python',
        content: `from utils import greet

print(greet("world"))
`,
      },
      'utils.py': {
        language: 'python',
        content: `def greet(name):
    return f"hello {name}"
`,
      },
    },
  } satisfies ProjectDocument,
};
