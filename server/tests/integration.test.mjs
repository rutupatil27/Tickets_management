/**
 * SupportDesk backend integration tests (spec §84).
 *
 * Runs against a real MongoDB using a dedicated `supportdesk_test` database,
 * which is dropped before and after the run.
 *
 *   npm test
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { io as ioClient } from 'socket.io-client';
import {
  BASE_URL,
  TEST_UPLOADS_DIR,
  TINY_PNG,
  api,
  createUserDirect,
  emitWithAck,
  login,
  registerCustomer,
  setAvailability,
  sleep,
  startTestServer,
  stopTestServer,
  uploadPhoto,
  waitFor,
} from './helpers.mjs';

/** Socket round-trips are the slowest tests; give them their own budget. */
const SOCKET_TEST = { timeout: 40000 };

const ctx = {};

before(async () => {
  await startTestServer();

  const admin = await createUserDirect({
    name: 'Root Admin',
    email: 'admin@test.com',
    role: 'admin',
  });

  ctx.adminId = admin._id.toString();
  const adminLogin = await login('admin@test.com');
  ctx.adminToken = adminLogin.token;
});

after(async () => {
  await stopTestServer();
});

const connectSocket = (token) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      // Without this, socket.io-client caches one Manager per URL and every
      // later io() call returns the SAME socket - so a connection rejected for
      // a bad token would be handed back to the next test, whose emits would
      // then buffer forever waiting for a connection that never comes.
      forceNew: true,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('socket connect timeout'));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      // Release the underlying engine so a rejected handshake leaves nothing
      // holding the HTTP server open at teardown.
      socket.disconnect();
      reject(error);
    });
  });

/* ========================================================================== */
describe('1. Authentication', () => {
  test('health endpoint responds', async () => {
    const { status, body } = await api('/api/health');
    assert.equal(status, 200);
    assert.equal(body.success, true);
  });

  test('customer can register and receives a customer role', async () => {
    const { status, body } = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Rutuja Patil',
        email: 'rutuja@test.com',
        password: 'Password@123',
        confirmPassword: 'Password@123',
      },
    });

    assert.equal(status, 201);
    assert.equal(body.data.user.role, 'customer');
    assert.ok(body.data.token);
    assert.equal(body.data.user.passwordHash, undefined, 'password hash must never be returned');

    ctx.customerToken = body.data.token;
    ctx.customerId = body.data.user._id;
  });

  test('cannot self-register as admin', async () => {
    const { status } = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Sneaky',
        email: 'sneaky@test.com',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'admin',
      },
    });

    assert.equal(status, 400, 'a role field in the body must be rejected');
  });

  test('mismatched passwords are rejected', async () => {
    const { status, body } = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Mismatch',
        email: 'mismatch@test.com',
        password: 'Password@123',
        confirmPassword: 'Different@123',
      },
    });

    assert.equal(status, 400);
    assert.equal(body.errorCode, 'VALIDATION_ERROR');
  });

  test('duplicate email is rejected', async () => {
    const { status, body } = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Rutuja Again',
        email: 'rutuja@test.com',
        password: 'Password@123',
        confirmPassword: 'Password@123',
      },
    });

    assert.equal(status, 409);
    assert.equal(body.errorCode, 'EMAIL_IN_USE');
  });

  test('valid login succeeds', async () => {
    const { status, token } = await login('rutuja@test.com');
    assert.equal(status, 200);
    assert.ok(token);
  });

  test('invalid password is rejected with 401', async () => {
    const { status, body } = await login('rutuja@test.com', 'WrongPass@123');
    assert.equal(status, 401);
    assert.equal(body.errorCode, 'INVALID_CREDENTIALS');
  });

  test('unknown email returns the same generic 401', async () => {
    const { status, body } = await login('nobody@test.com', 'Password@123');
    assert.equal(status, 401);
    assert.equal(body.message, 'Invalid email or password');
  });

  test('inactive account cannot log in', async () => {
    const user = await createUserDirect({
      name: 'Disabled User',
      email: 'disabled@test.com',
      role: 'customer',
    });
    await api(`/api/users/${user._id}/active`, {
      method: 'PATCH',
      token: ctx.adminToken,
      body: { isActive: false },
    });

    const { status, body } = await login('disabled@test.com');
    assert.equal(status, 403);
    assert.equal(body.errorCode, 'ACCOUNT_INACTIVE');
  });

  test('unauthenticated request returns 401', async () => {
    const { status } = await api('/api/tickets');
    assert.equal(status, 401);
  });

  test('malformed token returns 401', async () => {
    const { status } = await api('/api/tickets', { token: 'not-a-real-token' });
    assert.equal(status, 401);
  });

  test('a new customer is signed in straight after registering', async () => {
    const { status, body } = await api('/api/auth/me', { token: ctx.customerToken });
    assert.equal(status, 200);
    assert.equal(body.data.user.email, 'rutuja@test.com');
  });
});

