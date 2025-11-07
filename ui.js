// @ts-nocheck


import planck from './planck.js';
import * as Dom from './dom.js';
import { toolState, getSelectedBody, deselectBody, deleteSelectedBody } from './selection.js';
import { setWaterColor, deleteAllWater } from './water.js';
import { showRewardedVideo, showFullscreenAdv } from './yandex.js';
import { t } from './lang.js';
import { PHYSICS_SCALE, LOW_FPS_THRESHOLD, LOW_FPS_COOLDOWN_MS, REWARD_AD_DELAY_SECONDS } from './game_config.js';

// Хранит состояние панелей
const panelState = {
    isSettingsOpen: false,
    isPropertiesOpen: false,
    isRewardMenuOpen: false, // Добавлено для нового меню наград
};

let coins = parseInt(localStorage.getItem('coins') || '0'); // Загружаем монеты из localStorage

// Прогресс просмотра рекламы для каждой награды { rewardAmount: adsWatched }
const rewardProgress = JSON.parse(localStorage.getItem('rewardProgress') || '{}');

// Состояние таймера и показа рекламы для каждой кнопки награды
// { rewardAmount: { timerId: number|null, status: 'idle'|'waiting'|'showing'|'failed', remainingTime: number } }
const adProgressStates = new Map();

// Глобальные переменные для FPS-счетчика и предупреждения о низкой производительности
let latestFPS = 0;
let askAboutLowFps = JSON.parse(localStorage.getItem('askAboutLowFps') || 'true');
let lowFpsWarningCooldown = performance.now(); // Время до следующего показа предупреждения


function applyTranslations() {
    document.title = t('app-title');
    document.querySelectorAll('[data-translate-title]').forEach(el => el.title = t(el.dataset.translateTitle));
    document.querySelectorAll('[data-translate-text]').forEach(el => el.textContent = t(el.dataset.translateText));
}

