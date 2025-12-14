
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
import { hideObjectPropertiesPanel, hideSpringPropertiesPanel, showObjectPropertiesPanel, showSpringPropertiesPanel } from './ui.js';
import { 
    createBox, createCircle, createBrushStroke, createWeld, createSpring, createRod, 
    createTNT, eraseAt, createPolygon, detonateTNT
} from './tool_actions.js';
import { 
    PHYSICS_SCALE,
    TOOL_SETTINGS,
    WATER_VISUAL_RADIUS,
    WATER_PHYSICAL_RADIUS_FACTOR,
    SAND_VISUAL_RADIUS,
    SAND_PHYSICAL_RADIUS_FACTOR,
} from './game_config.js';
import { SoundManager } from './sound.js';

let mouseJoint = null;
let ground = null;
let draggedBody = null;
let world = null;

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

// Переменные для Long Press (Долгое нажатие - аналог ПКМ)
let longPressTimer = null;
let isLongPressTriggered = false;
let touchStartScreenPos = { x: 0, y: 0 };
const LONG_PRESS_DELAY = 600; // мс
const LONG_PRESS_TOLERANCE = 15; // пиксели (допуск на дрожание пальца)

// Ссылка на функцию принудительной отрисовки
let requestRender = () => {};

// Экспортируем статус взаимодействия для оптимизации рендеринга
export function isInteractionActive() {
    return isDrawing || mouseJoint !== null || draggedBody !== null || waterSpawnInterval !== null || sandSpawnInterval !== null;
}

export function switchTool(tool) {
    toolState.currentTool = tool;
    Dom.toolButtons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`${tool}-btn`);
    if(activeBtn) activeBtn.classList.add('active');
    deselectBody();
    hideObjectPropertiesPanel();
    stopAllActions(); // Сбрасываем текущие действия при смене инструмента
    requestRender(); // Обновляем интерфейс (например, убираем превью)
}

