// Just assign the worker code to a constant
const workerCode = `
// Worker code starts here
const WORLD_WIDTH = 10000;
const WORLD_HEIGHT = 2000;
const ENEMY_COUNT = 50;
const ZONE_BOUNDARIES = {
    common: { start: 0, end: 2000 },
    uncommon: { start: 2000, end: 4000 },
    rare: { start: 4000, end: 6000 },
    epic: { start: 6000, end: 8000 },
    legendary: { start: 8000, end: 9000 },
    mythic: { start: 9000, end: WORLD_WIDTH }
};

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

// Add XP-related constants
const BASE_XP_REQUIREMENT = 100;
const XP_MULTIPLIER = 1.5;
const MAX_LEVEL = 50;
const HEALTH_PER_LEVEL = 10;
const DAMAGE_PER_LEVEL = 2;

// Add enemy size multipliers
const ENEMY_SIZE_MULTIPLIERS = {
    common: 1.0,
    uncommon: 1.2,
    rare: 1.4,
    epic: 1.6,
    legendary: 1.8,
    mythic: 2.0
};

// Add decorations array and constants
const DECORATION_COUNT = 100;
const decorations = [];

// Add sand array and constants
const SAND_COUNT = 50;
const MIN_SAND_RADIUS = 50;
const MAX_SAND_RADIUS = 120;
const sands = [];

// Add drop chances
const DROP_CHANCES = {
    common: 0.1,
    uncommon: 0.2,
    rare: 0.3,
    epic: 0.4,
    legendary: 0.5,
    mythic: 0.75
};

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

function createEnemy() {
    const x = Math.random() * WORLD_WIDTH;
    let tier = 'common';
    for (const [t, zone] of Object.entries(ZONE_BOUNDARIES)) {
        if (x >= zone.start && x < zone.end) {
            tier = t;
            break;
        }
    }
    const tierData = ENEMY_TIERS[tier];
    return {
        id: Math.random().toString(36).substr(2, 9),
        type: Math.random() < 0.5 ? 'octopus' : 'fish',
        tier,
        x,
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

        const zone = ZONE_BOUNDARIES[enemy.tier];
        if (enemy.x < zone.start || enemy.x >= zone.end) {
            if (enemy.type === 'fish') {
                enemy.angle = Math.PI - enemy.angle;
            }
            enemy.x = Math.max(zone.start, Math.min(zone.end - 1, enemy.x));
        }

        enemy.y = (enemy.y + WORLD_HEIGHT) % WORLD_HEIGHT;

        if (enemy.type === 'fish' && Math.random() < 0.02) {
            enemy.angle = Math.random() * Math.PI * 2;
        }
    });
}

function calculateXPRequirement(level) {
    return Math.floor(BASE_XP_REQUIREMENT * Math.pow(XP_MULTIPLIER, level - 1));
}

function getXPFromEnemy(enemy) {
    const tierMultipliers = {
        common: 10,
        uncommon: 20,
        rare: 40,
        epic: 80,
        legendary: 160,
        mythic: 320
    };
    return tierMultipliers[enemy.tier];
}

function initializeGame(messageData) {
    console.log('Initializing game state in worker');
    
    const savedProgress = messageData?.savedProgress || {
        level: 1,
        xp: 0,
        maxHealth: PLAYER_MAX_HEALTH,
        damage: PLAYER_DAMAGE
    };
    
    players[socket.id] = {
        id: socket.id,
        x: 200,
        y: WORLD_HEIGHT / 2,
        angle: 0,
        score: 0,
        velocityX: 0,
        velocityY: 0,
        health: savedProgress.maxHealth,
        maxHealth: savedProgress.maxHealth,
        damage: savedProgress.damage,
        inventory: [],
        isInvulnerable: true,
        level: savedProgress.level,
        xp: savedProgress.xp,
        xpToNextLevel: calculateXPRequirement(savedProgress.level)
    };

    setTimeout(() => {
        if (players[socket.id]) {
            players[socket.id].isInvulnerable = false;
        }
    }, RESPAWN_INVULNERABILITY_TIME);

    for (let i = 0; i < ENEMY_COUNT; i++) {
        enemies.push(createEnemy());
    }

    for (let i = 0; i < 20; i++) {
        obstacles.push(createObstacle());
    }

    for (let i = 0; i < ITEM_COUNT; i++) {
        items.push(createItem());
    }

    socket.emit('currentPlayers', players);
    socket.emit('enemiesUpdate', enemies);
    socket.emit('obstaclesUpdate', obstacles);
    socket.emit('itemsUpdate', items);
    socket.emit('playerMoved', players[socket.id]);
}

// Worker message handler
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

                        player.x = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX));
                        player.y = Math.max(0, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY));
                        player.angle = data.angle;
                        player.velocityX = data.velocityX;
                        player.velocityY = data.velocityY;

                        socket.emit('playerMoved', player);
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

function addXPToPlayer(player, xp) {
    if (player.level >= MAX_LEVEL) return;

    player.xp += xp;
    while (player.xp >= player.xpToNextLevel && player.level < MAX_LEVEL) {
        player.xp -= player.xpToNextLevel;
        player.level++;
        player.xpToNextLevel = calculateXPRequirement(player.level);
        handleLevelUp(player);
    }

    if (player.level >= MAX_LEVEL) {
        player.xp = 0;
        player.xpToNextLevel = 0;
    }

    socket.emit('xpGained', {
        playerId: player.id,
        xp: xp,
        totalXp: player.xp,
        level: player.level,
        xpToNextLevel: player.xpToNextLevel,
        maxHealth: player.maxHealth,
        damage: player.damage
    });
}

function handleLevelUp(player) {
    player.maxHealth += HEALTH_PER_LEVEL;
    player.health = player.maxHealth;
    player.damage += DAMAGE_PER_LEVEL;

    socket.emit('levelUp', {
        playerId: player.id,
        level: player.level,
        maxHealth: player.maxHealth,
        damage: player.damage
    });
}

function respawnPlayer(player) {
    // Determine spawn zone based on player level without losing levels
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
    
    // Reset health and position but keep level and stats
    player.health = player.maxHealth;
    player.x = spawnX;
    player.y = Math.random() * WORLD_HEIGHT;
    player.score = Math.max(0, player.score - 10); // Still lose some score
    player.inventory = [];
    player.isInvulnerable = true;

    // Just notify about respawn without level loss
    socket.emit('playerRespawned', player);

    setTimeout(() => {
        player.isInvulnerable = false;
    }, RESPAWN_INVULNERABILITY_TIME);
}
`; // Close the template literal here
// Export it differently
export default workerCode;
