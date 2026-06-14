import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

app.use(cors({ origin: CLIENT_URL }));

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
});

// roomId -> { host: socketId, peer: socketId|null }
const rooms = new Map();

function makeRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    let id = makeRoomId();
    while (rooms.has(id)) id = makeRoomId();
    rooms.set(id, { host: socket.id, peer: null });
    socket.join(id);
    socket.emit('room-created', { roomId: id });
  });

  socket.on('join-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.peer) {
      socket.emit('room-error', { message: 'Room not found or full' });
      return;
    }
    room.peer = socket.id;
    socket.join(roomId);
    socket.emit('room-joined', { roomId });
    socket.to(roomId).emit('peer-joined');
  });

  socket.on('offer',         ({ roomId, offer })     => socket.to(roomId).emit('offer', offer));
  socket.on('answer',        ({ roomId, answer })    => socket.to(roomId).emit('answer', answer));
  socket.on('ice-candidate', ({ roomId, candidate }) => socket.to(roomId).emit('ice-candidate', candidate));

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.host === socket.id) {
        rooms.delete(roomId);
        socket.to(roomId).emit('peer-disconnected');
      } else if (room.peer === socket.id) {
        room.peer = null;
        socket.to(roomId).emit('peer-disconnected');
      }
    }
  });
});

app.get('/', (_, res) => res.json({ status: 'ok', service: 'PeerDrop' }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
