const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (HTML, CSS, JS)
const srcPath = path.join(__dirname, '..', 'tic-tac-toe', 'src');
const publicPath = path.join(__dirname, '..', 'tic-tac-toe', 'public');

// Serve index.html directly
app.get('/', (req, res) => {
    res.sendFile(path.join(srcPath, 'index.html'));
});

// Serve static files (scripts, styles) from /src
app.use(express.static(srcPath));

// Optional: suppress favicon warning
app.get('/favicon.ico', (req, res) => res.status(204).end());
let players = [];

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Assign player if there's room
    if (players.length < 2) {
        players.push(socket.id);
        const symbol = players.length === 1 ? 'X' : 'O';
        socket.emit('player-assigned', symbol);

        if (players.length === 2) {
            io.emit('start-game');
        }
    } else {
        socket.emit('room-full');
        socket.disconnect(true);
    }

    // Broadcast move to the other player
    socket.on('move', (data) => {
        socket.broadcast.emit('move', data);
    });

    // Handle restart request
    socket.on('restart-request', () => {
        io.emit('start-game');
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        players = players.filter(id => id !== socket.id);
        io.emit('player-disconnected');
    });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
