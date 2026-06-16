# Integrated Launch — Management Overview
*Integrated Staffing Limited · June 2026*

---

## What It Is

Integrated Launch is a web-based employee onboarding portal built for Integrated Staffing Limited. It replaces manual onboarding tracking with a centralized platform that keeps HR, managers, and new hires aligned through a structured 90-day journey. The system is live, cloud-hosted, and accessible from any device.

---

## How It Works

**Starting an onboarding** is a single form: enter the employee's name, email, and job role. The system automatically generates a personalized 90-day task plan, sends the new hire a welcome email with a secure invite link, and opens their onboarding record for the team to track.

**The 90-day plan** is organized into five phases: Week 1, Week 2, 30 Day, 60 Day, and 90 Day. Each phase contains a checklist of tasks drawn from that role's template. Admins and managers can check off tasks, add notes, upload documents, and see overall completion at a glance.

**Employees** log into their own portal and see only their tasks, documents, and timeline — a clean, focused view with no administrative clutter. They can also submit time-off requests directly from the portal.

**Time-off management** is built in: employees request time off through the portal, requests appear on a shared team calendar, and managers approve, deny, or cancel with a single click. All requests have a type (vacation, sick, personal, etc.) and support flexible dates.

---

## Who Uses It

| Role | What they see |
|---|---|
| **Employee** | Personal task list, documents, time-off requests |
| **Manager** | Time-off calendar and approvals, employee portal view |
| **Admin** | Full dashboard, all onboardings, document library, task templates, company resources |
| **Super Admin** | Everything above + user management, audit log, system settings |

Access is enforced server-side — each role sees only what they're permitted to.

---

## Key Features

- **Dashboard** — Live view of all active onboardings, completion percentages, staff off today, and quick-start for new hires
- **Task templates** — Role-specific task libraries that auto-populate each new onboarding; templates are editable without affecting in-progress plans
- **Document management** — Upload and organize onboarding documents per employee; admins also maintain a shared company document library
- **Company resources** — A centralized knowledge base (links, files, guides) available to all employees through their portal
- **Audit log** — Every significant action is recorded with who did it and when; Super Admins can filter and review the full history
- **Invite-based accounts** — New users receive a secure email invite; they set their own password on first login, no IT involvement required
- **Mobile-friendly** — Full functionality on phones and tablets with a bottom navigation bar layout; desktop uses a sidebar

---

## Technical Foundation

The application is a React single-page app backed by Supabase (PostgreSQL database, authentication, file storage, and serverless email functions). There is no custom backend server to manage — the cloud infrastructure handles uptime, backups, and scaling automatically. The codebase is clean, modular, and well-documented.

---

## Current Status

- App is **fully operational** — compiles without errors, all pages render correctly
- Authentication flows verified: login, forgot password, invite-based signup, password reset
- Role-based access control confirmed across all four roles
- Supabase backend connected and live
- Ready for production use

---

*For technical questions, contact the development team. For access or account setup, contact HR.*
