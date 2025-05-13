const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, 'game.log');

function formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level}: ${message}`;
    return data ? `${logMessage}\n${JSON.stringify(data, null, 2)}` : logMessage;
}

const logger = {
    info: (message, data = null) => {
        const log = formatMessage('INFO', message, data);
        fs.appendFileSync(logFile, log + '\n');
        console.log(log);
    },

    error: (message, error = null) => {
        const log = formatMessage('ERROR', message, error);
        fs.appendFileSync(logFile, log + '\n');
        console.error(log);
    },

    debug: (message, data = null) => {
        const log = formatMessage('DEBUG', message, data);
        fs.appendFileSync(logFile, log + '\n');
        if (process.env.NODE_ENV !== 'production') {
            console.debug(log);
        }
    }
};

module.exports = logger;
