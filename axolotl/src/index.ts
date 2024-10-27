// ... (keep the existing imports and Player class)

import { io, Socket } from 'socket.io-client';

interface Player {
    id: string;
    x: number;
    y: number;
    angle: number;
    score: number;
    imageLoaded: boolean;
    image: HTMLImageElement;
    velocityX: number;
    velocityY: number;
    health: number; // Add health property
    inventory: Item[];
    level: number;
    xp: number;
    xpToNextLevel: number;
    maxHealth: number;
    damage: number;
}

interface Dot {
    x: number;
    y: number;
}

interface Enemy {
    id: string;
    type: 'octopus' | 'fish';
    tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
    x: number;
    y: number;
    angle: number;
    health: number;
    speed: number;
    damage: number;
}

interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'coral';
  isEnemy: boolean;
  health?: number;
}

interface Item {
    id: string;
    type: 'health_potion' | 'speed_boost' | 'shield';
    x: number;
    y: number;
}

let currentGame: Game | null = null;

window.onload = () => {
    const singlePlayerButton = document.getElementById('singlePlayerButton');
    const multiPlayerButton = document.getElementById('multiPlayerButton');

    singlePlayerButton?.addEventListener('click', () => {
        if (currentGame) {
            // Cleanup previous game
            currentGame.cleanup();
        }
        currentGame = new Game(true);
    });

    multiPlayerButton?.addEventListener('click', () => {
        if (currentGame) {
            // Cleanup previous game
            currentGame.cleanup();
        }
        currentGame = new Game(false);
    });
};

