const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');

// Database connection management
let db = null;

function connectToDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        db = new sqlite3.Database(path.join(__dirname, 'game.db'), (err) => {
            if (err) {
                logger.error('Failed to connect to database:', err);
                reject(err);
            } else {
                logger.info('Connected to SQLite database');
                initializeTables(db).then(() => resolve(db)).catch(reject);
            }
        });
    });
}

async function initializeTables(database) {
    return new Promise((resolve, reject) => {
        database.serialize(() => {
            try {                // Create rooms table
                database.run(`
                    CREATE TABLE IF NOT EXISTS rooms (
                        room_id TEXT PRIMARY KEY,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        game_state TEXT DEFAULT '["","","","","","","","",""]',
                        is_active BOOLEAN DEFAULT 1,
                        winner TEXT DEFAULT NULL
                    )
                `);

                // Create players table
                database.run(`
                    CREATE TABLE IF NOT EXISTS players (
                        socket_id TEXT PRIMARY KEY,
                        username TEXT NOT NULL,
                        room_id TEXT,
                        symbol TEXT,
                        FOREIGN KEY (room_id) REFERENCES rooms(room_id)
                    )
                `);

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Database operations
const dbOperations = {
    async init() {
        await connectToDatabase();
    },

    // Add a new room
    async createRoom(roomId) {
        const db = await connectToDatabase();
        return new Promise((resolve, reject) => {
            logger.debug('Creating new room:', { roomId });
            db.run('INSERT INTO rooms (room_id) VALUES (?)', [roomId], (err) => {
                if (err) {
                    logger.error(`Failed to create room ${roomId}:`, err);
                    reject(err);
                } else {
                    logger.info('Room created successfully:', { roomId });
                    resolve();
                }
            });
        });
    },

    // Add a new player
    async addPlayer(socketId, username, roomId, symbol) {
        const db = await connectToDatabase();
        return new Promise((resolve, reject) => {
            logger.debug('Adding new player:', { socketId, username, roomId, symbol });
            db.run(
                'INSERT INTO players (socket_id, username, room_id, symbol) VALUES (?, ?, ?, ?)',
                [socketId, username, roomId, symbol],
                (err) => {
                    if (err) {
                        logger.error(`Failed to add player ${username}:`, err);
                        reject(err);
                    } else {
                        logger.info('Player added successfully:', { username, roomId });
                        resolve();
                    }
                }
            );
        });
    },

    // Get room details
    async getRoom(roomId) {
        const db = await connectToDatabase();
        return new Promise((resolve, reject) => {
            logger.debug('Fetching room details:', { roomId });
            db.all(
                `SELECT r.*, p.socket_id, p.username, p.symbol 
                FROM rooms r 
                LEFT JOIN players p ON r.room_id = p.room_id 
                WHERE r.room_id = ?`,
                [roomId],
                (err, rows) => {
                    if (err) {
                        logger.error(`Failed to get room ${roomId}:`, err);
                        reject(err);
                    } else {
                        logger.debug('Room details retrieved:', { roomId, playerCount: rows.length });
                        resolve(rows);
                    }
                }
            );
        });
    },

    // Remove a player
    async removePlayer(socketId) {
        const db = await connectToDatabase();
        return new Promise((resolve, reject) => {
            logger.debug('Removing player:', { socketId });
            db.run('DELETE FROM players WHERE socket_id = ?', [socketId], (err) => {
                if (err) {
                    logger.error(`Failed to remove player ${socketId}:`, err);
                    reject(err);
                } else {
                    logger.info('Player removed successfully:', { socketId });
                    resolve();
                }
            });
        });
    },

    // Clean up empty rooms
    async cleanupRoom(roomId) {
        const db = await connectToDatabase();
        return new Promise((resolve, reject) => {
            logger.debug('Checking room for cleanup:', { roomId });
            db.get(
                'SELECT COUNT(*) as count FROM players WHERE room_id = ?',
                [roomId],
                (err, row) => {
                    if (err) {
                        logger.error(`Failed to check room ${roomId}:`, err);
                        reject(err);
                        return;
                    }
                    if (row.count === 0) {
                        logger.debug('Room is empty, deleting:', { roomId });
                        db.run('DELETE FROM rooms WHERE room_id = ?', [roomId], (err) => {
                            if (err) {
                                logger.error(`Failed to delete room ${roomId}:`, err);
                                reject(err);
                            } else {
                                logger.info('Room deleted successfully:', { roomId });
                                resolve(true);
                            }
                        });
                    } else {
                        logger.debug('Room still has players, keeping:', { roomId, playerCount: row.count });
                        resolve(false);
                    }
                }
            );
        });
    },

    // Update game state in database
    async updateGameState(roomId, gameState) {
        try {
            const db = await connectToDatabase();
            logger.debug('Updating game state:', { roomId, gameState });
            
            return new Promise((resolve, reject) => {
                const stateJson = JSON.stringify(gameState);
                db.run(
                    'UPDATE rooms SET game_state = ? WHERE room_id = ?',
                    [stateJson, roomId],
                    (err) => {
                        if (err) {
                            logger.error('Failed to update game state:', err);
                            reject(err);
                        } else {
                            logger.info('Game state updated successfully');
                            resolve();
                        }
                    }
                );
            });
        } catch (error) {
            logger.error('Database error in updateGameState:', error);
            throw error;
        }
    },

    // Get current game state from database
    async getGameState(roomId) {
        try {
            const db = await connectToDatabase();
            logger.debug('Getting game state for room:', roomId);
            
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT game_state FROM rooms WHERE room_id = ?',
                    [roomId],
                    (err, row) => {
                        if (err) {
                            logger.error('Failed to get game state:', err);
                            reject(err);
                        } else {
                            const gameState = row?.game_state ? JSON.parse(row.game_state) : null;
                            logger.debug('Retrieved game state:', gameState);
                            resolve(gameState);
                        }
                    }
                );
            });
        } catch (error) {
            logger.error('Database error in getGameState:', error);
            throw error;
        }
    },

    // Update winner
    async updateWinner(roomId, winner) {
        const db = await connectToDatabase();
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE rooms SET winner = ?, is_active = 0 WHERE room_id = ?',
                [winner, roomId],
                (err) => {
                    if (err) {
                        logger.error(`Failed to update winner for room ${roomId}:`, err);
                        reject(err);
                    } else {
                        logger.debug('Winner updated:', { roomId, winner });
                        resolve();
                    }
                }
            );
        });
    },

    // Close database connection
    async close() {
        if (db) {
            return new Promise((resolve, reject) => {
                db.close((err) => {
                    if (err) {
                        logger.error('Error closing database:', err);
                        reject(err);
                    } else {
                        logger.info('Database connection closed');
                        db = null;
                        resolve();
                    }
                });
            });
        }
    }
};

module.exports = dbOperations;
