
import planck from './planck.js';
import * as Dom from './dom.js';
import { drawSelection } from './selection.js';
import { PHYSICS_SCALE } from './config.js';
import { renderWater, updateWaterPhysics } from './water.js'; // Импортируем новую функцию физики воды

let isPaused = false;
let cameraData = null;
let beforeRenderCallback = () => {};
let activeExplosions = [];

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

        if (userData.label === 'water' || (userData.render && userData.render.visible === false)) {
            continue;
        }

        const xf = body.getTransform();

        for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
            const shape = fixture.getShape();
            const shapeType = shape.getType();
            
            context.beginPath();

            const renderStyle = userData.render || {};
            let fillStyle = renderStyle.fillStyle || '#cccccc';
            let strokeStyle = renderStyle.strokeStyle || '#aaaaaa';
            
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

                // Если задан цвет обводки, отрисовываем его по визуальным размерам
                // Убираем обводку для TNT, так как она не нужна
                if (renderStyle.strokeStyle && userData.label !== 'tnt') { 
                    context.strokeStyle = renderStyle.strokeStyle;
                    context.lineWidth = 2 * scale;
                    context.strokeRect(
                        -boxWidthPx / 2,
                        -boxHeightPx / 2,
                        boxWidthPx,
                        boxHeightPx
                    );
                }

                context.restore();
            } else {
                // Существующая логика отрисовки для сплошных цветов
                context.fillStyle = fillStyle;
                context.strokeStyle = strokeStyle;
                context.lineWidth = 2 * scale;
                
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
                context.stroke();
            }
        }

        if (render.options.showHitboxes) {
            drawHitbox(context, body, scale);
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
                world.step(timeStep, velocityIterations, positionIterations);
                accumulator -= timeStep;
            }
        }
        
        if (cameraData) {
            beforeRenderCallback(cameraData);
            renderWorld(world, render, cameraData);
            renderWater(cameraData); 
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
