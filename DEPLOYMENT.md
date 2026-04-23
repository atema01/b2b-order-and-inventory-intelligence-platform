# Deployment Guide

This project is set up to deploy with:

- Frontend: Vercel
- Backend API: Render
- Database: Supabase Postgres

The repo now includes:

- `render.yaml` for the backend service
- `client/vercel.json` rewrites for `/api/*` and `/socket.io/*`
- `server/.env.example` with the main production environment variables

## 1. Deploy the database on Supabase

1. Create a Supabase project.
2. Open `Project Settings -> Database`.
3. Copy the Postgres connection string.
4. Run the SQL migration files in `server/src/migrations` in filename order.

Current migrations in this repo run from:

- `01-create-users-table.sql`
- through
- `16-...sql`

Use all migration files in ascending order.

## 2. Deploy the backend on Render

You can either:

- create the service manually, or
- use the included `render.yaml`

### Manual Render setup

1. Create a new Web Service from this repo.
2. Set the root directory to `server`.
3. Use:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
4. Set environment variables:
   - `NODE_ENV=production`
   - `PORT=10000`
   - `JWT_SECRET=<strong-random-secret>`
   - `DATABASE_URL=<supabase-connection-string>`
   - `CORS_ORIGIN=https://<your-vercel-domain>`
   - optional: `FORECAST_AUTO_GENERATE=true`
   - optional: `FORECAST_SCHEDULE_DAY=1`
   - optional: `FORECAST_SCHEDULE_HOUR=2`
   - optional: `FORECAST_SCHEDULE_MINUTE=0`
   - optional: `PROPHET_PYTHON_PATH=/usr/bin/python3`

### Notes

- FB Prophet is optional for first deployment. If Python/Prophet is unavailable on the backend host, the app falls back to Holt-Winters forecasting.
- After deploy, test:
  - `https://<your-render-domain>/api`
  - `https://<your-render-domain>/api/test-db`

## 3. Configure the frontend for production

The frontend already uses relative paths like:

- `/api/...`
- `/socket.io/...`

The included `client/vercel.json` proxies both paths to the backend.

Before deploying, update `client/vercel.json` and replace:

- `https://your-api.onrender.com`

with your real Render backend domain.

## 4. Deploy the frontend on Vercel

1. Import the repo into Vercel.
2. Set the project root to `client`.
3. Framework preset: `Vite`.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy.

## 5. Post-deploy checklist

Verify these flows after both services are live:

1. Open the Vercel frontend.
2. Log in and confirm auth works.
3. Open browser devtools and verify:
   - `/api/*` requests are successful
   - `/socket.io/*` connects successfully
4. Test:
   - login/logout
   - products
   - orders
   - buyers
   - reports
   - analysis / forecasting
   - notifications / realtime updates

## 6. Important production notes

1. `CORS_ORIGIN` must exactly match the frontend origin, including `https://`.
2. The backend already enables `credentials: true`, `trust proxy`, and production cookie behavior.
3. If realtime works locally but not in production, verify the `/socket.io` rewrite still points to the Render domain.
4. If you want guaranteed FB Prophet support in production, the next step is usually a Docker-based backend deploy so Python dependencies are installed explicitly.
