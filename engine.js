



import planck from './planck.js';
import * as Dom from './dom.js';
import { PHYSICS_SCALE } from './game_config.js';
import { renderWater, updateWaterPhysics, waterParticlesPool } from './water.js';
import { renderSand, sandParticlesPool } from './sand.js';
import { keyState } from './ui_common.js';
import { SoundManager } from './sound.js';
import { renderWorld } from './render_core.js';
import { isInteractionActive } from './tools.js'; // NEW: Import interaction state
import { updateEffects } from './effects.js'; // NEW: Импорт функции обновления эффектов
import { t } from './lang.js'; // Импорт функции перевода

let isPaused = false;
let cameraData = null;
let beforeRenderCallback = () => {};

// Переменные для оптимизации фона и рендеринга
let lastCameraState = { x: null, y: null, scale: null, width: null, height: null };
let frameCounter = 0; // Для троттлинга
let forceRenderNextFrame = false; // Флаг принудительной отрисовки

// Для честного FPS
let fpsFrameCount = 0;
let fpsLastTime = 0;

// ИИ для Кукол (Ragdoll AI)
function updateRagdolls(world, dt) {
    if (isPaused) return;

    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData();
        
        // Ищем только ТОРС (центр управления)
        if (userData?.label === 'ragdoll-torso' && userData.ragdollState) {
            const state = userData.ragdollState;

            // Если мертв, ничего не делаем (просто тряпка)
            if (state.isDead) continue;

            // Если в нокауте (оглушен), просто уменьшаем таймер
            if (state.stunTimer > 0) {
                state.stunTimer -= dt;
                continue; // Лежим и отдыхаем
            }

            // --- ЛОГИКА БАЛАНСИРОВКИ (Active Ragdoll) ---
            const angle = body.getAngle(); // Текущий наклон
            const angularVelocity = body.getAngularVelocity();
            
            // Коэффициенты силы (PID-контроллер)
            // Еще немного ослабили, чтобы он не был терминатором
            const kP = 40;  
            const kD = 10;  
            
            let torque = 0;
            
            if (Math.abs(angle) > 1.0) { 
                // Режим "Встать"
                torque = -angle * 20 * body.getMass(); 
            } else {
                // Режим "Баланс" (удержание вертикали)
                torque = (-angle * kP) - (angularVelocity * kD);
                torque *= body.getMass();
            }
            
            const maxTorque = 150 * body.getMass();
            torque = Math.max(-maxTorque, Math.min(maxTorque, torque));

            body.applyTorque(torque);
            
            // Всегда будим тело, чтобы физика работала
            body.setAwake(true);
        }
    }
}

// Новая функция для применения сил стабилизации (Wheelie Bar)
function applyStabilizerForces(world) {
    if (isPaused) return;

    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData();
        
        if (userData?.stabilizer?.isEnabled && body.isDynamic()) {
             // 1. Get normalized angle between -PI and PI
            let angle = body.getAngle();
            while (angle <= -Math.PI) angle += 2 * Math.PI;
            while (angle > Math.PI) angle -= 2 * Math.PI;

            const limitDeg = userData.stabilizer.maxAngle || 60;
            const limitRad = limitDeg * (Math.PI / 180);
            
            // 2. Check if angle exceeds limit (relative to flat horizon 0)
            if (Math.abs(angle) > limitRad) {
                const excess = Math.abs(angle) - limitRad;
                const correctionDir = angle > 0 ? -1 : 1;
                const Kp = body.getMass() * 1000 * excess; 
                const Kd = body.getMass() * 40 * body.getAngularVelocity();
                const torque = (correctionDir * Kp) - Kd;
                
                body.applyTorque(torque);
                body.setAwake(true);
            }
        }
    }
}

// Новая функция для применения сил/импульсов от моторов
function applyMotorForces(world) {
    if (isPaused) return;
    
    let moveDirection = 0;
    if (keyState.ArrowRight && !keyState.ArrowLeft) {
        moveDirection = 1; // Вправо
    } else if (keyState.ArrowLeft && !keyState.ArrowRight) {
        moveDirection = -1; // Влево
    }

    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData();
        if (userData?.motor?.isEnabled) {
            const maxSpeed = userData.motor.speed !== undefined ? userData.motor.speed : 150.0;
            const power = userData.motor.power !== undefined ? userData.motor.power : 50.0;
            
            body.setAwake(true);

            if (moveDirection !== 0) {
                body.setAngularVelocity(moveDirection * maxSpeed);
                const thrustFactor = power / 80.0; 
                const thrustForce = body.getMass() * thrustFactor; 
                body.applyLinearImpulse(planck.Vec2(moveDirection * thrustForce, 0), body.getWorldCenter(), true);
                body.setLinearDamping(0);
                body.setAngularDamping(0); 
            } else {
                body.setAngularDamping(5.0); 
                body.setLinearDamping(0.05);
            }
        }
    }
}

