# Deployment Guide: Vercel (Frontend) + Render (Backend) + Supabase (Postgres)

## 1. Deploy Database on Supabase
1. Create a Supabase project.
2. Go to `Project Settings -> Database` and copy the Postgres connection string.
3. In Supabase SQL editor, run your migration SQL files in order:
- `server/src/migrations/01-create-users-table.sql`
- `server/src/migrations/02-create-core-tables.sql`
- `server/src/migrations/03-create-notifications-logs.sql`
- `server/src/migrations/04-create-return-logs.sql`
- `server/src/migrations/05-add-return-log-stock-location.sql`
- `server/src/migrations/06-align-admin-role.sql`
- `server/src/migrations/07-create-credit-requests.sql`
- `server/src/migrations/08-create-payments.sql`
- `server/src/migrations/09-create-pricing-rules.sql`
- `server/src/migrations/10-drop-margin-discount-rules.sql`

## 2. Deploy Backend on Render
1. Create a new **Web Service** from your repo with root directory `server`.
2. Use:
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
3. Set environment variables in Render:
- `NODE_ENV=production`
- `PORT=10000` (or leave Render default)
- `JWT_SECRET=<strong-random-secret>`
- `DATABASE_URL=<supabase-connection-string>`
- `CORS_ORIGIN=https://<your-vercel-domain>`
4. Deploy and note backend URL, e.g. `https://your-api.onrender.com`.

## 3. Configure Frontend Routing to Backend
Your frontend uses relative `/api/...` calls. In Vercel, add a rewrite so `/api/*` forwards to Render.

Create `client/vercel.json` with:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-api.onrender.com/api/:path*"
    }
  ]
}
```

Replace `your-api.onrender.com` with your real Render domain.

## 4. Deploy Frontend on Vercel
1. Import your repo into Vercel.
2. Set project root to `client`.
3. Framework: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy.

## 5. Post-Deploy Checklist
1. Open frontend and test login.
2. Verify cookie-based auth works across domains.
3. Verify API calls in browser network tab are hitting Render.
4. Test critical flows:
- Login/logout
- Orders create/update
- Product restock
- Reports analytics

## 6. Important Notes
1. Cross-site cookies require HTTPS and backend cookie config with `sameSite='none'` and `secure=true` in production. This is already handled in the current backend code.
2. If CORS errors appear, verify `CORS_ORIGIN` exactly matches your Vercel domain (including `https://`).
3. Use Supabase pooled connection string if you expect higher traffic.
