// @ts-nocheck


import planck from './planck.js';
import * as Dom from './dom.js';
import { toolState, selectBody, deselectBody } from './selection.js';
import { spawnWaterParticle } from './water.js';
import { showObjectPropertiesPanel, hideObjectPropertiesPanel } from './ui.js';
import { addExplosionEffect } from './engine.js';
import { tntTypes } from './tnt_textures.js'; // Импортируем tntTypes из нового файла
import { ImageLoader } from './image_loader.js'; // Импортируем ImageLoader
import { 
    PHYSICS_SCALE,
    TOOL_SETTINGS,
    WATER_VISUAL_RADIUS,
    WATER_PHYSICAL_RADIUS_FACTOR,
    WATER_INTERACTION_RADIUS_FACTOR, // Добавлен импорт, хотя используется только в water.js
} from './game_config.js';

// Состояния инструментов
let mouseJoint = null;
let ground = null; // Тело для привязки MouseJoint
let draggedBody = null; // Для инструмента "Переместить"

let isDrawing = false;
let startPoint = planck.Vec2(0, 0);
let lastMousePos = planck.Vec2(0, 0);

// Для полигонов
let polygonVertices = [];

// Для кисти
let lastBrushPoint = null;
const BRUSH_RADIUS = TOOL_SETTINGS.brush.radius; // Радиус кисти в пикселях

let waterSpawnInterval = null;

// Константы для спавна воды, дублируют значения из water.js для согласованности
const PHYSICAL_RADIUS = (WATER_VISUAL_RADIUS * WATER_PHYSICAL_RADIUS_FACTOR) / PHYSICS_SCALE;

// Глобальная карта для кэширования загруженных изображений текстур ТНТ - УДАЛЕНО

/**
 * Загружает текстуру ТНТ из URL или возвращает уже загруженную.
 * @param {string} type - Тип ТНТ ('small', 'medium', 'large').
 * @param {string} imageUrl - URL изображения.
 * @returns {Promise<HTMLImageElement | null>} - Промис, разрешающийся в объект Image или null в случае ошибки.
 */
// loadTntTexture функция удалена, используем ImageLoader.getImage напрямую


// --- Объявляем функции взрыва заранее для корректной работы ---
let createExplosion;
let detonateTNT;

// --- Логика взрывов ---

/**
 * Безопасно детонирует один блок ТНТ.
 * @param {import('planck-js').World} world
 * @param {import('planock-js').Body} body
 */
detonateTNT = function(world, body) {
    // Проверяем, существует ли тело в мире, чтобы избежать ошибок при цепной реакции
    if (!body || !body.getWorld()) {
        return;
    }
    const userData = body.getUserData() || {};
    const type = userData.tntType || 'small'; // По умолчанию - малый ТНТ
    
    // Получаем параметры ТНТ из TOOL_SETTINGS
    const tntConfig = TOOL_SETTINGS.tnt[type];
    const explosionPower = tntConfig.power; 
    const explosionRadius = tntConfig.explosionRadius;

    const explosionCenter = body.getPosition();
    try {
        world.destroyBody(body);
    } catch (e) {
        console.warn("Попытка уничтожить уже уничтоженное тело.");
        return;
    }
    // Создаем взрыв на месте ТНТ
    createExplosion(world, explosionCenter, explosionRadius, explosionPower);
};

/**
 * Создает визуальный и физический эффект взрыва.
 * @param {import('planck-js').World} world
 * @param {import('planock-js').Vec2} center - Центр взрыва в метрах.
 * @param {number} radius - Радиус взрыва в метрах.
 * @param {number} power - Сила взрыва.
 */
createExplosion = function(world, center, radius, power) {
    addExplosionEffect(center, radius, 400);

    const aabb = new planck.AABB(
        center.clone().sub(planck.Vec2(radius, radius)),
        center.clone().add(planck.Vec2(radius, radius))
    );
    
    // Используем Set, чтобы избежать повторной детонации одного и того же ТНТ
    const tntsToDetonate = new Set();

    world.queryAABB(aabb, (fixture) => {
        const body = fixture.getBody();
        const userData = body.getUserData() || {};

        // Если это другой ТНТ, добавляем его в очередь на детонацию
        if (userData.label === 'tnt') {
            tntsToDetonate.add(body);
            return true; // Продолжаем поиск
        }

        if (!body.isDynamic()) {
            return true; // Пропускаем статические объекты
        }

        const bodyPos = body.getPosition();
        const direction = planck.Vec2.sub(bodyPos, center);
        const distance = direction.length();

        if (distance < 0.1 || distance > radius) {
            return true; // Слишком близко или слишком далеко
        }

        direction.normalize();

        const falloff = 1 - (distance / radius); // Сила уменьшается с расстоянием
        const impulseMagnitude = power * falloff; 
        
        const impulse = direction.mul(impulseMagnitude);
        body.applyLinearImpulse(impulse, bodyPos, true);
        body.setAwake(true);

        return true; // Продолжаем поиск
    });
    
    // Детонируем все найденные ТНТ с небольшой задержкой для эффекта каскада
    tntsToDetonate.forEach(bodyToDetonate => {
        setTimeout(() => detonateTNT(world, bodyToDetonate), 50 + Math.random() * 100);
    });
};


