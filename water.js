import planck from './planck.js';
import * as Dom from './dom.js';
import { 
    PHYSICS_SCALE,
    WATER_MAX_PARTICLES,
    WATER_VISUAL_RADIUS,
    WATER_PHYSICAL_RADIUS_FACTOR,
    WATER_GROUP_INDEX,
    WATER_INTERACTION_RADIUS_FACTOR,
    WATER_STIFFNESS,
    WATER_REPULSION_STRENGTH,
    WATER_VISCOSITY,
    WATER_MAX_FORCE_SQ
} from './game_config.js';

const { Vec2 } = planck;

const MAX_PARTICLES = WATER_MAX_PARTICLES;
const waterParticlesPool = [];
let currentParticleIndex = 0;

const VISUAL_RADIUS = WATER_VISUAL_RADIUS;
const PHYSICAL_RADIUS = (VISUAL_RADIUS * WATER_PHYSICAL_RADIUS_FACTOR) / PHYSICS_SCALE;

// --- Новые константы для симуляции жидкости ---
// WATER_GROUP_INDEX уже импортирован
const INTERACTION_RADIUS = PHYSICAL_RADIUS * WATER_INTERACTION_RADIUS_FACTOR;
const INTERACTION_RADIUS_SQ = INTERACTION_RADIUS * INTERACTION_RADIUS;
const STIFFNESS = WATER_STIFFNESS;
const REPULSION_STRENGTH = WATER_REPULSION_STRENGTH;
const VISCOSITY = WATER_VISCOSITY;
const MAX_FORCE_SQ = WATER_MAX_FORCE_SQ;

let waterColor = getComputedStyle(document.documentElement).getPropertyValue('--water-color-transparent').trim() || 'hsla(230, 100%, 50%, 0.75)';

const waterParticleOptions = {
    restitution: 0.05,
    friction: 0.1,
    density: 1.0,
};

const spatialGrid = new Map();
const GRID_CELL_SIZE = INTERACTION_RADIUS;

function getGridKey(x, y) {
    const gx = Math.floor(x / GRID_CELL_SIZE);
    const gy = Math.floor(y / GRID_CELL_SIZE);
    return `${gx},${gy}`;
}

function initializeWaterPool(world) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const body = world.createDynamicBody({
            position: Vec2(-1000, -1000),
            active: false,
            bullet: false,
            userData: {
                label: 'water',
            }
        });
        body.createFixture(planck.Circle(PHYSICAL_RADIUS), {
            ...waterParticleOptions,
            filterGroupIndex: WATER_GROUP_INDEX
        });
        waterParticlesPool.push(body);
    }
}

export function initializeWater(engineData) {
    const { world } = engineData;
    initializeWaterPool(world);
}

