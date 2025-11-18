
import * as Dom from './dom.js';
import { SoundManager } from './sound.js';
import { t } from './lang.js';
import { savePlayer_Data, loadPlayer_Data, showRewardedVideo, showFullscreenAdv } from './yandex.js';
import { serializeWorld, deserializeWorld } from './world_serializer.js';
import { PHYSICS_SCALE, TOOL_SETTINGS } from './game_config.js';
import { deleteAllWater, setWaterColor } from './water.js';
import { deleteAllSand, setSandColor } from './sand.js';
import { 
    selectBody, deselectBody, getSelectedBody, deleteSelectedBody, 
    selectSpring, deselectSpring, getSelectedSpring, deleteSelectedSpring, 
    toolState 
} from './selection.js';
import planck from './planck.js';

export const keyState = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

export let playerData = {
    coins: 0,
    rewardProgress: {},
    unlockedSlots: [false, false, false, false, false]
};

const panelState = {
    isSettingsOpen: false,
    isPropertiesOpen: false,
    isSpringPropertiesOpen: false,
    isSaveLoadOpen: false,
    isRewardMenuOpen: false,
    isAboutPanelOpen: false
};

let playtimeInterval = null;
let currentPlaytime = 0;
let fpsInterval = null;

export function initUIData(data) {
    if (data) {
        playerData = data;
        // Ensure unlockedSlots exists
        if (!playerData.unlockedSlots) {
            playerData.unlockedSlots = [false, false, false, false, false];
        }
        updateCoinsDisplay();
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

    // --- Yandex Games Moderation Fix: Prevent context menu on all UI panels ---
    const protectedPanels = [
        Dom.mainMenuOverlay,
        Dom.rewardMenuPanel,
        Dom.saveLoadPanel,
        Dom.settingsPanel,
        Dom.aboutPanel,
        Dom.objectPropertiesPanel, // Также защищаем игровые панели
        Dom.springPropertiesPanel,
        Dom.lowFpsWarning,
        Dom.confirmModalOverlay
    ];

    protectedPanels.forEach(panel => {
        if (panel) {
            panel.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
        }
    });

    // --- Main Menu Listeners ---
    Dom.startGameBtn.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        startGame(engineData);
    });

    Dom.loadGameMenuBtn.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        openSaveLoadPanel('load', world, cameraData, engineData);
    });

    Dom.aboutGameBtn.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.aboutPanel, 'isAboutPanelOpen');
    });

    Dom.aboutPanelCloseBtn.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.aboutPanel, 'isAboutPanelOpen');
    });
    
    // --- Toolbar Button Listeners ---
    Dom.settingsButton.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.settingsPanel, 'isSettingsOpen');
    });

    Dom.saveButton.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        openSaveLoadPanel('save', world, cameraData, engineData);
    });

    Dom.loadButton.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        openSaveLoadPanel('load', world, cameraData, engineData);
    });

    Dom.saveLoadCloseBtn.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        closeSaveLoadPanel();
    });

    Dom.gravitySlider.addEventListener('input', (e) => {
        const gravity = parseFloat(e.target.value);
        world.setGravity(planck.Vec2(0, gravity * 9.8)); 
        Dom.gravityValue.textContent = gravity.toFixed(1);
        wakeAllBodies(world);
    });
    // Set initial value
    if(world) {
        Dom.gravityValue.textContent = (world.getGravity().y / 9.8).toFixed(1);
        Dom.gravitySlider.value = world.getGravity().y / 9.8;
    }


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

        if (applyLiquidFilters) applyLiquidFilters();
    });
    Dom.liquidEffectToggle.dispatchEvent(new Event('change'));

    Dom.showHitboxesToggle.addEventListener('change', (e) => {
        engineData.render.options.showHitboxes = e.target.checked;
    });

    // NEW: Sound category toggles logic
    const initialMuteSettings = SoundManager.loadMuteSettings();
    Dom.uiSoundsToggle.checked = !initialMuteSettings.ui;
    Dom.objectSoundsToggle.checked = !initialMuteSettings.object;
    Dom.environmentSoundsToggle.checked = !initialMuteSettings.environment;

    Dom.uiSoundsToggle.addEventListener('change', (e) => {
        SoundManager.setCategoryMute('ui', !e.target.checked);
    });

    Dom.objectSoundsToggle.addEventListener('change', (e) => {
        SoundManager.setCategoryMute('object', !e.target.checked);
    });

    Dom.environmentSoundsToggle.addEventListener('change', (e) => {
        SoundManager.setCategoryMute('environment', !e.target.checked);
    });


    Dom.toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            SoundManager.playSound('ui_click', { pitch: 1.1 });
            const newTool = button.id.replace('-btn', '');
            switchTool(newTool);
        });
    });

    // NEW: Centralized play/pause handler
    const handlePlayPause = () => {
        if (runner.enabled) {
            runner.enabled = false;
            updatePlayPauseIcons(false);
        } else {
            showFullscreenAdv(engineData, () => {
                runner.enabled = true;
                updatePlayPauseIcons(true);
            });
        }
    };
    
    Dom.playPauseButton.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        handlePlayPause();
    });

    // NEW: Add listener for Clear All button
    Dom.clearAllButton.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        showConfirm(t('confirm-title'), t('confirm-clear-all'), () => {
            clearWorldCompletely(world);
            SoundManager.playSound('explosion_medium', { volume: 0.5 });
            showToast(t('world-cleared-message'), 'info');
        });
    });


    // NEW: Add keyboard listener for Spacebar
    document.addEventListener('keydown', (e) => {
        // Игнорируем нажатие, если фокус на элементе ввода
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            return;
        }

        if (e.code === 'Space') {
            e.preventDefault(); // Предотвращаем стандартное действие (например, прокрутку)
            SoundManager.playSound('ui_click');
            handlePlayPause();
        }
    });

    initializeObjectPropertiesPanel(world);
    initializeSpringPropertiesPanel(world); // NEW
    initializeLowFpsWarning(runner);
    initializeMotorControls(); // NEW: Инициализация управления моторами
    
    // Новая логика для кнопки coinsDisplay, которая теперь открывает меню наград
    Dom.coinsDisplay.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
        // Обновляем все кнопки меню наград при каждом открытии
        updateRewardButtonUI(Dom.reward10Btn, engineData);
        updateRewardButtonUI(Dom.reward50Btn, engineData);
        updateRewardButtonUI(Dom.reward100Btn, engineData);
    });

    // Обработчик для кнопки "Закрыть" (X) в меню наград
    Dom.rewardMenuCloseBtn.addEventListener('click', () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
    });

    // Генерируем содержимое для кнопок наград при инициализации UI
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
        }
        // Закрытие панели "Об игре"
        if (panelState.isAboutPanelOpen && !Dom.aboutPanel.contains(e.target) && !Dom.aboutGameBtn.contains(e.target) && !Dom.aboutPanelCloseBtn.contains(e.target)) {
            togglePanel(Dom.aboutPanel, 'isAboutPanelOpen');
        }
    }, true);

    // --- NEW: Pause on visibility change ---
    let wasRunningBeforeHidden = false;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Если игра активна, запоминаем это и ставим на паузу
            if (runner.enabled) {
                wasRunningBeforeHidden = true;
                runner.enabled = false;
                updatePlayPauseIcons(false);
            }
        } else {
            // Если игра была активна до сворачивания, возобновляем
            if (wasRunningBeforeHidden) {
                runner.enabled = true;
                updatePlayPauseIcons(true);
            }
            // Сбрасываем флаг в любом случае
            wasRunningBeforeHidden = false;
        }
    });

    updatePlayPauseIcons(runner.enabled);
    updateCoinsDisplay(); // Обновляем отображение монет при инициализации
}