export async function initializeTools(engineData, cameraData, worldData) {
    const { world, render } = engineData;
    const { getMousePos, isPanning } = cameraData;

    ground = world.createBody();

    // Предварительная загрузка текстур ТНТ - УДАЛЕНО, теперь это делается централизованно через ImageLoader
    // await Promise.all([
    //     loadTntTexture('small', tntTypes.small.textureUrl),
    //     loadTntTexture('medium', tntTypes.medium.textureUrl),
    //     loadTntTexture('large', tntTypes.large.textureUrl),
    // ]);

    Dom.container.addEventListener('mousedown', handleMouseDown);
    Dom.container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    Dom.container.addEventListener('contextmenu', handleContextMenu);
    Dom.container.addEventListener('dblclick', handleDoubleClick);
    Dom.container.addEventListener('mouseleave', stopAllActions);

    function handleMouseDown(e) {
        if (isPanning() || e.target !== render.canvas) return;

        startPoint = getMousePos(e); // в метрах
        lastMousePos = startPoint;
        isDrawing = true;

        switch (toolState.currentTool) {
            case 'move':
            case 'finger':
                const bodyToDrag = getBodyAt(world, startPoint);
                if (bodyToDrag) {
                    bodyToDrag.setAwake(true);
                    if (toolState.currentTool === 'finger') {
                        const jointDef = {
                            bodyA: ground,
                            bodyB: bodyToDrag,
                            target: startPoint,
                            maxForce: 1000.0 * bodyToDrag.getMass(),
                            frequencyHz: 5.0,
                            dampingRatio: 0.9,
                        };
                        mouseJoint = world.createJoint(planck.MouseJoint(jointDef));
                    } else { // 'move' tool
                        draggedBody = bodyToDrag;
                    }
                }
                break;
            case 'water':
                spawnWaterCluster(world, startPoint.x, startPoint.y);
                if (waterSpawnInterval) clearInterval(waterSpawnInterval);
                waterSpawnInterval = setInterval(() => {
                    spawnWaterCluster(world, lastMousePos.x, lastMousePos.y);
                }, 30);
                break;
            case 'tnt-small':
                createTNT(world, startPoint, 'small');
                isDrawing = false;
                break;
            case 'tnt-medium':
                createTNT(world, startPoint, 'medium');
                isDrawing = false;
                break;
            case 'tnt-large':
                createTNT(world, startPoint, 'large');
                isDrawing = false;
                break;
            case 'eraser':
                eraseAt(world, startPoint);
                break;
            case 'polygon':
                polygonVertices.push(startPoint.clone());
                break;
            case 'brush':
                createBrushSegment(world, startPoint);
                lastBrushPoint = startPoint;
                break;
        }
    }

    function handleMouseMove(e) {
        if (isPanning()) return;
        const currentPos = getMousePos(e); // в метрах
        lastMousePos = currentPos;

        if (mouseJoint) {
            mouseJoint.setTarget(currentPos);
        }
        if (draggedBody) {
             draggedBody.setPosition(currentPos);
        }

        if (!isDrawing) return;

        switch (toolState.currentTool) {
            case 'eraser':
                eraseAt(world, currentPos);
                break;
            case 'brush':
                continueBrushStroke(world, currentPos);
                break;
        }
    }

    function handleMouseUp(e) {
        if (waterSpawnInterval) {
            clearInterval(waterSpawnInterval);
            waterSpawnInterval = null;
        }
        if (mouseJoint) {
            world.destroyJoint(mouseJoint);
            mouseJoint = null;
        }
        if (draggedBody) {
            draggedBody.setLinearVelocity(planck.Vec2(0, 0));
            draggedBody.setAngularVelocity(0);
            draggedBody = null;
        }
        if (isDrawing) {
            const endPoint = getMousePos(e); // в метрах
            switch (toolState.currentTool) {
                case 'box':
                    createBox(world, startPoint, endPoint);
                    break;
                case 'brush':
                    lastBrushPoint = null;
                    break;
            }
            isDrawing = false;
        }
    }

    function handleDoubleClick(e) {
        if (toolState.currentTool === 'polygon' && polygonVertices.length > 2) {
            createPolygon(world, polygonVertices);
            polygonVertices = [];
            return;
        }
        
        const worldPos = getMousePos(e);
        const body = getBodyAt(world, worldPos);

        if (body && body.getUserData() && body.getUserData().label === 'tnt') {
            detonateTNT(world, body);
        }
    }
    
    function stopAllActions() {
        if (waterSpawnInterval) clearInterval(waterSpawnInterval);
        if (mouseJoint) {
            world.destroyJoint(mouseJoint);
            mouseJoint = null;
        }
        draggedBody = null;
        isDrawing = false;
        polygonVertices = [];
        lastBrushPoint = null;
    }

    function handleContextMenu(e) {
        e.preventDefault();
        const worldPos = getMousePos(e); // в метрах
        
        let clickedBody = getBodyAt(world, worldPos);

        if (clickedBody) {
            const userData = clickedBody.getUserData() || {};
             if (userData.label === 'boundary' || userData.label === 'water') {
                clickedBody = null;
             }
        }

        if (clickedBody) {
            selectBody(clickedBody);
            showObjectPropertiesPanel(clickedBody, e.clientX, e.clientY);
        } else {
            deselectBody();
            hideObjectPropertiesPanel();
            if (toolState.currentTool === 'polygon') {
                polygonVertices = [];
            }
        }
    }
}


