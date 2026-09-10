const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');

let server;
let baseUrl;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function request(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${pathname}`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, headers: response.headers, body }));
    }).on('error', reject);
  });
}

test('GET /health returns an OK JSON payload', async () => {
  const response = await request('/health');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
});

test('GET / returns the OCI LVL100 HTML page', async () => {
  const response = await request('/');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^text\/html/);
  assert.match(response.body, /OCI LVL100 API/);
});
