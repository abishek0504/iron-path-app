/**
 * Dev log server: receives POST /log from the app (web) and prints to this Node process (terminal).
 * Run in a separate terminal: node scripts/dev-log-server.js
 * Then run the app; in __DEV__ on web, devLog/devError will POST here so logs appear in this terminal.
 */

const http = require('http');

const PORT = 3333;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { module: mod, payload: pl, level } = JSON.parse(body);
        const label = mod ? `[${mod}]` : '[app]';
        const data = pl != null ? pl : body;
        if (level === 'error') console.error(label, data);
        else if (level === 'warn') console.warn(label, data);
        else console.log(label, data);
      } catch {
        console.log('[app]', body);
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Dev log server: http://localhost:${PORT}/log (logs will appear here)`);
});