/* ========================================================================== */
describe('2. Authorization', () => {
  test('customer cannot list users', async () => {
    const { status, body } = await api('/api/users', { token: ctx.customerToken });
    assert.equal(status, 403);
    assert.equal(body.errorCode, 'FORBIDDEN');
  });

  test('customer cannot open the admin dashboard', async () => {
    const { status } = await api('/api/dashboard/admin', { token: ctx.customerToken });
    assert.equal(status, 403);
  });

  test('admin can list users', async () => {
    const { status, body } = await api('/api/users', { token: ctx.adminToken });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data.users));
  });

  test('admin creates agent accounts', async () => {
    const agents = [
      { name: 'Rahul Mehta', email: 'rahul@test.com', skills: ['Payment'] },
      { name: 'Neha Sharma', email: 'neha@test.com', skills: ['Login'] },
      { name: 'Amit Verma', email: 'amit@test.com', skills: ['Technical Issue'] },
    ];

    ctx.agents = {};

    for (const agent of agents) {
      const { status, body } = await api('/api/users/agents', {
        method: 'POST',
        token: ctx.adminToken,
        body: { ...agent, password: 'Password@123' },
      });

      assert.equal(status, 201, `failed creating ${agent.email}`);
      assert.equal(body.data.user.role, 'agent');
      assert.equal(body.data.user.availabilityStatus, 'offline', 'new agents start offline');

      const session = await login(agent.email);
      const key = agent.email.split('@')[0];
      ctx.agents[key] = { id: body.data.user._id, token: session.token, name: agent.name };
    }
  });

  test('admin cannot create customer or admin accounts', async () => {
    // A role in the body is rejected outright - this endpoint only makes agents.
    for (const role of ['customer', 'admin']) {
      const { status } = await api('/api/users/agents', {
        method: 'POST',
        token: ctx.adminToken,
        body: { name: 'Not An Agent', email: `${role}.made@test.com`, password: 'Password@123', role },
      });
      assert.equal(status, 400, `role "${role}" must be rejected`);
    }

    // The old generic create-any-user endpoint no longer exists.
    const { status } = await api('/api/users', {
      method: 'POST',
      token: ctx.adminToken,
      body: { name: 'Generic', email: 'generic@test.com', password: 'Password@123', role: 'customer' },
    });
    assert.equal(status, 404);
  });

  test('agent cannot create agents', async () => {
    const { status } = await api('/api/users/agents', {
      method: 'POST',
      token: ctx.agents.rahul.token,
      body: { name: 'X Agent', email: 'x@test.com', password: 'Password@123' },
    });
    assert.equal(status, 403);
  });

  test('agent cannot change another agent availability', async () => {
    const { status } = await setAvailability({
      token: ctx.agents.rahul.token,
      userId: ctx.agents.neha.id,
      availabilityStatus: 'available',
    });
    assert.equal(status, 403);
  });
});

