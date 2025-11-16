// @ts-nocheck


import planck from './planck.js';
import * as Dom from './dom.js';
import { toolState, getSelectedBody, deselectBody, deleteSelectedBody, setFirstJointBody, getSelectedSpring, deleteSelectedSpring, deselectSpring } from './selection.js';
import { setWaterColor, deleteAllWater, waterParticlesPool } from './water.js';
import { setSandColor, deleteAllSand, sandParticlesPool } from './sand.js'; // NEW: Импортируем функции для песка
import { showRewardedVideo, showFullscreenAdv, savePlayer_Data } from './yandex.js';
import { t } from './lang.js';
import { PHYSICS_SCALE, LOW_FPS_THRESHOLD, LOW_FPS_COOLDOWN_MS, REWARD_AD_DELAY_SECONDS, TOOL_SETTINGS } from './game_config.js';
import { ImageLoader } from './image_loader.js'; // Импортируем ImageLoader
import { serializeWorld, deserializeWorld } from './world_serializer.js';

// Хранит состояние панелей
const panelState = {
    isSettingsOpen: false,
    isPropertiesOpen: false,
    isSpringPropertiesOpen: false, // NEW
    isRewardMenuOpen: false,
    isSaveLoadOpen: false,
};

let bodyForPropertiesPanel = null; // Текущий объект, для которого открыта панель свойств

let coins = 0;
const rewardProgress = {};
let unlockedSlots = Array(5).fill(false); // Состояние разблокированных слотов
let currentPlaytime = 0; // Время игры в текущей сессии в секундах
let playtimeInterval = null;

// Переменная для управления предупреждением о низкой производительности
let askAboutLowFps = JSON.parse(localStorage.getItem('askAboutLowFps') || 'true');

// Состояние таймера и показа рекламы для каждой кнопки награды
// { rewardAmount: { timerId: number|null, status: 'idle'|'waiting'|'showing'|'failed', remainingTime: number } }
const adProgressStates = new Map();

const NUM_SAVE_SLOTS = 5;
const SAVE_SLOT_PREFIX = 'sandbox_save_';
const SLOT_PRICES = [25, 50, 50, 100, 100]; // Цены для слотов 1-5

// Глобальный объект для отслеживания нажатых клавиш для моторов
export let keyState = {
    ArrowLeft: false,
    ArrowRight: false
};


function applyTranslations() {
    document.title = t('app-title');
    document.querySelectorAll('[data-translate-title]').forEach(el => el.title = t(el.dataset.translateTitle));
    document.querySelectorAll('[data-translate-text]').forEach(el => el.textContent = t(el.dataset.translateText));
}

function initializeFPSCounter(runner) {
    if (!Dom.fpsIndicator) return;
    let frameCount = 0;
    let lastUpdateTime = performance.now();
    
    // Глобальные переменные для FPS-счетчика и предупреждения о низкой производительности
    let latestFPS = 0;
    let lowFpsWarningCooldown = performance.now();

    function updateLoop() {
        const now = performance.now();
        frameCount++;
        if (now - lastUpdateTime > 500) {
            const fps = frameCount / ((now - lastUpdateTime) / 1000);
            latestFPS = fps;
            Dom.fpsIndicator.textContent = `FPS: ${Math.round(fps)}`;
            frameCount = 0;
            lastUpdateTime = now;

            // Проверка низкой производительности
            if (latestFPS <= LOW_FPS_THRESHOLD && askAboutLowFps && runner.enabled && now > lowFpsWarningCooldown) {
                lowFpsWarningCooldown = now + LOW_FPS_COOLDOWN_MS;
                Dom.lowFpsWarning.style.display = 'flex';
                // Автоматически ставим на паузу, пока открыто окно
                runner.enabled = false;
                updatePlayPauseIcons(false);
            }
        }
        requestAnimationFrame(updateLoop);
    }
    requestAnimationFrame(updateLoop);
}

// Новая централизованная функция сохранения
function saveGameState() {
    const dataToSave = {
        coins: coins,
        rewardProgress: rewardProgress,
        unlockedSlots: unlockedSlots
    };
    
    // 1. Сохраняем в localStorage (как надежный локальный бэкап)
    localStorage.setItem('coins', coins.toString());
    localStorage.setItem('rewardProgress', JSON.stringify(rewardProgress));
    localStorage.setItem('unlockedSlots', JSON.stringify(unlockedSlots));
    
    // 2. Сохраняем в облако Яндекса
    savePlayer_Data(dataToSave);
}

// Новая функция для инициализации данных из загруженного состояния
export function initUIData(loadedData) {
    if (loadedData) {
        coins = loadedData.coins || 0;
        // Убедимся, что rewardProgress - это объект
        Object.assign(rewardProgress, loadedData.rewardProgress || {});
        // Загружаем разблокированные слоты, проверяя корректность
        if (Array.isArray(loadedData.unlockedSlots) && loadedData.unlockedSlots.length === NUM_SAVE_SLOTS) {
            unlockedSlots = loadedData.unlockedSlots;
        }
    }
    updateCoinsDisplay();
}

