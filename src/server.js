const http = require('node:http');

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function createServer() {
  return http.createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');

    if (request.method === 'GET' && pathname === '/health') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (request.method === 'GET' && pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OCI LVL100 API</title></head><body><h1>OCI LVL100 API</h1><p>The API is running.</p></body></html>');
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => console.log(`Server listening on port ${port}`));
}
