# LifeXP V2

A real backend-ready version of the LifeXP productivity RPG.

## Stack
- Vite + vanilla JavaScript frontend
- Supabase Auth
- Supabase Postgres + Row Level Security
- Server-side XP function with a daily XP cap
- Google OAuth support
- Responsive mobile-first UI

## Setup
1. Install Node.js 20+.
2. Create a Supabase project.
3. In Supabase SQL Editor, run `supabase/schema.sql`.
4. Enable Email auth and optionally Google provider in Supabase Authentication.
5. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key.
6. Run:
   npm install
   npm run dev
7. For production:
   npm run build

## Important
The repository is intentionally frontend-simple so it can be deployed cheaply. The database/RLS layer is where user data security and XP integrity begin. For a production launch, add rate limits, moderation/reporting, edit history, anti-abuse monitoring, email verification policy, backups, analytics, and server-side leaderboard queries.
