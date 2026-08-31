import { PROJECT_DOCUMENT_VERSION } from '@/constants/index.js';
import type { ProjectDocument } from '@/realtime/types.js';
import type { ProjectTemplate } from '@/projects/templates/types.js';

/** Single-file: Piston compiles the entry file only. */
export const cppStarter: ProjectTemplate = {
  id: 'cpp-starter',
  name: 'C++ starter',
  description: 'A runnable main.cpp (Piston compiles the entry file).',
  language: 'cpp',
  document: {
    version: PROJECT_DOCUMENT_VERSION,
    entryPoint: 'main.cpp',
    files: {
      'main.cpp': {
        language: 'cpp',
        content: `#include <iostream>

int main() {
  std::cout << "hello world" << std::endl;
  return 0;
}
`,
      },
    },
  } satisfies ProjectDocument,
};
