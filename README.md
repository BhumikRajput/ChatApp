# ChatApp

A full-stack real-time messaging application with user authentication, conversation requests, live presence indicators, and a responsive dark UI.

**[Live Demo](https://chat-app-two-sigma-o2fph76unf.vercel.app)**

---

## Features

- **Authentication** — Sign up / log in with username & password (JWT, 7-day expiry)
- **User search** — Find other users by username
- **Conversation requests** — Send, accept, or decline chat requests
- **Real-time messaging** — Instant delivery via Socket.IO
- **Online / offline presence** — Live status dots and “Online / Offline” labels
- **Conversation management** — View accepted chats and delete conversations
- **Responsive design** — Two-pane desktop layout, single-pane mobile experience with back navigation
- **Persistent sessions** — Token & user data stored in `localStorage`

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 19, Vite, Socket.IO Client    |
| Backend    | Node.js, Express 5, Socket.IO       |
| Database   | PostgreSQL                          |
| Auth       | JWT + bcrypt                        |
| Hosting    | Vercel (frontend), Render (API + DB)|

---

## Project Structure

```
.
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── api/            # REST API helpers
│   │   ├── components/     # Login, Signup, ChatWindow, ConversationList, UserMenu
│   │   ├── context/        # AuthContext, PresenceContext
│   │   ├── socket/         # Socket.IO connection helpers
│   │   ├── App.jsx
│   │   └── index.css
│   ├── env.production
│   └── package.json
│
├── server/                 # Express + Socket.IO backend
│   ├── config/db.js
│   ├── db/schema.sql
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── conversations.js
│   │   └── users.js
│   ├── server.js
│   └── package.json
│
└── .gitignore
```

---

## Database Schema

Run the following SQL against your PostgreSQL instance to create the required tables:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  is_group BOOLEAN DEFAULT FALSE,
  name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  requested_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_participants_user ON conversation_participants(user_id);
```

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL

### 1. Clone & install

```bash
git clone <your-repo-url>
cd <project-folder>

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Environment variables

**`server/.env`**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/chatapp
JWT_SECRET=your_super_secret_key
CLIENT_URL=http://localhost:5173
PORT=5000
NODE_ENV=development
```

**`client/.env`** (optional for local)

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Database

```bash
# Create the database, then apply the schema
psql -U postgres -d chatapp -f server/db/schema.sql
```

### 4. Run

```bash
# Terminal 1 – backend
cd server
node server.js

# Terminal 2 – frontend
cd client
npm run dev
```

Open http://localhost:5173

---

## Environment Variables (Production)

### Backend (Render)

| Variable       | Description                                      |
|----------------|--------------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string (Render Postgres)   |
| `JWT_SECRET`   | Secret used to sign JWT tokens                   |
| `CLIENT_URL`   | Frontend origin (for CORS), e.g. your Vercel URL |
| `PORT`         | Provided by Render (usually set automatically)   |
| `NODE_ENV`     | `production`                                     |

### Frontend (Vercel)

| Variable        | Description                                      |
|-----------------|--------------------------------------------------|
| `VITE_API_URL`  | Backend API base, e.g. `https://your-api.onrender.com/api` |

---

## API Overview

| Method | Endpoint                              | Description                    |
|--------|---------------------------------------|--------------------------------|
| POST   | `/api/auth/signup`                    | Create account                 |
| POST   | `/api/auth/login`                     | Log in                         |
| GET    | `/api/users/search?q=`                | Search users                   |
| GET    | `/api/conversations`                  | List accepted conversations    |
| POST   | `/api/conversations`                  | Start / request conversation   |
| GET    | `/api/conversations/pending`          | Incoming requests              |
| GET    | `/api/conversations/sent`             | Outgoing requests              |
| POST   | `/api/conversations/:id/accept`       | Accept request                 |
| POST   | `/api/conversations/:id/reject`       | Reject / delete request        |
| GET    | `/api/conversations/:id/messages`     | Get messages                   |
| POST   | `/api/conversations/:id/messages`     | Send message (REST fallback)   |
| DELETE | `/api/conversations/:id`              | Delete conversation            |
| GET    | `/api/health`                         | Health check                   |

Real-time events are handled over Socket.IO (`send_message`, `new_message`, presence events, request notifications, etc.).

---

## Deployment

- **Frontend** → Vercel (Vite build)
- **Backend + PostgreSQL** → Render

Make sure `CLIENT_URL` on the backend matches your Vercel domain and `VITE_API_URL` on the frontend points to your Render API URL (including `/api`).

---

## License

MIT