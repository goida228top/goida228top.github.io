
import planck from './planck.js';
import { PHYSICS_SCALE } from './game_config.js';

export const weldIconPath = new Path2D('M12 0 L15.5 8.5 L24 12 L15.5 15.5 L12 24 L8.5 15.5 L0 12 L8.5 8.5 Z');

export function drawHitbox(context, body, scale) {
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

export function drawSpring(context, p1, p2, segments = 10, widthRatio = 0.2) {
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
