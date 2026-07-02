import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
// Gruvbox prism-react-renderer theme (CJS) — see src/css/prism-gruvbox.js
import gruvboxTheme from './src/css/prism-gruvbox.js';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Prisma AIRS Codex Hooks',
  tagline: 'Prisma AIRS security scanning for the Codex CLI agentic loop',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://cdot65.github.io',
  baseUrl: '/prisma-airs-codex-hooks/',

  organizationName: 'cdot65',
  projectName: 'prisma-airs-codex-hooks',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/cdot65/prisma-airs-codex-hooks/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/logo.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Prisma AIRS Codex Hooks',
      logo: {
        alt: 'Prisma AIRS Codex Hooks Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/cdot65/prisma-airs-codex-hooks',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting Started', to: '/getting-started/installation'},
            {label: 'Codex Hooks API', to: '/reference/codex-hooks-api'},
          ],
        },
        {
          title: 'Resources',
          items: [
            {label: 'Codex Hooks Reference', href: 'https://developers.openai.com/codex/hooks'},
            {label: 'Prisma AIRS API', href: 'https://pan.dev/airs/'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/cdot65/prisma-airs-codex-hooks'},
            {label: 'npm', href: 'https://www.npmjs.com/package/@cdot65/prisma-airs-codex-hooks'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} cdot65. Built with Docusaurus.`,
    },
    prism: {
      theme: gruvboxTheme,
      darkTheme: gruvboxTheme,
      additionalLanguages: ['bash', 'json', 'toml', 'diff'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
