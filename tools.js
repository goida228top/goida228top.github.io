
// @ts-nocheck


import planck from './planck.js';
import * as Dom from './dom.js';
import { 
    toolState, 
    selectBody, deselectBody, 
    setFirstJointBody, getFirstJointBody,
    selectSpring, deselectSpring,
    setPreview, clearPreview 
} from './selection.js';
import { spawnWaterParticle } from './water.js';
import { spawnSandParticle } from './sand.js';
import { showObjectPropertiesPanel, hideObjectPropertiesPanel, showSpringPropertiesPanel, hideSpringPropertiesPanel, showToast } from './ui.js';
import { addExplosionEffect } from './engine.js';
import { tntTypes } from './tnt_textures.js';
import { ImageLoader } from './image_loader.js';
import { 
    PHYSICS_SCALE,
    TOOL_SETTINGS,
    WATER_VISUAL_RADIUS,
    WATER_PHYSICAL_RADIUS_FACTOR,
    SAND_VISUAL_RADIUS,
    SAND_PHYSICAL_RADIUS_FACTOR,
} from './game_config.js';
import { t } from './lang.js';
import { SoundManager } from './sound.js';

let mouseJoint = null;
let ground = null;
let draggedBody = null;

let isDrawing = false;
let startPoint = planck.Vec2(0, 0);
let lastMousePos = planck.Vec2(0, 0);

let polygonVertices = [];
let polygonMouseDownTime = 0;
const POLYGON_HOLD_DURATION = 400;

let lastBrushPoint = null;
const BRUSH_RADIUS = TOOL_SETTINGS.brush.radius;

let waterSpawnInterval = null;
let sandSpawnInterval = null;

const WATER_PHYSICAL_RADIUS = (WATER_VISUAL_RADIUS * WATER_PHYSICAL_RADIUS_FACTOR) / PHYSICS_SCALE;
const SAND_PHYSICAL_RADIUS = (SAND_VISUAL_RADIUS * SAND_PHYSICAL_RADIUS_FACTOR) / PHYSICS_SCALE;

// Переменная для отслеживания двойного тапа на мобильных
let lastTouchEndTime = 0;
let lastTouchEndPos = null;

let createExplosion;
let detonateTNT;

// --- Explosion Logic (Keeping existing logic) ---
detonateTNT = function(world, body) {
    if (!body || !body.getWorld()) return;
    const userData = body.getUserData() || {};
    const type = userData.tntType || 'small';
    
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
    createExplosion(world, explosionCenter, explosionRadius, explosionPower, type);
};

createExplosion = function(world, center, radius, power, type) {
    addExplosionEffect(center, radius, 400);
    SoundManager.playSound(`explosion_${type}`, { volume: 0.8 });

    const aabb = new planck.AABB(
        center.clone().sub(planck.Vec2(radius, radius)),
        center.clone().add(planck.Vec2(radius, radius))
    );
    
    const tntsToDetonate = new Set();

    world.queryAABB(aabb, (fixture) => {
        const body = fixture.getBody();
        const userData = body.getUserData() || {};

        if (userData.label === 'tnt') {
            tntsToDetonate.add(body);
            return true;
        }

        if (!body.isDynamic()) return true;

        const bodyPos = body.getPosition();
        const direction = planck.Vec2.sub(bodyPos, center);
        const distance = direction.length();

        if (distance < 0.1 || distance > radius) return true;

        direction.normalize();

        const falloff = 1 - (distance / radius);
        const impulseMagnitude = power * falloff; 
        
        const impulse = direction.mul(impulseMagnitude);
        body.applyLinearImpulse(impulse, bodyPos, true);
        body.setAwake(true);

        return true;
    });
    
    tntsToDetonate.forEach(bodyToDetonate => {
        setTimeout(() => detonateTNT(world, bodyToDetonate), 50 + Math.random() * 100);
    });
};


