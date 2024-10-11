import { Player } from './player';
import { Enemy } from './enemy';
import { Terrain } from './terrain';

export class TitleScreen {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private onStart: () => void;
    private volumeSlider: HTMLInputElement;
    private muteButton: HTMLButtonElement;

    constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, onStart: () => void, volumeSlider: HTMLInputElement, muteButton: HTMLButtonElement) {
        this.canvas = canvas;
        this.context = context;
        this.onStart = onStart;
        this.volumeSlider = volumeSlider;
        this.muteButton = muteButton;
    }

    public show() {
        this.draw();
        this.setupEventListeners();
        this.volumeSlider.style.display = 'none';
        this.muteButton.style.display = 'none';
    }

    private draw() {
        const tempTerrain = new Terrain(this.canvas.width, this.canvas.height);

        // Background
        this.context.fillStyle = 'black';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw some terrain
        tempTerrain.generateTerrain(this.context, 0, 0, this.canvas.width / 10, this.canvas.height / 10);

        // Create and draw a player
        const player = new Player(this.canvas.width / 2, this.canvas.height / 2, 100, 10, this.context, tempTerrain, null as any);
        player.setSize(40);
        player.draw(this.canvas.width, this.canvas.height);

        // Create and draw some enemies
        for (let i = 0; i < 5; i++) {
            const enemy = new Enemy(
                Math.random() * this.canvas.width,
                Math.random() * this.canvas.height,
                this.canvas.width,
                this.canvas.height,
                this.context,
                player,
                tempTerrain,
                null as any // Pass null as Game instance for the title screen
            );
            enemy.setSize(30);
            enemy.draw(this.canvas.width, this.canvas.height);  // Pass canvas width and height
        }

        // Title
        this.context.fillStyle = 'white';
        this.context.font = '48px Arial';
        this.context.textAlign = 'center';
        this.context.fillText('DigDig', this.canvas.width / 2, this.canvas.height / 2 - 50);

        // Start button
        this.drawStartButton();
    }

    private drawStartButton() {
        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonX = this.canvas.width / 2 - buttonWidth / 2;
        const buttonY = this.canvas.height / 2 + 50;

        this.context.fillStyle = 'green';
        this.context.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        this.context.fillStyle = 'white';
        this.context.font = '24px Arial';
        this.context.fillText('Start Game', this.canvas.width / 2, buttonY + buttonHeight / 2 + 8);
    }

    private setupEventListeners() {
        this.canvas.onclick = (event) => this.handleClick(event);
    }

    private handleClick(event: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonX = this.canvas.width / 2 - buttonWidth / 2;
        const buttonY = this.canvas.height / 2 + 50;

        if (x >= buttonX && x <= buttonX + buttonWidth &&
            y >= buttonY && y <= buttonY + buttonHeight) {
            this.canvas.onclick = null;
            this.volumeSlider.style.display = 'block';
            this.muteButton.style.display = 'block';
            this.onStart();
        }
    }
}