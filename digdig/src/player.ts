import { Terrain, Block } from './terrain';
import { Game } from './game';

export enum Emote {
    Happy, Sad, Angry, Surprised, Love,
    Cool, Thinking, Laughing, Wink, Confused,
    Sleepy, Excited, Nervous, Sick, Rich,
    Strong, Scared, Crazy, Evil, Dead
}

export class Player {
    protected x: number;
    protected y: number;
    private size: number;
    private health: number;
    private shield: number;
    private context: CanvasRenderingContext2D;
    private movementDirection: { x: number, y: number } = { x: 0, y: 0 };
    private baseSpeed: number = 4;
    private minSpeed: number = 0.3;
    private maxSpeed: number = 5;
    private optimalSize: number = 40;
    protected ringRotation: number = 0;
    protected terrain: Terrain;
    private score: number = 0;
    private _isDigging: boolean = false;
    private maxSize: number = 1000;
    private goldScore: number = 0;
    private level: number = 1;
    private xp: number = 0;
    private xpToNextLevel: number = 100;
    private currentEmote: Emote | null = null;
    private emoteDisplayTime: number = 0;
    private readonly EMOTE_DURATION: number = 2000;
    private ownedEmotes: Set<Emote> = new Set([Emote.Happy, Emote.Sad, Emote.Angry, Emote.Surprised]);
    private isInAlternateDimension: boolean = false;
    private alternateDimensionScore: number = 0;
    private normalSize: number;
    private alternateDimensionSize: number = 30; // Increased from 20 to 30
    private alternateDimensionSpeedMultiplier: number = 0.5; // 50% slower in alternate dimension
    private maxHealth: number;
    private game: Game;

    constructor(x: number, y: number, health: number, attack: number, context: CanvasRenderingContext2D, terrain: Terrain, game: Game) {
        this.x = x;
        this.y = y;
        this.size = 20;
        this.health = health;
        this.shield = 0;
        this.context = context;
        this.terrain = terrain;
        this.game = game;
        this.loadGoldScore();
        this.loadOwnedEmotes();
        this.calculateLevelAndXP();
        this.normalSize = this.size;
        this.maxHealth = 100; // or whatever the max health should be
    }

