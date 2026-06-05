# Salary Planner

Salary Planner is a yearly savings and spending planner with:

1. Account-based login
2. Year and month planning views
3. Category-based salary allocation tracking
4. PostgreSQL-backed persistence
5. Render-ready deployment setup

## Repo Layout

- `salary-planner/`: main Vite + Express + PostgreSQL app
- `render.yaml`: Render blueprint for deploying the app from this repository
- `index.html`, `script.js`, `style.css`: earlier static prototype files kept at repo root

## Render Deployment

This repository is prepared to deploy on Render with:

1. One Render Web Service
2. One Render managed PostgreSQL database

The deployed app runs as a single Node service that:

1. Serves the built frontend from `salary-planner/dist`
2. Exposes the API from the same service
3. Connects to managed PostgreSQL using `DATABASE_URL`

## Exact Render Dashboard Settings

When creating the web service in Render, use these values:

1. Repository: this GitHub repository
2. Branch: `main`
3. Root Directory: `salary-planner`
4. Runtime: `Node`
5. Build Command: `npm install && npm run build`
6. Start Command: `npm run server`
7. Health Check Path: `/api/health`

Environment variables to set on the web service:

1. `DATABASE_URL`: your Render PostgreSQL connection string
2. `PGSSLMODE`: `require`
3. `JWT_SECRET`: a long random secret value

## Render Database Setup

1. Create a PostgreSQL database in Render.
2. Copy its connection string.
3. Add that value as `DATABASE_URL` in the Render web service.
4. Keep `PGSSLMODE=require`.

The backend auto-creates the required tables on startup.

## Local Development

From [salary-planner](salary-planner):

1. Copy `.env.example` to `.env`
2. Set your PostgreSQL connection values
3. Run `npm install`
4. Run `npm run dev` for frontend development
5. Run `npm run server` for the API

## App Details

The main app source lives in:

- [salary-planner/src/main.js](salary-planner/src/main.js)
- [salary-planner/src/style.css](salary-planner/src/style.css)
- [salary-planner/server.js](salary-planner/server.js)

More app-specific deployment and DB notes are in [salary-planner/README.md](salary-planner/README.md).