// @ts-nocheck


import planck from './planck.js';
import * as Dom from './dom.js';
import { drawSelection, drawPreview, toolState } from './selection.js';
import { PHYSICS_SCALE } from './game_config.js';
import { renderWater, updateWaterPhysics } from './water.js'; // Импортируем новую функцию физики воды
import { renderSand } from './sand.js'; // Импортируем функции для песка, но updateSandPhysics больше не нужна
import { keyState } from './ui.js'; // Импортируем состояние клавиш для моторов
import { SoundManager } from './sound.js'; // Импорт менеджера звуков

let isPaused = false;
let cameraData = null;
let beforeRenderCallback = () => {};
let activeExplosions = [];

// Новый Path2D для рендеринга иконки сварки (искры)
const weldIconPath = new Path2D('M12 0 L15.5 8.5 L24 12 L15.5 15.5 L12 24 L8.5 15.5 L0 12 L8.5 8.5 Z');

export function addExplosionEffect(positionInMeters, maxRadius = 15, duration = 300) {
    activeExplosions.push({
        pos: positionInMeters,
        maxRadius,
        duration,
        startTime: performance.now()
    });
}

function drawHitbox(context, body, scale) {
    const xf = body.getTransform();
    context.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    context.lineWidth = 1 * scale;

    for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
        const shape = fixture.getShape();
        const shapeType = shape.getType();

        context.beginPath();

        if (shapeType === 'circle') {
            const center = planck.Transform.mulVec2(xf, shape.m_p);
            const radius = shape.m_radius;
            context.arc(
                center.x * PHYSICS_SCALE,
                center.y * PHYSICS_SCALE,
                radius * PHYSICS_SCALE,
                0, 2 * Math.PI
            );
        } else if (shapeType === 'polygon' || shapeType === 'edge') {
            const vertices = shape.m_vertices;
            if (vertices.length > 0) {
                const v0 = planck.Transform.mulVec2(xf, vertices[0]);
                context.moveTo(v0.x * PHYSICS_SCALE, v0.y * PHYSICS_SCALE);
                for (let i = 1; i < vertices.length; i++) {
                    const vi = planck.Transform.mulVec2(xf, vertices[i]);
                    context.lineTo(vi.x * PHYSICS_SCALE, vi.y * PHYSICS_SCALE);
                }
                if (shapeType === 'polygon') {
                    context.closePath();
                }
            }
        }
        context.stroke();
    }
}

/**
 * Рисует зигзагообразную линию, имитирующую пружину.
 * @param {CanvasRenderingContext2D} context 
 * @param {planck.Vec2} p1 - Начальная точка в метрах
 * @param {planck.Vec2} p2 - Конечная точка в метрах
 * @param {number} segments - Количество сегментов
 * @param {number} widthRatio - Отношение ширины пружины к ее длине
 */
function drawSpring(context, p1, p2, segments = 10, widthRatio = 0.2) {
    const p1_px = { x: p1.x * PHYSICS_SCALE, y: p1.y * PHYSICS_SCALE };
    const p2_px = { x: p2.x * PHYSICS_SCALE, y: p2.y * PHYSICS_SCALE };

    const dx = p2_px.x - p1_px.x;
    const dy = p2_px.y - p1_px.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = -dy / dist; // Нормализованный перпендикулярный вектор
    const ny = dx / dist;

    context.beginPath();
    context.moveTo(p1_px.x, p1_px.y);

    const segmentLength = dist / (segments + 1);
    // Ширина пружины адаптируется к её длине, но имеет максимальное значение
    const springWidth = Math.min(dist / 2, segmentLength * 1.5);

    for (let i = 1; i <= segments; i++) {
        const segmentProgress = i / (segments + 1);
        const currentX = p1_px.x + dx * segmentProgress;
        const currentY = p1_px.y + dy * segmentProgress;

        const offsetSign = (i % 2 === 0) ? 1 : -1;
        const offsetX = nx * springWidth * offsetSign;
        const offsetY = ny * springWidth * offsetSign;

        context.lineTo(currentX + offsetX, currentY + offsetY);
    }

    context.lineTo(p2_px.x, p2_px.y);
    context.stroke();
}

