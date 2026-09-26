# Absensi SMA Negeri 3 Sarmi

A mobile-first attendance application for teachers and administrative staff at SMA Negeri 3 Sarmi. Staff can register and verify a face descriptor in the browser, clock in or out with GPS coordinates, and review their current status. Administrators can manage personnel, inspect attendance history, view daily metrics, and prepare WhatsApp summaries.

## Technology

- Static HTML, CSS, and browser JavaScript
- face-api.js for on-device face detection and matching
- Netlify Functions for the application API
- Netlify Database with Drizzle ORM for personnel and attendance records
- Netlify-managed database migrations

Face photos are not retained. Only numeric face descriptors used for matching are stored in the database.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and choose a strong `ADMIN_PASSWORD`.
3. Run `npm run dev`.
4. Open `http://localhost:8889`; the admin interface is available at `/admin`.

Camera and geolocation permissions are required for attendance. Production deployments use HTTPS automatically.

## Deployment configuration

Set `ADMIN_PASSWORD` in the Netlify environment before using the admin interface. The database is provisioned automatically and the migration under `netlify/database/migrations` is applied during deployment.
