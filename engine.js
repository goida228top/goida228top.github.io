
import planck from './planck.js';
import * as Dom from './dom.js';
import { PHYSICS_SCALE } from './game_config.js';
import { renderWater, updateWaterPhysics, waterParticlesPool } from './water.js';
import { renderSand, sandParticlesPool } from './sand.js';
import { keyState } from './ui_common.js';
import { SoundManager } from './sound.js';
import { renderWorld } from './render_core.js';
import { isInteractionActive } from './tools.js'; // NEW: Import interaction state

let isPaused = false;
let cameraData = null;
let beforeRenderCallback = () => {};

// Переменные для оптимизации фона и рендеринга
let lastCameraState = { x: null, y: null, scale: null, width: null, height: null };
let frameCounter = 0; // Для троттлинга

// Для честного FPS
let fpsFrameCount = 0;
let fpsLastTime = 0;

// Новая функция для применения сил/импульсов от моторов
function applyMotorForces(world) {
    if (isPaused) return; // Оптимизация: не считать моторы на паузе
    
    let moveDirection = 0;
    if (keyState.ArrowRight && !keyState.ArrowLeft) {
        moveDirection = 1;
    } else if (keyState.ArrowLeft && !keyState.ArrowRight) {
        moveDirection = -1;
    }
    
    if (moveDirection === 0) {
        return;
    }

    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData();
        if (userData?.motor?.isEnabled) {
            const motorSpeed = userData.motor.speed || 10.0;
            const targetAngVel = moveDirection * Math.abs(motorSpeed);
            
            const currentAngVel = body.getAngularVelocity();
            const angVelChange = targetAngVel - currentAngVel;
            const impulse = body.getInertia() * angVelChange;
            body.applyAngularImpulse(impulse, true);
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
        // Не отключаем воду и песок через awake, они управляются отдельно
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

        if (totalImpulse < 0.2) return;

        const now = performance.now();
        const bodyA = contact.getFixtureA().getBody();
        const bodyB = contact.getFixtureB().getBody();
        
        const userDataA = bodyA.getUserData() || {};
        const userDataB = bodyB.getUserData() || {};
        
        if (userDataA.label === 'water' || userDataA.label === 'sand' || userDataB.label === 'water' || userDataB.label === 'sand') {
            return;
        }

        const lastSoundA = userDataA.lastCollisionSound || 0;
        const lastSoundB = userDataB.lastCollisionSound || 0;

        if (now - lastSoundA < 100 || now - lastSoundB < 100) return;

        userDataA.lastCollisionSound = now;
        userDataB.lastCollisionSound = now;
        bodyA.setUserData(userDataA);
        bodyB.setUserData(userDataB);
        
        const volume = Math.min(1.0, totalImpulse / 8.0);
        const soundName = totalImpulse > 2.5 ? 'collision_heavy' : 'collision_light';
        
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

        // --- Честный FPS (Real FPS) ---
        fpsFrameCount++;
        if (time - fpsLastTime >= 500) { // Обновляем текст каждые 500мс
            const fps = Math.round((fpsFrameCount * 1000) / (time - fpsLastTime));
            if (Dom.fpsIndicator) {
                Dom.fpsIndicator.textContent = `FPS: ${fps}`;
            }
            fpsFrameCount = 0;
            fpsLastTime = time;
        }

        // --- Смарт-Рендеринг: Проверка на необходимость отрисовки ---
        // Если пауза + камера не двигалась + нет ввода = пропускаем кадр
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
        
        // Если игра на паузе, камера стоит и игрок ничего не делает -> полностью пропускаем отрисовку
        if (isPaused && !cameraMoved && !userInteracting) {
            // Даже если мы пропускаем рендер, нужно обновлять время, чтобы при снятии с паузы не было скачка
            accumulator = 0; 
            return;
        }

        // --- Троттлинг ---
        // Запускаем тяжелую проверку видимости (Culling) только раз в 10 кадров
        // или если камера сдвинулась.
        if (cameraData && (cameraMoved || frameCounter % 10 === 0)) {
            manageBodyStates(world, cameraData);
        }

        // ОПТИМИЗАЦИЯ: Проверяем наличие активных частиц, чтобы не перебирать их зря
        // Просто проверка пула дешевая, но рисование пустого слоя - нет.
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
            
            // --- Защита от Спирали Смерти (Spiral of Death) ---
            // Если accumulator слишком большой (лагает физика), мы не пытаемся
            // просчитать все пропущенные кадры, а ограничиваем их.
            // Это замедлит время игры (слоу-мо), но спасет от 0 FPS.
            if (accumulator > 0.1) {
                accumulator = 0.1; // Ограничиваем накопленное время (максимум 6 шагов)
            }

            while (accumulator >= timeStep) {
                // Обновляем физику воды
                if (hasActiveWater) {
                    updateWaterPhysics();
                }
                applyMotorForces(world);
                world.step(timeStep, velocityIterations, positionIterations);
                accumulator -= timeStep;
            }
        }
        
        if (cameraData) {
            // ОПТИМИЗАЦИЯ ФОНА: Перерисовываем только если камера изменилась
            if (cameraMoved) {
                beforeRenderCallback(cameraData);
                lastCameraState.x = cameraData.viewOffset.x;
                lastCameraState.y = cameraData.viewOffset.y;
                lastCameraState.scale = cameraData.scale;
                lastCameraState.width = render.canvas.width;
                lastCameraState.height = render.canvas.height;
            }

            renderWorld(world, render, cameraData);
            
            // ОПТИМИЗАЦИЯ ВОДЫ: Скрываем слой, если нет частиц
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

            // ОПТИМИЗАЦИЯ ПЕСКА: Скрываем слой, если нет частиц
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
        setPositionIterations: (value) => { positionIterations = value; }
    };
}
