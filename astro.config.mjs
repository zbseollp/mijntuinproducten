import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { remarkStripFeaturedDuplicate } from './scripts/remark-strip-featured-duplicate.mjs';

const remarkPlugins = [remarkStripFeaturedDuplicate];

export default defineConfig({
  trailingSlash: 'always',
  site: 'https://mijntuinproducten.nl',
  // Broken relative/encoded paths (spaces + dash) must land on the real post.
  redirects: {
    '/hoe-vergroen-je-jouw-border/%20%20-': '/hoe-vergroen-je-jouw-border/',
    '/hoe-vergroen-je-jouw-border/%20%20-/': '/hoe-vergroen-je-jouw-border/',
    '/hoe-vergroen-je-jouw-border/  -': '/hoe-vergroen-je-jouw-border/',
    '/hoe-vergroen-je-jouw-border/  -/': '/hoe-vergroen-je-jouw-border/',
  },
  integrations: [
    mdx({
      remarkPlugins,
    }),
    sitemap(),
  ],
  markdown: {
    remarkPlugins,
  },
});
