import express from 'express';
import { createServer } from 'https';
import { Server, Socket } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { database } from './database';

const app = express();

// Add body parser middleware for JSON
app.use(express.json());

// Add CORS middleware with specific origin
app.use((req, res, next) => {
    const origin = req.headers.origin || 'https://localhost:8080';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Authentication endpoints
app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = database.createUser(username, password);
    if (user) {
        res.status(201).json({ message: 'User created successfully' });
    } else {
        res.status(400).json({ message: 'Username already exists' });
    }
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = database.getUser(username, password);
    if (user) {
        // You might want to set up a session here
        res.json({ message: 'Login successful', userId: user.id });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

app.post('/auth/verify', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = database.getUser(username, password);
    if (user) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
});

app.post('/auth/logout', (req, res) => {
    // Handle any cleanup needed
    res.json({ message: 'Logged out successfully' });
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));

const httpsServer = createServer({
    key: fs.readFileSync('cert.key'),
    cert: fs.readFileSync('cert.crt')
}, app);

const io = new Server(httpsServer, {
    cors: {
        origin: function(origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            
            // Use the origin of the request
            callback(null, origin);
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 443;

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  score: number;
  velocityX: number;
  velocityY: number;
  health: number;
  maxHealth: number;
  damage: number;
  inventory: Item[];
  isInvulnerable?: boolean;
  knockbackX?: number;
  knockbackY?: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  lastDamageTime?: number;
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
  knockbackX?: number;
  knockbackY?: number;
  isHostile?: boolean;
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

const players: Record<string, Player> = {};
const dots: Dot[] = [];
const enemies: Enemy[] = [];
const obstacles: Obstacle[] = [];
const items: Item[] = [];

const WORLD_WIDTH = 10000;
const WORLD_HEIGHT = 2000;
const ENEMY_COUNT = 200;
const OBSTACLE_COUNT = 20;
const ENEMY_CORAL_PROBABILITY = 0.3;
const ENEMY_CORAL_HEALTH = 50;
const ENEMY_CORAL_DAMAGE = 5;

const PLAYER_MAX_HEALTH = 100;
const ENEMY_MAX_HEALTH = 50;
const PLAYER_DAMAGE = 5;
const ENEMY_DAMAGE = 20;

const ENEMY_TIERS = {
  common: { health: 5, speed: 0.5, damage: 5, probability: 0.4, color: '#808080' },
  uncommon: { health: 40, speed: 0.75, damage: 10, probability: 0.3, color: '#008000' },
  rare: { health: 60, speed: 1, damage: 15, probability: 0.15, color: '#0000FF' },
  epic: { health: 80, speed: 1.25, damage: 20, probability: 0.1, color: '#800080' },
  legendary: { health: 100, speed: 1.5, damage: 25, probability: 0.04, color: '#FFA500' },
  mythic: { health: 150, speed: 2, damage: 30, probability: 0.01, color: '#FF0000' }
};

const MAX_INVENTORY_SIZE = 5;

const RESPAWN_INVULNERABILITY_TIME = 3000; // 3 seconds of invulnerability after respawn

// Add knockback constants at the top with other constants
const KNOCKBACK_FORCE = 20; // Increased from 20 to 100
const KNOCKBACK_RECOVERY_SPEED = 0.9; // How quickly the knockback effect diminishes

// Add XP-related constants
const BASE_XP_REQUIREMENT = 100;
const XP_MULTIPLIER = 1.5;
const HEALTH_PER_LEVEL = 10;
const DAMAGE_PER_LEVEL = 2;
const PLAYER_SIZE = 40;
const ENEMY_SIZE = 40;

// Define zone boundaries for different tiers
const ZONE_BOUNDARIES = {
    common: { start: 0, end: 2000 },
    uncommon: { start: 2000, end: 4000 },
    rare: { start: 4000, end: 6000 },
    epic: { start: 6000, end: 8000 },
    legendary: { start: 8000, end: 9000 },
    mythic: { start: 9000, end: WORLD_WIDTH }
};

// Add enemy size multipliers like in singleplayer
const ENEMY_SIZE_MULTIPLIERS = {
    common: 1.0,
    uncommon: 1.2,
    rare: 1.4,
    epic: 1.6,
    legendary: 1.8,
    mythic: 2.0
};

// Add drop chances like in singleplayer
const DROP_CHANCES = {
    common: 1,      // 10% chance
    uncommon: 0.2,    // 20% chance
    rare: 0.3,        // 30% chance
    epic: 0.4,        // 40% chance
    legendary: 0.5,   // 50% chance
    mythic: 0.75      // 75% chance
};

// Update createEnemy to ensure enemies spawn in their correct zones
function createEnemy(): Enemy {
    // First, decide the x position
    const x = Math.random() * WORLD_WIDTH;
    
    // Determine tier based on x position
    let tier: Enemy['tier'] = 'common';
    for (const [t, zone] of Object.entries(ZONE_BOUNDARIES)) {
        if (x >= zone.start && x < zone.end) {
            tier = t as Enemy['tier'];
            break;
        }
    }

    const tierData = ENEMY_TIERS[tier];

    return {
        id: Math.random().toString(36).substr(2, 9),
        type: Math.random() < 0.5 ? 'octopus' : 'fish',
        tier,
        x: x,  // Use the determined x position
        y: Math.random() * WORLD_HEIGHT,
        angle: Math.random() * Math.PI * 2,
        health: tierData.health,
        speed: tierData.speed,
        damage: tierData.damage,
        knockbackX: 0,
        knockbackY: 0
    };
}

// Add these constants at the top with the others
const FISH_DETECTION_RADIUS = 500;  // How far fish can detect players
const PLAYER_BASE_SPEED = 5;  // Base player speed to match
const FISH_RETURN_SPEED = 0.5;  // Speed at which fish return to their normal behavior

// Update the moveEnemies function
function moveEnemies() {
    enemies.forEach(enemy => {
        // Apply knockback if it exists
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

        // Find nearest player for fish behavior
        let nearestPlayer: Player | undefined;
        let nearestDistance = Infinity;
        
        const playerArray: Player[] = Object.values(players);
        playerArray.forEach(player => {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            nearestDistance = distance;
            nearestPlayer = player;
        });

        // Different movement patterns based on enemy type
        if (enemy.type === 'octopus') {
            // Random movement for octopus
            enemy.x += (Math.random() * 4 - 2) * (enemy.speed || 1);
            enemy.y += (Math.random() * 4 - 2) * (enemy.speed || 1);
        } else {
            // Fish behavior
            if (nearestPlayer) {
                if (nearestDistance < FISH_DETECTION_RADIUS) {
                    // Fish detected player - match player speed
                    const dx = nearestPlayer.x - enemy.x;
                    const dy = nearestPlayer.y - enemy.y;
                    const angle = Math.atan2(dy, dx);
                    
                    // Update enemy angle for proper facing direction
                    enemy.angle = angle;
                    
                    // Calculate chase speed based on player's current speed
                    const playerSpeed = 16;
                    
                    // Match player speed but consider enemy tier for slight variations
                    const tierSpeedMultiplier = ENEMY_TIERS[enemy.tier].speed;
                    const chaseSpeed = playerSpeed * tierSpeedMultiplier;
                    
                    // Move towards player matching their speed
                    enemy.x += Math.cos(angle) * chaseSpeed;
                    enemy.y += Math.sin(angle) * chaseSpeed;
                    
                    // Mark fish as hostile
                    enemy.isHostile = true;
                } else {
                    // Normal fish behavior
                    enemy.isHostile = false;
                    // Return to normal speed gradually
                    const normalSpeed = ENEMY_TIERS[enemy.tier].speed * 2;
                    enemy.x += Math.cos(enemy.angle || 0) * normalSpeed;
                  enemy.y += Math.sin(enemy.angle || 0) * normalSpeed;
                  
                  // Randomly change direction occasionally
                  if (Math.random() < 0.02) {
                      enemy.angle = Math.random() * Math.PI * 2;
                  }
                }
            }
        }

        // Keep enemies in their respective zones
        const zone = ZONE_BOUNDARIES[enemy.tier];
        if (enemy.x < zone.start || enemy.x >= zone.end) {
            // Reverse direction if exiting zone
            if (enemy.type === 'fish') {
                enemy.angle = Math.PI - enemy.angle; // Reverse direction
            }
            enemy.x = Math.max(zone.start, Math.min(zone.end - 1, enemy.x));
        }

        // Wrap around only for Y axis
        enemy.y = (enemy.y + WORLD_HEIGHT) % WORLD_HEIGHT;
    });

    io.emit('enemiesUpdate', enemies);
}

function createObstacle(): Obstacle {
  const isEnemy = Math.random() < ENEMY_CORAL_PROBABILITY;
  return {
    id: Math.random().toString(36).substr(2, 9),
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    width: 50 + Math.random() * 50, // Random width between 50 and 100
    height: 50 + Math.random() * 50, // Random height between 50 and 100
    type: 'coral',
    isEnemy: isEnemy,
    health: isEnemy ? ENEMY_CORAL_HEALTH : undefined
  };
}

function createItem(): Item {
  return {
    id: Math.random().toString(36).substr(2, 9),
    type: ['health_potion', 'speed_boost', 'shield'][Math.floor(Math.random() * 3)] as 'health_potion' | 'speed_boost' | 'shield',
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT
  };
}

// Initialize enemies
for (let i = 0; i < ENEMY_COUNT; i++) {
  enemies.push(createEnemy());
}

// Initialize obstacles
for (let i = 0; i < OBSTACLE_COUNT; i++) {
  obstacles.push(createObstacle());
}

function respawnPlayer(player: Player) {
    // Determine spawn zone based on player level
    let spawnX;
    if (player.level <= 5) {
        spawnX = Math.random() * ZONE_BOUNDARIES.common.end;
    } else if (player.level <= 10) {
        spawnX = ZONE_BOUNDARIES.uncommon.start + Math.random() * (ZONE_BOUNDARIES.uncommon.end - ZONE_BOUNDARIES.uncommon.start);
    } else if (player.level <= 15) {
        spawnX = ZONE_BOUNDARIES.rare.start + Math.random() * (ZONE_BOUNDARIES.rare.end - ZONE_BOUNDARIES.rare.start);
    } else if (player.level <= 25) {
        spawnX = ZONE_BOUNDARIES.epic.start + Math.random() * (ZONE_BOUNDARIES.epic.end - ZONE_BOUNDARIES.epic.start);
    } else if (player.level <= 40) {
        spawnX = ZONE_BOUNDARIES.legendary.start + Math.random() * (ZONE_BOUNDARIES.legendary.end - ZONE_BOUNDARIES.legendary.start);
    } else {
        spawnX = ZONE_BOUNDARIES.mythic.start + Math.random() * (ZONE_BOUNDARIES.mythic.end - ZONE_BOUNDARIES.mythic.start);
    }

    player.health = player.maxHealth;
    player.x = spawnX;
    player.y = Math.random() * WORLD_HEIGHT;
    player.score = Math.max(0, player.score - 10);
    player.inventory = [];
    player.isInvulnerable = true;
    player.lastDamageTime = 0;  // Reset damage timer on respawn

    setTimeout(() => {
        player.isInvulnerable = false;
    }, RESPAWN_INVULNERABILITY_TIME);
}

interface AuthenticatedSocket extends Socket {
    userId?: string;
    username?: string;
}

io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('A user connected');

    // Handle authentication
    socket.on('authenticate', async (credentials: { username: string, password: string, playerName: string }) => {
        const user = database.getUser(credentials.username, credentials.password);
        
        if (user) {
            // Store user info in socket
            socket.userId = user.id;
            socket.username = user.username;
            
            // Load saved progress for the player
            const savedProgress = database.getPlayerByUserId(user.id);

            // Initialize new player with saved or default values
            players[socket.id] = {
                id: socket.id,
                name: credentials.playerName || 'Anonymous',
                x: 200,
                y: WORLD_HEIGHT / 2,
                angle: 0,
                score: 0,
                velocityX: 0,
                velocityY: 0,
                health: savedProgress?.maxHealth || PLAYER_MAX_HEALTH,
                maxHealth: savedProgress?.maxHealth || PLAYER_MAX_HEALTH,
                damage: savedProgress?.damage || PLAYER_DAMAGE,
                inventory: savedProgress?.inventory || [],
                isInvulnerable: true,
                level: savedProgress?.level || 1,
                xp: savedProgress?.xp || 0,
                xpToNextLevel: calculateXPRequirement(savedProgress?.level || 1)
            };

            // Save initial state
            savePlayerProgress(players[socket.id], user.id);

            // Remove initial invulnerability after the specified time
            setTimeout(() => {
                if (players[socket.id]) {
                    players[socket.id].isInvulnerable = false;
                }
            }, RESPAWN_INVULNERABILITY_TIME);

            // Send success response and game state
            socket.emit('authenticated', {
                success: true,
                player: players[socket.id]
            });

            // Send current game state
            socket.emit('currentPlayers', players);
            socket.emit('enemiesUpdate', enemies);
            socket.emit('obstaclesUpdate', obstacles);
            socket.emit('itemsUpdate', items);

            // Notify other players
            socket.broadcast.emit('newPlayer', players[socket.id]);
        } else {
            socket.emit('authenticated', {
                success: false,
                error: 'Invalid credentials'
            });
        }
    });

    // Update disconnect handler
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        if (players[socket.id] && socket.userId) {
            // Save progress with user ID
            savePlayerProgress(players[socket.id], socket.userId);
        }
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });

    socket.on('playerMovement', (movementData) => {
        const player = players[socket.id];
        if (player) {
            let newX = movementData.x;
            let newY = movementData.y;

            // Apply knockback to player position if it exists
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

            // Check for item collisions
            const ITEM_PICKUP_RADIUS = 40;  // Radius for item pickup
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                const dx = newX - item.x;
                const dy = newY - item.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ITEM_PICKUP_RADIUS) {
                    // Add item to player's inventory without size limit
                    player.inventory.push(item);
                    
                    // Remove item from world
                    items.splice(i, 1);
                    
                    // Notify clients
                    socket.emit('inventoryUpdate', player.inventory);
                    io.emit('itemCollected', { 
                        playerId: socket.id, 
                        itemId: item.id 
                    });
                    io.emit('itemsUpdate', items);
                }
            }

            let collision = false;

            // Check collision with enemies first
            for (const enemy of enemies) {
                const enemySize = ENEMY_SIZE * ENEMY_SIZE_MULTIPLIERS[enemy.tier];
                
                if (
                    newX < enemy.x + enemySize &&
                    newX + PLAYER_SIZE > enemy.x &&
                    newY < enemy.y + enemySize &&
                    newY + PLAYER_SIZE > enemy.y
                ) {
                    collision = true;
                    if (!player.isInvulnerable) {
                        // Enemy damages player
                        player.health -= enemy.damage;
                        player.lastDamageTime = Date.now();  // Add this line
                        io.emit('playerDamaged', { playerId: player.id, health: player.health });

                        // Player damages enemy
                        enemy.health -= player.damage;
                        io.emit('enemyDamaged', { enemyId: enemy.id, health: enemy.health });

                        // Calculate knockback direction
                        const dx = enemy.x - newX;
                        const dy = enemy.y - newY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const normalizedDx = dx / distance;
                        const normalizedDy = dy / distance;

                        // Apply knockback to player's position immediately
                        newX -= normalizedDx * KNOCKBACK_FORCE;
                        newY -= normalizedDy * KNOCKBACK_FORCE;
                        
                        // Store knockback for gradual recovery
                        player.knockbackX = -normalizedDx * KNOCKBACK_FORCE;
                        player.knockbackY = -normalizedDy * KNOCKBACK_FORCE;

                        // Check if enemy dies
                        if (enemy.health <= 0) {
                            const index = enemies.findIndex(e => e.id === enemy.id);
                            if (index !== -1) {
                                // Award XP before removing the enemy
                                const xpGained = getXPFromEnemy(enemy);
                                addXPToPlayer(player, xpGained);
                                
                                // Check for item drop
                                const dropChance = DROP_CHANCES[enemy.tier];
                                if (Math.random() < dropChance) {
                                    const newItem = {
                                        id: Math.random().toString(36).substr(2, 9),
                                        type: ['health_potion', 'speed_boost', 'shield'][Math.floor(Math.random() * 3)] as Item['type'],
                                        x: enemy.x,
                                        y: enemy.y
                                    };
                                    // Add item to the world instead of player's inventory
                                    items.push(newItem);
                                    // Notify all clients about the new item
                                    io.emit('itemsUpdate', items);
                                }

                                enemies.splice(index, 1);
                                io.emit('enemyDestroyed', enemy.id);
                                enemies.push(createEnemy());
                            }
                        }

                        // Check if player dies
                        if (player.health <= 0) {
                            respawnPlayer(player);
                            io.emit('playerDied', player.id);
                            io.emit('playerRespawned', player);
                            return;
                        }
                    }
                    break;
                }
            }

            // Update player position even if there was a collision (to apply knockback)
            player.x = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX));
            player.y = Math.max(0, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY));
            player.angle = movementData.angle;
            player.velocityX = movementData.velocityX;
            player.velocityY = movementData.velocityY;

            // Always emit the updated position
            io.emit('playerMoved', player);
        }
    });

    socket.on('collectDot', (dotIndex: number) => {
        if (dotIndex >= 0 && dotIndex < dots.length) {
            dots.splice(dotIndex, 1);
            players[socket.id].score++;
            io.emit('dotCollected', { playerId: socket.id, dotIndex });
            // Generate a new dot
            dots.push({
                x: Math.random() * 800,
                y: Math.random() * 600
            });
        }
    });

    socket.on('useItem', (itemId: string) => {
        const player = players[socket.id];
        const itemIndex = player.inventory.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            const item = player.inventory[itemIndex];
            player.inventory.splice(itemIndex, 1);
            switch (item.type) {
                case 'health_potion':
                    player.health = Math.min(player.health + 50, PLAYER_MAX_HEALTH);
                    break;
                case 'speed_boost':
                    // Implement speed boost logic
                    break;
                case 'shield':
                    // Implement shield logic
                    break;
            }
            socket.emit('inventoryUpdate', player.inventory);
            io.emit('playerUpdated', player);
        }
    });

    // Add save handler for when players gain XP or level up


    // Update the addXPToPlayer function to save progress
    function addXPToPlayer(player: Player, xp: number): void {
        player.xp += xp;
        while (player.xp >= player.xpToNextLevel) {
            player.xp -= player.xpToNextLevel;
            player.level++;
            player.xpToNextLevel = calculateXPRequirement(player.level);
            handleLevelUp(player);
        }

        // Save progress after XP gain using the socket's userId
        if (socket.userId) {
            savePlayerProgress(player, socket.userId);
        }

        io.emit('xpGained', {
            playerId: player.id,
            xp: xp,
            totalXp: player.xp,
            level: player.level,
            xpToNextLevel: player.xpToNextLevel,
            maxHealth: player.maxHealth,
            damage: player.damage
        });
    }

    // Add a name update handler
    socket.on('updateName', (newName: string) => {
        const player = players[socket.id];
        if (player) {
            player.name = newName;
            io.emit('playerUpdated', player);
        }
    });
});

