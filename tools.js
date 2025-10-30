import Matter from 'matter-js';
import * as Dom from './dom.js';
import { toolState, selectBody, deselectBody } from './selection.js';
import { spawnWaterParticle, getWaterParticles, setWaterParticles } from './water.js';
import { showObjectPropertiesPanel, hideObjectPropertiesPanel } from './ui.js';

const { Body, Bodies, Composite, Constraint, MouseConstraint, Query, Vector, Events, Vertices } = Matter;

let mouseConstraint; // Физическое перетаскивание
let fingerConstraint; // Точное перетаскивание

let isDrawing = false;
let startPoint = { x: 0, y: 0 };

// Для полигонов
let polygonVertices = [];

// Для линий (веревок) 
const LINE_SEGMENT_RADIUS = 12; 
let currentLineSegments = [];
let lineCollisionGroup = 0;


// Для кисти
let lastBrushPoint = null;
const BRUSH_RADIUS = 8;


let waterSpawnInterval = null;
let lastMousePos = { x: 0, y: 0 };

// Для долгого нажатия
let longPressTimer = null;
const LONG_PRESS_DURATION = 500;
let touchStartPos = { x: 0, y: 0 };
const TOUCH_MOVE_THRESHOLD = 10; // pixels


function spawnWaterCluster(engine, world, x, y) {
    const count = 3; 
    const spread = 8;
    for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * spread;
        const offsetY = (Math.random() - 0.5) * spread;
        spawnWaterParticle(engine, world, x + offsetX, y + offsetY);
    }
}

