import { Player, Emote } from './player';
import { Terrain, Block } from './terrain';
import { Game } from './game';

export class Enemy extends Player {
    private target: Player;
    private randomDirection: { x: number, y: number } = { x: 0, y: 0 };
    private randomMovementDuration: number = 0;
    private goldDetectionRadius: number = 100; // Radius to detect gold

    constructor(x: number, y: number, terrainWidth: number, terrainHeight: number, context: CanvasRenderingContext2D, target: Player, terrain: Terrain, game: Game) {
        super(x, y, 100, 5, context, terrain, game);
        this.target = target;
        this.setSize(30); // Start with a smaller size
    }

    // Change protected to public
    public getSpeed(): number {
        return super.getSpeed() * 0.2; // 20% of the player's speed
    }

    public update(terrain: Terrain, screenWidth: number, screenHeight: number, cameraX: number, cameraY: number) {
        super.update(terrain, screenWidth, screenHeight, cameraX, cameraY);

        if (this.isOffScreen(screenWidth, screenHeight, cameraX, cameraY)) {
            this.moveRandomly();
        } else {
            this.moveTowardsTarget(terrain);
        }

        // Remove the digging logic from here, as it's now handled in the Game class

        this.updateRingRotation();

        // Randomly display emotes
        if (Math.random() < 0.001) { // 0.1% chance each update
            const randomEmote = Math.floor(Math.random() * Object.keys(Emote).length / 2) as Emote;
            this.displayEmote(randomEmote);
        }
    }

    public updateEmote(deltaTime: number) {
        super.updateEmote(deltaTime);
    }

    private isOffScreen(screenWidth: number, screenHeight: number, cameraX: number, cameraY: number): boolean {
        return this.getX() < cameraX || this.getX() > cameraX + screenWidth ||
               this.getY() < cameraY || this.getY() > cameraY + screenHeight;
    }

    private moveRandomly() {
        if (this.randomMovementDuration <= 0) {
            const angle = Math.random() * 2 * Math.PI;
            this.randomDirection = {
                x: Math.cos(angle),
                y: Math.sin(angle)
            };
            this.randomMovementDuration = Math.random() * 100 + 50;
        }

        const speed = this.getSpeed();
        this.move(this.randomDirection.x * speed, this.randomDirection.y * speed);
        this.randomMovementDuration--;
    }

    private moveTowardsTarget(terrain: Terrain) {
        const nearestGold = this.findNearestGold(terrain);
        let targetX, targetY;

        if (nearestGold) {
            targetX = nearestGold.x;
            targetY = nearestGold.y;
        } else {
            targetX = this.target.getX();
            targetY = this.target.getY();
        }

        const dx = targetX - this.getX();
        const dy = targetY - this.getY();
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const speed = this.getSpeed();
            const moveX = (dx / distance) * speed;
            const moveY = (dy / distance) * speed;
            this.move(moveX, moveY);
        }
    }

    private findNearestGold(terrain: Terrain): { x: number, y: number } | null {
        const startX = Math.floor((this.getX() - this.goldDetectionRadius) / 10);
        const startY = Math.floor((this.getY() - this.goldDetectionRadius) / 10);
        const endX = Math.ceil((this.getX() + this.goldDetectionRadius) / 10);
        const endY = Math.ceil((this.getY() + this.goldDetectionRadius) / 10);

        let nearestGold = null;
        let nearestDistance = Infinity;

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const block = terrain.getBlock(x * 10, y * 10);
                if (block && block.type === 'gold_ore' && block.present) {
                    const dx = x * 10 - this.getX();
                    const dy = y * 10 - this.getY();
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestGold = { x: x * 10, y: y * 10 };
                    }
                }
            }
        }

        return nearestGold;
    }

    protected handleDugBlock(block: Block) {
        switch (block.type) {
            case 'uranium':
                this.adjustHealth(-2); // Reduced damage from uranium
                break;
            case 'lava':
                this.adjustHealth(-10); // Reduced damage from lava
                break;
            case 'quartz':
                this.adjustShield(5);
                break;
            case 'bedrock':
                this.adjustScore(5);
                break;
            case 'gold_ore':
                this.adjustGoldScore(1);
                break;
            default:
                this.adjustScore(1);
        }
        this.updateSize();
    }

    private updateSize() {
        this.setSize(this.getScore() + this.getGoldScore());
    }

    public setSize(score: number) {
        const minSize = 20;
        const growthFactor = 1.5;
        const levelBonus = (this.getLevel() - 1) * 0.1;

        const newSize = (minSize + Math.sqrt(score) * growthFactor) * (1 + levelBonus);

        super.setSize(Math.max(minSize, Math.min(1000, newSize))); // Use 1000 as max size
    }

    // Override the getLevel method to provide a level for the enemy
    public getLevel(): number {
        return Math.floor(Math.sqrt(this.getScore() / 100)) + 1;
    }

    public setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    // Override the draw method to change the color of the enemy and make a shorter frown
    public draw(visibleWidth: number, visibleHeight: number) {
        super.draw(visibleWidth, visibleHeight);
        
        // Add any enemy-specific drawing code here
        // For example, you might want to change the color or add some distinguishing feature
        
        const context = this.getContext();
        const x = this.getX();
        const y = this.getY();
        const size = this.getSize();

        // Draw a red outline for the enemy
        context.strokeStyle = 'red';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, size / 2 + 2, 0, Math.PI * 2);
        context.stroke();
    }
}