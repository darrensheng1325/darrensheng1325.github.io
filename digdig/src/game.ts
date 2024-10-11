import { Player, Emote } from './player';
import { Enemy } from './enemy';
import { Terrain, Block } from './terrain';
import { Shop } from './shop';
import { AlternateDimension, DimensionType } from './alternateDimension';
import { TitleScreen } from './titleScreen';
import { CloudMob } from './cloudMob';
import { BumbleBee } from './bumbleBee';
import { SoundManager } from './soundManager';

export class Game {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private player: Player;
    private terrain: Terrain;
    private score: number;
    private keysPressed: Set<string>;
    private cameraX: number;
    private cameraY: number;
    private lastHealthRecoveryTime: number;
    private enemies: Enemy[] = [];
    private maxEnemies: number = 40;
    private isMouseControl: boolean = false;
    private zoom: number = 1;
    private minZoom: number = 0.01;
    private maxZoom: number = 1;
    private zoomCap: number = 0.4;
    private lastUpdateTime: number = 0;
    private isEmoteWheelOpen: boolean = false;
    private emoteWheelRadius: number = 100;
    private selectedEmote: Emote | null = null;
    private shop: Shop;
    private alternateDimension: AlternateDimension | null = null;
    private grassDimension: AlternateDimension | null = null;
    private currentDimension: 'normal' | 'alternate' | 'grass' = 'normal';
    private portalCooldown: number = 0;
    private readonly PORTAL_COOLDOWN_DURATION: number = 5000;
    private titleScreen: TitleScreen;
    private isGameOver: boolean = false;
    private gameOverMessage: string = '';
    private cloudMobs: CloudMob[] = [];
    private maxCloudMobs: number = 20;
    private lastDamageSource: 'bee' | 'cloud' | 'enemy' | 'unknown' = 'unknown';
    private soundManager: SoundManager;
    private volumeSlider: HTMLInputElement;
    private muteButton: HTMLButtonElement;
    private isMuted: boolean = false;

    constructor(canvasId: string, titleScreen: TitleScreen) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.context = this.canvas.getContext('2d')!;
        this.terrain = new Terrain(10000, 10000);
        
        const portalLocation = this.terrain.getPortalLocation();
        
        // Reduced spawn distance from the portal for easier debugging
        const minSpawnDistance = 100; // Changed from 1000 to 100
        const maxSpawnDistance = 200; // Added max spawn distance
        
        let spawnX, spawnY;
        do {
            const angle = Math.random() * 2 * Math.PI;
            const distance = minSpawnDistance + Math.random() * (maxSpawnDistance - minSpawnDistance);
            spawnX = portalLocation.x + Math.cos(angle) * distance;
            spawnY = portalLocation.y + Math.sin(angle) * distance;
        } while (
            spawnX < 0 || spawnX >= this.terrain.getWidth() ||
            spawnY < 0 || spawnY >= this.terrain.getHeight()
        );
        
        this.player = new Player(
            spawnX,
            spawnY,
            100,
            10,
            this.context,
            this.terrain,
            this
        );

        this.score = 0;
        this.keysPressed = new Set();
        this.cameraX = 0;
        this.cameraY = 0;
        this.lastHealthRecoveryTime = Date.now();
        this.enemies = [];
        this.spawnEnemies(20);
        this.shop = new Shop(this.player, this.context, this);
        this.alternateDimension = new AlternateDimension(10000, 10000, this.context, DimensionType.Dark, this.player, this.terrain, this);
        this.grassDimension = new AlternateDimension(10000, 10000, this.context, DimensionType.Grass, this.player, this.terrain, this);
        this.titleScreen = titleScreen;
        this.soundManager = new SoundManager();
        this.volumeSlider = this.createVolumeSlider();
        this.muteButton = this.createMuteButton();
        this.soundManager.playBackgroundMusic();

