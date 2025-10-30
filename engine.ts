


import Matter from 'matter-js';
import * as Dom from './dom';

const { Engine, Render, Runner, Events } = Matter;

export function initializeEngine() {
    if (typeof Matter === 'undefined') {
        throw new Error('Matter.js не был загружен.');
    }

    const engine = Engine.create({
        enableSleeping: true,
        // Значительно увеличиваем итерации для максимальной стабильности
        positionIterations: 24,
        velocityIterations: 18,
    });

    const world = engine.world;
    world.gravity.y = 1;

    const render = Render.create({
        element: Dom.container,
        engine: engine,
        options: {
            width: Dom.container.clientWidth,
            height: Dom.container.clientHeight,
            wireframes: false,
            background: 'transparent',
            hasBounds: true
        }
    });

    Render.run(render);

    const runner = Runner.create();
    // По умолчанию симуляция на паузе
    runner.enabled = false;
    Runner.run(runner, engine);
    
    // --- Адаптивная скорость симуляции для стабильности ---
    let collisionCount = 0;
    const HIGH_LOAD_THRESHOLD = 80; // Порог количества коллизий для замедления
    const NORMAL_TIMESCALE = 1.0;
    const SLOW_TIMESCALE = 0.6; // Насколько замедлять

    Events.on(engine, 'collisionStart', (event) => {
        collisionCount += event.pairs.length;
    });

    Events.on(engine, 'beforeUpdate', () => {
        if (collisionCount > HIGH_LOAD_THRESHOLD) {
            engine.timing.timeScale = SLOW_TIMESCALE;
        } else {
            // Плавно возвращаем скорость к норме
            engine.timing.timeScale += (NORMAL_TIMESCALE - engine.timing.timeScale) * 0.1;
        }
        // Сбрасываем счетчик на каждом кадре
        collisionCount = 0;
    });


    return { engine, world, render, runner };
}