export function initializeTools(engineData, cameraData, worldData) {
    const { engine, world, render } = engineData;
    const { getMousePos, isPanning } = cameraData;

    // --- Инициализация инструментов перетаскивания ---
    mouseConstraint = MouseConstraint.create(engine, {
        mouse: cameraData.mouse,
        constraint: {
            stiffness: 0.05,
            render: {
                visible: false
            }
        }
    });
    mouseConstraint.collisionFilter.mask = 0; // Отключаем по умолчанию
    Composite.add(world, mouseConstraint);

    // --- Визуализация создания фигур ---
    Events.on(render, 'afterRender', () => {
        if (toolState.currentTool === 'polygon' && polygonVertices.length > 0) {
            drawPolygonPreview(render.context, cameraData);
        }
        if (toolState.currentTool === 'box' && isDrawing) {
            drawBoxPreview(render.context, cameraData, startPoint, lastMousePos);
        }
    });


    // --- Обработчики событий (унифицированные для мыши и касаний) ---
    Dom.container.addEventListener('mousedown', onPointerDown);
    Dom.container.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    
    Dom.container.addEventListener('touchstart', onPointerDown, { passive: false });
    Dom.container.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);

    Dom.container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        triggerContextMenu(e.clientX, e.clientY);
    });
    Dom.container.addEventListener('dblclick', handleDoubleClick);
    Dom.container.addEventListener('mouseleave', stopAllActions);


    function onPointerDown(e) {
        if (e.touches && e.touches.length > 1) return; // Камера обработает
        if (e.type === 'touchstart') e.preventDefault();

        const pointer = e.touches ? e.touches[0] : e;
        const target = e.touches ? document.elementFromPoint(pointer.clientX, pointer.clientY) : e.target;
        
        if (isPanning() || target !== render.canvas) return;
        
        // Логика долгого нажатия
        clearTimeout(longPressTimer);
        touchStartPos = { x: pointer.clientX, y: pointer.clientY };
        longPressTimer = setTimeout(() => {
            stopAllActions();
            triggerContextMenu(pointer.clientX, pointer.clientY);
            longPressTimer = null; // Помечаем, что таймер сработал
        }, LONG_PRESS_DURATION);

        handleToolStart(pointer);
    }

    function onPointerMove(e) {
        if (e.touches && e.touches.length > 1) return;
        if (e.type === 'touchmove') e.preventDefault();
        
        const pointer = e.touches ? e.touches[0] : e;
        
        // Отменяем долгое нажатие, если палец сдвинулся
        if (longPressTimer) {
            const dx = pointer.clientX - touchStartPos.x;
            const dy = pointer.clientY - touchStartPos.y;
            if (Math.sqrt(dx * dx + dy * dy) > TOUCH_MOVE_THRESHOLD) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
        
        handleToolMove(pointer);
    }

    function onPointerUp(e) {
        // Если таймер был, но не сработал - отменяем его
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        } else if (longPressTimer === null && e.type.startsWith('touch')) {
            // Если таймер сработал (null), и это событие касания, то ничего не делаем,
            // чтобы не создавать объект после вызова меню.
            return;
        }

        const pointer = e.changedTouches ? e.changedTouches[0] : e;
        if (!pointer) return;
        
        handleToolEnd(pointer);
    }

    function handleToolStart(pointer) {
        startPoint = getMousePos(pointer);
        lastMousePos = startPoint;
        isDrawing = true;

        switch (toolState.currentTool) {
            case 'move':
                mouseConstraint.collisionFilter.mask = -1; // Включаем
                break;
            case 'finger':
                startFingerDrag(world, startPoint);
                break;
            case 'water':
                spawnWaterCluster(engine, world, startPoint.x, startPoint.y);
                if (waterSpawnInterval) clearInterval(waterSpawnInterval);
                waterSpawnInterval = setInterval(() => {
                    spawnWaterCluster(engine, world, lastMousePos.x, lastMousePos.y);
                }, 30);
                break;
            case 'eraser':
                eraseAt(world, startPoint);
                break;
            case 'polygon':
                polygonVertices.push({ x: startPoint.x, y: startPoint.y });
                break;
            case 'line':
                startLine(world, startPoint);
                break;
            case 'brush':
                createBrushSegment(world, startPoint);
                lastBrushPoint = startPoint;
                break;
        }
    }

    function handleToolMove(pointer) {
        const currentPos = getMousePos(pointer);
        lastMousePos = currentPos;

        if (!isDrawing) return;

        switch (toolState.currentTool) {
            case 'finger':
                if (fingerConstraint) {
                    fingerConstraint.pointA = currentPos;
                }
                break;
            case 'water':
                // Интервал уже обрабатывает это
                break;
            case 'eraser':
                eraseAt(world, currentPos);
                break;
            case 'line':
                continueLine(world, currentPos);
                break;
            case 'brush':
                continueBrushStroke(world, currentPos);
                break;
        }
    }

    function handleToolEnd(pointer) {
        if (waterSpawnInterval) {
            clearInterval(waterSpawnInterval);
            waterSpawnInterval = null;
        }

        if (!isDrawing) return;
        
        const endPoint = getMousePos(pointer);

        switch (toolState.currentTool) {
            case 'move':
                mouseConstraint.collisionFilter.mask = 0; // Отключаем
                break;
            case 'finger':
                stopFingerDrag(world);
                break;
            case 'box':
                createBox(world, startPoint, endPoint);
                break;
            case 'line':
                endLine(world, endPoint);
                break;
            case 'brush':
                lastBrushPoint = null;
                break;
        }
        isDrawing = false;
    }

    function handleDoubleClick(e) {
        if (toolState.currentTool === 'polygon' && polygonVertices.length > 2) {
            createPolygon(world, polygonVertices);
            polygonVertices = [];
        }
    }
    
    function stopAllActions() {
        if (waterSpawnInterval) {
            clearInterval(waterSpawnInterval);
            waterSpawnInterval = null;
        }
        if (isDrawing) {
            isDrawing = false;
        }
        if (mouseConstraint) {
            mouseConstraint.collisionFilter.mask = 0;
        }
        stopFingerDrag(world);
        if (toolState.currentTool === 'polygon' && polygonVertices.length > 0) {
            polygonVertices = [];
        }
        if (toolState.currentTool === 'line' && currentLineSegments.length > 0) {
            endLine(world, undefined);
        }
        if (toolState.currentTool === 'brush') {
            lastBrushPoint = null;
        }
    }

    function triggerContextMenu(clientX, clientY) {
        const worldPos = getMousePos({ clientX, clientY });
        const bodies = Query.point(Composite.allBodies(world), worldPos);
        const clickedBody = bodies.find(b => b.label !== 'boundary' && b.label !== 'water');

        if (clickedBody) {
            selectBody(clickedBody);
            showObjectPropertiesPanel(clickedBody, clientX, clientY);
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

function drawBoxPreview(context, cameraData, startPoint, endPoint) {
    const { scale, viewOffset } = cameraData;

    // Вспомогательная функция для преобразования мировых координат в экранные
    const toScreen = (worldPos) => ({
        x: (worldPos.x - viewOffset.x) / scale,
        y: (worldPos.y - viewOffset.y) / scale,
    });

    const screenStart = toScreen(startPoint);
    const screenEnd = toScreen(endPoint);

    const width = screenEnd.x - screenStart.x;
    const height = screenEnd.y - screenStart.y;

    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    context.lineWidth = 2; // Используем постоянную ширину линии в экранном пространстве
    context.setLineDash([6, 4]);
    context.strokeRect(screenStart.x, screenStart.y, width, height);
    context.setLineDash([]);
    context.restore();
}


function drawPolygonPreview(context, cameraData) {
    const { scale, viewOffset } = cameraData;

    // Вспомогательная функция для преобразования мировых координат в экранные
    const toScreen = (worldPos) => ({
        x: (worldPos.x - viewOffset.x) / scale,
        y: (worldPos.y - viewOffset.y) / scale,
    });
    
    context.save();
    context.beginPath();
    
    // Преобразуем все вершины в экранные координаты перед рисованием
    const screenVertices = polygonVertices.map(toScreen);
    const screenMousePos = toScreen(lastMousePos);

    // Рисуем линии между установленными вершинами
    if (screenVertices.length > 0) {
        context.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
            context.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        // Рисуем "резиновую" линию до текущей позиции мыши
        context.lineTo(screenMousePos.x, screenMousePos.y);
    }

    context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    context.lineWidth = 2; // Используем постоянную ширину линии в экранном пространстве
    context.setLineDash([6, 4]);
    context.stroke();
    context.setLineDash([]); // Сбрасываем для другого рендеринга

    // Рисуем круги на каждой вершине для наглядности
    context.fillStyle = 'rgba(255, 255, 255, 1)';
    for (const sv of screenVertices) {
        context.beginPath();
        context.arc(sv.x, sv.y, 5, 0, Math.PI * 2); // Используем постоянный радиус в экранном пространстве
        context.fill();
    }

    context.restore();
}

function startFingerDrag(world, position) {
    const body = Query.point(Composite.allBodies(world), position)[0];
    if (body && !body.isStatic) {
        selectBody(body);
        fingerConstraint = Constraint.create({
            pointA: position,
            bodyB: body,
            pointB: { x: position.x - body.position.x, y: position.y - body.position.y },
            stiffness: 0.2,
            damping: 0.1,
            render: { visible: true }
        });
        Composite.add(world, fingerConstraint);
    }
}

function stopFingerDrag(world) {
    if (fingerConstraint) {
        Composite.remove(world, fingerConstraint);
        fingerConstraint = null;
    }
}

function createBox(world, start, end) {
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (width < 5 || height < 5) return;

    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;

    const box = Bodies.rectangle(centerX, centerY, width, height, {
        friction: 0.1,
        restitution: 0.1,
        density: 0.001,
        slop: 0.25 // Допуск для предотвращения туннелирования
    });
    Composite.add(world, box);
}

function createPolygon(world, vertices) {
    try {
        // Matter.js требует, чтобы вершины были выпуклыми и шли по часовой стрелке.
        const orderedVertices = Vertices.clockwiseSort(vertices);
        const polygon = Bodies.fromVertices(0, 0, [orderedVertices], {
            friction: 0.1,
            restitution: 0.1,
            density: 0.001,
            slop: 0.25 // Допуск для предотвращения туннелирования
        });
        
        if (!polygon) {
            console.warn("Создание полигона не удалось. Фигура может быть самопересекающейся или слишком сложной.");
            return;
        }

        const center = Vertices.centre(orderedVertices);
        Body.setPosition(polygon, center);
        Composite.add(world, polygon);
    } catch (e) {
        console.warn("Произошла ошибка при создании полигона:", e);
    }
}

function startLine(world, position) {
    lineCollisionGroup = Body.nextGroup(true);
    const segment = createLineSegment(position);
    currentLineSegments.push(segment);
    Composite.add(world, segment);
}

function continueLine(world, position) {
    if (currentLineSegments.length === 0) return;

    const lastSegment = currentLineSegments[currentLineSegments.length - 1];
    
    // Вектор от последнего сегмента до текущей позиции мыши
    const delta = Vector.sub(position, lastSegment.position);
    const distance = Vector.magnitude(delta);
    
    // Желаемое расстояние между центрами сегментов для плотного прилегания
    const stepDistance = LINE_SEGMENT_RADIUS * 0.4;
    
    // Сколько новых сегментов нужно создать, чтобы заполнить пробел
    const segmentsToCreate = Math.floor(distance / stepDistance);

    if (segmentsToCreate > 0) {
        // Вектор направления для одного шага
        const stepVector = Vector.mult(Vector.normalise(delta), stepDistance);
        let currentLastSegment = lastSegment;

        for (let i = 0; i < segmentsToCreate; i++) {
            // Вычисляем позицию для нового сегмента
            const nextPosition = Vector.add(currentLastSegment.position, stepVector);
            
            const newSegment = createLineSegment(nextPosition);
            currentLineSegments.push(newSegment);
            Composite.add(world, newSegment);

            const link = Constraint.create({
                bodyA: currentLastSegment,
                bodyB: newSegment,
                stiffness: 1, 
                damping: 0.1, 
                length: stepDistance, // Длина должна быть равна шагу
                render: { visible: false }
            });
            Composite.add(world, link);

            // Обновляем ссылку на последний созданный сегмент
            currentLastSegment = newSegment;
        }
    }
}


function endLine(world, endPoint) {
    if (world && endPoint && currentLineSegments.length > 1) {
        const lastSegment = currentLineSegments[currentLineSegments.length - 1];
        const bodiesAtEnd = Query.point(Composite.allBodies(world), endPoint);
        const potentialTargets = bodiesAtEnd.filter(body =>
            body.id !== lastSegment.id &&
            !body.isStatic &&
            body.label !== 'water'
        );
        const targetBody = potentialTargets[0];

        if (targetBody) {
            const knot = Constraint.create({
                bodyA: lastSegment,
                bodyB: targetBody,
                pointA: { x: 0, y: 0 },
                pointB: Vector.sub(endPoint, targetBody.position),
                stiffness: 1, // Максимальная жесткость
                damping: 0.1,
                render: {
                    strokeStyle: '#a9a9a9',
                    lineWidth: 3,
                    type: 'line',
                    anchors: false,
                }
            });
            Composite.add(world, knot);
        }
    }
    currentLineSegments = [];
}

function createLineSegment(position) {
    return Bodies.circle(position.x, position.y, LINE_SEGMENT_RADIUS, {
        friction: 0.9, // Почти максимальное трение
        restitution: 0, // Убрана упругость
        density: 0.01, // Плотность снижена до разумного предела для стабильности
        sleepThreshold: -1, 
        collisionFilter: { group: lineCollisionGroup },
        render: { fillStyle: '#cccccc' },
        slop: 0.25 
    });
}

function createBrushSegment(world, position) {
    const bodies = Query.point(Composite.allBodies(world), position);
    if (bodies.some(b => Vector.magnitudeSquared(Vector.sub(b.position, position)) < (BRUSH_RADIUS * BRUSH_RADIUS * 0.25))) {
        return;
    }

    const segment = Bodies.circle(position.x, position.y, BRUSH_RADIUS, {
        isStatic: true,
        friction: 0.3,
        slop: 0.25, // Увеличиваем допуск для стабильности
        label: 'user-static',
        render: { fillStyle: '#8b4513' }
    });
    Composite.add(world, segment);
}

function continueBrushStroke(world, position) {
    if (!lastBrushPoint) return;
    const distance = Vector.magnitude(Vector.sub(position, lastBrushPoint));
    const angle = Vector.angle(lastBrushPoint, position);

    for (let i = 0; i < distance; i += BRUSH_RADIUS / 2) {
        const x = lastBrushPoint.x + Math.cos(angle) * i;
        const y = lastBrushPoint.y + Math.sin(angle) * i;
        createBrushSegment(world, { x, y });
    }
    lastBrushPoint = position;
}

function eraseAt(world, position) {
    const bodiesToRemove = Query.point(Composite.allBodies(world), position);
    bodiesToRemove.forEach(body => {
        if (body.label !== 'boundary') {
            if (body.label === 'water') {
                setWaterParticles(getWaterParticles().filter(p => p !== body));
            }
            Composite.remove(world, body);
        }
    });
}