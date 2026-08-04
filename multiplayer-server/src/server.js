import 'dotenv/config';

import { createServer as createHttpServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';

import { verifyJoinToken } from './auth.js';
import { normalizeLobbyCode, validatePlayerState, validateSignal } from './validation.js';

const PLAYER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;

function parseOrigins(value) {
  if (Array.isArray(value)) return value;
  return String(value || '*').split(',').map((item) => item.trim()).filter(Boolean);
}

function originAllowed(origin, allowed) {
  return !origin || allowed.includes('*') || allowed.includes(origin);
}

function safeAck(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

export function createVoiceServer(options = {}) {
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const port = Number(options.port ?? process.env.PORT ?? 7077);
  const maxLobbySize = Math.max(2, Math.min(32, Number(options.maxLobbySize ?? process.env.MAX_LOBBY_SIZE ?? 16)));
  const corsOrigins = parseOrigins(options.corsOrigins ?? process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173');
  const authSecret = String(options.authSecret ?? process.env.AUTH_SECRET ?? '');
  const allowAnonymous = options.allowAnonymous ?? (process.env.ALLOW_ANONYMOUS ? process.env.ALLOW_ANONYMOUS === 'true' : process.env.NODE_ENV !== 'production');
  if (!allowAnonymous && authSecret.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters when anonymous voice access is disabled');
  const app = express();
  const httpServer = createHttpServer(app);
  const rooms = new Map();

  const corsOptions = {
    origin(origin, callback) {
      callback(originAllowed(origin, corsOrigins) ? null : new Error('Origin not allowed'), originAllowed(origin, corsOrigins));
    },
    methods: ['GET', 'POST'],
  };

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_request, response) => {
    const players = [...rooms.values()].reduce((total, room) => total + room.size, 0);
    response.json({ ok: true, service: 'sth-voice-gateway', rooms: rooms.size, players, maxLobbySize });
  });

  const io = new SocketIOServer(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 128 * 1024,
    pingInterval: 20_000,
    pingTimeout: 15_000,
    perMessageDeflate: false,
  });

  io.use((socket, next) => {
    if (!authSecret && allowAnonymous) return next();
    const playerId = verifyJoinToken(socket.handshake.auth?.token, authSecret);
    if (!playerId) return next(new Error('Voice authentication failed'));
    socket.data.authPlayerId = playerId;
    next();
  });

  function roomName(code) {
    return `lobby:${code}`;
  }

  function leaveLobby(socket) {
    const code = socket.data.lobbyCode;
    if (!code) return;
    const room = rooms.get(code);
    const player = room?.get(socket.id);
    room?.delete(socket.id);
    socket.leave(roomName(code));
    socket.data.lobbyCode = null;
    if (room?.size === 0) rooms.delete(code);
    if (player) socket.to(roomName(code)).emit('player:left', { socketId: socket.id, playerId: player.playerId });
  }

  io.on('connection', (socket) => {
    socket.data.lobbyCode = null;
    socket.data.lastStateAt = 0;
    socket.data.signalWindowAt = Date.now();
    socket.data.signalCount = 0;

    socket.on('lobby:join', (payload = {}, ack) => {
      try {
        const lobbyCode = normalizeLobbyCode(payload.lobbyCode);
        const playerId = String(payload.playerId || '').trim();
        const displayName = String(payload.displayName || 'Guest').trim().slice(0, 80);
        if (!PLAYER_ID_PATTERN.test(playerId) || !displayName) return safeAck(ack, { ok: false, error: 'Invalid player identity' });
        if (socket.data.authPlayerId && socket.data.authPlayerId !== playerId) return safeAck(ack, { ok: false, error: 'Authenticated identity mismatch' });

        leaveLobby(socket);
        const room = rooms.get(lobbyCode) ?? new Map();
        if (room.size >= maxLobbySize) return safeAck(ack, { ok: false, error: 'Lobby is full' });

        const player = { socketId: socket.id, playerId, displayName, state: null };
        const peers = [...room.values()].map((peer) => ({ ...peer }));
        room.set(socket.id, player);
        rooms.set(lobbyCode, room);
        socket.data.lobbyCode = lobbyCode;
        socket.join(roomName(lobbyCode));
        socket.to(roomName(lobbyCode)).emit('player:joined', player);
        safeAck(ack, { ok: true, lobbyCode, selfId: socket.id, peers });
      } catch {
        safeAck(ack, { ok: false, error: 'Invalid lobby code' });
      }
    });

    socket.on('player:state', (payload) => {
      const code = socket.data.lobbyCode;
      const room = code && rooms.get(code);
      const player = room?.get(socket.id);
      if (!player) return;
      const now = Date.now();
      if (now - socket.data.lastStateAt < 40) return;
      const state = validatePlayerState(payload);
      if (!state) return;
      socket.data.lastStateAt = now;
      player.state = state;
      socket.to(roomName(code)).volatile.emit('player:state', { socketId: socket.id, playerId: player.playerId, ...state });
    });

    socket.on('webrtc:signal', (payload = {}, ack) => {
      const code = socket.data.lobbyCode;
      const room = code && rooms.get(code);
      if (!room || !room.has(payload.targetId) || !validateSignal(payload.signal)) return safeAck(ack, { ok: false, error: 'Invalid signaling target or payload' });
      const now = Date.now();
      if (now - socket.data.signalWindowAt >= 10_000) {
        socket.data.signalWindowAt = now;
        socket.data.signalCount = 0;
      }
      socket.data.signalCount += 1;
      if (socket.data.signalCount > 80) return safeAck(ack, { ok: false, error: 'Signaling rate limit exceeded' });
      io.to(payload.targetId).emit('webrtc:signal', { fromId: socket.id, signal: payload.signal });
      safeAck(ack, { ok: true });
    });

    socket.on('voice:speaking', (speaking) => {
      const code = socket.data.lobbyCode;
      const room = code && rooms.get(code);
      const player = room?.get(socket.id);
      if (player) socket.to(roomName(code)).volatile.emit('voice:speaking', { socketId: socket.id, playerId: player.playerId, speaking: Boolean(speaking) });
    });

    socket.on('disconnect', () => leaveLobby(socket));
  });

  return {
    app,
    io,
    start() {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          httpServer.off('error', reject);
          resolve(this.address());
        });
      });
    },
    stop() {
      return new Promise((resolve) => io.close(() => httpServer.close(() => resolve())));
    },
    address() {
      return httpServer.address();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const service = createVoiceServer();
  service.start().then((address) => {
    console.log(`Subway-Thots-Hotel voice gateway listening on ${address.address}:${address.port}`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  const shutdown = () => service.stop().finally(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