// --- Helper Functions ---

function initializeMotorControls() {
    document.addEventListener('keydown', (e) => {
        if (keyState.hasOwnProperty(e.code)) {
            keyState[e.code] = true;
        }
    });
    document.addEventListener('keyup', (e) => {
        if (keyState.hasOwnProperty(e.code)) {
            keyState[e.code] = false;
        }
    });
}

function togglePanel(panel, stateKey) {
    const isOpen = panel.style.display === 'flex';
    panel.style.display = isOpen ? 'none' : 'flex';
    if (stateKey) {
        panelState[stateKey] = !isOpen;
    }
}

export function showObjectPropertiesPanel(body, x, y) {
    if (panelState.isPropertiesOpen) {
        hideObjectPropertiesPanel();
    }

    const userData = body.getUserData() || {};
    const renderStyle = userData.render || {};
    const color = renderStyle.fillStyle || '#cccccc';

    Dom.objColorInput.value = color;
    Dom.objStaticToggle.checked = body.getType() === 'static';

    // --- Обновление значений слайдеров из свойств тела ---
    // Плотность
    let density = body.getFixtureList()?.getDensity() || 1.0;
    // Если плотность очень маленькая (для маленьких объектов), корректируем отображение
    if (density < 0.01) density = 0.001; 
    Dom.objDensitySlider.value = density;
    Dom.objDensityValue.textContent = density.toExponential(1);

    // Трение
    const friction = body.getFixtureList()?.getFriction() || 0.3;
    Dom.objFrictionSlider.value = friction;
    Dom.objFrictionValue.textContent = friction.toFixed(1);

    // Упругость
    const restitution = body.getFixtureList()?.getRestitution() || 0.1;
    Dom.objRestitutionSlider.value = restitution;
    Dom.objRestitutionValue.textContent = restitution.toFixed(2);

    // Сопротивление (linearDamping)
    const damping = body.getLinearDamping();
    Dom.objResistanceSlider.value = damping;
    Dom.objResistanceValue.textContent = damping.toFixed(1);


    // --- Логика отображения свойств мотора ---
    let hasCircleFixture = false;
    for (let f = body.getFixtureList(); f; f = f.getNext()) {
        if (f.getShape().getType() === 'circle') {
            hasCircleFixture = true;
            break;
        }
    }

    if (hasCircleFixture) {
        Dom.motorPropertiesSection.style.display = 'flex';
        
        const motorData = userData.motor || { isEnabled: false, speed: 10.0, grip: 0.8 };
        
        Dom.objMotorEnableToggle.checked = motorData.isEnabled;
        Dom.objMotorSpeedSlider.value = motorData.speed;
        Dom.objMotorSpeedValue.textContent = motorData.speed.toFixed(1);
        
        // Grip (сцепление) - это по сути трение
        const currentFriction = body.getFixtureList().getFriction();
        Dom.objMotorGripSlider.value = currentFriction;
        Dom.objMotorGripValue.textContent = currentFriction.toFixed(1);

        // Управление видимостью слайдеров скорости и сцепления
        if (motorData.isEnabled) {
             Dom.objMotorSpeedSlider.parentElement.style.display = 'flex';
             Dom.objMotorGripContainer.style.display = 'flex';
             Dom.objFrictionContainer.style.display = 'none'; // Скрываем обычное трение
        } else {
             Dom.objMotorSpeedSlider.parentElement.style.display = 'none';
             Dom.objMotorGripContainer.style.display = 'none';
             Dom.objFrictionContainer.style.display = 'flex'; // Показываем обычное трение
        }

    } else {
        Dom.motorPropertiesSection.style.display = 'none';
        Dom.objFrictionContainer.style.display = 'flex'; // Всегда показываем для не-кругов
    }


    Dom.objectPropertiesPanel.style.display = 'flex';
    Dom.objectPropertiesPanel.style.left = `${Math.min(x, window.innerWidth - 270)}px`;
    Dom.objectPropertiesPanel.style.top = `${Math.min(y, window.innerHeight - 400)}px`;
    
    panelState.isPropertiesOpen = true;
}