/* ========================================================================== */
describe('3. Automatic assignment', () => {
  const createTicket = (token, overrides = {}) =>
    api('/api/tickets', {
      method: 'POST',
      token,
      body: {
        subject: 'Payment deducted but order failed',
        description: 'I was charged but the order did not go through. Please help.',
        category: 'Payment',
        priority: 'MEDIUM',
        ...overrides,
      },
    });

  test('with no available agent the ticket goes to WAITING_FOR_AGENT', async () => {
    const { status, body } = await createTicket(ctx.customerToken, {
      subject: 'Queued while nobody is available',
    });

    assert.equal(status, 201);
    assert.equal(body.data.assigned, false);
    assert.equal(body.data.ticket.status, 'WAITING_FOR_AGENT');
    assert.equal(body.data.ticket.assignedTo, null);

    ctx.queuedTicketId = body.data.ticket._id;
  });

  test('ticket numbers are sequential and human readable', async () => {
    const { body } = await api(`/api/tickets/${ctx.queuedTicketId}`, { token: ctx.customerToken });
    assert.match(body.data.ticket.ticketNumber, /^SD-\d{4}$/);
  });

  test('an available agent receives the next new ticket', async () => {
    await setAvailability({
      token: ctx.agents.rahul.token,
      userId: ctx.agents.rahul.id,
      availabilityStatus: 'available',
    });

    const { body } = await createTicket(ctx.customerToken, { subject: 'Goes to the only agent' });

    assert.equal(body.data.assigned, true);
    assert.equal(body.data.ticket.status, 'ASSIGNED');
    assert.equal(body.data.ticket.assignedTo._id, ctx.agents.rahul.id);

    ctx.rahulTicketId = body.data.ticket._id;
  });

  test('flipping an agent to AVAILABLE drains the waiting queue', async () => {
    // The queued ticket from earlier should have been picked up by Rahul when
    // he became available (or by the drain that follows a new assignment).
    await sleep(400);
    const { body } = await api(`/api/tickets/${ctx.queuedTicketId}`, { token: ctx.adminToken });

    assert.notEqual(body.data.ticket.status, 'WAITING_FOR_AGENT');
    assert.ok(body.data.ticket.assignedTo, 'queued ticket should now have an agent');
  });

  test('busy and offline agents are never auto-assigned', async () => {
    await setAvailability({
      token: ctx.agents.neha.token,
      userId: ctx.agents.neha.id,
      availabilityStatus: 'busy',
    });
    // Amit stays offline.

    const { body } = await createTicket(ctx.customerToken, { subject: 'Should skip busy/offline' });
    assert.equal(body.data.ticket.assignedTo._id, ctx.agents.rahul.id);
  });

  test('the least-loaded available agent wins', async () => {
    // Rahul now carries several tickets. Bring Amit online with zero load.
    await setAvailability({
      token: ctx.agents.amit.token,
      userId: ctx.agents.amit.id,
      availabilityStatus: 'available',
    });

    const before = await api('/api/users/agents/workload', { token: ctx.adminToken });
    const loadOf = (id) =>
      before.body.data.agents.find((agent) => agent._id === id)?.activeTickets ?? 0;

    assert.ok(
      loadOf(ctx.agents.rahul.id) > loadOf(ctx.agents.amit.id),
      'precondition: Rahul must be busier than Amit',
    );

    const { body } = await createTicket(ctx.customerToken, { subject: 'Least loaded wins' });
    assert.equal(body.data.ticket.assignedTo._id, ctx.agents.amit.id);
  });

  test('assignment history records the automatic decision', async () => {
    const { status, body } = await api(`/api/tickets/${ctx.rahulTicketId}/history`, {
      token: ctx.adminToken,
    });

    assert.equal(status, 200);
    assert.ok(body.data.history.length >= 1);

    const entry = body.data.history.at(-1);
    assert.equal(entry.assignedByType, 'SYSTEM');
    assert.ok(['LEAST_LOADED_AGENT', 'QUEUE_DRAIN'].includes(entry.reason));
  });

  test('customers cannot read assignment history', async () => {
    const { status } = await api(`/api/tickets/${ctx.rahulTicketId}/history`, {
      token: ctx.customerToken,
    });
    assert.equal(status, 403);
  });

  test('waiting queue respects priority order', async () => {
    // Take everyone offline so new tickets queue up.
    await setAvailability({
      token: ctx.agents.rahul.token,
      userId: ctx.agents.rahul.id,
      availabilityStatus: 'offline',
    });
    await setAvailability({
      token: ctx.agents.amit.token,
      userId: ctx.agents.amit.id,
      availabilityStatus: 'offline',
    });

    const low = await createTicket(ctx.customerToken, {
      subject: 'Low priority queued first',
      priority: 'LOW',
    });
    const urgent = await createTicket(ctx.customerToken, {
      subject: 'Urgent priority queued second',
      priority: 'URGENT',
    });

    assert.equal(low.body.data.ticket.status, 'WAITING_FOR_AGENT');
    assert.equal(urgent.body.data.ticket.status, 'WAITING_FOR_AGENT');

    // Cap Neha at a single ticket by only briefly making her available is not
    // possible over REST, so instead assert ordering via the drain result:
    // the URGENT ticket must be assigned before the older LOW one.
    const { User } = await import('../src/models/User.js');
    const { processWaitingQueue } = await import('../src/services/assignmentService.js');

    await User.updateOne({ _id: ctx.agents.neha.id }, { $set: { availabilityStatus: 'available' } });
    await processWaitingQueue({ maxAssignments: 1 });

    const urgentAfter = await api(`/api/tickets/${urgent.body.data.ticket._id}`, {
      token: ctx.adminToken,
    });
    const lowAfter = await api(`/api/tickets/${low.body.data.ticket._id}`, {
      token: ctx.adminToken,
    });

    assert.equal(urgentAfter.body.data.ticket.status, 'ASSIGNED', 'URGENT must drain first');
    assert.equal(lowAfter.body.data.ticket.status, 'WAITING_FOR_AGENT', 'LOW must still be queued');

    ctx.lowTicketId = low.body.data.ticket._id;
    ctx.nehaTicketId = urgent.body.data.ticket._id;
  });

  test('remaining queue drains once capacity is free', async () => {
    const { processWaitingQueue } = await import('../src/services/assignmentService.js');
    await processWaitingQueue();

    const { body } = await api(`/api/tickets/${ctx.lowTicketId}`, { token: ctx.adminToken });
    assert.equal(body.data.ticket.status, 'ASSIGNED');
  });
});