export function updateWaterPhysics() {
    spatialGrid.clear();
    const activeParticles = [];
    for (const particle of waterParticlesPool) {
        // Проверяем isActive(), так как спящие тела (управляемые движком) неактивны
        if (particle.isActive()) {
            const pos = particle.getPosition();
            const key = getGridKey(pos.x, pos.y);
            if (!spatialGrid.has(key)) {
                spatialGrid.set(key, []);
            }
            spatialGrid.get(key).push(particle);
            activeParticles.push(particle);
        }
    }

    for (const particle of activeParticles) {
        const pos1 = particle.getPosition();
        const gx = Math.floor(pos1.x / GRID_CELL_SIZE);
        const gy = Math.floor(pos1.y / GRID_CELL_SIZE);

        let density = 0;
        let nearParticles = [];

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${gx + i},${gy + j}`;
                if (spatialGrid.has(key)) {
                    for (const neighbor of spatialGrid.get(key)) {
                        if (particle === neighbor) continue;

                        const distVec = Vec2.sub(pos1, neighbor.getPosition());
                        const distSq = distVec.lengthSquared();

                        if (distSq < INTERACTION_RADIUS_SQ) {
                           const dist = Math.sqrt(distSq);
                           const influence = 1 - (dist / INTERACTION_RADIUS);
                           density += influence * influence;
                           nearParticles.push({neighbor, dist, distVec});
                        }
                    }
                }
            }
        }
        
        if (nearParticles.length > 0) {
            const avgVelocity = Vec2(0, 0);
            for (const item of nearParticles) {
                avgVelocity.add(item.neighbor.getLinearVelocity());
            }
            avgVelocity.mul(1 / nearParticles.length);
            
            const velDifference = Vec2.sub(avgVelocity, particle.getLinearVelocity());
            const viscosityForce = velDifference.mul(VISCOSITY);
            particle.applyForceToCenter(viscosityForce, true);
        }

        const pressure = STIFFNESS * density;
        let pressureForce = Vec2(0, 0);

        for (const item of nearParticles) {
             if(item.dist > 0.0001) {
                 const influence = 1 - (item.dist / INTERACTION_RADIUS);
                 const direction = item.distVec.clone().mul(1 / item.dist);
                 
                 const pressureMagnitude = (pressure * influence * influence) / item.neighbor.getMass();
                 pressureForce.add(direction.clone().mul(pressureMagnitude));
    
                 const repulsionMagnitude = (REPULSION_STRENGTH * influence) / item.neighbor.getMass();
                 pressureForce.add(direction.clone().mul(repulsionMagnitude));
             }
        }

        if (pressureForce.lengthSquared() > MAX_FORCE_SQ) {
            pressureForce.normalize();
            pressureForce.mul(Math.sqrt(MAX_FORCE_SQ));
        }

        if (pressureForce.lengthSquared() > 0) {
            particle.applyForceToCenter(pressureForce, true);
        }
    }
}


export function renderWater(cameraData) {
    const isLiquidEffectEnabled = Dom.liquidEffectToggle.checked;

    Dom.waterContext.clearRect(0, 0, Dom.waterCanvas.width, Dom.waterCanvas.height);

    if (isLiquidEffectEnabled) {
        Dom.waterContext.fillStyle = 'white';
        Dom.waterContext.fillRect(0, 0, Dom.waterCanvas.width, Dom.waterCanvas.height);
    }

    Dom.waterContext.save();
    Dom.waterContext.scale(1 / cameraData.scale, 1 / cameraData.scale);
    Dom.waterContext.translate(-cameraData.viewOffset.x, -cameraData.viewOffset.y);

    Dom.waterContext.fillStyle = waterColor;
    Dom.waterContext.beginPath();
    for (const particle of waterParticlesPool) {
        if (!particle.isActive()) continue;

        const pos = particle.getPosition();
        const px = pos.x * PHYSICS_SCALE;
        const py = pos.y * PHYSICS_SCALE;
        Dom.waterContext.moveTo(px + VISUAL_RADIUS, py);
        Dom.waterContext.arc(px, py, VISUAL_RADIUS, 0, Math.PI * 2);
    }
    Dom.waterContext.fill();
    Dom.waterContext.restore();
}

export function spawnWaterParticle(world, x, y, initialVelocity) {
    const particle = waterParticlesPool[currentParticleIndex];

    particle.setActive(true);
    particle.setAwake(true);
    particle.setPosition(Vec2(x, y));
    particle.setLinearVelocity(initialVelocity || Vec2(0, 0));
    particle.setAngularVelocity(0);
    
    currentParticleIndex = (currentParticleIndex + 1) % MAX_PARTICLES;
}

export function deleteAllWater() {
    for (const particle of waterParticlesPool) {
        if (particle.isActive()) {
            particle.setActive(false);
            particle.setPosition(Vec2(-1000, -1000));
            particle.setLinearVelocity(Vec2(0, 0));
        }
    }
    console.log('All water particles have been deactivated.');
}


export function setWaterColor(newColor) {
    waterColor = newColor;
}