export function hideObjectPropertiesPanel() {
    Dom.objectPropertiesPanel.style.display = 'none';
    deselectBody();
    panelState.isPropertiesOpen = false;
}

export function showSpringPropertiesPanel(joint, x, y) {
    if (panelState.isSpringPropertiesOpen) {
        hideSpringPropertiesPanel();
    }

    // Получаем текущие свойства пружины
    const stiffness = joint.getFrequency();
    const damping = joint.getDampingRatio();
    const length = joint.getLength();
    const userData = joint.getUserData() || {};

    Dom.springStiffnessSlider.value = stiffness;
    Dom.springStiffnessValue.textContent = stiffness.toFixed(1);

    Dom.springDampingSlider.value = damping;
    Dom.springDampingValue.textContent = damping.toFixed(2);
    
    Dom.springLengthSlider.value = length;
    Dom.springLengthValue.textContent = length.toFixed(2);
    
    // Логика для "Фиксированной пружины"
    Dom.springFixedToggle.checked = !!userData.isFixed;

    Dom.springPropertiesPanel.style.display = 'flex';
    Dom.springPropertiesPanel.style.left = `${Math.min(x, window.innerWidth - 270)}px`;
    Dom.springPropertiesPanel.style.top = `${Math.min(y, window.innerHeight - 300)}px`;
    
    panelState.isSpringPropertiesOpen = true;
}

