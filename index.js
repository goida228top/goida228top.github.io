// @ts-nocheck
import * as Dom from './dom.js';
import { initializeEngine } from './engine.js';
import { initializeCamera, resizeCamera } from './camera.js';
import { setupWorld } from './world.js';
import { initializeWater } from './water.js';
import { initializeTools } from './tools.js';
import { initializeUI } from './ui.js';
import { initYandexSDK, gameReady } from './yandex.js';
import { initializeBackground, renderBackground } from './background.js';
import { ALL_IMAGE_URLS } from './game_config.js'; // Импортируем список всех изображений
import { ImageLoader } from './image_loader.js'; // Импортируем ImageLoader

const loadingOverlay = document.getElementById('loading-overlay');
const progressBar = document.getElementById('progress-bar');
const loadingText = document.getElementById('loading-text');

let currentProgress = 0;

function updateProgress(value) {
    currentProgress = Math.min(100, Math.max(0, value));
    progressBar.style.width = `${currentProgress}%`;
    loadingText.textContent = `${Math.round(currentProgress)}%`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    // --- Экран загрузки ---
    updateProgress(10);
    
    let sdkProgress = 10;
    const sdkProgressInterval = setInterval(() => {
        if (sdkProgress < 20) { // Меньший диапазон для SDK, чтобы освободить место для загрузки изображений
            sdkProgress += Math.random() * 2;
            updateProgress(sdkProgress);
        }
    }, 100);
    
    const ysdk = await initYandexSDK();
    clearInterval(sdkProgressInterval);
    if (!ysdk) {
        console.warn('Yandex SDK failed to initialize, ads will not be available.');
    }
    updateProgress(20);
    await sleep(150);

    // --- Предварительная загрузка изображений ---
    const imageLoadProgressIncrement = 30 / ALL_IMAGE_URLS.length; // 30% прогресса на изображения
    let imagesLoadedCount = 0;
    
    await ImageLoader.preloadImages(ALL_IMAGE_URLS, () => {
        imagesLoadedCount++;
        const progress = 20 + (imagesLoadedCount * imageLoadProgressIncrement); // Начинаем с 20%
        updateProgress(progress);
    });
    updateProgress(50); // Убедимся, что после загрузки изображений прогресс 50%
    await sleep(150);

    // 1. Движок создает мир и кастомный объект рендера
    const engineData = initializeEngine();
    updateProgress(60);
    await sleep(150);
    
    // 2. Камера подключается к объекту рендера и добавляет управление
    const cameraData = initializeCamera(engineData.render);
    engineData.setCamera(cameraData); // Передаем данные камеры в движок для рендера

    // 3. Инициализируем фон
    initializeBackground();
    // 4. Устанавливаем колбек для отрисовки фона перед отрисовкой физики
    engineData.setBeforeRenderCallback(() => renderBackground(cameraData));
    updateProgress(70);
    await sleep(150);


    // 5. Создаем мир и воду
    const worldData = setupWorld(engineData.world, engineData.render.options.height);
    updateProgress(80);
    await sleep(150);
    
    initializeWater(engineData);
    updateProgress(85);
    await sleep(100);

    // 6. Подключаем UI и инструменты, передавая им нужные зависимости
    await initializeTools(engineData, cameraData, worldData); // Добавляем await здесь
    updateProgress(90);
    await sleep(150);
    
    initializeUI(engineData, cameraData, worldData);
    updateProgress(95);
    await sleep(100);
    
    // 7. Обработка изменения размера окна
    function onResize() {
        const { world, render } = engineData;
        
        resizeCamera(render); // Изменяет размеры всех canvas
        const newHeight = render.canvas.parentElement.clientHeight;
        setupWorld(world, newHeight);
        cameraData.updateView();

        // Обновляем размеры в "виртуальном" рендере движка
        render.options.width = render.canvas.width;
        render.options.height = render.canvas.height;
    }

    window.addEventListener('resize', onResize);
    onResize();
    updateProgress(100);
    
    // Завершение загрузки
    await sleep(500); // Даем пользователю увидеть 100%
    loadingOverlay.classList.add('fade-out');
    
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        gameReady();
    }, 500);
}

main();