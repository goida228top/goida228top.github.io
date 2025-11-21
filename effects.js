
import { PHYSICS_SCALE } from './game_config.js';

let activeExplosions = [];

export function addExplosionEffect(positionInMeters, maxRadius = 15, duration = 300) {
    activeExplosions.push({
        pos: positionInMeters,
        maxRadius,
        duration,
        startTime: performance.now()
    });
}

export function renderExplosions(context) {
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
}
