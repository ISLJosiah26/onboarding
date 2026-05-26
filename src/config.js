export const HR_EMAIL = 'hr@integratedstaffing.ca'

export const BRAND = {
  name: 'Integrated Launch',
  company: 'Integrated Staffing Limited'
}

export const ROUTES = {
  DASHBOARD: '/dashboard',
  ACTIVE: '/active',
  NEW_ONBOARDING: '/onboarding/new',
  PLAN: '/onboarding/plan',
  TEMPLATES: '/templates',
  DOCUMENTS: '/documents',
  ROLES: '/roles',
  HISTORY: '/history',
  SET_PASSWORD: '/set-password'
}

export function pathToPage(pathname) {
  if (pathname === ROUTES.ACTIVE) return 'new-onboarding-select'
  if (pathname === ROUTES.NEW_ONBOARDING) return 'new-onboarding'
  if (pathname === ROUTES.PLAN) return 'plan'
  if (pathname === ROUTES.TEMPLATES) return 'templates'
  if (pathname === ROUTES.DOCUMENTS) return 'documents'
  if (pathname === ROUTES.ROLES) return 'roles'
  if (pathname === ROUTES.HISTORY) return 'history'
  if (pathname === ROUTES.SET_PASSWORD) return 'set-password'
  return 'dashboard'
}

export function pageToPath(page) {
  if (page === 'new-onboarding-select') return ROUTES.ACTIVE
  if (page === 'new-onboarding') return ROUTES.NEW_ONBOARDING
  if (page === 'plan') return ROUTES.PLAN
  if (page === 'templates') return ROUTES.TEMPLATES
  if (page === 'documents') return ROUTES.DOCUMENTS
  if (page === 'roles') return ROUTES.ROLES
  if (page === 'history') return ROUTES.HISTORY
  if (page === 'set-password') return ROUTES.SET_PASSWORD
  return ROUTES.DASHBOARD
}
