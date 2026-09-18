# SupportDesk - the project on one page

## In one line

A helpdesk where **customers raise tickets**, the **server automatically picks an agent**, and the
two **chat live inside the ticket** until it is solved.

**Stack:** React + Vite + Tailwind (frontend) · Node + Express (backend) · MongoDB (database) ·
Socket.IO (live chat) · JWT (login)

---

## The 3 users

| Role | How the account is made | What they do |
|---|---|---|
| **Customer** | Signs up on the Register page, gets logged in straight away | Creates tickets, chats with the agent, closes or reopens |
| **Agent** | Added by the admin (*Agents -> Add agent*) | Sets Available/Busy/Offline, works on assigned tickets, resolves them |
| **Admin** | Created once with `npm run create-admin` (details in `server/.env`) | Sees everything, adds agents, reassigns tickets |

Admins **cannot** create customers or other admins. Nobody can sign up as an agent or admin.

---

## The whole flow

```
1. Customer signs up / logs in          -> gets a JWT token
2. Customer creates a ticket            -> saved as SD-1001, status OPEN
3. Server picks an agent automatically  -> available agent with the FEWEST active tickets
      no agent available?               -> status WAITING_FOR_AGENT (queued)
4. Agent gets a live notification       -> status ASSIGNED
5. Both open the ticket and chat        -> messages go through Socket.IO, saved in MongoDB
                                           (photos can be attached, pasted or dropped in)
6. Agent clicks "Start working"         -> IN_PROGRESS
7. Agent clicks "Mark resolved"         -> RESOLVED, customer is notified
8. Customer clicks "Confirm & close"    -> CLOSED   (or "Reopen" -> REOPENED)
```

When an agent switches to **Available**, queued tickets are assigned to them right away -
**URGENT first, then oldest first**.

---

## How data moves

```
   React (browser)
      │                    │
   REST API             Socket.IO
   (load & save)        (live updates)
      │                    │
      └──── Express ───────┘
              │
   route -> check login -> check role -> validate -> controller -> service
                                                                    │
                                                                 MongoDB
```

- **REST** = anything you load or save: login, tickets, message history, dashboards.
- **Socket.IO** = anything that must appear instantly: new messages, typing, status changes,
  notifications.
- **MongoDB is the source of truth.** A chat message is saved to the database *first*, then
  broadcast. Refresh the page and nothing is lost.

---

## Two key features, explained simply

**Auto-assignment** (`server/src/services/assignmentService.js`)
1. Find agents who are active **and** Available.
2. Count each one's open tickets (Assigned / In progress / Waiting for customer / Reopened).
3. Give the ticket to the one with the smallest count.
4. Log it in assignment history, add a system message, notify the agent.

**Live chat** (`server/src/sockets/ticketSocket.js`)
1. Browser connects to Socket.IO with its JWT - no token, no connection.
2. Opening a ticket joins the room `ticket:<id>` - only the customer, the assigned agent or an
   admin are allowed in.
3. Sending a message: check access -> save to MongoDB -> send to everyone in the room.

**Photos in chat** (`server/src/services/attachmentStorage.js`)
1. Photo is uploaded over REST (not the socket), max 5 MB.
2. Server checks access, then reads the file's real bytes - only JPG/PNG/GIF/WebP are accepted.
3. Saved as `server/uploads/<ticketId>/<random name>`, message saved in MongoDB, then broadcast live.
4. Photos are **not public**: each one is downloaded through a route that checks the viewer is
   allowed to see that ticket.

---

## Security in one breath

Passwords hashed with bcrypt · JWT on every request · role checks on every route · customers see
only their tickets, agents only their assigned ones · all input validated with Zod on the server ·
the backend decides which status changes are allowed, not the browser.

---

## Where things live

| Want to find... | Look in |
|---|---|
| Statuses, roles, allowed status changes | `server/src/config/constants.js` |
| Business logic | `server/src/services/` |
| Database models | `server/src/models/` |
| Who can open which ticket | `server/src/services/ticketAccess.js` |
| Pages per role | `client/src/pages/customer`, `agent`, `admin`, `shared` |
| Sidebar menu per role | `client/src/config/navigation/` |
| Colours / theme | `client/src/theme/tokens.js` |
| API base URL | `client/src/config/appConfig.js` |

---

## Run it

```bash
npm run install:all   # first time only
npm run create-admin  # first time only - makes the admin from server/.env
npm run dev           # backend :5050 + frontend :5173
```

There is **no demo data** - the app starts empty. Sign in as the admin (`ADMIN_EMAIL` /
`ADMIN_PASSWORD` in `server/.env`), add an agent, then sign up as a customer from the login page.

---

## Explain it in 30 seconds

> "SupportDesk is a MERN helpdesk. Customers sign up and raise tickets. Instead of an admin handing
> out work, the backend assigns each ticket to the available agent with the lightest workload, and
> queues it if nobody is free. The customer and agent then chat in real time over Socket.IO, with
> every message saved in MongoDB. The ticket moves through a server-controlled lifecycle - assigned,
> in progress, resolved, closed - and each role sees only what it is allowed to."