// --- Логика инструментов ---

function createTNT(world, position, type = 'small') {
    const tntProps = tntTypes[type]; 
    const tntConfig = TOOL_SETTINGS.tnt[type]; 
    const textureImage = ImageLoader.getImage(tntProps.textureUrl); // Используем ImageLoader

    // Визуальные размеры объекта в метрах (полный размер для текстуры)
    const visualWidth = tntConfig.baseVisualWidth;
    const visualHeight = tntConfig.baseVisualHeight;

    // Физические размеры (хитбокс) в метрах, с учетом коэффициентов
    const physicsWidth = visualWidth * tntConfig.hitboxWidthRatio;
    const physicsHeight = visualHeight * tntConfig.hitboxHeightRatio;

    // Смещение центра хитбокса относительно центра визуального объекта
    // Если фитиль слева, то хитбокс смещается вправо
    const hitboxOffsetX = visualWidth * tntConfig.hitboxOffsetXRatio;

    const body = world.createDynamicBody({
        position: position,
        bullet: true,
        userData: {
            label: 'tnt',
            tntType: type,
            hasFuse: true, 
            render: {
                texture: textureImage, // Используем загруженное изображение
                // strokeStyle: tntProps.borderColor || '#aaaaaa', // Обводка у ТНТ не нужна
                width: visualWidth, // Сохраняем визуальные размеры
                height: visualHeight
            }
        }
    });

    const fixtureDef = { density: 1.5, friction: 0.6, restitution: 0.1 };
    
    // Создаем одну бокс-фикстуру для динамитных палок со смещением
    body.createFixture(planck.Box(physicsWidth / 2, physicsHeight / 2, planck.Vec2(hitboxOffsetX, 0)), fixtureDef);
    body.resetMassData();
}


function spawnWaterCluster(world, x, y) {
    const count = 2; // Спавним меньше частиц за раз для уменьшения плотности
    const verticalSpread = PHYSICAL_RADIUS * 2.2; // Разносим их по вертикали, чтобы избежать пересечений
    const jitter = 4 / PHYSICS_SCALE; // Небольшая горизонтальная случайность (в метрах)

    for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * jitter;
        const offsetY = i * verticalSpread;
        // Придаем частицам небольшую начальную скорость вниз, имитируя струю
        const initialVelocity = planck.Vec2(0, 1.0);
        spawnWaterParticle(world, x + offsetX, y + offsetY, initialVelocity);
    }
}

/**
 * Вычисляет плотность для тела на основе его площади,
 * устанавливая минимальную массу для очень маленьких объектов.
 * @param {number} area - Площадь тела в кв. метрах.
 * @returns {number} - Расчетная плотность.
 */