function addCoins(amount) {
    coins += amount;
    saveGameState(); // Используем центральную функцию сохранения
    updateCoinsDisplay();
}

function updateCoinsDisplay() {
    if (Dom.coinsCountSpan) {
        Dom.coinsCountSpan.textContent = coins.toString();
    }
}

/**
 * Динамически обновляет содержимое для кнопки награды и её состояния.
 * @param {HTMLElement} buttonElement - Элемент кнопки (div)
 * @param {object} engineData - Данные движка
 */
function updateRewardButtonUI(buttonElement, engineData) {
    const adsRequired = parseInt(buttonElement.dataset.ads);
    const rewardAmount = parseInt(buttonElement.dataset.reward);

    const currentProgress = rewardProgress[rewardAmount] || 0;
    const adState = adProgressStates.get(rewardAmount) || { status: 'idle', remainingTime: 0, timerId: null };

    // Динамический URL изображения в зависимости от количества награды
    const imageUrl = `https://goida228top.github.io/textures/${rewardAmount} монет.png`;
    const adIconUrl = 'https://goida228top.github.io/textures/реклама.png';
    const adIconHtml = `<img src="${adIconUrl}" alt="Реклама" class="ad-icon">`;


    let progressText = `${currentProgress}/${adsRequired}`;
    let buttonClasses = '';
    let isDisabled = false;

    if (adState.status === 'waiting') {
        progressText = t('watching-ad-countdown', { time: adState.remainingTime });
        buttonClasses = 'watching-ad';
        isDisabled = true;
    } else if (adState.status === 'failed') {
        progressText = t('ad-failed-retry');
        buttonClasses = 'ad-failed';
        isDisabled = false; // Можно попробовать снова
    } else if (adState.status === 'showing') {
        progressText = t('watching-ad-countdown', { time: 0 }); // Показывать "0" или "загрузка"
        buttonClasses = 'watching-ad';
        isDisabled = true;
    } else if (currentProgress >= adsRequired) {
        progressText = t('claim-reward'); // "Получить!"
        buttonClasses = 'ready-to-claim';
    }

    buttonElement.innerHTML = `
        <div class="reward-button-header">${rewardAmount}</div>
        <div class="reward-button-coins-container">
            <img class="reward-tier-image" src="${imageUrl}" alt="${rewardAmount} Резонансов">
        </div>
        <button class="reward-progress-btn ${buttonClasses}" ${isDisabled ? 'disabled' : ''}>
            ${progressText} ${currentProgress < adsRequired ? adIconHtml : ''}
        </button>
    `;

    // Добавляем обработчик клика к новой кнопке прогресса
    const progressButton = buttonElement.querySelector('.reward-progress-btn');
    if (progressButton) {
        progressButton.onclick = () => handleProgressButtonClick(rewardAmount, adsRequired, engineData);
    }
}

/**
 * Обрабатывает клики по внутренней кнопке прогресса/получения награды.
 * @param {number} rewardAmount - Количество Резонансов за эту награду.
 * @param {number} adsRequired - Количество реклам, необходимых для этой награды.
 * @param {object} engineData - Данные движка.
 */
