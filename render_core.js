
import planck from './planck.js';
import { PHYSICS_SCALE } from './game_config.js';
import { drawHitbox, drawSpring, weldIconPath } from './render_utils.js';
import { renderExplosions } from './effects.js';
import { drawPreview, drawSelection, toolState } from './selection.js';

// --- Кастомный рендерер для Planck.js ---
export function renderWorld(world, render, camera) {
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

        if (userData.label === 'water' || userData.label === 'sand' || (userData.render && userData.render.visible === false)) {
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

    renderExplosions(context);
    drawPreview(context);
    drawSelection(context);

    context.restore();
}
