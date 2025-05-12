const socket = io();

const board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = null;
let mySymbol = null;
let gameActive = false;

const statusDisplay = document.querySelector('.status');
const cells = document.querySelectorAll('.cell');
const restartButton = document.querySelector('.restart');

function handleCellClick(clickedCell, clickedCellIndex) {
    if (!gameActive || board[clickedCellIndex] !== '' || currentPlayer !== mySymbol) return;

    makeMove(clickedCellIndex, mySymbol);
    socket.emit('move', {
        index: clickedCellIndex,
        symbol: mySymbol
    });
}

function makeMove(index, symbol) {
    board[index] = symbol;
    cells[index].textContent = symbol;
    cells[index].classList.add(symbol.toLowerCase());
    checkResult();
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
    for (let [a, b, c] of winConditions) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            roundWon = true;
            [a, b, c].forEach(index => cells[index].classList.add('winner'));
            break;
        }
    }

    if (roundWon) {
        const winner = board[winConditions.find(([a]) => board[a] === board[winConditions[0][1]])[0]];
        statusDisplay.textContent = winner === mySymbol ? 'You win!' : 'Opponent wins!';
        gameActive = false;
        return;
    }

    if (!board.includes('')) {
        statusDisplay.textContent = 'Draw!';
        gameActive = false;
        return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    if (currentPlayer === mySymbol) {
        statusDisplay.textContent = 'Your turn!';
    } else {
        statusDisplay.textContent = 'Opponent\'s turn...';
    }
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
    gameActive = true;
    socket.emit('restart-request');
}

restartButton.addEventListener('click', resetBoard);

cells.forEach((cell, index) => {
    cell.addEventListener('click', () => handleCellClick(cell, index));
});
