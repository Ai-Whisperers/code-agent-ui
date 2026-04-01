import { StrictMode, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  useNavigate,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'

import { authStore, checkAuth } from '@/store/auth-store'
import { createRouteGuard } from '@/lib/route-guards'
import MainLayout from '@/components/layout/MainLayout'
import Dashboard from '@/pages/Dashboard'
import Jobs from '@/pages/Jobs'
import JobDetail from '@/pages/JobDetail'
import NewJob from '@/pages/NewJob'
import RepoSettingsPage from '@/pages/RepoSettings'
import HooksPage from '@/pages/Hooks'
import PromptsPage from '@/pages/Prompts'
import PlansPage from '@/pages/Plans'
import PlanDetail from '@/pages/PlanDetail'
import NewPlan from '@/pages/NewPlan'
import QualityReportsPage from '@/pages/QualityReports'
import CoverageDetail from '@/pages/CoverageDetail'
import ReviewMetricsPage from '@/pages/ReviewMetrics'
import DeveloperScorecardPage from '@/pages/DeveloperScorecard'
import AiStatsPage from '@/pages/AiStats'
import MemoriesPage from '@/pages/Memories'
import SystemSettingsPage from '@/pages/SystemSettings'
import KnowledgeIndexPage from '@/pages/KnowledgeIndex'
import CustomerRegistryPage from '@/pages/CustomerRegistry'
import ChatPage from '@/pages/Chat'
import WebhookAuditLogPage from '@/pages/WebhookAuditLog'
import AuditLogPage from '@/pages/AuditLog'
import AdminUsersPage from '@/pages/AdminUsers'
import RoadmapsPage from '@/pages/Roadmaps'
import RoadmapDetail from '@/pages/RoadmapDetail'
import ScopesPage from '@/pages/Scopes'
import ScopeDetail from '@/pages/ScopeDetail'
import ScopeImprove from '@/pages/ScopeImprove'
import { QaReadinessPage } from '@/pages/QaReadiness'
import Soc2AuditPage from '@/pages/Soc2AuditPage'
import OAuthCallbackPage from '@/pages/OAuthCallbackPage'
import AccessDenied from '@/pages/AccessDenied'
import Unauthenticated from '@/pages/Unauthenticated'

import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
})

// ── Root component ────────────────────────────────────────────────────────────

function RootComponent() {
  const { isInitialized, isAuthenticated } = useStore(authStore, (s) => ({
    isInitialized: s.isInitialized,
    isAuthenticated: s.isAuthenticated,
  }))
  const navigate = useNavigate()

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      navigate({ to: '/unauthenticated' })
    }
  }, [isInitialized, isAuthenticated, navigate])

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-page-background)]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[var(--color-buttons-button-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--color-fonts-font-color-support)]">Initializing…</p>
        </div>
      </div>
    )
  }

  return <Outlet />
}

// ── Routes ────────────────────────────────────────────────────────────────────

const rootRoute = createRootRouteWithContext<object>()({
  component: RootComponent,
})

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: MainLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  component: Dashboard,
})

const jobsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/jobs',
  component: Jobs,
})

const newJobRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/jobs/new',
  component: NewJob,
})

const jobDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/jobs/$id',
  component: function JobDetailRoute() {
    const { id } = jobDetailRoute.useParams()
    return <JobDetail jobId={id} />
  },
})

const reposRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/repos',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: RepoSettingsPage,
})

const hooksRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/hooks',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: HooksPage,
})

const promptsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/prompts',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: PromptsPage,
})

const plansRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/plans',
  component: PlansPage,
})

const newPlanRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/plans/new',
  component: NewPlan,
})

const planDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/plans/$id',
  component: function PlanDetailRoute() {
    const { id } = planDetailRoute.useParams()
    return <PlanDetail planId={id} />
  },
})

const qualityRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/quality',
  component: QualityReportsPage,
})

const coverageDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/quality/$workspace/$repoSlug',
  component: function CoverageDetailRoute() {
    const { workspace, repoSlug } = coverageDetailRoute.useParams()
    return <CoverageDetail workspace={workspace} repoSlug={repoSlug} />
  },
})

const reviewMetricsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/reviews',
  component: ReviewMetricsPage,
})

const developerScorecardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/developers',
  component: DeveloperScorecardPage,
})

const aiStatsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/stats',
  component: AiStatsPage,
})

const memoriesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/memories',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: MemoriesPage,
})

const systemSettingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/system',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: SystemSettingsPage,
})

const knowledgeIndexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/knowledge',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: KnowledgeIndexPage,
})

const customersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/customers',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: CustomerRegistryPage,
})

const chatRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/chat',
  component: ChatPage,
})

const chatConvRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/chat/$conversationId',
  component: ChatPage,
})

const webhookAuditRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/webhook-audit',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: WebhookAuditLogPage,
})

const auditLogRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/audit',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: AuditLogPage,
})

const adminUsersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/users',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_admin'] }),
  component: AdminUsersPage,
})

const roadmapsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/roadmap',
  component: RoadmapsPage,
})

const roadmapDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/roadmap/$id',
  component: function RoadmapDetailRoute() {
    const { id } = roadmapDetailRoute.useParams()
    return <RoadmapDetail roadmapId={id} />
  },
})

const scopesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/scope',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_staff', 'app_developer', 'app_admin'] }),
  component: ScopesPage,
})

const scopeDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/scope/$id',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_staff', 'app_developer', 'app_admin'] }),
  component: function ScopeDetailRoute() {
    const { id } = scopeDetailRoute.useParams()
    return <ScopeDetail scopeId={id} />
  },
})

const scopeImproveRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/scope/$id/improve/$issueKey',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_staff', 'app_developer', 'app_admin'] }),
  component: function ScopeImproveRoute() {
    const { id, issueKey } = scopeImproveRoute.useParams()
    return <ScopeImprove scopeId={id} issueKey={issueKey} />
  },
})

const qaReadinessRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/qa-readiness',
  beforeLoad: createRouteGuard({ requiredRoles: ['app_staff', 'app_developer', 'app_admin'] }),
  component: QaReadinessPage,
})

const soc2AuditRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/compliance/soc2',
  component: Soc2AuditPage,
})

const oauthCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/oauth/callback',
  component: OAuthCallbackPage,
})

const accessDeniedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/access-denied',
  component: AccessDenied,
})

const unauthenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/unauthenticated',
  component: Unauthenticated,
})

const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    indexRoute,
    jobsRoute,
    newJobRoute,
    jobDetailRoute,
    reposRoute,
    hooksRoute,
    promptsRoute,
    plansRoute,
    newPlanRoute,
    planDetailRoute,
    qualityRoute,
    coverageDetailRoute,
    reviewMetricsRoute,
    developerScorecardRoute,
    aiStatsRoute,
    memoriesRoute,
    systemSettingsRoute,
    knowledgeIndexRoute,
    customersRoute,
    chatRoute,
    chatConvRoute,
    webhookAuditRoute,
    auditLogRoute,
    adminUsersRoute,
    roadmapsRoute,
    roadmapDetailRoute,
    scopesRoute,
    scopeDetailRoute,
    scopeImproveRoute,
    qaReadinessRoute,
    soc2AuditRoute,
  ]),
  oauthCallbackRoute,
  accessDeniedRoute,
  unauthenticatedRoute,
])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  context: {},
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