export function hideSpringPropertiesPanel() {
    Dom.springPropertiesPanel.style.display = 'none';
    deselectSpring();
    panelState.isSpringPropertiesOpen = false;
}

function initializeObjectPropertiesPanel(world) {
    // Listeners for object properties
    Dom.objColorInput.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const userData = body.getUserData() || {};
            if (!userData.render) userData.render = {};
            userData.render.fillStyle = e.target.value;
            // Если это текстурированный объект, удаляем текстуру чтобы применился цвет
            if (userData.render.texture) {
                delete userData.render.texture;
                delete userData.render.textureUrl;
            }
            body.setUserData(userData);
            body.setAwake(true);
        }
    });

    // Слушатель для плотности
    Dom.objDensitySlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const density = parseFloat(e.target.value);
            Dom.objDensityValue.textContent = density.toExponential(1);
            for (let f = body.getFixtureList(); f; f = f.getNext()) {
                f.setDensity(density);
            }
            body.resetMassData();
            body.setAwake(true);
        }
    });

    // Слушатель для трения
    Dom.objFrictionSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const friction = parseFloat(e.target.value);
            Dom.objFrictionValue.textContent = friction.toFixed(1);
            for (let f = body.getFixtureList(); f; f = f.getNext()) {
                f.setFriction(friction);
            }
            body.setAwake(true);
        }
    });
    
    // Слушатель для сопротивления
    Dom.objResistanceSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const damping = parseFloat(e.target.value);
            Dom.objResistanceValue.textContent = damping.toFixed(1);
            body.setLinearDamping(damping);
            body.setAwake(true);
        }
    });

    Dom.objRestitutionSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const restitution = parseFloat(e.target.value);
            Dom.objRestitutionValue.textContent = restitution.toFixed(2);
            for (let f = body.getFixtureList(); f; f = f.getNext()) {
                f.setRestitution(restitution);
            }
            body.setAwake(true);
        }
    });

    Dom.objStaticToggle.addEventListener('change', (e) => {
        const body = getSelectedBody();
        if (body) {
            body.setType(e.target.checked ? 'static' : 'dynamic');
            body.setAwake(true);
        }
    });

    Dom.deleteSelectedButton.addEventListener('click', () => {
        deleteSelectedBody(world);
        hideObjectPropertiesPanel();
    });
    
    // --- NEW: Listeners for Motor Properties ---
    
    Dom.objMotorEnableToggle.addEventListener('change', (e) => {
        const body = getSelectedBody();
        if (body) {
            const isEnabled = e.target.checked;
            const userData = body.getUserData() || {};
            if (!userData.motor) userData.motor = { speed: 10.0, grip: 0.8 };
            userData.motor.isEnabled = isEnabled;
            body.setUserData(userData);
            
            // Переключаем видимость
            if (isEnabled) {
                 Dom.objMotorSpeedSlider.parentElement.style.display = 'flex';
                 Dom.objMotorGripContainer.style.display = 'flex';
                 Dom.objFrictionContainer.style.display = 'none';
            } else {
                 Dom.objMotorSpeedSlider.parentElement.style.display = 'none';
                 Dom.objMotorGripContainer.style.display = 'none';
                 Dom.objFrictionContainer.style.display = 'flex';
            }
        }
    });

    Dom.objMotorSpeedSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const speed = parseFloat(e.target.value);
            Dom.objMotorSpeedValue.textContent = speed.toFixed(1);
            const userData = body.getUserData();
            if (userData && userData.motor) {
                userData.motor.speed = speed;
            }
        }
    });
    
    Dom.objMotorGripSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
             const grip = parseFloat(e.target.value);
             Dom.objMotorGripValue.textContent = grip.toFixed(1);
             // Обновляем трение фикстур
             for (let f = body.getFixtureList(); f; f = f.getNext()) {
                f.setFriction(grip);
            }
             const userData = body.getUserData();
             if (userData && userData.motor) {
                userData.motor.grip = grip;
            }
        }
    });
}