// Add this at the top of index.ts, before the Game class
const workerCode = `
// Worker code starts here
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const ENEMY_COUNT = 10;
const OBSTACLE_COUNT = 20;
const ENEMY_CORAL_PROBABILITY = 0.3;
const ENEMY_CORAL_HEALTH = 50;
const ENEMY_CORAL_DAMAGE = 5;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_DAMAGE = 10;
const ITEM_COUNT = 10;
const MAX_INVENTORY_SIZE = 5;
const PLAYER_SIZE = 40;
const COLLISION_RADIUS = PLAYER_SIZE / 2;
const ENEMY_SIZE = 40;
const RESPAWN_INVULNERABILITY_TIME = 3000;
const KNOCKBACK_FORCE = 100;
const KNOCKBACK_RECOVERY_SPEED = 0.9;

const ENEMY_TIERS = {
    common: { health: 20, speed: 0.5, damage: 5, probability: 0.4 },
    uncommon: { health: 40, speed: 0.75, damage: 10, probability: 0.3 },
    rare: { health: 60, speed: 1, damage: 15, probability: 0.15 },
    epic: { health: 80, speed: 1.25, damage: 20, probability: 0.1 },
    legendary: { health: 100, speed: 1.5, damage: 25, probability: 0.04 },
    mythic: { health: 150, speed: 2, damage: 30, probability: 0.01 }
};

const players = {};
const enemies = [];
const obstacles = [];
const items = [];
const dots = [];

// Add Decoration interface
interface Decoration {
    x: number;
    y: number;
    scale: number;  // For random sizes
}

// Add decorations array and constants
const DECORATION_COUNT = 100;  // Number of palms to spawn
const decorations: Decoration[] = [];

// Add createDecoration function
function createDecoration(): Decoration {
    return {
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        scale: 0.5 + Math.random() * 1.5  // Random size between 0.5x and 2x
    };
}

// Add Sand interface
interface Sand {
    x: number;
    y: number;
    radius: number;  // Random size for each sand blob
    rotation: number;  // For slight variation in shape
}

// Add sand array and constants
const SAND_COUNT = 200;  // Number of sand blobs
const MIN_SAND_RADIUS = 30;
const MAX_SAND_RADIUS = 80;
const sands: Sand[] = [];

// Add createSand function
function createSand(): Sand {
    return {
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        radius: MIN_SAND_RADIUS + Math.random() * (MAX_SAND_RADIUS - MIN_SAND_RADIUS),
        rotation: Math.random() * Math.PI * 2
    };
}

function createEnemy() {
    const tierRoll = Math.random();
    let tier = 'common';
    let cumulativeProbability = 0;
    for (const [t, data] of Object.entries(ENEMY_TIERS)) {
        cumulativeProbability += data.probability;
        if (tierRoll < cumulativeProbability) {
            tier = t;
            break;
        }
    }
    const tierData = ENEMY_TIERS[tier];
    return {
        id: Math.random().toString(36).substr(2, 9),
        type: Math.random() < 0.5 ? 'octopus' : 'fish',
        tier,
        x: Math.ranFdom() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        angle: Math.random() * Math.PI * 2,
        health: tierData.health,
        speed: tierData.speed,
        damage: tierData.damage,
        knockbackX: 0,
        knockbackY: 0
    };
}

function createObstacle() {
    const isEnemy = Math.random() < ENEMY_CORAL_PROBABILITY;
    return {
        id: Math.random().toString(36).substr(2, 9),
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        width: 50 + Math.random() * 50,
        height: 50 + Math.random() * 50,
        type: 'coral',
        isEnemy,
        health: isEnemy ? ENEMY_CORAL_HEALTH : undefined
    };
}

function createItem() {
    return {
        id: Math.random().toString(36).substr(2, 9),
        type: ['health_potion', 'speed_boost', 'shield'][Math.floor(Math.random() * 3)],
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT
    };
}

function moveEnemies() {
    enemies.forEach(enemy => {
        if (enemy.knockbackX) {
            enemy.knockbackX *= KNOCKBACK_RECOVERY_SPEED;
            enemy.x += enemy.knockbackX;
            if (Math.abs(enemy.knockbackX) < 0.1) enemy.knockbackX = 0;
        }
        if (enemy.knockbackY) {
            enemy.knockbackY *= KNOCKBACK_RECOVERY_SPEED;
            enemy.y += enemy.knockbackY;
            if (Math.abs(enemy.knockbackY) < 0.1) enemy.knockbackY = 0;
        }

        if (enemy.type === 'octopus') {
            enemy.x += (Math.random() * 4 - 2) * enemy.speed;
            enemy.y += (Math.random() * 4 - 2) * enemy.speed;
        } else {
            enemy.x += Math.cos(enemy.angle) * 2 * enemy.speed;
            enemy.y += Math.sin(enemy.angle) * 2 * enemy.speed;
        }

        enemy.x = (enemy.x + WORLD_WIDTH) % WORLD_WIDTH;
        enemy.y = (enemy.y + WORLD_HEIGHT) % WORLD_HEIGHT;

        if (enemy.type === 'fish' && Math.random() < 0.02) {
            enemy.angle = Math.random() * Math.PI * 2;
        }
    });
}

class MockSocket {
    constructor() {
        this.eventHandlers = new Map();
        this.id = 'player1';
        this.broadcast = {
            emit: (event, data) => {
                // In single player, broadcast events are ignored
            }
        };
    }
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)?.push(handler);
    }
    emit(event, data) {
        self.postMessage({
            type: 'socketEvent',
            event,
            data
        });
    }
    getId() {
        return this.id;
    }
}

const mockIo = {
    emit: (event, data) => {
        self.postMessage({
            type: 'socketEvent',
            event,
            data
        });
    }
};

const socket = new MockSocket();

function initializeGame(messageData?: { savedProgress?: any }) {
    console.log('Initializing game state in worker');
    
    players[socket.id] = {
        id: socket.id,
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        angle: 0,
        score: 0,
        velocityX: 0,
        velocityY: 0,
        health: PLAYER_MAX_HEALTH,
        inventory: [],
        isInvulnerable: true,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        maxHealth: PLAYER_MAX_HEALTH,
        damage: PLAYER_DAMAGE
    };

    setTimeout(() => {
        if (players[socket.id]) {
            players[socket.id].isInvulnerable = false;
        }
    }, RESPAWN_INVULNERABILITY_TIME);

    for (let i = 0; i < ENEMY_COUNT; i++) {
        enemies.push(createEnemy());
    }

    for (let i = 0; i < OBSTACLE_COUNT; i++) {
        obstacles.push(createObstacle());
    }

    for (let i = 0; i < ITEM_COUNT; i++) {
        items.push(createItem());
    }

    for (let i = 0; i < 20; i++) {
        dots.push({
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * WORLD_HEIGHT
        });
    }

    // Create decorations
    for (let i = 0; i < DECORATION_COUNT; i++) {
        decorations.push(createDecoration());
    }

    // Add decorations to the initial state
    socket.emit('decorationsUpdate', decorations);

    // Create sand blobs
    for (let i = 0; i < SAND_COUNT; i++) {
        sands.push(createSand());
    }

    // Add sand to the initial state
    socket.emit('sandsUpdate', sands);

    socket.emit('currentPlayers', players);
    socket.emit('enemiesUpdate', enemies);
    socket.emit('obstaclesUpdate', obstacles);
    socket.emit('itemsUpdate', items);
    socket.emit('playerMoved', players[socket.id]);
}

// Add this function to handle level loss
function loseLevel(player: Player): void {
    if (player.level > 1) {
        player.level--;
        player.maxHealth -= HEALTH_PER_LEVEL;
        player.damage -= DAMAGE_PER_LEVEL;
        player.xp = 0;
        player.xpToNextLevel = calculateXPRequirement(player.level);
    }
}

// Update the respawnPlayer function
function respawnPlayer(player: Player) {
    // Lose a level on death
    loseLevel(player);
    
    // Reset position and stats
    player.health = player.maxHealth;
    player.x = Math.random() * WORLD_WIDTH;
    player.y = Math.random() * WORLD_HEIGHT;
    player.score = Math.max(0, player.score - 10);
    player.inventory = [];
    player.isInvulnerable = true;

    // Notify about level loss and respawn
    socket.emit('playerLostLevel', {
        playerId: player.id,
        level: player.level,
        maxHealth: player.maxHealth,
        damage: player.damage,
        xp: player.xp,
        xpToNextLevel: player.xpToNextLevel
    });

    socket.emit('playerRespawned', player);

    setTimeout(() => {
        player.isInvulnerable = false;
    }, RESPAWN_INVULNERABILITY_TIME);
}

self.onmessage = (event) => {
    const { type, event: socketEvent, data } = event.data;
    console.log('Worker received message:', type, data);
    
    switch (type) {
        case 'init':
            initializeGame(event.data);
            break;

        case 'socketEvent':
            switch (socketEvent) {
                case 'playerMovement':
                    const player = players[socket.id];
                    if (player) {
                        let newX = data.x;
                        let newY = data.y;

                        if (player.knockbackX) {
                            player.knockbackX *= KNOCKBACK_RECOVERY_SPEED;
                            newX += player.knockbackX;
                            if (Math.abs(player.knockbackX) < 0.1) player.knockbackX = 0;
                        }
                        if (player.knockbackY) {
                            player.knockbackY *= KNOCKBACK_RECOVERY_SPEED;
                            newY += player.knockbackY;
                            if (Math.abs(player.knockbackY) < 0.1) player.knockbackY = 0;
                        }

                        let collision = false;

                        for (const enemy of enemies) {
                            if (
                                newX < enemy.x + ENEMY_SIZE &&
                                newX + PLAYER_SIZE > enemy.x &&
                                newY < enemy.y + ENEMY_SIZE &&
                                newY + PLAYER_SIZE > enemy.y
                            ) {
                                collision = true;
                                if (!player.isInvulnerable) {
                                    player.health -= enemy.damage;
                                    socket.emit('playerDamaged', { playerId: player.id, health: player.health });

                                    enemy.health -= player.damage;  // Use player.damage instead of PLAYER_DAMAGE
                                    socket.emit('enemyDamaged', { enemyId: enemy.id, health: enemy.health });

                                    const dx = enemy.x - newX;
                                    const dy = enemy.y - newY;
                                    const distance = Math.sqrt(dx * dx + dy * dy);
                                    const normalizedDx = dx / distance;
                                    const normalizedDy = dy / distance;

                                    newX -= normalizedDx * KNOCKBACK_FORCE;
                                    newY -= normalizedDy * KNOCKBACK_FORCE;
                                    
                                    player.knockbackX = -normalizedDx * KNOCKBACK_FORCE;
                                    player.knockbackY = -normalizedDy * KNOCKBACK_FORCE;

                                    if (enemy.health <= 0) {
                                        const index = enemies.findIndex(e => e.id === enemy.id);
                                        if (index !== -1) {
                                            enemies.splice(index, 1);
                                            socket.emit('enemyDestroyed', enemy.id);
                                            enemies.push(createEnemy());
                                        }
                                    }

                                    if (player.health <= 0) {
                                        respawnPlayer(player);
                                        socket.emit('playerDied', player.id);
                                        socket.emit('playerRespawned', player);
                                        return;
                                    }
                                }
                                break;
                            }
                        }

                        for (const obstacle of obstacles) {
                            if (
                                newX < obstacle.x + obstacle.width &&
                                newX + PLAYER_SIZE > obstacle.x &&
                                newY < obstacle.y + obstacle.height &&
                                newY + PLAYER_SIZE > obstacle.y
                            ) {
                                collision = true;
                                if (obstacle.isEnemy && !player.isInvulnerable) {
                                    player.health -= ENEMY_CORAL_DAMAGE;
                                    socket.emit('playerDamaged', { playerId: player.id, health: player.health });

                                    if (player.health <= 0) {
                                        respawnPlayer(player);
                                        socket.emit('playerDied', player.id);
                                        socket.emit('playerRespawned', player);
                                        return;
                                    }
                                }
                                break;
                            }
                        }

                        player.x = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX));
                        player.y = Math.max(0, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY));
                        player.angle = data.angle;
                        player.velocityX = data.velocityX;
                        player.velocityY = data.velocityY;

                        socket.emit('playerMoved', player);
                    }
                    break;

                case 'collectItem':
                    const itemIndex = items.findIndex(item => item.id === data.itemId);
                    if (itemIndex !== -1 && players[socket.id].inventory.length < MAX_INVENTORY_SIZE) {
                        const item = items[itemIndex];
                        players[socket.id].inventory.push(item);
                        items.splice(itemIndex, 1);
                        items.push(createItem());
                        socket.emit('itemCollected', { playerId: socket.id, itemId: data.itemId });
                    }
                    break;

                case 'useItem':
                    const playerUsingItem = players[socket.id];
                    const inventoryIndex = playerUsingItem.inventory.findIndex(item => item.id === data.itemId);
                    if (inventoryIndex !== -1) {
                        const item = playerUsingItem.inventory[inventoryIndex];
                        playerUsingItem.inventory.splice(inventoryIndex, 1);
                        switch (item.type) {
                            case 'health_potion':
                                playerUsingItem.health = Math.min(playerUsingItem.health + 50, PLAYER_MAX_HEALTH);
                                break;
                            case 'speed_boost':
                                break;
                            case 'shield':
                                break;
                        }
                        socket.emit('itemUsed', { playerId: socket.id, itemId: data.itemId });
                    }
                    break;
            }
            break;
    }
};

setInterval(() => {
    moveEnemies();
    mockIo.emit('enemiesUpdate', enemies);
}, 100);

self.onerror = (error) => {
    console.error('Worker error:', error);
};
`;