export async function initializeTools(engineData, cameraData, worldData) {
    const { world, render } = engineData;
    const { getMousePos, isPanning } = cameraData;

    ground = world.createBody();

    // --- Mouse Listeners ---
    Dom.container.addEventListener('mousedown', handleMouseDown);
    Dom.container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    Dom.container.addEventListener('contextmenu', handleContextMenu);
    Dom.container.addEventListener('dblclick', handleDoubleClick);
    Dom.container.addEventListener('mouseleave', stopAllActions);

    // --- Touch Listeners (NEW) ---
    Dom.container.addEventListener('touchstart', handleTouchStart, { passive: false });
    Dom.container.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);


    // --- Unified Action Handlers (Used by both Mouse and Touch) ---

    function startAction(pos, isTouch = false) {
        // Если камера занята (например, мультитач зум), не начинаем действие инструмента
        if (isPanning()) {
            stopAllActions();
            return;
        }

        isDrawing = true;
        // Преобразуем pos в planck.Vec2, если это еще не он
        startPoint = planck.Vec2(pos.x, pos.y); 
        lastMousePos = startPoint;

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
                    } else {
                        draggedBody = bodyToDrag;
                    }
                }
                break;
            case 'box':
            case 'circle':
                setPreview(toolState.currentTool, startPoint, startPoint);
                break;
            case 'polygon':
                polygonMouseDownTime = Date.now();
                break;
            case 'brush':
                 lastBrushPoint = startPoint;
                 createBrushStroke(world, startPoint, startPoint, BRUSH_RADIUS / PHYSICS_SCALE);
                 break;
            case 'weld':
            case 'spring':
            case 'rod':
                const firstBody = getBodyAt(world, startPoint, true);
                const firstBodyUserData = firstBody ? firstBody.getUserData() || {} : {};
                if (firstBody && firstBodyUserData.label !== 'water' && firstBodyUserData.label !== 'sand') {
                    let anchorPoint = startPoint;
                    const firstFixture = firstBody.getFixtureList();
                    if (firstFixture && firstFixture.getShape().getType() === 'circle') {
                        const circleRadius = firstFixture.getShape().m_radius;
                        const hintRadius = Math.max(0.15, Math.min(circleRadius * 0.2, 0.5));
                        const center = firstBody.getPosition();
                        const distSq = planck.Vec2.distanceSquared(startPoint, center);
                        if (distSq < hintRadius * hintRadius) {
                            anchorPoint = center;
                        }
                    }
                    setFirstJointBody(firstBody, anchorPoint);
                }
                break;
            case 'tnt-small':
            case 'tnt-medium':
            case 'tnt-large':
                const tntType = toolState.currentTool.replace('tnt-', '');
                createTNT(world, startPoint, tntType);
                break;
            case 'water':
                spawnWaterCluster(world, startPoint.x, startPoint.y);
                if (waterSpawnInterval) clearInterval(waterSpawnInterval);
                waterSpawnInterval = setInterval(() => {
                    spawnWaterCluster(world, lastMousePos.x, lastMousePos.y);
                    SoundManager.playSound('water_pour', { volume: 0.2, pitch: 1.0 + Math.random() * 0.2 });
                }, 40);
                break;
            case 'sand':
                spawnSandCluster(world, startPoint.x, startPoint.y);
                if (sandSpawnInterval) clearInterval(sandSpawnInterval);
                sandSpawnInterval = setInterval(() => {
                    spawnSandCluster(world, lastMousePos.x, lastMousePos.y);
                    SoundManager.playSound('sand_pour', { volume: 0.3, pitch: 1.0 + Math.random() * 0.2 });
                }, 40);
                break;
            case 'eraser':
                eraseAt(world, startPoint);
                break;
        }
    }

    function moveAction(pos) {
        lastMousePos = planck.Vec2(pos.x, pos.y);

        if (toolState.currentTool === 'polygon' && polygonVertices.length > 0) {
            setPreview('polygon', polygonVertices, lastMousePos);
        }

        if (!isDrawing) return;

        switch (toolState.currentTool) {
            case 'move':
                 if (draggedBody) {
                    const dx = (lastMousePos.x - startPoint.x);
                    const dy = (lastMousePos.y - startPoint.y);
                    const currentPos = draggedBody.getPosition();
                    draggedBody.setPosition(planck.Vec2(currentPos.x + dx, currentPos.y + dy));
                    draggedBody.setAwake(true);
                    startPoint = lastMousePos;
                 }
                 break;
            case 'finger':
                if (mouseJoint) {
                    mouseJoint.setTarget(lastMousePos);
                }
                break;
            case 'box':
            case 'circle':
                setPreview(toolState.currentTool, startPoint, lastMousePos);
                break;
            case 'brush':
                if (lastBrushPoint) {
                    const dist = planck.Vec2.distance(lastBrushPoint, lastMousePos);
                    if (dist * PHYSICS_SCALE > BRUSH_RADIUS * 0.5) {
                         createBrushStroke(world, lastBrushPoint, lastMousePos, BRUSH_RADIUS / PHYSICS_SCALE);
                         lastBrushPoint = lastMousePos;
                    }
                }
                break;
            case 'eraser':
                eraseAt(world, lastMousePos);
                break;
        }
    }

    function endAction(pos) {
        // Для тач-устройств pos может быть undefined при touchend, используем lastMousePos
        const endPoint = pos ? planck.Vec2(pos.x, pos.y) : lastMousePos;

        if (!isDrawing && toolState.currentTool !== 'polygon') return;

        if (toolState.currentTool === 'polygon') {
            const duration = Date.now() - polygonMouseDownTime;
            const clickPoint = endPoint;

            if (polygonVertices.length > 0) {
                const lastVertex = polygonVertices[polygonVertices.length - 1];
                if (planck.Vec2.distanceSquared(clickPoint, lastVertex) > 0.01) {
                    polygonVertices.push(clickPoint);
                }
            } else {
                polygonVertices.push(clickPoint);
            }

            if (polygonVertices.length === 1) {
                setPreview('polygon', polygonVertices, clickPoint);
            }

            // Для завершения полигона на тач: долгое нажатие или замыкание
            // На десктопе было удержание. На мобилках лучше 3+ точек и замыкание.
            // Оставим логику времени для совместимости.
            if (duration > POLYGON_HOLD_DURATION || (polygonVertices.length >= 3 && planck.Vec2.distance(clickPoint, polygonVertices[0]) < 0.5)) {
                if (polygonVertices.length >= 3) {
                    createPolygon(world, polygonVertices);
                }
                polygonVertices = [];
                clearPreview();
                isDrawing = false;
            }
            // При полигоне isDrawing сбрасывается только при завершении фигуры
            return;
        }
        
        isDrawing = false;

        switch (toolState.currentTool) {
            case 'move':
                draggedBody = null;
                break;
            case 'finger':
                if (mouseJoint) {
                    world.destroyJoint(mouseJoint);
                    mouseJoint = null;
                }
                break;
            case 'box':
                createBox(world, startPoint, endPoint);
                clearPreview();
                break;
            case 'circle':
                createCircle(world, startPoint, endPoint);
                clearPreview();
                break;
            case 'brush':
                lastBrushPoint = null;
                break;
            case 'weld':
            case 'spring':
            case 'rod':
                const { body: firstBody, anchor: firstAnchor } = getFirstJointBody();
                if (firstBody) {
                    const secondBody = getBodyAt(world, endPoint, true);
                    const secondBodyUserData = secondBody ? secondBody.getUserData() || {} : {};
                    if (secondBody && secondBodyUserData.label !== 'water' && secondBodyUserData.label !== 'sand' && secondBody !== firstBody) {
                        let secondAnchor = endPoint;
                        const secondFixture = secondBody.getFixtureList();
                        if (secondFixture && secondFixture.getShape().getType() === 'circle') {
                            const circleRadius = secondFixture.getShape().m_radius;
                            const hintRadius = Math.max(0.15, Math.min(circleRadius * 0.2, 0.5));
                            const center = secondBody.getPosition();
                            const distSq = planck.Vec2.distanceSquared(endPoint, center);
                            if (distSq < hintRadius * hintRadius) {
                                secondAnchor = center;
                            }
                        }

                        if (toolState.currentTool === 'weld') {
                            createWeld(world, firstBody, secondBody, endPoint);
                        } else if (toolState.currentTool === 'spring') {
                            createSpring(world, firstBody, secondBody, firstAnchor, secondAnchor);
                        } else { // 'rod'
                            createRod(world, firstBody, secondBody, firstAnchor, secondAnchor);
                        }
                    }
                }
                setFirstJointBody(null, null);
                break;
            case 'water':
                 if (waterSpawnInterval) clearInterval(waterSpawnInterval);
                 waterSpawnInterval = null;
                 break;
            case 'sand':
                 if (sandSpawnInterval) clearInterval(sandSpawnInterval);
                 sandSpawnInterval = null;
                 break;
        }
    }

    // --- Event Handler Wrappers ---

    function handleMouseDown(e) {
        if (e.button !== 0) return; // Только левая кнопка
        const pos = getMousePos(e);
        startAction(pos, false);
    }

    function handleMouseMove(e) {
        const pos = getMousePos(e);
        moveAction(pos);
    }

    function handleMouseUp(e) {
        if (e.button !== 0) return;
        const pos = getMousePos(e);
        endAction(pos);
    }

    // --- Touch Handlers Implementation ---

    function handleTouchStart(e) {
        // Обрабатываем только касание ОДНИМ пальцем.
        // Если пальцев 2 и более - это зум/пан камеры, инструменты не должны работать.
        if (e.touches.length > 1) {
            stopAllActions(); // Если рисовали - прерываем
            return;
        }
        e.preventDefault(); // Блокируем прокрутку страницы
        const pos = getMousePos(e);
        startAction(pos, true);
    }

    function handleTouchMove(e) {
        if (e.touches.length > 1) return;
        e.preventDefault();
        const pos = getMousePos(e);
        moveAction(pos);
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        const now = Date.now();
        // Проверка на двойной тап для ТНТ
        // Если прошло меньше 300мс с прошлого тапа и позиция не сильно изменилась
        if (now - lastTouchEndTime < 300 && lastMousePos) {
            // Используем lastMousePos, так как это последнее известное положение пальца
            const body = getBodyAt(world, lastMousePos);
            if (body && (body.getUserData()?.label === 'tnt')) {
                 detonateTNT(world, body);
            }
        }
        
        lastTouchEndTime = now;
        endAction(null); // Используем lastMousePos внутри
    }

    // --- Other Handlers ---

    function handleContextMenu(e) {
        e.preventDefault();
        
        if (toolState.currentTool === 'polygon' && polygonVertices.length > 0) {
            polygonVertices = [];
            clearPreview();
            isDrawing = false;
            return;
        }

        const pos = getMousePos(e);
        const screenPos = { x: e.clientX, y: e.clientY };

        hideObjectPropertiesPanel();
        hideSpringPropertiesPanel();

        const joint = getDistanceJointAt(world, pos);
        if(joint) {
            const jointData = joint.getUserData() || {};
            if (jointData.tool === 'spring') {
                selectSpring(joint);
                showSpringPropertiesPanel(joint, screenPos.x, screenPos.y);
                return;
            } else if (jointData.tool === 'rod') {
                return;
            }
        }
        
        const body = getBodyAt(world, pos);
        if (body) {
            selectBody(body);
            showObjectPropertiesPanel(body, screenPos.x, screenPos.y);
        } else {
            deselectBody();
            deselectSpring();
        }
    }

    function handleDoubleClick(e) {
        const pos = getMousePos(e);
        const body = getBodyAt(world, pos);
        if(body && (body.getUserData()?.label === 'tnt')) {
             detonateTNT(world, body);
        }
    }

    function stopAllActions() {
        if(isDrawing) isDrawing = false;
        if(mouseJoint) {
            world.destroyJoint(mouseJoint);
            mouseJoint = null;
        }
        draggedBody = null;
        if(waterSpawnInterval) clearInterval(waterSpawnInterval);
        waterSpawnInterval = null;
        if(sandSpawnInterval) clearInterval(sandSpawnInterval);
        sandSpawnInterval = null;

        clearPreview();
        if (polygonVertices.length > 0) {
            polygonVertices = [];
        }
    }
}

