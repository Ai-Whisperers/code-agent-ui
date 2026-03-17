# Code Agent UI

React-based management UI for [Code Agent](../code-agent), built with Vite + TanStack Router/Query/Store and styled to match the web-platform design system.

## Requirements

- Node 20+
- A running [Code Agent](../code-agent) backend
- A Keycloak instance with a `code-agent` realm and `code-agent-ui` client configured

## Getting started

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173.

## Environment variables

Copy `.env.development` and adjust:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Code Agent backend URL |
| `VITE_KEYCLOAK_URL` | Keycloak base URL |
| `VITE_KEYCLOAK_REALM` | Keycloak realm name |
| `VITE_KEYCLOAK_CLIENT_ID` | Keycloak client ID for this SPA |

## Local dev with Docker

Start PostgreSQL (for the backend):

```bash
docker compose up postgres
```

## Production build

```bash
npm run build
```

Static files are in `dist/`. Serve with nginx using the included `nginx.conf`.

## Docker

```bash
docker build \
  --build-arg VITE_API_URL=https://your-api \
  --build-arg VITE_KEYCLOAK_URL=https://your-keycloak \
  --build-arg VITE_KEYCLOAK_REALM=code-agent \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=code-agent-ui \
  -t code-agent-ui .

docker run -p 3000:80 code-agent-ui
```
