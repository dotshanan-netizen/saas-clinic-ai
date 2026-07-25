# Clinova Master Documentation Index

Welcome to the Clinova platform documentation. This master index organizes all engineering logs, designs, and runbooks into a clean hierarchy.

---

## 🧭 Navigation Index

### 🛡️ Core & Architecture
* [Clinova Engineering Principles](file:///D:/saas-clinic-ai/docs/architecture/ENGINEERING_PRINCIPLES.md) - Our core engineering guidelines (e.g. Structural Hardening, 5-gate system validation).
* [Clinic Configuration System Design](file:///D:/saas-clinic-ai/docs/architecture/CLINIC_CONFIGURATION_SYSTEM_DESIGN.md) - Details of tenant dynamic configurations.
* [Admind Blueprint](file:///D:/saas-clinic-ai/docs/architecture/ADMIND_BLUEPRINT.md) - System architecture design blueprint.
* [Infrastructure & Deployment Guide](file:///D:/saas-clinic-ai/docs/architecture/INFRASTRUCTURE.md) - Vercel, Neon DB, and environment configurations.

### 🗺️ Roadmaps & Strategy
* [Master Plan](file:///D:/saas-clinic-ai/docs/roadmaps/MASTER_PLAN.md) - Main roadmap and goals for the project.
* [Product Roadmap](file:///D:/saas-clinic-ai/docs/roadmaps/PRODUCT_ROADMAP.md) - Feature plans and release steps.
* [Project Identity](file:///D:/saas-clinic-ai/docs/roadmaps/PROJECT_IDENTITY.md) - Core branding and product positioning.
* [Pricing Strategy](file:///D:/saas-clinic-ai/docs/roadmaps/PRICING.md) - Monetization models.

### 📋 Reports & Baselines
* [MVP Completion Report](file:///D:/saas-clinic-ai/docs/reports/MVP_COMPLETION_REPORT.md) - Outcomes and stats of the MVP build.
* [Release Candidate Report](file:///D:/saas-clinic-ai/docs/reports/RELEASE_CANDIDATE_REPORT.md) - Pre-release validation outcomes.
* [Auth Implementation Report](file:///D:/saas-clinic-ai/docs/reports/AUTH_IMPLEMENTATION_REPORT.md) - Dashboard login bypass and JWT setup report.
* [System Baseline](file:///D:/saas-clinic-ai/docs/reports/BASELINE.md) - Original project codebase baseline.

### 📖 Runbooks & Operations
* [Pilot Playbook](file:///D:/saas-clinic-ai/docs/runbooks/PILOT_PLAYBOOK.md) - Step-by-step instructions for launching the live Pilot with clinics.
* [WhatsApp Integration Runbook](file:///D:/saas-clinic-ai/docs/runbooks/WHATSAPP_INTEGRATION_RUNBOOK.md) - Technical steps for Meta Cloud API webhook setup.

### 🗄️ Archives
* [Auth Implementation Plan](file:///D:/saas-clinic-ai/docs/archive/AUTH_IMPLEMENTATION_PLAN.md) - Archived design for dashboard authentication.
* [MVP Test Plan](file:///D:/saas-clinic-ai/docs/archive/MVP_TEST_PLAN.md) - Archived test plan.
* [Project Inventory](file:///D:/saas-clinic-ai/docs/archive/PROJECT_INVENTORY.md) - Historical file listing.
* [Project Inventory & Status](file:///D:/saas-clinic-ai/docs/archive/PROJECT_INVENTORY_AND_STATUS.md) - Historical status report.

---

## 🛠️ Helper Utilities Directory

All helper and diagnostics scripts are saved under `scripts/tools/`:
* `scripts/tools/save-token.ts` / `save-token2.ts` - Saves WhatsApp Auth Token securely in production.
* `scripts/tools/check-token.js` - Debugs decryption status of Meta Tokens.
* `scripts/tools/test-latency.ts` - Profiles AI API round-trip latency.
* `scripts/tools/test-id.js` / `test-slugs.js` - Inspects DB identifiers.