// ... (Keep helper functions like getBodyAt, getDistanceJointAt, createBox, etc. exactly as they were) ...
function getBodyAt(world, worldPoint, onlyDynamic = false) {
    let selectedBody = null;
    const aabb = new planck.AABB(
        worldPoint.clone().sub(planck.Vec2(0.01, 0.01)),
        worldPoint.clone().add(planck.Vec2(0.01, 0.01))
    );

    world.queryAABB(aabb, (fixture) => {
        const body = fixture.getBody();
        if (onlyDynamic && !body.isDynamic()) {
            return true;
        }
        if (fixture.testPoint(worldPoint)) {
            selectedBody = body;
            return false;
        }
        return true;
    });
    return selectedBody;
}

function getDistanceJointAt(world, worldPoint) {
    let selectedJoint = null;
    const clickRadius = 0.5;

    for (let joint = world.getJointList(); joint; joint = joint.getNext()) {
        const type = joint.getType();
        const userData = joint.getUserData() || {};
        
        if (type !== 'distance-joint' && (type !== 'wheel-joint' || !userData.isFixed)) {
            continue;
        }

        const bodyA = joint.getBodyA();
        const bodyB = joint.getBodyB();
        const p1 = bodyA.getWorldPoint(joint.getLocalAnchorA());
        const p2 = bodyB.getWorldPoint(joint.getLocalAnchorB());

        const d = planck.Vec2.distance(worldPoint, p1) + planck.Vec2.distance(worldPoint, p2);
        const len = planck.Vec2.distance(p1, p2);

        if (Math.abs(d - len) < clickRadius) {
            if (userData.tool === 'rod') continue;
            
            selectedJoint = joint;
            break;
        }
    }
    return selectedJoint;
}