function getDensityForArea(area) {
    const MIN_BODY_MASS = TOOL_SETTINGS.density.minMass;
    const NORMAL_DENSITY = TOOL_SETTINGS.density.normal;
    
    // Пороговое значение площади, ниже которого масса становится фиксированной
    const AREA_THRESHOLD = MIN_BODY_MASS / NORMAL_DENSITY;

    if (area > 0 && area < AREA_THRESHOLD) {
        // Для маленьких объектов плотность рассчитывается так, чтобы их масса была равна MIN_BODY_MASS
        return MIN_BODY_MASS / area;
    }
    
    return NORMAL_DENSITY;
}


function createBox(world, start, end) {
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    // Проверяем минимальный размер в метрах (эквивалент 5 пикселей)
    if (width < 5 / PHYSICS_SCALE || height < 5 / PHYSICS_SCALE) return;

    const area = width * height;
    const density = getDensityForArea(area);

    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;

    const body = world.createDynamicBody({
        position: planck.Vec2(centerX, centerY),
        bullet: true,
        userData: {
            label: 'box',
            render: { fillStyle: '#cccccc', strokeStyle: '#aaaaaa' }
        }
    });

    body.createFixture(planck.Box(width / 2, height / 2), {
        friction: 0.3,
        restitution: 0.1,
        density: density,
    });
}

/**
 * Вычисляет площадь простого многоугольника по его вершинам (формула шнурков).
 * @param {planck.Vec2[]} vertices 
 * @returns {number}
 */
function getPolygonArea(vertices) {
    let area = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % n]; // Замыкаем последнюю вершину с первой
        area += v1.x * v2.y - v2.x * v1.y;
    }
    return Math.abs(area) / 2;
}


function createPolygon(world, vertices) {
    if (vertices.length < 3) return;
    
    const center = planck.Vec2.zero();
    vertices.forEach(v => center.add(v));
    center.mul(1 / vertices.length);

    const localVertices = vertices.map(v => v.clone().sub(center));

    const area = getPolygonArea(localVertices);
    const density = getDensityForArea(area);
    
    const body = world.createDynamicBody({
        position: center,
        bullet: true,
        userData: {
            label: 'polygon',
            render: { fillStyle: '#cccccc', strokeStyle: '#aaaaaa' }
        }
    });

    try {
        body.createFixture(planck.Polygon(localVertices), {
            friction: 0.3,
            restitution: 0.1,
            density: density,
        });
    } catch(e) {
        console.error("Failed to create polygon fixture:", e);
        world.destroyBody(body);
    }
}

function createBrushSegment(world, position) {
    const body = world.createBody({
        position: position,
        type: 'static',
        userData: {
            label: 'user-static',
            render: { fillStyle: '#8b4513', strokeStyle: '#6a3503' }
        }
    });
    body.createFixture(planck.Circle(BRUSH_RADIUS / PHYSICS_SCALE), { friction: 0.3 });
}

function continueBrushStroke(world, position) {
    if (!lastBrushPoint) return;
    const distanceVec = position.clone().sub(lastBrushPoint);
    const distance = distanceVec.length();
    
    const minDistance = (BRUSH_RADIUS / PHYSICS_SCALE) / 2;
    if (distance < minDistance) return;

    const angle = Math.atan2(distanceVec.y, distanceVec.x);

    for (let i = 0; i < distance; i += minDistance) {
        const x = lastBrushPoint.x + Math.cos(angle) * i;
        const y = lastBrushPoint.y + Math.sin(angle) * i;
        createBrushSegment(world, planck.Vec2(x, y));
    }
    lastBrushPoint = position;
}

function eraseAt(world, position) {
     const aabb = new planck.AABB(position, position);
     world.queryAABB(aabb, (fixture) => {
         const body = fixture.getBody();
         const userData = body.getUserData() || {};
         if (userData.label !== 'boundary' && fixture.testPoint(position)) {
              if (userData.label === 'water') {
                // ОПТИМИЗАЦИЯ: Деактивируем частицу, возвращая ее в пул, вместо уничтожения.
                body.setActive(false);
              } else {
                // Другие динамические объекты уничтожаем как и раньше.
                world.destroyBody(body);
              }
         }
         return true; // Продолжаем поиск, чтобы стереть несколько объектов за раз.
     });
}

function getBodyAt(world, point) {
    let foundBody = null;
    const aabb = new planck.AABB(point, point);
    world.queryAABB(aabb, (fixture) => {
        if (fixture.testPoint(point)) {
            foundBody = fixture.getBody();
            return false; // нашли, прекращаем поиск
        }
        return true; // продолжаем поиск
    });
    return foundBody;
}