        this.init();
        this.loadSettings();
        this.applySettings();
    }

    private init() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        window.addEventListener('keydown', (e) => this.handleEmoteInput(e));
        this.resizeCanvas();
        this.gameLoop();
        this.lastUpdateTime = Date.now();
    }

    public resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'e') {
            this.toggleEmoteWheel();
        } else if (event.key === 's') {
            this.shop.toggleShop();
        }
        this.keysPressed.add(event.key);
    }

    private handleKeyUp(event: KeyboardEvent) {
        this.keysPressed.delete(event.key);
    }

    private handleMouseMove(event: MouseEvent) {
        if (this.isEmoteWheelOpen) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this.selectedEmote = this.getEmoteFromPosition(x, y);
        } else if (this.isMouseControl) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            const worldX = (mouseX / this.zoom) + this.cameraX;
            const worldY = (mouseY / this.zoom) + this.cameraY;

            const dx = worldX - this.player.getX();
            const dy = worldY - this.player.getY();
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                const angle = Math.atan2(dy, dx);
                const moveX = Math.cos(angle);
                const moveY = Math.sin(angle);
                const newX = this.player.getX() + moveX * this.player.getSpeed();
                const newY = this.player.getY() + moveY * this.player.getSpeed();

                if (this.currentDimension === 'grass') {
                    if (this.grassDimension!.isValidMove(newX, newY)) {
                        this.player.move(moveX, moveY);
                    }
                } else {
                    this.player.move(moveX, moveY);
                }
            }
        }
    }

    private handleMouseDown(event: MouseEvent) {
        if (this.shop.isShopOpen()) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this.shop.handleClick(x, y, this.canvas.width, this.canvas.height);
        } else if (this.isEmoteWheelOpen && this.selectedEmote !== null) {
            this.player.displayEmote(this.selectedEmote);
            this.toggleEmoteWheel();
        } else if (this.isMouseControl) {
            this.player.startDigging();
        }
    }

    private handleMouseUp(event: MouseEvent) {
        if (this.isMouseControl) {
            this.player.stopDigging();
        }
    }

    private handleEmoteInput(event: KeyboardEvent) {
        switch (event.key) {
            case '1': this.player.displayEmote(Emote.Happy); break;
            case '2': this.player.displayEmote(Emote.Sad); break;
            case '3': this.player.displayEmote(Emote.Angry); break;
            case '4': this.player.displayEmote(Emote.Surprised); break;
            case '5': this.player.displayEmote(Emote.Love); break;
            case '6': this.player.displayEmote(Emote.Cool); break;
            case '7': this.player.displayEmote(Emote.Thinking); break;
            case '8': this.player.displayEmote(Emote.Laughing); break;
            case '9': this.player.displayEmote(Emote.Wink); break;
            case '0': this.player.displayEmote(Emote.Confused); break;
            case 'q': this.player.displayEmote(Emote.Sleepy); break;
            case 'w': this.player.displayEmote(Emote.Excited); break;
            case 'e': this.player.displayEmote(Emote.Nervous); break;
            case 'r': this.player.displayEmote(Emote.Sick); break;
            case 't': this.player.displayEmote(Emote.Rich); break;
            case 'y': this.player.displayEmote(Emote.Strong); break;
            case 'u': this.player.displayEmote(Emote.Scared); break;
            case 'i': this.player.displayEmote(Emote.Crazy); break;
            case 'o': this.player.displayEmote(Emote.Evil); break;
            case 'p': this.player.displayEmote(Emote.Dead); break;
        }
    }

    private gameLoop() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        if (!this.isGameOver) {
            this.update(deltaTime);
        }
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    private update(deltaTime: number) {
        if (!this.isMouseControl) {
            let dx = 0;
            let dy = 0;

            if (this.keysPressed.has('ArrowUp')) dy -= 1;
            if (this.keysPressed.has('ArrowDown')) dy += 1;
            if (this.keysPressed.has('ArrowLeft')) dx -= 1;
            if (this.keysPressed.has('ArrowRight')) dx += 1;

            if (dx !== 0 || dy !== 0) {
                const speed = this.player.getSpeed();
                const newX = this.player.getX() + dx * speed;
                const newY = this.player.getY() + dy * speed;

                if (this.currentDimension === 'grass') {
                    if (this.grassDimension!.isValidMove(newX, newY)) {
                        this.player.move(dx * speed, dy * speed);
                    }
                } else {
                    this.player.move(dx * speed, dy * speed);
                }
            }
        }

        this.player.update(this.terrain, this.canvas.width, this.canvas.height, this.cameraX, this.cameraY);

        console.log(`Player position: (${this.player.getX()}, ${this.player.getY()}), Digging: ${this.player.isDigging()}`);

        if (Date.now() - this.lastHealthRecoveryTime > 500) {
            this.player.recoverHealth(2);
            this.lastHealthRecoveryTime = Date.now();
        }

        this.updateZoom();

        const effectiveWidth = this.canvas.width / this.zoom;
        const effectiveHeight = this.canvas.height / this.zoom;
        this.cameraX = Math.max(0, Math.min(this.terrain.getWidth() - effectiveWidth, this.player.getX() - effectiveWidth / 2));
        this.cameraY = Math.max(0, Math.min(this.terrain.getHeight() - effectiveHeight, this.player.getY() - effectiveHeight / 2));

        if (this.currentDimension === 'grass') {
            this.updateCloudMobs(deltaTime);
            this.updateBumbleBees(deltaTime);
        } else if (this.currentDimension === 'alternate') {
            this.alternateDimension!.update(this.player, this.enemies, deltaTime);
            this.updateEnemies(true); // Pass true to indicate alternate dimension
        } else {
            if (this.player.isDigging()) {
                this.player.dig(this.terrain);
            }
            this.updateEnemies(false); // Pass false to indicate normal dimension
        }

        this.player.updateEmote(deltaTime);

        this.enemies.forEach(enemy => enemy.updateEmote(deltaTime));

        if (this.portalCooldown > 0) {
            this.portalCooldown -= deltaTime;
            if (this.portalCooldown < 0) {
                this.portalCooldown = 0;
            }
        }

        let portalLocation;
        if (this.currentDimension === 'alternate') {
            portalLocation = this.alternateDimension!.getRegularPortalLocation();
        } else if (this.currentDimension === 'grass') {
            portalLocation = this.grassDimension!.getRegularPortalLocation();
        } else {
            portalLocation = this.terrain.getPortalLocation();
        }
        const playerX = this.player.getX();
        const playerY = this.player.getY();
        const portalRadius = 25;

        if (Math.abs(playerX - portalLocation.x) < portalRadius && 
            Math.abs(playerY - portalLocation.y) < portalRadius &&
            this.portalCooldown === 0) {
            this.toggleDimension();
            this.portalCooldown = this.PORTAL_COOLDOWN_DURATION;
        }

        if (this.currentDimension === 'alternate') {
            this.alternateDimension!.update(this.player, this.enemies, deltaTime);
        } else if (this.currentDimension === 'grass') {
            this.grassDimension!.update(this.player, this.cloudMobs, deltaTime);
        } else {
            if (this.player.isDigging()) {
                this.player.dig(this.terrain);
            }
        }

        if (this.player.isDead()) {
            this.soundManager.playHurtSound();
            this.handlePlayerDeath();
            return;
        }
    }

    private updateZoom() {
        const playerSize = this.player.getSize();
        const minPlayerSize = 20;
        const maxPlayerSize = 1000;
        
        const zoomFactor = Math.log(playerSize / minPlayerSize) / Math.log(maxPlayerSize / minPlayerSize);
        let newZoom = this.maxZoom * Math.pow(0.05, zoomFactor);
        
        newZoom = Math.max(this.zoomCap, newZoom);
        
        this.zoom = this.zoom * 0.9 + newZoom * 0.1;
        
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
    }

    private render() {
        this.context.fillStyle = 'black';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.context.save();
        
        this.context.scale(this.zoom, this.zoom);
        
        const centerX = this.canvas.width / (2 * this.zoom);
        const centerY = this.canvas.height / (2 * this.zoom);
        this.context.translate(centerX - this.player.getX(), centerY - this.player.getY());
        
        const visibleWidth = this.canvas.width / this.zoom;
        const visibleHeight = this.canvas.height / this.zoom;
        const startX = Math.floor((this.player.getX() - visibleWidth / 2) / 10);
        const startY = Math.floor((this.player.getY() - visibleHeight / 2) / 10);
        const endX = Math.ceil((this.player.getX() + visibleWidth / 2) / 10);
        const endY = Math.ceil((this.player.getY() + visibleHeight / 2) / 10);

        if (this.currentDimension === 'grass') {
            this.grassDimension!.render(this.context, this.player, this.canvas.width, this.canvas.height, this.zoom);
            this.renderCloudMobs();
        } else if (this.currentDimension === 'alternate') {
            this.alternateDimension!.render(this.context, this.player, this.canvas.width, this.canvas.height, this.zoom);
            this.renderEnemies();
        } else {
            this.terrain.generateTerrain(this.context, startX, startY, endX, endY);
            this.renderEnemies();
        }
        
        this.player.draw(visibleWidth, visibleHeight);
        
        this.context.restore();

        if (this.shop.isShopOpen()) {
            this.shop.render(this.canvas.width, this.canvas.height);
        } else if (this.isEmoteWheelOpen) {
            this.renderEmoteWheel();
        }

        if (this.portalCooldown > 0) {
            this.renderPortalCooldown();
        }

        if (this.isGameOver) {
            this.renderGameOverMessage();
        }

        if (this.currentDimension !== 'normal') {
            this.renderMinimap(this.context, 200, 200);
        }
    }

    private renderEnemies() {
        this.enemies.forEach(enemy => {
            if (this.isEnemyVisible(enemy)) {
                enemy.draw(this.canvas.width / this.zoom, this.canvas.height / this.zoom);
            }
        });
    }

    private isEnemyVisible(enemy: Enemy): boolean {
        const enemyX = enemy.getX();
        const enemyY = enemy.getY();
        const playerX = this.player.getX();
        const playerY = this.player.getY();
        const visibleWidth = this.canvas.width / this.zoom;
        const visibleHeight = this.canvas.height / this.zoom;

        return (
            enemyX >= playerX - visibleWidth / 2 &&
            enemyX <= playerX + visibleWidth / 2 &&
            enemyY >= playerY - visibleHeight / 2 &&
            enemyY <= playerY + visibleHeight / 2
        );
    }

    private spawnEnemies(count: number) {
        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.terrain.getWidth();
            const y = Math.random() * this.terrain.getHeight();
            const enemy = new Enemy(x, y, this.terrain.getWidth(), this.terrain.getHeight(), this.context, this.player, this.terrain, this);
            this.enemies.push(enemy);
        }
    }

    private updateEnemies(isAlternateDimension: boolean) {
        this.enemies.forEach((enemy, index) => {
            enemy.update(this.terrain, this.canvas.width, this.canvas.height, this.cameraX, this.cameraY);
            
            const dx = this.player.getX() - enemy.getX();
            const dy = this.player.getY() - enemy.getY();
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < (this.player.getSize() + enemy.getSize()) / 2) {
                const damage = Math.floor(enemy.getSize() * 0.5);
                this.player.takeDamage(damage);
                this.lastDamageSource = 'enemy';
                console.log(`Enemy dealt ${damage} damage to player. Player health: ${this.player.getHealth()}`);

                if (this.player.getSize() > enemy.getSize()) {
                    const scoreIncrease = Math.floor(enemy.getSize());
                    this.player.adjustScore(scoreIncrease);
                    console.log(`Player defeated enemy. Score increase: ${scoreIncrease}`);
                    this.enemies.splice(index, 1);
                } else {
                    const bounceDistance = 20;
                    const bounceX = enemy.getX() + (dx / distance) * bounceDistance;
                    const bounceY = enemy.getY() + (dy / distance) * bounceDistance;
                    enemy.setPosition(bounceX, bounceY);
                }
            }

            // Only allow digging in the normal dimension
            if (!isAlternateDimension && enemy.isDigging()) {
                enemy.dig(this.terrain);
            }
        });

        if (this.enemies.length < this.maxEnemies) {
            const enemiesToSpawn = Math.min(5, this.maxEnemies - this.enemies.length);
            this.spawnEnemies(enemiesToSpawn);
        }
    }

    public toggleControls() {
        this.isMouseControl = !this.isMouseControl;
        if (this.isMouseControl) {
            this.keysPressed.clear();
        }
        console.log(`Mouse control is now ${this.isMouseControl ? 'enabled' : 'disabled'}`);
    }

    private toggleEmoteWheel() {
        this.isEmoteWheelOpen = !this.isEmoteWheelOpen;
        if (!this.isEmoteWheelOpen) {
            this.selectedEmote = null;
        }
    }

    private getEmoteFromPosition(x: number, y: number): Emote | null {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= this.emoteWheelRadius) {
            const angle = Math.atan2(dy, dx);
            const index = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * Object.keys(Emote).length / 2);
            return index as Emote;
        }

        return null;
    }

    private renderEmoteWheel() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const emoteCount = Object.keys(Emote).length / 2;
        const angleStep = (2 * Math.PI) / emoteCount;

        this.context.save();
        this.context.beginPath();
        this.context.arc(centerX, centerY, this.emoteWheelRadius, 0, 2 * Math.PI);
        this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.context.fill();

        const ownedEmotes = this.player.getOwnedEmotes();
        for (let i = 0; i < ownedEmotes.length; i++) {
            const emote = ownedEmotes[i];
            const angle = i * angleStep;
            const x = centerX + Math.cos(angle) * this.emoteWheelRadius * 0.8;
            const y = centerY + Math.sin(angle) * this.emoteWheelRadius * 0.8;

            this.context.font = '20px Arial';
            this.context.fillStyle = emote === this.selectedEmote ? 'yellow' : 'white';
            this.context.textAlign = 'center';
            this.context.textBaseline = 'middle';
            this.context.fillText(this.getEmoteText(emote), x, y);
        }

        this.context.restore();
    }

    private getEmoteText(emote: Emote): string {
        switch (emote) {
            case Emote.Happy: return '😊';
            case Emote.Sad: return '😢';
            case Emote.Angry: return '😠';
            case Emote.Surprised: return '😮';
            case Emote.Love: return '😍';
            case Emote.Cool: return '😎';
            case Emote.Thinking: return '🤔';
            case Emote.Laughing: return '😂';
            case Emote.Wink: return '😉';
            case Emote.Confused: return '😕';
            case Emote.Sleepy: return '😴';
            case Emote.Excited: return '🤩';
            case Emote.Nervous: return '😰';
            case Emote.Sick: return '🤢';
            case Emote.Rich: return '🤑';
            case Emote.Strong: return '';
            case Emote.Scared: return '';
            case Emote.Crazy: return '🤪';
            case Emote.Evil: return '😈';
            case Emote.Dead: return '💀';
            default: return '';
        }
    }

    private toggleDimension() {
        if (this.portalCooldown === 0) {
            this.soundManager.playPortalSound();
            switch (this.currentDimension) {
                case 'normal':
                    this.currentDimension = 'alternate';
                    this.player.setInAlternateDimension(true);
                    const alternateDimensionPortal = this.alternateDimension!.getRegularPortalLocation();
                    this.player.setPosition(alternateDimensionPortal.x, alternateDimensionPortal.y);
                    break;
                case 'alternate':
                    this.currentDimension = 'grass';
                    this.player.setInAlternateDimension(true); // Still in an alternate dimension
                    const grassDimensionPortal = this.grassDimension!.getRegularPortalLocation();
                    this.player.setPosition(grassDimensionPortal.x, grassDimensionPortal.y);
                    break;
                case 'grass':
                    this.currentDimension = 'normal';
                    this.player.setInAlternateDimension(false);
                    const normalDimensionPortal = this.terrain.getPortalLocation();
                    this.player.setPosition(normalDimensionPortal.x, normalDimensionPortal.y);
                    break;
            }
            this.portalCooldown = this.PORTAL_COOLDOWN_DURATION;
            this.updateCameraPosition();
            this.updateMinimapVisibility();
        } else {
            console.log("Portal on cooldown. Time remaining:", this.portalCooldown / 1000, "seconds");
        }
    }

    private updateCameraPosition() {
        const effectiveWidth = this.canvas.width / this.zoom;
        const effectiveHeight = this.canvas.height / this.zoom;
        this.cameraX = Math.max(0, Math.min(this.terrain.getWidth() - effectiveWidth, this.player.getX() - effectiveWidth / 2));
        this.cameraY = Math.max(0, Math.min(this.terrain.getHeight() - effectiveHeight, this.player.getY() - effectiveHeight / 2));
    }

    private renderPortalCooldown() {
        const cooldownPercentage = this.portalCooldown / this.PORTAL_COOLDOWN_DURATION;
        const barWidth = 200;
        const barHeight = 20;
        const x = (this.canvas.width - barWidth) / 2;
        const y = 50;

        this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.context.fillRect(x, y, barWidth, barHeight);

        this.context.fillStyle = 'rgba(0, 100, 255, 0.7)';
        this.context.fillRect(x, y, barWidth * (1 - cooldownPercentage), barHeight);

        this.context.fillStyle = 'white';
        this.context.font = '14px Arial';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';
        this.context.fillText('Portal Cooldown', x + barWidth / 2, y + barHeight / 2);
    }

    private handlePlayerDeath() {
        console.log("Player has died!");
        this.isGameOver = true;
        
        let killedByMessage = "an unknown cause";
        switch (this.lastDamageSource) {
            case 'bee':
                killedByMessage = "a bumble bee";
                break;
            case 'cloud':
                killedByMessage = "a cloud mob";
                break;
            case 'enemy':
                killedByMessage = "an enemy";
                break;
        }
        
        this.gameOverMessage = `Game Over! You have been killed by ${killedByMessage}.`;

        this.render();

        setTimeout(() => {
            window.location.reload();
        }, 3000); // Increased to 3 seconds to give more time to read the message
    }

    private renderGameOverMessage() {
        const ctx = this.context;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.font = '48px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.gameOverMessage, this.canvas.width / 2, this.canvas.height / 2);

        ctx.font = '24px Arial';
        ctx.fillText('Reloading...', this.canvas.width / 2, this.canvas.height / 2 + 50);
        ctx.restore();
    }

    public renderMinimap(context: CanvasRenderingContext2D, width: number, height: number) {
        if (this.currentDimension === 'alternate' && this.alternateDimension) {
            this.renderAlternateDimensionMinimap(context, width, height);
        } else if (this.currentDimension === 'grass' && this.grassDimension) {
            this.renderGrassDimensionMinimap(context, width, height);
        }
    }

    private renderAlternateDimensionMinimap(context: CanvasRenderingContext2D, width: number, height: number) {
        const scale = Math.min(width / this.alternateDimension!.getWidth(), height / this.alternateDimension!.getHeight());

        context.fillStyle = '#000033'; // Dark blue background
        context.fillRect(0, 0, width, height);

        context.fillStyle = 'white'; // Walls
        this.alternateDimension!.getWalls().forEach(wall => {
            context.fillRect(
                wall.x * scale,
                wall.y * scale,
                wall.width * scale,
                wall.height * scale
            );
        });

        const portal = this.alternateDimension!.getRegularPortalLocation();
        context.fillStyle = '#00BFFF'; // Light blue portal
        context.beginPath();
        context.arc(portal.x * scale, portal.y * scale, 5, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = 'red'; // Player
        context.beginPath();
        context.arc(this.player.getX() * scale, this.player.getY() * scale, 3, 0, Math.PI * 2);
        context.fill();
    }

    private renderGrassDimensionMinimap(context: CanvasRenderingContext2D, width: number, height: number) {
        const scale = Math.min(width / this.grassDimension!.getWidth(), height / this.grassDimension!.getHeight());

        context.fillStyle = '#87CEEB'; // Sky blue background (water)
        context.fillRect(0, 0, width, height);

        context.fillStyle = '#228B22'; // Forest green for islands
        this.grassDimension!.getIslands().forEach(island => {
            context.beginPath();
            context.arc(island.x * scale, island.y * scale, island.radius * scale, 0, Math.PI * 2);
            context.fill();
        });

        // Draw bridges on minimap
        context.strokeStyle = '#8B4513'; // Saddle Brown for bridges
        this.grassDimension!.getBridges().forEach(bridge => {
            context.beginPath();
            context.moveTo(bridge.start.x * scale, bridge.start.y * scale);
            context.lineTo(bridge.end.x * scale, bridge.end.y * scale);
            context.lineWidth = bridge.width * scale;
            context.stroke();
        });

        const regularPortal = this.grassDimension!.getRegularPortalLocation();
        const grassPortal = this.grassDimension!.getGrassPortalLocation();
        
        context.fillStyle = '#00BFFF'; // Light blue for portals
        context.beginPath();
        context.arc(regularPortal.x * scale, regularPortal.y * scale, 5, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(grassPortal.x * scale, grassPortal.y * scale, 5, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = 'red'; // Player
        context.beginPath();
        context.arc(this.player.getX() * scale, this.player.getY() * scale, 3, 0, Math.PI * 2);
        context.fill();
    }

    private updateMinimapVisibility() {
        const minimapCanvas = document.querySelector('canvas:not(#gameCanvas)') as HTMLCanvasElement;
        if (minimapCanvas) {
            minimapCanvas.style.display = this.currentDimension !== 'normal' ? 'block' : 'none';
        }
    }

    private distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    private updateCloudMobs(deltaTime: number) {
        this.cloudMobs.forEach((cloudMob, index) => {
            cloudMob.update(deltaTime);
            
            const dx = this.player.getX() - cloudMob.getX();
            const dy = this.player.getY() - cloudMob.getY();
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < (this.player.getSize() + cloudMob.getSize()) / 2) {
                // Collision detected
                const damage = Math.floor(this.player.getSize() * 0.1); // Player deals 10% of its size as damage
                cloudMob.takeDamage(damage);
                cloudMob.bounceOff(this.player.getX(), this.player.getY());

                if (cloudMob.isDead()) {
                    const scoreIncrease = Math.floor(cloudMob.getSize());
                    this.player.adjustScore(scoreIncrease);
                    console.log(`Player destroyed cloud. Score increase: ${scoreIncrease}`);
                    this.cloudMobs.splice(index, 1);
                } else {
                    this.player.takeDamage(10); // Cloud deals 10 damage to player
                    this.lastDamageSource = 'cloud';
                    console.log(`Cloud dealt 10 damage to player. Player health: ${this.player.getHealth()}`);
                }
            }
        });

        if (this.cloudMobs.length < this.maxCloudMobs) {
            const cloudsToSpawn = Math.min(2, this.maxCloudMobs - this.cloudMobs.length);
            this.spawnCloudMobs(cloudsToSpawn);
        }
    }

    private spawnCloudMobs(count: number) {
        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.terrain.getWidth();
            const y = Math.random() * this.terrain.getHeight();
            const size = Math.random() * 30 + 20; // Cloud size between 20 and 50
            const health = size * 10; // Health proportional to size
            const cloudMob = new CloudMob(x, y, size, health, this.context, this.player, this.terrain);
            this.cloudMobs.push(cloudMob);
        }
    }

    private renderCloudMobs() {
        this.cloudMobs.forEach(cloudMob => {
            if (this.isCloudMobVisible(cloudMob)) {
                cloudMob.draw();
            }
        });
    }

    private isCloudMobVisible(cloudMob: CloudMob): boolean {
        const cloudMobX = cloudMob.getX();
        const cloudMobY = cloudMob.getY();
        const playerX = this.player.getX();
        const playerY = this.player.getY();
        const visibleWidth = this.canvas.width / this.zoom;
        const visibleHeight = this.canvas.height / this.zoom;

        return (
            cloudMobX >= playerX - visibleWidth / 2 &&
            cloudMobX <= playerX + visibleWidth / 2 &&
            cloudMobY >= playerY - visibleHeight / 2 &&
            cloudMobY <= playerY + visibleHeight / 2
        );
    }

    private updateBumbleBees(deltaTime: number) {
        const bees = this.grassDimension!.getBumbleBees();
        
        bees.forEach(bee => {
            bee.update(deltaTime);
            
            const dx = this.player.getX() - bee.getX();
            const dy = this.player.getY() - bee.getY();
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < (this.player.getSize() + bee.getSize()) / 2) {
                if (bee.isAngered()) {
                    const damage = Math.floor(this.player.getMaxHealth() * 0.75);
                    this.player.takeDamage(damage);
                    this.lastDamageSource = 'bee';
                    console.log(`Bee dealt ${damage} damage to player. Player health: ${this.player.getHealth()}`);
                } else {
                    bee.anger();
                    this.soundManager.playAngryBeeSound(); // Play the angry bee sound
                }
            }
        });

        // Filter out dead bees and stop their buzzing
        const aliveBees = bees.filter(bee => {
            if (bee.isDead()) {
                bee.stopBuzzing();
                return false;
            }
            return true;
        });

        // Update the bees array in the grass dimension
        this.grassDimension!.setBumbleBees(aliveBees);
    }

    // Add a new method to handle item collection
    public collectItem(itemType: string) {
        this.soundManager.playCollectSound();
        // Add any other item collection logic here
    }

    public getSoundManager(): SoundManager {
        return this.soundManager;
    }
    private createVolumeSlider(): HTMLInputElement {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.1';
        slider.value = this.soundManager.getVolume().toString();
        slider.style.position = 'absolute';
        slider.style.top = '10px';
        slider.style.right = '10px';
        slider.style.width = '100px';
        slider.style.zIndex = '1000';
        
        slider.addEventListener('input', () => {
            const volume = parseFloat(slider.value);
            this.soundManager.setVolume(volume);
        });

        document.body.appendChild(slider);
        return slider;
    }

    private createMuteButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = '🔊'; // Unicode speaker icon
        button.style.position = 'absolute';
        button.style.top = '10px';
        button.style.right = '120px'; // Position it next to the volume slider
        button.style.zIndex = '1000';
        button.style.fontSize = '24px';
        button.style.padding = '5px 10px';
        button.style.backgroundColor = 'transparent';
        button.style.border = 'none';
        button.style.color = 'white';
        button.style.cursor = 'pointer';

        button.addEventListener('click', () => this.toggleMute());

        document.body.appendChild(button);
        return button;
    }

    private toggleMute(): void {
        this.isMuted = !this.isMuted;
        this.soundManager.setMute(this.isMuted);
        this.muteButton.textContent = this.isMuted ? '🔇' : '🔊';
        if (this.isMuted) {
            this.volumeSlider.disabled = true;
        } else {
            this.volumeSlider.disabled = false;
        }
        localStorage.setItem('isMuted', this.isMuted.toString());
    }

    private loadSettings() {
        const muteSetting = localStorage.getItem('isMuted');
        this.isMuted = muteSetting === 'true';
    }

    private applySettings() {
        this.soundManager.setMute(this.isMuted);
        this.muteButton.textContent = this.isMuted ? '🔇' : '🔊';
        this.volumeSlider.disabled = this.isMuted;
    }
}