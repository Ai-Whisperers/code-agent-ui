workspace "Code Agent UI" "C4 architecture model for the Code Agent front-end and its surrounding ecosystem." {

    model {

        // ── External actors ───────────────────────────────────────────────────

        developer = person "Developer" "Software engineer who runs fix/review/plan jobs, monitors PRs, and uses the AI chat assistant."
        administrator = person "Administrator" "Platform admin who manages settings, repositories, hooks, users, and the knowledge index."
        staffUser = person "Staff / QA" "Staff or QA team member who views scopes, security issues, roadmaps, and quality reports."

        // ── External systems ──────────────────────────────────────────────────

        keycloak = softwareSystem "Keycloak" "Identity and access management. Issues OIDC tokens and manages realm roles (app_admin, app_developer, app_staff, app_user)." {
            tags "External"
        }

        codeAgentBackend = softwareSystem "Code Agent Backend" "Quarkus REST API. Orchestrates AI jobs, manages repositories, stores data, and exposes all /api endpoints consumed by this UI." {
            tags "External"
        }

        anthropicAI = softwareSystem "Anthropic Claude" "Large-language-model API used by the backend for code analysis, fix generation, PR review, chat, and plan execution." {
            tags "External"
        }

        awsBedrock = softwareSystem "AWS Bedrock" "Managed embedding and re-ranking models (Cohere, Amazon Titan) used by the backend for semantic code search and knowledge indexing." {
            tags "External"
        }

        postgresDb = softwareSystem "PostgreSQL (pgvector)" "Relational database with vector extension. Stores jobs, plans, quality reports, AI call records, knowledge embeddings, and all agent state." {
            tags "External" "Database"
        }

        bitbucket = softwareSystem "Bitbucket" "Source-control platform. The agent clones repos, opens pull requests, and receives webhook events from Bitbucket." {
            tags "External"
        }

        gitPlatform = softwareSystem "Git Platform (Azure DevOps / GitLab / GitHub)" "Alternative source-control platforms supported via the configurable git.platform setting." {
            tags "External"
        }

        jira = softwareSystem "Jira" "Project-management system. Tickets trigger agent jobs via webhooks; the agent transitions issues and logs work. Jira projects are indexed into the knowledge base." {
            tags "External"
        }

        confluence = softwareSystem "Confluence" "Wiki used as a knowledge source. Spaces are indexed into the vector knowledge base and docs are synced by SYNC_CONFLUENCE jobs." {
            tags "External"
        }

        aikido = softwareSystem "Aikido Security" "Third-party software-composition-analysis platform. The backend polls Aikido for open vulnerabilities surfaced in the Security Issues screen." {
            tags "External"
        }

        scytale = softwareSystem "Scytale" "SOC II compliance evidence management. The backend uploads evidence artefacts to Scytale after fix/review jobs complete." {
            tags "External"
        }

        cloudfront = softwareSystem "AWS CloudFront" "CDN that distributes the built static assets and enforces Content-Security-Policy and HSTS headers via a CloudFront Function." {
            tags "External"
        }

        // ── Main software system ──────────────────────────────────────────────

        codeAgentUI = softwareSystem "Code Agent UI" "React single-page application providing the full operator interface: job management, AI chat, execution plans, quality metrics, security issues, SOC II audit, knowledge index management, and platform settings." {

            nginxContainer = container "Nginx Static Server" "Serves the pre-built Vite/React bundle as static files inside a Docker container. Acts as the SPA host with history-API fallback routing." "Nginx / Docker" {
                tags "WebApp"
            }

            reactApp = container "React SPA" "Single-page application compiled from TypeScript/React source. All application logic runs in the browser; no server-side rendering." "React 19, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS" {
                tags "WebApp"

                // ── Components ────────────────────────────────────────────────

                authModule = component "Auth Module" "Initialises Keycloak-JS, manages OIDC tokens (login, refresh, logout), maps Keycloak realm/client roles to internal AppRoles and Permissions, and exposes the global auth store." "keycloak-js, TanStack Store"

                apiClient = component "API Client" "Axios instance pre-configured with the backend base URL. Request interceptor attaches the Bearer token; response interceptor redirects to Keycloak login on 401." "Axios"

                routerModule = component "Router & Route Guards" "TanStack Router tree covering all application routes. beforeLoad guards enforce role requirements (app_admin, app_developer, etc.) before rendering protected pages." "TanStack Router"

                chatFeature = component "Chat Feature" "Streaming AI chat interface. Sends messages via Server-Sent Events to /api/chat, renders incremental markdown with Mermaid diagram support, manages conversation history in localStorage, and displays tool-call thinking steps." "SSE, React, Mermaid, react-markdown"

                jobsFeature = component "Jobs Feature" "Lists, filters, paginates, and auto-refreshes agent jobs. Provides approve, reject, cancel, and re-run actions. Displays diffs, commits, AI call details, and SOC II evidence for individual jobs." "TanStack Query"

                plansFeature = component "Execution Plans Feature" "Creates, approves, executes, and monitors multi-step execution plans. Integrates plan creation into the Chat interface and displays a phase/step progress timeline." "TanStack Query"

                metricsFeature = component "Metrics & Reports Feature" "Quality reports with code-coverage drill-down, review metrics, developer scorecards, AI token/cost statistics with daily bar charts, and roadmap/sprint Gantt views." "Chart.js, Recharts, TanStack Query"

                securityFeature = component "Security & Compliance Feature" "Displays Aikido vulnerabilities grouped by product and repo with SLA badges. SOC II audit trail with compliance-check results and Scytale evidence links." "TanStack Query"

                settingsFeature = component "Settings Feature" "Repository configuration, automation hooks wizard, prompt-template editor, agent memories, system-level key-value settings, knowledge-index management (Jira/Confluence/web-docs/static files), customer registry with environment/team metadata, integration filters, webhook audit log, audit log, and user management." "TanStack Query"

                scopeFeature = component "Scope & QA Readiness Feature" "Product-scope viewer linked to Jira epics/features/user-stories with readiness badges and sprint Gantt chart. QA readiness dashboard." "TanStack Query"
            }
        }

        // ── Relationships: actors → UI ────────────────────────────────────────

        developer -> codeAgentUI "Uses to trigger jobs, chat with AI, review PRs and manage plans" "HTTPS"
        administrator -> codeAgentUI "Configures settings, repositories, hooks, users and knowledge index" "HTTPS"
        staffUser -> codeAgentUI "Views quality reports, security issues, scope, and roadmaps" "HTTPS"

        // ── Relationships: UI system → external systems ───────────────────────

        codeAgentUI -> keycloak "Authenticates users and obtains OIDC tokens via login-required flow" "HTTPS/OIDC"
        codeAgentUI -> codeAgentBackend "Calls all /api/* endpoints for data and actions" "HTTPS/REST, SSE"
        codeAgentUI -> cloudfront "Assets are served through CloudFront CDN in production" "HTTPS"

        // ── Relationships: backend → downstream systems (context completeness) ─

        codeAgentBackend -> postgresDb "Reads and writes all application state and vector embeddings" "JDBC/SQL"
        codeAgentBackend -> anthropicAI "Invokes Claude models for code analysis, fix, review, plan, and chat" "HTTPS/REST"
        codeAgentBackend -> awsBedrock "Generates and re-ranks text and code embeddings" "AWS SDK"
        codeAgentBackend -> bitbucket "Clones repos, opens PRs, posts comments, reads webhooks" "HTTPS/REST"
        codeAgentBackend -> gitPlatform "Clones repos, opens PRs, posts comments (Azure DevOps / GitLab / GitHub)" "HTTPS/REST"
        codeAgentBackend -> jira "Reads issues, transitions tickets, logs work, receives webhooks" "HTTPS/REST"
        codeAgentBackend -> confluence "Reads and syncs wiki pages for knowledge indexing" "HTTPS/REST"
        codeAgentBackend -> aikido "Polls for open security vulnerabilities" "HTTPS/REST"
        codeAgentBackend -> scytale "Uploads SOC II compliance evidence artefacts" "HTTPS/REST"

        // ── Relationships: containers ─────────────────────────────────────────

        nginxContainer -> reactApp "Serves compiled static assets to the browser" "HTTP"

        // ── Relationships: components ─────────────────────────────────────────

        routerModule -> authModule "Reads auth state; calls route guards before rendering protected routes" "in-process"
        apiClient -> authModule "Retrieves Bearer token for each outbound request" "in-process"

        chatFeature -> apiClient "Sends POST /api/chat and reads SSE stream; loads conversations and attachments" "in-process"
        jobsFeature -> apiClient "Calls /api/jobs, /api/jobs/{id}/approve|reject|cancel|rerun, /api/stats" "in-process"
        plansFeature -> apiClient "Calls /api/plans CRUD and /api/plans/{id}/approve|execute|archive" "in-process"
        metricsFeature -> apiClient "Calls /api/metrics/quality, /api/metrics/reviews, /api/metrics/developers, /api/stats/ai-calls, /api/roadmap" "in-process"
        securityFeature -> apiClient "Calls /api/security/issues, /api/compliance/soc2, /api/jobs/{id}/evidence" "in-process"
        settingsFeature -> apiClient "Calls /api/settings, /api/repos, /api/hooks, /api/prompts, /api/memories, /api/knowledge, /api/registry, /api/integration-filters, /api/webhook-audit, /api/audit, /api/users, /api/mcp/profiles" "in-process"
        scopeFeature -> apiClient "Calls /api/scope, /api/qa-readiness" "in-process"

        authModule -> keycloak "Performs OIDC login-required flow, token refresh, and logout" "HTTPS/OIDC"
        apiClient -> codeAgentBackend "All REST calls with Authorization: Bearer header" "HTTPS/REST"
        chatFeature -> codeAgentBackend "Opens SSE stream for streaming chat responses" "HTTPS/SSE"
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    views {

        systemContext codeAgentUI "SystemContext" {
            include *
            autoLayout lr
            title "Code Agent UI — System Context"
            description "Users, the Code Agent UI, and all external systems it interacts with."
        }

        container codeAgentUI "Containers" {
            include *
            autoLayout lr
            title "Code Agent UI — Containers"
            description "The Nginx static server and the React SPA that run inside the Docker image."
        }

        component reactApp "Components_ReactApp" {
            include *
            autoLayout tb
            title "React SPA — Components"
            description "Major feature modules and cross-cutting components inside the React single-page application."
        }

        styles {
            element "Person" {
                shape Person
                background #1168bd
                color #ffffff
            }
            element "Database" {
                shape Cylinder
                background #f5a623
                color #ffffff
            }
            element "Queue" {
                shape Pipe
                background #6b6b6b
                color #ffffff
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "WebApp" {
                shape WebBrowser
                background #23a2d9
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
        }
    }
}
