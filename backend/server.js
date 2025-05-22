const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database');
const logger = require('./logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (HTML, CSS, JS)
const srcPath = path.join(__dirname, '..', 'tic-tac-toe', 'src');

// Serve index.html directly
app.get('/', (req, res) => {
    res.sendFile(path.join(srcPath, 'index.html'));
});

// Serve static files (scripts, styles) from /src
app.use(express.static(srcPath));

// Optional: suppress favicon warning
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Game stats endpoint
app.get('/stats', async (req, res) => {    try {
        const stats = await db.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get stats:', error);
        res.status(500).json({ error: 'Failed to get game statistics' });
    }
});

// In-memory cache for active games
const rooms = new Map(); // Store room information
const usernames = new Map(); // Store username information
const initialGameState = ['', '', '', '', '', '', '', '', ''];

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    logger.info('Client connected:', { socketId: socket.id });socket.on('create-room', async ({ username }) => {
        try {
            const roomId = generateRoomId();
            const initialBoard = ['', '', '', '', '', '', '', '', ''];
            
            // Create room in database
            await db.createRoom(roomId);
            await db.addPlayer(socket.id, username, roomId, 'X');
            await db.updateGameState(roomId, initialBoard);
            
            // Set up in-memory state
            rooms.set(roomId, {
                players: [{ id: socket.id, username, symbol: 'X' }],
                board: [...initialBoard]
            });
            
            socket.join(roomId);
            usernames.set(socket.id, username);
            socket.emit('room-created', { roomId });
            socket.emit('player-assigned', 'X');
            
            logger.info('Room created with initial state', { roomId, username });
        } catch (error) {
            logger.error('Error creating room:', error);
            socket.emit('error', { message: 'Failed to create room' });
        }
    });    socket.on('join-room', async ({ username, roomId }) => {
        try {
            const roomData = await db.getRoom(roomId);
            
            if (roomData.length === 0) {
                socket.emit('invalid-room');
                return;
            }

            const playersInRoom = roomData.filter(row => row.socket_id !== null);
            if (playersInRoom.length >= 2) {
                socket.emit('room-full');
                return;
            }

            // Get current game state from database
            const gameState = await db.getGameState(roomId);
            
            await db.addPlayer(socket.id, username, roomId, 'O');
            
            const room = rooms.get(roomId) || {
                players: [],
                board: gameState || [...initialGameState]
            };
            room.players.push({ id: socket.id, username, symbol: 'O' });
            rooms.set(roomId, room);

            socket.join(roomId);
            usernames.set(socket.id, username);
            
            socket.emit('joined-room', { 
                roomId,
                gameState: room.board // Send current game state to new player
            });
            socket.emit('player-assigned', 'O');
            io.to(roomId).emit('start-game');
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });    socket.on('move', async ({ index, symbol, room }) => {
        try {
            if (rooms.has(room)) {
                const roomData = rooms.get(room);
                
                // Update in-memory board state
                roomData.board[index] = symbol;
                
                // Update database
                await db.updateGameState(room, roomData.board);
                logger.debug('Move saved to database', { room, index, symbol });
                
                // Notify other players
                socket.to(room).emit('move', { index, symbol });
            }
        } catch (error) {
            logger.error('Failed to process move:', error);
            socket.emit('error', { message: 'Failed to save game state' });
        }
    });    socket.on('restart-request', async () => {
        try {
            const roomId = Array.from(socket.rooms)[1];
            if (roomId && rooms.has(roomId)) {
                const roomData = rooms.get(roomId);
                const initialBoard = ['', '', '', '', '', '', '', '', ''];
                
                // Update in-memory state
                roomData.board = [...initialBoard];
                
                // Update database
                await db.updateGameState(roomId, initialBoard);
                logger.debug('Game reset in database', { roomId });
                
                // Notify players
                io.to(roomId).emit('start-game');
            }
        } catch (error) {
            logger.error('Failed to reset game:', error);
            socket.emit('error', { message: 'Failed to reset game' });
        }
    });socket.on('disconnect', async () => {
        try {
            logger.info('Client disconnected:', { socketId: socket.id });
            
            // Remove player from database and get their room
            await db.removePlayer(socket.id);
            
            // Find and clean up the room this player was in
            for (const [roomId, room] of rooms.entries()) {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    
                    // Clean up room in database if empty
                    const wasDeleted = await db.cleanupRoom(roomId);
                    if (wasDeleted) {
                        rooms.delete(roomId);
                    } else {
                        io.to(roomId).emit('player-disconnected');
                    }
                    break;
                }
            }
            
            usernames.delete(socket.id);
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    logger.info(`Server running at http://localhost:${PORT}`);
}).on('error', (error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});