class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private socket!: Socket;  // Using the definite assignment assertion
    private players: Map<string, Player> = new Map();
    private playerSprite: HTMLImageElement;
    private dots: Dot[] = [];
    private readonly DOT_SIZE = 5;
    private readonly DOT_COUNT = 20;
    // Reduce these values for even slower movement
    private readonly PLAYER_ACCELERATION = 0.2;  // Reduced from 0.5 to 0.2
    private readonly MAX_SPEED = 4;             // Reduced from 8 to 4
    private readonly FRICTION = 0.92;           // Increased friction from 0.95 to 0.92 for even quicker deceleration
    private cameraX = 0;
    private cameraY = 0;
    private readonly WORLD_WIDTH = 10000;  // Increased from 2000 to 10000
    private readonly WORLD_HEIGHT = 2000;  // Keep height the same
    private keysPressed: Set<string> = new Set();
    private enemies: Map<string, Enemy> = new Map();
    private octopusSprite: HTMLImageElement;
    private fishSprite: HTMLImageElement;
    private readonly PLAYER_MAX_HEALTH = 100;
    private readonly ENEMY_MAX_HEALTH: Record<Enemy['tier'], number> = {
        common: 20,
        uncommon: 40,
        rare: 60,
        epic: 80,
        legendary: 100,
        mythic: 150
    };
    private readonly PLAYER_DAMAGE = 10;
    private readonly ENEMY_DAMAGE = 5;
    private readonly DAMAGE_COOLDOWN = 1000; // 1 second cooldown
    private lastDamageTime: number = 0;
    private readonly ENEMY_COLORS = {
        common: '#808080',
        uncommon: '#008000',
        rare: '#0000FF',
        epic: '#800080',
        legendary: '#FFA500',
        mythic: '#FF0000'
    };
    private obstacles: Obstacle[] = [];
    private coralSprite: HTMLImageElement;
    private readonly ENEMY_CORAL_MAX_HEALTH = 50;
    private items: Item[] = [];
    private itemSprites: Record<string, HTMLImageElement> = {};
    private isInventoryOpen: boolean = false;
    private isSinglePlayer: boolean = false;
    private worker: Worker | null = null;
    private gameLoopId: number | null = null;
    private socketHandlers: Map<string, Function> = new Map();
    private readonly BASE_XP_REQUIREMENT = 100;
    private readonly XP_MULTIPLIER = 1.5;
    private readonly MAX_LEVEL = 50;
    private readonly HEALTH_PER_LEVEL = 10;
    private readonly DAMAGE_PER_LEVEL = 2;
    // Add this property to store floating texts
    private floatingTexts: Array<{
        x: number;
        y: number;
        text: string;
        color: string;
        fontSize: number;
        alpha: number;
        lifetime: number;
    }> = [];
    // Add enemy size multipliers as a class property
    private readonly ENEMY_SIZE_MULTIPLIERS: Record<Enemy['tier'], number> = {
        common: 1.0,
        uncommon: 1.2,
        rare: 1.4,
        epic: 1.6,
        legendary: 1.8,
        mythic: 2.0
    };
    // Add property to track if player is dead
    private isPlayerDead: boolean = false;
    // Add minimap properties
    private readonly MINIMAP_WIDTH = 200;
    private readonly MINIMAP_HEIGHT = 40;
    private readonly MINIMAP_PADDING = 10;
    // Add decoration-related properties
    private palmSprite: HTMLImageElement;
    private decorations: Array<{
        x: number;
        y: number;
        scale: number;
    }> = [];
    // Add sand property
    private sands: Array<{
        x: number;
        y: number;
        radius: number;
        rotation: number;
    }> = [];
    // Add control mode property
    private useMouseControls: boolean = false;
    private mouseX: number = 0;
    private mouseY: number = 0;

    constructor(isSinglePlayer: boolean = false) {
        console.log('Game constructor called');
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        
        // Set initial canvas size
        this.resizeCanvas();
        
        // Add resize listener
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.isSinglePlayer = isSinglePlayer;

        // Initialize sprites and other resources with relative paths
        this.playerSprite = new Image();
        this.playerSprite.src = './assets/player.png';
        this.playerSprite.onload = () => {
            console.log('Player sprite loaded successfully');
            this.gameLoop();
        };
        this.playerSprite.onerror = (e) => {
            console.error('Error loading player sprite:', e);
        };
        this.octopusSprite = new Image();
        this.octopusSprite.src = './assets/octopus.png';
        this.fishSprite = new Image();
        this.fishSprite.src = './assets/fish.png';
        this.coralSprite = new Image();
        this.coralSprite.src = './assets/coral.png';

        // Load palm sprite
        this.palmSprite = new Image();
        this.palmSprite.src = './assets/palm.png';
        this.palmSprite.onerror = (e) => {
            console.error('Error loading palm sprite:', e);
        };

        this.setupEventListeners();
        this.setupItemSprites();

        // Initialize game mode after resource loading
        if (this.isSinglePlayer) {
            this.initSinglePlayerMode();
        } else {
            this.initMultiPlayerMode();
        }

        // Add respawn button listener
        const respawnButton = document.getElementById('respawnButton');
        respawnButton?.addEventListener('click', () => {
            if (this.isPlayerDead) {
                this.socket.emit('requestRespawn');
            }
        });

        // Add mouse move listener
        this.canvas.addEventListener('mousemove', (event) => {
            if (this.useMouseControls) {
                const rect = this.canvas.getBoundingClientRect();
                this.mouseX = event.clientX - rect.left + this.cameraX;
                this.mouseY = event.clientY - rect.top + this.cameraY;
            }
        });
    }

    private initSinglePlayerMode() {
        console.log('Initializing single player mode');
        try {
            // Create the worker using the separate file
            this.worker = new Worker(new URL('./singlePlayerWorker.ts', import.meta.url));
            
            // Load saved progress
            const savedProgress = this.loadPlayerProgress();
            console.log('Loaded saved progress:', savedProgress);  // Debug log
            
            // Create a mock socket for single player
            const mockSocket = {
                id: 'player1',
                emit: (event: string, data: any) => {
                    console.log('Emitting event:', event, data);
                    this.worker?.postMessage({
                        type: 'socketEvent',
                        event,
                        data
                    });
                },
                on: (event: string, handler: Function) => {
                    console.log('Registering handler for event:', event);
                    this.socketHandlers.set(event, handler);
                },
                disconnect: () => {
                    this.worker?.terminate();
                }
            };

            // Use mock socket instead of real socket
            this.socket = mockSocket as any;

            // Set up socket event handlers first
            this.setupSocketListeners();

            // Handle messages from worker
            this.worker.onmessage = (event) => {
                const { type, event: socketEvent, data } = event.data;
                console.log('Received message from worker:', type, socketEvent, data);
                
                if (type === 'socketEvent') {
                    const handler = this.socketHandlers.get(socketEvent);
                    if (handler) {
                        handler(data);
                    }
                }
            };

            // Initialize the game with saved progress
            console.log('Sending init message to worker with saved progress');
            this.worker.postMessage({ 
                type: 'init',
                savedProgress  // Pass the saved progress directly here
            });
        } catch (error) {
            console.error('Error initializing worker:', error);
        }
    }

    private initMultiPlayerMode() {
        this.socket = io(prompt("Enter the server URL eg https://localhost:3000: \n Join a public server: https://54.151.123.177:3000/") || "", { 
            secure: true,
            rejectUnauthorized: false,
            withCredentials: true
        });
        this.setupSocketListeners();
    }

    private setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
        });

        this.socket.on('currentPlayers', (players: Record<string, Player>) => {
            console.log('Received current players:', players);
            this.players.clear();
            Object.values(players).forEach(player => {
                this.players.set(player.id, {...player, imageLoaded: true, score: 0, velocityX: 0, velocityY: 0, health: this.PLAYER_MAX_HEALTH});
            });
        });

        this.socket.on('newPlayer', (player: Player) => {
            console.log('New player joined:', player);
            this.players.set(player.id, {...player, imageLoaded: true, score: 0, velocityX: 0, velocityY: 0, health: this.PLAYER_MAX_HEALTH});
        });

        this.socket.on('playerMoved', (player: Player) => {
            console.log('Player moved:', player);
            const existingPlayer = this.players.get(player.id);
            if (existingPlayer) {
                Object.assign(existingPlayer, player);
            } else {
                this.players.set(player.id, {...player, imageLoaded: true, score: 0, velocityX: 0, velocityY: 0, health: this.PLAYER_MAX_HEALTH});
            }
        });

        this.socket.on('playerDisconnected', (playerId: string) => {
            console.log('Player disconnected:', playerId);
            this.players.delete(playerId);
        });

        this.socket.on('dotCollected', (data: { playerId: string, dotIndex: number }) => {
            const player = this.players.get(data.playerId);
            if (player) {
                player.score++;
            }
            this.dots.splice(data.dotIndex, 1);
            this.generateDot();
        });

        this.socket.on('enemiesUpdate', (enemies: Enemy[]) => {
            this.enemies.clear();
            enemies.forEach(enemy => this.enemies.set(enemy.id, enemy));
        });

        this.socket.on('enemyMoved', (enemy: Enemy) => {
            this.enemies.set(enemy.id, enemy);
        });

        this.socket.on('playerDamaged', (data: { playerId: string, health: number }) => {
            const player = this.players.get(data.playerId);
            if (player) {
                player.health = data.health;
            }
        });

        this.socket.on('enemyDamaged', (data: { enemyId: string, health: number }) => {
            const enemy = this.enemies.get(data.enemyId);
            if (enemy) {
                enemy.health = data.health;
            }
        });

        this.socket.on('enemyDestroyed', (enemyId: string) => {
            this.enemies.delete(enemyId);
        });

        this.socket.on('obstaclesUpdate', (obstacles: Obstacle[]) => {
            this.obstacles = obstacles;
        });

        this.socket.on('obstacleDamaged', (data: { obstacleId: string, health: number }) => {
            const obstacle = this.obstacles.find(o => o.id === data.obstacleId);
            if (obstacle && obstacle.isEnemy) {
                obstacle.health = data.health;
            }
        });

        this.socket.on('obstacleDestroyed', (obstacleId: string) => {
            const index = this.obstacles.findIndex(o => o.id === obstacleId);
            if (index !== -1) {
                this.obstacles.splice(index, 1);
            }
        });

        this.socket.on('itemsUpdate', (items: Item[]) => {
            this.items = items;
        });

        this.socket.on('itemCollected', (data: { playerId: string, itemId: string }) => {
            this.items = this.items.filter(item => item.id !== data.itemId);
        });

        this.socket.on('inventoryUpdate', (inventory: Item[]) => {
            const socketId = this.socket.id;
            if (socketId) {
                const player = this.players.get(socketId);
                if (player) {
                    player.inventory = inventory;
                }
            }
        });

        this.socket.on('xpGained', (data: { 
            playerId: string; 
            xp: number; 
            totalXp: number; 
            level: number; 
            xpToNextLevel: number;
            maxHealth: number;
            damage: number;
        }) => {
            console.log('XP gained:', data);  // Add logging
            const player = this.players.get(data.playerId);
            if (player) {
                player.xp = data.totalXp;
                player.level = data.level;
                player.xpToNextLevel = data.xpToNextLevel;
                player.maxHealth = data.maxHealth;
                player.damage = data.damage;
                this.showFloatingText(player.x, player.y - 20, '+' + data.xp + ' XP', '#32CD32', 16);
                this.savePlayerProgress(player);
            }
        });

        this.socket.on('levelUp', (data: {
            playerId: string;
            level: number;
            maxHealth: number;
            damage: number;
        }) => {
            console.log('Level up:', data);  // Add logging
            const player = this.players.get(data.playerId);
            if (player) {
                player.level = data.level;
                player.maxHealth = data.maxHealth;
                player.damage = data.damage;
                this.showFloatingText(
                    player.x, 
                    player.y - 30, 
                    'Level Up! Level ' + data.level, 
                    '#FFD700', 
                    24
                );
                this.savePlayerProgress(player);
            }
        });

        this.socket.on('playerLostLevel', (data: {
            playerId: string;
            level: number;
            maxHealth: number;
            damage: number;
            xp: number;
            xpToNextLevel: number;
        }) => {
            console.log('Player lost level:', data);
            const player = this.players.get(data.playerId);
            if (player) {
                player.level = data.level;
                player.maxHealth = data.maxHealth;
                player.damage = data.damage;
                player.xp = data.xp;
                player.xpToNextLevel = data.xpToNextLevel;
                
                // Show level loss message
                this.showFloatingText(
                    player.x, 
                    player.y - 30, 
                    'Level Lost! Level ' + data.level, 
                    '#FF0000', 
                    24
                );
                
                // Save the new progress
                this.savePlayerProgress(player);
            }
        });

        this.socket.on('playerRespawned', (player: Player) => {
            const existingPlayer = this.players.get(player.id);
            if (existingPlayer) {
                Object.assign(existingPlayer, player);
                if (player.id === this.socket.id) {
                    this.isPlayerDead = false;
                    this.hideDeathScreen();
                }
                // Show respawn message
                this.showFloatingText(
                    player.x,
                    player.y - 50,
                    'Respawned!',
                    '#FFFFFF',
                    20
                );
            }
        });

        this.socket.on('playerDied', (playerId: string) => {
            if (playerId === this.socket.id) {
                this.isPlayerDead = true;
                this.showDeathScreen();
            }
        });

        this.socket.on('decorationsUpdate', (decorations: Array<{
            x: number;
            y: number;
            scale: number;
        }>) => {
            this.decorations = decorations;
        });

        this.socket.on('sandsUpdate', (sands: Array<{
            x: number;
            y: number;
            radius: number;
            rotation: number;
        }>) => {
            this.sands = sands;
        });
    }

    private setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'i' || event.key === 'I') {
                this.toggleInventory();
                return;
            }

            // Add control toggle with 'C' key
            if (event.key === 'c' || event.key === 'C') {
                this.useMouseControls = !this.useMouseControls;
                this.showFloatingText(
                    this.canvas.width / 2,
                    50,
                    `Controls: ${this.useMouseControls ? 'Mouse' : 'Keyboard'}`,
                    '#FFFFFF',
                    20
                );
                return;
            }

            if (this.isInventoryOpen) {
                if (event.key >= '1' && event.key <= '5') {
                    const index = parseInt(event.key) - 1;
                    this.useItemFromInventory(index);
                }
                return;
            }

            this.keysPressed.add(event.key);
            this.updatePlayerVelocity();
        });

        document.addEventListener('keyup', (event) => {
            this.keysPressed.delete(event.key);
            this.updatePlayerVelocity();
        });
    }

    private updatePlayerVelocity() {
        const player = this.isSinglePlayer ? 
            this.players.get('player1') : 
            this.players.get(this.socket?.id || '');

        if (player) {
            if (this.useMouseControls) {
                // Mouse controls
                const dx = this.mouseX - player.x;
                const dy = this.mouseY - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 5) {  // Add dead zone to prevent jittering
                    player.velocityX += (dx / distance) * this.PLAYER_ACCELERATION;
                    player.velocityY += (dy / distance) * this.PLAYER_ACCELERATION;
                    player.angle = Math.atan2(dy, dx);
                } else {
                    player.velocityX *= this.FRICTION;
                    player.velocityY *= this.FRICTION;
                }
            } else {
                // Keyboard controls (existing code)
                let dx = 0;
                let dy = 0;

                if (this.keysPressed.has('ArrowUp')) dy -= 1;
                if (this.keysPressed.has('ArrowDown')) dy += 1;
                if (this.keysPressed.has('ArrowLeft')) dx -= 1;
                if (this.keysPressed.has('ArrowRight')) dx += 1;

                if (dx !== 0 || dy !== 0) {
                    player.angle = Math.atan2(dy, dx);

                    if (dx !== 0 && dy !== 0) {
                        const length = Math.sqrt(dx * dx + dy * dy);
                        dx /= length;
                        dy /= length;
                    }

                    player.velocityX += dx * this.PLAYER_ACCELERATION;
                    player.velocityY += dy * this.PLAYER_ACCELERATION;
                } else {
                    player.velocityX *= this.FRICTION;
                    player.velocityY *= this.FRICTION;
                }
            }

            // Limit speed
            const speed = Math.sqrt(player.velocityX ** 2 + player.velocityY ** 2);
            if (speed > this.MAX_SPEED) {
                const ratio = this.MAX_SPEED / speed;
                player.velocityX *= ratio;
                player.velocityY *= ratio;
            }

            // Update position
            const newX = player.x + player.velocityX;
            const newY = player.y + player.velocityY;

            // Check world bounds
            player.x = Math.max(0, Math.min(this.WORLD_WIDTH, newX));
            player.y = Math.max(0, Math.min(this.WORLD_HEIGHT, newY));

            // Send update to server/worker
            if (this.isSinglePlayer) {
                this.worker?.postMessage({
                    type: 'socketEvent',
                    event: 'playerMovement',
                    data: {
                        x: player.x,
                        y: player.y,
                        angle: player.angle,
                        velocityX: player.velocityX,
                        velocityY: player.velocityY
                    }
                });
            } else {
                this.socket.emit('playerMovement', {
                    x: player.x,
                    y: player.y,
                    angle: player.angle,
                    velocityX: player.velocityX,
                    velocityY: player.velocityY
                });
            }
        }
    }

    private updateCamera(player: Player) {
        // Center camera on player
        this.cameraX = player.x - this.canvas.width / 2;
        this.cameraY = player.y - this.canvas.height / 2;

        // Clamp camera to world bounds
        this.cameraX = Math.max(0, Math.min(this.WORLD_WIDTH - this.canvas.width, this.cameraX));
        this.cameraY = Math.max(0, Math.min(this.WORLD_HEIGHT - this.canvas.height, this.cameraY));
    }

    private updatePlayerPosition(player: Player) {
        // Calculate new position
        const newX = player.x + player.velocityX;
        const newY = player.y + player.velocityY;

        // Check collision with obstacles
        let collision = false;
        for (const obstacle of this.obstacles) {
            if (
                newX < obstacle.x + obstacle.width &&
                newX + 40 > obstacle.x && // Assuming player width is 40
                newY < obstacle.y + obstacle.height &&
                newY + 40 > obstacle.y // Assuming player height is 40
            ) {
                collision = true;
                break;
            }
        }

        if (!collision) {
            // Update position if no collision
            player.x = newX;
            player.y = newY;
        } else {
            // Stop movement if collision occurs
            player.velocityX = 0;
            player.velocityY = 0;
        }

        // Update player angle based on velocity
        if (player.velocityX !== 0 || player.velocityY !== 0) {
            player.angle = Math.atan2(player.velocityY, player.velocityX);
        }

        // Apply friction only if no keys are pressed
        if (this.keysPressed.size === 0) {
            player.velocityX *= this.FRICTION;
            player.velocityY *= this.FRICTION;
        }

        // Constrain to world bounds
        player.x = Math.max(0, Math.min(this.WORLD_WIDTH, player.x));
        player.y = Math.max(0, Math.min(this.WORLD_HEIGHT, player.y));

        // Update server
        this.socket.emit('playerMovement', { 
            x: player.x, 
            y: player.y, 
            angle: player.angle, 
            velocityX: player.velocityX, 
            velocityY: player.velocityY 
        });

        this.checkDotCollision(player);
        this.checkEnemyCollision(player);
        this.updateCamera(player);
        this.checkItemCollision(player);
    }

    private generateDots() {
        for (let i = 0; i < this.DOT_COUNT; i++) {
            this.generateDot();
        }
    }

    private generateDot() {
        const dot: Dot = {
            x: Math.random() * this.WORLD_WIDTH,
            y: Math.random() * this.WORLD_HEIGHT
        };
        this.dots.push(dot);
    }

    private checkDotCollision(player: Player) {
        for (let i = this.dots.length - 1; i >= 0; i--) {
            const dot = this.dots[i];
            const dx = player.x - dot.x;
            const dy = player.y - dot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < this.DOT_SIZE + 20) {
                this.socket.emit('collectDot', i);
                player.score++;
                this.dots.splice(i, 1);
                this.generateDot();
            }
        }
    }

    private checkEnemyCollision(player: Player) {
        const currentTime = Date.now();
        if (currentTime - this.lastDamageTime < this.DAMAGE_COOLDOWN) {
            return;
        }

        this.enemies.forEach((enemy, enemyId) => {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 40) { // Assuming both player and enemy are 40x40 pixels
                this.lastDamageTime = currentTime;
                this.socket.emit('collision', { enemyId });
            }
        });
    }

    private checkItemCollision(player: Player) {
        this.items.forEach(item => {
            const dx = player.x - item.x;
            const dy = player.y - item.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 40) { // Assuming player radius is 20
                this.socket.emit('collectItem', item.id);
            }
        });
    }

    private toggleInventory() {
        this.isInventoryOpen = !this.isInventoryOpen;
    }

    private useItemFromInventory(index: number) {
        const socketId = this.socket.id;
        if (socketId) {
            const player = this.players.get(socketId);
            if (player && player.inventory[index]) {
                this.socket.emit('useItem', player.inventory[index].id);
            }
        }
    }

    private renderInventoryMenu() {
        const socketId = this.socket.id;
        if (!socketId) return;

        const player = this.players.get(socketId);
        if (!player) return;

        // Darken the background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw inventory background
        this.ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        this.ctx.fillRect(200, 100, 400, 400);

        // Draw inventory title
        this.ctx.fillStyle = 'black';
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Inventory', 350, 140);

        // Draw inventory slots
        player.inventory.forEach((item, index) => {
            const x = 250 + (index % 3) * 100;
            const y = 200 + Math.floor(index / 3) * 100;

            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(x, y, 80, 80);

            const sprite = this.itemSprites[item.type];
            this.ctx.drawImage(sprite, x + 10, y + 10, 60, 60);

            this.ctx.fillStyle = 'black';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(`${index + 1}`, x + 5, y + 20);
        });

        // Draw instructions
        this.ctx.fillStyle = 'black';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Press 1-5 to use an item', 300, 480);
        this.ctx.fillText('Press I to close inventory', 300, 510);
    }

    private handlePlayerMoved(playerData: Player) {
        // Update player position in single-player mode
        const player = this.players.get(playerData.id);
        if (player) {
            Object.assign(player, playerData);
            // Update camera position for the local player
            if (this.isSinglePlayer) {
                this.updateCamera(player);
            }
        }
    }

    private handleEnemiesUpdate(enemiesData: Enemy[]) {
        // Update enemies in single-player mode
        this.enemies.clear();
        enemiesData.forEach(enemy => this.enemies.set(enemy.id, enemy));
    }

    private gameLoop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw ocean background
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.isInventoryOpen) {
            // Get current player for camera
            const currentSocketId = this.socket?.id;  // Changed variable name
            if (currentSocketId) {
                const currentPlayer = this.players.get(currentSocketId);
                if (currentPlayer) {
                    this.updateCamera(currentPlayer);
                }
            }

            this.ctx.save();
            this.ctx.translate(-this.cameraX, -this.cameraY);

            // Draw world bounds
            this.ctx.strokeStyle = 'black';
            this.ctx.strokeRect(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);

            // Draw zone indicators with updated colors
            const zones = [
                { name: 'Common', end: 2000, color: 'rgba(128, 128, 128, 0.1)' },    // Lighter gray
                { name: 'Uncommon', end: 4000, color: 'rgba(144, 238, 144, 0.1)' },  // Light green (LightGreen)
                { name: 'Rare', end: 6000, color: 'rgba(0, 0, 255, 0.1)' },          // Blue
                { name: 'Epic', end: 8000, color: 'rgba(128, 0, 128, 0.1)' },        // Purple
                { name: 'Legendary', end: 9000, color: 'rgba(255, 165, 0, 0.1)' },   // Orange
                { name: 'Mythic', end: this.WORLD_WIDTH, color: 'rgba(255, 0, 0, 0.1)' }  // Red
            ];

            let start = 0;
            zones.forEach(zone => {
                // Draw zone background
                this.ctx.fillStyle = zone.color;
                this.ctx.fillRect(start, 0, zone.end - start, this.WORLD_HEIGHT);
                
                // Draw zone name
                this.ctx.fillStyle = 'black';
                this.ctx.font = '20px Arial';
                this.ctx.fillText(zone.name, start + 10, 30);
                
                start = zone.end;
            });

            // Draw dots
            this.ctx.fillStyle = 'yellow';
            this.dots.forEach(dot => {
                this.ctx.beginPath();
                this.ctx.arc(dot.x, dot.y, this.DOT_SIZE, 0, Math.PI * 2);
                this.ctx.fill();
            });

            // Draw sand first
            this.sands.forEach(sand => {
                this.ctx.save();
                this.ctx.translate(sand.x, sand.y);
                
                // Draw sand blob with opaque color
                this.ctx.fillStyle = '#FFE4B5';  // Moccasin color, fully opaque
                this.ctx.beginPath();
                
                // Draw static blob shape using the saved rotation
                this.ctx.moveTo(sand.radius * 0.8, 0);
                for (let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 8) {
                    // Use the sand's saved rotation for consistent shape
                    const currentAngle = angle + sand.rotation;
                    const randomRadius = sand.radius * 0.9; // Less variation for more consistent shape
                    const x = Math.cos(currentAngle) * randomRadius;
                    const y = Math.sin(currentAngle) * randomRadius;
                    this.ctx.lineTo(x, y);
                }
                
                this.ctx.closePath();
                this.ctx.fill();
                
                this.ctx.restore();
            });

            // Draw players BEFORE decorations
            this.players.forEach((player, id) => {
                this.ctx.save();
                this.ctx.translate(player.x, player.y);
                this.ctx.rotate(player.angle);
                
                // Draw the sprite
                this.ctx.drawImage(this.playerSprite, -this.playerSprite.width / 2, -this.playerSprite.height / 2);
                
                this.ctx.restore();

                // Draw UI elements above player
                this.ctx.fillStyle = 'black';
                this.ctx.font = '16px Arial';
                this.ctx.fillText(`Score: ${player.score}`, player.x - 30, player.y - 30);

                // Draw health bar
                this.ctx.fillStyle = 'red';
                this.ctx.fillRect(player.x - 25, player.y - 40, 50, 5);
                this.ctx.fillStyle = 'green';
                this.ctx.fillRect(player.x - 25, player.y - 40, 50 * (player.health / player.maxHealth), 5);

                // Draw XP bar and level
                if (player.level < this.MAX_LEVEL) {
                    const xpBarWidth = 50;
                    const xpBarHeight = 3;
                    const xpPercentage = player.xp / player.xpToNextLevel;
                    
                    this.ctx.fillStyle = '#4169E1';
                    this.ctx.fillRect(player.x - 25, player.y - 45, xpBarWidth, xpBarHeight);
                    this.ctx.fillStyle = '#00FFFF';
                    this.ctx.fillRect(player.x - 25, player.y - 45, xpBarWidth * xpPercentage, xpBarHeight);
                }

                // Draw level
                this.ctx.fillStyle = '#FFD700';
                this.ctx.font = '12px Arial';
                this.ctx.fillText('Lv.' + player.level, player.x - 25, player.y - 50);
            });

            // Draw enemies
            this.enemies.forEach(enemy => {
                const sizeMultiplier = this.ENEMY_SIZE_MULTIPLIERS[enemy.tier];
                const enemySize = 40 * sizeMultiplier;  // Base size * multiplier
                
                this.ctx.save();
                this.ctx.translate(enemy.x, enemy.y);
                this.ctx.rotate(enemy.angle);
                
                // Draw enemy with color based on tier
                this.ctx.fillStyle = this.ENEMY_COLORS[enemy.tier];
                this.ctx.beginPath();
                this.ctx.arc(0, 0, enemySize/2, 0, Math.PI * 2);
                this.ctx.fill();

                if (enemy.type === 'octopus') {
                    this.ctx.drawImage(this.octopusSprite, -enemySize/2, -enemySize/2, enemySize, enemySize);
                } else {
                    this.ctx.drawImage(this.fishSprite, -enemySize/2, -enemySize/2, enemySize, enemySize);
                }
                
                this.ctx.restore();

                // Draw health bar and tier indicator - adjust position based on size
                const maxHealth = this.ENEMY_MAX_HEALTH[enemy.tier];
                const healthBarWidth = 50 * sizeMultiplier;
                
                // Health bar
                this.ctx.fillStyle = 'red';
                this.ctx.fillRect(enemy.x - healthBarWidth/2, enemy.y - enemySize/2 - 10, healthBarWidth, 5);
                this.ctx.fillStyle = 'green';
                this.ctx.fillRect(enemy.x - healthBarWidth/2, enemy.y - enemySize/2 - 10, healthBarWidth * (enemy.health / maxHealth), 5);
                
                // Tier text
                this.ctx.fillStyle = 'white';
                this.ctx.font = (12 * sizeMultiplier) + 'px Arial';
                this.ctx.fillText(enemy.tier.toUpperCase(), enemy.x - healthBarWidth/2, enemy.y + enemySize/2 + 15);
            });

            // Draw decorations (palm trees) AFTER players and enemies
            this.decorations.forEach(decoration => {
                this.ctx.save();
                this.ctx.translate(decoration.x, decoration.y);
                this.ctx.scale(decoration.scale, decoration.scale);
                
                // Draw palm tree
                this.ctx.drawImage(
                    this.palmSprite,
                    -this.palmSprite.width / 2,
                    -this.palmSprite.height / 2
                );
                
                this.ctx.restore();
            });

            // Draw obstacles
            this.obstacles.forEach(obstacle => {
                if (obstacle.type === 'coral') {
                    this.ctx.save();
                    this.ctx.translate(obstacle.x, obstacle.y);
                    
                    if (obstacle.isEnemy) {
                        // Draw enemy coral with a reddish tint
                        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                        this.ctx.fillRect(0, 0, obstacle.width, obstacle.height);
                    }
                    
                    this.ctx.drawImage(this.coralSprite, 0, 0, obstacle.width, obstacle.height);
                    
                    if (obstacle.isEnemy && obstacle.health !== undefined) {
                        // Draw health bar for enemy coral
                        this.ctx.fillStyle = 'red';
                        this.ctx.fillRect(0, -10, obstacle.width, 5);
                        this.ctx.fillStyle = 'green';
                        this.ctx.fillRect(0, -10, obstacle.width * (obstacle.health / this.ENEMY_CORAL_MAX_HEALTH), 5);
                    }
                    
                    this.ctx.restore();
                }
            });

            // Draw items
            this.items.forEach(item => {
                const sprite = this.itemSprites[item.type];
                this.ctx.drawImage(sprite, item.x - 15, item.y - 15, 30, 30);
            });

            // Draw player inventory
            const playerSocketId = this.socket.id;  // Changed variable name
            if (playerSocketId) {
                const player = this.players.get(playerSocketId);
                if (player) {
                    player.inventory.forEach((item, index) => {
                        const sprite = this.itemSprites[item.type];
                        this.ctx.drawImage(sprite, 10 + index * 40, 10, 30, 30);
                    });
                }
            }

            this.ctx.restore();

            // Draw minimap (after restoring context)
            this.drawMinimap();
        } else {
            this.renderInventoryMenu();
        }

        // Draw floating texts
        this.floatingTexts = this.floatingTexts.filter(text => {
            text.y -= 1;
            text.alpha -= 1 / text.lifetime;
            
            if (text.alpha <= 0) return false;
            
            this.ctx.globalAlpha = text.alpha;
            this.ctx.fillStyle = text.color;
            this.ctx.font = text.fontSize + 'px Arial';
            this.ctx.fillText(text.text, text.x, text.y);
            this.ctx.globalAlpha = 1;
            
            return true;
        });

        // Don't process player input if dead
        if (!this.isPlayerDead) {
            // Process player movement and input
            this.updatePlayerVelocity();
        }

        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
    }

    private setupItemSprites() {
        const itemTypes = ['health_potion', 'speed_boost', 'shield'];
        itemTypes.forEach(type => {
            const sprite = new Image();
            sprite.src = `./assets/${type}.png`;
            this.itemSprites[type] = sprite;
        });
    }

    private resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Update any viewport-dependent calculations here
        // For example, you might want to adjust the camera bounds
        console.log('Canvas resized to:', this.canvas.width, 'x', this.canvas.height);
    }

    public cleanup() {
        // Save progress before cleanup if in single player mode
        if (this.isSinglePlayer && this.socket?.id) {  // Add null check for socket.id
            const player = this.players.get(this.socket.id);
            if (player) {
                this.savePlayerProgress(player);
            }
        }

        // Stop the game loop
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
        }

        // Terminate the web worker if it exists
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        // Disconnect socket if it exists
        if (this.socket) {
            this.socket.disconnect();
        }

        // Clear all game data
        this.players.clear();
        this.enemies.clear();
        this.dots = [];
        this.obstacles = [];
        this.items = [];

        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Hide game canvas and show title screen
        const titleScreen = document.getElementById('titleScreen');
        const canvas = document.getElementById('gameCanvas');
        const exitButton = document.getElementById('exitButton');
        
        if (titleScreen && canvas && exitButton) {
            titleScreen.style.display = 'flex';
            canvas.style.display = 'none';
            exitButton.style.display = 'none';
        }
    }

    private loadPlayerProgress(): { level: number; xp: number; maxHealth: number; damage: number } {
        const savedProgress = localStorage.getItem('playerProgress');
        if (savedProgress) {
            return JSON.parse(savedProgress);
        }
        return {
            level: 1,
            xp: 0,
            maxHealth: this.PLAYER_MAX_HEALTH,
            damage: this.PLAYER_DAMAGE
        };
    }

    private savePlayerProgress(player: Player) {
        const progress = {
            level: player.level,
            xp: player.xp,
            maxHealth: player.maxHealth,
            damage: player.damage
        };
        localStorage.setItem('playerProgress', JSON.stringify(progress));
    }

    private calculateXPRequirement(level: number): number {
        return Math.floor(this.BASE_XP_REQUIREMENT * Math.pow(this.XP_MULTIPLIER, level - 1));
    }

    // Add the showFloatingText method
    private showFloatingText(x: number, y: number, text: string, color: string, fontSize: number) {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            fontSize,
            alpha: 1,
            lifetime: 60 // frames
        });
    }

    private showDeathScreen() {
        const deathScreen = document.getElementById('deathScreen');
        if (deathScreen) {
            deathScreen.style.display = 'flex';
        }
    }

    private hideDeathScreen() {
        const deathScreen = document.getElementById('deathScreen');
        if (deathScreen) {
            deathScreen.style.display = 'none';
        }
    }

    // Add minimap drawing
    private drawMinimap() {
        const minimapX = this.canvas.width - this.MINIMAP_WIDTH - this.MINIMAP_PADDING;
        const minimapY = this.MINIMAP_PADDING;

        // Draw minimap background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(minimapX, minimapY, this.MINIMAP_WIDTH, this.MINIMAP_HEIGHT);

        // Draw zones on minimap with matching colors
        const zones = [
            { color: 'rgba(128, 128, 128, 0.5)' },    // Gray
            { color: 'rgba(144, 238, 144, 0.5)' },    // Light green
            { color: 'rgba(0, 0, 255, 0.5)' },        // Blue
            { color: 'rgba(128, 0, 128, 0.5)' },      // Purple
            { color: 'rgba(255, 165, 0, 0.5)' },      // Orange
            { color: 'rgba(255, 0, 0, 0.5)' }         // Red
        ];

        zones.forEach((zone, index) => {
            const zoneWidth = (this.MINIMAP_WIDTH / 6);
            this.ctx.fillStyle = zone.color;
            this.ctx.fillRect(
                minimapX + index * zoneWidth,
                minimapY,
                zoneWidth,
                this.MINIMAP_HEIGHT
            );
        });

        // Draw player position on minimap
        const minimapSocketId = this.socket?.id;  // Changed variable name
        if (minimapSocketId) {
            const player = this.players.get(minimapSocketId);
            if (player) {
                const playerMinimapX = minimapX + (player.x / this.WORLD_WIDTH) * this.MINIMAP_WIDTH;
                const playerMinimapY = minimapY + (player.y / this.WORLD_HEIGHT) * this.MINIMAP_HEIGHT;
                
                this.ctx.fillStyle = 'yellow';
                this.ctx.beginPath();
                this.ctx.arc(playerMinimapX, playerMinimapY, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }
}
