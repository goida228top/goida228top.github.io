// @ts-nocheck
import { initializeEngine } from './engine.js';
import { initializeCamera, resizeCamera } from './camera.js';
import { setupWorld } from './world.js';
import { initializeWater } from './water.js';
import { initializeTools } from './tools.js';
import { initializeUI } from './ui.js';
import { initializeSelection } from './selection.js';
import { initYandexSDK } from './yandex.js';

async function main() {
    const ysdk = await initYandexSDK();
    if (!ysdk) {
        console.warn('Yandex SDK failed to initialize, ads will not be available.');
    }

    // 1. Инициализируем базовые системы
    const engineData = initializeEngine();
    const cameraData = initializeCamera(engineData.render);

    // 2. Настраиваем зависимости между модулями
    initializeSelection(engineData.render, cameraData);

    // 3. Создаем мир и воду
    const worldData = setupWorld(engineData.world, engineData.render.options.height);
    initializeWater(engineData, cameraData);

    // 4. Подключаем UI и инструменты, передавая им нужные зависимости
    initializeUI(engineData, cameraData, worldData);
    initializeTools(engineData, cameraData, worldData);


    // 5. Обработка изменения размера окна
    function onResize() {
        const { world, render } = engineData;
        const newHeight = render.canvas.parentElement.clientHeight;
        
        // Обновляем камеру
        resizeCamera(render);
        
        // Пересоздаем мир с учетом новых размеров
        setupWorld(world, newHeight);
        
        // Обновляем вид
        cameraData.updateView();
    }

    window.addEventListener('resize', onResize);

    // Первоначальная настройка после загрузки DOM
    onResize();
}

main();