    move(dx: number, dy: number) {
        const speed = this.getSpeed();
        const newX = this.x + dx * speed;
        const newY = this.y + dy * speed;

        if (newX >= 0 && newX < this.terrain.getWidth() && newY >= 0 && newY < this.terrain.getHeight()) {
            this.x = newX;
            this.y = newY;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length > 0) {
                this.movementDirection = { x: dx / length, y: dy / length };
            }
            
            this.dig(this.terrain);
        }
    }

    public getSpeed(): number {
        const minSize = 20;
        const normalizedSize = Math.min((this.size - minSize) / (this.maxSize - minSize), 1);
        const speedDecrease = normalizedSize * 0.95;
        let baseSpeed = Math.max(this.minSpeed, this.baseSpeed - this.baseSpeed * speedDecrease);
        
        baseSpeed *= (1 + (this.level - 1) * 0.05);

        // Apply speed reduction in alternate dimension
        if (this.isInAlternateDimension) {
            baseSpeed *= this.alternateDimensionSpeedMultiplier;
        }

        return baseSpeed;
    }

    dig(terrain: Terrain) {
        if (this.isInAlternateDimension) {
            return []; // Return an empty array if in alternate dimension
        }

        const digRadius = Math.floor(this.size / 2);
        const dugBlocks: Block[] = [];

        for (let dx = -digRadius; dx <= digRadius; dx++) {
            for (let dy = -digRadius; dy <= digRadius; dy++) {
                if (dx * dx + dy * dy <= digRadius * digRadius) {
                    const block = terrain.removeBlock(this.x + dx, this.y + dy);
                    if (block) {
                        dugBlocks.push(block);
                        if (block.type === 'gold_ore' && !this.isInAlternateDimension) {
                            this.game.getSoundManager().playGoldDigSound();
                        }
                    }
                }
            }
        }

        for (const block of dugBlocks) {
            this.handleDugBlock(block);
        }

        return dugBlocks;
    }

    protected handleDugBlock(block: Block) {
        switch (block.type) {
            case 'uranium':
                this.adjustHealth(-5);
                break;
            case 'lava':
                this.adjustHealth(-20); // This will now stop draining at 5 health
                break;
            case 'quartz':
                this.adjustShield(10);
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
        this.setSize(this.getScore() + this.getGoldScore());
    }

    draw(screenWidth: number, screenHeight: number) {
        this.context.save();
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.fillStyle = 'white';
        this.context.font = '24px Arial';
        this.context.textAlign = 'left';
        this.context.textBaseline = 'top';
        this.context.fillText(`Level: ${this.level}`, 10, 10);
        this.context.restore();

        this.updateRingRotation();
        this.ringRotation += Math.PI / 180;
        if (this.ringRotation >= Math.PI * 2) {
            this.ringRotation -= Math.PI * 2;
        }

        this.context.strokeStyle = 'black';
        this.context.fillStyle = 'black';
        this.context.lineWidth = 5;

        const ringRadius = this.size / 2 + this.size / 6;
        const curveCount = 8;
        const curveAngle = (Math.PI * 2) / curveCount;
        const curveDepth = this.size / 4;

        this.context.beginPath();
        for (let i = 0; i < curveCount; i++) {
            const startAngle = i * curveAngle + this.ringRotation;
            const endAngle = (i + 1) * curveAngle + this.ringRotation;
            const midAngle = (startAngle + endAngle) / 2;

            const startX = this.x + Math.cos(startAngle) * ringRadius;
            const startY = this.y + Math.sin(startAngle) * ringRadius;
            const endX = this.x + Math.cos(endAngle) * ringRadius;
            const endY = this.y + Math.sin(endAngle) * ringRadius;
            const controlX = this.x + Math.cos(midAngle) * (ringRadius - curveDepth);
            const controlY = this.y + Math.sin(midAngle) * (ringRadius - curveDepth);

            if (i === 0) {
                this.context.moveTo(startX, startY);
            }
            this.context.quadraticCurveTo(controlX, controlY, endX, endY);
        }
        this.context.closePath();
        this.context.fill();
        this.context.stroke();

        this.context.fillStyle = 'gray';
        this.context.beginPath();
        this.context.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        this.context.fill();

        const eyeWidth = this.size / 6;
        const eyeHeight = this.size / 4;
        const eyeY = this.y - eyeHeight / 2;

        this.context.fillStyle = 'white';
        this.context.fillRect(this.x - this.size / 6 - eyeWidth / 2, eyeY, eyeWidth, eyeHeight);

        this.context.fillRect(this.x + this.size / 6 - eyeWidth / 2, eyeY, eyeWidth, eyeHeight);

        this.context.fillStyle = 'black';
        const pupilWidth = eyeWidth * 0.6;
        const pupilHeight = eyeHeight * 0.6;
        const maxPupilOffset = (eyeWidth - pupilWidth) / 2;

        const pupilOffsetX = this.movementDirection.x * maxPupilOffset;
        const pupilOffsetY = this.movementDirection.y * maxPupilOffset;

        this.context.fillRect(
            this.x - this.size / 6 - pupilWidth / 2 + pupilOffsetX,
            eyeY + (eyeHeight - pupilHeight) / 2 + pupilOffsetY,
            pupilWidth,
            pupilHeight
        );

        this.context.fillRect(
            this.x + this.size / 6 - pupilWidth / 2 + pupilOffsetX,
            eyeY + (eyeHeight - pupilHeight) / 2 + pupilOffsetY,
            pupilWidth,
            pupilHeight
        );

        this.context.strokeStyle = 'black';
        this.context.lineWidth = 2;
        this.context.beginPath();
        this.context.arc(this.x, this.y + this.size / 8, this.size / 5, 0.2 * Math.PI, 0.8 * Math.PI);
        this.context.stroke();

        const barWidth = this.size * 2;
        const barHeight = 5;
        const healthPercentage = this.health / 100;
        const shieldPercentage = this.shield / 100;

        this.context.fillStyle = 'red';
        this.context.fillRect(this.x - barWidth / 2, this.y - this.size / 2 - 10, barWidth, barHeight);

        this.context.fillStyle = 'green';
        this.context.fillRect(this.x - barWidth / 2, this.y - this.size / 2 - 10, barWidth * healthPercentage, barHeight);

        this.context.fillStyle = 'blue';
        this.context.fillRect(
            this.x - barWidth / 2 + barWidth * healthPercentage, 
            this.y - this.size / 2 - 10, 
            barWidth * shieldPercentage, 
            barHeight
        );

        this.context.font = `${this.size / 3}px Arial`;
        this.context.textAlign = 'center';
        
        // Display the combined score (regular + alternate dimension)
        this.context.fillStyle = 'white';
        this.context.fillText(`${this.getScore()}`, this.x, this.y - this.size / 2 - 20);
        
        this.context.fillStyle = 'gold';
        this.context.fillText(`${this.goldScore}`, this.x + this.size / 2, this.y - this.size / 2 - 20);

        const xpPercentage = this.xp / this.xpToNextLevel;

        this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.context.fillRect(this.x - barWidth / 2, this.y - this.size / 2 - 25, barWidth, barHeight);

        this.context.fillStyle = 'yellow';
        this.context.fillRect(this.x - barWidth / 2, this.y - this.size / 2 - 25, barWidth * xpPercentage, barHeight);

        if (this.currentEmote !== null) {
            this.drawEmote();
        }
    }

    getX() { return this.x; }
    getY() { return this.y; }
    getHealth() { return this.health; }
    getShield() { return this.shield; }

    adjustHealth(amount: number) {
        if (amount < 0) {
            // For damage (negative amount)
            if (this.health > 5) {
                // Only apply damage if health is above 5
                this.health = Math.max(5, this.health + amount);
            }
        } else {
            // For healing (positive amount)
            this.health = Math.min(100, this.health + amount);
        }
    }

    public takeDamage(amount: number) {
        if (this.shield > 0) {
            if (this.shield >= amount) {
                this.shield -= amount;
                amount = 0;
            } else {
                amount -= this.shield;
                this.shield = 0;
            }
        }

        if (amount > 0) {
            this.health = Math.max(0, this.health - amount);
        }

        console.log(`Player took ${amount} damage. Health: ${this.health}, Shield: ${this.shield}`);
    }

    adjustShield(amount: number) {
        this.shield = Math.max(0, Math.min(100, this.shield + amount));
    }

    public recoverHealth(amount: number) {
        this.health = Math.min(100, this.health + amount);
    }

    public setSize(score: number) {
        if (!this.isInAlternateDimension) {
            const minSize = 20;
            const growthFactor = 1.5;
            const levelBonus = (this.level - 1) * 0.1;

            const newSize = (minSize + Math.sqrt(score) * growthFactor) * (1 + levelBonus);

            this.size = Math.max(minSize, Math.min(this.maxSize, newSize));
            this.normalSize = this.size;
        }
    }

    public getSize(): number {
        return this.isInAlternateDimension ? this.alternateDimensionSize : this.size;
    }

    public getContext(): CanvasRenderingContext2D {
        return this.context;
    }

    protected updateRingRotation(): void {
        this.ringRotation += Math.PI / 180;
        if (this.ringRotation >= Math.PI * 2) {
            this.ringRotation -= Math.PI * 2;
        }
    }

    public getScore(): number {
        return this.score;
    }

    public adjustScore(amount: number) {
        this.score += amount;
        this.setSize(this.score);
        console.log(`Score adjusted. New score: ${this.score}`);
    }

    public startDigging() {
        this._isDigging = true;
        console.log('Player started digging');
    }

    public stopDigging() {
        this._isDigging = false;
        console.log('Player stopped digging');
    }

    public isDigging(): boolean {
        return this._isDigging;
    }

    public update(terrain: Terrain, screenWidth: number, screenHeight: number, cameraX: number, cameraY: number) {
        if (this._isDigging) {
            this.dig(terrain);
        }
    }

    public getGoldScore(): number {
        return this.goldScore;
    }

    public adjustGoldScore(amount: number) {
        this.goldScore += amount;
        this.saveGoldScore();
        this.calculateLevelAndXP();
        console.log(`Gold score adjusted. New gold score: ${this.goldScore}`);
    }

    private saveGoldScore(): void {
        localStorage.setItem('playerGoldScore', this.goldScore.toString());
    }

    private loadGoldScore(): void {
        const savedGoldScore = localStorage.getItem('playerGoldScore');
        if (savedGoldScore !== null) {
            this.goldScore = parseInt(savedGoldScore, 10);
        }
    }

    private calculateLevelAndXP(): void {
        const oldLevel = this.level;
        this.level = Math.floor(Math.sqrt(this.goldScore / 100)) + 1;
        this.xp = this.goldScore % 100;
        this.xpToNextLevel = 100;

        if (this.level > oldLevel) {
            console.log(`Level up! New level: ${this.level}`);
            this.onLevelUp();
        }
    }

    private onLevelUp(): void {
        const maxHealth = 100 + (this.level - 1) * 10;
        const maxShield = 100 + (this.level - 1) * 5;

        this.health = Math.min(this.health, maxHealth);
        this.shield = Math.min(this.shield, maxShield);

        this.baseSpeed = 4 + (this.level - 1) * 0.1;
    }

    public getLevel(): number {
        return this.level;
    }

    public getXP(): number {
        return this.xp;
    }

    public getXPToNextLevel(): number {
        return this.xpToNextLevel;
    }

    public displayEmote(emote: Emote) {
        if (this.ownedEmotes.has(emote)) {
            this.currentEmote = emote;
            this.emoteDisplayTime = this.EMOTE_DURATION;
        }
    }

    public updateEmote(deltaTime: number) {
        if (this.emoteDisplayTime > 0) {
            this.emoteDisplayTime -= deltaTime;
            if (this.emoteDisplayTime <= 0) {
                this.currentEmote = null;
            }
        }
    }

    private drawEmote() {
        if (this.currentEmote !== null) {
            const emoteSize = this.size * 1.5;
            const emoteX = this.x;
            const emoteY = this.y - this.size * 1.5;

            this.context.save();
            this.context.setTransform(1, 0, 0, 1, 0, 0);
            this.context.fillStyle = 'white';
            this.context.font = `${emoteSize}px Arial`;
            this.context.textAlign = 'center';
            this.context.textBaseline = 'middle';

            const emoteText = this.getEmoteText(this.currentEmote);
            this.context.fillText(emoteText, emoteX, emoteY);

            this.context.restore();
        }
    }

    private getEmoteText(emote: Emote): string {
        switch (emote) {
            case Emote.Happy:
                return ':)';
            case Emote.Sad:
                return ':(';
            case Emote.Angry:
                return '>:(';
            case Emote.Surprised:
                return ':O';
            case Emote.Love:
                return '<3';
            case Emote.Cool:
                return 'B)';
            case Emote.Thinking:
                return 'O.o';
            case Emote.Laughing:
                return ':D';
            case Emote.Wink:
                return ';)';
            case Emote.Confused:
                return ':/';
            case Emote.Sleepy:
                return ':Z';
            case Emote.Excited:
                return ':P';
            case Emote.Nervous:
                return ':|';
            case Emote.Sick:
                return ':X';
            case Emote.Rich:
                return ':$';
            case Emote.Strong:
                return ':@';
            case Emote.Scared:
                return ':!';
            case Emote.Crazy:
                return ':#';
            case Emote.Evil:
                return '>:)';
            case Emote.Dead:
                return 'x_x';
            default:
                return '';
        }
    }

    public hasEmote(emote: Emote): boolean {
        return this.ownedEmotes.has(emote);
    }

    public getOwnedEmotes(): Emote[] {
        return Array.from(this.ownedEmotes);
    }

    public buyEmote(emote: Emote): boolean {
        if (this.goldScore >= 300 && !this.ownedEmotes.has(emote)) {
            this.goldScore -= 300;
            this.ownedEmotes.add(emote);
            this.saveGoldScore();
            this.saveOwnedEmotes();
            this.game.getSoundManager().playBuyEmoteSound();
            return true;
        }
        return false;
    }

    private saveOwnedEmotes(): void {
        const ownedEmotesArray = Array.from(this.ownedEmotes);
        localStorage.setItem('playerOwnedEmotes', JSON.stringify(ownedEmotesArray));
    }

    private loadOwnedEmotes(): void {
        const savedEmotes = localStorage.getItem('playerOwnedEmotes');
        if (savedEmotes) {
            const emoteArray = JSON.parse(savedEmotes) as Emote[];
            this.ownedEmotes = new Set(emoteArray);
        } else {
            // If no saved emotes, initialize with default emotes
            this.ownedEmotes = new Set([Emote.Happy, Emote.Sad, Emote.Angry, Emote.Surprised]);
        }
    }

    public setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    public setInAlternateDimension(value: boolean) {
        this.isInAlternateDimension = value;
        if (value) {
            this.normalSize = this.size; // Store the current size
            this.size = this.alternateDimensionSize; // Set to slightly larger size
        } else {
            this.size = this.normalSize; // Restore the normal size
        }
    }

    public adjustAlternateDimensionScore(amount: number) {
        this.alternateDimensionScore += amount;
        this.score += amount; // Add the amount to the regular score as well
        this.setSize(this.getScore() + this.getGoldScore());
        console.log(`Alternate Dimension Score adjusted. New score: ${this.alternateDimensionScore}`);
        console.log(`Regular Score adjusted. New score: ${this.score}`);
    }

    public getAlternateDimensionScore(): number {
        return this.alternateDimensionScore;
    }

    public isDead(): boolean {
        return this.health <= 0;
    }

    public getMaxHealth(): number {
        return this.maxHealth;
    }
}