export async function initializeTools(engineData, cameraData, worldData) {
    world = engineData.world;
    const { getMousePos, isPanning } = cameraData;
    
    // Сохраняем ссылку на requestRender из engineData
    if (engineData.requestRender) {
        requestRender = engineData.requestRender;
    }

    ground = world.createBody();

    // --- Mouse Listeners ---
    Dom.container.addEventListener('mousedown', handleMouseDown);
    Dom.container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    Dom.container.addEventListener('contextmenu', handleContextMenu);
    Dom.container.addEventListener('dblclick', handleDoubleClick);
    Dom.container.addEventListener('mouseleave', stopAllActions);

    // --- Touch Listeners ---
    Dom.container.addEventListener('touchstart', handleTouchStart, { passive: false });
    Dom.container.addEventListener('touchmove', handleTouchMove, { passive: false });
    Dom.container.addEventListener('touchend', handleTouchEnd);
    Dom.container.addEventListener('touchcancel', handleTouchEnd);


    // --- Unified Action Handlers (Used by both Mouse and Touch) ---

    function startAction(pos, isTouch = false) {
        // Если камера занята (например, мультитач зум), не начинаем действие инструмента
        if (isPanning()) {
            stopAllActions();
            return;
        }

        isDrawing = true;
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
                requestRender(); // Рисуем начальное превью
                break;
            case 'polygon':
                polygonMouseDownTime = Date.now();
                break;
            case 'brush':
                 lastBrushPoint = startPoint;
                 createBrushStroke(world, startPoint, startPoint, BRUSH_RADIUS / PHYSICS_SCALE);
                 requestRender();
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
                    // Рисуем превью сразу от точки старта
                    setPreview('polygon', [anchorPoint], anchorPoint);
                    requestRender(); 
                }
                break;
            case 'tnt-small':
            case 'tnt-medium':
            case 'tnt-large':
                const tntType = toolState.currentTool.replace('tnt-', '');
                createTNT(world, startPoint, tntType);
                requestRender();
                break;
            case 'water':
                spawnWaterCluster(world, startPoint.x, startPoint.y);
                requestRender();
                if (waterSpawnInterval) clearInterval(waterSpawnInterval);
                waterSpawnInterval = setInterval(() => {
                    spawnWaterCluster(world, lastMousePos.x, lastMousePos.y);
                    SoundManager.playSound('water_pour', { volume: 0.2, pitch: 1.0 + Math.random() * 0.2 });
                    requestRender();
                }, 40);
                break;
            case 'sand':
                spawnSandCluster(world, startPoint.x, startPoint.y);
                requestRender();
                if (sandSpawnInterval) clearInterval(sandSpawnInterval);
                sandSpawnInterval = setInterval(() => {
                    spawnSandCluster(world, lastMousePos.x, lastMousePos.y);
                    SoundManager.playSound('sand_pour', { volume: 0.3, pitch: 1.0 + Math.random() * 0.2 });
                    requestRender();
                }, 40);
                break;
            case 'eraser':
                eraseAt(world, startPoint);
                requestRender();
                break;
        }
    }

    function moveAction(pos) {
        lastMousePos = planck.Vec2(pos.x, pos.y);

        if (toolState.currentTool === 'polygon' && polygonVertices.length > 0) {
            setPreview('polygon', polygonVertices, lastMousePos);
            requestRender();
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
                    requestRender();
                 }
                 break;
            case 'finger':
                if (mouseJoint) {
                    mouseJoint.setTarget(lastMousePos);
                    requestRender();
                }
                break;
            case 'box':
            case 'circle':
                setPreview(toolState.currentTool, startPoint, lastMousePos);
                requestRender(); // Обновляем превью при движении
                break;
            case 'brush':
                if (lastBrushPoint) {
                    const dist = planck.Vec2.distance(lastBrushPoint, lastMousePos);
                    if (dist * PHYSICS_SCALE > BRUSH_RADIUS * 0.5) {
                         createBrushStroke(world, lastBrushPoint, lastMousePos, BRUSH_RADIUS / PHYSICS_SCALE);
                         lastBrushPoint = lastMousePos;
                         requestRender();
                    }
                }
                break;
            case 'weld':
            case 'spring':
            case 'rod':
                const { body } = getFirstJointBody();
                if (body) {
                     // Используем превью типа 'polygon' (линия) для отображения будущей связи
                     const { anchor } = getFirstJointBody();
                     setPreview('polygon', [anchor], lastMousePos);
                     requestRender();
                }
                break;
            case 'eraser':
                eraseAt(world, lastMousePos);
                requestRender();
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
            requestRender();

            // Для завершения полигона на тач: долгое нажатие или замыкание
            if (duration > POLYGON_HOLD_DURATION || (polygonVertices.length >= 3 && planck.Vec2.distance(clickPoint, polygonVertices[0]) < 0.5)) {
                finishPolygon();
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
                // Сбрасываем состояние и превью НЕМЕДЛЕННО
                setFirstJointBody(null, null);
                clearPreview();
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
        
        // ПРИНУДИТЕЛЬНАЯ ОТРИСОВКА ПОСЛЕ ЗАВЕРШЕНИЯ ДЕЙСТВИЯ
        requestRender();
    }

    function finishPolygon() {
        if (polygonVertices.length >= 3) {
            createPolygon(world, polygonVertices);
        }
        polygonVertices = [];
        clearPreview();
        isDrawing = false;
        requestRender();
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
        if (e.touches.length > 1) {
            stopAllActions(); 
            // Отменяем таймер если пошло 2 пальца
            if (longPressTimer) clearTimeout(longPressTimer);
            return;
        }
        e.preventDefault(); 
        
        // --- LONG PRESS LOGIC START ---
        isLongPressTriggered = false;
        touchStartScreenPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        
        if (longPressTimer) clearTimeout(longPressTimer);
        
        longPressTimer = setTimeout(() => {
            // Имитируем событие для получения координат мира
            // Создаем мок-объект, совместимый с getMousePos (который ожидает touches или clientX/Y)
            const mockEvent = { 
                touches: [{ clientX: touchStartScreenPos.x, clientY: touchStartScreenPos.y }] 
            };
            
            const worldPos = getMousePos(mockEvent);
            
            // Проверяем, есть ли под пальцем объект, у которого можно открыть свойства
            const body = getBodyAt(world, worldPos);
            const joint = getDistanceJointAt(world, worldPos);
            
            // Если что-то нашли, активируем меню
            if (body || joint) {
                isLongPressTriggered = true;
                
                // Останавливаем текущее действие (например, чтобы не началась рисоваться коробка или не тащился объект)
                stopAllActions();
                
                // Вызываем меню свойств
                triggerContextMenu(worldPos, touchStartScreenPos);
                
                // Вибрация для отклика
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }, LONG_PRESS_DELAY);
        // --- LONG PRESS LOGIC END ---

        const pos = getMousePos(e);
        startAction(pos, true);
    }

    function handleTouchMove(e) {
        if (e.touches.length > 1) return;
        e.preventDefault();
        
        // --- LONG PRESS CHECK ---
        if (longPressTimer) {
            const dx = e.touches[0].clientX - touchStartScreenPos.x;
            const dy = e.touches[0].clientY - touchStartScreenPos.y;
            // Если палец сдвинулся слишком сильно, отменяем таймер
            if (Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
        // ------------------------

        const pos = getMousePos(e);
        moveAction(pos);
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        
        // Очищаем таймер долгого нажатия
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        // Если сработал Long Press, то мы просто выходим, 
        // не выполняя завершение обычного действия (чтобы не поставить точку полигона или коробку)
        if (isLongPressTriggered) {
            isLongPressTriggered = false;
            // Дополнительно сбрасываем drawing на всякий случай
            isDrawing = false;
            return;
        }

        const now = Date.now();
        // Проверка на двойной тап для ТНТ
        if (now - lastTouchEndTime < 300 && lastMousePos) {
            const body = getBodyAt(world, lastMousePos);
            if (body && (body.getUserData()?.label === 'tnt')) {
                 detonateTNT(world, body);
                 requestRender();
            }
        }
        
        lastTouchEndTime = now;
        endAction(null);
    }

    // --- Other Handlers ---

    // Вынесено в отдельную функцию для переиспользования в Long Press
    function triggerContextMenu(pos, screenPos) {
        if (toolState.currentTool === 'polygon') {
            // Для полигона ПКМ (или Long Press) работает как отмена/завершение
            if (polygonVertices.length >= 3) {
                finishPolygon();
            } else {
                polygonVertices = [];
                clearPreview();
                isDrawing = false;
                requestRender();
            }
            return;
        }

        // Если активен инструмент соединения и уже выбрано первое тело - отменяем
        const { body } = getFirstJointBody();
        if (body) {
            setFirstJointBody(null, null);
            clearPreview();
            isDrawing = false;
            requestRender();
            return;
        }

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
        
        const bodyFound = getBodyAt(world, pos);
        if (bodyFound) {
            selectBody(bodyFound);
            showObjectPropertiesPanel(bodyFound, screenPos.x, screenPos.y);
        } else {
            deselectBody();
            deselectSpring();
        }
        requestRender();
    }

    function handleContextMenu(e) {
        e.preventDefault();
        const pos = getMousePos(e);
        const screenPos = { x: e.clientX, y: e.clientY };
        triggerContextMenu(pos, screenPos);
    }

    function handleDoubleClick(e) {
        const pos = getMousePos(e);
        const body = getBodyAt(world, pos);
        if(body && (body.getUserData()?.label === 'tnt')) {
             detonateTNT(world, body);
             requestRender();
        }
    }
}

function stopAllActions() {
    if(isDrawing) isDrawing = false;
    if(mouseJoint) {
        if (world) world.destroyJoint(mouseJoint);
        mouseJoint = null;
    }
    draggedBody = null;
    if(waterSpawnInterval) clearInterval(waterSpawnInterval);
    waterSpawnInterval = null;
    if(sandSpawnInterval) clearInterval(sandSpawnInterval);
    sandSpawnInterval = null;

    setFirstJointBody(null, null); // Сброс состояния соединений
    clearPreview();
    if (polygonVertices.length > 0) {
        polygonVertices = [];
    }
    requestRender(); // Обязательно перерисовать, чтобы убрать "призраков"
}

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
