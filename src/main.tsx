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
import ReviewMetricsPage from '@/pages/ReviewMetrics'
import AiStatsPage from '@/pages/AiStats'
import AccessDenied from '@/pages/AccessDenied'

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
      navigate({ to: '/access-denied' })
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
  component: RepoSettingsPage,
})

const hooksRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/hooks',
  component: HooksPage,
})

const promptsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/prompts',
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

const reviewMetricsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/metrics/reviews',
  component: ReviewMetricsPage,
})

const aiStatsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/stats',
  component: AiStatsPage,
})

const accessDeniedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/access-denied',
  component: AccessDenied,
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
    reviewMetricsRoute,
    aiStatsRoute,
  ]),
  accessDeniedRoute,
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
