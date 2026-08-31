import { PROJECT_DOCUMENT_VERSION } from '@/constants/index.js';
import type { ProjectDocument } from '@/realtime/types.js';
import type { ProjectTemplate } from '@/projects/templates/types.js';

export const javascriptStarter: ProjectTemplate = {
  id: 'javascript-starter',
  name: 'JavaScript starter',
  description: 'main.js + utils.js using CommonJS (works with Run project).',
  language: 'javascript',
  document: {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint: 'main.js',
    files: {
      'main.js': {
        language: 'javascript',
        content: `const { greet } = require('./utils.js');

console.log(greet('world'));
`,
      },
      'utils.js': {
        language: 'javascript',
        content: `function greet(name) {
  return 'hello ' + name;
}

module.exports = { greet };
`,
      },
    },
  } satisfies ProjectDocument,
};