/* ========================================================================== */
describe('4. Ticket access control', () => {
  before(async () => {
    const other = await registerCustomer({ name: 'Other Customer', email: 'other@test.com' });
    ctx.otherCustomerToken = other.token;
  });

  test('a customer cannot read another customer ticket', async () => {
    const { status, body } = await api(`/api/tickets/${ctx.rahulTicketId}`, {
      token: ctx.otherCustomerToken,
    });
    assert.equal(status, 403);
    assert.equal(body.errorCode, 'FORBIDDEN');
  });

  test('an agent cannot read a ticket assigned to someone else', async () => {
    const { status } = await api(`/api/tickets/${ctx.nehaTicketId}`, {
      token: ctx.agents.amit.token,
    });
    assert.equal(status, 403);
  });

  test('the assigned agent can read their ticket', async () => {
    const { status } = await api(`/api/tickets/${ctx.nehaTicketId}`, {
      token: ctx.agents.neha.token,
    });
    assert.equal(status, 200);
  });

  test('admin can read any ticket', async () => {
    const { status } = await api(`/api/tickets/${ctx.rahulTicketId}`, { token: ctx.adminToken });
    assert.equal(status, 200);
  });

  test('ticket list is scoped per role', async () => {
    const [customer, agent, admin] = await Promise.all([
      api('/api/tickets?limit=100', { token: ctx.customerToken }),
      api('/api/tickets?limit=100', { token: ctx.agents.neha.token }),
      api('/api/tickets?limit=100', { token: ctx.adminToken }),
    ]);

    assert.ok(
      customer.body.data.tickets.every((ticket) => ticket.createdBy._id === ctx.customerId),
      'customer sees only their own tickets',
    );
    assert.ok(
      agent.body.data.tickets.every((ticket) => ticket.assignedTo?._id === ctx.agents.neha.id),
      'agent sees only assigned tickets',
    );
    assert.ok(
      admin.body.data.tickets.length >= customer.body.data.tickets.length,
      'admin sees everything',
    );
  });

  test('a customer cannot widen scope with an agentId filter', async () => {
    const { body } = await api(`/api/tickets?agentId=${ctx.agents.neha.id}&limit=100`, {
      token: ctx.otherCustomerToken,
    });
    assert.equal(body.data.tickets.length, 0);
  });

  test('search and status filters work', async () => {
    const { body } = await api('/api/tickets?search=Least%20loaded&limit=10', {
      token: ctx.adminToken,
    });
    assert.ok(body.data.tickets.length >= 1);
    assert.ok(body.data.tickets.every((ticket) => /least loaded/i.test(ticket.subject)));
  });

  test('pagination metadata is returned', async () => {
    const { body } = await api('/api/tickets?page=1&limit=2', { token: ctx.adminToken });
    assert.equal(body.data.pagination.page, 1);
    assert.equal(body.data.pagination.limit, 2);
    assert.ok(body.data.pagination.total >= 2);
    assert.ok(body.data.tickets.length <= 2);
  });
});

/* ========================================================================== */
describe('5. Ticket lifecycle', () => {
  test('agent moves ASSIGNED -> IN_PROGRESS', async () => {
    const { status, body } = await api(`/api/tickets/${ctx.nehaTicketId}/status`, {
      method: 'PATCH',
      token: ctx.agents.neha.token,
      body: { status: 'IN_PROGRESS' },
    });

    assert.equal(status, 200);
    assert.equal(body.data.ticket.status, 'IN_PROGRESS');
  });

  test('an invalid transition is rejected', async () => {
    const { status, body } = await api(`/api/tickets/${ctx.nehaTicketId}/status`, {
      method: 'PATCH',
      token: ctx.agents.neha.token,
      body: { status: 'CLOSED' },
    });

    assert.equal(status, 400);
    assert.equal(body.errorCode, 'INVALID_STATUS_TRANSITION');
  });

  test('a customer cannot mark their own ticket resolved', async () => {
    const { status, body } = await api(`/api/tickets/${ctx.nehaTicketId}/status`, {
      method: 'PATCH',
      token: ctx.customerToken,
      body: { status: 'RESOLVED' },
    });

    assert.equal(status, 400);
    assert.equal(body.errorCode, 'INVALID_STATUS_TRANSITION');
  });

  test('IN_PROGRESS -> WAITING_FOR_CUSTOMER -> IN_PROGRESS', async () => {
    const toCustomer = await api(`/api/tickets/${ctx.nehaTicketId}/status`, {
      method: 'PATCH',
      token: ctx.agents.neha.token,
      body: { status: 'WAITING_FOR_CUSTOMER' },
    });
    assert.equal(toCustomer.body.data.ticket.status, 'WAITING_FOR_CUSTOMER');

    const back = await api(`/api/tickets/${ctx.nehaTicketId}/status`, {
      method: 'PATCH',
      token: ctx.agents.neha.token,
      body: { status: 'IN_PROGRESS' },
    });
    assert.equal(back.body.data.ticket.status, 'IN_PROGRESS');
  });

  test('agent resolves, customer closes', async () => {
    const resolved = await api(`/api/tickets/${ctx.nehaTicketId}/status`, {
      method: 'PATCH',
      token: ctx.agents.neha.token,
      body: { status: 'RESOLVED' },
    });
    assert.equal(resolved.body.data.ticket.status, 'RESOLVED');
    assert.ok(resolved.body.data.ticket.resolvedAt);

    const closed = await api(`/api/tickets/${ctx.nehaTicketId}/status`, {
      method: 'PATCH',
      token: ctx.customerToken,
      body: { status: 'CLOSED' },
    });
    assert.equal(closed.body.data.ticket.status, 'CLOSED');
    assert.ok(closed.body.data.ticket.closedAt);
  });

  test('a closed ticket rejects new messages until reopened', async () => {
    const { status, body } = await api(`/api/tickets/${ctx.nehaTicketId}/messages`, {
      method: 'POST',
      token: ctx.customerToken,
      body: { content: 'One more thing...' },
    });

    assert.equal(status, 400);
    assert.equal(body.errorCode, 'TICKET_LOCKED');
  });

  test('customer reopens a closed ticket', async () => {
    const { body } = await api(`/api/tickets/${ctx.nehaTicketId}/status`, {
      method: 'PATCH',
      token: ctx.customerToken,
      body: { status: 'REOPENED' },
    });

    assert.equal(body.data.ticket.status, 'REOPENED');
    assert.equal(body.data.ticket.reopenCount, 1);
  });

  test('messages are accepted again after reopening', async () => {
    const { status } = await api(`/api/tickets/${ctx.nehaTicketId}/messages`, {
      method: 'POST',
      token: ctx.customerToken,
      body: { content: 'Reopening because the issue came back.' },
    });
    assert.equal(status, 201);
  });

  test('agent cannot change priority on a ticket they do not own', async () => {
    const { status } = await api(`/api/tickets/${ctx.nehaTicketId}/priority`, {
      method: 'PATCH',
      token: ctx.agents.amit.token,
      body: { priority: 'URGENT' },
    });
    assert.equal(status, 403);
  });

  test('customer cannot change priority', async () => {
    const { status } = await api(`/api/tickets/${ctx.nehaTicketId}/priority`, {
      method: 'PATCH',
      token: ctx.customerToken,
      body: { priority: 'URGENT' },
    });
    assert.equal(status, 403);
  });
});