function createBox(world, start, end) {
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width < 0.1 || height < 0.1) return;

    SoundManager.playSound('create_object', { volume: 0.7 });
    const body = world.createDynamicBody({
        position: planck.Vec2(minX + width / 2, minY + height / 2),
        linearDamping: 0.1,
    });

    body.createFixture(planck.Box(width / 2, height / 2), {
        friction: 0.3,
        restitution: 0.1,
        density: 1.0,
    });
}

function createCircle(world, center, edge) {
    const dx = edge.x - center.x;
    const dy = edge.y - center.y;
    let radius = Math.sqrt(dx * dx + dy * dy);

    radius = Math.max(0.25, Math.round(radius * 4) / 4);

    if (radius < 0.25) return;

    SoundManager.playSound('create_object', { volume: 0.7 });
    const body = world.createDynamicBody({
        position: center,
        linearDamping: 0.1,
    });
    body.createFixture(planck.Circle(radius), {
        friction: 0.8,
        restitution: 0.1,
        density: 1.0,
    });
    body.setUserData({
        motor: {
            isEnabled: false,
            speed: 10.0
        }
    });
}

// --- NEW HELPERS FOR POLYGON ---

function onSegment(p, q, r) {
    return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
        q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
}

function orientation(p, q, r) {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 1e-10) return 0;
    return (val > 0) ? 1 : 2;
}