function handleProgressButtonClick(rewardAmount, adsRequired, engineData) {
    const currentProgress = rewardProgress[rewardAmount] || 0;
    const adState = adProgressStates.get(rewardAmount) || { status: 'idle', remainingTime: 0, timerId: null };
    
    // Элемент кнопки
    const btnElement = document.querySelector(`.reward-button[data-reward="${rewardAmount}"]`);

    if (currentProgress < adsRequired) {
        // Если еще не смотрели или реклама провалилась, или это первый клик на "0/N"
        if (adState.status === 'idle' || adState.status === 'failed') {
            // Очищаем предыдущий таймер, если он был
            if (adState.timerId) {
                clearInterval(adState.timerId);
            }

            // Начинаем отсчет задержки
            adProgressStates.set(rewardAmount, {
                status: 'waiting',
                remainingTime: REWARD_AD_DELAY_SECONDS,
                timerId: null
            });
            updateRewardButtonUI(btnElement, engineData); // Обновить UI на "Смотрим рекламу: X сек"

            const timerId = setInterval(() => {
                const state = adProgressStates.get(rewardAmount);
                if (!state || state.status !== 'waiting') { // Кнопка могла быть закрыта или состояние сброшено
                    clearInterval(timerId);
                    return;
                }
                state.remainingTime--;
                if (state.remainingTime <= 0) {
                    clearInterval(timerId);
                    adProgressStates.set(rewardAmount, { status: 'showing', remainingTime: 0, timerId: null });
                    updateRewardButtonUI(btnElement, engineData); // Обновить UI на "Загрузка рекламы..."
                    
                    // Показываем рекламу после задержки
                    showRewardedVideo(
                        engineData,
                        // onRewarded callback
                        () => {
                            rewardProgress[rewardAmount] = (rewardProgress[rewardAmount] || 0) + 1;
                            saveGameState(); // Сохраняем обновленный прогресс
                            adProgressStates.delete(rewardAmount); // Удаляем состояние
                            if (btnElement) updateRewardButtonUI(btnElement, engineData);
                        },
                        // onError callback (or onClose if ad wasn't shown)
                        () => {
                            adProgressStates.set(rewardAmount, { status: 'failed', remainingTime: 0, timerId: null });
                            if (btnElement) updateRewardButtonUI(btnElement, engineData);
                        }
                    );

                } else {
                    updateRewardButtonUI(btnElement, engineData); // Обновляем UI с новым таймером
                }
            }, 1000); // Обновляем каждую секунду
            adProgressStates.get(rewardAmount).timerId = timerId;
        }
    } else {
        // Все рекламы просмотрены, можно получать награду
        addCoins(rewardAmount);
        rewardProgress[rewardAmount] = 0; // Сбрасываем прогресс после получения награды
        saveGameState(); // Сохраняем сброшенный прогресс
        
        // Очищаем любое состояние рекламы
        adProgressStates.delete(rewardAmount);

        // Обновляем UI только для этой кнопки
        if (btnElement) {
            updateRewardButtonUI(btnElement, engineData);
        }
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen'); // Закрываем меню после получения награды
    }
}

