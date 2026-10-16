import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Parse CLI port arguments or fallback to env / 3000
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const cliPort = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1], 10) : null;
const PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

app.use(express.json());

// Passkey verification endpoint - the passkey is kept on the server only
// The client HTML, JS, and CSS files NEVER have the plaintext passkey embedded
const PASSKEY = process.env.APP_PASSKEY || 'math/101';

app.post('/api/verify-passkey', (req, res) => {
  const { passkey } = req.body || {};
  if (!passkey || typeof passkey !== 'string') {
    return res.status(400).json({ success: false, message: 'Passkey is required.' });
  }

  if (passkey.trim() === PASSKEY) {
    const timestamp = Date.now();
    const token = Buffer.from(`session_${timestamp}_authorized`).toString('base64');
    return res.json({
      success: true,
      message: 'Access granted. Welcome to Math 101 Portal.',
      token,
      expiresAt: timestamp + 24 * 60 * 60 * 1000,
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Incorrect passkey. Access denied.',
  });
});

// Endpoint to retrieve games library JSON
app.get('/api/games', (_req, res) => {
  try {
    const gamesPath = path.resolve(__dirname, 'public', 'games.json');
    if (fs.existsSync(gamesPath)) {
      const data = fs.readFileSync(gamesPath, 'utf-8');
      return res.json(JSON.parse(data));
    }
    return res.status(404).json({ error: 'Games library not found' });
  } catch (err) {
    console.error('Error reading games.json:', err);
    return res.status(500).json({ error: 'Failed to load games' });
  }
});

// Always serve public directory for static game iframes and assets
app.use(express.static(path.resolve(__dirname, 'public')));

// Fallback alias for /main.jsx or /main.tsx
app.get('/main.jsx', (_req, res) => {
  res.redirect('/src/main.jsx');
});
app.get('/main.tsx', (_req, res) => {
  res.redirect('/src/main.jsx');
});
app.get('/src/main.tsx', (_req, res) => {
  res.redirect('/src/main.jsx');
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));

  if (!isProd || !hasDist) {
    // Development mode with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: __dirname,
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'custom',
    });

    // Vite development middlewares (handles /src/main.jsx, /@vite/client, etc.)
    app.use(vite.middlewares);

    // Serve transformed index.html for all non-API web requests
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url.startsWith('/games/')) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production mode
    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