/* ========================================================================== */
describe('6. Admin override', () => {
  test('admin reassigns a ticket to a specific agent', async () => {
    const { status, body } = await api(`/api/tickets/${ctx.nehaTicketId}/reassign`, {
      method: 'PATCH',
      token: ctx.adminToken,
      body: { agentId: ctx.agents.amit.id, note: 'Amit has the payment context' },
    });

    assert.equal(status, 200);
    assert.equal(body.data.ticket.assignedTo._id, ctx.agents.amit.id);
  });

  test('the override is recorded in assignment history', async () => {
    const { body } = await api(`/api/tickets/${ctx.nehaTicketId}/history`, {
      token: ctx.adminToken,
    });

    const latest = body.data.history[0];
    assert.equal(latest.reason, 'ADMIN_OVERRIDE');
    assert.equal(latest.assignedByType, 'ADMIN');
    assert.equal(latest.assignedBy._id, ctx.adminId);
  });

  test('an agent cannot reassign a ticket', async () => {
    const { status } = await api(`/api/tickets/${ctx.nehaTicketId}/reassign`, {
      method: 'PATCH',
      token: ctx.agents.rahul.token,
      body: { agentId: ctx.agents.rahul.id },
    });
    assert.equal(status, 403);
  });
});

/* ========================================================================== */
describe('7. Real-time conversation', () => {
  /** Opens both sockets, joins the ticket room on each, returns them. */
  async function openPair() {
    const customerSocket = await connectSocket(ctx.customerToken);
    const agentSocket = await connectSocket(ctx.chatAgent.token);

    const acks = await Promise.all([
      emitWithAck(customerSocket, 'ticket:join', { ticketId: ctx.chatTicketId }),
      emitWithAck(agentSocket, 'ticket:join', { ticketId: ctx.chatTicketId }),
    ]);

    assert.ok(acks.every((ack) => ack.success), `join failed: ${JSON.stringify(acks)}`);
    return { customerSocket, agentSocket };
  }

  before(async () => {
    // Pin the routing so the chat ticket lands on a known agent: everyone off
    // except Neha, who then becomes the counterpart for the whole section.
    await setAvailability({
      token: ctx.agents.rahul.token,
      userId: ctx.agents.rahul.id,
      availabilityStatus: 'offline',
    });
    await setAvailability({
      token: ctx.agents.amit.token,
      userId: ctx.agents.amit.id,
      availabilityStatus: 'offline',
    });
    await setAvailability({
      token: ctx.agents.neha.token,
      userId: ctx.agents.neha.id,
      availabilityStatus: 'available',
    });

    const { body } = await api('/api/tickets', {
      method: 'POST',
      token: ctx.customerToken,
      body: {
        subject: 'Chat test ticket for socket delivery',
        description: 'This ticket is used to verify real-time messaging works.',
        category: 'Technical Issue',
        priority: 'HIGH',
      },
    });

    assert.equal(body.data.ticket.assignedTo?._id, ctx.agents.neha.id);

    ctx.chatTicketId = body.data.ticket._id;
    ctx.chatAgent = ctx.agents.neha;
  });

  test('anonymous socket connections are rejected', SOCKET_TEST, async () => {
    await assert.rejects(() => connectSocket(undefined), /missing|Invalid/i);
  });

  test('a socket with a bad token is rejected', SOCKET_TEST, async () => {
    await assert.rejects(() => connectSocket('garbage.token.value'), /Invalid|expired/i);
  });

  test('an unauthorized user cannot join a ticket room', SOCKET_TEST, async () => {
    const socket = await connectSocket(ctx.otherCustomerToken);

    try {
      const ack = await emitWithAck(socket, 'ticket:join', { ticketId: ctx.chatTicketId });
      assert.equal(ack.success, false);
      assert.equal(ack.errorCode, 'FORBIDDEN');
    } finally {
      socket.disconnect();
    }
  });

  test('a message travels customer -> agent in real time and is persisted', SOCKET_TEST, async () => {
    const { customerSocket, agentSocket } = await openPair();

    try {
      const received = waitFor(agentSocket, 'ticket:message:new');
      customerSocket.emit('ticket:message', {
        ticketId: ctx.chatTicketId,
        content: 'I was charged but my order failed.',
      });

      const payload = await received;
      assert.equal(payload.message.content, 'I was charged but my order failed.');
      assert.equal(payload.message.senderRole, 'customer');

      // MongoDB is the source of truth - the message must survive a fresh read.
      const { body } = await api(`/api/tickets/${ctx.chatTicketId}/messages?limit=100`, {
        token: ctx.chatAgent.token,
      });
      assert.ok(
        body.data.messages.some((m) => m.content === 'I was charged but my order failed.'),
        'message must be persisted in MongoDB',
      );
    } finally {
      customerSocket.disconnect();
      agentSocket.disconnect();
    }
  });

  test('a reply travels agent -> customer in real time', SOCKET_TEST, async () => {
    const { customerSocket, agentSocket } = await openPair();

    try {
      const received = waitFor(customerSocket, 'ticket:message:new');
      agentSocket.emit('ticket:message', {
        ticketId: ctx.chatTicketId,
        content: "Hi, I'll check this for you.",
      });

      const payload = await received;
      assert.equal(payload.message.content, "Hi, I'll check this for you.");
      assert.equal(payload.message.senderRole, 'agent');
    } finally {
      customerSocket.disconnect();
      agentSocket.disconnect();
    }
  });

  test('typing indicators are broadcast but not persisted', SOCKET_TEST, async () => {
    const { customerSocket, agentSocket } = await openPair();

    try {
      const before = await api(`/api/tickets/${ctx.chatTicketId}/messages?limit=100`, {
        token: ctx.adminToken,
      });

      const typing = waitFor(agentSocket, 'ticket:typing:start');
      customerSocket.emit('ticket:typing:start', { ticketId: ctx.chatTicketId });

      const payload = await typing;
      assert.equal(payload.user.role, 'customer');

      const afterList = await api(`/api/tickets/${ctx.chatTicketId}/messages?limit=100`, {
        token: ctx.adminToken,
      });
      assert.equal(
        afterList.body.data.messages.length,
        before.body.data.messages.length,
        'typing must not create a message',
      );
    } finally {
      customerSocket.disconnect();
      agentSocket.disconnect();
    }
  });

  test('a status change emits ticket:status:changed to the room', SOCKET_TEST, async () => {
    const customerSocket = await connectSocket(ctx.customerToken);

    try {
      const ack = await emitWithAck(customerSocket, 'ticket:join', { ticketId: ctx.chatTicketId });
      assert.ok(ack.success);

      const event = waitFor(customerSocket, 'ticket:status:changed');
      await api(`/api/tickets/${ctx.chatTicketId}/status`, {
        method: 'PATCH',
        token: ctx.chatAgent.token,
        body: { status: 'IN_PROGRESS' },
      });

      const payload = await event;
      assert.equal(payload.to, 'IN_PROGRESS');
    } finally {
      customerSocket.disconnect();
    }
  });

  test('an assignment emits ticket:assigned to the chosen agent', SOCKET_TEST, async () => {
    const nehaSocket = await connectSocket(ctx.agents.neha.token);

    try {
      const assigned = waitFor(nehaSocket, 'ticket:assigned', 15000);

      await api('/api/tickets', {
        method: 'POST',
        token: ctx.customerToken,
        body: {
          subject: 'Realtime assignment notification check',
          description: 'Creating a ticket to verify the agent is notified live.',
          category: 'Other',
          priority: 'URGENT',
        },
      });

      const payload = await assigned;
      assert.equal(payload.ticket.assignedTo._id, ctx.agents.neha.id);
    } finally {
      nehaSocket.disconnect();
    }
  });

  test('messages are marked as read', async () => {
    const { status, body } = await api(`/api/tickets/${ctx.chatTicketId}/messages/read`, {
      method: 'PATCH',
      token: ctx.chatAgent.token,
    });

    assert.equal(status, 200);
    assert.ok(body.data.modified >= 0);
  });
});

