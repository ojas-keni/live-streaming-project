const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (optional)
app.use(express.static('public'));

// Store active users and events
const activeUsers = {};
const eventRooms = {};

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join an event room
    socket.on('joinEvent', ({ userId, eventId }) => {
        socket.join(eventId);
        console.log(`User ${userId} joined event ${eventId}`);

        // Add user to the event room
        if (!eventRooms[eventId]) {
            eventRooms[eventId] = [];
        }
        eventRooms[eventId].push(userId);

        // Notify all participants in the event
        io.to(eventId).emit('userJoined', { userId, eventId });

        // Broadcast participant list
        io.to(eventId).emit('participantList', eventRooms[eventId]);
    });

    // Leave an event room
    socket.on('leaveEvent', ({ userId, eventId }) => {
        socket.leave(eventId);
        console.log(`User ${userId} left event ${eventId}`);

        // Remove user from the event room
        if (eventRooms[eventId]) {
            eventRooms[eventId] = eventRooms[eventId].filter((id) => id !== userId);
        }

        // Notify all participants in the event
        io.to(eventId).emit('userLeft', { userId, eventId });

        // Broadcast updated participant list
        io.to(eventId).emit('participantList', eventRooms[eventId]);
    });

    // Send messages within an event
    socket.on('sendMessage', ({ eventId, message, senderId }) => {
        const timestamp = new Date().toISOString();
        io.to(eventId).emit('receiveMessage', { senderId, message, timestamp });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);

        // Remove user from all events
        for (const [eventId, participants] of Object.entries(eventRooms)) {
            eventRooms[eventId] = participants.filter((id) => id !== socket.id);

            // Notify the event room if the user was part of it
            if (participants.includes(socket.id)) {
                io.to(eventId).emit('userLeft', { userId: socket.id, eventId });
                io.to(eventId).emit('participantList', eventRooms[eventId]);
            }
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});