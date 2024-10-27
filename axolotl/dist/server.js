"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const https_1 = require("https");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
// Add CORS middleware with specific origin
app.use((req, res, next) => {
    const origin = req.headers.origin || 'https://localhost:8080';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
// Serve static files from the dist directory
app.use(express_1.default.static(path_1.default.join(__dirname, '../dist')));
const httpsServer = (0, https_1.createServer)({
    key: fs_1.default.readFileSync('cert.key'),
    cert: fs_1.default.readFileSync('cert.crt')
}, app);
const io = new socket_io_1.Server(httpsServer, {
    cors: {
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin)
                return callback(null, true);
            // Use the origin of the request
            callback(null, origin);
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});
const PORT = process.env.PORT || 3000;
const players = {};
const dots = [];
const enemies = [];
const obstacles = [];
const items = [];
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const ENEMY_COUNT = 10;
const OBSTACLE_COUNT = 20;
const ENEMY_CORAL_PROBABILITY = 0.3;
const ENEMY_CORAL_HEALTH = 50;
const ENEMY_CORAL_DAMAGE = 5;
const PLAYER_MAX_HEALTH = 100;
const ENEMY_MAX_HEALTH = 50;
const PLAYER_DAMAGE = 10;
const ENEMY_DAMAGE = 5;
const ENEMY_TIERS = {
    common: { health: 20, speed: 0.5, damage: 5, probability: 0.4, color: '#808080' },
    uncommon: { health: 40, speed: 0.75, damage: 10, probability: 0.3, color: '#008000' },
    rare: { health: 60, speed: 1, damage: 15, probability: 0.15, color: '#0000FF' },
    epic: { health: 80, speed: 1.25, damage: 20, probability: 0.1, color: '#800080' },
    legendary: { health: 100, speed: 1.5, damage: 25, probability: 0.04, color: '#FFA500' },
    mythic: { health: 150, speed: 2, damage: 30, probability: 0.01, color: '#FF0000' }
};
const ITEM_COUNT = 10;
const MAX_INVENTORY_SIZE = 5;
const RESPAWN_INVULNERABILITY_TIME = 3000; // 3 seconds of invulnerability after respawn
// Add knockback constants at the top with other constants
const KNOCKBACK_FORCE = 100; // Increased from 20 to 100
const KNOCKBACK_RECOVERY_SPEED = 0.9; // How quickly the knockback effect diminishes
function createEnemy() {
    const tierRoll = Math.random();
    let tier = 'common'; // Initialize with a default value
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
        tier: tier,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        angle: Math.random() * Math.PI * 2,
        health: tierData.health,
        speed: tierData.speed,
        damage: tierData.damage,
        knockbackX: 0,
        knockbackY: 0
    };
}
function moveEnemies() {
    enemies.forEach(enemy => {
        // Apply knockback recovery
        if (enemy.knockbackX) {
            enemy.knockbackX *= KNOCKBACK_RECOVERY_SPEED;
            enemy.x += enemy.knockbackX;
            if (Math.abs(enemy.knockbackX) < 0.1)
                enemy.knockbackX = 0;
        }
        if (enemy.knockbackY) {
            enemy.knockbackY *= KNOCKBACK_RECOVERY_SPEED;
            enemy.y += enemy.knockbackY;
            if (Math.abs(enemy.knockbackY) < 0.1)
                enemy.knockbackY = 0;
        }
        // Regular movement
        if (enemy.type === 'octopus') {
            enemy.x += (Math.random() * 4 - 2) * enemy.speed;
            enemy.y += (Math.random() * 4 - 2) * enemy.speed;
        }
        else {
            enemy.x += Math.cos(enemy.angle) * 2 * enemy.speed;
            enemy.y += Math.sin(enemy.angle) * 2 * enemy.speed;
        }
        // Wrap around the world
        enemy.x = (enemy.x + WORLD_WIDTH) % WORLD_WIDTH;
        enemy.y = (enemy.y + WORLD_HEIGHT) % WORLD_HEIGHT;
        if (enemy.type === 'fish' && Math.random() < 0.02) {
            enemy.angle = Math.random() * Math.PI * 2;
        }
    });
}
function createObstacle() {
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
function createItem() {
    return {
        id: Math.random().toString(36).substr(2, 9),
        type: ['health_potion', 'speed_boost', 'shield'][Math.floor(Math.random() * 3)],
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
// Initialize items
for (let i = 0; i < ITEM_COUNT; i++) {
    items.push(createItem());
}
function respawnPlayer(player) {
    player.health = PLAYER_MAX_HEALTH;
    player.x = Math.random() * WORLD_WIDTH;
    player.y = Math.random() * WORLD_HEIGHT;
    player.score = Math.max(0, player.score - 10); // Penalty for dying
    player.inventory = []; // Clear inventory on death
    player.isInvulnerable = true;
    // Remove invulnerability after the specified time
    setTimeout(() => {
        player.isInvulnerable = false;
    }, RESPAWN_INVULNERABILITY_TIME);
}
io.on('connection', (socket) => {
    console.log('A user connected');
    // Initialize new player
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        angle: 0,
        score: 0,
        velocityX: 0,
        velocityY: 0,
        health: PLAYER_MAX_HEALTH,
        inventory: [],
        isInvulnerable: true
    };
    // Remove initial invulnerability after the specified time
    setTimeout(() => {
        if (players[socket.id]) {
            players[socket.id].isInvulnerable = false;
        }
    }, RESPAWN_INVULNERABILITY_TIME);
    // Send current players to the new player
    socket.emit('currentPlayers', players);
    // Notify all other players about the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);
    // Send initial enemies state
    socket.emit('enemiesUpdate', enemies);
    // Send initial obstacles state
    socket.emit('obstaclesUpdate', obstacles);
    // Send current items to the new player
    socket.emit('itemsUpdate', items);
    socket.on('playerMovement', (movementData) => {
        const player = players[socket.id];
        if (player) {
            let newX = Math.max(0, Math.min(WORLD_WIDTH, movementData.x));
            let newY = Math.max(0, Math.min(WORLD_HEIGHT, movementData.y));
            // Apply knockback to player position if it exists
            if (player.knockbackX) {
                player.knockbackX *= KNOCKBACK_RECOVERY_SPEED;
                newX += player.knockbackX;
                if (Math.abs(player.knockbackX) < 0.1)
                    player.knockbackX = 0;
            }
            if (player.knockbackY) {
                player.knockbackY *= KNOCKBACK_RECOVERY_SPEED;
                newY += player.knockbackY;
                if (Math.abs(player.knockbackY) < 0.1)
                    player.knockbackY = 0;
            }
            // Check collision with obstacles and enemies
            let collision = false;
            // Check obstacles
            for (const obstacle of obstacles) {
                if (newX < obstacle.x + obstacle.width &&
                    newX + 40 > obstacle.x &&
                    newY < obstacle.y + obstacle.height &&
                    newY + 40 > obstacle.y) {
                    collision = true;
                    if (obstacle.isEnemy && !player.isInvulnerable) {
                        player.health -= ENEMY_CORAL_DAMAGE;
                        io.emit('playerDamaged', { playerId: player.id, health: player.health });
                        if (player.health <= 0) {
                            respawnPlayer(player);
                            io.emit('playerDied', player.id);
                            io.emit('playerRespawned', player);
                        }
                    }
                    break;
                }
            }
            // Check enemies
            for (const enemy of enemies) {
                if (newX < enemy.x + 40 &&
                    newX + 40 > enemy.x &&
                    newY < enemy.y + 40 &&
                    newY + 40 > enemy.y) {
                    collision = true;
                    if (!player.isInvulnerable) {
                        // Enemy damages player
                        player.health -= enemy.damage;
                        io.emit('playerDamaged', { playerId: player.id, health: player.health });
                        // Player damages enemy
                        enemy.health -= PLAYER_DAMAGE;
                        io.emit('enemyDamaged', { enemyId: enemy.id, health: enemy.health });
                        // Calculate knockback direction
                        const dx = enemy.x - newX;
                        const dy = enemy.y - newY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const normalizedDx = dx / distance;
                        const normalizedDy = dy / distance;
                        // Apply stronger knockback to player's position immediately
                        newX -= normalizedDx * KNOCKBACK_FORCE;
                        newY -= normalizedDy * KNOCKBACK_FORCE;
                        // Store stronger knockback for gradual recovery
                        player.knockbackX = -normalizedDx * KNOCKBACK_FORCE;
                        player.knockbackY = -normalizedDy * KNOCKBACK_FORCE;
                        // Check if enemy dies
                        if (enemy.health <= 0) {
                            const index = enemies.findIndex(e => e.id === enemy.id);
                            if (index !== -1) {
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
                        }
                    }
                    break;
                }
            }
            if (!collision) {
                player.x = newX;
                player.y = newY;
                player.angle = movementData.angle;
                player.velocityX = movementData.velocityX;
                player.velocityY = movementData.velocityY;
                socket.broadcast.emit('playerMoved', player);
            }
        }
    });
    socket.on('collectDot', (dotIndex) => {
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
    socket.on('collectItem', (itemId) => {
        const player = players[socket.id];
        const itemIndex = items.findIndex(item => item.id === itemId);
        if (itemIndex !== -1 && player.inventory.length < MAX_INVENTORY_SIZE) {
            const item = items[itemIndex];
            player.inventory.push(item);
            items.splice(itemIndex, 1);
            socket.emit('inventoryUpdate', player.inventory);
            io.emit('itemCollected', { playerId: socket.id, itemId });
            items.push(createItem()); // Replace the collected item
            io.emit('itemsUpdate', items);
        }
    });
    socket.on('useItem', (itemId) => {
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
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
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