/* ========================================================================== */
describe('8. Notifications and dashboards', () => {
  test('the agent has notifications for assignment and messages', async () => {
    const { status, body } = await api('/api/notifications', { token: ctx.chatAgent.token });

    assert.equal(status, 200);
    assert.ok(body.data.notifications.length >= 1);
    assert.ok(body.data.unreadCount >= 1);

    ctx.notificationId = body.data.notifications[0]._id;
  });

  test('a notification can be marked read', async () => {
    const { status, body } = await api(`/api/notifications/${ctx.notificationId}/read`, {
      method: 'PATCH',
      token: ctx.chatAgent.token,
    });

    assert.equal(status, 200);
    assert.equal(body.data.notification.isRead, true);
  });

  test('mark-all-read clears the badge', async () => {
    await api('/api/notifications/read-all', { method: 'PATCH', token: ctx.chatAgent.token });
    const { body } = await api('/api/notifications', { token: ctx.chatAgent.token });
    assert.equal(body.data.unreadCount, 0);
  });

  test('a user cannot read another user notifications', async () => {
    const { status } = await api(`/api/notifications/${ctx.notificationId}/read`, {
      method: 'PATCH',
      token: ctx.otherCustomerToken,
    });
    assert.equal(status, 404);
  });

  test('customer dashboard returns scoped stats', async () => {
    const { status, body } = await api('/api/dashboard/customer', { token: ctx.customerToken });

    assert.equal(status, 200);
    assert.ok(body.data.stats.total >= 1);
    assert.ok(Array.isArray(body.data.recentTickets));
    assert.ok(Array.isArray(body.data.timeline));
  });

  test('agent dashboard returns workload stats', async () => {
    const { status, body } = await api('/api/dashboard/agent', { token: ctx.chatAgent.token });

    assert.equal(status, 200);
    assert.ok('activeTickets' in body.data.stats);
    assert.ok('averageWorkload' in body.data.stats);
  });

  test('admin dashboard returns global stats and agent workload', async () => {
    const { status, body } = await api('/api/dashboard/admin', { token: ctx.adminToken });

    assert.equal(status, 200);
    assert.ok(body.data.stats.total >= 1);
    assert.ok(body.data.agentWorkload.length >= 3);
    assert.ok(body.data.timeline.length === 12);
  });
});

