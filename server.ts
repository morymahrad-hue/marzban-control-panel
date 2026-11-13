import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { URL } from 'node:url';
import express, { type Request, type Response } from 'express';

const PORT = 3000;
const HOST = '0.0.0.0';

interface ProxyRequestBody {
  targetUrl?: string;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  formBody?: Record<string, string>;
  allowInsecureTls?: boolean;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  // Block loopback 127.0.0.0/8 and cloud metadata 169.254.0.0/16
  if (lower.startsWith('127.') || lower.startsWith('169.254.')) {
    return true;
  }

  return false;
}

function forwardRequest(
  fullUrl: URL,
  method: string,
  headers: Record<string, string>,
  payload: string | undefined,
  allowInsecureTls: boolean
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = fullUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options: https.RequestOptions = {
      protocol: fullUrl.protocol,
      hostname: fullUrl.hostname,
      port: fullUrl.port || (isHttps ? 443 : 80),
      path: `${fullUrl.pathname}${fullUrl.search}`,
      method,
      headers,
      timeout: 15000,
    };

    if (isHttps && allowInsecureTls) {
      options.rejectUnauthorized = false;
    }

    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 502,
          headers: res.headers,
          rawBody: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out after 15 seconds'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (payload !== undefined && method !== 'GET' && method !== 'HEAD') {
      req.write(payload);
    }
    req.end();
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.post('/api/proxy', async (req: Request, res: Response) => {
    try {
      const {
        targetUrl,
        path: apiPath = '/',
        method = 'GET',
        headers = {},
        body,
        formBody,
        allowInsecureTls = false,
      } = (req.body || {}) as ProxyRequestBody;

      if (!targetUrl || typeof targetUrl !== 'string') {
        res.status(400).json({ detail: 'Missing targetUrl' });
        return;
      }

      let base: URL;
      try {
        base = new URL(targetUrl.trim());
      } catch {
        res.status(400).json({ detail: 'Invalid Marzban server URL format' });
        return;
      }

      if (base.protocol !== 'http:' && base.protocol !== 'https:') {
        res.status(400).json({ detail: 'Only http:// and https:// URLs are supported' });
        return;
      }

      if (isBlockedHostname(base.hostname)) {
        res.status(403).json({ detail: 'Target host is not permitted' });
        return;
      }

      const cleanBasePath = base.pathname.replace(/\/+$/, '');
      const cleanRelPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
      const fullUrl = new URL(`${base.origin}${cleanBasePath}${cleanRelPath}`);

      const outboundHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        const lower = k.toLowerCase();
        if (lower === 'host' || lower === 'content-length') continue;
        if (typeof v === 'string') outboundHeaders[k] = v;
      }

      let payload: string | undefined;
      if (formBody && typeof formBody === 'object') {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(formBody)) {
          params.set(k, v);
        }
        payload = params.toString();
        outboundHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        outboundHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
      } else if (body !== undefined) {
        payload = typeof body === 'string' ? body : JSON.stringify(body);
        if (!outboundHeaders['Content-Type']) {
          outboundHeaders['Content-Type'] = 'application/json';
        }
        outboundHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
      }

      const upstream = await forwardRequest(
        fullUrl,
        method.toUpperCase(),
        outboundHeaders,
        payload,
        Boolean(allowInsecureTls)
      );

      let parsed: unknown = upstream.rawBody;
      const contentType = String(upstream.headers['content-type'] || '');
      if (contentType.includes('application/json') || upstream.rawBody.trim().startsWith('{') || upstream.rawBody.trim().startsWith('[')) {
        try {
          parsed = JSON.parse(upstream.rawBody);
        } catch {
          parsed = upstream.rawBody;
        }
      }

      res.status(200).json({
        ok: upstream.status >= 200 && upstream.status < 300,
        status: upstream.status,
        data: parsed,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upstream connection failed';
      res.status(502).json({
        ok: false,
        status: 502,
        detail: message,
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Marzban Control Panel server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