function initializeSpringPropertiesPanel(world) {
    // --- Listeners for spring properties ---
    Dom.springStiffnessSlider.addEventListener('input', (e) => {
        const spring = getSelectedSpring();
        if (spring) {
            const stiffness = parseFloat(e.target.value);
            Dom.springStiffnessValue.textContent = stiffness.toFixed(1);
            spring.setFrequency(stiffness);
        }
    });

    Dom.springDampingSlider.addEventListener('input', (e) => {
        const spring = getSelectedSpring();
        if (spring) {
            const damping = parseFloat(e.target.value);
            Dom.springDampingValue.textContent = damping.toFixed(2);
            spring.setDampingRatio(damping);
        }
    });

    Dom.springLengthSlider.addEventListener('input', (e) => {
        const spring = getSelectedSpring();
        if (spring) {
            const length = parseFloat(e.target.value);
            Dom.springLengthValue.textContent = length.toFixed(2);
            spring.setLength(length);
        }
    });

    Dom.springFixedToggle.addEventListener('change', (e) => {
        const spring = getSelectedSpring();
        if (spring) {
            const isFixed = e.target.checked;
            // NOTE: Changing joint type directly isn't supported well in Box2D/Planck.
            // Typically you'd destroy and recreate. For simplicity, we'll just store a flag
            // or use it to lock length if implemented.
            // For now, let's just save it in userData
            const userData = spring.getUserData() || {};
            userData.isFixed = isFixed;
            spring.setUserData(userData);
            
            // To actually make it fixed (stiff), we could increase frequency heavily
             if (isFixed) {
                 spring.setFrequency(100.0); // High stiffness
                 spring.setDampingRatio(1.0);
                 // Update UI
                 Dom.springStiffnessSlider.value = 100.0;
                 Dom.springStiffnessValue.textContent = "100.0";
                 Dom.springDampingSlider.value = 1.0;
                 Dom.springDampingValue.textContent = "1.00";
             } else {
                 // Restore default or let user slide
                 spring.setFrequency(5.0);
                 spring.setDampingRatio(0.5);
                 Dom.springStiffnessSlider.value = 5.0;
                 Dom.springStiffnessValue.textContent = "5.0";
                 Dom.springDampingSlider.value = 0.5;
                 Dom.springDampingValue.textContent = "0.50";
             }
        }
    });

    Dom.deleteSelectedSpringButton.addEventListener('click', () => {
        deleteSelectedSpring(world);
        hideSpringPropertiesPanel();
    });
}


// --- Other helper functions ---

function initializeFPSCounter(runner) {
    fpsInterval = setInterval(() => {
        // Planck runner doesn't expose FPS directly easily without loop access
        // We can approximate or just leave static if we don't hook into loop
        // But in engine.js we have gameLoop. We could update a var there.
        // Since we don't have access to internal fps var here easily:
        // Let's just rely on requestAnimationFrame rate if possible or a simple counter.
        // For now, let's skip implementing a real FPS counter here to save complexity
        // unless engine provides it.
    }, 1000);
}

function applyTranslations() {
    document.querySelectorAll('[data-translate-title]').forEach(el => {
        const key = el.getAttribute('data-translate-title');
        el.title = t(key);
    });
    document.querySelectorAll('[data-translate-text]').forEach(el => {
        const key = el.getAttribute('data-translate-text');
        el.textContent = t(key);
    });
}

function updatePlayPauseIcons(isPlaying) {
    if (isPlaying) {
        Dom.playIcon.style.display = 'none';
        Dom.pauseIcon.style.display = 'block';
        Dom.playPauseButton.title = t('pause-title');
    } else {
        Dom.playIcon.style.display = 'block';
        Dom.pauseIcon.style.display = 'none';
        Dom.playPauseButton.title = t('play-title');
    }
}

function switchTool(tool) {
    toolState.currentTool = tool;
    Dom.toolButtons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`${tool}-btn`);
    if(activeBtn) activeBtn.classList.add('active');
    
    // Deselect any object when switching tools
    deselectBody();
    hideObjectPropertiesPanel();
}

function wakeAllBodies(world) {
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        body.setAwake(true);
    }
}

function clearWorldCompletely(world) {
    // Logic similar to clearWorld in world_serializer but callable from UI
    const bodiesToDestroy = [];
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData() || {};
        if (userData.label !== 'boundary') {
            bodiesToDestroy.push(body);
        }
    }
    bodiesToDestroy.forEach(body => world.destroyBody(body));
    deleteAllWater();
    deleteAllSand();
}

