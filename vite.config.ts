import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleApi } from './server/nasa';

/**
 * En desarrollo, sirve /api/* con el mismo código que las funciones de Vercel.
 * La clave se lee de .env (NASA_API_KEY, SIN prefijo VITE_) y nunca llega al navegador.
 */
function nasaApi(apiKey: string): Plugin {
  const middleware = async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    if (!url.pathname.startsWith('/api/')) return next();
    const { status, body } = await handleApi(route, url.searchParams, apiKey);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  return {
    name: 'nasa-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // Rutas relativas: el build funciona en GitHub Pages, Vercel, itch.io o un USB.
    base: './',
    plugins: [nasaApi(env.NASA_API_KEY || 'DEMO_KEY')],
    server: { host: true },
    build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  };
});
