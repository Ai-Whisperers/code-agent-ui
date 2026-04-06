# Code Agent UI

React-based management UI for [Code Agent](../code-agent), built with Vite + TanStack Router/Query/Store and styled to match the web-platform design system.

## Technology Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7.3 with Hot Module Replacement
- **Routing**: TanStack Router v1.167 with file-based routing
- **State Management**: TanStack Query v5.90 + TanStack Store v0.9
- **Authentication**: Keycloak JS v26.2 integration
- **Styling**: Tailwind CSS v4.2 with custom CSS variables
- **Testing**: Vitest v4.1 with React Testing Library
- **Charts**: Chart.js v4.5 with React integration
- **Markdown**: React Markdown v10.1 with syntax highlighting
- **Diagrams**: Mermaid v11.13 for flowcharts and diagrams

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

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Code Agent backend URL | `http://localhost:5173/api` |
| `VITE_KEYCLOAK_URL` | Keycloak base URL | - |
| `VITE_KEYCLOAK_REALM` | Keycloak realm name | `code-agent` |
| `VITE_KEYCLOAK_CLIENT_ID` | Keycloak client ID for this SPA | `code-agent-ui` |
| `VITE_KEYCLOAK_IDP_HINT` | Identity provider hint for SSO | - |
| `VITE_BITBUCKET_URL` | Bitbucket base URL for repository links | `https://bitbucket.org` |

## Application Features

### Core Functionality
- **Dashboard**: Overview of jobs, metrics, and system status
- **Jobs Management**: Create, monitor, and manage code analysis and fix jobs
- **Execution Plans**: Multi-phase execution plans with approval workflows
- **Chat Interface**: Interactive AI assistant with markdown and Mermaid diagram support
- **Repository Settings**: Configure automation, hooks, and repository-specific settings

### Metrics & Reporting
- **Quality Reports**: Code coverage, linting, security (Aikido), and complexity metrics
- **Review Metrics**: PR review quality and resolution tracking
- **Developer Scorecard**: Individual developer performance metrics
- **AI Statistics**: Token usage, cost tracking, and model performance
- **SOC II Compliance**: Audit trail and compliance reporting

### Administration
- **Automation Hooks**: Event-driven automation with filtering and custom actions
- **Prompt Templates**: Manage AI prompt templates and overrides
- **Memory Management**: Persistent knowledge and context management
- **Customer Registry**: Multi-tenant customer and product configuration
- **Knowledge Index**: Documentation and knowledge base management
- **System Settings**: Application-wide configuration and maintenance
- **Audit Logs**: Comprehensive activity and webhook audit trails

### Scopes (Role-based)
- **Scope Management**: Project scope tracking and planning (requires `VIEW_SCOPE` permission)
- **Roadmap Planning**: Feature and sprint planning with Gantt views

## REST API Endpoints

The application interfaces with the Code Agent backend through these endpoint categories:

### Jobs & Execution
- `GET /api/jobs` - List jobs with filtering and pagination
- `POST /api/jobs/fix` - Create fix jobs
- `POST /api/jobs/review` - Create review jobs
- `GET /api/jobs/{id}` - Job details and status
- `PUT /api/jobs/{id}/approve` - Approve pending jobs
- `PUT /api/jobs/{id}/reject` - Reject jobs with reason

### Plans & Roadmaps
- `GET /api/plans` - List execution plans
- `POST /api/plans` - Create new plans
- `GET /api/plans/{id}` - Plan details with phases and steps
- `PUT /api/plans/{id}/approve` - Approve draft plans
- `PUT /api/plans/{id}/execute` - Start plan execution
- `GET /api/roadmaps` - List roadmaps
- `GET /api/scopes` - List project scopes (role-restricted)

### Repository Management
- `GET /api/repos` - List repository settings
- `PUT /api/repos/{workspace}/{slug}` - Update repository configuration
- `GET /api/hooks` - List automation hooks
- `POST /api/hooks` - Create new hooks
- `PUT /api/hooks/{id}/toggle` - Enable/disable hooks

