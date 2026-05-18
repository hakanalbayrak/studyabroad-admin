# Study Abroad Platform — Admin Panel & Backend

## Setup on cPanel
1. Clone this repo via cPanel Git Version Control
2. Copy `.env.example` to `.env` and fill in your database password
3. Run `database/schema.sql` in phpMyAdmin
4. Set up Node.js app in cPanel pointing to this directory
5. Run `npm install`

## API Endpoints
- `GET /api/health` — Health check

## Tech Stack
- Node.js + Express
- MySQL
- CesiumJS + Google 3D Tiles (frontend)
