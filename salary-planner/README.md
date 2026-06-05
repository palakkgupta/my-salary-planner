# Salary Planner with PostgreSQL

This app uses a **single PostgreSQL database** that you own.
Each user's data is stored in one row in `planner_states` using `user_id`.
Users do **not** create their own databases.

## Deploy on Render with managed PostgreSQL

This repo is prepared to run as a single Render web service:

1. Create a managed PostgreSQL database in Render.
2. Create a Render Web Service pointing to the `salary-planner` folder.
3. Use these settings:
   - Build command: `npm install && npm run build`
   - Start command: `npm run server`
4. Add these environment variables to the web service:
   - `DATABASE_URL` = Render PostgreSQL connection string
   - `PGSSLMODE` = `require`
   - `JWT_SECRET` = a long random secret
5. Open `/api/health` after deploy to confirm the app can reach the database.

The Express server serves the built frontend from `dist`, so you only need one Render app service plus the managed database.

## Run with your owned DB (production or remote)

1. Copy `.env.example` to `.env`.
2. Set your PostgreSQL credentials in `.env` (`DATABASE_URL` or `PG*` fields).
3. Start API: `npm run server`
4. Start frontend: `npm run dev`

## Run local Postgres for development (optional)

1. Start Postgres:
   - `docker compose up -d`
2. Copy `.env.example` to `.env` (defaults match docker-compose values).
3. Start both app services:
   - `npm run dev:full`

## Data model

- Table: `planner_states`
- Columns:
  - `user_id` (text, primary key)
  - `state` (jsonb)
  - `updated_at` (timestamp)

The backend auto-creates this table on startup.
