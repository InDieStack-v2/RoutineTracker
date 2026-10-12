const { spawn } = require('child_process');
const http = require('http');

const expoPort = 8082;
const webPort = 8081;

const expo = spawn(
  'pnpm',
  ['exec', 'expo', 'start', '--web', '--port', String(expoPort)],
  {
    stdio: 'inherit',
    env: { ...process.env, DARK_MODE: process.env.DARK_MODE || 'media' },
  },
);

const proxy = http.createServer((req, res) => {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: expoPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${expoPort}` },
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers };
      headers['cross-origin-embedder-policy'] = 'credentialless';
      headers['cross-origin-opener-policy'] = 'same-origin';
      res.writeHead(upstreamRes.statusCode || 500, headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Expo web server is not ready');
  });
  req.pipe(upstream);
});

proxy.listen(webPort, () => {
  console.log(`Web: http://localhost:${webPort}`);
});

function stop() {
  proxy.close();
  expo.kill('SIGTERM');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