// Новая функция для применения сил/импульсов от моторов
function applyMotorForces(world) {
    // Определяем направление вращения на основе нажатых клавиш
    let moveDirection = 0;
    if (keyState.ArrowRight && !keyState.ArrowLeft) {
        moveDirection = 1; // Вперед = вращение по часовой стрелке (положительное)
    } else if (keyState.ArrowLeft && !keyState.ArrowRight) {
        moveDirection = -1; // Назад = вращение против часовой стрелки (отрицательное)
    }
    
    // Если никакая клавиша не нажата, выходим
    if (moveDirection === 0) {
        return;
    }

    // Проходим по всем телам в мире
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData();
        // Если у тела есть включенный мотор
        if (userData?.motor?.isEnabled) {
            const motorSpeed = userData.motor.speed || 10.0;
            const targetAngVel = moveDirection * Math.abs(motorSpeed);
            
            // Применяем импульс, чтобы достичь целевой угловой скорости
            const currentAngVel = body.getAngularVelocity();
            const angVelChange = targetAngVel - currentAngVel;
            const impulse = body.getInertia() * angVelChange;
            body.applyAngularImpulse(impulse, true);
        }
    }
}


// --- Кастомный рендерер для Planck.js ---
function renderWorld(world, render, camera) {
    const context = render.context;
    const { scale, viewOffset } = camera;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    context.save();
    context.scale(1 / scale, 1 / scale);
    context.translate(-viewOffset.x, -viewOffset.y);

    // Теперь мы находимся в "мировых пиксельных" координатах.
    // Физические объекты существуют в "мировых метрических" координатах.
    // Для отрисовки мы должны умножать их координаты и размеры на PHYSICS_SCALE.

    // Отрисовка всех тел
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData() || {};

        if (!body.isActive()) {
            continue;
        }

        if (userData.label === 'water' || userData.label === 'sand' || (userData.render && userData.render.visible === false)) { // NEW: Пропускаем частицы песка
            continue;
        }
        
        const xf = body.getTransform();

        for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
            const shape = fixture.getShape();
            const shapeType = shape.getType();
            
            context.beginPath();

            const renderStyle = userData.render || {};
            let fillStyle = renderStyle.fillStyle || '#cccccc';
            
            // НОВАЯ ЛОГИКА: Отрисовка текстуры, если она есть
            if (renderStyle.texture && shapeType === 'polygon') {
                const bodyPos = body.getPosition();
                const bodyAngle = body.getAngle();
                
                let boxWidthInMeters, boxHeightInMeters;

                // Используем сохраненные размеры для рендеринга, если они есть, иначе используем размеры физического тела
                if (renderStyle.width && renderStyle.height) {
                    boxWidthInMeters = renderStyle.width;
                    boxHeightInMeters = renderStyle.height;
                } else {
                    // Fallback для объектов без явно заданных размеров
                    const vertices = shape.m_vertices;
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                    for(let i = 0; i < vertices.length; i++) {
                        minX = Math.min(minX, vertices[i].x);
                        maxX = Math.max(maxX, vertices[i].x);
                        minY = Math.min(minY, vertices[i].y);
                        maxY = Math.max(maxY, vertices[i].y);
                    }
                    boxWidthInMeters = maxX - minX;
                    boxHeightInMeters = maxY - minY;
                }

                const boxWidthPx = boxWidthInMeters * PHYSICS_SCALE;
                const boxHeightPx = boxHeightInMeters * PHYSICS_SCALE;

                const texture = renderStyle.texture;
                const textureAspectRatio = texture.naturalWidth / texture.naturalHeight;
                const boxAspectRatio = boxWidthInMeters / boxHeightInMeters;

                let drawWidth = boxWidthPx;
                let drawHeight = boxHeightPx;

                if (textureAspectRatio > boxAspectRatio) {
                    // Текстура шире, чем физический бокс, масштабируем по ширине
                    drawHeight = boxWidthPx / textureAspectRatio;
                } else {
                    // Текстура выше, чем физический бокс, масштабируем по высоте
                    drawWidth = boxHeightPx * textureAspectRatio;
                }

                const offsetX = (boxWidthPx - drawWidth) / 2;
                const offsetY = (boxHeightPx - drawHeight) / 2;

                context.save();
                context.translate(bodyPos.x * PHYSICS_SCALE, bodyPos.y * PHYSICS_SCALE);
                context.rotate(bodyAngle);

                context.drawImage(
                    texture,
                    -boxWidthPx / 2 + offsetX, 
                    -boxHeightPx / 2 + offsetY, 
                    drawWidth,
                    drawHeight
                );

                context.restore();
            } else {
                // Существующая логика отрисовки для сплошных цветов
                context.fillStyle = fillStyle;
                
                if (shapeType === 'circle') {
                    const center = planck.Transform.mulVec2(xf, shape.m_p);
                    const radius = shape.m_radius;
                    context.arc(
                        center.x * PHYSICS_SCALE, 
                        center.y * PHYSICS_SCALE, 
                        radius * PHYSICS_SCALE, 
                        0, 2 * Math.PI
                    );

                } else if (shapeType === 'polygon' || shapeType === 'edge') {
                    const vertices = shape.m_vertices;
                    if (vertices.length > 0) {
                        const v0 = planck.Transform.mulVec2(xf, vertices[0]);
                        context.moveTo(v0.x * PHYSICS_SCALE, v0.y * PHYSICS_SCALE);
                        for (let i = 1; i < vertices.length; i++) {
                             const vi = planck.Transform.mulVec2(xf, vertices[i]);
                            context.lineTo(vi.x * PHYSICS_SCALE, vi.y * PHYSICS_SCALE);
                        }
                        if (shapeType === 'polygon') {
                             context.closePath();
                        }
                    }
                }
                
                if (body.getType() !== 'static' || (userData.render && userData.render.fillStyle)) {
                     context.fill();
                }
            }
        }

        if (render.options.showHitboxes) {
            drawHitbox(context, body, scale);
        }
    }
    
    // Отрисовка соединений
    for (let joint = world.getJointList(); joint; joint = joint.getNext()) {
        const bodyA = joint.getBodyA();
        const bodyB = joint.getBodyB();

        if (!bodyA.isActive() && !bodyB.isActive()) continue;
        
        // --- Отрисовка ПРУЖИН и СТЕРЖНЕЙ ---
        if (joint.getType() === 'distance-joint') {
            const jointData = joint.getUserData() || {};
            const p1 = joint.getAnchorA();
            const p2 = joint.getAnchorB();
            
            // Если соединение выбрано, рисуем его выделенным
            if (toolState.selectedSpring === joint) {
                context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--selection-color').trim() || '#ffffff';
                context.lineWidth = 2.5;
                context.globalAlpha = 0.9;
            } else {
                context.strokeStyle = '#dddddd';
                context.lineWidth = 1.5;
                context.globalAlpha = 0.7;
            }

            // Рендерим в зависимости от типа, сохраненного в userData
            if (jointData.tool === 'rod') {
                const p1_px = { x: p1.x * PHYSICS_SCALE, y: p1.y * PHYSICS_SCALE };
                const p2_px = { x: p2.x * PHYSICS_SCALE, y: p2.y * PHYSICS_SCALE };
                context.beginPath();
                context.moveTo(p1_px.x, p1_px.y);
                context.lineTo(p2_px.x, p2_px.y);
                context.stroke();
            } else { // По умолчанию рисуем как пружину
                drawSpring(context, p1, p2);
            }
            context.globalAlpha = 1.0; // Сбрасываем alpha
        }
        
        // --- Отрисовка СВАРКИ ---
        else if (joint.getType() === 'weld-joint') {
            const posA = bodyA.getPosition();
            const posB = bodyB.getPosition();
            
            const midX = (posA.x + posB.x) / 2 * PHYSICS_SCALE;
            const midY = (posA.y + posB.y) / 2 * PHYSICS_SCALE;
            const iconSize = 16; // в "мировых пикселях"

            const gradient = context.createRadialGradient(midX, midY, 0, midX, midY, iconSize);
            gradient.addColorStop(0, 'rgba(255, 237, 160, 0.95)'); // Light yellow
            gradient.addColorStop(0.7, 'rgba(255, 179, 71, 0.9)');  // Orange
            gradient.addColorStop(1, 'rgba(255, 140, 0, 0.8)');   // Darker orange

            context.save();
            context.translate(midX, midY);
            
            // Масштабируем иконку (24x24) до нужного размера (iconSize)
            const scaleFactor = iconSize / 24;
            context.scale(scaleFactor, scaleFactor);
            // Центрируем иконку
            context.translate(-12, -12);

            context.fillStyle = gradient;
            context.fill(weldIconPath);

            context.restore();
        }
    }
    
    // --- НОВЫЙ ЦИКЛ: Отрисовка подсказки для привязки (ПОВЕРХ ВСЕГО) ---
    const isJointToolActive = toolState.currentTool === 'spring' || toolState.currentTool === 'rod';
    if (isJointToolActive) {
        for (let body = world.getBodyList(); body; body = body.getNext()) {
            const userData = body.getUserData() || {};
            const firstFixture = body.getFixtureList();
            if (body.isActive() && userData.label !== 'water' && userData.label !== 'sand' && firstFixture && firstFixture.getShape().getType() === 'circle') {
                const center = body.getPosition();
                // --- MODIFIED: Динамический радиус подсказки ---
                const circleRadius = firstFixture.getShape().m_radius;
                const hintRadius = Math.max(0.15, Math.min(circleRadius * 0.2, 0.5)); // 20% от радиуса, но в пределах 0.15м - 0.5м

                context.beginPath();
                context.arc(
                    center.x * PHYSICS_SCALE,
                    center.y * PHYSICS_SCALE,
                    hintRadius * PHYSICS_SCALE, // Используем динамический радиус
                    0, 2 * Math.PI
                );
                
                // Делаем подсказку очень заметной
                context.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
                context.fill();
                context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                context.lineWidth = 1.5; 
                context.setLineDash([4, 4]);
                context.stroke();
                context.setLineDash([]);
            }
        }
    }


    // Отрисовка взрывов
    const now = performance.now();
    activeExplosions = activeExplosions.filter(exp => {
        const elapsed = now - exp.startTime;
        if (elapsed >= exp.duration) {
            return false; // Удаляем взрыв из массива
        }
        
        const progress = elapsed / exp.duration;
        const currentRadius = exp.maxRadius * progress;
        const alpha = 1 - progress;

        const gradient = context.createRadialGradient(
            exp.pos.x * PHYSICS_SCALE, exp.pos.y * PHYSICS_SCALE, 0,
            exp.pos.x * PHYSICS_SCALE, exp.pos.y * PHYSICS_SCALE, currentRadius * PHYSICS_SCALE
        );
        gradient.addColorStop(0, `rgba(255, 204, 0, ${alpha * 0.9})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 0, ${alpha * 0.7})`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);
        
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(
            exp.pos.x * PHYSICS_SCALE, 
            exp.pos.y * PHYSICS_SCALE, 
            currentRadius * PHYSICS_SCALE, 
            0, 2 * Math.PI
        );
        context.fill();
        
        return true;
    });
    
    // Отрисовка предпросмотра инструмента
    drawPreview(context);
    
    // Отрисовка выделения поверх всего (в том же отмасштабированном пространстве)
    drawSelection(context);

    context.restore();
}

