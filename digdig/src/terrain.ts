export type BlockType = 'dirt' | 'diamond' | 'uranium' | 'lava' | 'quartz' | 'bedrock' | 'gold_ore' | 'portal'; // Add 'portal'

export interface Block {
    type: BlockType;
    present: boolean;
    durability?: number; // Add durability for bedrock
}

export class Terrain {
    private width: number;
    private height: number;
    private blocks: Block[][];
    private dugColor: string = '#3D2817'; // Dark brown color for dug areas
    private portalLocation: { x: number, y: number };

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.blocks = this.createBlocks();
        this.portalLocation = { x: Math.floor(width / 20), y: Math.floor(height / 20) };
        this.createPortal();
    }

    private createBlocks(): Block[][] {
        const blocks: Block[][] = [];
        for (let i = 0; i < this.width; i += 10) {
            const row: Block[] = [];
            for (let j = 0; j < this.height; j += 10) {
                row.push({ type: 'dirt', present: true });
            }
            blocks.push(row);
        }

        // Generate clusters of ore types
        this.generateClusters(blocks, 'diamond', 0.0001, 3, 7);
        this.generateClusters(blocks, 'uranium', 0.00005, 2, 5);
        this.generateClusters(blocks, 'lava', 0.0002, 3, 6);
        this.generateClusters(blocks, 'quartz', 0.0001, 3, 7);
        this.generateClusters(blocks, 'bedrock', 0.00005, 2, 5);
        this.generateClusters(blocks, 'gold_ore', 0.00015, 3, 6); // Add gold ore generation
        this.generateGeodes(blocks, 0.000005, 5, 8);

        return blocks;
    }

    private generateClusters(blocks: Block[][], type: BlockType, chance: number, minSize: number, maxSize: number) {
        for (let i = 0; i < blocks.length; i++) {
            for (let j = 0; j < blocks[i].length; j++) {
                if (Math.random() < chance) {
                    const clusterSize = this.getRandomClusterSize(minSize, maxSize);
                    this.createCluster(blocks, i, j, type, clusterSize);
                }
            }
        }
    }

    private createCluster(blocks: Block[][], x: number, y: number, type: BlockType, size: number) {
        for (let dx = -size; dx <= size; dx++) {
            for (let dy = -size; dy <= size; dy++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= size) {
                    const i = x + dx;
                    const j = y + dy;
                    if (i >= 0 && i < blocks.length && j >= 0 && j < blocks[i].length) {
                        // Use noise to determine if this block should be part of the cluster
                        if (this.noise(i, j, size) > 0.5) {
                            if (type === 'bedrock') {
                                blocks[i][j] = { type, present: true, durability: 50 }; // Increased durability for bedrock
                            } else {
                                blocks[i][j] = { type, present: true };
                            }
                        }
                    }
                }
            }
        }
    }

    private generateGeodes(blocks: Block[][], chance: number, minSize: number, maxSize: number) {
        for (let i = 0; i < blocks.length; i++) {
            for (let j = 0; j < blocks[i].length; j++) {
                if (Math.random() < chance) {
                    const geodeSize = this.getRandomClusterSize(minSize, maxSize);
                    this.createGeode(blocks, i, j, geodeSize);
                }
            }
        }
    }

    private createGeode(blocks: Block[][], x: number, y: number, size: number) {
        for (let dx = -size; dx <= size; dx++) {
            for (let dy = -size; dy <= size; dy++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= size) {
                    const i = x + dx;
                    const j = y + dy;
                    if (i >= 0 && i < blocks.length && j >= 0 && j < blocks[i].length) {
                        if (this.noise(i, j, size) > 0.5) {
                            if (distance <= size / 2) {
                                // Diamond core
                                blocks[i][j] = { type: 'diamond', present: true };
                            } else {
                                // Bedrock shell with higher durability
                                blocks[i][j] = { type: 'bedrock', present: true, durability: 100 };
                            }
                        }
                    }
                }
            }
        }
    }

    private noise(x: number, y: number, size: number): number {
        // Simple noise function, you can replace this with a more sophisticated one if needed
        const value = Math.sin(x * 0.1) + Math.sin(y * 0.1) + Math.sin((x + y) * 0.1);
        return (Math.sin(value * size) + 1) / 2; // Normalize to 0-1 range
    }

    private getRandomClusterSize(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    public generateTerrain(
        context: CanvasRenderingContext2D, 
        startX: number, 
        startY: number, 
        endX: number, 
        endY: number
    ) {
        // Ensure we're not trying to access blocks outside the terrain
        startX = Math.max(0, startX);
        startY = Math.max(0, startY);
        endX = Math.min(this.width / 10, endX);
        endY = Math.min(this.height / 10, endY);

        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                if (!this.blocks[x]) {
                    this.blocks[x] = [];
                }
                if (!this.blocks[x][y]) {
                    this.blocks[x][y] = this.generateBlock(x, y);
                }
                const block = this.blocks[x][y];
                if (block) {
                    context.fillStyle = block.present ? this.getBlockColor(block.type) : this.dugColor;
                    context.fillRect(x * 10, y * 10, 10, 10);
                }
            }
        }
    }

    public removeBlock(x: number, y: number): Block | null {
        const blockX = Math.floor(x / 10);
        const blockY = Math.floor(y / 10);
        if (this.blocks[blockX] && this.blocks[blockX][blockY] && this.blocks[blockX][blockY].present) {
            const block = this.blocks[blockX][blockY];
            if (block.type === 'portal') {
                return null; // Portal blocks cannot be removed
            }
            if (block.type === 'bedrock') {
                if (block.durability && block.durability > 1) {
                    this.blocks[blockX][blockY] = { ...block, durability: block.durability - 1 };
                    return null; // Return null to indicate the block wasn't fully removed
                }
            }
            this.blocks[blockX][blockY] = { ...block, present: false };
            return block;
        }
        return null;
    }

    private generateBlock(x: number, y: number): Block {
        // You can implement more complex logic here if needed
        return { type: 'dirt', present: true };
    }

    private getBlockColor(type: BlockType): string {
        switch (type) {
            case 'dirt':
                return '#8B4513'; // Saddle Brown
            case 'diamond':
                return '#00FFFF'; // Cyan
            case 'uranium':
                return '#32CD32'; // Lime Green
            case 'lava':
                return '#FF4500'; // Orange Red
            case 'quartz':
                return '#F0F8FF'; // Alice Blue
            case 'bedrock':
                return '#4A4A4A'; // Dark gray for bedrock
            case 'gold_ore':
                return '#FFD700'; // Gold color
            case 'portal':
                return '#8A2BE2'; // BlueViolet color for the portal
            default:
                return '#A9A9A9'; // Dark Gray
        }
    }

    public getBlock(x: number, y: number): Block | null {
        const blockX = Math.floor(x / 10);
        const blockY = Math.floor(y / 10);
        if (this.blocks[blockX] && this.blocks[blockX][blockY]) {
            return this.blocks[blockX][blockY];
        }
        return null;
    }

    public getPortalLocation(): { x: number, y: number } {
        return { x: this.portalLocation.x * 10, y: this.portalLocation.y * 10 };
    }

    getWidth(): number {
        return this.width;
    }

    getHeight(): number {
        return this.height;
    }

    private createPortal() {
        const portalSize = 5;
        for (let i = -portalSize; i <= portalSize; i++) {
            for (let j = -portalSize; j <= portalSize; j++) {
                if (i*i + j*j <= portalSize*portalSize) {
                    const x = this.portalLocation.x + i;
                    const y = this.portalLocation.y + j;
                    if (x >= 0 && x < this.width / 10 && y >= 0 && y < this.height / 10) {
                        this.blocks[x][y] = { type: 'portal', present: true };
                    }
                }
            }
        }
    }
}