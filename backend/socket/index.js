// socket/index.js
// Follows the same pattern as the existing socket infrastructure.
// Adds notifyUser() and broadcast() for use by controllers.

const socketIo = require('socket.io');

let io;

// ─────────────────────────────────────────────────────────────────────────────
// Shared state  (same shape as existing codebase)
//
//  userSockets  – userId → Set<socketId>   (multi-tab safe)
//  socketToUser – socketId → userId        (O(1) reverse lookup)
// ─────────────────────────────────────────────────────────────────────────────
const userSockets  = {};
const socketToUser = {};

// ── helpers ───────────────────────────────────────────────────────────────────

function _addUserSocket(userId, socketId) {
  if (!userSockets[userId]) userSockets[userId] = new Set();
  userSockets[userId].add(socketId);
  socketToUser[socketId] = userId;
}

function _removeUserSocket(userId, socketId) {
  if (userSockets[userId]) {
    userSockets[userId].delete(socketId);
    if (userSockets[userId].size === 0) delete userSockets[userId];
  }
  delete socketToUser[socketId];
}

function _userIdForSocket(socketId) {
  return socketToUser[socketId];
}

/** Emit to ALL active sockets of a user — multi-tab safe. */
function _emitToUser(userId, event, data) {
  const sockets = userSockets[String(userId)];
  if (!sockets || sockets.size === 0) return false;
  for (const socketId of sockets) {
    io.to(socketId).emit(event, data);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

function initSocket(server) {
  io = socketIo(server, {
    cors: {
      origin:  process.env.FRONTEND_URL || process.env.ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout:  5000,
  });

  console.log('✅ Socket.io initialized — KKKT Yombo DMP');

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Register user ─────────────────────────────────────────────────────
    // Uses 'loginUser' — same event name as the existing codebase so
    // the pending page and dashboard share one connection pattern.
    socket.on('loginUser', ({ userId }) => {
      if (!userId) return;
      const uid = String(userId);
      _addUserSocket(uid, socket.id);
      socket.join(`user_${uid}`);
      console.log(`👤 User ${uid} registered on socket ${socket.id}`);
      socket.emit('loginUserAck', { status: 'ok', userId: uid });
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const userId = _userIdForSocket(socket.id);
      if (userId) {
        _removeUserSocket(userId, socket.id);
        const remaining = userSockets[userId]?.size ?? 0;
        console.log(
          remaining > 0
            ? `ℹ️  User ${userId} still has ${remaining} socket(s) — staying online`
            : `📤 User ${userId} fully disconnected`
        );
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized — call initSocket(server) first');
  return io;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — called by controllers, never touch io directly from outside
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Push a typed notification to a specific user over their socket.
 * Frontend receives:  { type, ...payload, timestamp }
 *
 * Supported types:
 *   'account_approved' | 'account_rejected' | 'new_application' | 'general'
 */
function notifyUser(userId, type, payload = {}) {
  const delivered = _emitToUser(String(userId), 'notification', {
    type,
    ...payload,
    timestamp: new Date(),
  });
  console.log(
    delivered
      ? `📨 [socket] '${type}' → user ${userId}`
      : `⚠️  [socket] '${type}' — user ${userId} offline, not delivered`
  );
  return delivered;
}

/**
 * Broadcast to ALL connected sockets.
 * Used to push new_member_application to pastor dashboards.
 */
function broadcast(event, data) {
  if (!io) { console.warn('broadcast() called before initSocket()'); return; }
  io.emit(event, { ...data, timestamp: new Date() });
  console.log(`📢 [socket] broadcast: ${event}`);
}

module.exports = { initSocket, getIo, notifyUser, broadcast, userSockets };