function segmentsIntersect(p1, q1, p2, q2) {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
}

function isSelfIntersecting(vertices) {
    const n = vertices.length;
    if (n <= 3) return false;
    for (let i = 0; i < n; ++i) {
        for (let j = i + 2; j < n; ++j) {
            if (i === 0 && j === n - 1) continue;
            if (segmentsIntersect(vertices[i], vertices[(i + 1) % n], vertices[j], vertices[(j + 1) % n])) {
                return true;
            }
        }
    }
    return false;
}

function getPolygonArea(vertices) {
    let area = 0;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    }
    return area / 2;
}

function isPointInTriangle(p, a, b, c) {
    const s = a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y;
    const t = a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y;
    if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) return false;
    const A = -b.y * c.x + a.y * (c.x - b.x) + a.x * (b.y - c.y) + b.x * c.y;
    return A < 0 ? (s <= 0 && s + t >= A) : (s >= 0 && s + t <= A);
}

function triangulate(vertices) {
    const triangles = [];
    if (vertices.length < 3) return triangles;
    let localVertices = [...vertices];
    if (getPolygonArea(localVertices) > 0) {
        localVertices.reverse();
    }
    let iterations = 0;
    const maxIterations = localVertices.length * 2;
    while (localVertices.length >= 3 && iterations < maxIterations) {
        iterations++;
        let foundEar = false;
        for (let i = 0; i < localVertices.length; i++) {
            const p1_idx = i;
            const p2_idx = (i + 1) % localVertices.length;
            const p3_idx = (i + 2) % localVertices.length;
            const p1 = localVertices[p1_idx];
            const p2 = localVertices[p2_idx];
            const p3 = localVertices[p3_idx];
            if (orientation(p1, p2, p3) === 2) {
                let isEar = true;
                for (let j = 0; j < localVertices.length; j++) {
                    if (j === p1_idx || j === p2_idx || j === p3_idx) continue;
                    if (isPointInTriangle(localVertices[j], p1, p2, p3)) {
                        isEar = false;
                        break;
                    }
                }
                if (isEar) {
                    triangles.push([p1, p2, p3]);
                    localVertices.splice(p2_idx, 1);
                    foundEar = true;
                    break;
                }
            }
        }
        if (!foundEar) {
            console.error("Triangulation failed: No ear found.");
            return null;
        }
    }
    if (iterations >= maxIterations) {
        console.error("Triangulation failed: Exceeded max iterations.");
        return null;
    }
    return triangles;
}