function startGame(engineData) {
    Dom.mainMenuOverlay.style.display = 'none';
    engineData.runner.enabled = true;
    updatePlayPauseIcons(true);
}


function openSaveLoadPanel(mode, world, cameraData, engineData) {
    Dom.saveLoadTitle.textContent = t(mode === 'save' ? 'save-game-title' : 'load-game-title');
    Dom.saveSlotsContainer.innerHTML = '';

    // Generate 5 slots
    for (let i = 0; i < 5; i++) {
        const slotKey = `save_slot_${i}`;
        const slotDataStr = localStorage.getItem(slotKey);
        const slotData = slotDataStr ? JSON.parse(slotDataStr) : null;
        const isUnlocked = playerData.unlockedSlots[i] || i === 0; // First slot always unlocked
        
        const slotEl = document.createElement('div');
        slotEl.className = 'save-slot-button';
        
        // Header
        const header = document.createElement('div');
        header.className = 'save-button-header';
        header.textContent = t('save-slot-label') + ' ' + (i + 1);
        slotEl.appendChild(header);

        // Image/State
        const imgContainer = document.createElement('div');
        imgContainer.className = 'save-button-image-container';
        const img = document.createElement('img');
        img.className = 'save-tier-image';
        
        if (!isUnlocked) {
            img.src = 'https://goida228top.github.io/textures/сохранение.png'; // Locked icon reuse or different?
            img.style.opacity = '0.5';
        } else if (slotData) {
            img.src = 'https://goida228top.github.io/textures/сохранение.png';
        } else {
            // Empty slot visual
             img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTE5IDEzSDEzVjE5SDExVjEzSDVWMTFIMTFWNUgxM1YxMUgxOVYxM1oiLz48L3N2Zz4='; // Plus icon
             img.style.width = '50px';
             img.style.height = '50px';
        }
        imgContainer.appendChild(img);
        slotEl.appendChild(imgContainer);

        // Date/Empty text
        const dateDiv = document.createElement('div');
        dateDiv.className = 'save-slot-date';
        if (!isUnlocked) {
            dateDiv.textContent = t('locked');
        } else if (slotData) {
             dateDiv.textContent = new Date(slotData.timestamp).toLocaleString();
        } else {
             dateDiv.textContent = t('empty-slot-label');
        }
        slotEl.appendChild(dateDiv);

        // Actions container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'save-slot-actions';

        if (!isUnlocked) {
            // Unlock Button
            const price = 100 * i; // Example price scaling
            const unlockBtn = document.createElement('button');
            unlockBtn.className = 'action-unlock';
            unlockBtn.textContent = t('unlock-for-price', { price: price });
            
            if (playerData.coins < price) {
                unlockBtn.disabled = true;
                unlockBtn.title = t('not-enough-resonances');
            }
            
            unlockBtn.onclick = () => {
                if (playerData.coins >= price) {
                    playerData.coins -= price;
                    playerData.unlockedSlots[i] = true;
                    updateCoinsDisplay();
                    savePlayer_Data(playerData);
                    // Refresh panel
                    openSaveLoadPanel(mode, world, cameraData, engineData);
                    SoundManager.playSound('ui_click');
                }
            };
            actionsDiv.appendChild(unlockBtn);

        } else {
            // Save/Load Button
            const actionBtn = document.createElement('button');
            actionBtn.className = 'action-save-load';
            if (mode === 'save') {
                actionBtn.textContent = t('save-button');
                actionBtn.onclick = () => {
                    const { worldState, stats } = serializeWorld(world, import('./water.js').waterParticlesPool || [], import('./sand.js').sandParticlesPool || []);
                    const saveObj = {
                        timestamp: Date.now(),
                        state: worldState,
                        stats: stats,
                        camera: { scale: cameraData.scale, viewOffset: cameraData.viewOffset }
                    };
                    localStorage.setItem(slotKey, JSON.stringify(saveObj));
                    showToast(t('game-saved-message'), 'success');
                    openSaveLoadPanel('save', world, cameraData, engineData); // Refresh
                };
            } else {
                actionBtn.textContent = t('load-button');
                actionBtn.disabled = !slotData;
                if (!slotData) actionBtn.style.opacity = 0.5;
                actionBtn.onclick = () => {
                    if (slotData) {
                        deserializeWorld(world, slotData.state);
                        if (slotData.camera) {
                             cameraData.restoreCameraState(slotData.camera);
                             cameraData.updateView();
                        }
                        showToast(t('game-loaded-message'), 'success');
                        closeSaveLoadPanel();
                        // Ensure unpaused
                        engineData.runner.enabled = true;
                        updatePlayPauseIcons(true);
                    }
                };
            }
            actionsDiv.appendChild(actionBtn);

            // Reset Button (only if data exists)
            if (slotData) {
                 const resetBtn = document.createElement('button');
                 resetBtn.className = 'action-reset';
                 resetBtn.textContent = t('delete-button');
                 resetBtn.onclick = () => {
                     showConfirm(t('confirm-title'), t('confirm-delete-save-message'), () => {
                         localStorage.removeItem(slotKey);
                         showToast(t('slot-cleared-message'), 'info');
                         openSaveLoadPanel(mode, world, cameraData, engineData); // Refresh
                     });
                 };
                 actionsDiv.appendChild(resetBtn);
            }
        }
        
        slotEl.appendChild(actionsDiv);
        Dom.saveSlotsContainer.appendChild(slotEl);
    }

    Dom.saveLoadPanel.style.display = 'flex';
    panelState.isSaveLoadOpen = true;
}

