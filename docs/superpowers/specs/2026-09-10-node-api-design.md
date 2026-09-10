# Node API Design

## Goal

Provide a small Node.js HTTP service for the OCI LVL100 demo with a health endpoint and a simple HTML home page.

## Architecture

The service uses Node.js built-in `http` module, with no runtime dependencies. `src/server.js` exports a `createServer()` factory for tests and starts listening only when executed directly. Requests are routed by method and pathname.

## Endpoints

- `GET /health` responds with status `200`, content type `application/json`, and body `{\"status\":\"ok\"}`.
- `GET /` responds with status `200`, content type `text/html; charset=utf-8`, and a small HTML document identifying the OCI LVL100 API.
- All other paths respond with status `404` and JSON body `{\"error\":\"Not found\"}`.

## Configuration and operation

The executable server listens on `process.env.PORT` when it is set, otherwise port `3000`. `npm start` starts the server and `npm test` runs the Node built-in test runner.

## Testing

Tests start the exported server on an ephemeral local port and make real HTTP requests. They assert response status, content type, and body for `GET /health` and `GET /`.

## Constraints

- Use CommonJS and Node.js built-in modules only.
- Do not add external dependencies.
- Keep HTML inline because the page is intentionally static and minimal.
