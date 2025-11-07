import * as Dom from './dom.js';
import { 
    GROUND_Y, 
    WORLD_WIDTH, 
    GRASS_HEIGHT, 
    DIRT_HEIGHT, 
    STONE_HEIGHT, 
    WORLD_TOP_Y, 
    WORLD_LEFT_X,
    WORLD_RIGHT_X,
    WORLD_BOTTOM_Y // Добавлен импорт, если понадобится, но текущая логика его не использует
} from './game_config.js';

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
    const { scale, viewOffset, render } = cameraData; // Получаем объект render для размеров canvas
    const context = Dom.backgroundContext;

    // Очищаем холст
    context.clearRect(0, 0, Dom.backgroundCanvas.width, Dom.backgroundCanvas.height);
    
    context.save();
    
    // Применяем трансформации камеры (приближение и панорамирование)
    context.scale(1 / scale, 1 / scale);
    context.translate(-viewOffset.x, -viewOffset.y);

    // Вычисляем видимую область в "мировых пикселях"
    const visibleMinX = viewOffset.x;
    const visibleMinY = viewOffset.y;
    const visibleMaxX = viewOffset.x + render.canvas.width * scale;
    const visibleMaxY = viewOffset.y + render.canvas.height * scale;

    // --- Рисуем небо на всю видимую область ---
    const skyGradient = context.createLinearGradient(0, visibleMinY, 0, visibleMaxY);
    skyGradient.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--sky-top').trim());
    skyGradient.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--sky-bottom').trim());
    context.fillStyle = skyGradient;
    context.fillRect(visibleMinX, visibleMinY, visibleMaxX - visibleMinX, visibleMaxY - visibleMinY);


    // --- Рисуем фоновые слои (трава, земля, камень) ---
    const layers = [
        { y: GROUND_Y, height: GRASS_HEIGHT, color: '#6b8e23' }, // Трава
        { y: GROUND_Y + GRASS_HEIGHT, height: DIRT_HEIGHT, color: '#8b4513' }, // Земля
        { y: GROUND_Y + GRASS_HEIGHT + DIRT_HEIGHT, height: STONE_HEIGHT, color: '#696969' }, // Камень
    ];

    layers.forEach(layer => {
        // Ограничиваем отрисовку слоев границами мира (WORLD_LEFT_X, WORLD_RIGHT_X)
        const drawX = Math.max(WORLD_LEFT_X, visibleMinX);
        const drawWidth = Math.min(WORLD_RIGHT_X, visibleMaxX) - drawX;
        
        if (drawWidth > 0) { // Отрисовываем только если есть видимая часть
            context.fillStyle = layer.color;
            context.fillRect(drawX, layer.y, drawWidth, layer.height);
        }
    });

    // --- Рисуем декоративные камни поверх слоя земли ---
    for (const stone of decorativeStones) {
        // Отрисовываем камни только если они находятся в видимой области
        if (stone.x + stone.radius > visibleMinX && stone.x - stone.radius < visibleMaxX &&
            stone.y + stone.radius > visibleMinY && stone.y - stone.radius < visibleMaxY) {
            context.fillStyle = stone.color;
            context.beginPath();
            context.arc(stone.x, stone.y, stone.radius, 0, Math.PI * 2);
            context.fill();
        }
    }

    context.restore();
}