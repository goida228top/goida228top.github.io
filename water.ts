import Matter from 'matter-js';
import * as Dom from './dom';

// Fix: Augment Matter.Body type to include custom properties for TypeScript
// Switched to global namespace augmentation to resolve the "Invalid module name" error.
// This is a more robust approach for augmenting types in some project setups.
declare global {
    namespace Matter {
        interface Body {
            calmCounter?: number;
            createdAt?: number;
        }
    }
}

const { Bodies, World, Events, Body, Sleeping, Vector } = Matter;

const MAX_PARTICLES = 2500;
let waterParticles = [];
let currentParticleIndex = 0;
const PHYSICAL_RADIUS = 6; // Увеличено для стабильности
const VISUAL_RADIUS = 10;
const INTERACTION_RADIUS = VISUAL_RADIUS * 2.2; 
const STIFFNESS = 0.00075;
const IMMUNITY_DURATION = 1000; 

// Обновленные константы для более надежного засыпания
const SLEEP_SPEED_THRESHOLD = 0.2; // Порог скорости, увеличен для толерантности к джиттеру
const SLEEP_ANGULAR_THRESHOLD = 0.2; // Порог вращения, увеличен
const FRAMES_TO_SLEEP = 90; // Время до засыпания ~1.5 секунды
const CALM_COUNTER_DECAY = 5; // На сколько уменьшать счетчик при движении (ключевое изменение)


// Эта переменная теперь изменяема, чтобы UI мог ей управлять
let waterColor = getComputedStyle(document.documentElement).getPropertyValue('--water-color-transparent').trim() || 'hsla(230, 100%, 50%, 0.75)';

const waterParticleOptions = {
    restitution: 0.1,
    friction: 0.3, // Увеличено для "вязкости"
    frictionStatic: 0,
    frictionAir: 0.03, // Увеличено для стабильности
    density: 0.001,
    slop: 0.15, // Увеличено для стабильности
    render: { visible: false },
    label: 'water',
    createdAt: 0
};

function applyLiquidForces(engine) {
    const now = engine.timing.timestamp;
    for (let i = 0; i < waterParticles.length; i++) {
        const particleA = waterParticles[i];
        if (particleA.isSleeping) continue;
        
        if (now - particleA.createdAt < IMMUNITY_DURATION) continue;

        for (let j = i + 1; j < waterParticles.length; j++) {
            const particleB = waterParticles[j];
            
            if (now - particleB.createdAt < IMMUNITY_DURATION) continue;
            if (particleB.isSleeping) continue;

            const delta = Vector.sub(particleB.position, particleA.position);
            const distance = Vector.magnitude(delta);

            if (distance < INTERACTION_RADIUS && distance > 0) {
                const forceMagnitude = STIFFNESS * (1 - distance / INTERACTION_RADIUS);
                const force = Vector.mult(Vector.normalise(delta), forceMagnitude);
                
                Body.applyForce(particleA, particleA.position, Vector.neg(force));
                Body.applyForce(particleB, particleB.position, force);
            }
        }
    }
}

/**
 * Управляет засыпанием и пробуждением частиц воды для оптимизации.
 * Новая логика использует "затухающий" счетчик, который более устойчив
 * к кратковременным подергиваниям частиц, позволяя им уснуть.
 */
function manageWaterSleeping() {
    for (const particle of waterParticles) {
        // Если частица уже спит, мы просто поддерживаем ее счетчик на максимуме
        // и пропускаем дальнейшие проверки.
        if (particle.isSleeping) {
            particle.calmCounter = FRAMES_TO_SLEEP;
            continue;
        }

        // Частица считается "спокойной", если ее скорости ниже пороговых значений.
        const isCalm = particle.speed < SLEEP_SPEED_THRESHOLD && Math.abs(particle.angularVelocity) < SLEEP_ANGULAR_THRESHOLD;

        if (isCalm) {
            // Если частица спокойна, увеличиваем счетчик, но не выше максимума.
            particle.calmCounter = Math.min(FRAMES_TO_SLEEP + 1, (particle.calmCounter || 0) + 1);
        } else {
            // Если частица движется, мы не сбрасываем счетчик в 0, а уменьшаем его.
            // Это позволяет игнорировать небольшие, короткие "всплески" движения.
            particle.calmCounter = Math.max(0, (particle.calmCounter || 0) - CALM_COUNTER_DECAY);
        }
        
        // Если счетчик спокойствия превысил порог, усыпляем частицу.
        if (particle.calmCounter > FRAMES_TO_SLEEP) {
            Sleeping.set(particle, true);
        }
    }
}


export function initializeWater(engineData, cameraData) {
    const { engine } = engineData;

    Events.on(engine, 'beforeUpdate', () => {
        applyLiquidForces(engine);
        manageWaterSleeping();
    });

    function renderWater() {
        const isLiquidEffectEnabled = Dom.liquidEffectToggle.checked;

        Dom.waterContext.clearRect(0, 0, Dom.waterCanvas.width, Dom.waterCanvas.height);

        if (isLiquidEffectEnabled) {
            Dom.waterContext.fillStyle = 'white';
            Dom.waterContext.fillRect(0, 0, Dom.waterCanvas.width, Dom.waterCanvas.height);
        }
        
        Dom.waterContext.save();
        Dom.waterContext.translate(-cameraData.viewOffset.x / cameraData.scale, -cameraData.viewOffset.y / cameraData.scale);
        Dom.waterContext.scale(1 / cameraData.scale, 1 / cameraData.scale);
        Dom.waterContext.fillStyle = waterColor;
        Dom.waterContext.beginPath();
        for (const particle of waterParticles) {
            const pos = particle.position;
            const visualRadius = VISUAL_RADIUS; 
            Dom.waterContext.moveTo(pos.x + visualRadius, pos.y);
            Dom.waterContext.arc(pos.x, pos.y, visualRadius, 0, Math.PI * 2);
        }
        Dom.waterContext.fill();
        Dom.waterContext.restore();
    }

    (function rerender() {
        renderWater();
        requestAnimationFrame(rerender);
    })();
}

export function spawnWaterParticle(engine, world, x, y) {
    const particleProps = { ...waterParticleOptions };
    
    if (waterParticles.length < MAX_PARTICLES) {
        const particle = Bodies.circle(x, y, PHYSICAL_RADIUS, particleProps);
        Body.set(particle, 'createdAt', engine.timing.timestamp);
        particle.calmCounter = 0; // Инициализируем счетчик спокойствия
        World.add(world, particle);
        waterParticles.push(particle);
    } else {
        const particle = waterParticles[currentParticleIndex];
        Sleeping.set(particle, false);
        Body.setPosition(particle, { x, y });
        Body.setVelocity(particle, { x: 0, y: 0 });
        Body.set(particle, 'createdAt', engine.timing.timestamp);
        particle.calmCounter = 0; // Сбрасываем счетчик при переиспользовании
        currentParticleIndex = (currentParticleIndex + 1) % MAX_PARTICLES;
    }
}

export function getWaterParticles() {
    return waterParticles;
}

export function setWaterParticles(newParticles) {
    waterParticles = newParticles;
}

export function setWaterColor(newColor: string) {
    waterColor = newColor;
}