function createPolygon(world, vertices) {
    if (vertices.length < 3) return;
    if (isSelfIntersecting(vertices)) {
        showToast(t('polygon-self-intersection-error'), 'error');
        return;
    }
    const triangles = triangulate(vertices);
    if (!triangles || triangles.length === 0) {
        console.warn("Polygon triangulation failed. Body not created.");
        return;
    }
    SoundManager.playSound('create_object', { volume: 0.7 });
    const body = world.createDynamicBody({ linearDamping: 0.1 });
    try {
        triangles.forEach(triangle => {
            const shape = planck.Polygon(triangle);
            body.createFixture(shape, {
                friction: 0.3,
                restitution: 0.1,
                density: 1.0,
            });
        });
    } catch(e) {
        console.error("Error creating fixtures from triangles:", e);
        world.destroyBody(body);
    }
}


function createBrushStroke(world, p1, p2, thickness) {
     const dist = planck.Vec2.distance(p1, p2);
     if (dist < 0.01) return;

     SoundManager.playSound('create_object', { volume: 0.5, pitch: 1.2 });
     const center = planck.Vec2.mid(p1, p2);
     const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

     const body = world.createBody({
        type: 'static',
        position: center,
        angle: angle,
        userData: {
            label: 'brush-stroke',
            render: { fillStyle: '#4a2a0a' }
        }
     });

     body.createFixture(planck.Box(dist / 2, thickness / 2), {
        friction: 0.8,
        restitution: 0.1,
     });
}

function createWeld(world, bodyA, bodyB, point) {
    SoundManager.playSound('create_object', { volume: 0.6, pitch: 0.9 });
    const worldAnchor = point;
    world.createJoint(planck.WeldJoint({
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: bodyA.getLocalPoint(worldAnchor),
        localAnchorB: bodyB.getLocalPoint(worldAnchor),
        referenceAngle: bodyB.getAngle() - bodyA.getAngle(),
    }));
}

function createSpring(world, bodyA, bodyB, anchorA, anchorB) {
    SoundManager.playSound('create_object', { volume: 0.6, pitch: 1.1 });
    const length = planck.Vec2.distance(anchorA, anchorB);
    const joint = planck.DistanceJoint({
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: bodyA.getLocalPoint(anchorA),
        localAnchorB: bodyB.getLocalPoint(anchorB),
        length: length,
        frequencyHz: TOOL_SETTINGS.spring.defaultStiffness,
        dampingRatio: TOOL_SETTINGS.spring.defaultDamping,
    });
    joint.setUserData({ tool: 'spring', isFixed: false });
    world.createJoint(joint);
}

