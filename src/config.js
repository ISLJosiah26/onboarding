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
  TIME_OFF: '/time-off',
  COMPANY_RESOURCES: '/company-resources',
  SET_PASSWORD: '/set-password',
  SUPER_ADMIN_USERS: '/system/users',
  SUPER_ADMIN_AUDIT: '/system/audit',
  SUPER_ADMIN_SETTINGS: '/system/settings'
}

export function pathToPage(pathname) {
  if (pathname === ROUTES.ACTIVE) return 'new-onboarding-select'
  if (pathname === ROUTES.NEW_ONBOARDING) return 'new-onboarding'
  if (pathname === ROUTES.PLAN) return 'plan'
  if (pathname === ROUTES.TEMPLATES) return 'templates'
  if (pathname === ROUTES.DOCUMENTS) return 'documents'
  if (pathname === ROUTES.COMPANY_RESOURCES) return 'company-resources'
  if (pathname === ROUTES.ROLES) return 'roles'
  if (pathname === ROUTES.HISTORY) return 'history'
  if (pathname === ROUTES.TIME_OFF) return 'time-off'
  if (pathname === ROUTES.SET_PASSWORD) return 'set-password'
  if (pathname === ROUTES.SUPER_ADMIN_USERS) return 'super-admin-users'
  if (pathname === ROUTES.SUPER_ADMIN_AUDIT) return 'super-admin-audit'
  if (pathname === ROUTES.SUPER_ADMIN_SETTINGS) return 'super-admin-settings'
  return 'dashboard'
}

export function pageToPath(page) {
  if (page === 'new-onboarding-select') return ROUTES.ACTIVE
  if (page === 'new-onboarding') return ROUTES.NEW_ONBOARDING
  if (page === 'plan') return ROUTES.PLAN
  if (page === 'templates') return ROUTES.TEMPLATES
  if (page === 'documents') return ROUTES.DOCUMENTS
  if (page === 'company-resources') return ROUTES.COMPANY_RESOURCES
  if (page === 'roles') return ROUTES.ROLES
  if (page === 'history') return ROUTES.HISTORY
  if (page === 'time-off') return ROUTES.TIME_OFF
  if (page === 'set-password') return ROUTES.SET_PASSWORD
  if (page === 'super-admin-users') return ROUTES.SUPER_ADMIN_USERS
  if (page === 'super-admin-audit') return ROUTES.SUPER_ADMIN_AUDIT
  if (page === 'super-admin-settings') return ROUTES.SUPER_ADMIN_SETTINGS
  return ROUTES.DASHBOARD
}