/* ========================================================================== */
describe('9. Validation', () => {
  test('a too-short subject is rejected', async () => {
    const { status, body } = await api('/api/tickets', {
      method: 'POST',
      token: ctx.customerToken,
      body: { subject: 'Hi', description: 'Long enough description here', category: 'Other' },
    });

    assert.equal(status, 400);
    assert.equal(body.errorCode, 'VALIDATION_ERROR');
  });

  test('an unknown category is rejected', async () => {
    const { status } = await api('/api/tickets', {
      method: 'POST',
      token: ctx.customerToken,
      body: {
        subject: 'Valid subject here',
        description: 'Valid description that is long enough.',
        category: 'Nonsense',
      },
    });
    assert.equal(status, 400);
  });

  test('an empty message is rejected', async () => {
    const { status } = await api(`/api/tickets/${ctx.chatTicketId}/messages`, {
      method: 'POST',
      token: ctx.customerToken,
      body: { content: '   ' },
    });
    assert.equal(status, 400);
  });

  test('a malformed ticket id returns 400 not 500', async () => {
    const { status } = await api('/api/tickets/not-an-object-id', { token: ctx.adminToken });
    assert.equal(status, 400);
  });

  test('an unknown route returns a structured 404', async () => {
    const { status, body } = await api('/api/does-not-exist', { token: ctx.adminToken });
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.ok(body.errorCode);
  });
});

