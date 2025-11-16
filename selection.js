import planck from './planck.js';
import { PHYSICS_SCALE } from './game_config.js';

export const toolState = {
    currentTool: 'move',
    selectedBody: null,
    firstJointBody: null,   // Замена для firstWeldBody и firstSpringBody
    firstJointAnchor: null, // Хранит Vec2 первого клика в мировых координатах
    selectedSpring: null,
};

export function getSelectedBody() {
    return toolState.selectedBody;
}

export function selectBody(body) {
    if (toolState.selectedBody === body) return;
    deselectBody();
    toolState.selectedBody = body;
}

export function deselectBody() {
    toolState.selectedBody = null;
}

// --- NEW: Общие функции для двухточечных инструментов (сварка, пружина) ---

export function setFirstJointBody(body, anchor) {
    toolState.firstJointBody = body;
    toolState.firstJointAnchor = anchor ? anchor.clone() : null;
}

export function getFirstJointBody() {
    return {
        body: toolState.firstJointBody,
        anchor: toolState.firstJointAnchor,
    };
}


// --- Spring state functions ---

export function selectSpring(joint) {
    deselectSpring();
    toolState.selectedSpring = joint;
}

export function deselectSpring() {
    toolState.selectedSpring = null;
}

export function getSelectedSpring() {
    return toolState.selectedSpring;
}

export function deleteSelectedSpring(world) {
    const spring = getSelectedSpring();
    if (spring && spring.getWorld()) {
        world.destroyJoint(spring);
        deselectSpring();
    }
}


export function deleteSelectedBody(world) {
    const body = getSelectedBody();
    if (body) {
        world.destroyBody(body);
        deselectBody();
    }
}

// Функция теперь принимает только контекст, т.к. трансформации камеры применяются в engine.js
export function drawSelection(context) {
    const body = toolState.selectedBody;
    if (!body || !body.getWorld()) {
        if(body) deselectBody();
        return;
    }
    
    const xf = body.getTransform();

    // Не нужно делать save/restore и трансформации, они делаются в renderWorld
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--selection-color').trim() || '#ffffff';
    // Ширина линии теперь не зависит от зума, т.к. она в мировых пикселях
    context.lineWidth = 2; 
    context.globalAlpha = 0.8;

    for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
        const shape = fixture.getShape();
        if (shape.getType() === 'polygon') {
            const vertices = shape.m_vertices;
            context.beginPath();
            const v0 = planck.Transform.mulVec2(xf, vertices[0]);
            context.moveTo(v0.x * PHYSICS_SCALE, v0.y * PHYSICS_SCALE);
            for (let i = 1; i < vertices.length; i++) {
                const vi = planck.Transform.mulVec2(xf, vertices[i]);
                context.lineTo(vi.x * PHYSICS_SCALE, vi.y * PHYSICS_SCALE);
            }
            context.closePath();
            context.stroke();
        } else if (shape.getType() === 'circle') {
             const center = planck.Transform.mulVec2(xf, shape.m_p);
             const radius = shape.m_radius;
             context.beginPath();
             context.arc(
                center.x * PHYSICS_SCALE, 
                center.y * PHYSICS_SCALE, 
                radius * PHYSICS_SCALE, 
                0, 2 * Math.PI
            );
             context.stroke();
        }
    }
    // Восстанавливаем alpha на случай, если он понадобится где-то еще
    context.globalAlpha = 1.0;
}


// --- НОВЫЙ КОД ДЛЯ ПРЕДПРОСМОТРА ---

const previewState = {
    type: null,
    start: null,
    end: null,
};

export function setPreview(type, start, end) {
    previewState.type = type;
    previewState.start = start;
    previewState.end = end;
}

export function clearPreview() {
    previewState.type = null;
    previewState.start = null;
    previewState.end = null;
}

function drawBoxPreview(context) {
    const startX = previewState.start.x * PHYSICS_SCALE;
    const startY = previewState.start.y * PHYSICS_SCALE;
    const endX = previewState.end.x * PHYSICS_SCALE;
    const endY = previewState.end.y * PHYSICS_SCALE;

    const width = endX - startX;
    const height = endY - startY;

    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    context.lineWidth = 1.5; 
    context.setLineDash([5, 5]);

    context.fillRect(startX, startY, width, height);
    context.strokeRect(startX, startY, width, height);

    context.setLineDash([]);
}

function drawCirclePreview(context) {
    const startX = previewState.start.x * PHYSICS_SCALE;
    const startY = previewState.start.y * PHYSICS_SCALE;
    const endX = previewState.end.x * PHYSICS_SCALE;
    const endY = previewState.end.y * PHYSICS_SCALE;

    const dx = endX - startX;
    const dy = endY - startY;
    
    // --- MODIFIED: Логика прилипания к шагу 0.25 и отображение размера ---
    let radiusInMeters = Math.sqrt(dx * dx + dy * dy) / PHYSICS_SCALE;
    radiusInMeters = Math.max(0.25, Math.round(radiusInMeters * 4) / 4);
    const snappedRadiusPx = radiusInMeters * PHYSICS_SCALE;

    if (snappedRadiusPx < 1) return;

    // Отрисовка круга
    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    context.lineWidth = 1.5;
    context.setLineDash([5, 5]);

    context.beginPath();
    context.arc(startX, startY, snappedRadiusPx, 0, 2 * Math.PI);
    context.fill();
    context.stroke();

    context.setLineDash([]);

    // Отрисовка текста с размером
    const diameter = (radiusInMeters * 2).toFixed(2);
    const text = `D: ${diameter}m`;
    
    context.font = '14px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillText(text, endX + 10, endY - 10);
}


function drawPolygonPreview(context) {
    const vertices = previewState.start;
    const currentPos = previewState.end;

    if (!vertices || vertices.length === 0) return;

    const scale = PHYSICS_SCALE;

    // Отрисовка существующих сегментов полигона (сплошная линия)
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    context.lineWidth = 1.5;
    context.setLineDash([]);
    
    context.beginPath();
    context.moveTo(vertices[0].x * scale, vertices[0].y * scale);
    for (let i = 1; i < vertices.length; i++) {
        context.lineTo(vertices[i].x * scale, vertices[i].y * scale);
    }
    context.stroke();

    // Отрисовка "резиновых" линий к текущей позиции мыши (пунктир)
    context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    context.setLineDash([5, 5]);

    context.beginPath();
    // Линия от последней вершины к мыши
    const lastVertex = vertices[vertices.length - 1];
    context.moveTo(lastVertex.x * scale, lastVertex.y * scale);
    context.lineTo(currentPos.x * scale, currentPos.y * scale);

    // Линия от мыши к первой вершине (чтобы показать замыкание)
    if (vertices.length > 1) {
        context.lineTo(vertices[0].x * scale, vertices[0].y * scale);
    }
    context.stroke();
    
    context.setLineDash([]);
}

export function drawPreview(context) {
    if (!previewState.type || !previewState.start || !previewState.end) {
        return;
    }
    
    switch (previewState.type) {
        case 'box':
            drawBoxPreview(context);
            break;
        case 'circle':
            drawCirclePreview(context);
            break;
        case 'polygon':
            drawPolygonPreview(context);
            break;
    }
}