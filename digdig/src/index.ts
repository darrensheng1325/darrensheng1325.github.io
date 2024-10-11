import { Game } from './game';
import { TitleScreen } from './titleScreen';

class GameManager {
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private game: Game | null = null;
    private titleScreen: TitleScreen;
    private controlToggleButton: HTMLButtonElement;
    private minimapCanvas: HTMLCanvasElement;
    private minimapContext: CanvasRenderingContext2D;
    private volumeSlider: HTMLInputElement;
    private muteButton: HTMLButtonElement;
    private isFullscreen: boolean = false;

    constructor() {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.context = this.canvas.getContext('2d')!;
        this.volumeSlider = this.createVolumeSlider();
        this.muteButton = this.createMuteButton();
        this.titleScreen = new TitleScreen(this.canvas, this.context, () => this.startGame(), this.volumeSlider, this.muteButton);
        this.controlToggleButton = document.createElement('button');
        this.controlToggleButton.textContent = 'Toggle Controls';
        this.controlToggleButton.style.position = 'absolute';
        this.controlToggleButton.style.top = '50px';
        this.controlToggleButton.style.right = '10px';
        this.controlToggleButton.style.zIndex = '1000';
        document.body.appendChild(this.controlToggleButton);

        // Create minimap canvas
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.width = 200;
        this.minimapCanvas.height = 200;
        this.minimapCanvas.style.position = 'absolute';
        this.minimapCanvas.style.top = '100px';
        this.minimapCanvas.style.right = '10px';
        this.minimapCanvas.style.zIndex = '1000';
        this.minimapCanvas.style.border = '1px solid white';
        this.minimapCanvas.style.display = 'none'; // Initially hide the minimap
        document.body.appendChild(this.minimapCanvas);
        this.minimapContext = this.minimapCanvas.getContext('2d')!;
        this.loadSettings();
        this.applySettings();
    }

    private createVolumeSlider(): HTMLInputElement {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.1';
        slider.value = '0.5'; // Default volume
        slider.style.position = 'absolute';
        slider.style.top = '10px';
        slider.style.right = '10px';
        slider.style.width = '100px';
        slider.style.zIndex = '1000';
        
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

        document.body.appendChild(button);
        return button;
    }

    private loadSettings() {
        const fullscreenSetting = localStorage.getItem('isFullscreen');
        this.isFullscreen = fullscreenSetting === 'true';
    }

    private applySettings() {
        if (this.isFullscreen) {
            this.enterFullscreen();
        }
    }

    public init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.showTitleScreen();
    }

    private resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.game) {
            this.game.resizeCanvas();
        }
    }

    private showTitleScreen() {
        this.titleScreen.show();
        this.controlToggleButton.style.display = 'none';
        this.minimapCanvas.style.display = 'none';
    }

    private startGame() {
        this.game = new Game('gameCanvas', this.titleScreen);
        this.setupFullscreenButton();
        this.setupControlToggleButton();
        this.controlToggleButton.style.display = 'block';
        // Remove this line: this.minimapCanvas.style.display = 'block';
        this.updateMinimap();
    }

    private setupFullscreenButton() {
        const fullscreenButton = document.getElementById('fullscreenButton')!;
        fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
    }

    private setupControlToggleButton() {
        this.controlToggleButton.addEventListener('click', () => {
            if (this.game) {
                this.game.toggleControls();
            }
        });
    }

    private toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    private enterFullscreen() {
        document.documentElement.requestFullscreen();
        this.isFullscreen = true;
        localStorage.setItem('isFullscreen', 'true');
    }

    private exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        this.isFullscreen = false;
        localStorage.setItem('isFullscreen', 'false');
    }

    private updateMinimap() {
        if (this.game) {
            this.game.renderMinimap(this.minimapContext, this.minimapCanvas.width, this.minimapCanvas.height);
        }
        requestAnimationFrame(() => this.updateMinimap());
    }
}

window.onload = () => {
    const gameManager = new GameManager();
    gameManager.init();
};