function closeSaveLoadPanel() {
    Dom.saveLoadPanel.style.display = 'none';
    panelState.isSaveLoadOpen = false;
}

function updateRewardButtonUI(button, engineData) {
    if (!button) return;
    const rewardAmount = parseInt(button.getAttribute('data-reward'));
    const adsRequired = parseInt(button.getAttribute('data-ads'));
    // Use stored progress or 0
    const currentProgress = playerData.rewardProgress[rewardAmount] || 0;

    button.innerHTML = '';

    // Top Info
    const topInfo = document.createElement('div');
    topInfo.className = 'reward-info-top';
    
    const header = document.createElement('div');
    header.className = 'reward-button-header';
    header.textContent = `${currentProgress}/${adsRequired}`;
    topInfo.appendChild(header);

    const imgContainer = document.createElement('div');
    imgContainer.className = 'reward-button-coins-container';
    const img = document.createElement('img');
    img.className = 'reward-tier-image';
    // Select image based on amount
    if (rewardAmount === 10) img.src = 'https://goida228top.github.io/textures/10 монет.png';
    else if (rewardAmount === 50) img.src = 'https://goida228top.github.io/textures/50 монет.png';
    else img.src = 'https://goida228top.github.io/textures/100 монет.png';
    imgContainer.appendChild(img);
    topInfo.appendChild(imgContainer);

    const subTitle = document.createElement('div');
    subTitle.className = 'reward-button-subtitle';
    subTitle.textContent = t('reward-amount-label', { amount: rewardAmount });
    topInfo.appendChild(subTitle);

    button.appendChild(topInfo);

    // Action Button
    const actionBtn = document.createElement('button');
    actionBtn.className = 'reward-progress-btn';
    
    if (currentProgress >= adsRequired) {
        actionBtn.classList.add('ready-to-claim');
        actionBtn.textContent = t('claim-reward');
        actionBtn.onclick = (e) => {
            e.stopPropagation();
            playerData.coins += rewardAmount;
            playerData.rewardProgress[rewardAmount] = 0; // Reset progress
            updateCoinsDisplay();
            savePlayer_Data(playerData);
            SoundManager.playSound('reward');
            showToast(t('reward-claimed'), 'success');
            updateRewardButtonUI(button, engineData); // Refresh button state
        };
    } else {
        actionBtn.textContent = t('watch-ad-button', { progress: `${currentProgress}/${adsRequired}` });
        const icon = document.createElement('img');
        icon.className = 'ad-icon';
        icon.src = 'https://goida228top.github.io/textures/реклама.png';
        actionBtn.appendChild(icon);

        actionBtn.onclick = (e) => {
            e.stopPropagation();
            actionBtn.disabled = true;
            actionBtn.classList.add('watching-ad');
            actionBtn.textContent = t('loading-ad');

            showRewardedVideo(engineData, () => {
                // Success
                playerData.rewardProgress[rewardAmount] = currentProgress + 1;
                savePlayer_Data(playerData);
                updateRewardButtonUI(button, engineData);
            }, () => {
                // Error
                actionBtn.disabled = false;
                actionBtn.classList.remove('watching-ad');
                actionBtn.classList.add('ad-failed');
                actionBtn.textContent = t('ad-failed-retry');
            });
        };
    }
    
    button.appendChild(actionBtn);
}


