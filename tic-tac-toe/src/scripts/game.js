const socket = io();

const board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = null;
let mySymbol = null;
let gameActive = false;
let currentRoom = null;
let username = null;
let isAIGame = false;
let ai = null;

const statusDisplay = document.querySelector('.status');
const roomInfo = document.querySelector('.room-info');
const cells = document.querySelectorAll('.cell');
const restartButton = document.querySelector('.restart');
const authSection = document.getElementById('auth-section');
const gameSection = document.getElementById('game-section');
const usernameInput = document.getElementById('username');
const roomIdInput = document.getElementById('roomId');
const joinRoomButton = document.getElementById('joinRoom');
const createRoomButton = document.getElementById('createRoom');

function handleCellClick(clickedCell, clickedCellIndex) {
    if (!gameActive || board[clickedCellIndex] !== '' || currentPlayer !== mySymbol) return;

    makeMove(clickedCellIndex, mySymbol);
    socket.emit('move', {
        index: clickedCellIndex,
        symbol: mySymbol,
        room: currentRoom
    });
}

function handleAIMove() {
    if (isAIGame && currentPlayer === 'O' && gameActive) {
        setTimeout(() => {
            const aiMove = ai.makeMove([...board]);
            if (aiMove !== -1) {
                makeMove(aiMove, 'O');
            }
        }, 500); // Add delay to make AI moves feel more natural
    }
}

function makeMove(index, symbol) {
    board[index] = symbol;
    cells[index].textContent = symbol;
    cells[index].classList.add(symbol.toLowerCase());
    checkResult();

    if (isAIGame) {
        handleAIMove();
    }
}

socket.on('move', ({ index, symbol }) => {
    makeMove(index, symbol);
});

function checkResult() {
    const winConditions = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];

    let roundWon = false;
    let winningSymbol = null;

    for (let [a, b, c] of winConditions) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            roundWon = true;
            winningSymbol = board[a];
            [a, b, c].forEach(index => cells[index].classList.add('winner'));
            break;
        }
    }

    if (roundWon) {
        gameActive = false;
        if (isAIGame) {
            statusDisplay.textContent = winningSymbol === 'X' ? 'Game Over - You win!' : 'Game Over - AI wins!';
        } else {
            statusDisplay.textContent = winningSymbol === mySymbol ? 'Game Over - You win!' : 'Game Over - Opponent wins!';
        }
        return;
    }

    if (!board.includes('')) {
        gameActive = false;
        statusDisplay.textContent = 'Game Over - Draw!';
        return;
    }

    // Switch turn only if no win/draw
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    statusDisplay.textContent = currentPlayer === mySymbol 
        ? 'Your turn!' 
        : (isAIGame ? 'AI is thinking...' : 'Opponent\'s turn...');
}

socket.on('player-assigned', (symbol) => {
    mySymbol = symbol;
    currentPlayer = 'X'; // X always starts
    statusDisplay.textContent = `You are ${symbol}. Waiting for opponent...`;
});

socket.on('start-game', () => {
    gameActive = true;
    statusDisplay.textContent = currentPlayer === mySymbol ? 'Your turn!' : 'Opponent\'s turn...';
});

socket.on('player-disconnected', () => {
    gameActive = false;
    statusDisplay.textContent = 'Opponent disconnected. Waiting for new player...';
});

socket.on('room-full', () => {
    statusDisplay.textContent = 'Game room is full. Please try again later.';
});

function resetBoard() {
    board.fill('');
    cells.forEach(cell => {
        cell.textContent = '';
        cell.className = 'cell';
    });
    currentPlayer = 'X';
    
    if (isAIGame) {
        gameActive = true;
        mySymbol = 'X';  // Ensure player is always X in AI games
        statusDisplay.textContent = 'New Game - Your turn!';
    } else {
        gameActive = false;  // Wait for opponent confirmation
        socket.emit('restart-request');
        statusDisplay.textContent = 'Waiting for opponent to restart...';
    }
}

restartButton.addEventListener('click', resetBoard);

cells.forEach((cell, index) => {
    cell.addEventListener('click', () => handleCellClick(cell, index));
});

createRoomButton.addEventListener('click', () => {
    if (!usernameInput.value) {
        alert('Please enter a username');
        return;
    }
    username = usernameInput.value;
    socket.emit('create-room', { username });
});

joinRoomButton.addEventListener('click', () => {
    if (!usernameInput.value || !roomIdInput.value) {
        alert('Please enter both username and room ID');
        return;
    }
    username = usernameInput.value;
    const roomId = roomIdInput.value;
    socket.emit('join-room', { username, roomId });
});

document.getElementById('playAI').addEventListener('click', () => {
    if (!usernameInput.value) {
        alert('Please enter your username');
        return;
    }

    username = usernameInput.value;
    const difficulty = document.getElementById('aiDifficulty').value;
    
    isAIGame = true;
    ai = new TicTacToeAI(difficulty);
    mySymbol = 'X';
    currentPlayer = 'X';
    gameActive = true;

    authSection.style.display = 'none';
    gameSection.style.display = 'block';
    statusDisplay.textContent = 'Your turn!';
    roomInfo.textContent = `Playing against AI (${difficulty} difficulty)`;

    // Reset board if needed
    resetBoard();
});

socket.on('room-created', ({ roomId }) => {
    currentRoom = roomId;
    authSection.style.display = 'none';
    gameSection.style.display = 'block';
    roomInfo.textContent = `Room ID: ${roomId}`;
    statusDisplay.textContent = 'Waiting for opponent to join...';
});

socket.on('joined-room', ({ roomId }) => {
    currentRoom = roomId;
    authSection.style.display = 'none';
    gameSection.style.display = 'block';
    roomInfo.textContent = `Room ID: ${roomId}`;
});

socket.on('invalid-room', () => {
    alert('Invalid room ID. Please try again.');
});
