import { PROJECT_DOCUMENT_VERSION } from '@/constants/index.js';
import type { ProjectDocument } from '@/realtime/types.js';
import type { ProjectTemplate } from '@/projects/templates/types.js';

export const nodeTwoFile: ProjectTemplate = {
  id: 'node-two-file',
  name: 'Node two-file',
  description: 'index.js calls helper.js via CommonJS.',
  language: 'javascript',
  document: {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint: 'index.js',
    files: {
      'index.js': {
        language: 'javascript',
        content: `const { add } = require('./helper.js');

console.log(add(2, 3));
`,
      },
      'helper.js': {
        language: 'javascript',
        content: `function add(a, b) {
  return a + b;
}

module.exports = { add };
`,
      },
    },
  } satisfies ProjectDocument,
};