### Metrics & Analytics
- `GET /api/quality-reports` - Quality metrics by repository
- `GET /api/coverage/{workspace}/{slug}` - Detailed coverage data
- `GET /api/review-metrics` - PR review analytics
- `GET /api/developer-scorecard` - Developer performance metrics
- `GET /api/ai-stats` - AI usage statistics and costs

### Chat & AI
- `GET /api/chat/conversations` - List user conversations
- `POST /api/chat/conversations` - Create new conversation
- `POST /api/chat/conversations/{id}/messages` - Send message
- `GET /api/prompts` - List prompt templates
- `PUT /api/prompts/{key}` - Update prompt template

### Administration
- `GET /api/customers` - List customers (admin only)
- `POST /api/customers` - Create/update customers
- `GET /api/products` - List products
- `GET /api/memories` - List memory entries
- `POST /api/memories` - Create memory entries
- `GET /api/audit-log` - System audit trail
- `GET /api/webhook-audit` - Webhook event log

### Authentication & Authorization
Role-based access control with Keycloak integration:
- `app_admin`: Full system access
- `app_staff`: Limited administrative access
- `app_developer`: Developer-focused features
- View-only access for metrics and reports

## Development

### Local dev with Docker

Start PostgreSQL (for the backend):

```bash
docker compose up postgres
```

### Testing

Run the test suite:

```bash
npm test           # Run all tests
npm run test:watch # Watch mode for development
```

Tests include:
- Component unit tests with React Testing Library
- Hook and utility function tests
- Integration tests for key workflows
- Coverage reporting with V8

### Code Quality

- **Linting**: ESLint with React and TypeScript rules
- **Type Checking**: TypeScript strict mode
- **Formatting**: Prettier (configured via ESLint)
- **Import Management**: Absolute imports with `@/` alias

## Production build

```bash
npm run build
```

Static files are in `dist/`. Serve with nginx using the included `nginx.conf`.

### Production Configuration

The production build includes:
- Code splitting and tree shaking
- Asset optimization and compression
- Cache-busting for static assets
- Security headers via nginx configuration

## Docker

Multi-stage Docker build for production deployment:

```bash
docker build \
  --build-arg VITE_API_URL=https://your-api \
  --build-arg VITE_KEYCLOAK_URL=https://your-keycloak \
  --build-arg VITE_KEYCLOAK_REALM=code-agent \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=code-agent-ui \
  --build-arg VITE_KEYCLOAK_IDP_HINT=your-idp \
  --build-arg VITE_BITBUCKET_URL=https://bitbucket.org \
  -t code-agent-ui .

docker run -p 3000:80 code-agent-ui
```

### Nginx Configuration

The included `nginx.conf` provides:
- SPA routing fallback
- Static asset caching (1 year)
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Gzip compression support

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── chat/           # Chat interface components
│   ├── hooks/          # Automation hook components  
│   ├── layout/         # Application layout components
│   ├── navigation/     # Navigation and menu components
│   ├── plans/          # Execution plan components
│   ├── roadmap/        # Roadmap and scope components
│   ├── scope/          # Scope management components
│   └── ui/             # Base UI components (buttons, inputs, etc.)
├── config/             # Application configuration
├── lib/                # Utilities and API clients
├── pages/              # Route components
├── store/              # Global state management
├── styles/             # CSS and styling
├── test/               # Test setup and utilities
└── types/              # TypeScript type definitions
```

### Key Design Patterns

- **Component Composition**: Reusable UI components with consistent APIs
- **Custom Hooks**: Encapsulated business logic and API interactions  
- **Route Guards**: Role-based access control at the route level
- **Error Boundaries**: Graceful error handling and user feedback
- **Optimistic Updates**: Immediate UI feedback with rollback on errors
- **Infinite Queries**: Efficient pagination for large datasets

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update type definitions for API changes
4. Ensure all tests pass before submitting PRs
5. Use semantic commit messages

## Browser Support

- Modern browsers with ES2022 support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- No Internet Explorer support