import { Player } from './player';
import { Enemy } from './enemy';
import { CloudMob } from './cloudMob';
import { BumbleBee } from './bumbleBee';
import { Terrain } from './terrain';
import { Game } from './game';

interface AlternateDimensionDot {
    x: number;
    y: number;
    present: boolean;
}

interface Wall {
    x: number;
    y: number;
    width: number;
    height: number;
}

export enum DimensionType {
    Dark,
    Grass
}

interface Bridge {
    start: { x: number, y: number };
    end: { x: number, y: number };
    width: number;
}

export class AlternateDimension {
    private width: number;
    private height: number;
    private context: CanvasRenderingContext2D;
    private regularPortalLocation: { x: number, y: number };
    private grassPortalLocation: { x: number, y: number };
    private dots: AlternateDimensionDot[];
    private dotRadius: number = 25;
    private portalRadius: number = 25;
    private walls: Wall[];
    private dimensionType: DimensionType;
    private grassPatches: { x: number, y: number, radius: number }[];
    private islands: { x: number, y: number, radius: number }[] = [];
    private bridges: Bridge[] = [];
    private bumbleBees: BumbleBee[] = [];
    private player: Player;
    private terrain: Terrain;
    private game: Game;

    constructor(width: number, height: number, context: CanvasRenderingContext2D, dimensionType: DimensionType = DimensionType.Dark, player: Player, terrain: Terrain, game: Game) {
        this.width = width;
        this.height = height;
        this.context = context;
        this.dimensionType = dimensionType;
        this.player = player;
        this.terrain = terrain;
        this.game = game;
        
        if (this.dimensionType === DimensionType.Dark) {
            this.walls = this.createFixedMap();
        } else {
            this.walls = []; // No walls in grass dimension
            this.islands = this.generatePermanentIslands();
            this.bridges = this.generateBridges();
            this.generateBumbleBees();
        }
        
        this.regularPortalLocation = this.findSafePortalLocation();
        this.grassPortalLocation = this.findSafePortalLocation();
        this.dots = this.generateDots();
        this.grassPatches = this.generateGrassPatches();
    }

    private generatePermanentIslands(): { x: number, y: number, radius: number }[] {
        return [
            { x: 1000, y: 1000, radius: 500 },
            { x: 3000, y: 1500, radius: 600 },
            { x: 5000, y: 1000, radius: 550 },
            { x: 7000, y: 1500, radius: 450 },
            { x: 1500, y: 3000, radius: 400 },
            { x: 4000, y: 3500, radius: 700 },
            { x: 6500, y: 3000, radius: 500 },
            { x: 2000, y: 5000, radius: 550 },
            { x: 5000, y: 5500, radius: 600 },
            { x: 8000, y: 5000, radius: 450 },
            { x: 1000, y: 7000, radius: 500 },
            { x: 3500, y: 7500, radius: 650 },
            { x: 6000, y: 7000, radius: 550 },
            { x: 8000, y: 7500, radius: 400 },
        ];
    }

    private generateBridges(): Bridge[] {
        return [
            { start: { x: 1500, y: 1000 }, end: { x: 2400, y: 1500 }, width: 200 },
            { start: { x: 3600, y: 1500 }, end: { x: 4450, y: 1000 }, width: 200 },
            { start: { x: 5550, y: 1000 }, end: { x: 6550, y: 1500 }, width: 200 },
            { start: { x: 1500, y: 1500 }, end: { x: 1500, y: 2600 }, width: 200 },
            { start: { x: 3000, y: 2100 }, end: { x: 3300, y: 3500 }, width: 200 },
            { start: { x: 4700, y: 3500 }, end: { x: 6000, y: 3000 }, width: 200 },
            { start: { x: 7000, y: 1950 }, end: { x: 7000, y: 2500 }, width: 200 },
            { start: { x: 1900, y: 3000 }, end: { x: 2000, y: 4450 }, width: 200 },
            { start: { x: 4000, y: 4200 }, end: { x: 4400, y: 5500 }, width: 200 },
            { start: { x: 5600, y: 5500 }, end: { x: 7550, y: 5000 }, width: 200 },
            { start: { x: 2550, y: 5000 }, end: { x: 3500, y: 6850 }, width: 200 },
            { start: { x: 5000, y: 6100 }, end: { x: 5450, y: 7000 }, width: 200 },
            { start: { x: 6550, y: 7000 }, end: { x: 7600, y: 7500 }, width: 200 },
        ];
    }