function updateCoinsDisplay() {
    Dom.coinsCountSpan.textContent = playerData.coins;
    localStorage.setItem('coins', playerData.coins);
    localStorage.setItem('rewardProgress', JSON.stringify(playerData.rewardProgress));
    localStorage.setItem('unlockedSlots', JSON.stringify(playerData.unlockedSlots));
}

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    Dom.toastContainer.appendChild(toast);

    // Trigger reflow
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if(toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);
    }, 3000);
}

function showConfirm(title, message, onConfirm) {
    Dom.confirmModalTitle.textContent = title;
    Dom.confirmModalMessage.textContent = message;
    Dom.confirmModalOverlay.style.display = 'flex';
    
    // Clear previous listeners to avoid stacking
    const newConfirmBtn = Dom.confirmModalConfirmBtn.cloneNode(true);
    Dom.confirmModalConfirmBtn.parentNode.replaceChild(newConfirmBtn, Dom.confirmModalConfirmBtn);
    Dom.confirmModalConfirmBtn = newConfirmBtn; // Update reference

    const newCancelBtn = Dom.confirmModalCancelBtn.cloneNode(true);
    Dom.confirmModalCancelBtn.parentNode.replaceChild(newCancelBtn, Dom.confirmModalCancelBtn);
    Dom.confirmModalCancelBtn = newCancelBtn; // Update reference


    newConfirmBtn.onclick = () => {
        Dom.confirmModalOverlay.style.display = 'none';
        onConfirm();
    };

    newCancelBtn.onclick = () => {
        Dom.confirmModalOverlay.style.display = 'none';
    };
}

function initializeLowFpsWarning(runner) {
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let lowFpsCount = 0;
    const checkInterval = 1000;
    const fpsThreshold = 15;
    let isWarningShown = false;
    let dontAskAgain = localStorage.getItem('dontShowLowFpsWarning') === 'true';

    if(dontAskAgain) return;

    setInterval(() => {
        if(!runner.enabled || isWarningShown || document.hidden) return;

        const now = performance.now();
        const fps = Math.round(frameCount * 1000 / (now - lastFrameTime));
        
        if (fps < fpsThreshold && fps > 0) {
            lowFpsCount++;
        } else {
            lowFpsCount = 0;
        }

        if (lowFpsCount >= 5) { // 5 seconds of low FPS
            // Check water count
            const waterCount = import('./water.js').waterParticlesPool.filter(p => p.isActive()).length;
            
            if (waterCount > 100) {
                isWarningShown = true;
                Dom.lowFpsWarning.style.display = 'block';
                runner.enabled = false; // Pause game
            }
            lowFpsCount = 0;
        }

        frameCount = 0;
        lastFrameTime = now;
    }, checkInterval);

    // Hook into requestAnimationFrame to count frames (done in engine.js implicitly via loop, 
    // but we can approximate here or just use the main loop if we had access.
    // Since we don't have direct loop hook here easily, let's rely on a separate RAF for counting)
    function countFrames() {
        frameCount++;
        requestAnimationFrame(countFrames);
    }
    requestAnimationFrame(countFrames);

    // Button listeners
    Dom.deleteAllWaterBtn.addEventListener('click', () => {
        deleteAllWater();
        Dom.lowFpsWarning.style.display = 'none';
        isWarningShown = false;
        runner.enabled = true;
        updatePlayPauseIcons(true);
    });

    Dom.pauseFromWarningBtn.addEventListener('click', () => {
         Dom.lowFpsWarning.style.display = 'none';
         isWarningShown = false;
         updatePlayPauseIcons(false);
    });

    Dom.doNothingBtn.addEventListener('click', () => {
         Dom.lowFpsWarning.style.display = 'none';
         isWarningShown = false;
         runner.enabled = true;
         updatePlayPauseIcons(true);
         // Reset counter so it doesn't pop up immediately
         lowFpsCount = -10; 
    });

    Dom.dontAskAgainBtn.addEventListener('click', () => {
         localStorage.setItem('dontShowLowFpsWarning', 'true');
         Dom.lowFpsWarning.style.display = 'none';
         isWarningShown = false;
         runner.enabled = true;
         updatePlayPauseIcons(true);
    });
}
