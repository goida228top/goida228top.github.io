import planck from './planck.js';
import { PHYSICS_SCALE } from './config.js';

export const toolState = {
    currentTool: 'move',
    selectedBody: null,
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
