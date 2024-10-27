import { io, Socket } from 'socket.io-client';

interface Player {
    id: string;
    x: number;
    y: number;
    angle: number;
}

class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private socket: Socket;
    private players: Map<string, Player> = new Map();
    private playerSprite: HTMLImageElement;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.socket = io('http://localhost:3000');
        this.playerSprite = new Image();
        this.playerSprite.src = 'assets/player.png';

        this.setupSocketListeners();
        this.setupInputListeners();
        this.gameLoop();
    }

    private setupSocketListeners() {
        this.socket.on('players', (players: Player[]) => {
            this.players.clear();
            players.forEach(player => this.players.set(player.id, player));
        });

        this.socket.on('playerMoved', (player: Player) => {
            this.players.set(player.id, player);
        });

        this.socket.on('playerDisconnected', (playerId: string) => {
            this.players.delete(playerId);
        });
    }

    private setupInputListeners() {
        document.addEventListener('keydown', (event) => {
            let movement = { x: 0, y: 0, angle: 0 };
            switch (event.key) {
                case 'ArrowUp':
                    movement.y -= 5;
                    break;
                case 'ArrowDown':
                    movement.y += 5;
                    break;
                case 'ArrowLeft':
                    movement.x -= 5;
                    break;
                case 'ArrowRight':
                    movement.x += 5;
                    break;
            }
            if (movement.x !== 0 || movement.y !== 0) {
                this.socket.emit('movePlayer', movement);
            }
        });
    }

    private gameLoop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.players.forEach(player => {
            this.ctx.save();
            this.ctx.translate(player.x, player.y);
            this.ctx.rotate(player.angle);
            this.ctx.drawImage(this.playerSprite, -20, -20, 40, 40);
            this.ctx.restore();
        });

        requestAnimationFrame(() => this.gameLoop());
    }
}

window.onload = () => {
    new Game();
};
