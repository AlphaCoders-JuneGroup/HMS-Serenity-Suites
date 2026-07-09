# HMS-Serenity-Suites

A modern Hotel Management System for Serenity Suites, built to streamline room reservations, guest management, billing, housekeeping, and hotel operations.

## Tech Stack (MEAN + Tailwind CSS)

| Layer    | Technology        |
|----------|-------------------|
| Frontend | Angular + Tailwind CSS |
| Backend  | Node.js + Express |
| Database | MongoDB Atlas     |

## Project Structure

```
HMS-Serenity-Suites/
├── backend/          # Node.js + Express API
│   ├── config/       # Database & app configuration
│   ├── controllers/  # Route handlers
│   ├── middleware/   # Auth, validation, etc.
│   ├── models/       # Mongoose schemas
│   └── routes/       # API routes
├── frontend/         # Angular application
│   └── src/
└── .gitignore
```

## Prerequisites

- Node.js (v18+)
- npm
- MongoDB Atlas account

## Getting Started

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB credentials
npm run dev
```

Backend runs at `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:4200`

## Environment Variables

Create `backend/.env` from `.env.example`:

```
PORT=5000
MONGODB_URI=mongodb://<user>:<password>@ac-0woj1r4-shard-00-00.bsbbdvn.mongodb.net:27017,.../serenity_suites?ssl=true&replicaSet=atlas-4yc0pl-shard-0&authSource=admin
JWT_SECRET=your_jwt_secret
```

> **Note:** If `mongodb+srv://` fails with `querySrv ECONNREFUSED`, use the direct `mongodb://` URI from MongoDB Atlas (Connect → Drivers). URL-encode special characters in the password (e.g. `@` → `%40`).

## API Endpoints

| Method | Endpoint        | Description          |
|--------|-----------------|----------------------|
| GET    | /api/health     | Health check         |
| GET    | /api/rooms      | List all rooms       |
| GET    | /api/guests     | List all guests      |
| GET    | /api/bookings   | List all bookings    |

## License

MIT
