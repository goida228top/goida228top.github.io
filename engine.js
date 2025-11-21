
import planck from './planck.js';
import * as Dom from './dom.js';
import { PHYSICS_SCALE } from './game_config.js';
import { renderWater, updateWaterPhysics } from './water.js';
import { renderSand } from './sand.js';
import { keyState } from './ui_common.js';
import { SoundManager } from './sound.js';
import { renderWorld } from './render_core.js';

let isPaused = false;
let cameraData = null;
let beforeRenderCallback = () => {};

// Новая функция для применения сил/импульсов от моторов
function applyMotorForces(world) {
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
        const userData = body.getUserData() || {};
        if (!body.isDynamic()) {
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

        if (cameraData) {
            manageBodyStates(world, cameraData);
        }

        if (!isPaused) {
            accumulator += deltaTime;
            while (accumulator >= timeStep) {
                updateWaterPhysics();
                applyMotorForces(world);
                world.step(timeStep, velocityIterations, positionIterations);
                accumulator -= timeStep;
            }
        }
        
        if (cameraData) {
            beforeRenderCallback(cameraData);
            renderWorld(world, render, cameraData);
            renderWater(cameraData);
            renderSand(cameraData);
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
