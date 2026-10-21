import { createApp } from './server.js';

const port = Number(process.env.API_PORT ?? 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('API_PORT must be an unprivileged port');
const app = createApp({ companionOrigin: process.env.BEACON_COMPANION_ORIGIN, extensionOrigins: process.env.BEACON_EXTENSION_ORIGINS?.split(',').filter(Boolean), kid: { apiKey: process.env.KID_API_KEY, baseUrl: process.env.KID_API_BASE_URL } });
app.requestTimeout = 10_000;
app.headersTimeout = 10_000;
app.listen(port, '127.0.0.1', () => console.log(`Ozone Layer demo API: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { app.close(); app.closeAllConnections(); });
