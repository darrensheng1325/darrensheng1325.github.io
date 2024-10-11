import { Player } from './player';
import { Terrain } from './terrain';
import { Game } from './game';

interface Island {
    x: number;
    y: number;
    radius: number;
}

export class BumbleBee {
    private x: number;
    private y: number;
    private size: number = 15;
    private context: CanvasRenderingContext2D;
    private player: Player;
    private terrain: Terrain;
    private isAngry: boolean = false;
    private angerTimer: number = 0;
    private readonly ANGER_DURATION: number = 5000; // 5 seconds of anger
    private health: number = 100;
    private attackCooldown: number = 0;
    private attackInterval: number = 1000; // 1 second between attacks
    private maxChaseDistance: number = 500; // Maximum distance to chase the player
    private currentIsland: Island;
    private idleAngle: number = Math.random() * Math.PI * 2;
    private idleSpeed: number = 20; // Reduced from 30 to 20
    private retreatDistance: number = 100; // Distance to retreat after attacking
    private game: Game; // Added game property
    private isBuzzing: boolean = false;

    constructor(x: number, y: number, context: CanvasRenderingContext2D, player: Player, terrain: Terrain, island: Island, game: Game) {
        this.x = x;
        this.y = y;
        this.context = context;
        this.player = player;
        this.terrain = terrain;
        this.currentIsland = island;
        this.game = game;
    }

    public update(deltaTime: number): void {
        const deltaSeconds = Math.min(deltaTime / 1000, 0.1); // Cap delta time to prevent large jumps
        const dx = this.player.getX() - this.x;
        const dy = this.player.getY() - this.y;
        const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

        if (this.isAngry) {
            this.angerTimer += deltaTime;
            if (this.angerTimer >= this.ANGER_DURATION) {
                this.calmDown();
            } else {
                this.updateAngryBehavior(distanceToPlayer, deltaSeconds);
            }
        } else {
            this.updateIdleBehavior(deltaSeconds);
            // Check if player is close enough to anger the bee
            if (distanceToPlayer < 100) {
                this.anger();
            }
        }

        // Keep within terrain boundaries
        this.x = Math.max(this.size, Math.min(this.x, this.terrain.getWidth() - this.size));
        this.y = Math.max(this.size, Math.min(this.y, this.terrain.getHeight() - this.size));
    }

    private updateAngryBehavior(distanceToPlayer: number, deltaSeconds: number): void {
        if (distanceToPlayer > this.maxChaseDistance) {
            this.calmDown();
        } else {
            const moveSpeed = this.player.getSpeed() * 75; // Reduced from 100 to 75 times player's speed
            const angle = Math.atan2(this.player.getY() - this.y, this.player.getX() - this.x);
            this.x += Math.cos(angle) * moveSpeed * deltaSeconds;
            this.y += Math.sin(angle) * moveSpeed * deltaSeconds;

            this.attackCooldown -= deltaSeconds * 1000;
            if (this.attackCooldown <= 0 && distanceToPlayer < this.size + 20) {
                this.attackPlayer();
                this.attackCooldown = this.attackInterval;
                this.retreatAfterAttack();
            }
        }
    }

    private updateIdleBehavior(deltaSeconds: number): void {
        this.idleAngle += (Math.random() - 0.5) * 0.1;
        const newX = this.x + Math.cos(this.idleAngle) * this.idleSpeed * deltaSeconds;
        const newY = this.y + Math.sin(this.idleAngle) * this.idleSpeed * deltaSeconds;

        const distanceToIslandCenter = Math.sqrt(
            Math.pow(newX - this.currentIsland.x, 2) + 
            Math.pow(newY - this.currentIsland.y, 2)
        );

        if (distanceToIslandCenter <= this.currentIsland.radius - this.size) {
            this.x = newX;
            this.y = newY;
        } else {
            this.idleAngle = Math.atan2(
                this.currentIsland.y - this.y,
                this.currentIsland.x - this.x
            );
        }
    }

    private attackPlayer(): void {
        const playerCurrentHealth = this.player.getHealth();
        const damage = Math.floor(playerCurrentHealth * 0.75); // 3/4 of player's current health
        this.player.takeDamage(damage);
        console.log(`Bee attacked player for ${damage} damage. Player health: ${this.player.getHealth()}`);
    }

    private retreatAfterAttack(): void {
        const angle = Math.atan2(this.y - this.player.getY(), this.x - this.player.getX());
        const newX = this.x + Math.cos(angle) * this.retreatDistance;
        const newY = this.y + Math.sin(angle) * this.retreatDistance;

        // Ensure the new position is within the terrain boundaries
        this.x = Math.max(this.size, Math.min(newX, this.terrain.getWidth() - this.size));
        this.y = Math.max(this.size, Math.min(newY, this.terrain.getHeight() - this.size));
    }

    public draw(): void {
        this.context.save();
        
        // Draw the main body
        this.context.fillStyle = this.isAngry ? 'red' : 'yellow';
        this.context.beginPath();
        this.context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.context.fill();

        // Draw stripes
        this.context.fillStyle = 'black';
        const stripeCount = 3;
        const stripeWidth = this.size * 0.4; // Adjust this value to change stripe width
        const stripeSpacing = this.size * 0.5; // Adjust this value to change stripe spacing

        for (let i = 0; i < stripeCount; i++) {
            this.context.save();
            this.context.translate(this.x, this.y);
            this.context.rotate(Math.PI / 4); // Rotate stripes diagonally

            // Calculate stripe position
            const stripeX = -this.size + (i + 0.5) * stripeSpacing - stripeWidth / 2;

            // Use a clipping region to keep stripes inside the bee
            this.context.beginPath();
            this.context.arc(0, 0, this.size, 0, Math.PI * 2);
            this.context.clip();

            // Draw the stripe
            this.context.fillRect(
                stripeX,
                -this.size,
                stripeWidth,
                this.size * 2
            );

            this.context.restore();
        }

        // Draw antennae
        this.context.strokeStyle = 'black';
        this.context.lineWidth = this.size * 0.1;
        
        // Left antenna
        this.context.beginPath();
        this.context.moveTo(this.x + this.size * 0.3, this.y - this.size * 0.5);
        this.context.lineTo(this.x + this.size * 0.6, this.y - this.size * 0.9);
        this.context.stroke();

        // Right antenna
        this.context.beginPath();
        this.context.moveTo(this.x + this.size * 0.5, this.y - this.size * 0.3);
        this.context.lineTo(this.x + this.size * 0.9, this.y - this.size * 0.6);
        this.context.stroke();

        this.context.restore();
    }

    public getX(): number { return this.x; }
    public getY(): number { return this.y; }
    public getSize(): number { return this.size; }
    public anger(): void {
        if (!this.isAngry) {
            this.isAngry = true;
            this.angerTimer = 0;
            this.game.getSoundManager().playAngryBeeSound();
            this.isBuzzing = true;
        }
    }
    private calmDown(): void {
        if (this.isAngry) {
            this.isAngry = false;
            this.angerTimer = 0;
            this.stopBuzzing();
        }
    }
    public stopBuzzing(): void {
        if (this.isBuzzing) {
            this.game.getSoundManager().stopAngryBeeSound();
            this.isBuzzing = false;
        }
    }
    public isAngered(): boolean { return this.isAngry; }
    public takeDamage(amount: number): void {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
        }
    }
    public isDead(): boolean { return this.health <= 0; }
    public getHealth(): number { return this.health; }
}