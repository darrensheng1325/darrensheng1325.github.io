"use strict";
const WORLD_WIDTH = 10000;
const WORLD_HEIGHT = 2000;
// ... rest of your worker code ...
// Worker message handler
self.onmessage = (event) => {
    const { type, event: socketEvent, data } = event.data;
    console.log('Worker received message:', type, data);
    switch (type) {
        case 'init':
            initializeGame(event.data);
            break;
        case 'socketEvent':
            // ... rest of your handler code ...
            break;
    }
};
setInterval(() => {
    moveEnemies();
    mockIo.emit('enemiesUpdate', enemies);
}, 100);