function createRod(world, bodyA, bodyB, anchorA, anchorB) {
    SoundManager.playSound('create_object', { volume: 0.6, pitch: 0.8 });
    const length = planck.Vec2.distance(anchorA, anchorB);
    const joint = planck.DistanceJoint({
        bodyA: bodyA,
        bodyB: bodyB,
        localAnchorA: bodyA.getLocalPoint(anchorA),
        localAnchorB: bodyB.getLocalPoint(anchorB),
        length: length,
        frequencyHz: 100.0,
        dampingRatio: 1.0,
    });
    joint.setUserData({ tool: 'rod' });
    world.createJoint(joint);
}


function createTNT(world, position, type = 'small') {
    SoundManager.playSound('create_object', { volume: 0.7 });
    const tntConfig = TOOL_SETTINGS.tnt[type];
    const textureUrl = tntTypes[type].textureUrl;
    const texture = ImageLoader.getImage(textureUrl);

    if (!texture) {
        console.error(`Текстура для ТНТ типа "${type}" не найдена.`);
        return;
    }

    const width = tntConfig.baseVisualWidth;
    const height = tntConfig.baseVisualHeight;
    
    const hitboxWidth = width * tntConfig.hitboxWidthRatio;
    const hitboxHeight = height * tntConfig.hitboxHeightRatio;
    const hitboxOffsetX = width * tntConfig.hitboxOffsetXRatio;

    const body = world.createDynamicBody({
        position: position,
        linearDamping: 0.1,
    });

    body.createFixture(planck.Box(
        hitboxWidth / 2, 
        hitboxHeight / 2, 
        planck.Vec2(hitboxOffsetX, 0)
    ), {
        friction: 0.5,
        restitution: 0.1,
        density: 2.0,
    });

    body.setUserData({
        label: 'tnt',
        tntType: type,
        render: {
            texture: texture,
            textureUrl: textureUrl,
            width: width,
            height: height,
            strokeStyle: '#FFD700'
        }
    });
}


function spawnWaterCluster(world, x, y) {
    for (let i = 0; i < 5; i++) {
        const offsetX = (Math.random() - 0.5) * WATER_PHYSICAL_RADIUS * 4;
        const offsetY = (Math.random() - 0.5) * WATER_PHYSICAL_RADIUS * 4;
        spawnWaterParticle(world, x + offsetX, y + offsetY);
    }
}

function spawnSandCluster(world, x, y) {
    for (let i = 0; i < 5; i++) {
        const offsetX = (Math.random() - 0.5) * SAND_PHYSICAL_RADIUS * 4;
        const offsetY = (Math.random() - 0.5) * SAND_PHYSICAL_RADIUS * 4;
        spawnSandParticle(world, x + offsetX, y + offsetY);
    }
}


function eraseAt(world, point) {
    const aabb = new planck.AABB(
        point.clone().sub(planck.Vec2(0.5, 0.5)),
        point.clone().add(planck.Vec2(0.5, 0.5))
    );
    const bodiesToDestroy = [];
    world.queryAABB(aabb, (fixture) => {
        const body = fixture.getBody();
        if (fixture.testPoint(point)) {
            const userData = body.getUserData() || {};
            if(body.isDynamic() || userData.label === 'brush-stroke') {
                bodiesToDestroy.push(body);
            }
        }
        return true;
    });

    if (bodiesToDestroy.length > 0) {
         SoundManager.playSound('create_object', { volume: 0.4, pitch: 0.7 });
    }
    bodiesToDestroy.forEach(body => {
        if (body.getWorld()) {
            const userData = body.getUserData() || {};
            if(userData.motor && userData.motor.joint) {
                world.destroyJoint(userData.motor.joint);
            }
            world.destroyBody(body);
        }
    });
}
