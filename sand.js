// @ts-nocheck
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

// Упрощенные свойства частиц согласно запросу
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
            bullet: false, // Для маленьких быстрых объектов можно включить
            userData: {
                label: 'sand',
            },
        });
        // Создаем квадрат вместо круга. planck.Box принимает полуширину и полувысоту.
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

// ФУНКЦИЯ КАСТОМНОЙ ФИЗИКИ ПОЛНОСТЬЮ УДАЛЕНА.
// Вся физика теперь обрабатывается в world.step() в engine.js.
// export function updateSandPhysics(world) { ... }


export function renderSand(cameraData) {
    const isLiquidEffectEnabled = Dom.newLiquidEffectToggle.checked;

    Dom.sandContext.clearRect(0, 0, Dom.sandCanvas.width, Dom.sandCanvas.height);

    if (isLiquidEffectEnabled) {
        Dom.sandContext.fillStyle = 'white';
        Dom.sandContext.fillRect(0, 0, Dom.sandCanvas.width, Dom.sandCanvas.height);
    }

    Dom.sandContext.save();
    Dom.sandContext.scale(1 / cameraData.scale, 1 / cameraData.scale);
    Dom.sandContext.translate(-cameraData.viewOffset.x, -cameraData.viewOffset.y);

    Dom.sandContext.fillStyle = sandColor;

    // Рендерим квадраты, учитывая вращение
    for (const particle of sandParticlesPool) {
        if (!particle.isActive()) continue;

        const pos = particle.getPosition();
        const angle = particle.getAngle();
        const px = pos.x * PHYSICS_SCALE;
        const py = pos.y * PHYSICS_SCALE;
        const size = VISUAL_RADIUS * 2; // Полный размер квадрата

        Dom.sandContext.save();
        Dom.sandContext.translate(px, py);
        Dom.sandContext.rotate(angle);
        Dom.sandContext.fillRect(-VISUAL_RADIUS, -VISUAL_RADIUS, size, size);
        Dom.sandContext.restore();
    }

    Dom.sandContext.restore();
}


export function spawnSandParticle(world, x, y, initialVelocity) {
    const particle = sandParticlesPool[currentSandParticleIndex];

    particle.setActive(true);
    particle.setAwake(true);
    particle.setPosition(Vec2(x, y));
    particle.setLinearVelocity(initialVelocity || Vec2(0, 0));
    particle.setAngularVelocity((Math.random() - 0.5) * 2); // Небольшое случайное вращение
    
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