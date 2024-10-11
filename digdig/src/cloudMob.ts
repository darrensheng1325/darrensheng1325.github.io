import { Player } from './player';
import { Terrain } from './terrain';

export class CloudMob {
    private x: number;
    private y: number;
    private size: number;
    private health: number;
    private maxHealth: number;
    private speedX: number;
    private speedY: number;
    private context: CanvasRenderingContext2D;
    private player: Player;
    private terrain: Terrain;

    constructor(x: number, y: number, size: number, health: number, context: CanvasRenderingContext2D, player: Player, terrain: Terrain) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.health = health;
        this.maxHealth = health;
        this.speedX = (Math.random() - 0.5) * 2; // Random speed between -1 and 1
        this.speedY = (Math.random() - 0.5) * 2; // Random speed between -1 and 1
        this.context = context;
        this.player = player;
        this.terrain = terrain;
    }

    public update(deltaTime: number): void {
        // Move the cloud mob
        this.x += this.speedX * deltaTime / 16; // Adjust speed based on 60 FPS
        this.y += this.speedY * deltaTime / 16;

        // Bounce off terrain boundaries
        if (this.x - this.size / 2 < 0 || this.x + this.size / 2 > this.terrain.getWidth()) {
            this.speedX = -this.speedX;
        }
        if (this.y - this.size / 2 < 0 || this.y + this.size / 2 > this.terrain.getHeight()) {
            this.speedY = -this.speedY;
        }

        // Ensure the cloud stays within the terrain boundaries
        this.x = Math.max(this.size / 2, Math.min(this.x, this.terrain.getWidth() - this.size / 2));
        this.y = Math.max(this.size / 2, Math.min(this.y, this.terrain.getHeight() - this.size / 2));
    }

    public draw(): void {
        // Draw the cloud as a simple circle
        this.context.save();
        this.context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.context.beginPath();
        this.context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.context.fill();

        // Draw health bar
        const healthBarWidth = this.size * 2;
        const healthBarHeight = 5;
        const healthPercentage = this.health / this.maxHealth;
        this.context.fillStyle = 'red';
        this.context.fillRect(this.x - healthBarWidth / 2, this.y - this.size - 10, healthBarWidth, healthBarHeight);
        this.context.fillStyle = 'green';
        this.context.fillRect(this.x - healthBarWidth / 2, this.y - this.size - 10, healthBarWidth * healthPercentage, healthBarHeight);

        this.context.restore();
    }

    public getX(): number {
        return this.x;
    }

    public getY(): number {
        return this.y;
    }

    public getSize(): number {
        return this.size;
    }

    public takeDamage(amount: number): void {
        this.health = Math.max(0, this.health - amount);
    }

    public isDead(): boolean {
        return this.health <= 0;
    }

    public setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    public bounceOff(otherX: number, otherY: number): void {
        const dx = this.x - otherX;
        const dy = this.y - otherY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const bounceSpeed = 5; // Adjust this value to change the bounce strength

        this.speedX = (dx / distance) * bounceSpeed;
        this.speedY = (dy / distance) * bounceSpeed;
    }

    public getHealth(): number {
        return this.health;
    }
}