/**
 * SOCKET.IO - Real-time event system
 *
 * Rooms:
 *   hospital_{id}                  - Staff and admin dashboards
 *   hospital_{id}_doc_{docId}      - Per-doctor staff view
 *   display_{id}                   - Hospital-level display screens
 *   display_{id}_{docId}           - Per-doctor display screens
 */
const { Server } = require('socket.io');

module.exports = function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Reduce ping interval for faster reconnects
    pingInterval: 5000,
    pingTimeout: 10000,
  });

  io.on('connection', socket => {
    // Staff/admin joins hospital room
    socket.on('join_hospital', id => {
      socket.join(`hospital_${id}`);
    });

    // Staff joins doctor-specific room
    socket.on('join_doctor_room', ({ hospitalId, doctorId }) => {
      socket.join(`hospital_${hospitalId}`);
      if (doctorId) socket.join(`hospital_${hospitalId}_doc_${doctorId}`);
    });

    // Display screens join display rooms
    socket.on('join_display', ({ hospitalId, doctorId }) => {
      socket.join(`display_${hospitalId}`);
      if (doctorId) socket.join(`display_${hospitalId}_${doctorId}`);
    });

    socket.on('disconnect', () => {});
  });

  return io;
};
