

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
            // Positive angle = Tipping Right/Back (CW)
            // Negative angle = Tipping Left/Front (CCW)
            
            if (Math.abs(angle) > limitRad) {
                // How far past the limit?
                const excess = Math.abs(angle) - limitRad;
                
                // Direction to push back: if angle > 0, we need negative torque.
                const correctionDir = angle > 0 ? -1 : 1;
                
                // PD Controller (Tuned for Wheelie)
                // P (Proportional): Усилен до 1000 для жесткого удержания
                const Kp = body.getMass() * 1000 * excess; 
                
                // D (Derivative): Dampen angular velocity to prevent oscillation
                const Kd = body.getMass() * 40 * body.getAngularVelocity();
                
                // Total Torque
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
        // Проверяем, включен ли мотор на этом объекте
        if (userData?.motor?.isEnabled) {
            const maxSpeed = userData.motor.speed !== undefined ? userData.motor.speed : 150.0;
            // Получаем настроенную мощность (ускорение) или используем дефолт
            const power = userData.motor.power !== undefined ? userData.motor.power : 50.0;
            
            // Гарантированно будим тело
            body.setAwake(true);

            if (moveDirection !== 0) {
                // 1. ВРАЩЕНИЕ (Визуал + физическое сцепление)
                // Задаем угловую скорость напрямую для стабильности
                body.setAngularVelocity(moveDirection * maxSpeed);

                // 2. ТЯГА (Аркадный импульс)
                // Используем настройку Power для расчета силы рывка
                // Значительно уменьшили делитель (с 20.0 до 80.0), чтобы не было "подлета" при старте
                const thrustFactor = power / 80.0; 
                const thrustForce = body.getMass() * thrustFactor; 
                
                // Прикладываем импульс к центру колеса
                body.applyLinearImpulse(planck.Vec2(moveDirection * thrustForce, 0), body.getWorldCenter(), true);

                // Убираем сопротивление воздуха при разгоне
                body.setLinearDamping(0);
                // Убираем сопротивление вращению при разгоне
                body.setAngularDamping(0); 
            } else {
                // 3. ТОРМОЗ (Мягкий)
                
                // Убрали setAngularVelocity(0), так как это вызывало резкий "клев" носом (stoppie).
                // Вместо этого используем сильное угловое затухание.
                body.setAngularDamping(5.0); 
                
                // Сильно снижаем линейное торможение, чтобы байк катился, а не вставал колом
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

        // 1. Проверка импульса (сила * время)
        // Фильтруем совсем слабые касания
        if (totalImpulse < 2.0) return;

        const bodyA = contact.getFixtureA().getBody();
        const bodyB = contact.getFixtureB().getBody();
        
        // 2. НОВАЯ ПРОВЕРКА: Относительная скорость столкновения
        // Импульс может быть большим, если тяжелый объект просто лежит на другом.
        // Скорость же покажет, был ли это удар.
        const vA = bodyA.getLinearVelocity();
        const vB = bodyB.getLinearVelocity();
        const relVel = planck.Vec2.sub(vA, vB);
        const impactSpeed = relVel.length();

        // Если скорость удара меньше 0.5 м/с, считаем это "качением" или "давлением", а не ударом
        if (impactSpeed < 0.5) return;

        const userDataA = bodyA.getUserData() || {};
        const userDataB = bodyB.getUserData() || {};
        
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
        
        // Громкость зависит и от импульса, и от скорости
        const volume = Math.min(1.0, (totalImpulse * impactSpeed) / 50.0);
        
        if (volume < 0.05) return; // Слишком тихо

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

        // --- Честный FPS (Real FPS) ---
        fpsFrameCount++;
        if (time - fpsLastTime >= 500) { // Обновляем текст каждые 500мс
            const fps = Math.round((fpsFrameCount * 1000) / (time - fpsLastTime));
            if (Dom.fpsIndicator) {
                // Использование локализованной строки
                Dom.fpsIndicator.textContent = t('debug-fps', { value: fps });
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
        
        // ПРОВЕРКА НА ЭФФЕКТЫ: Мы не знаем точно, есть ли активные эффекты, но если игра активна, мы должны рендерить.
        // Если игра на паузе, эффекты замерли, но рендерить их надо (это обрабатывается ниже через forceRenderNextFrame или cameraMoved).
        
        // Если игра на паузе, камера стоит и игрок ничего не делает -> полностью пропускаем отрисовку
        // НО: Если установлен флаг forceRenderNextFrame, мы рисуем кадр
        if (isPaused && !cameraMoved && !userInteracting && !forceRenderNextFrame) {
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
            
            if (accumulator > 0.1) {
                accumulator = 0.1; 
            }

            while (accumulator >= timeStep) {
                // Обновляем физику воды
                if (hasActiveWater) {
                    updateWaterPhysics();
                }
                applyMotorForces(world); // Применяем физику моторов
                applyStabilizerForces(world); // Применяем стабилизацию (NEW)
                world.step(timeStep, velocityIterations, positionIterations);
                updateEffects(timeStep); // NEW: Обновляем визуальные эффекты только если игра идет
                accumulator -= timeStep;
            }
        }
        
        if (cameraData) {
            // ОПТИМИЗАЦИЯ ФОНА: Перерисовываем только если камера изменилась
            if (cameraMoved || forceRenderNextFrame) {
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

        // Сбрасываем флаг принудительной отрисовки после того, как кадр нарисован
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
        requestRender: () => { forceRenderNextFrame = true; } // Метод для вызова перерисовки извне
    };
}