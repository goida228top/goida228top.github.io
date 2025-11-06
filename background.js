import * as Dom from './dom.js';
import { GROUND_Y, WORLD_WIDTH, GRASS_HEIGHT, DIRT_HEIGHT, STONE_HEIGHT, WORLD_TOP_Y, WORLD_LEFT_X, WORLD_RIGHT_X } from './world.js';

// Константы мира теперь импортируются, локальные удалены.

const dirtLayer = {
    y: GROUND_Y + GRASS_HEIGHT,
    height: DIRT_HEIGHT
};

let decorativeStones = [];

function generateStones() {
    const stones = [];
    const stoneCount = 200;
    const dirtTop = dirtLayer.y;
    const stoneColor = '#5a4d41';

    for (let i = 0; i < stoneCount; i++) {
        const radius = 3 + Math.random() * 5;
        const availableHeight = DIRT_HEIGHT - (radius * 2);
        
        if (availableHeight <= 0) continue;

        stones.push({
            x: WORLD_LEFT_X + Math.random() * WORLD_WIDTH,
            y: dirtTop + radius + Math.random() * availableHeight,
            radius: radius,
            color: stoneColor,
        });
    }
    return stones;
}

export function initializeBackground() {
    decorativeStones = generateStones();
}

export function renderBackground(cameraData) {
    const { scale, viewOffset } = cameraData;
    const context = Dom.backgroundContext;

    // Очищаем холст
    context.clearRect(0, 0, Dom.backgroundCanvas.width, Dom.backgroundCanvas.height);
    
    context.save();
    
    // Применяем трансформации камеры (приближение и панорамирование)
    // Порядок важен: сначала масштаб, потом сдвиг.
    context.scale(1 / scale, 1 / scale);
    context.translate(-viewOffset.x, -viewOffset.y);

    // --- Рисуем небо ---
    const skyGradient = context.createLinearGradient(0, WORLD_TOP_Y, 0, GROUND_Y);
    skyGradient.addColorStop(0, '#3a7bd5'); // var(--sky-top)
    skyGradient.addColorStop(1, '#a8d5e5'); // var(--sky-bottom)
    context.fillStyle = skyGradient;
    context.fillRect(WORLD_LEFT_X, WORLD_TOP_Y, WORLD_WIDTH, GROUND_Y - WORLD_TOP_Y);


    // --- Рисуем фоновые слои ---
    const layers = [
        { y: GROUND_Y, height: GRASS_HEIGHT, color: '#6b8e23' }, // Трава
        { y: GROUND_Y + GRASS_HEIGHT, height: DIRT_HEIGHT, color: '#8b4513' }, // Земля
        { y: GROUND_Y + GRASS_HEIGHT + DIRT_HEIGHT, height: STONE_HEIGHT, color: '#696969' }, // Камень
    ];

    layers.forEach(layer => {
        context.fillStyle = layer.color;
        context.fillRect(WORLD_LEFT_X, layer.y, WORLD_WIDTH, layer.height);
    });

    // --- Рисуем декоративные камни поверх слоя земли ---
    for (const stone of decorativeStones) {
        context.fillStyle = stone.color;
        context.beginPath();
        context.arc(stone.x, stone.y, stone.radius, 0, Math.PI * 2);
        context.fill();
    }

    context.restore();
}