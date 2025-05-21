class TicTacToeAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
    }

    makeMove(board) {
        switch (this.difficulty) {
            case 'easy':
                return this.makeRandomMove(board);
            case 'medium':
                return Math.random() < 0.7 ? this.makeBestMove(board) : this.makeRandomMove(board);
            case 'hard':
                return this.makeBestMove(board);
            default:
                return this.makeRandomMove(board);
        }
    }

    makeRandomMove(board) {
        const emptySpots = board.reduce((acc, cell, index) => {
            if (cell === '') acc.push(index);
            return acc;
        }, []);
        
        if (emptySpots.length === 0) return -1;
        return emptySpots[Math.floor(Math.random() * emptySpots.length)];
    }

    makeBestMove(board) {
        let bestScore = -Infinity;
        let bestMove = -1;

        // Try all possible moves
        for (let i = 0; i < board.length; i++) {
            if (board[i] === '') {
                board[i] = 'O';
                let score = this.minimax(board, 0, false);
                board[i] = '';
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }

        return bestMove;
    }

    minimax(board, depth, isMaximizing) {
        const winner = this.checkWinner(board);
        if (winner !== null) {
            return winner === 'O' ? 10 - depth : depth - 10;
        }

        if (!board.includes('')) {
            return 0;
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < board.length; i++) {
                if (board[i] === '') {
                    board[i] = 'O';
                    let score = this.minimax(board, depth + 1, false);
                    board[i] = '';
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < board.length; i++) {
                if (board[i] === '') {
                    board[i] = 'X';
                    let score = this.minimax(board, depth + 1, true);
                    board[i] = '';
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    }

    checkWinner(board) {
        const winConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (let [a, b, c] of winConditions) {
            if (board[a] && board[a] === board[b] && board[b] === board[c]) {
                return board[a];
            }
        }

        return null;
    }
}