/**
 * Централизованно управляет состоянием "сна" всех динамических тел в мире.
 * Усыпляет тела, которые выходят за пределы экрана, и будит те, что возвращаются.
 */
function manageBodyStates(world, cameraData) {
    if (!cameraData || !cameraData.render) return;

    const viewBounds = cameraData.render.bounds;
    // Создаем AABB (Axis-Aligned Bounding Box) для видимой области камеры в метрической системе
    const cameraAABB = new planck.AABB(
        planck.Vec2(viewBounds.min.x / PHYSICS_SCALE, viewBounds.min.y / PHYSICS_SCALE),
        planck.Vec2(viewBounds.max.x / PHYSICS_SCALE, viewBounds.max.y / PHYSICS_SCALE)
    );

    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData() || {};
        if (!body.isDynamic()) {
            continue; // Пропускаем статические тела
        }

        const fixture = body.getFixtureList();
        if (!fixture) {
            continue; // Пропускаем тела без формы
        }

        // Получаем AABB тела. Для наших простых объектов достаточно AABB первой фигуры.
        const bodyAABB = fixture.getAABB(0); 

        const isVisible = planck.AABB.testOverlap(cameraAABB, bodyAABB);

        if (isVisible) {
            // Если объект виден, но спит, будим его.
            if (!body.isAwake()) {
                body.setAwake(true);
            }
        } else {
            // Если объект не виден, но активен, усыпляем его.
            if (body.isAwake()) {
                body.setAwake(false);
            }
        }
    }
}

