const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./logger');
const db = require('./database');

class DatabaseUtils {
    static async checkDatabaseHealth() {
        try {
            // Initialize database
            await db.init();

            // Get database tables
            const tables = await this.getTables();
            logger.info('Database tables found:', { tables });

            // Clean up orphaned records
            await this.cleanupOrphanedRecords();
            
            return true;
        } catch (error) {
            logger.error('Database health check failed:', error);
            return false;
        }
    }

    static async getTables() {
        const database = await db.init();
        return new Promise((resolve, reject) => {
            database.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(tables.map(t => t.name));
                }
            });
        });
    }

    static async cleanupOrphanedRecords() {
        const database = await db.init();
        return new Promise((resolve, reject) => {
            database.run(`
                DELETE FROM players 
                WHERE room_id NOT IN (SELECT room_id FROM rooms)
            `, (err) => {
                if (err) {
                    logger.error('Failed to cleanup orphaned records:', err);
                    reject(err);
                } else {
                    logger.info('Orphaned records cleaned up successfully');
                    resolve();
                }
            });
        });
    }

    static async getDatabaseStats() {
        const database = await db.init();
        try {
            const stats = {
                totalRooms: await this.getCount('rooms'),
                totalPlayers: await this.getCount('players'),
                activeGames: await this.getActiveGames()
            };
            
            logger.info('Database stats:', stats);
            return stats;
        } catch (error) {
            logger.error('Failed to get database stats:', error);
            throw error;
        }
    }

    static async getCount(table) {
        const database = await db.init();
        return new Promise((resolve, reject) => {
            database.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    static async getActiveGames() {
        const database = await db.init();
        return new Promise((resolve, reject) => {
            database.get(`
                SELECT COUNT(DISTINCT room_id) as count 
                FROM players 
                GROUP BY room_id 
                HAVING COUNT(*) = 2
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });
    }
}

module.exports = DatabaseUtils;
