import Matter from 'matter-js';

const { Composite, Events } = Matter;

export const toolState = {
    currentTool: 'move',
    selectedBody: null,
};

let _render = null;
let _cameraData = null;
let afterRenderHandler = null;

export function initializeSelection(render, cameraData) {
    _render = render;
    _cameraData = cameraData;
}

export function getSelectedBody() {
    return toolState.selectedBody;
}

export function selectBody(body) {
    if (toolState.selectedBody === body) return;
    
    deselectBody();
    toolState.selectedBody = body;
    
    if (_render) {
       afterRenderHandler = () => drawSelection();
       Events.on(_render, 'afterRender', afterRenderHandler);
    }
}

export function deselectBody() {
    if (afterRenderHandler && _render) {
        Events.off(_render, 'afterRender', afterRenderHandler);
        afterRenderHandler = null;
    }
    toolState.selectedBody = null;
}

export function deleteSelectedBody(world) {
    const body = getSelectedBody();
    if (body) {
        Composite.remove(world, body);
        deselectBody();
    }
}

function drawSelection() {
    const body = toolState.selectedBody;
    if (!body || !_render || !_cameraData) return;
    
    const context = _render.context;
    const { scale, viewOffset } = _cameraData;

    // Вспомогательная функция для преобразования мировых координат в экранные
    const toScreen = (worldPos) => ({
        x: (worldPos.x - viewOffset.x) / scale,
        y: (worldPos.y - viewOffset.y) / scale,
    });
    
    // Преобразуем все вершины в экранные координаты перед рисованием
    const screenVertices = body.vertices.map(toScreen);

    context.save();
    
    // Рисуем по экранным координатам
    context.beginPath();
    context.moveTo(screenVertices[0].x, screenVertices[0].y);
    for (let i = 1; i < screenVertices.length; i++) {
        context.lineTo(screenVertices[i].x, screenVertices[i].y);
    }
    context.closePath();
    
    context.globalAlpha = 0.8;
    context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--selection-color').trim() || '#ffffff';
    // Толщина линии теперь постоянна, так как мы рисуем в экранном пространстве
    context.lineWidth = 2;
    context.stroke();
    
    context.restore();
}