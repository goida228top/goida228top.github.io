
import planck from './planck.js';
import * as Dom from './dom.js';
import { 
    PHYSICS_SCALE,
    SAND_MAX_PARTICLES,
    SAND_VISUAL_RADIUS,
    SAND_PHYSICAL_RADIUS_FACTOR,
    SAND_FRICTION,
    SAND_RESTITUTION,
    SAND_DENSITY
} from './game_config.js';

const { Vec2 } = planck;

const MAX_PARTICLES = SAND_MAX_PARTICLES;
export const sandParticlesPool = [];
let currentSandParticleIndex = 0;
let maxActiveParticles = MAX_PARTICLES;

const VISUAL_RADIUS = SAND_VISUAL_RADIUS;
// Для квадратов это будет половина ширины/высоты
const PHYSICAL_HALF_SIZE = (VISUAL_RADIUS * SAND_PHYSICAL_RADIUS_FACTOR) / PHYSICS_SCALE;

let sandColor = getComputedStyle(document.documentElement).getPropertyValue('--sand-color-transparent').trim() || 'rgba(194, 178, 128, 0.75)';

const sandParticleOptions = {
    restitution: SAND_RESTITUTION,
    friction: SAND_FRICTION,
    density: SAND_DENSITY,
};

function initializeSandPool(world) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const body = world.createDynamicBody({
            position: Vec2(-1000, -1000), // Изначально за экраном
            active: false,
            bullet: false, 
            angularDamping: 10.0, // ОПТИМИЗАЦИЯ: Гасим вращение, чтобы физика быстрее "засыпала"
            linearDamping: 0.5,   // Небольшое сопротивление воздуха
            userData: {
                label: 'sand',
            },
        });
        // Оставляем Box, чтобы строились горки
        body.createFixture(planck.Box(PHYSICAL_HALF_SIZE, PHYSICAL_HALF_SIZE), {
            ...sandParticleOptions,
        });
        sandParticlesPool.push(body);
    }
}

export function initializeSand(engineData) {
    const { world } = engineData;
    initializeSandPool(world);
}

export function renderSand(cameraData) {
    const isLiquidEffectEnabled = Dom.newLiquidEffectToggle.checked;

    Dom.sandContext.clearRect(0, 0, Dom.sandCanvas.width, Dom.sandCanvas.height);

    Dom.sandContext.save();
    Dom.sandContext.scale(1 / cameraData.scale, 1 / cameraData.scale);
    Dom.sandContext.translate(-cameraData.viewOffset.x, -cameraData.viewOffset.y);

    Dom.sandContext.fillStyle = sandColor;

    const viewMinX = cameraData.viewOffset.x;
    const viewMinY = cameraData.viewOffset.y;
    const canvasW = Dom.sandCanvas.width * cameraData.scale;
    const canvasH = Dom.sandCanvas.height * cameraData.scale;
    const viewMaxX = viewMinX + canvasW;
    const viewMaxY = viewMinY + canvasH;
    const padding = VISUAL_RADIUS * 2;

    // ОПТИМИЗАЦИЯ: Начинаем один путь для всех частиц
    Dom.sandContext.beginPath();

    if (isLiquidEffectEnabled) {
        const liquidRadius = VISUAL_RADIUS * 1.3;
        
        for (const particle of sandParticlesPool) {
            if (!particle.isActive()) continue;

            const pos = particle.getPosition();
            const px = pos.x * PHYSICS_SCALE;
            const py = pos.y * PHYSICS_SCALE;

            if (px < viewMinX - padding || px > viewMaxX + padding ||
                py < viewMinY - padding || py > viewMaxY + padding) {
                continue;
            }

            Dom.sandContext.moveTo(px + liquidRadius, py);
            Dom.sandContext.arc(px, py, liquidRadius, 0, Math.PI * 2);
        }
    } else {
        // ОПТИМИЗАЦИЯ РЕНДЕРА:
        // Рисуем квадраты БЕЗ вращения (Axis-Aligned).
        // Физически они вращаются (поэтому горки строятся), но визуально мы рисуем ровные квадратики.
        // Это позволяет использовать простой rect() вместо сложной математики вершин, что в 10 раз быстрее.
        const size = VISUAL_RADIUS * 2;
        const halfSize = VISUAL_RADIUS;

        for (const particle of sandParticlesPool) {
            if (!particle.isActive()) continue;

            const pos = particle.getPosition();
            const px = pos.x * PHYSICS_SCALE;
            const py = pos.y * PHYSICS_SCALE;

            if (px < viewMinX - padding || px > viewMaxX + padding ||
                py < viewMinY - padding || py > viewMaxY + padding) {
                continue;
            }

            // Просто рисуем прямоугольник по координатам центра
            Dom.sandContext.rect(px - halfSize, py - halfSize, size, size);
        }
    }
    
    // Заливаем всё разом одним вызовом
    Dom.sandContext.fill();
    Dom.sandContext.restore();
}


export function spawnSandParticle(world, x, y, initialVelocity) {
    const particle = sandParticlesPool[currentSandParticleIndex];

    particle.setActive(true);
    particle.setAwake(true);
    particle.setPosition(Vec2(x, y));
    particle.setLinearVelocity(initialVelocity || Vec2(0, 0));
    particle.setAngularVelocity((Math.random() - 0.5) * 2); 
    
    currentSandParticleIndex = (currentSandParticleIndex + 1) % maxActiveParticles;
}

export function deleteAllSand() {
    for (const particle of sandParticlesPool) {
        if (particle.isActive()) {
            particle.setActive(false);
            particle.setPosition(Vec2(-1000, -1000));
            particle.setLinearVelocity(Vec2(0, 0));
        }
    }
    console.log('Все частицы песка были деактивированы.');
}

export function setMaxSandParticles(count) {
    const oldMax = maxActiveParticles;
    maxActiveParticles = Math.min(count, MAX_PARTICLES);
    if (maxActiveParticles < oldMax) {
        for (let i = maxActiveParticles; i < oldMax; i++) {
            const particle = sandParticlesPool[i];
            if (particle && particle.isActive()) {
                particle.setActive(false);
                particle.setPosition(Vec2(-1000, -1000));
                particle.setLinearVelocity(Vec2(0, 0));
            }
        }
    }
    if (currentSandParticleIndex >= maxActiveParticles) {
        currentSandParticleIndex = 0;
    }
}

export function setSandColor(newColor) {
    sandColor = newColor;
}