export function initializeEngine() {
    if (typeof planck === 'undefined') {
        throw new Error('Planck.js не был загружен.');
    }

    const world = planck.World({
        gravity: planck.Vec2(0, 9.8), // Реалистичная гравитация
    });
    
    // --- NEW: Обработчик столкновений для звуков ---
    world.on('post-solve', (contact, impulse) => {
        // Суммируем нормальные импульсы (основная сила удара)
        const totalImpulse = impulse.normalImpulses[0] + (impulse.normalImpulses[1] || 0);

        // Порог, чтобы игнорировать очень слабые контакты (качение, лежание)
        if (totalImpulse < 0.2) return;

        const now = performance.now();
        const bodyA = contact.getFixtureA().getBody();
        const bodyB = contact.getFixtureB().getBody();
        
        // Получаем userData, инициализируя, если его нет
        const userDataA = bodyA.getUserData() || {};
        const userDataB = bodyB.getUserData() || {};
        
        // Пропускаем столкновения с частицами воды и песка
        if (userDataA.label === 'water' || userDataA.label === 'sand' || userDataB.label === 'water' || userDataB.label === 'sand') {
            return;
        }

        const lastSoundA = userDataA.lastCollisionSound || 0;
        const lastSoundB = userDataB.lastCollisionSound || 0;

        // "Остывание", чтобы предотвратить спам звуками от одного и того же объекта
        if (now - lastSoundA < 100 || now - lastSoundB < 100) return;

        userDataA.lastCollisionSound = now;
        userDataB.lastCollisionSound = now;
        bodyA.setUserData(userDataA);
        bodyB.setUserData(userDataB);
        
        // Нормализуем громкость и выбираем звук в зависимости от силы удара
        const volume = Math.min(1.0, totalImpulse / 8.0); // Уменьшена громкость (было / 5.0)
        const soundName = totalImpulse > 2.5 ? 'collision_heavy' : 'collision_light';
        
        SoundManager.playSound(soundName, { volume });
    });


    const canvas = document.getElementById('physics-canvas');
    if (!canvas) {
        throw new Error('Canvas with id "physics-canvas" not found.');
    }
    
    const render = {
        canvas: canvas,
        context: canvas.getContext('2d'),
        options: {
            width: Dom.container.clientWidth,
            height: Dom.container.clientHeight,
            showHitboxes: false,
        },
        bounds: {
            min: { x: 0, y: 0 },
            max: { x: Dom.container.clientWidth, y: Dom.container.clientHeight }
        }
    };

    // --- Игровой цикл с фиксированным шагом ---
    const timeStep = 1 / 60;
    const velocityIterations = 8;
    const positionIterations = 3;
    let lastTime = performance.now();
    let accumulator = 0;

    function gameLoop(time) {
        requestAnimationFrame(gameLoop);

        const deltaTime = (time - lastTime) / 1000;
        lastTime = time;

        if (cameraData) {
            manageBodyStates(world, cameraData);
        }

        if (!isPaused) {
            accumulator += deltaTime;
            while (accumulator >= timeStep) {
                updateWaterPhysics();
                applyMotorForces(world); // Применяем силы моторов на каждом шаге физики
                world.step(timeStep, velocityIterations, positionIterations);
                accumulator -= timeStep;
            }
        }
        
        if (cameraData) {
            beforeRenderCallback(cameraData);
            renderWorld(world, render, cameraData);
            renderWater(cameraData);
            renderSand(cameraData); // NEW: Отрисовка песка
        }
    }
    
    requestAnimationFrame(gameLoop);
    isPaused = true;
    
    return {
        world,
        render,
        get runner() {
            return {
                get enabled() { return !isPaused; },
                set enabled(value) { isPaused = !value; }
            };
        },
        setCamera: (camData) => { cameraData = camData; },
        setBeforeRenderCallback: (cb) => { beforeRenderCallback = cb; }
    };
}