// Move enemies every 100ms
setInterval(() => {
    moveEnemies();
    io.emit('enemiesUpdate', enemies);
}, 100);

httpsServer.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});

// Add XP calculation functions
function calculateXPRequirement(level: number): number {
    return Math.floor(BASE_XP_REQUIREMENT * Math.pow(XP_MULTIPLIER, level - 1));
}

function getXPFromEnemy(enemy: Enemy): number {
    const tierMultipliers: Record<Enemy['tier'], number> = {
        common: 10,
        uncommon: 20,
        rare: 40,
        epic: 80,
        legendary: 160,
        mythic: 320
    };
    return tierMultipliers[enemy.tier];
}

// Optional: Clean up old player data periodically
setInterval(() => {
    database.cleanupOldPlayers(30); // Clean up players not seen in 30 days
}, 24 * 60 * 60 * 1000); // Run once per day

// Add this function near the other helper functions
function handleLevelUp(player: Player): void {
    player.maxHealth += HEALTH_PER_LEVEL;
    player.health = player.maxHealth;  // Heal to full when leveling up
    player.damage += DAMAGE_PER_LEVEL;

    io.emit('levelUp', {
        playerId: player.id,
        level: player.level,
        maxHealth: player.maxHealth,
        damage: player.damage
    });
}