function formatPlaytime(totalSeconds) {
    if (totalSeconds < 60) {
        return `${Math.floor(totalSeconds)}s`;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m ${Math.floor(totalSeconds % 60)}s`;
    }
}


// --- Новые функции для панели Сохранения/Загрузки ---
function openSaveLoadPanel(mode, world, cameraData) {
    if (panelState.isSaveLoadOpen) return;
    
    Dom.saveLoadTitle.textContent = t(mode === 'save' ? 'save-game-title' : 'load-game-title');
    populateSaveSlots(mode, world, cameraData);
    
    togglePanel(Dom.saveLoadPanel, 'isSaveLoadOpen');
}

function closeSaveLoadPanel() {
    if (!panelState.isSaveLoadOpen) return;
    togglePanel(Dom.saveLoadPanel, 'isSaveLoadOpen');
}

function populateSaveSlots(mode, world, cameraData) {
    Dom.saveSlotsContainer.innerHTML = ''; // Очищаем существующие слоты
    const saveIconUrl = 'https://goida228top.github.io/textures/сохранение.png';
    const coinIconUrl = 'https://goida228top.github.io/textures/монетка.png';


    for (let i = 0; i < NUM_SAVE_SLOTS; i++) {
        const slotIndex = i + 1;
        const slotKey = `${SAVE_SLOT_PREFIX}${slotIndex}`;
        const slotEl = document.createElement('div');
        slotEl.className = 'save-slot-button';

        if (unlockedSlots[i]) {
            // --- РЕНДЕР РАЗБЛОКИРОВАННОГО СЛОТА ---
            const savedData = localStorage.getItem(slotKey);
            let saveInfo = null;
            if (savedData) {
                try {
                    saveInfo = JSON.parse(savedData);
                } catch (e) {
                    console.error(`Ошибка парсинга слота ${slotIndex}:`, e);
                }
            }
            
            const dateText = saveInfo ? new Date(saveInfo.timestamp).toLocaleString() : t('empty-slot-label');
            const statsHtml = saveInfo ? `
                <div class="save-slot-stats">
                    <div class="stat-item"><span class="stat-icon">🕒</span> ${t('play-time')}: ${formatPlaytime(saveInfo.playtime || 0)}</div>
                    <div class="stat-item"><span class="stat-icon">📦</span> ${t('objects')}: ${saveInfo.stats?.objectCount || 0}</div>
                    <div class="stat-item"><span class="stat-icon">💧</span> ${t('water')}: ${saveInfo.stats?.waterCount || 0}</div>
                    <div class="stat-item"><span class="stat-icon">🏜️</span> ${t('sand')}: ${saveInfo.stats?.sandCount || 0}</div>
                </div>
            ` : '<div class="save-slot-stats" style="min-height: 60px;"></div>'; // Placeholder for alignment
            
            const actionButtonText = t(mode === 'save' ? 'save-button' : 'load-button');
            const saveLoadButtonHtml = (mode === 'load' && !saveInfo) 
                ? '' 
                : `<button class="action-save-load">${actionButtonText}</button>`;
                
            const resetButtonHtml = saveInfo 
                ? `<button class="action-reset">${t('delete-button')}</button>` 
                : '';

            slotEl.innerHTML = `
                <div class="save-button-header">${t('save-slot-label')} ${slotIndex}</div>
                <div class="save-button-image-container">
                    <img class="save-tier-image" src="${saveIconUrl}" alt="${t('save-slot-label')}">
                </div>
                <div class="save-slot-date">${dateText}</div>
                ${statsHtml}
                <div class="save-slot-actions">
                    ${saveLoadButtonHtml}
                    ${resetButtonHtml}
                </div>
            `;
            
            const saveLoadBtn = slotEl.querySelector('.action-save-load');
            if (saveLoadBtn) {
                saveLoadBtn.addEventListener('click', () => {
                    if (mode === 'save') {
                        handleSave(slotKey, world, cameraData);
                    } else {
                        handleLoad(slotKey, world, cameraData);
                    }
                });
            }

            const resetBtn = slotEl.querySelector('.action-reset');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => handleResetSlot(slotKey, mode, world, cameraData));
            }
        } else {
            // --- РЕНДЕР ЗАБЛОКИРОВАННОГО СЛОТА ---
            const price = SLOT_PRICES[i];
            const canAfford = coins >= price;
            const unlockText = t('unlock-for-price', { price });
            const buttonTitle = canAfford ? '' : t('not-enough-resonances');

            slotEl.innerHTML = `
                <div class="save-button-header">${t('save-slot-label')} ${slotIndex}</div>
                <div class="save-button-image-container">
                    <img class="save-tier-image" src="${saveIconUrl}" alt="${t('save-slot-label')}" style="filter: grayscale(1) opacity(0.5);">
                </div>
                <div class="save-slot-date" style="flex-grow: 1;">${t('locked')}</div>
                <div class="save-slot-actions">
                    <button class="action-unlock" ${!canAfford ? 'disabled' : ''} title="${buttonTitle}">
                        ${unlockText}
                        <img src="${coinIconUrl}" class="coin-icon-small" alt="R">
                    </button>
                </div>
            `;
            
            const unlockBtn = slotEl.querySelector('.action-unlock');
            if (unlockBtn) {
                unlockBtn.addEventListener('click', () => handleUnlockSlot(i, price, mode, world, cameraData));
            }
        }
        
        Dom.saveSlotsContainer.appendChild(slotEl);
    }
}

function handleUnlockSlot(slotIndex, price, currentMode, world, cameraData) {
    if (coins >= price) {
        coins -= price;
        unlockedSlots[slotIndex] = true;
        updateCoinsDisplay();
        saveGameState(); // Сохраняем новое состояние монет и слотов
        populateSaveSlots(currentMode, world, cameraData); // Обновляем UI, чтобы показать разблокированный слот
    }
}


function handleSave(slotKey, world, cameraData) {
    console.log(`Сохранение в слот: ${slotKey}`);
    try {
        const { worldState, stats } = serializeWorld(world, waterParticlesPool, sandParticlesPool); // NEW: Передаем пул песка
        const fullSaveState = {
            timestamp: new Date().toISOString(),
            world: worldState,
            camera: {
                scale: cameraData.scale,
                viewOffset: cameraData.viewOffset
            },
            player: {
                coins: coins,
                rewardProgress: rewardProgress,
                unlockedSlots: unlockedSlots, // Снимок состояния слотов
            },
            playtime: currentPlaytime,
            stats: stats,
        };
        localStorage.setItem(slotKey, JSON.stringify(fullSaveState));
        alert(t('game-saved-message'));
        closeSaveLoadPanel();
    } catch (e) {
        console.error('Ошибка сохранения игры:', e);
        alert(t('game-save-failed-message'));
    }
}

function handleLoad(slotKey, world, cameraData) {
    console.log(`Загрузка из слота: ${slotKey}`);
    const savedJSON = localStorage.getItem(slotKey);
    if (!savedJSON) {
        alert(t('slot-empty-message'));
        return;
    }
    try {
        const savedState = JSON.parse(savedJSON);
        
        // Загрузка мира
        deserializeWorld(world, savedState.world);
        
        // Загрузка камеры
        cameraData.restoreCameraState(savedState.camera);
        cameraData.updateView();
        cameraData.applyLiquidFilters(); // Apply filter if liquid effect is enabled

        // Загрузка данных игрока ИЗ СОХРАНЕНИЯ
        const playerData = savedState.player || {};
        coins = playerData.coins || 0;
        Object.assign(rewardProgress, playerData.rewardProgress || {});
        if (Array.isArray(playerData.unlockedSlots) && playerData.unlockedSlots.length === NUM_SAVE_SLOTS) {
            unlockedSlots = playerData.unlockedSlots;
        } else {
            // Откат для старых сохранений, где не было данных о слотах
            unlockedSlots.fill(false); 
        }

        // Загрузка времени игры
        currentPlaytime = savedState.playtime || 0;
        
        // Сохраняем загруженное состояние как основное глобальное состояние игры
        saveGameState();
        updateCoinsDisplay();

        alert(t('game-loaded-message'));
        closeSaveLoadPanel();
    } catch (e) {
        console.error('Ошибка загрузки игры:', e);
        alert(t('game-load-failed-message'));
    }
}

function handleResetSlot(slotKey, currentMode, world, cameraData) {
    if (confirm(t('confirm-delete-save-message'))) {
        localStorage.removeItem(slotKey);
        // Обновляем панель, чтобы показать, что слот пуст
        populateSaveSlots(currentMode, world, cameraData);
    }
}


export function initializeUI(engineData, cameraData, worldData) {
    const { world, runner, render } = engineData;
    const { applyLiquidFilters } = cameraData;
    
    applyTranslations();
    initializeFPSCounter(runner);
    
    // Запускаем таймер времени игры
    if (playtimeInterval) clearInterval(playtimeInterval);
    playtimeInterval = setInterval(() => {
        if (runner.enabled) {
            currentPlaytime += 1; // Увеличиваем каждую секунду, когда игра не на паузе
        }
    }, 1000);

    Dom.settingsButton.addEventListener('click', () => togglePanel(Dom.settingsPanel, 'isSettingsOpen'));

    Dom.saveButton.addEventListener('click', () => {
        openSaveLoadPanel('save', world, cameraData);
    });

    Dom.loadButton.addEventListener('click', () => {
        openSaveLoadPanel('load', world, cameraData);
    });

    Dom.saveLoadCloseBtn.addEventListener('click', closeSaveLoadPanel);

    Dom.gravitySlider.addEventListener('input', (e) => {
        const gravity = parseFloat(e.target.value);
        world.setGravity(planck.Vec2(0, gravity * 9.8)); 
        Dom.gravityValue.textContent = gravity.toFixed(1);
        wakeAllBodies(world);
    });
    // Set initial value
    Dom.gravityValue.textContent = (world.getGravity().y / 9.8).toFixed(1);
    Dom.gravitySlider.value = world.getGravity().y / 9.8;


    Dom.liquidEffectToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        Dom.waterEffectContainer.classList.toggle('liquid-effect-enabled', isEnabled);
        Dom.sandEffectContainer.classList.toggle('liquid-effect-enabled', isEnabled);

        const rootStyles = getComputedStyle(document.documentElement);
        
        // Water color logic
        const opaqueWaterColor = rootStyles.getPropertyValue('--water-color-opaque').trim();
        const transparentWaterColor = rootStyles.getPropertyValue('--water-color-transparent').trim();
        setWaterColor(isEnabled ? opaqueWaterColor : transparentWaterColor);
        
        // Sand color logic - now mirrors water logic
        const opaqueSandColor = rootStyles.getPropertyValue('--sand-color-opaque').trim();
        const transparentSandColor = rootStyles.getPropertyValue('--sand-color-transparent').trim();
        setSandColor(isEnabled ? opaqueSandColor : transparentSandColor);

        applyLiquidFilters();
    });
    Dom.liquidEffectToggle.dispatchEvent(new Event('change'));

    Dom.showHitboxesToggle.addEventListener('change', (e) => {
        engineData.render.options.showHitboxes = e.target.checked;
    });

    Dom.toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            const newTool = button.id.replace('-btn', '');
            switchTool(newTool);
        });
    });

    Dom.playPauseButton.addEventListener('click', () => {
        if (runner.enabled) {
            runner.enabled = false;
            updatePlayPauseIcons(runner.enabled);
        } else {
            showFullscreenAdv(engineData, () => {
                runner.enabled = true;
                updatePlayPauseIcons(runner.enabled);
            });
        }
    });

    initializeObjectPropertiesPanel(world);
    initializeSpringPropertiesPanel(world); // NEW
    initializeLowFpsWarning(runner);
    initializeMotorControls(); // NEW: Инициализация управления моторами
    
    // Новая логика для кнопки coinsDisplay, которая теперь открывает меню наград
    Dom.coinsDisplay.addEventListener('click', () => {
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
        // Обновляем все кнопки меню наград при каждом открытии
        updateRewardButtonUI(Dom.reward10Btn, engineData);
        updateRewardButtonUI(Dom.reward50Btn, engineData);
        updateRewardButtonUI(Dom.reward100Btn, engineData);
    });

    // Обработчик для кнопки "Закрыть" (X) в меню наград
    Dom.rewardMenuCloseBtn.addEventListener('click', () => {
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
        // При закрытии меню наград через кнопку "X", убедимся, что игра не зависла в состоянии "показа рекламы"
        // Но при этом не меняем статус 'runner.enabled', так как это зависит от того, была ли игра на паузе до открытия меню.
        for (const [rewardAmount, state] of adProgressStates.entries()) {
            if (state.timerId) {
                clearInterval(state.timerId);
            }
            // Сбрасываем состояние на "idle" или "failed" в зависимости от того, что было до
            adProgressStates.set(rewardAmount, { status: 'failed', remainingTime: 0, timerId: null });
            const btnElement = document.querySelector(`.reward-button[data-reward="${rewardAmount}"]`);
            if (btnElement) updateRewardButtonUI(btnElement, engineData);
        }
    });


    // Генерируем содержимое для кнопок наград при инициализации UI
    // Теперь это делается при открытии меню, но можно оставить для первого рендера
    updateRewardButtonUI(Dom.reward10Btn, engineData);
    updateRewardButtonUI(Dom.reward50Btn, engineData);
    updateRewardButtonUI(Dom.reward100Btn, engineData);


    document.addEventListener('mousedown', (e) => {
        // Закрытие панели свойств объекта
        if (panelState.isPropertiesOpen && !Dom.objectPropertiesPanel.contains(e.target)) {
            hideObjectPropertiesPanel();
        }
        // Закрытие панели свойств пружины
        if (panelState.isSpringPropertiesOpen && !Dom.springPropertiesPanel.contains(e.target)) {
            hideSpringPropertiesPanel();
        }
        // Закрытие панели настроек
        if (panelState.isSettingsOpen && !Dom.settingsPanel.contains(e.target) && !Dom.settingsButton.contains(e.target)) {
             togglePanel(Dom.settingsPanel, 'isSettingsOpen');
        }
        // Закрытие панели сохранения/загрузки
        if (panelState.isSaveLoadOpen && !Dom.saveLoadPanel.contains(e.target) && !Dom.saveButton.contains(e.target) && !Dom.loadButton.contains(e.target)) {
             closeSaveLoadPanel();
        }
        // Закрытие меню наград
        if (panelState.isRewardMenuOpen && !Dom.rewardMenuPanel.contains(e.target) && !Dom.coinsDisplay.contains(e.target) && !Dom.rewardMenuCloseBtn.contains(e.target)) { 
             togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
             // При закрытии меню наград по клику вне, также сбрасываем состояние рекламы
             for (const [rewardAmount, state] of adProgressStates.entries()) {
                if (state.timerId) {
                    clearInterval(state.timerId);
                }
                adProgressStates.set(rewardAmount, { status: 'failed', remainingTime: 0, timerId: null });
                const btnElement = document.querySelector(`.reward-button[data-reward="${rewardAmount}"]`);
                if (btnElement) updateRewardButtonUI(btnElement, engineData);
             }
        }
    }, true);

    updatePlayPauseIcons(runner.enabled);
    updateCoinsDisplay(); // Обновляем отображение монет при инициализации
}

function updatePlayPauseIcons(isRunning) {
    Dom.playIcon.style.display = isRunning ? 'none' : 'block';
    Dom.pauseIcon.style.display = isRunning ? 'block' : 'none';
    Dom.playPauseButton.title = isRunning ? t('pause-title') : t('play-title');
}

function switchTool(newTool) {
    toolState.currentTool = newTool;
    Dom.toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.id.startsWith(newTool));
    });

    // Сбрасываем состояние, специфичное для инструментов
    deselectBody();
    if (newTool !== 'weld' && newTool !== 'spring') {
        setFirstJointBody(null, null);
    }
}

function initializeObjectPropertiesPanel(world) {
    const updateBodyProperty = (updateFn) => {
        const body = bodyForPropertiesPanel;
        if (!body) return;
        updateFn(body);
        body.setAwake(true);
    };

    const updateMotorProperty = (updateFn) => {
        const body = bodyForPropertiesPanel;
        if (!body) return;
        const userData = body.getUserData() || {};
        if (!userData.motor) userData.motor = {};
        updateFn(userData.motor);
        body.setUserData(userData);
    };


    Dom.objColorInput.addEventListener('input', (e) => updateBodyProperty(body => {
        const userData = body.getUserData() || {};
        if (!userData.render) userData.render = {};
        // Не обновляем fillStyle, если у объекта есть текстура (например, у ТНТ)
        if (!userData.render.texture) {
            userData.render.fillStyle = e.target.value;
        } else {
            // Для текстурированных объектов можем обновить strokeStyle, если есть
            userData.render.strokeStyle = e.target.value; 
        }
        body.setUserData(userData);
    }));

    Dom.objFrictionSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateBodyProperty(body => body.getFixtureList()?.setFriction(value));
        Dom.objFrictionValue.textContent = value.toFixed(1);
    });

    Dom.objRestitutionSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateBodyProperty(body => body.getFixtureList()?.setRestitution(value));
        Dom.objRestitutionValue.textContent = value.toFixed(2);
    });

    Dom.objDensitySlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateBodyProperty(body => {
            body.getFixtureList()?.setDensity(value); 
            body.resetMassData();
        });
        Dom.objDensityValue.textContent = value.toExponential(1);
    });
    
    Dom.objResistanceSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateBodyProperty(body => body.setLinearDamping(value));
        Dom.objResistanceValue.textContent = value.toFixed(1);
    });

    Dom.objStaticToggle.addEventListener('change', (e) => {
        const isStatic = e.target.checked;
        updateBodyProperty(body => body.setType(isStatic ? 'static' : 'dynamic'));
    });

    Dom.deleteSelectedButton.addEventListener('click', () => {
        if (bodyForPropertiesPanel) {
            world.destroyBody(bodyForPropertiesPanel);
        }
        hideObjectPropertiesPanel();
    });

    // --- Motor Event Listeners ---
    Dom.objMotorEnableToggle.addEventListener('change', e => {
        const isEnabled = e.target.checked;
        const body = bodyForPropertiesPanel;
        if (!body) return;

        const userData = body.getUserData() || {};
        if (!userData.motor) userData.motor = {};
        userData.motor.isEnabled = isEnabled;
        
        body.setUserData(userData);
        body.setAwake(true);
    });


    Dom.objMotorSpeedSlider.addEventListener('input', e => {
        const value = parseFloat(e.target.value);
        updateMotorProperty(motor => motor.speed = value);
        Dom.objMotorSpeedValue.textContent = value.toFixed(1);
    });

    Dom.objMotorGripSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateBodyProperty(body => body.getFixtureList()?.setFriction(value));
        Dom.objMotorGripValue.textContent = value.toFixed(1);
    });
}

// NEW: Инициализация панели свойств пружины
function initializeSpringPropertiesPanel(world) {
    Dom.springStiffnessSlider.addEventListener('input', e => {
        const joint = getSelectedSpring();
        if (joint && joint.getType() === 'distance-joint') {
            const value = parseFloat(e.target.value);
            joint.setFrequency(value);
            Dom.springStiffnessValue.textContent = value.toFixed(1);
            joint.getBodyA().setAwake(true);
            joint.getBodyB().setAwake(true);
        }
    });

    Dom.springDampingSlider.addEventListener('input', e => {
        const joint = getSelectedSpring();
        if (joint && joint.getType() === 'distance-joint') {
            const value = parseFloat(e.target.value);
            joint.setDampingRatio(value);
            Dom.springDampingValue.textContent = value.toFixed(2);
            joint.getBodyA().setAwake(true);
            joint.getBodyB().setAwake(true);
        }
    });

    Dom.deleteSelectedSpringButton.addEventListener('click', () => {
        deleteSelectedSpring(world);
        hideSpringPropertiesPanel();
    });
}


function initializeLowFpsWarning(runner) {
    Dom.deleteAllWaterBtn.addEventListener('click', () => {
        deleteAllWater();
        deleteAllSand(); // NEW: Также удаляем песок при нажатии на "Удалить всю воду"
        Dom.lowFpsWarning.style.display = 'none';
        runner.enabled = true;
        updatePlayPauseIcons(true);
    });
    
    Dom.pauseFromWarningBtn.addEventListener('click', () => {
        Dom.lowFpsWarning.style.display = 'none';
        // Оставляем игру на паузе
    });

    Dom.doNothingBtn.addEventListener('click', () => {
        Dom.lowFpsWarning.style.display = 'none';
        runner.enabled = true;
        updatePlayPauseIcons(true);
    });

    Dom.dontAskAgainBtn.addEventListener('click', () => {
        askAboutLowFps = false;
        localStorage.setItem('askAboutLowFps', 'false'); // Сохраняем выбор пользователя
        Dom.lowFpsWarning.style.display = 'none';
        runner.enabled = true;
        updatePlayPauseIcons(true);
    });
}

export function showObjectPropertiesPanel(body, x, y) {
    const fixture = body.getFixtureList();
    if (!fixture) return;

    const userData = body.getUserData() || {};
    const renderData = userData.render || {};
    const motorData = userData.motor || {};
    
    // Показываем/скрываем секцию мотора и правильный слайдер трения
    const isCircle = fixture.getShape().getType() === 'circle';
    Dom.motorPropertiesSection.style.display = isCircle ? 'flex' : 'none';
    Dom.objFrictionContainer.style.display = isCircle ? 'none' : 'flex'; // Прячем обычное трение для колес
    
    // Если у объекта есть текстура (например, у ТНТ), цвет в панели управляет обводкой, а не заливкой
    if (renderData.texture) {
        Dom.objColorInput.value = renderData.strokeStyle || '#cccccc';
    } else {
        Dom.objColorInput.value = renderData.fillStyle || '#cccccc';
    }

    const friction = fixture.getFriction();
    // Устанавливаем значение для соответствующего слайдера
    if (isCircle) {
        Dom.objMotorGripSlider.value = friction;
        Dom.objMotorGripValue.textContent = friction.toFixed(1);
    } else {
        Dom.objFrictionSlider.value = friction;
        Dom.objFrictionValue.textContent = friction.toFixed(1);
    }
    
    Dom.objRestitutionSlider.value = fixture.getRestitution();
    Dom.objRestitutionValue.textContent = fixture.getRestitution().toFixed(2);
    
    const density = fixture.getDensity();
    Dom.objDensitySlider.value = density;
    Dom.objDensityValue.textContent = density.toExponential(1);
    
    const damping = body.getLinearDamping(); // NEW
    Dom.objResistanceSlider.value = damping; // NEW
    Dom.objResistanceValue.textContent = damping.toFixed(1); // NEW
    
    Dom.objStaticToggle.checked = body.isStatic();

    // Заполняем поля мотора
    Dom.objMotorEnableToggle.checked = motorData.isEnabled || false;
    Dom.objMotorSpeedSlider.value = motorData.speed || 10.0;
    Dom.objMotorSpeedValue.textContent = (motorData.speed || 10.0).toFixed(1);

    
    Dom.objectPropertiesPanel.style.display = 'flex';
    Dom.objectPropertiesPanel.style.left = `${x}px`;
    Dom.objectPropertiesPanel.style.top = `${y}px`;
    bodyForPropertiesPanel = body;
    panelState.isPropertiesOpen = true;
}

export function hideObjectPropertiesPanel() {
    Dom.objectPropertiesPanel.style.display = 'none';
    panelState.isPropertiesOpen = false;
    bodyForPropertiesPanel = null;
    deselectBody();
}

// NEW: Функции для показа/скрытия панели свойств пружины
export function showSpringPropertiesPanel(joint, x, y) {
    if (!joint || joint.getType() !== 'distance-joint') return;

    const stiffness = joint.getFrequency();
    const damping = joint.getDampingRatio();

    Dom.springStiffnessSlider.value = stiffness;
    Dom.springStiffnessValue.textContent = stiffness.toFixed(1);
    Dom.springDampingSlider.value = damping;
    Dom.springDampingValue.textContent = damping.toFixed(2);

    Dom.springPropertiesPanel.style.display = 'flex';
    Dom.springPropertiesPanel.style.left = `${x}px`;
    Dom.springPropertiesPanel.style.top = `${y}px`;
    panelState.isSpringPropertiesOpen = true;
}

export function hideSpringPropertiesPanel() {
    Dom.springPropertiesPanel.style.display = 'none';
    panelState.isSpringPropertiesOpen = false;
    deselectSpring();
}

/**
 * Инициализирует глобальные обработчики клавиш для управления всеми моторами.
 */
function initializeMotorControls() {
    window.addEventListener('keydown', (e) => {
        // Предотвращаем управление, если фокус на инпуте
        if (document.activeElement.tagName === 'INPUT') return;
        
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault(); // Предотвращаем прокрутку страницы
            keyState[e.key] = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            keyState[e.key] = false;
        }
    });
}


function makeItRain(world, render) {
    const viewWidth = render.bounds.max.x - render.bounds.min.x;
    const viewCenterX = render.bounds.min.x + viewWidth / 2;

    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const x = (viewCenterX + (Math.random() - 0.5) * viewWidth * 0.8) / PHYSICS_SCALE;
            const y = (render.bounds.min.y - 100 - Math.random() * 200) / PHYSICS_SCALE;
            const radius = (10 + Math.random() * 20) / PHYSICS_SCALE;
            
            const body = world.createDynamicBody({
                position: planck.Vec2(x, y),
                bullet: true,
                userData: {
                    label: 'rain-object',
                    render: { fillStyle: `hsl(${Math.random() * 360}, 70%, 70%)` }
                }
            });
            body.createFixture(planck.Circle(radius), {
                friction: 0.1,
                restitution: 0.5,
                density: 1.0,
            });

        }, i * 50);
    }
}

function wakeAllBodies(world) {
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        body.setAwake(true);
    }
}

function togglePanel(panel, stateKey) {
    const isOpening = !panelState[stateKey];
    panel.style.display = isOpening ? 'flex' : 'none';

    if (isOpening) {
        // Для полноэкранного меню наград позиционирование через JS не требуется, оно обрабатывается CSS.
        if (panel === Dom.rewardMenuPanel || panel === Dom.saveLoadPanel) {
            // Do nothing, CSS handles it.
        } 
        // Если панель настроек, позиционируем относительно кнопки настроек.
        else if (panel === Dom.settingsPanel) {
            const rect = Dom.settingsButton.getBoundingClientRect();
            panel.style.top = `${rect.bottom + 10}px`;
            panel.style.right = '10px';
            panel.style.left = 'auto'; 
        }
        // Панель свойств объекта позиционируется напрямую в showObjectPropertiesPanel.
        // Поэтому здесь нет другой логики позиционирования.
    }
    panelState[stateKey] = isOpening;
}