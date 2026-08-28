import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://fly0307.github.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
