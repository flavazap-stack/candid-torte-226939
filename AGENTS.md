# Project guide

## Architecture

This is a static, two-interface Netlify application. `index.html` contains the staff attendance and Face ID registration experience. `admin.html` contains the authenticated management dashboard. Both read `config.js` and call the same `/api/attendance` endpoint.

The API is implemented in `netlify/functions/api.mts`. It supports JSONP for the existing browser GET flow and form posts for mutations. Structured data lives in Netlify Database. `db/schema.ts` is the schema source, `db/index.ts` creates the Drizzle client, and generated SQL belongs in `netlify/database/migrations`.

## Conventions

- Keep all visitor-facing copy in Indonesian.
- Preserve the local API path in `config.js`; do not add external database or spreadsheet services.
- Use parameterized Drizzle queries for data access.
- Store face descriptors only. Do not persist captured face photos.
- Keep camera and GPS error states actionable and visible in the page.
- Use the established forest, warm orange, cream, and slate palette across both interfaces.
- Never commit an admin password. It is read from the Netlify `ADMIN_PASSWORD` environment variable.

## Schema changes

Update `db/schema.ts`, then generate a descriptively named migration into `netlify/database/migrations`. A schema edit without its migration is incomplete.

## Key deployment details

`netlify.toml` publishes the repository root and maps `/admin` to the admin document. The database is provisioned on first connection. The Face ID model is loaded in the browser from its upstream CDN, so attendance requires network access in addition to camera and location permissions.
