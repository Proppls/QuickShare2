import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const allowedOrigins = CLIENT_URL.split(',').map(u => u.trim());

app.use(cors({ origin: allowedOrigins }));

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

/**
 * rooms: Map<roomId, {
 *   host: socketId,          // creator (sender)
 *   peers: Map<socketId, { role: 'sender'|'receiver'|'seeder' }>
 * }>
 *
 * Mesh swarm: every peer in the room can connect to every other peer.
 * The signaling server routes offers/answers/ICE by explicit targetId.
 */
const rooms = new Map();

function makeRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {

  // ── Create room (sender) ──────────────────────────────────────────
  socket.on('create-room', () => {
    let id = makeRoomId();
    while (rooms.has(id)) id = makeRoomId();

    rooms.set(id, {
      host: socket.id,
      peers: new Map([[socket.id, { role: 'sender' }]]),
    });

    socket.join(id);
    socket.emit('room-created', { roomId: id });
    console.log(`[${id}] Room created by ${socket.id}`);
  });

  // ── Join room (receiver / seeder) ─────────────────────────────────
  socket.on('join-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }

    // Collect existing peer list BEFORE adding the new peer
    const existingPeers = [...room.peers.entries()].map(([sid, info]) => ({
      socketId: sid,
      role: info.role,
    }));

    // Add new peer
    room.peers.set(socket.id, { role: 'receiver' });
    socket.join(roomId);

    // Tell the new peer: here are all existing peers — connect to each of them
    socket.emit('room-joined', {
      roomId,
      peers: existingPeers,          // [{socketId, role}]
      swarmSize: room.peers.size,
    });

    // Tell every existing peer: a new leecher joined
    for (const [existingSid] of room.peers) {
      if (existingSid === socket.id) continue;
      io.to(existingSid).emit('swarm-peer-joined', {
        newPeerId: socket.id,
        swarmSize: room.peers.size,
      });
    }

    console.log(`[${roomId}] Peer ${socket.id} joined (swarm size: ${room.peers.size})`);
  });

  // ── Targeted WebRTC signaling ─────────────────────────────────────
  // All signals now carry { roomId, targetId, ... }

  socket.on('offer', ({ roomId, targetId, offer }) => {
    io.to(targetId).emit('offer', { fromId: socket.id, offer });
  });

  socket.on('answer', ({ roomId, targetId, answer }) => {
    io.to(targetId).emit('answer', { fromId: socket.id, answer });
  });

  socket.on('ice-candidate', ({ roomId, targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', { fromId: socket.id, candidate });
  });

  // ── Seeder promotion: peer finished downloading, now can serve others ──
  socket.on('promote-to-seeder', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.peers.has(socket.id)) {
      room.peers.get(socket.id).role = 'seeder';
      // Notify others in the room that this peer is now a seeder
      socket.to(roomId).emit('peer-promoted', { peerId: socket.id });
      console.log(`[${roomId}] Peer ${socket.id} promoted to seeder`);
    }
  });

  // ── Disconnect ────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.peers.has(socket.id)) continue;

      const wasHost = room.host === socket.id;
      room.peers.delete(socket.id);

      if (wasHost || room.peers.size === 0) {
        rooms.delete(roomId);
        socket.to(roomId).emit('peer-disconnected', { peerId: socket.id, roomClosed: true });
        console.log(`[${roomId}] Room closed (host left)`);
      } else {
        socket.to(roomId).emit('peer-disconnected', { peerId: socket.id, roomClosed: false });
        console.log(`[${roomId}] Peer ${socket.id} left (swarm size: ${room.peers.size})`);
      }
    }
  });
});

app.get('/', (_, res) => res.json({ status: 'ok', service: 'PeerDrop Swarm' }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`PeerDrop swarm server running on port ${PORT}`));