/* ========================================================================== */
describe('10. Photo sharing in chat', () => {
  const photoFilesOnDisk = async (ticketId) =>
    (await fs.readdir(path.join(TEST_UPLOADS_DIR, ticketId)).catch(() => [])).length;

  const download = (url, token) =>
    fetch(`${BASE_URL}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  before(async () => {
    await setAvailability({
      token: ctx.agents.neha.token,
      userId: ctx.agents.neha.id,
      availabilityStatus: 'available',
    });

    const { body } = await api('/api/tickets', {
      method: 'POST',
      token: ctx.customerToken,
      body: {
        subject: 'Screenshot of the payment error',
        description: 'Attaching a screenshot of the error shown at checkout.',
        category: 'Payment',
        priority: 'URGENT',
      },
    });

    ctx.photoTicketId = body.data.ticket._id;
    const agentId = body.data.ticket.assignedTo?._id;
    const key = Object.keys(ctx.agents).find((k) => ctx.agents[k].id === agentId);
    assert.ok(key, 'photo ticket must be assigned to a known agent');
    ctx.photoAgent = ctx.agents[key];
    ctx.otherAgent = Object.values(ctx.agents).find((agent) => agent.id !== agentId);
  });

  test('a photo with a caption reaches the agent live and is persisted', SOCKET_TEST, async () => {
    const agentSocket = await connectSocket(ctx.photoAgent.token);

    try {
      const join = await emitWithAck(agentSocket, 'ticket:join', { ticketId: ctx.photoTicketId });
      assert.ok(join.success);

      const received = waitFor(agentSocket, 'ticket:message:new');
      const { status, body } = await uploadPhoto({
        ticketId: ctx.photoTicketId,
        token: ctx.customerToken,
        bytes: TINY_PNG,
        filename: 'checkout error.png',
        content: 'This is what I see',
      });

      assert.equal(status, 201, JSON.stringify(body));
      const [attachment] = body.data.message.attachments;
      assert.equal(body.data.message.content, 'This is what I see');
      assert.equal(attachment.mimeType, 'image/png');
      assert.equal(attachment.size, TINY_PNG.length);
      assert.equal(attachment.filename, 'checkout error.png');
      assert.match(attachment.url, new RegExp(`^/api/tickets/${ctx.photoTicketId}/attachments/[a-f0-9]{32}\\.png$`));

      const live = await received;
      assert.equal(live.message.attachments[0].url, attachment.url);

      const history = await api(`/api/tickets/${ctx.photoTicketId}/messages?limit=100`, {
        token: ctx.photoAgent.token,
      });
      assert.ok(history.body.data.messages.some((m) => m.attachments?.[0]?.url === attachment.url));

      ctx.photoUrl = attachment.url;
    } finally {
      agentSocket.disconnect();
    }
  });

  test('a photo can be sent without a caption', async () => {
    const { status, body } = await uploadPhoto({
      ticketId: ctx.photoTicketId,
      token: ctx.photoAgent.token,
      bytes: TINY_PNG,
    });

    assert.equal(status, 201);
    assert.equal(body.data.message.content, '');
    assert.equal(body.data.message.attachments.length, 1);
  });

  test('participants and admins can download the photo byte-for-byte', async () => {
    for (const token of [ctx.customerToken, ctx.photoAgent.token, ctx.adminToken]) {
      const response = await download(ctx.photoUrl, token);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.match(response.headers.get('cache-control'), /private/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), TINY_PNG);
    }
  });

  test('outsiders cannot download the photo', async () => {
    assert.equal((await download(ctx.photoUrl, ctx.otherCustomerToken)).status, 403);
    assert.equal((await download(ctx.photoUrl, ctx.otherAgent.token)).status, 403);
    assert.equal((await download(ctx.photoUrl)).status, 401);
  });

  test('outsiders cannot upload to the ticket', async () => {
    const { status } = await uploadPhoto({
      ticketId: ctx.photoTicketId,
      token: ctx.otherCustomerToken,
      bytes: TINY_PNG,
    });
    assert.equal(status, 403);
  });

  test('a renamed non-image is rejected and never written to disk', async () => {
    const before = await photoFilesOnDisk(ctx.photoTicketId);

    const { status, body } = await uploadPhoto({
      ticketId: ctx.photoTicketId,
      token: ctx.customerToken,
      bytes: Buffer.from('<html><script>alert(1)</script></html> padding padding'),
      filename: 'innocent.png',
      type: 'image/png',
    });

    assert.equal(status, 400);
    assert.equal(body.errorCode, 'VALIDATION_ERROR');
    assert.equal(await photoFilesOnDisk(ctx.photoTicketId), before);
  });

  test('SVG and other non-photo types are rejected', async () => {
    const svg = await uploadPhoto({
      ticketId: ctx.photoTicketId,
      token: ctx.customerToken,
      bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      filename: 'x.svg',
      type: 'image/svg+xml',
    });
    assert.equal(svg.status, 400);

    const pdf = await uploadPhoto({
      ticketId: ctx.photoTicketId,
      token: ctx.customerToken,
      bytes: Buffer.from('%PDF-1.7 fake document body'),
      filename: 'x.pdf',
      type: 'application/pdf',
    });
    assert.equal(pdf.status, 400);
  });

  test('photos over 5 MB are rejected', async () => {
    const oversized = Buffer.concat([TINY_PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const { status, body } = await uploadPhoto({
      ticketId: ctx.photoTicketId,
      token: ctx.customerToken,
      bytes: oversized,
    });

    assert.equal(status, 400);
    assert.match(body.message, /5 MB/);
  });

  test('path traversal in the attachment URL is refused', async () => {
    for (const key of ['..%2F..%2F.env', '..%5C..%5Cpackage.json', 'x.png']) {
      const response = await download(`/api/tickets/${ctx.photoTicketId}/attachments/${key}`, ctx.adminToken);
      assert.notEqual(response.status, 200, `key ${key} must not be served`);
    }
  });

  test('a closed ticket refuses new photos', async () => {
    const statuses = [
      [ctx.photoAgent.token, 'IN_PROGRESS'],
      [ctx.photoAgent.token, 'RESOLVED'],
      [ctx.customerToken, 'CLOSED'],
    ];

    for (const [token, status] of statuses) {
      const result = await api(`/api/tickets/${ctx.photoTicketId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      assert.equal(result.status, 200, `transition to ${status} failed`);
    }

    const { status, body } = await uploadPhoto({
      ticketId: ctx.photoTicketId,
      token: ctx.customerToken,
      bytes: TINY_PNG,
    });

    assert.equal(status, 400);
    assert.equal(body.errorCode, 'TICKET_LOCKED');
  });
});