    private isOnIslandOrBridge(x: number, y: number): boolean {
        return this.isInsideIsland(x, y) || this.isOnBridge(x, y);
    }

    private isInsideIsland(x: number, y: number): boolean {
        return this.islands.some(island => {
            const distance = Math.sqrt(Math.pow(x - island.x, 2) + Math.pow(y - island.y, 2));
            return distance < island.radius + 5; // Add a 5-pixel buffer
        });
    }

    private isOnBridge(x: number, y: number): boolean {
        return this.bridges.some(bridge => {
            const A = { x: bridge.start.x, y: bridge.start.y };
            const B = { x: bridge.end.x, y: bridge.end.y };
            const C = { x, y };

            const distAB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
            const distAC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
            const distCB = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(C.y - B.y, 2));

            // Increase the effective width of the bridge hitbox
            const effectiveWidth = bridge.width * 1.5; // 50% wider hitbox
            const halfWidth = effectiveWidth / 2;

            // Check if the point is within the bounding box of the bridge
            const minX = Math.min(A.x, B.x) - halfWidth;
            const maxX = Math.max(A.x, B.x) + halfWidth;
            const minY = Math.min(A.y, B.y) - halfWidth;
            const maxY = Math.max(A.y, B.y) + halfWidth;

            if (C.x < minX || C.x > maxX || C.y < minY || C.y > maxY) {
                return false;
            }

            // Check if the point is close enough to the bridge line
            const crossProduct = Math.abs((C.y - A.y) * (B.x - A.x) - (C.x - A.x) * (B.y - A.y));
            const distanceFromLine = crossProduct / distAB;

            return distanceFromLine <= halfWidth && (distAC + distCB <= distAB + effectiveWidth / 2);
        });
    }

    private generateGrassPatches(): { x: number, y: number, radius: number }[] {
        const patches = [];
        const patchCount = 50;
        for (let i = 0; i < patchCount; i++) {
            patches.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Math.random() * 100 + 50
            });
        }
        return patches;
    }

    private generateDots(): AlternateDimensionDot[] {
        const dots: AlternateDimensionDot[] = [];
        const dotCount = 1000;
        let attempts = 0;
        const maxAttempts = 10000;

        while (dots.length < dotCount && attempts < maxAttempts) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            const isValidLocation = this.dimensionType === DimensionType.Dark
                ? !this.isInsideWall(x, y)
                : this.isOnIslandOrBridge(x, y);

            if (isValidLocation && !this.isOverlappingDots(x, y, dots) && !this.isOverlappingPortal(x, y)) {
                dots.push({
                    x: x,
                    y: y,
                    present: true
                });
            }
            attempts++;
        }
        return dots;
    }

    private isInsideWall(x: number, y: number): boolean {
        return this.walls.some(wall => 
            x - this.dotRadius < wall.x + wall.width &&
            x + this.dotRadius > wall.x &&
            y - this.dotRadius < wall.y + wall.height &&
            y + this.dotRadius > wall.y
        );
    }

    private isOverlappingDots(x: number, y: number, dots: AlternateDimensionDot[]): boolean {
        return dots.some(dot => 
            Math.sqrt(Math.pow(x - dot.x, 2) + Math.pow(y - dot.y, 2)) < (this.dotRadius * 2)
        );
    }

    private isOverlappingPortal(x: number, y: number): boolean {
        const dx = x - this.regularPortalLocation.x;
        const dy = y - this.regularPortalLocation.y;
        return Math.sqrt(dx * dx + dy * dy) < (this.dotRadius + this.portalRadius);
    }

    private createFixedMap(): Wall[] {
        const walls: Wall[] = [
            // Outer walls with openings
            { x: 0, y: 0, width: this.width / 2 - 200, height: 200 },
            { x: this.width / 2 + 200, y: 0, width: this.width / 2 - 200, height: 200 },
            { x: 0, y: 0, width: 200, height: this.height / 2 - 200 },
            { x: 0, y: this.height / 2 + 200, width: 200, height: this.height / 2 - 200 },
            { x: this.width - 200, y: 0, width: 200, height: this.height / 2 - 200 },
            { x: this.width - 200, y: this.height / 2 + 200, width: 200, height: this.height / 2 - 200 },
            { x: 0, y: this.height - 200, width: this.width / 2 - 200, height: 200 },
            { x: this.width / 2 + 200, y: this.height - 200, width: this.width / 2 - 200, height: 200 },

            // Inner structures with openings
            { x: 1000, y: 1000, width: 800, height: 300 },
            { x: 1000, y: 1500, width: 300, height: 300 },
            { x: 1500, y: 1500, width: 300, height: 300 },
            { x: 1000, y: 1800, width: 800, height: 200 },

            { x: 3000, y: 3000, width: 1000, height: 400 },
            { x: 3000, y: 3400, width: 400, height: 600 },
            { x: 3600, y: 3400, width: 400, height: 600 },
            { x: 3000, y: 3900, width: 1000, height: 100 },

            { x: 6000, y: 2000, width: 1500, height: 200 },
            { x: 6000, y: 2200, width: 200, height: 300 },
            { x: 7300, y: 2200, width: 200, height: 300 },
            { x: 6000, y: 2400, width: 1500, height: 100 },

            { x: 2000, y: 6000, width: 200, height: 1500 },
            { x: 2200, y: 6000, width: 300, height: 200 },
            { x: 2200, y: 7300, width: 300, height: 200 },
            { x: 2400, y: 6000, width: 100, height: 1500 },

            { x: 7000, y: 7000, width: 1200, height: 400 },
            { x: 7000, y: 7400, width: 400, height: 800 },
            { x: 7800, y: 7400, width: 400, height: 800 },
            { x: 7000, y: 8100, width: 1200, height: 100 },

            // Maze-like structures with openings
            { x: 4000, y: 1000, width: 200, height: 800 },
            { x: 4000, y: 2000, width: 200, height: 1000 },
            { x: 4200, y: 1000, width: 800, height: 200 },
            { x: 5200, y: 1000, width: 200, height: 200 },
            { x: 5000, y: 1200, width: 200, height: 800 },
            { x: 5000, y: 2200, width: 200, height: 800 },
            { x: 4200, y: 2000, width: 600, height: 200 },

            { x: 1000, y: 4000, width: 800, height: 200 },
            { x: 2000, y: 4000, width: 1000, height: 200 },
            { x: 1000, y: 4200, width: 200, height: 800 },
            { x: 1000, y: 5200, width: 200, height: 200 },
            { x: 1200, y: 5000, width: 800, height: 200 },
            { x: 2200, y: 5000, width: 800, height: 200 },
            { x: 2000, y: 4200, width: 200, height: 600 },

            // Additional structures
            // Central complex
            { x: 4500, y: 4500, width: 1000, height: 1000 },
            { x: 4700, y: 4500, width: 600, height: 200 },
            { x: 4500, y: 4700, width: 200, height: 600 },
            { x: 5300, y: 4700, width: 200, height: 600 },
            { x: 4700, y: 5300, width: 600, height: 200 },

            // Northwest quadrant
            { x: 1000, y: 1000, width: 1500, height: 1500 },
            { x: 1200, y: 1200, width: 1100, height: 1100 },
            { x: 1400, y: 1000, width: 200, height: 200 },
            { x: 1000, y: 1400, width: 200, height: 200 },
            { x: 2300, y: 1400, width: 200, height: 200 },
            { x: 1400, y: 2300, width: 200, height: 200 },

            // Northeast quadrant
            { x: 7500, y: 1000, width: 1500, height: 1500 },
            { x: 7700, y: 1200, width: 1100, height: 1100 },
            { x: 7900, y: 1000, width: 200, height: 200 },
            { x: 7500, y: 1400, width: 200, height: 200 },
            { x: 8800, y: 1400, width: 200, height: 200 },
            { x: 7900, y: 2300, width: 200, height: 200 },

            // Southwest quadrant
            { x: 1000, y: 7500, width: 1500, height: 1500 },
            { x: 1200, y: 7700, width: 1100, height: 1100 },
            { x: 1400, y: 7500, width: 200, height: 200 },
            { x: 1000, y: 7900, width: 200, height: 200 },
            { x: 2300, y: 7900, width: 200, height: 200 },
            { x: 1400, y: 8800, width: 200, height: 200 },

            // Southeast quadrant
            { x: 7500, y: 7500, width: 1500, height: 1500 },
            { x: 7700, y: 7700, width: 1100, height: 1100 },
            { x: 7900, y: 7500, width: 200, height: 200 },
            { x: 7500, y: 7900, width: 200, height: 200 },
            { x: 8800, y: 7900, width: 200, height: 200 },
            { x: 7900, y: 8800, width: 200, height: 200 },

            // Additional maze-like structures
            { x: 3000, y: 3000, width: 1000, height: 100 },
            { x: 3000, y: 3000, width: 100, height: 1000 },
            { x: 3900, y: 3000, width: 100, height: 1000 },
            { x: 3000, y: 3900, width: 1000, height: 100 },
            { x: 3300, y: 3300, width: 400, height: 400 },

            { x: 6000, y: 3000, width: 1000, height: 100 },
            { x: 6000, y: 3000, width: 100, height: 1000 },
            { x: 6900, y: 3000, width: 100, height: 1000 },
            { x: 6000, y: 3900, width: 1000, height: 100 },
            { x: 6300, y: 3300, width: 400, height: 400 },

            { x: 3000, y: 6000, width: 1000, height: 100 },
            { x: 3000, y: 6000, width: 100, height: 1000 },
            { x: 3900, y: 6000, width: 100, height: 1000 },
            { x: 3000, y: 6900, width: 1000, height: 100 },
            { x: 3300, y: 6300, width: 400, height: 400 },

            { x: 6000, y: 6000, width: 1000, height: 100 },
            { x: 6000, y: 6000, width: 100, height: 1000 },
            { x: 6900, y: 6000, width: 100, height: 1000 },
            { x: 6000, y: 6900, width: 1000, height: 100 },
            { x: 6300, y: 6300, width: 400, height: 400 },

            // Connecting corridors
            { x: 2500, y: 4900, width: 5000, height: 200 },
            { x: 4900, y: 2500, width: 200, height: 5000 },
        ];

        return walls;
    }

    private findSafePortalLocation(): { x: number, y: number } {
        let x = 0;
        let y = 0;
        let isSafe = false;

        while (!isSafe) {
            if (this.dimensionType === DimensionType.Grass) {
                const randomIsland = this.islands[Math.floor(Math.random() * this.islands.length)];
                const angle = Math.random() * 2 * Math.PI;
                const distance = Math.random() * randomIsland.radius;
                x = randomIsland.x + distance * Math.cos(angle);
                y = randomIsland.y + distance * Math.sin(angle);

                isSafe = this.isOnIslandOrBridge(x, y);
            } else {
                x = Math.random() * this.width;
                y = Math.random() * this.height;

                isSafe = !this.isInsideWall(x, y);
            }
        }

        return { x, y };
    }

    public update(player: Player, entities: (Enemy | CloudMob)[], deltaTime: number): void {
        // Check if player is digging any dots
        const playerRadius = player.getSize() / 2;
        this.dots.forEach(dot => {
            if (dot.present) {
                const dx = player.getX() - dot.x;
                const dy = player.getY() - dot.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= playerRadius + this.dotRadius) {
                    dot.present = false;
                    player.adjustAlternateDimensionScore(1000); // Give 1000 points for each dot
                }
            }
        });

        // Check for collisions with walls
        this.walls.forEach(wall => {
            if (this.checkCollisionWithWall(player, wall)) {
                this.resolveCollision(player, wall);
            }
        });

        if (this.dimensionType === DimensionType.Grass) {
            this.updateGrassDimension(player);
            this.updateBumbleBees(player, deltaTime);
        }

        // Update entities (enemies or cloud mobs)
        entities.forEach(entity => {
            if (this.checkCollision(entity, player)) {
                this.resolveEntityCollision(entity, player);
            }
        });
    }

    private updateGrassDimension(player: Player) {
        // Check if player is on grass
        const playerOnGrass = this.grassPatches.some(patch => {
            const dx = player.getX() - patch.x;
            const dy = player.getY() - patch.y;
            return Math.sqrt(dx * dx + dy * dy) <= patch.radius;
        });

        if (playerOnGrass) {
            player.recoverHealth(0.1); // Heal player slightly when on grass
        }
    }

    private checkCollision(entity1: { getX: () => number, getY: () => number, getSize: () => number }, entity2: { getX: () => number, getY: () => number, getSize: () => number }): boolean {
        const dx = entity1.getX() - entity2.getX();
        const dy = entity1.getY() - entity2.getY();
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (entity1.getSize() + entity2.getSize()) / 2;
    }

    private checkCollisionWithWall(entity: { getX: () => number, getY: () => number, getSize: () => number }, wall: Wall): boolean {
        const entityLeft = entity.getX() - entity.getSize() / 2;
        const entityRight = entity.getX() + entity.getSize() / 2;
        const entityTop = entity.getY() - entity.getSize() / 2;
        const entityBottom = entity.getY() + entity.getSize() / 2;

        return entityLeft < wall.x + wall.width &&
               entityRight > wall.x &&
               entityTop < wall.y + wall.height &&
               entityBottom > wall.y;
    }

    private resolveCollision(player: Player, wall: Wall) {
        const playerSize = player.getSize();
        const playerCenterX = player.getX();
        const playerCenterY = player.getY();
        const wallCenterX = wall.x + wall.width / 2;
        const wallCenterY = wall.y + wall.height / 2;

        const dx = playerCenterX - wallCenterX;
        const dy = playerCenterY - wallCenterY;

        if (Math.abs(dx / wall.width) > Math.abs(dy / wall.height)) {
            // Collision on the x-axis
            if (dx > 0) {
                player.setPosition(wall.x + wall.width + playerSize / 2, player.getY());
            } else {
                player.setPosition(wall.x - playerSize / 2, player.getY());
            }
        } else {
            // Collision on the y-axis
            if (dy > 0) {
                player.setPosition(player.getX(), wall.y + wall.height + playerSize / 2);
            } else {
                player.setPosition(player.getX(), wall.y - playerSize / 2);
            }
        }
    }

    private resolveEntityCollision(entity: Enemy | CloudMob, player: Player): void {
        // Handle collision based on entity type
        if (entity instanceof Enemy) {
            // Existing enemy collision logic
            const damage = Math.floor(entity.getSize() * 0.5);
            player.takeDamage(damage);
        } else if (entity instanceof CloudMob) {
            // Cloud mob collision logic (no damage, just bounce)
            const dx = player.getX() - entity.getX();
            const dy = player.getY() - entity.getY();
            const distance = Math.sqrt(dx * dx + dy * dy);
            const bounceDistance = 20;
            const bounceX = entity.getX() + (dx / distance) * bounceDistance;
            const bounceY = entity.getY() + (dy / distance) * bounceDistance;
            entity.setPosition(bounceX, bounceY);
        }
    }

    public render(context: CanvasRenderingContext2D, player: Player, canvasWidth: number, canvasHeight: number, zoom: number) {
        if (this.dimensionType === DimensionType.Dark) {
            this.renderDarkDimension(context, player, canvasWidth, canvasHeight, zoom);
        } else {
            this.renderGrassDimension(context, player, canvasWidth, canvasHeight, zoom);
        }
    }

    private renderDarkDimension(context: CanvasRenderingContext2D, player: Player, canvasWidth: number, canvasHeight: number, zoom: number) {
        // Fill the entire visible area with a dark background
        context.fillStyle = '#000033'; // Dark blue background
        context.fillRect(player.getX() - canvasWidth / (2 * zoom), player.getY() - canvasHeight / (2 * zoom), canvasWidth / zoom, canvasHeight / zoom);

        // Draw the walls
        context.fillStyle = 'white';
        this.walls.forEach(wall => {
            context.fillRect(wall.x, wall.y, wall.width, wall.height);
        });

        // Draw the diggable dots
        context.fillStyle = '#FFD700'; // Gold color for the dots
        this.dots.forEach(dot => {
            if (dot.present) {
                context.beginPath();
                context.arc(dot.x, dot.y, this.dotRadius, 0, Math.PI * 2);
                context.fill();
            }
        });

        // Draw the portals
        context.fillStyle = '#00BFFF'; // Light blue color for portals
        context.beginPath();
        context.arc(this.regularPortalLocation.x, this.regularPortalLocation.y, this.portalRadius, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(this.grassPortalLocation.x, this.grassPortalLocation.y, this.portalRadius, 0, Math.PI * 2);
        context.fill();
    }

    private renderGrassDimension(context: CanvasRenderingContext2D, player: Player, canvasWidth: number, canvasHeight: number, zoom: number) {
        // Fill the entire visible area with a light blue background (water)
        context.fillStyle = '#87CEEB';
        context.fillRect(player.getX() - canvasWidth / (2 * zoom), player.getY() - canvasHeight / (2 * zoom), canvasWidth / zoom, canvasHeight / zoom);

        // Draw islands
        context.fillStyle = '#228B22'; // Forest green for islands
        this.islands.forEach(island => {
            context.beginPath();
            context.arc(island.x, island.y, island.radius, 0, Math.PI * 2);
            context.fill();
        });

        // Draw bridges
        context.strokeStyle = '#8B4513'; // Saddle Brown for bridges
        this.bridges.forEach(bridge => {
            context.beginPath();
            context.moveTo(bridge.start.x, bridge.start.y);
            context.lineTo(bridge.end.x, bridge.end.y);
            context.lineWidth = bridge.width;
            context.stroke();
        });

        // Draw grass patches on islands
        context.fillStyle = '#32CD32'; // Lime green for grass patches
        this.grassPatches.forEach(patch => {
            if (this.isInsideIsland(patch.x, patch.y)) {
                context.beginPath();
                context.arc(patch.x, patch.y, patch.radius, 0, Math.PI * 2);
                context.fill();
            }
        });

        // Draw the diggable dots (as flowers in this dimension)
        context.fillStyle = '#FF69B4'; // Hot Pink for flowers
        this.dots.forEach(dot => {
            if (dot.present) {
                context.beginPath();
                context.arc(dot.x, dot.y, this.dotRadius, 0, Math.PI * 2);
                context.fill();
            }
        });

        // Draw the portals
        context.fillStyle = '#00BFFF'; // Light blue color for portals
        context.beginPath();
        context.arc(this.regularPortalLocation.x, this.regularPortalLocation.y, this.portalRadius, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(this.grassPortalLocation.x, this.grassPortalLocation.y, this.portalRadius, 0, Math.PI * 2);
        context.fill();

        // Draw bumble bees
        this.bumbleBees.forEach(bee => bee.draw());
    }

    public getRegularPortalLocation(): { x: number, y: number } {
        return this.regularPortalLocation;
    }

    public getGrassPortalLocation(): { x: number, y: number } {
        return this.grassPortalLocation;
    }

    public getWalls(): Wall[] {
        return this.walls;
    }

    public getWidth(): number {
        return this.width;
    }

    public getHeight(): number {
        return this.height;
    }

    public generateNewPortalLocation(): void {
        this.regularPortalLocation = this.findSafePortalLocation();
        this.grassPortalLocation = this.findSafePortalLocation();
    }

    public setDimensionType(type: DimensionType) {
        this.dimensionType = type;
    }

    public getDimensionType(): DimensionType {
        return this.dimensionType;
    }

    public getGrassPatches(): { x: number, y: number, radius: number }[] {
        return this.grassPatches;
    }

    public getIslands(): { x: number, y: number, radius: number }[] {
        return this.islands;
    }

    public getBridges(): Bridge[] {
        return this.bridges;
    }

    // Add a method to check if a move is valid
    public isValidMove(x: number, y: number): boolean {
        return this.dimensionType === DimensionType.Dark || this.isOnIslandOrBridge(x, y);
    }

    private generateBumbleBees(): void {
        const beeCount = 20; // Adjust this number as needed
        this.islands.forEach(island => {
            for (let i = 0; i < beeCount / this.islands.length; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * (island.radius - this.dotRadius);
                const x = island.x + Math.cos(angle) * distance;
                const y = island.y + Math.sin(angle) * distance;
                this.bumbleBees.push(new BumbleBee(x, y, this.context, this.player, this.terrain, island, this.game));
            }
        });
    }

    private updateBumbleBees(player: Player, deltaTime: number): void {
        this.bumbleBees = this.bumbleBees.filter(bee => !bee.isDead());
        
        this.bumbleBees.forEach(bee => {
            bee.update(deltaTime);
            
            // Check for collision with player
            const dx = player.getX() - bee.getX();
            const dy = player.getY() - bee.getY();
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < (player.getSize() + bee.getSize()) / 2) {
                if (!bee.isAngered()) {
                    bee.anger();
                } else {
                    const playerMaxHealth = player.getHealth();
                    const damage = Math.floor(playerMaxHealth * 0.75); // 3/4 of player's max health
                    player.takeDamage(damage);
                    bee.takeDamage(10); // Player deals 10 damage to the bee
                }
            }

            // Player can damage bees when they're close
            if (distance < player.getSize() * 1.5) {
                bee.takeDamage(1); // Player deals 1 damage to the bee when close
            }
        });

        // Spawn new bees if needed
        while (this.bumbleBees.length < 20) {
            const island = this.islands[Math.floor(Math.random() * this.islands.length)];
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (island.radius - this.dotRadius);
            const x = island.x + Math.cos(angle) * distance;
            const y = island.y + Math.sin(angle) * distance;
            this.bumbleBees.push(new BumbleBee(x, y, this.context, player, this.terrain, island, this.game));
        }
    }

    // Add a getter for bumble bees
    public getBumbleBees(): BumbleBee[] {
        return this.bumbleBees;
    }

    // Add this method to the AlternateDimension class
    public setBumbleBees(bees: BumbleBee[]): void {
        this.bumbleBees = bees;
    }
}