function initializeFPSCounter(runner) {
    if (!Dom.fpsIndicator) return;
    let frameCount = 0;
    let lastUpdateTime = performance.now();
    
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

function addCoins(amount) {
    coins += amount;
    localStorage.setItem('coins', coins.toString()); // Сохраняем монеты в localStorage
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
    const adState = adProgressStates.get(rewardAmount) || { status: 'idle', remainingTime: 0 };

    // Динамический URL изображения в зависимости от количества награды
    const imageUrl = `https://goida228top.github.io/textures/${rewardAmount} монет.png`;

    let buttonText = `${currentProgress}/${adsRequired}`;
    let buttonClasses = '';
    let isDisabled = false;

    if (adState.status === 'waiting') {
        buttonText = t('watching-ad-countdown', { time: adState.remainingTime });
        buttonClasses = 'watching-ad';
        isDisabled = true;
    } else if (adState.status === 'failed') {
        buttonText = t('ad-failed-retry');
        buttonClasses = 'ad-failed';
        isDisabled = false; // Можно попробовать снова
    } else if (adState.status === 'showing') {
        buttonText = t('watching-ad-countdown', { time: 0 }); // Показывать "0" или "загрузка"
        buttonClasses = 'watching-ad';
        isDisabled = true;
    } else if (currentProgress >= adsRequired) {
        buttonText = t('claim-reward'); // "Получить!"
        buttonClasses = 'ready-to-claim';
    }

    buttonElement.innerHTML = `
        <div class="reward-button-header">${rewardAmount}</div>
        <div class="reward-button-coins-container">
            <img class="reward-tier-image" src="${imageUrl}" alt="${rewardAmount} Резонансов">
        </div>
        <button class="reward-progress-btn ${buttonClasses}" ${isDisabled ? 'disabled' : ''}>${buttonText}</button>
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
    const adState = adProgressStates.get(rewardAmount) || { status: 'idle', remainingTime: 0 };
    
    // Элемент кнопки
    const btnElement = document.querySelector(`.reward-button[data-reward="${rewardAmount}"]`);

    if (currentProgress < adsRequired) {
        // Если еще не смотрели или реклама провалилась, или это первый клик на "0/N"
        if (adState.status === 'idle' || adState.status === 'failed') {
            // Начинаем отсчет задержки
            adProgressStates.set(rewardAmount, {
                status: 'waiting',
                remainingTime: REWARD_AD_DELAY_SECONDS,
                timerId: null
            });
            updateRewardButtonUI(btnElement, engineData); // Обновить UI на "Смотрим рекламу: X сек"

            const timerId = setInterval(() => {
                const state = adProgressStates.get(rewardAmount);
                if (!state) { // Кнопка могла быть закрыта или состояние сброшено
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
                            localStorage.setItem('rewardProgress', JSON.stringify(rewardProgress));
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
        localStorage.setItem('rewardProgress', JSON.stringify(rewardProgress));
        
        // Очищаем любое состояние рекламы
        adProgressStates.delete(rewardAmount);

        // Обновляем UI только для этой кнопки
        if (btnElement) {
            updateRewardButtonUI(btnElement, engineData);
        }
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen'); // Закрываем меню после получения награды
    }
}


export function initializeUI(engineData, cameraData, worldData) {
    const { world, runner, render } = engineData;
    const { applyWaterFilter } = cameraData;
    
    applyTranslations();
    initializeFPSCounter(runner);

    Dom.settingsButton.addEventListener('click', () => togglePanel(Dom.settingsPanel, 'isSettingsOpen'));

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
        const rootStyles = getComputedStyle(document.documentElement);
        const opaqueColor = rootStyles.getPropertyValue('--water-color-opaque').trim();
        const transparentColor = rootStyles.getPropertyValue('--water-color-transparent').trim();
        setWaterColor(isEnabled ? opaqueColor : transparentColor);
        applyWaterFilter();
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
    initializeLowFpsWarning(runner);
    
    // Новая логика для кнопки coinsDisplay, которая теперь открывает меню наград
    Dom.coinsDisplay.addEventListener('click', () => {
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
        // Обновляем все кнопки меню наград при каждом открытии
        updateRewardButtonUI(Dom.reward10Btn, engineData);
        updateRewardButtonUI(Dom.reward50Btn, engineData);
        updateRewardButtonUI(Dom.reward100Btn, engineData);
    });

    // Обработчик для кнопки "Назад" в меню наград
    Dom.rewardMenuBackBtn.addEventListener('click', () => {
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
        // При закрытии меню наград через кнопку "Назад", убедимся, что игра не зависла в состоянии "показа рекламы"
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
        // Закрытие панели настроек
        if (panelState.isSettingsOpen && !Dom.settingsPanel.contains(e.target) && !Dom.settingsButton.contains(e.target)) {
             togglePanel(Dom.settingsPanel, 'isSettingsOpen');
        }
        // Закрытие меню наград
        // Проверяем, что клик не был на самой кнопке coinsDisplay и не внутри rewardMenuPanel
        if (panelState.isRewardMenuOpen && !Dom.rewardMenuPanel.contains(e.target) && !Dom.coinsDisplay.contains(e.target) && !Dom.rewardMenuBackBtn.contains(e.target)) {
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
    if (newTool !== 'move' && newTool !== 'finger') {
        deselectBody();
    }
}

function initializeObjectPropertiesPanel(world) {
    const updateBodyProperty = (updateFn) => {
        const body = getSelectedBody();
        if (!body) return;
        updateFn(body);
        body.setAwake(true);
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
        Dom.objFrictionValue.textContent = value.toFixed(2);
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

    Dom.objStaticToggle.addEventListener('change', (e) => {
        const isStatic = e.target.checked;
        updateBodyProperty(body => body.setType(isStatic ? 'static' : 'dynamic'));
    });

    Dom.deleteSelectedButton.addEventListener('click', () => {
        deleteSelectedBody(world);
        hideObjectPropertiesPanel();
    });
}

function initializeLowFpsWarning(runner) {
    Dom.deleteAllWaterBtn.addEventListener('click', () => {
        deleteAllWater();
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
    
    // Если у объекта есть текстура (например, ТНТ), цвет в панели управляет обводкой, а не заливкой
    if (renderData.texture) {
        Dom.objColorInput.value = renderData.strokeStyle || '#cccccc';
    } else {
        Dom.objColorInput.value = renderData.fillStyle || '#cccccc';
    }

    Dom.objFrictionSlider.value = fixture.getFriction();
    Dom.objFrictionValue.textContent = fixture.getFriction().toFixed(2);
    Dom.objRestitutionSlider.value = fixture.getRestitution();
    Dom.objRestitutionValue.textContent = fixture.getRestitution().toFixed(2);
    
    const density = fixture.getDensity();
    Dom.objDensitySlider.value = density;
    Dom.objDensityValue.textContent = density.toExponential(1);
    
    Dom.objStaticToggle.checked = body.isStatic();
    
    Dom.objectPropertiesPanel.style.display = 'flex';
    Dom.objectPropertiesPanel.style.left = `${x}px`;
    Dom.objectPropertiesPanel.style.top = `${y}px`;
    panelState.isPropertiesOpen = true;
}

export function hideObjectPropertiesPanel() {
    Dom.objectPropertiesPanel.style.display = 'none';
    panelState.isPropertiesOpen = false;
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
        if (panel === Dom.rewardMenuPanel) {
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