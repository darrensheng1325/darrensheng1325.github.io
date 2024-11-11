import { Player } from './player';
import { Dot, Enemy, Obstacle } from './enemy';
import { io, Socket } from 'socket.io-client';
import { Item } from './item';
import { workerBlob } from './workerblob';

export class Game {
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
  private showHitboxes: boolean = true;  // Set to true to show hitboxes
  private titleScreen: HTMLElement | null;
  private nameInput: HTMLInputElement | null;
  private exitButton: HTMLElement | null;
  private exitButtonContainer: HTMLElement | null;
  private playerHue: number = 0;
  private playerColor: string = 'hsl(0, 100%, 50%)';
  private colorPreviewCanvas: HTMLCanvasElement;

  constructor(isSinglePlayer: boolean = false) {
      //console.log('Game constructor called');
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
      
      // Create and set up preview canvas
      this.colorPreviewCanvas = document.createElement('canvas');
      this.colorPreviewCanvas.width = 64;  // Set fixed size for preview
      this.colorPreviewCanvas.height = 64;
      this.colorPreviewCanvas.style.width = '64px';
      this.colorPreviewCanvas.style.height = '64px';
      this.colorPreviewCanvas.style.imageRendering = 'pixelated';
      
      // Add preview canvas to the color picker
      const previewContainer = document.createElement('div');
      previewContainer.style.display = 'flex';
      previewContainer.style.justifyContent = 'center';
      previewContainer.style.marginTop = '10px';
      previewContainer.appendChild(this.colorPreviewCanvas);
      document.querySelector('.color-picker')?.appendChild(previewContainer);

      // Set up color picker functionality
      const hueSlider = document.getElementById('hueSlider') as HTMLInputElement;
      const colorPreview = document.getElementById('colorPreview');
      
      if (hueSlider && colorPreview) {
          // Load saved hue from localStorage
          const savedHue = localStorage.getItem('playerHue');
          if (savedHue !== null) {
              this.playerHue = parseInt(savedHue);
              hueSlider.value = savedHue;
              this.playerColor = `hsl(${this.playerHue}, 100%, 50%)`;
              colorPreview.style.backgroundColor = this.playerColor;
              this.updateColorPreview();
          }

          // Preview color while sliding without saving
          hueSlider.addEventListener('input', (e) => {
              const value = (e.target as HTMLInputElement).value;
              colorPreview.style.backgroundColor = `hsl(${value}, 100%, 50%)`;
          });

          // Add update color button handler
          const updateColorButton = document.getElementById('updateColorButton');
          if (updateColorButton) {
            console.log('Update color button found');
              updateColorButton.addEventListener('click', () => {
                  const value = hueSlider.value;
                  localStorage.setItem('playerHue', value);
                  console.log('Player hue saved:', value);
                  
                  // Update game state after saving
                  this.playerHue = parseInt(value);
                  this.playerColor = `hsl(${this.playerHue}, 100%, 50%)`;
                  
                  if (this.playerSprite.complete) {
                      this.updateColorPreview();
                  }
                  
                  // Show confirmation message
                  this.showFloatingText(
                      this.canvas.width / 2,
                      50,
                      'Color Updated!',
                      '#4CAF50',
                      20
                  );
              });
          }
      }

      // Wait for sprite to load before initializing
      this.playerSprite.onload = () => {
          console.log('Player sprite loaded successfully');
          this.updateColorPreview();
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

      // Get title screen elements
      this.titleScreen = document.querySelector('.center_text');
      this.nameInput = document.getElementById('nameInput') as HTMLInputElement;

      // Initialize game mode after resource loading
      if (this.isSinglePlayer) {
          this.initSinglePlayerMode();
          this.hideTitleScreen();
      } else {
          this.initMultiPlayerMode();
      }

      // Move authentication to after socket initialization
      this.authenticate();

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

      // Initialize exit button
      this.exitButton = document.getElementById('exitButton');
      this.exitButtonContainer = document.getElementById('exitButtonContainer');
      
      // Add exit button click handler
      this.exitButton?.addEventListener('click', () => this.handleExit());
  }

  private authenticate() {
      // Get credentials from AuthUI or localStorage
      const credentials = {
          username: localStorage.getItem('username') || 'player1',
          password: localStorage.getItem('password') || 'password123',
          playerName: this.nameInput?.value || 'Anonymous'
      };

      this.socket.emit('authenticate', credentials);

      this.socket.on('authenticated', (response: { success: boolean; error?: string; player?: any }) => {
          if (response.success) {
              console.log('Authentication successful');
              if (response.player) {
                if (this.socket.id) {
                    // Update player data with saved progress
                    const player = this.players.get(this.socket.id);
                    if (player) {
                          Object.assign(player, response.player);
                    }
                }
              }
          } else {
              console.error('Authentication failed:', response.error);
              alert('Authentication failed: ' + response.error);
              localStorage.removeItem('currentUser');
              window.location.reload();
          }
      });
  }

  private initSinglePlayerMode() {
      console.log('Initializing single player mode');
      try {
          // Create inline worker with the worker code

          // Create worker from blob
          this.worker = new Worker(URL.createObjectURL(workerBlob));
          
          // Load saved progress
          const savedProgress = this.loadPlayerProgress();
          console.log('Loaded saved progress:', savedProgress);

          // Create mock socket
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

          // Use mock socket
          this.socket = mockSocket as any;

          // Set up socket listeners
          this.setupSocketListeners();

          // Handle worker messages
          this.worker.onmessage = (event) => {
              const { type, event: socketEvent, data } = event.data;
              //console.log('Received message from worker:', type, socketEvent, data);
              
              if (type === 'socketEvent') {
                  const handler = this.socketHandlers.get(socketEvent);
                  if (handler) {
                      handler(data);
                  }
              }
          };

          // Initialize game
          console.log('Sending init message to worker with saved progress');
          this.worker.postMessage({
            type: 'init',
            savedProgress: {
                level: savedProgress['level'],
                xp: savedProgress['xp'],
                maxHealth: savedProgress['maxHealth'],
                damage: savedProgress['damage']
            }
        });

      } catch (error) {
          console.error('Error initializing worker:', error);
      }

      this.showExitButton();
  }

  private initMultiPlayerMode() {
      this.socket = io(prompt("Enter the server URL eg https://localhost:3000: \n Join a public server: https://54.151.123.177:3000/") || "", { 
          secure: true,
          rejectUnauthorized: false,
          withCredentials: true
      });

      this.socket.on('connect', () => {
          this.hideTitleScreen();
          this.showExitButton();
      });

      this.setupSocketListeners();
  }

  private setupSocketListeners() {
      this.socket.on('connect', () => {
          //console.log('Connected to server with ID:', this.socket.id);
      });

      this.socket.on('currentPlayers', (players: Record<string, Player>) => {
          //console.log('Received current players:', players);
          this.players.clear();
          Object.values(players).forEach(player => {
              this.players.set(player.id, {...player, imageLoaded: true, score: 0, velocityX: 0, velocityY: 0, health: this.PLAYER_MAX_HEALTH});
          });
      });

      this.socket.on('newPlayer', (player: Player) => {
          //console.log('New player joined:', player);
          this.players.set(player.id, {...player, imageLoaded: true, score: 0, velocityX: 0, velocityY: 0, health: this.PLAYER_MAX_HEALTH});
      });

      this.socket.on('playerMoved', (player: Player) => {
          //console.log('Player moved:', player);
          const existingPlayer = this.players.get(player.id);
          if (existingPlayer) {
              Object.assign(existingPlayer, player);
      } else {
              this.players.set(player.id, {...player, imageLoaded: true, score: 0, velocityX: 0, velocityY: 0, health: this.PLAYER_MAX_HEALTH});
          }
      });

      this.socket.on('playerDisconnected', (playerId: string) => {
          //console.log('Player disconnected:', playerId);
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
          //console.log('XP gained:', data);  // Add logging
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
          //console.log('Level up:', data);  // Add logging
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
          //console.log('Player lost level:', data);
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

      // Add hitbox toggle with 'H' key
      document.addEventListener('keydown', (event) => {
          if (event.key === 'h' || event.key === 'H') {
              this.showHitboxes = !this.showHitboxes;
              this.showFloatingText(
                  this.canvas.width / 2,
                  50,
                  `Hitboxes: ${this.showHitboxes ? 'ON' : 'OFF'}`,
                  '#FFFFFF',
                  20
              );
          }
      });

      // Add name input change listener
      this.nameInput?.addEventListener('change', () => {
          if (this.socket && this.nameInput) {
              this.socket.emit('updateName', this.nameInput.value);
          }
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
          const currentSocketId = this.socket?.id;
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

          // Draw decorations (palm trees)
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

          // Draw players
          this.players.forEach((player, id) => {
              this.ctx.save();
              this.ctx.translate(player.x, player.y);
              this.ctx.rotate(player.angle);
              
              // Apply hue rotation if it's the current player
              if (id === this.socket?.id) {
                  const offscreen = document.createElement('canvas');
                  offscreen.width = this.playerSprite.width;
                  offscreen.height = this.playerSprite.height;
                  const offCtx = offscreen.getContext('2d')!;
                  
                  offCtx.drawImage(this.playerSprite, 0, 0);
                  const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
                  this.applyHueRotation(offCtx, imageData);
                  offCtx.putImageData(imageData, 0, 0);
                  
                  this.ctx.drawImage(
                      offscreen,
                      -this.playerSprite.width / 2,
                      -this.playerSprite.height / 2
                  );
              } else {
                  this.ctx.drawImage(
                      this.playerSprite,
                      -this.playerSprite.width / 2,
                      -this.playerSprite.height / 2
                  );
              }
              
              this.ctx.restore();

              // Draw player name above player
              this.ctx.fillStyle = 'white';
              this.ctx.strokeStyle = 'black';
              this.ctx.lineWidth = 2;
              this.ctx.font = '16px Arial';
              this.ctx.textAlign = 'center';
              const nameText = player.name || 'Anonymous';
              
              // Draw text stroke
              this.ctx.strokeText(nameText, player.x, player.y - 50);
              // Draw text fill
              this.ctx.fillText(nameText, player.x, player.y - 50);

              // Draw stats on the left side if this is the current player
              if (id === this.socket?.id) {
                  // Save the current transform
                  this.ctx.save();
                  
                  // Reset transform for UI elements
                  this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                  
                  const statsX = 20;  // Distance from left edge
                  const statsY = 100; // Distance from top
                  const barWidth = 200; // Wider bars
                  const barHeight = 20; // Taller bars
                  const spacing = 30;  // Space between elements

                  // Draw health bar
                  this.ctx.fillStyle = 'black';
                  this.ctx.fillRect(statsX, statsY, barWidth, barHeight);
                  this.ctx.fillStyle = 'lime';
                  this.ctx.fillRect(statsX, statsY, barWidth * (player.health / player.maxHealth), barHeight);
                  
                  // Draw health text
                  this.ctx.fillStyle = 'white';
                  this.ctx.font = '16px Arial';
                  this.ctx.textAlign = 'left';
                  this.ctx.fillText(`Health: ${Math.round(player.health)}/${player.maxHealth}`, statsX + 5, statsY + 15);

                  // Draw XP bar
                  if (player.level < this.MAX_LEVEL) {
                      this.ctx.fillStyle = '#4169E1';
                      this.ctx.fillRect(statsX, statsY + spacing, barWidth, barHeight);
                      this.ctx.fillStyle = '#00FFFF';
                      this.ctx.fillRect(statsX, statsY + spacing, barWidth * (player.xp / player.xpToNextLevel), barHeight);
                      
                      // Draw XP text
                      this.ctx.fillStyle = 'white';
                      this.ctx.fillText(`XP: ${player.xp}/${player.xpToNextLevel}`, statsX + 5, statsY + spacing + 15);
                  }

                  // Draw level
                  this.ctx.fillStyle = '#FFD700';
                  this.ctx.font = '20px Arial';
                  this.ctx.fillText(`Level ${player.level}`, statsX, statsY - 10);

                  // Restore the transform
                  this.ctx.restore();
              }
          });

          // Draw enemies
          this.enemies.forEach(enemy => {
              const sizeMultiplier = this.ENEMY_SIZE_MULTIPLIERS[enemy.tier];
              const enemySize = 40 * sizeMultiplier;  // Base size * multiplier
              
              this.ctx.save();
              this.ctx.translate(enemy.x, enemy.y);
              this.ctx.rotate(enemy.angle);
              
              // Draw hitbox if enabled
              if (this.showHitboxes) {
                  this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';  // Semi-transparent red
                  this.ctx.lineWidth = 2;
                  
                  // Draw rectangular hitbox
                  this.ctx.strokeRect(-enemySize/2, -enemySize/2, enemySize, enemySize);
                  
                  // Draw center point
                  this.ctx.beginPath();
                  this.ctx.arc(0, 0, 2, 0, Math.PI * 2);
                  this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';  // Yellow dot for center
                  this.ctx.fill();
                  
                  // Draw hitbox dimensions
                  this.ctx.fillStyle = 'white';
                  this.ctx.font = '12px Arial';
                  this.ctx.fillText(`${Math.round(enemySize)}x${Math.round(enemySize)}`, 0, enemySize/2 + 20);
              }

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
              this.ctx.fillStyle = 'black';
              this.ctx.fillRect(enemy.x - healthBarWidth/2, enemy.y - enemySize/2 - 10, healthBarWidth, 5);
              this.ctx.fillStyle = 'lime';
              this.ctx.fillRect(enemy.x - healthBarWidth/2, enemy.y - enemySize/2 - 10, healthBarWidth * (enemy.health / maxHealth), 5);
              
              // Tier text
              this.ctx.fillStyle = 'white';
              this.ctx.font = (12 * sizeMultiplier) + 'px Arial';
              this.ctx.fillText(enemy.tier.toUpperCase(), enemy.x - healthBarWidth/2, enemy.y + enemySize/2 + 15);
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
     // console.log('Canvas resized to:', this.canvas.width, 'x', this.canvas.height);
  }

  public cleanup() {
      // Save progress before cleanup if in single player mode
      if (this.isSinglePlayer && this.socket?.id) {
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

      // Reset and show title screen elements
      if (this.titleScreen) {
          this.titleScreen.style.display = 'flex';
          this.titleScreen.style.opacity = '1';
          this.titleScreen.style.zIndex = '1000';
      }
      if (this.nameInput) {
          this.nameInput.style.display = 'block';
          this.nameInput.style.opacity = '1';
      }

      // Hide exit button
      this.hideExitButton();

      // Show and reset game menu
      const gameMenu = document.getElementById('gameMenu');
      if (gameMenu) {
          gameMenu.style.display = 'flex';
          gameMenu.style.opacity = '1';
          gameMenu.style.zIndex = '3000';
      }

      // Reset canvas state
      this.canvas.style.zIndex = '0';
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

  private hideTitleScreen() {
      if (this.titleScreen) {
          this.titleScreen.style.display = 'none';
          this.titleScreen.style.opacity = '0';
      }
      if (this.nameInput) {
          this.nameInput.style.display = 'none';
          this.nameInput.style.opacity = '0';
      }
      // Hide game menu when game starts
      const gameMenu = document.getElementById('gameMenu');
      if (gameMenu) {
          gameMenu.style.display = 'none';
          gameMenu.style.opacity = '0';
      }

      // Ensure canvas is visible
      this.canvas.style.zIndex = '1';
  }

  private showExitButton() {
      if (this.exitButtonContainer) {
          this.exitButtonContainer.style.display = 'block';
      }
  }

  private hideExitButton() {
      if (this.exitButtonContainer) {
          this.exitButtonContainer.style.display = 'none';
      }
  }

  private handleExit() {
      // Clean up game state
      this.cleanup();
      
      // Show title screen elements
      if (this.titleScreen) {
          this.titleScreen.style.display = 'flex';
          this.titleScreen.style.opacity = '1';
          this.titleScreen.style.zIndex = '1000';
      }
      if (this.nameInput) {
          this.nameInput.style.display = 'block';
          this.nameInput.style.opacity = '1';
      }

      // Hide exit button
      this.hideExitButton();

      // Show game menu with proper styling
      const gameMenu = document.getElementById('gameMenu');
      if (gameMenu) {
          gameMenu.style.display = 'flex';
          gameMenu.style.opacity = '1';
          gameMenu.style.zIndex = '3000';
      }

      // Clear the canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Reset canvas visibility
      this.canvas.style.zIndex = '0';
  }

  private applyHueRotation(ctx: CanvasRenderingContext2D, imageData: ImageData): void {
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
          // Skip fully transparent pixels
          if (data[i + 3] === 0) continue;
          
          // Convert RGB to HSL
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          let h, s, l = (max + min) / 2;
          
          if (max === min) {
              h = s = 0; // achromatic
          } else {
              const d = max - min;
              s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
              switch (max) {
                  case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                  case g: h = (b - r) / d + 2; break;
                  case b: h = (r - g) / d + 4; break;
                  default: h = 0;
              }
              h /= 6;
          }
          
          // Only adjust hue if the pixel has some saturation
          if (s > 0.1) {  // Threshold for considering a pixel colored
              h = (h + this.playerHue / 360) % 1;
              
              // Convert back to RGB
              if (s === 0) {
                  data[i] = data[i + 1] = data[i + 2] = l * 255;
              } else {
                  const hue2rgb = (p: number, q: number, t: number) => {
                      if (t < 0) t += 1;
                      if (t > 1) t -= 1;
                      if (t < 1/6) return p + (q - p) * 6 * t;
                      if (t < 1/2) return q;
                      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                      return p;
                  };
                  
                  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                  const p = 2 * l - q;
                  
                  data[i] = hue2rgb(p, q, h + 1/3) * 255;
                  data[i + 1] = hue2rgb(p, q, h) * 255;
                  data[i + 2] = hue2rgb(p, q, h - 1/3) * 255;
              }
          }
      }
  }

  private updateColorPreview() {
      if (!this.playerSprite.complete) return;

      const ctx = this.colorPreviewCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, this.colorPreviewCanvas.width, this.colorPreviewCanvas.height);
      
      // Draw the sprite centered in the preview
      const scale = Math.min(
          this.colorPreviewCanvas.width / this.playerSprite.width,
          this.colorPreviewCanvas.height / this.playerSprite.height
      );
      
      const x = (this.colorPreviewCanvas.width - this.playerSprite.width * scale) / 2;
      const y = (this.colorPreviewCanvas.height - this.playerSprite.height * scale) / 2;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.drawImage(this.playerSprite, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, this.colorPreviewCanvas.width, this.colorPreviewCanvas.height);
      this.applyHueRotation(ctx, imageData);
      ctx.putImageData(imageData, 0, 0);
      ctx.restore();
  }
}