import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV, process.cwd(), '');

export default defineConfig({
  output: 'server',
  integrations: [tailwind()],
  adapter: vercel(),
  vite: {
    define: {
      'process.env.MONGODB_URI': JSON.stringify(env.MONGODB_URI),
      'process.env.JWT_SECRET': JSON.stringify(env.JWT_SECRET),
      'process.env.PUBLIC_SITE_URL': JSON.stringify(env.PUBLIC_SITE_URL),
      'process.env.SMTP_HOST': JSON.stringify(env.SMTP_HOST),
      'process.env.SMTP_PORT': JSON.stringify(env.SMTP_PORT),
      'process.env.SMTP_SECURE': JSON.stringify(env.SMTP_SECURE),
      'process.env.SMTP_USER': JSON.stringify(env.SMTP_USER),
      'process.env.SMTP_PASS': JSON.stringify(env.SMTP_PASS),
      'process.env.SMTP_FROM': JSON.stringify(env.SMTP_FROM),
    },
  },
});
