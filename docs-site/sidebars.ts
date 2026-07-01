import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// Mirrors the former mkdocs nav tree.
const sidebars: SidebarsConfig = {
  docs: [
    'index',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/configuration',
        'getting-started/quick-start',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/scanning-flow',
        'architecture/design-decisions',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/detection-services',
        'features/code-extraction',
        'features/circuit-breaker',
        'features/dlp-masking',
        'features/logging',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/configuration',
        'reference/environment-variables',
        'reference/cli-commands',
        'reference/codex-hooks-api',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      items: ['development/contributing', 'development/testing'],
    },
    {
      type: 'category',
      label: 'About',
      items: ['about/release-notes', 'about/license'],
    },
  ],
};

export default sidebars;