function manageBodyStates(world, cameraData) {
    if (!cameraData || !cameraData.render) return;

    const viewBounds = cameraData.render.bounds;
    const cameraAABB = new planck.AABB(
        planck.Vec2(viewBounds.min.x / PHYSICS_SCALE, viewBounds.min.y / PHYSICS_SCALE),
        planck.Vec2(viewBounds.max.x / PHYSICS_SCALE, viewBounds.max.y / PHYSICS_SCALE)
    );

    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData() || {};
        if (!body.isDynamic() || userData.label === 'water' || userData.label === 'sand') {
            continue;
        }

        const fixture = body.getFixtureList();
        if (!fixture) {
            continue;
        }

        const bodyAABB = fixture.getAABB(0); 
        const isVisible = planck.AABB.testOverlap(cameraAABB, bodyAABB);

        if (isVisible) {
            if (!body.isAwake()) {
                body.setAwake(true);
            }
        } else {
            if (body.isAwake()) {
                body.setAwake(false);
            }
        }
    }
}

export function initializeEngine() {
    if (typeof planck === 'undefined') {
        throw new Error('Planck.js не был загружен.');
    }

    const world = planck.World({
        gravity: planck.Vec2(0, 9.8),
    });
    
    world.on('post-solve', (contact, impulse) => {
        const totalImpulse = impulse.normalImpulses[0] + (impulse.normalImpulses[1] || 0);

        // --- ИЗМЕНЕНИЕ: Снижен порог срабатывания звука и урона ---
        // Теперь даже слабые удары считаются (было 2.0)
        if (totalImpulse < 1.0) return;

        const bodyA = contact.getFixtureA().getBody();
        const bodyB = contact.getFixtureB().getBody();
        
        const vA = bodyA.getLinearVelocity();
        const vB = bodyB.getLinearVelocity();
        const relVel = planck.Vec2.sub(vA, vB);
        const impactSpeed = relVel.length();

        if (impactSpeed < 0.5) return;

        const userDataA = bodyA.getUserData() || {};
        const userDataB = bodyB.getUserData() || {};
        
        // --- ОБРАБОТКА УРОНА RAGDOLL (от ударов) ---
        const checkRagdollDamage = (userData) => {
            if (userData.ragdollState && !userData.ragdollState.isDead) {
                // Базовый множитель урона увеличен (было 5 -> 8)
                let damageMultiplier = 8;
                
                // --- КРИТИЧЕСКИЙ УРОН В ГОЛОВУ ---
                if (userData.label === 'ragdoll-head') {
                    damageMultiplier = 40; // Удар головой почти всегда смертелен при падении
                }

                const damage = totalImpulse * damageMultiplier;
                
                // Порог срабатывания снижен (было 5.0 -> 1.0)
                // Теперь любой ощутимый толчок наносит урон
                if (totalImpulse > 1.0) {
                    userData.ragdollState.hp -= damage;
                    
                    // --- МЕХАНИКА ОГЛУШЕНИЯ ---
                    // При ударе кукла "вырубается" и лежит.
                    const stunTime = Math.min(6.0, 1.0 + (totalImpulse / 5));
                    
                    if (stunTime > userData.ragdollState.stunTimer) {
                        userData.ragdollState.stunTimer = stunTime;
                    }

                    if (userData.ragdollState.hp <= 0) {
                        userData.ragdollState.isDead = true;
                        // Отключаем мышцы
                        if (userData.ragdollState.joints) {
                            userData.ragdollState.joints.forEach(joint => {
                                if (joint.m_enableLimit !== undefined) joint.enableLimit(false);
                                if (joint.m_enableMotor !== undefined) joint.enableMotor(false);
                            });
                        }
                    }
                }
            }
        };

        checkRagdollDamage(userDataA);
        checkRagdollDamage(userDataB);
        
        if (userDataA.label === 'water' || userDataA.label === 'sand' || userDataB.label === 'water' || userDataB.label === 'sand') {
            return;
        }

        const now = performance.now();
        const lastSoundA = userDataA.lastCollisionSound || 0;
        const lastSoundB = userDataB.lastCollisionSound || 0;

        if (now - lastSoundA < 150 || now - lastSoundB < 150) return;

        userDataA.lastCollisionSound = now;
        userDataB.lastCollisionSound = now;
        bodyA.setUserData(userDataA);
        bodyB.setUserData(userDataB);
        
        const volume = Math.min(1.0, (totalImpulse * impactSpeed) / 50.0);
        
        if (volume < 0.05) return; 

        const soundName = totalImpulse > 15.0 ? 'collision_heavy' : 'collision_light';
        
        SoundManager.playSound(soundName, { volume });
    });


    const canvas = document.getElementById('physics-canvas');
    if (!canvas) {
        throw new Error('Canvas with id "physics-canvas" not found.');
    }
    
    const render = {
        canvas: canvas,
        context: canvas.getContext('2d'),
        options: {
            width: Dom.container.clientWidth,
            height: Dom.container.clientHeight,
            showHitboxes: false,
        },
        bounds: {
            min: { x: 0, y: 0 },
            max: { x: Dom.container.clientWidth, y: Dom.container.clientHeight }
        }
    };

    const timeStep = 1 / 60;
    let velocityIterations = 8;
    let positionIterations = 3;
    let lastTime = performance.now();
    let accumulator = 0;

    function gameLoop(time) {
        requestAnimationFrame(gameLoop);

        const deltaTime = (time - lastTime) / 1000;
        lastTime = time;
        frameCounter++;

        if (time - fpsLastTime >= 500) { 
            const fps = Math.round((fpsFrameCount * 1000) / (time - fpsLastTime));
            if (Dom.fpsIndicator) {
                Dom.fpsIndicator.textContent = t('debug-fps', { value: fps });
            }
            fpsFrameCount = 0;
            fpsLastTime = time;
        }

        let cameraMoved = false;
        if (cameraData) {
             if (
                lastCameraState.x !== cameraData.viewOffset.x || 
                lastCameraState.y !== cameraData.viewOffset.y || 
                lastCameraState.scale !== cameraData.scale ||
                lastCameraState.width !== render.canvas.width ||
                lastCameraState.height !== render.canvas.height
            ) {
                cameraMoved = true;
            }
        }
        
        const userInteracting = isInteractionActive() || (cameraData && cameraData.isPanning());
        
        if (isPaused && !cameraMoved && !userInteracting && !forceRenderNextFrame) {
            accumulator = 0; 
            return;
        }

        if (cameraData && (cameraMoved || frameCounter % 10 === 0)) {
            manageBodyStates(world, cameraData);
        }

        let hasActiveWater = false;
        for (let i = 0; i < waterParticlesPool.length; i++) {
            if (waterParticlesPool[i].isActive()) {
                hasActiveWater = true;
                break;
            }
        }

        let hasActiveSand = false;
        for (let i = 0; i < sandParticlesPool.length; i++) {
            if (sandParticlesPool[i].isActive()) {
                hasActiveSand = true;
                break;
            }
        }

        if (!isPaused) {
            accumulator += deltaTime;
            
            if (accumulator > 0.1) {
                accumulator = 0.1; 
            }

            while (accumulator >= timeStep) {
                if (hasActiveWater) {
                    updateWaterPhysics();
                }
                applyMotorForces(world); 
                applyStabilizerForces(world); 
                updateRagdolls(world, timeStep); 
                world.step(timeStep, velocityIterations, positionIterations);
                updateEffects(timeStep); 
                accumulator -= timeStep;
            }
        }
        
        if (cameraData) {
            if (cameraMoved || forceRenderNextFrame) {
                beforeRenderCallback(cameraData);
                lastCameraState.x = cameraData.viewOffset.x;
                lastCameraState.y = cameraData.viewOffset.y;
                lastCameraState.scale = cameraData.scale;
                lastCameraState.width = render.canvas.width;
                lastCameraState.height = render.canvas.height;
            }

            renderWorld(world, render, cameraData);
            
            if (hasActiveWater) {
                if (Dom.waterEffectContainer.style.display === 'none') {
                    Dom.waterEffectContainer.style.display = 'block';
                }
                renderWater(cameraData);
            } else {
                if (Dom.waterEffectContainer.style.display !== 'none') {
                    Dom.waterEffectContainer.style.display = 'none';
                    Dom.waterContext.clearRect(0, 0, Dom.waterCanvas.width, Dom.waterCanvas.height);
                }
            }

            if (hasActiveSand) {
                if (Dom.sandEffectContainer.style.display === 'none') {
                    Dom.sandEffectContainer.style.display = 'block';
                }
                renderSand(cameraData);
            } else {
                if (Dom.sandEffectContainer.style.display !== 'none') {
                    Dom.sandEffectContainer.style.display = 'none';
                    Dom.sandContext.clearRect(0, 0, Dom.sandCanvas.width, Dom.sandCanvas.height);
                }
            }
        }

        forceRenderNextFrame = false;
    }
    
    requestAnimationFrame(gameLoop);
    isPaused = true;
    
    return {
        world,
        render,
        get runner() {
            return {
                get enabled() { return !isPaused; },
                set enabled(value) { isPaused = !value; }
            };
        },
        setCamera: (camData) => { cameraData = camData; },
        setBeforeRenderCallback: (cb) => { beforeRenderCallback = cb; },
        setVelocityIterations: (value) => { velocityIterations = value; },
        setPositionIterations: (value) => { positionIterations = value; },
        requestRender: () => { forceRenderNextFrame = true; } 
    };
}