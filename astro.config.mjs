import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://courtspeed.com',
  output: 'static',
  build: { format: 'directory' },
});