// Add these constants at the top with other constants
const HEALTH_REGEN_RATE = 5;  // Health points recovered per tick
const HEALTH_REGEN_INTERVAL = 1000;  // Milliseconds between health regeneration ticks
const HEALTH_REGEN_COMBAT_DELAY = 0;  // Delay before health starts regenerating after taking damage

// Add health regeneration interval
setInterval(() => {
    Object.values(players).forEach(player => {
        // Check if enough time has passed since last damage
        const now = Date.now();
        if (player.lastDamageTime && now - player.lastDamageTime < HEALTH_REGEN_COMBAT_DELAY) {
            return;  // Skip regeneration if player was recently damaged
        }

        // Regenerate health if not at max
        if (player.health < player.maxHealth) {
            player.health = Math.min(player.maxHealth, player.health + HEALTH_REGEN_RATE);
            io.emit('playerUpdated', player);
        }
    });
}, HEALTH_REGEN_INTERVAL);

// Move savePlayerProgress outside the socket connection handler
function savePlayerProgress(player: Player, userId: string) {
    if (userId) {
        // Save complete player state including inventory
        database.savePlayer(player.id, userId, {
            level: player.level,
            xp: player.xp,
            maxHealth: player.maxHealth,
            damage: player.damage,
            inventory: player.inventory  // Add inventory to saved data
        });

        console.log('Saved player progress:', {
            userId,
            level: player.level,
            xp: player.xp,
            maxHealth: player.maxHealth,
            damage: player.damage,
            inventory: player.inventory
        });
    }
}

// Add periodic saving
const SAVE_INTERVAL = 60000; // Save every minute
setInterval(() => {
    Object.entries(players).forEach(([socketId, player]) => {
        const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
        if (socket && socket.userId) {
            savePlayerProgress(player, socket.userId);
        }
    });
}, SAVE_INTERVAL);
