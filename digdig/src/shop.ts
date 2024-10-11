import { Player, Emote } from './player';
import { Game } from './game';

export class Shop {
    private player: Player;
    private context: CanvasRenderingContext2D;
    private isOpen: boolean = false;
    private game: Game;
    private allEmotes: Emote[] = Object.values(Emote).filter(value => typeof value === 'number') as Emote[];
    private availableEmotes: Emote[] = [];
    private readonly SHOP_SIZE: number = 8;

    constructor(player: Player, context: CanvasRenderingContext2D, game: Game) {
        this.player = player;
        this.context = context;
        this.game = game;
        this.initializeAvailableEmotes();
    }

    private initializeAvailableEmotes(): void {
        const ownedEmotes = new Set(this.player.getOwnedEmotes());
        const unownedEmotes = this.allEmotes.filter((emote: Emote) => !ownedEmotes.has(emote));
        this.availableEmotes = this.getRandomEmotes(unownedEmotes, this.SHOP_SIZE);
    }

    private getRandomEmotes(emotes: Emote[], count: number): Emote[] {
        const shuffled = [...emotes].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    public toggleShop(): void {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.updateAvailableEmotes();
        }
    }

    private updateAvailableEmotes(): void {
        const ownedEmotes = new Set(this.player.getOwnedEmotes());
        this.availableEmotes = this.availableEmotes.filter((emote: Emote) => !ownedEmotes.has(emote));
        const unownedEmotes = this.allEmotes.filter((emote: Emote) => !ownedEmotes.has(emote) && !this.availableEmotes.includes(emote));
        const newEmotes = this.getRandomEmotes(unownedEmotes, this.SHOP_SIZE - this.availableEmotes.length);
        this.availableEmotes.push(...newEmotes);
    }

    public isShopOpen(): boolean {
        return this.isOpen;
    }

    public render(canvasWidth: number, canvasHeight: number): void {
        if (!this.isOpen) return;

        const shopWidth = 300;
        const shopHeight = 400;
        const x = (canvasWidth - shopWidth) / 2;
        const y = (canvasHeight - shopHeight) / 2;

        // Draw shop background
        this.context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.context.fillRect(x, y, shopWidth, shopHeight);

        // Draw shop title
        this.context.fillStyle = 'white';
        this.context.font = '24px Arial';
        this.context.textAlign = 'center';
        this.context.fillText('Emote Shop', x + shopWidth / 2, y + 30);

        // Draw player's gold
        this.context.fillStyle = 'gold';
        this.context.font = '18px Arial';
        this.context.fillText(`Gold: ${this.player.getGoldScore()}`, x + shopWidth / 2, y + 60);

        // Draw emotes
        const emoteSize = 40;
        const columns = 4;
        const padding = 10;
        const startX = x + (shopWidth - (emoteSize + padding) * columns + padding) / 2;
        const startY = y + 80;

        this.availableEmotes.forEach((emote, index) => {
            const emoteX = startX + (index % columns) * (emoteSize + padding);
            const emoteY = startY + Math.floor(index / columns) * (emoteSize + padding);

            // Draw emote background
            this.context.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.context.fillRect(emoteX, emoteY, emoteSize, emoteSize);

            // Draw emote
            this.context.font = `${emoteSize * 0.7}px Arial`;
            this.context.fillStyle = 'white';
            this.context.fillText(this.getEmoteText(emote), emoteX + emoteSize / 2, emoteY + emoteSize * 0.7);

            // Draw price
            this.context.font = '12px Arial';
            this.context.fillStyle = 'gold';
            this.context.fillText('300', emoteX + emoteSize / 2, emoteY + emoteSize - 5);
        });
    }

    public handleClick(x: number, y: number, canvasWidth: number, canvasHeight: number): void {
        if (!this.isOpen) return;

        const shopWidth = 300;
        const shopHeight = 400;
        const shopX = (canvasWidth - shopWidth) / 2;
        const shopY = (canvasHeight - shopHeight) / 2;

        const emoteSize = 40;
        const columns = 4;
        const padding = 10;
        const startX = shopX + (shopWidth - (emoteSize + padding) * columns + padding) / 2;
        const startY = shopY + 80;

        this.availableEmotes.forEach((emote, index) => {
            const emoteX = startX + (index % columns) * (emoteSize + padding);
            const emoteY = startY + Math.floor(index / columns) * (emoteSize + padding);

            if (x >= emoteX && x < emoteX + emoteSize && y >= emoteY && y < emoteY + emoteSize) {
                this.buyEmote(emote);
            }
        });
    }

    private buyEmote(emote: Emote) {
        if (this.player.buyEmote(emote)) {
            console.log(`Bought emote: ${Emote[emote]}`);
            this.game.getSoundManager().playBuyEmoteSound();
        } else {
            console.log(`Not enough gold to buy emote: ${Emote[emote]}`);
        }
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
            case Emote.Strong: return '💪';
            case Emote.Scared: return '😱';
            case Emote.Crazy: return '🤪';
            case Emote.Evil: return '😈';
            case Emote.Dead: return '💀';
            default: return '';
        }
    }
}