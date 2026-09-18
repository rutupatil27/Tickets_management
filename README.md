# SupportDesk

> A MERN helpdesk and **real-time ticket management** platform, built around one idea:
> an administrator should never have to hand out tickets by hand.
>
> **Short on time?** Read [PROJECT_FLOW.md](PROJECT_FLOW.md) - the whole project on one page.

Customers raise tickets. The backend runs an assignment engine that picks the **least-loaded
available agent**, notifies them instantly over Socket.IO, and the two sides talk inside a
ticket-scoped conversation that is persisted in MongoDB.

```
Customer -> Ticket -> Assignment engine -> Agent -> Real-time conversation -> Resolved -> Closed
```

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Roles and permissions](#roles-and-permissions)
- [Ticket lifecycle](#ticket-lifecycle)
- [Automatic assignment algorithm](#automatic-assignment-algorithm)
- [Real-time architecture](#real-time-architecture)
- [Database schema](#database-schema)
- [API documentation](#api-documentation)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Installation](#installation)
- [Running locally](#running-locally)
- [First run](#first-run)
- [Testing](#testing)
- [Deployment](#deployment)
- [Design system](#design-system)
- [Future improvements](#future-improvements)

---

## Features

**Core**

- JWT authentication with bcrypt password hashing
- Three roles - customer, support agent, administrator - enforced server-side on every request
- Full ticket CRUD with human-readable ticket numbers (`SD-1001`, `SD-1002`, ...)
- **Automatic assignment** to the least-loaded available agent
- **Waiting queue** when nobody is available, drained in priority order the moment an agent frees up
- Agent availability (`available` / `busy` / `offline`) that actually drives routing
- Validated ticket status lifecycle - invalid transitions are rejected by the backend
- Real-time ticket conversation over Socket.IO, persisted in MongoDB
- Room-level authorization: a ticket ID alone never grants access

**Supporting**

- In-app notifications with a live badge and dropdown
- Typing indicators and read receipts
- **Photo sharing in chat** - attach, paste or drag-and-drop a photo (JPG / PNG / GIF / WebP, up to
  5 MB) with an optional caption; full-screen viewer and download
- Assignment history / audit trail, including admin overrides
- Server-side search, filtering, sorting and pagination
- Three role-specific dashboards with Recharts visualisations
- Responsive light-theme SaaS UI with loading, empty, error and confirmation states
- Centralised theme tokens, API configuration and per-role navigation config

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, Tailwind CSS 3, React Router 6, Axios, Socket.IO client, Recharts, React Hook Form, Lucide, react-hot-toast |
| Backend | Node.js, Express 4, Mongoose 8, Socket.IO 4, JWT, bcryptjs, Zod, Helmet, express-rate-limit |
| Database | MongoDB (Atlas or local) |
| Tooling | Node's built-in test runner, ESLint, Postman |

---

## Architecture

```
                        ┌─────────────────┐
                        │     Browser     │
                        │   React / Vite  │
                        └────────┬────────┘
                                 │
                     ┌───────────┴───────────┐
                     │                       │
                  REST API               Socket.IO
              (state + history)       (live delivery)
                     │                       │
                     └───────────┬───────────┘
                                 │
                        ┌────────▼────────┐
                        │ Node + Express  │
                        │                 │
                        │   routes        │
                        │   controllers   │  thin
                        │   services      │  <- all business logic
                        │   middleware    │  auth / roles / validation
                        │   sockets       │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │    MongoDB      │
                        │                 │
                        │ users           │
                        │ tickets         │
                        │ messages        │
                        │ notifications   │
                        │ assignmenthistories
                        └─────────────────┘
```

**Layering rule:** controllers stay thin and do no business logic. A request flows

```
route -> authenticate -> authorize -> validate -> controller -> service -> model
```

The assignment engine lives in `services/assignmentService.js`, never in a controller.

### REST vs Socket.IO responsibility

| REST owns | Socket.IO owns |
|---|---|
| auth, ticket CRUD, ticket + message history, status updates, users, dashboards, notifications | new message delivery, typing, read receipts, live status changes, assignment notifications, presence |

MongoDB is always the source of truth. Socket.IO is a transport, never storage - a message is
persisted **before** it is broadcast.

---

## Roles and permissions

```
                    ADMIN
                      |
          -------------------------
          |                       |
       AGENTS                  CUSTOMERS
          |                       |
          -------- TICKETS --------
                     |
               CONVERSATIONS
```

| Capability | Customer | Agent | Admin |
|---|:--:|:--:|:--:|
| Sign up (self-register) | yes | - | - |
| Log in | yes | yes | yes |
| Add agent accounts | - | - | yes |
| Create ticket | yes | - | yes |
| See own tickets | yes | - | yes |
| See assigned tickets | - | yes | yes |
| See all tickets | - | - | yes |
| Participate in conversation | own tickets | assigned tickets | any |
| Change status | resolved -> closed / reopened | assigned -> in progress -> waiting/resolved | override |
| Change priority | - | assigned tickets | any |
| Set own availability | - | yes | yes (any agent) |
| Reassign ticket | - | - | yes |
| Manage users / roles | - | - | yes |
| View assignment history | - | assigned tickets | any |

**How accounts are created:**

- **Customers sign up themselves** on the Register page and are logged in straight away. The
  register endpoint rejects a `role` field outright, so nobody can promote themselves.
- **Agents are added by an admin** from *Agents -> Add agent* (`POST /api/users/agents`). That
  endpoint has no `role` field either - it can only ever create an agent, never a customer or
  an admin.
- **The first admin** is created once with `npm run create-admin`, using `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` from `server/.env`.

**Access rules (enforced in `services/ticketAccess.js`, used by both REST and sockets):**

1. Customers can only touch tickets they created.
2. Agents can only touch tickets assigned to them.
3. Admins can touch everything.

Unauthenticated -> `401`. Authenticated but not permitted -> `403`.

---

## Ticket lifecycle

```
OPEN ──> WAITING_FOR_AGENT ──┐
  │                          │  (an agent becomes available)
  └──────> ASSIGNED <────────┘
              │
              v
         IN_PROGRESS <───────> WAITING_FOR_CUSTOMER
              │
              v
          RESOLVED ──> CLOSED
              │           │
              └── REOPENED ──> IN_PROGRESS
```

| Status | Meaning |
|---|---|
| `OPEN` | Created, assignment has not completed |
| `WAITING_FOR_AGENT` | Queued - no suitable agent is available |
| `ASSIGNED` | An agent has been assigned automatically |
| `IN_PROGRESS` | The agent has started working |
| `WAITING_FOR_CUSTOMER` | The agent needs more information |
| `RESOLVED` | The agent believes it is solved |
| `CLOSED` | The customer accepted the resolution |
| `REOPENED` | The customer reopened it |

The transition table lives in `config/constants.js` (`STATUS_TRANSITIONS`) and is keyed by role.
Anything not listed is rejected with `400 INVALID_STATUS_TRANSITION` - the frontend never decides
what is legal, it just renders the `allowedStatuses` the API returns.

A `CLOSED` ticket rejects new messages (`400 TICKET_LOCKED`) until it is reopened.

---

## Automatic assignment algorithm

**Workload** = tickets assigned to an agent in `ASSIGNED`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`
or `REOPENED`. `RESOLVED` and `CLOSED` never count.

```
Ticket created
      │
      v
Find agents where role=agent AND isActive=true AND availabilityStatus=available
      │
      ├── none ──> status = WAITING_FOR_AGENT, assignedTo = null, admins notified
      │
      v
Aggregate active ticket count per candidate
      │
      v
Sort by (activeTickets ASC, name ASC)   <- deterministic, so it is reproducible
      │
      v
Assign to the first one, atomically (findOneAndUpdate on assignedTo: null)
      │
      ├──> AssignmentHistory entry (with a snapshot of the workload numbers)
      ├──> SYSTEM message in the conversation
      ├──> notification to the agent and to the customer
      └──> ticket:assigned emitted to the agent's socket room
```

**Worked example** (this is exactly what the live smoke test produced):

```
Rahul   available   2 active
Neha    busy        2 active   <- skipped, not available
Amit    available   3 active
Priya   offline     0 active   <- skipped, not available

New ticket SD-1015 (HIGH, Payment)  ->  Rahul Mehta
```

**Waiting queue.** When an agent flips to `available` (or is reactivated, or another ticket is
assigned and capacity may exist), `processWaitingQueue()` drains the backlog:

```
sort by priorityWeight DESC, createdAt ASC     (URGENT > HIGH > MEDIUM > LOW, oldest first)
```

`priorityWeight` is a numeric mirror of `priority` kept in sync by a Mongoose hook, because a
string sort cannot express `URGENT > HIGH > MEDIUM > LOW`. It is indexed together with `status`
and `createdAt`.

The drain is guarded by an in-process lock so two concurrent triggers coalesce instead of
interleaving, and every claim is atomic so the same ticket can never reach two agents.

**Agents going offline do not lose their tickets.** Existing work stays assigned; the admin
decides whether to reassign. There is no automatic timeout or escalation in this version.

**Skill-based routing** is architected but off by default. Set
`ENABLE_SKILL_BASED_ROUTING=true` and agents whose `skills` include the ticket's category are
preferred, falling back to the whole pool when nobody matches.

---

## Real-time architecture

```
Customer browser
      │  socket.emit('ticket:message')
      v
Socket.IO server
      │  1. verify JWT from the handshake      (anonymous sockets are refused)
      │  2. load ticket, check access          (never trust the client's ticket id)
      │  3. validate + sanitise the payload
      v
messageService.createTextMessage()
      │
      ├──────────────> MongoDB   (persisted first - source of truth)
      │
      v
room  ticket:<id>
      ├──────────────> customer
      └──────────────> agent
```

### Event contract

| Client -> server | Server -> client |
|---|---|
| `ticket:join` | `ticket:message:new` |
| `ticket:leave` | `ticket:read:update` |
| `ticket:message` | `ticket:status:changed` |
| `ticket:typing:start` | `ticket:assigned` |
| `ticket:typing:stop` | `ticket:updated` |
| `ticket:read` | `notification:new` |
| | `presence:update` |
| | `socket:error` |

Every client event is acknowledged with `{ success, ... }` or `{ success: false, message, errorCode }`.

Rooms in use:

- `ticket:<ticketId>` - the conversation
- `user:<userId>` - personal notifications
- `role:admin` - platform-wide broadcasts

**Typing events are never written to MongoDB.** A socket being connected is *not* the same as
business availability - an agent can be connected and still `busy`, so availability is stored
explicitly and only ever changed by an explicit action.

---

## Database schema

```
User                          Ticket                        Message
────                          ──────                        ───────
name                          ticketNumber   (unique)       ticketId      -> Ticket
email          (unique)       subject                       senderId      -> User (null = system)
passwordHash   (select:false) description                   senderRole
role                          category                      type          TEXT | SYSTEM
availabilityStatus            priority                      content
isActive                      priorityWeight (indexed)      attachments[]
avatar, phone                 status                        readBy[]      -> User
skills[]                      createdBy      -> User        timestamps
lastSeenAt                    assignedTo     -> User
timestamps                    assignedAt, firstResponseAt
                              resolvedAt, closedAt
                              reopenedAt, reopenCount
Notification                  lastMessageAt                 AssignmentHistory
────────────                  timestamps                    ─────────────────
userId        -> User                                       ticketId       -> Ticket
type                          Counter                       previousAgent  -> User
title, message                ───────                       newAgent       -> User
relatedTicketId -> Ticket     _id: 'ticketNumber'           assignedBy     -> User (admin)
relatedTicketNumber           seq  (atomic $inc)            assignedByType SYSTEM | ADMIN
isRead                                                      reason
timestamps                                                  workloadSnapshot[]
                                                            timestamps
```

Notable indexes:

- `users`: `{ role, isActive, availabilityStatus }` - the assignment engine's candidate query
- `tickets`: `{ status, assignedTo, priorityWeight, createdAt }` - the waiting-queue drain
- `tickets`: `{ createdBy, status, updatedAt }` and `{ assignedTo, status, updatedAt }` - list views
- `messages`: `{ ticketId, createdAt }` - conversation history

Ticket numbers come from an atomic `$inc` on a dedicated `Counter` document, so concurrent
creation can never produce a duplicate.

---

## API documentation

Base URL: `http://localhost:5050/api`

Every response uses the same envelope:

```jsonc
// success
{ "success": true, "message": "Ticket created successfully", "data": { } }

// failure
{ "success": false, "message": "Ticket not found", "errorCode": "TICKET_NOT_FOUND" }
```

Authenticated routes expect `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Register (always creates a customer) |
| POST | `/auth/login` | public | Log in, returns user + token |
| GET | `/auth/me` | any | Current user + unread notification count |
| POST | `/auth/logout` | any | Updates presence; client discards the token |
| PATCH | `/auth/profile` | any | Update name / phone / avatar |
| PATCH | `/auth/password` | any | Change password |

### Tickets

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/tickets` | any | List, scoped by role. Query: `page limit search status priority category sort agentId customerId unassigned` |
| POST | `/tickets` | customer, admin | Create + auto-assign |
| GET | `/tickets/meta` | any | Category / priority / status vocabulary |
| GET | `/tickets/:id` | participants | Ticket + `allowedStatuses` for the caller |
| GET | `/tickets/:id/history` | agent, admin | Assignment audit trail |
| PATCH | `/tickets/:id/status` | participants | Validated transition |
| PATCH | `/tickets/:id/priority` | agent, admin | Change priority |
| PATCH | `/tickets/:id/reassign` | admin | Override assignment (omit `agentId` to re-run the engine) |

### Messages

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/tickets/:ticketId/messages` | participants | History. Query: `page limit order` |
| POST | `/tickets/:ticketId/messages` | participants | Send (same write path as the socket) |
| PATCH | `/tickets/:ticketId/messages/read` | participants | Mark the conversation read |
| POST | `/tickets/:ticketId/messages/photo` | participants | Send a photo. `multipart/form-data`: `image` (file) + optional `content` (caption) |
| GET | `/tickets/:ticketId/attachments/:storageKey` | participants | Stream a photo (the `url` stored on the message) |

### Photo sharing

```
Browser ── POST multipart (image + caption) ──> multer (memory, 5 MB cap)
                                                   │
                         check login + ticket access + ticket not closed
                                                   │
                         read the real file bytes ("magic numbers")
                         JPG / PNG / GIF / WebP only - never SVG
                                                   │
                         save as uploads/<ticketId>/<random>.png
                                                   │
                         save message in MongoDB ──> broadcast to ticket room
```

- **Photos are private to the ticket.** They are not in a public folder: every download goes
  through `GET /attachments/...`, which runs the same access check as the conversation. The browser
  fetches them with the auth header and shows them from a local blob URL.
- **The file type is checked from the bytes**, not the name or the browser's claim, so a renamed
  `.html` file is rejected before anything is written to disk.
- **Stored filenames are random** (`<32 hex>.<ext>`) and validated by pattern on download, which
  rules out path traversal.
- Photos go over REST (sockets are a poor fit for binary data); the saved message is then broadcast
  over Socket.IO, so the other side still sees it instantly.

### Users

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/users` | admin | List. Query: `page limit search role availabilityStatus isActive sort` |
| GET | `/users/agents` | agent, admin | Agent picker with live workload |
| POST | `/users/agents` | admin | Add a support agent (the only account an admin can create) |
| GET | `/users/agents/workload` | admin | Full workload report |
| GET | `/users/:id` | admin, self | User detail + counts |
| PATCH | `/users/:id` | admin, self | Update profile fields |
| PATCH | `/users/:id/role` | admin | Change role (blocked while the agent holds active tickets) |
| PATCH | `/users/:id/active` | admin | Activate / deactivate |
| PATCH | `/users/:id/availability` | agent (self), admin | Set availability; drains the queue on `available` |

### Notifications and dashboards

| Method | Endpoint | Access |
|---|---|---|
| GET | `/notifications` | any |
| PATCH | `/notifications/:id/read` | any |
| PATCH | `/notifications/read-all` | any |
| GET | `/dashboard/customer` | customer, admin |
| GET | `/dashboard/agent` | agent, admin |
| GET | `/dashboard/admin` | admin |

A Postman collection is included: **`postman/SupportDesk.postman_collection.json`**.
Import it, set the `baseUrl` variable, and run *Auth -> Login* first - the collection stores the
returned token automatically and every other request reuses it.

---

## Project structure

```
supportdesk/
│
├── server/
│   ├── src/
│   │   ├── config/         env, db, constants (the domain vocabulary)
│   │   ├── models/         User, Ticket, Message, Notification, AssignmentHistory, Counter
│   │   ├── controllers/    thin HTTP adapters
│   │   ├── routes/         route tables + middleware wiring
│   │   ├── middleware/     auth, roles, validation, rate limiting, errors
│   │   ├── services/       assignment, ticket, message, notification, user, dashboard
│   │   ├── sockets/        socketServer, ticketSocket, realtime (emit bridge)
│   │   ├── validators/     Zod schemas
│   │   ├── utils/          jwt, ticket numbers, pagination, ApiError, logger
│   │   ├── scripts/        create-admin, db:reset (no demo data)
│   │   └── app.js
│   ├── tests/              integration suite + module smoke test
│   └── server.js
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/     Button, Field, Badge, Avatar, Modal, States, Pagination...
│   │   │   ├── layout/     AppLayout, Sidebar, Topbar, ConnectionStatus, NotificationBell
│   │   │   ├── tickets/    TicketListView, TicketTable, TicketFilters, TicketSidebar, TicketActions
│   │   │   ├── chat/       ChatPanel, MessageBubble, MessageInput, TypingIndicator
│   │   │   ├── charts/     DonutChart, TicketsOverTimeChart, DistributionBars
│   │   │   └── dashboard/  QuickOverview, StatCard
│   │   ├── config/
│   │   │   ├── appConfig.js            API base URL, socket URL, storage keys
│   │   │   └── navigation/             ONE FILE PER ROLE
│   │   │       ├── customerNavigation.js
│   │   │       ├── agentNavigation.js
│   │   │       ├── adminNavigation.js
│   │   │       └── index.js            getNavigation(role)
│   │   ├── context/        AuthContext, SocketContext, NotificationContext
│   │   ├── hooks/          useAuth, useSocket, useNotifications, useTickets, useDebouncedValue
│   │   ├── pages/
│   │   │   ├── auth/       Login, Register, AuthLayout
│   │   │   ├── customer/   CustomerDashboard, CustomerTickets, CreateTicket
│   │   │   ├── agent/      AgentDashboard, AgentTickets
│   │   │   ├── admin/      AdminDashboard, AdminTickets, AdminUsers, AdminAgents
│   │   │   └── shared/     TicketDetails, Profile, NotificationsPage, NotFound, RoleLanding
│   │   ├── routes/         AppRoutes, ProtectedRoute / RoleRoute / PublicOnlyRoute
│   │   ├── services/       api.js (axios instance) + one module per resource
│   │   ├── theme/          tokens.js (colours, radii, shadows) + statusStyles.js
│   │   └── utils/          constants, format, cn
│   └── tailwind.config.js  imports theme/tokens.js - one source of truth
│
├── postman/
└── README.md
```

**Folders are organised by role** (`pages/customer`, `pages/agent`, `pages/admin`) with genuinely
shared screens in `pages/shared`. The sidebar for each role is its own navigation file, so adding
a page means editing one config file, not the layout component.

---

## Environment variables

### `server/.env`

| Variable | Example | Notes |
|---|---|---|
| `PORT` | `5050` | `5000` is inside a Windows reserved range on some machines |
| `NODE_ENV` | `development` | |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/supportdesk` | **Include the database name** or the driver falls back to `test` |
| `JWT_SECRET` | long random string | Required |
| `JWT_EXPIRES_IN` | `7d` | |
| `BCRYPT_SALT_ROUNDS` | `10` | |
| `CLIENT_URL` | `http://localhost:5173` | Comma-separated for multiple origins |
| `AGENT_MAX_ACTIVE_TICKETS` | `0` | `0` = unlimited |
| `ENABLE_SKILL_BASED_ROUTING` | `false` | Optional extension |
| `UPLOADS_DIR` | *(empty)* | Where chat photos are stored. Empty = `server/uploads` |
| `ADMIN_NAME` | `Administrator` | Used by `npm run create-admin` |
| `ADMIN_EMAIL` | `you@company.com` | The first admin's login |
| `ADMIN_PASSWORD` | strong password | 8+ characters with a letter and a number |

### `client/.env`

| Variable | Example |
|---|---|
| `VITE_API_URL` | `http://localhost:5050` (without `/api`) |
| `VITE_SOCKET_URL` | `http://localhost:5050` |

`.env` is git-ignored; `.env.example` is committed in both folders.

---

## Installation

```bash
# 1. install everything
npm install                 # root (concurrently)
npm run install:all         # server + client

# 2. configure
cp server/.env.example server/.env      # paste MONGO_URI, set ADMIN_EMAIL + ADMIN_PASSWORD
cp client/.env.example client/.env

# 3. create the first admin account
npm run create-admin
```

There is **no demo data**. The app starts empty: customers sign up on the Register page and the
admin adds agents from *Agents -> Add agent*. `create-admin` is safe to run again - it never
overwrites an existing admin.

To wipe everything and start fresh (development only):

```bash
npm run db:reset --prefix server -- --confirm   # deletes all data, recreates the admin from .env
```

---

## Running locally

```bash
npm run dev            # backend + frontend together
```

or separately:

```bash
npm run dev:server     # http://localhost:5050
npm run dev:client     # http://localhost:5173
```

Health check: `GET http://localhost:5050/api/health`

---

## First run

The only account that exists after setup is the admin from `server/.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`). Change its password from *My profile* after signing in.

### Try the full flow

1. **Admin:** sign in, open *Agents -> Add agent* and create an agent.
2. **Agent** (second browser or incognito window): sign in and switch availability to
   **Available**.
3. **Customer** (a third window): click *Create a customer account* on the login page, sign up -
   you are logged straight in - and create a ticket. It is assigned to the agent instantly.
4. Open the ticket on both sides and chat - messages, typing indicators and read ticks are live.
5. Agent: **Start working** -> **Mark resolved**. The customer sees the status change instantly.
6. Customer: **Confirm & close**, or **Reopen** to send it back.
7. To see the waiting queue: set the agent to **Busy**, create another ticket (it waits), then set
   the agent back to **Available** and watch it get assigned.

---

## Testing

```bash
npm test                      # 81 integration tests
npm run test:imports --prefix server   # loads every module (catches cycles / bad imports)
```

The suite runs against a **real MongoDB**, using a dedicated `supportdesk_test` database that is
dropped before and after the run, so development data is never touched. It covers:

| Area | Examples |
|---|---|
| Authentication | valid login, wrong password, unknown email returns the same generic 401, inactive account, duplicate email, cannot self-register as admin |
| Authorization | customer hitting an admin route, admin can only create agents (not customers/admins), agent creating agents, agent changing another agent's availability |
| Assignment | least-loaded wins, busy/offline agents skipped, no agent -> waiting queue, availability flip drains the queue, priority ordering (URGENT before an older LOW), audit trail |
| Access control | customer reading another customer's ticket, agent reading an unassigned ticket, admin reading everything, filters that cannot widen scope |
| Lifecycle | every legal transition, invalid transitions rejected, closed tickets reject messages, reopen restores them |
| Real-time | anonymous socket refused, bad token refused, unauthorized room join refused, message delivered both directions and persisted, typing broadcast but not stored, status + assignment events |
| Validation | short subject, unknown category, empty message, malformed id returns 400 not 500, structured 404 |
| Photo sharing | photo + caption delivered live and persisted, photo without caption, byte-identical download for participants and admin, outsiders get 403/401 on download and upload, renamed non-image rejected and never written to disk, SVG/PDF rejected, >5 MB rejected, path traversal refused, closed ticket refuses photos |

Uploaded test photos go to a temporary folder that is deleted after the run, never to
`server/uploads`.

Two real defects were found and fixed by this suite:

1. The MongoDB driver stalled on IPv6/NAT64 addresses on Windows - the connection is now pinned to
   IPv4 (`family: 4`).
2. The socket connection handler `await`ed a database write **before** attaching its event
   listeners, so a client that emitted immediately on connect had that event silently dropped.
   Listeners are now attached synchronously.

---

## Deployment

| Piece | Target |
|---|---|
| Frontend | Vercel (`npm run build`, output `client/dist`) |
| Backend | Render / Railway (`npm start` in `server/`) |
| Database | MongoDB Atlas |

Checklist:

- Set `CLIENT_URL` on the backend to the deployed frontend origin, or CORS **and** the Socket.IO
  handshake will both be rejected.
- Set `VITE_API_URL` / `VITE_SOCKET_URL` on the frontend to the deployed backend origin.
- Socket.IO must be reachable over `wss://` - most platforms handle this automatically, but a proxy
  in front of the backend needs WebSocket upgrades enabled.
- Use a strong `JWT_SECRET` and set `NODE_ENV=production` (this hides stack traces and tightens the
  rate limits).
- Whitelist the backend's egress IPs in Atlas.
- **Chat photos are stored on the server's disk.** Render / Railway disks are wiped on every
  deploy, so either attach a persistent disk and point `UPLOADS_DIR` at it, or swap
  `services/attachmentStorage.js` for S3 / Cloudinary (it is the only file that touches storage).

---

## Design system

Light, airy SaaS dashboard - defined once in `client/src/theme/tokens.js`, which
`tailwind.config.js` imports. No component hard-codes a hex value.

| Role | Colour |
|---|---|
| Page background | very light neutral `#eceef3` |
| Cards | white, soft shadow, `1.25rem` radius |
| Primary | violet / indigo (`brand-600` `#7c3aed`) |
| Success / warning / danger / info | green / amber / red / blue |

Status and priority badges follow the spec's colour language and are defined in
`theme/statusStyles.js`:

```
OPEN blue · WAITING_FOR_AGENT amber · ASSIGNED violet · IN_PROGRESS indigo
WAITING_FOR_CUSTOMER orange · RESOLVED green · CLOSED grey · REOPENED red

LOW neutral · MEDIUM blue · HIGH orange · URGENT red
```

**Charts.** The categorical palette in `tokens.js` is not chosen by eye - the ordering was
validated against the white card surface for colour-vision-deficient separation (worst adjacent
pair dE 9.1) and normal-vision separation (worst adjacent pair dE 19.6). Slots are assigned in
fixed order and never cycled; a ninth category folds into "Other". Because three slots sit under
3:1 contrast on white, every chart ships a legend with values or direct labels, so identity is
never carried by colour alone. Status and priority breakdowns use labelled horizontal bars, where
the colour merely reinforces a label that is already written out.

---

## Future improvements

- Agent skill-based routing turned on by default, with per-category skill management in the UI
- SLA timers, automatic escalation and reassignment when an agent goes idle
- Non-image attachments (PDFs, logs) and photos on the ticket itself, not just in chat
- Cloud storage (S3 / Cloudinary) for chat photos, with automatic thumbnails
- Email / WhatsApp notifications alongside the in-app ones
- AI ticket triage: infer category and priority from the description, suggest a responder
- Canned responses and a knowledge base / FAQ
- Customer satisfaction rating after closure
- Agent performance analytics and exportable reports
- Multi-tenant organisations and team-based routing
- Dark mode
