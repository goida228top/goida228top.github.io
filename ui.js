import * as Dom from './dom.js';
import { SoundManager } from './sound.js';
import { t } from './lang.js';
import { savePlayer_Data, loadPlayer_Data, showRewardedVideo, showFullscreenAdv } from './yandex.js';
import { serializeWorld, deserializeWorld } from './world_serializer.js';
import { PHYSICS_SCALE, TOOL_SETTINGS } from './game_config.js';
import { deleteAllWater, setWaterColor, setMaxWaterParticles, waterParticlesPool } from './water.js';
import { deleteAllSand, setSandColor, setMaxSandParticles, sandParticlesPool } from './sand.js';
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

// Флаг, отслеживающий, началась ли игра (пройдено ли главное меню)
export let isGameStarted = false;

const panelState = {
    isSettingsOpen: false,
    isPropertiesOpen: false,
    isSpringPropertiesOpen: false,
    isSaveLoadOpen: false,
    isRewardMenuOpen: false,
    isAboutPanelOpen: false,
    isNewSettingsOpen: false, // For the new panel
};

let playtimeInterval = null;
let currentPlaytime = 0;
let fpsInterval = null;

// Handlers for the confirmation modal to allow removal
let currentConfirmHandler = null;
let currentCancelHandler = null;

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

function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) { // #RGB
        r = "0x" + hex[1] + hex[1];
        g = "0x" + hex[2] + hex[2];
        b = "0x" + hex[3] + hex[3];
    } else if (hex.length == 7) { // #RRGGBB
        r = "0x" + hex[1] + hex[2];
        g = "0x" + hex[3] + hex[4];
        b = "0x" + hex[5] + hex[6];
    }
    return `rgba(${+r},${+g},${+b},${alpha})`;
}

function updateLiquidColors() {
    const isEnabled = Dom.newLiquidEffectToggle.checked;
    const rootStyles = document.documentElement.style;

    // Water
    const opaqueWaterColor = Dom.waterColorPicker.value;
    const transparentWaterColor = hexToRgba(opaqueWaterColor, 0.75);
    rootStyles.setProperty('--water-color-opaque', opaqueWaterColor);
    rootStyles.setProperty('--water-color-transparent', transparentWaterColor);
    setWaterColor(isEnabled ? opaqueWaterColor : transparentWaterColor);
    Dom.waterButton.style.color = opaqueWaterColor;
    rootStyles.setProperty('--button-active-bg', opaqueWaterColor);

    // Sand
    const opaqueSandColor = Dom.sandColorPicker.value;
    const transparentSandColor = hexToRgba(opaqueSandColor, 0.75);
    rootStyles.setProperty('--sand-color-opaque', opaqueSandColor);
    rootStyles.setProperty('--sand-color-transparent', transparentSandColor);
    setSandColor(isEnabled ? opaqueSandColor : transparentSandColor);
    Dom.sandButton.style.color = opaqueSandColor;
}

// Вспомогательная функция для надежной обработки кликов на мобильных
function addTapListener(element, callback) {
    if (!element) return;
    
    element.addEventListener('click', (e) => {
        callback(e);
    });
    
    // Добавляем touchend для быстрой реакции на мобильных
    // Но предотвращаем двойное срабатывание, если браузер посылает и touchend и click
    element.addEventListener('touchend', (e) => {
        if (e.cancelable) e.preventDefault(); // Предотвращаем генерацию мышиного клика
        callback(e);
    });
}


export function initializeUI(engineData, cameraData, worldData) {
    const { world, runner, render } = engineData;
    const { applyLiquidFilters } = cameraData;
    
    applyTranslations();
    initializeFPSCounter(runner);
    
    // Explicitly hide game UI on init to ensure clean menu look
    Dom.toolbar.style.display = 'none';
    Dom.bottomToolbar.style.display = 'none';
    Dom.debugInfo.style.display = 'none';
    
    // Запускаем таймер времени игры
    if (playtimeInterval) clearInterval(playtimeInterval);
    playtimeInterval = setInterval(() => {
        if (runner.enabled) {
            currentPlaytime += 1; // Увеличиваем каждую секунду, когда игра не на паузе
        }
    }, 1000);

    // --- Yandex Games Moderation Fix: Prevent context menu on all UI panels ---
    const protectedPanels = [
        Dom.mainMenuOverlay, Dom.rewardMenuPanel, Dom.saveLoadPanel, 
        Dom.newSettingsPanel, Dom.aboutPanel, Dom.objectPropertiesPanel, 
        Dom.springPropertiesPanel, Dom.lowFpsWarning, Dom.confirmModalOverlay
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
    addTapListener(Dom.startGameBtn, () => {
        SoundManager.playSound('ui_click');
        startGame(engineData);
    });

    addTapListener(Dom.loadGameMenuBtn, () => {
        SoundManager.playSound('ui_click');
        openSaveLoadPanel('load', world, cameraData, engineData);
    });

    addTapListener(Dom.aboutGameBtn, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.aboutPanel, 'isAboutPanelOpen');
    });

    addTapListener(Dom.aboutPanelCloseBtn, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.aboutPanel, 'isAboutPanelOpen');
    });
    
    // --- Toolbar Button Listeners ---
    addTapListener(Dom.saveButton, () => {
        SoundManager.playSound('ui_click');
        openSaveLoadPanel('save', world, cameraData, engineData);
    });

    addTapListener(Dom.loadButton, () => {
        SoundManager.playSound('ui_click');
        openSaveLoadPanel('load', world, cameraData, engineData);
    });

    addTapListener(Dom.saveLoadCloseBtn, () => {
        SoundManager.playSound('ui_click');
        closeSaveLoadPanel();
    });

    Dom.toolButtons.forEach(button => {
        addTapListener(button, () => {
            SoundManager.playSound('ui_click', { pitch: 1.1 });
            const newTool = button.id.replace('-btn', '');
            switchTool(newTool);
        });
    });

    // --- Centralized play/pause handler ---
    const handlePlayPause = () => {
        // Блокируем паузу, если игра еще не началась (в главном меню)
        if (!isGameStarted) return;

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
    
    addTapListener(Dom.playPauseButton, () => {
        SoundManager.playSound('ui_click');
        handlePlayPause();
    });

    addTapListener(Dom.clearAllButton, () => {
        SoundManager.playSound('ui_click');
        showConfirm(t('confirm-title'), t('confirm-clear-all'), () => {
            clearWorldCompletely(world);
            SoundManager.playSound('explosion_medium', { volume: 0.5 });
            showToast(t('world-cleared-message'), 'info');
        });
    });

    document.addEventListener('keydown', (e) => {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            return;
        }
        // Блокируем пробел в меню
        if (e.code === 'Space') {
            e.preventDefault();
            if (isGameStarted) {
                SoundManager.playSound('ui_click');
                handlePlayPause();
            }
        }
    });

    // --- New Settings Panel Logic ---
    initializeNewSettingsPanel(engineData, cameraData);

    initializeObjectPropertiesPanel(world);
    initializeSpringPropertiesPanel(world);
    initializeLowFpsWarning(runner);
    initializeMotorControls();
    
    addTapListener(Dom.coinsDisplay, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
        updateRewardButtonUI(Dom.reward10Btn, engineData);
        updateRewardButtonUI(Dom.reward50Btn, engineData);
        updateRewardButtonUI(Dom.reward100Btn, engineData);
    });

    addTapListener(Dom.rewardMenuCloseBtn, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
    });

    updateRewardButtonUI(Dom.reward10Btn, engineData);
    updateRewardButtonUI(Dom.reward50Btn, engineData);
    updateRewardButtonUI(Dom.reward100Btn, engineData);


    document.addEventListener('mousedown', (e) => {
        if (panelState.isPropertiesOpen && !Dom.objectPropertiesPanel.contains(e.target)) {
            hideObjectPropertiesPanel();
        }
        if (panelState.isSpringPropertiesOpen && !Dom.springPropertiesPanel.contains(e.target)) {
            hideSpringPropertiesPanel();
        }
        if (panelState.isNewSettingsOpen && !Dom.newSettingsPanel.contains(e.target) && !Dom.settingsButton.contains(e.target)) {
            togglePanel(Dom.newSettingsPanel, 'isNewSettingsOpen');
        }
        if (panelState.isSaveLoadOpen && !Dom.saveLoadPanel.contains(e.target) && !Dom.saveButton.contains(e.target) && !Dom.loadButton.contains(e.target)) {
             closeSaveLoadPanel();
        }
        if (panelState.isRewardMenuOpen && !Dom.rewardMenuPanel.contains(e.target) && !Dom.coinsDisplay.contains(e.target) && !Dom.rewardMenuCloseBtn.contains(e.target)) { 
             togglePanel(Dom.rewardMenuPanel, 'isRewardMenuOpen');
        }
        if (panelState.isAboutPanelOpen && !Dom.aboutPanel.contains(e.target) && !Dom.aboutGameBtn.contains(e.target) && !Dom.aboutPanelCloseBtn.contains(e.target)) {
            togglePanel(Dom.aboutPanel, 'isAboutPanelOpen');
        }
    }, true);

    let wasRunningBeforeHidden = false;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (runner.enabled) {
                wasRunningBeforeHidden = true;
                runner.enabled = false;
                updatePlayPauseIcons(false);
            }
        } else {
            if (wasRunningBeforeHidden) {
                runner.enabled = true;
                updatePlayPauseIcons(true);
            }
            wasRunningBeforeHidden = false;
        }
    });

    updatePlayPauseIcons(runner.enabled);
    updateCoinsDisplay();
}

function initializeNewSettingsPanel(engineData, cameraData) {
    const { world, render } = engineData;
    const { applyLiquidFilters } = cameraData;

    addTapListener(Dom.settingsButton, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.newSettingsPanel, 'isNewSettingsOpen');
    });

    addTapListener(Dom.newSettingsCloseBtn, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.newSettingsPanel, 'isNewSettingsOpen');
    });

    // Accordion Logic
    document.querySelectorAll('.settings-category-header').forEach(header => {
        addTapListener(header, () => {
            SoundManager.playSound('ui_click', { pitch: 1.2 });
            const category = header.parentElement;
            category.classList.toggle('expanded');
        });
    });

    // --- Physics Settings ---
    Dom.newGravitySlider.addEventListener('input', (e) => {
        const gravity = parseFloat(e.target.value);
        world.setGravity(planck.Vec2(0, gravity * 9.8));
        Dom.newGravityValue.textContent = gravity.toFixed(1);
        wakeAllBodies(world);
    });
    if (world) {
        Dom.newGravityValue.textContent = (world.getGravity().y / 9.8).toFixed(1);
        Dom.newGravitySlider.value = world.getGravity().y / 9.8;
    }

    Dom.velocityIterationsSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        Dom.velocityIterationsValue.textContent = value;
        engineData.setVelocityIterations(value);
    });

    Dom.positionIterationsSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        Dom.positionIterationsValue.textContent = value;
        engineData.setPositionIterations(value);
    });

    // --- Graphics Settings ---
    Dom.newLiquidEffectToggle.addEventListener('change', () => {
        const isEnabled = Dom.newLiquidEffectToggle.checked;
        Dom.waterEffectContainer.classList.toggle('liquid-effect-enabled', isEnabled);
        Dom.sandEffectContainer.classList.toggle('liquid-effect-enabled', isEnabled);
        updateLiquidColors();
        if (applyLiquidFilters) applyLiquidFilters();
    });
    Dom.newLiquidEffectToggle.dispatchEvent(new Event('change'));

    Dom.newShowHitboxesToggle.addEventListener('change', (e) => {
        render.options.showHitboxes = e.target.checked;
    });

    Dom.maxWaterSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        Dom.maxWaterValue.textContent = value;
        setMaxWaterParticles(value);
    });

    Dom.maxSandSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        Dom.maxSandValue.textContent = value;
        setMaxSandParticles(value);
    });

    Dom.waterColorPicker.addEventListener('input', updateLiquidColors);
    Dom.sandColorPicker.addEventListener('input', updateLiquidColors);

    // --- Sound Settings ---
    Dom.masterVolumeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        Dom.masterVolumeValue.textContent = `${Math.round(value * 100)}%`;
        SoundManager.setMasterVolume(value);
    });

    const initialMuteSettings = SoundManager.loadMuteSettings();
    Dom.newUiSoundsToggle.checked = !initialMuteSettings.ui;
    Dom.newObjectSoundsToggle.checked = !initialMuteSettings.object;
    Dom.newEnvSoundsToggle.checked = !initialMuteSettings.environment;

    Dom.newUiSoundsToggle.addEventListener('change', (e) => SoundManager.setCategoryMute('ui', !e.target.checked));
    Dom.newObjectSoundsToggle.addEventListener('change', (e) => SoundManager.setCategoryMute('object', !e.target.checked));
    Dom.newEnvSoundsToggle.addEventListener('change', (e) => SoundManager.setCategoryMute('environment', !e.target.checked));

    // --- Interface Settings ---
    Dom.showDebugToggle.addEventListener('change', (e) => {
        if (isGameStarted) {
            Dom.debugInfo.style.display = e.target.checked ? 'flex' : 'none';
        }
    });

    // --- Exit Game Button Logic ---
    if (Dom.exitGameBtn) {
        addTapListener(Dom.exitGameBtn, () => {
            SoundManager.playSound('ui_click');
            showConfirm(t('confirm-title'), t('confirm-exit-game'), () => {
                // Explicitly close settings panel
                Dom.newSettingsPanel.style.display = 'none';
                panelState.isNewSettingsOpen = false;
                
                // Show main menu
                Dom.mainMenuOverlay.style.display = 'flex';
                if (Dom.mainMenuContainer) {
                    Dom.mainMenuContainer.classList.remove('fade-out-menu');
                    Dom.mainMenuContainer.classList.add('smoke-animation');
                }

                // Hide UI
                Dom.toolbar.style.display = 'none';
                Dom.bottomToolbar.style.display = 'none';
                Dom.debugInfo.style.display = 'none';

                // Stop game
                engineData.runner.enabled = false;
                isGameStarted = false;
                updatePlayPauseIcons(false);
            });
        });
    }
}


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
    const isOpen = panel.style.display === 'flex' || panel.style.display === 'block';
    const displayStyle = (panel.id === 'about-panel' || panel.id === 'new-settings-panel') ? 'flex' : 'block';
    
    panel.style.display = isOpen ? 'none' : displayStyle;
     if(panel.id === 'reward-menu-panel' || panel.id === 'save-load-panel') {
        panel.style.display = isOpen ? 'none' : 'flex';
    }

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

    let density = body.getFixtureList()?.getDensity() || 1.0;
    if (density < 0.01) density = 0.001; 
    Dom.objDensitySlider.value = density;
    Dom.objDensityValue.textContent = density.toExponential(1);

    const friction = body.getFixtureList()?.getFriction() || 0.3;
    Dom.objFrictionSlider.value = friction;
    Dom.objFrictionValue.textContent = friction.toFixed(1);

    const restitution = body.getFixtureList()?.getRestitution() || 0.1;
    Dom.objRestitutionSlider.value = restitution;
    Dom.objRestitutionValue.textContent = restitution.toFixed(2);

    const damping = body.getLinearDamping();
    Dom.objResistanceSlider.value = damping;
    Dom.objResistanceValue.textContent = damping.toFixed(1);

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
        const currentFriction = body.getFixtureList().getFriction();
        Dom.objMotorGripSlider.value = currentFriction;
        Dom.objMotorGripValue.textContent = currentFriction.toFixed(1);
        if (motorData.isEnabled) {
             Dom.objMotorSpeedSlider.parentElement.style.display = 'flex';
             Dom.objMotorGripContainer.style.display = 'flex';
             Dom.objFrictionContainer.style.display = 'none';
        } else {
             Dom.objMotorSpeedSlider.parentElement.style.display = 'none';
             Dom.objMotorGripContainer.style.display = 'none';
             Dom.objFrictionContainer.style.display = 'flex';
        }
    } else {
        Dom.motorPropertiesSection.style.display = 'none';
        Dom.objFrictionContainer.style.display = 'flex';
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
    Dom.objColorInput.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const userData = body.getUserData() || {};
            if (!userData.render) userData.render = {};
            userData.render.fillStyle = e.target.value;
            if (userData.render.texture) {
                delete userData.render.texture;
                delete userData.render.textureUrl;
            }
            body.setUserData(userData);
            body.setAwake(true);
        }
    });

    Dom.objDensitySlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const density = parseFloat(e.target.value);
            Dom.objDensityValue.textContent = density.toExponential(1);
            for (let f = body.getFixtureList(); f; f = f.getNext()) f.setDensity(density);
            body.resetMassData();
            body.setAwake(true);
        }
    });

    Dom.objFrictionSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const friction = parseFloat(e.target.value);
            Dom.objFrictionValue.textContent = friction.toFixed(1);
            for (let f = body.getFixtureList(); f; f = f.getNext()) f.setFriction(friction);
            body.setAwake(true);
        }
    });
    
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
            for (let f = body.getFixtureList(); f; f = f.getNext()) f.setRestitution(restitution);
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

    addTapListener(Dom.deleteSelectedButton, () => {
        deleteSelectedBody(world);
        hideObjectPropertiesPanel();
    });
    
    Dom.objMotorEnableToggle.addEventListener('change', (e) => {
        const body = getSelectedBody();
        if (body) {
            const isEnabled = e.target.checked;
            const userData = body.getUserData() || {};
            if (!userData.motor) userData.motor = { speed: 10.0, grip: 0.8 };
            userData.motor.isEnabled = isEnabled;
            body.setUserData(userData);
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
            if (userData?.motor) userData.motor.speed = speed;
        }
    });
    
    Dom.objMotorGripSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
             const grip = parseFloat(e.target.value);
             Dom.objMotorGripValue.textContent = grip.toFixed(1);
             for (let f = body.getFixtureList(); f; f = f.getNext()) f.setFriction(grip);
             const userData = body.getUserData();
             if (userData?.motor) userData.motor.grip = grip;
        }
    });
}

function initializeSpringPropertiesPanel(world) {
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
            const userData = spring.getUserData() || {};
            userData.isFixed = isFixed;
            spring.setUserData(userData);
            if (isFixed) {
                 spring.setFrequency(100.0);
                 spring.setDampingRatio(1.0);
                 Dom.springStiffnessSlider.value = 100.0;
                 Dom.springStiffnessValue.textContent = "100.0";
                 Dom.springDampingSlider.value = 1.0;
                 Dom.springDampingValue.textContent = "1.00";
             } else {
                 spring.setFrequency(5.0);
                 spring.setDampingRatio(0.5);
                 Dom.springStiffnessSlider.value = 5.0;
                 Dom.springStiffnessValue.textContent = "5.0";
                 Dom.springDampingSlider.value = 0.5;
                 Dom.springDampingValue.textContent = "0.50";
             }
        }
    });

    addTapListener(Dom.deleteSelectedSpringButton, () => {
        deleteSelectedSpring(world);
        hideSpringPropertiesPanel();
    });
}

function initializeFPSCounter(runner) {
    let lastTime = performance.now();
    let frameCount = 0;
    function update() {
        frameCount++;
        const now = performance.now();
        const delta = now - lastTime;
        if (delta >= 1000) {
            const fps = Math.round((frameCount * 1000) / delta);
            Dom.fpsIndicator.textContent = `FPS: ${fps}`;
            frameCount = 0;
            lastTime = now;
        }
        requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
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
    deselectBody();
    hideObjectPropertiesPanel();
}

function wakeAllBodies(world) {
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        body.setAwake(true);
    }
}

function clearWorldCompletely(world) {
    const bodiesToDestroy = [];
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData() || {};
        if (userData.label !== 'boundary') bodiesToDestroy.push(body);
    }
    bodiesToDestroy.forEach(body => world.destroyBody(body));
    deleteAllWater();
    deleteAllSand();
}

function startGame(engineData) {
    // 1. Анимация исчезновения меню
    const menuContainer = document.getElementById('main-menu-container');
    if (menuContainer) {
        menuContainer.classList.remove('smoke-animation'); // remove entrance animation
        menuContainer.classList.add('fade-out-menu');
    }
    
    // 2. Анимация приближения игрового мира (эффект входа в мир)
    const simContainer = document.getElementById('simulation-container');
    if (simContainer) {
        simContainer.classList.add('game-start-zoom');
        setTimeout(() => {
            simContainer.classList.remove('game-start-zoom');
        }, 1000);
    }

    // 3. Через 500мс (время анимации) скрываем меню и показываем интерфейс игры
    setTimeout(() => {
        Dom.mainMenuOverlay.style.display = 'none';
        
        // Показываем панели интерфейса с анимацией появления
        Dom.toolbar.style.display = 'flex';
        Dom.toolbar.classList.add('ui-fade-in');
        
        Dom.bottomToolbar.style.display = 'flex';
        Dom.bottomToolbar.classList.add('ui-fade-in');
        
        if (Dom.showDebugToggle.checked) {
             Dom.debugInfo.style.display = 'flex';
             Dom.debugInfo.classList.add('ui-fade-in');
        }

        engineData.runner.enabled = true;
        isGameStarted = true; // Разблокируем управление и паузу
        updatePlayPauseIcons(true);
    }, 500);
}

function openSaveLoadPanel(mode, world, cameraData, engineData) {
    Dom.saveLoadTitle.textContent = t(mode === 'save' ? 'save-game-title' : 'load-game-title');
    Dom.saveSlotsContainer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const slotKey = `save_slot_${i}`;
        const slotDataStr = localStorage.getItem(slotKey);
        const slotData = slotDataStr ? JSON.parse(slotDataStr) : null;
        const isUnlocked = playerData.unlockedSlots[i] || i === 0;
        const slotEl = document.createElement('div');
        slotEl.className = 'save-slot-button';
        const header = document.createElement('div');
        header.className = 'save-button-header';
        header.textContent = t('save-slot-label') + ' ' + (i + 1);
        slotEl.appendChild(header);
        const imgContainer = document.createElement('div');
        imgContainer.className = 'save-button-image-container';
        const img = document.createElement('img');
        img.className = 'save-tier-image';
        img.src = 'https://goida228top.github.io/textures/сохранение.png';

        if (!isUnlocked) {
            img.style.opacity = '0.5';
        } else if (!slotData) {
             img.style.opacity = '0.7';
        }
        
        imgContainer.appendChild(img);
        slotEl.appendChild(imgContainer);
        const dateDiv = document.createElement('div');
        dateDiv.className = 'save-slot-date';
        if (!isUnlocked) dateDiv.textContent = t('locked');
        else if (slotData) dateDiv.textContent = new Date(slotData.timestamp).toLocaleString();
        else dateDiv.textContent = t('empty-slot-label');
        slotEl.appendChild(dateDiv);
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'save-slot-actions';

        if (!isUnlocked) {
            const price = 100 * i;
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
                    openSaveLoadPanel(mode, world, cameraData, engineData);
                    SoundManager.playSound('ui_click');
                }
            };
            actionsDiv.appendChild(unlockBtn);
        } else {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'action-save-load';
            if (mode === 'save') {
                actionBtn.textContent = t('save-button');
                actionBtn.onclick = () => {
                    const { worldState } = serializeWorld(world, waterParticlesPool, sandParticlesPool);
                    const saveObj = {
                        timestamp: Date.now(),
                        state: worldState,
                        camera: { scale: cameraData.scale, viewOffset: cameraData.viewOffset }
                    };
                    localStorage.setItem(slotKey, JSON.stringify(saveObj));
                    showToast(t('game-saved-message'), 'success');
                    openSaveLoadPanel(mode, world, cameraData, engineData);
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
                        if (!Dom.toolbar.style.display || Dom.toolbar.style.display === 'none') {
                             startGame(engineData);
                        }
                        engineData.runner.enabled = true;
                        updatePlayPauseIcons(true);
                    }
                };
            }
            actionsDiv.appendChild(actionBtn);
            if (slotData) {
                 const resetBtn = document.createElement('button');
                 resetBtn.className = 'action-reset';
                 resetBtn.textContent = t('delete-button');
                 resetBtn.onclick = () => {
                     showConfirm(t('confirm-title'), t('confirm-delete-save-message'), () => {
                         localStorage.removeItem(slotKey);
                         showToast(t('slot-cleared-message'), 'info');
                         openSaveLoadPanel(mode, world, cameraData, engineData);
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
    const currentProgress = playerData.rewardProgress[rewardAmount] || 0;

    button.innerHTML = '';
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
    const actionBtn = document.createElement('button');
    actionBtn.className = 'reward-progress-btn';
    
    if (currentProgress >= adsRequired) {
        actionBtn.classList.add('ready-to-claim');
        actionBtn.textContent = t('claim-reward');
        actionBtn.onclick = (e) => {
            e.stopPropagation();
            playerData.coins += rewardAmount;
            playerData.rewardProgress[rewardAmount] = 0;
            updateCoinsDisplay();
            savePlayer_Data(playerData);
            SoundManager.playSound('reward');
            showToast(t('reward-claimed'), 'success');
            updateRewardButtonUI(button, engineData);
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
                playerData.rewardProgress[rewardAmount] = currentProgress + 1;
                savePlayer_Data(playerData);
                updateRewardButtonUI(button, engineData);
            }, () => {
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
    if (currentConfirmHandler) Dom.confirmModalConfirmBtn.removeEventListener('click', currentConfirmHandler);
    if (currentCancelHandler) Dom.confirmModalCancelBtn.removeEventListener('click', currentCancelHandler);
    currentConfirmHandler = () => {
        Dom.confirmModalOverlay.style.display = 'none';
        onConfirm();
    };
    currentCancelHandler = () => Dom.confirmModalOverlay.style.display = 'none';
    Dom.confirmModalConfirmBtn.addEventListener('click', currentConfirmHandler);
    Dom.confirmModalCancelBtn.addEventListener('click', currentCancelHandler);
}

function initializeLowFpsWarning(runner) {
    let lowFpsCount = 0;
    let isWarningShown = false;
    let dontAskAgain = localStorage.getItem('dontShowLowFpsWarning') === 'true';

    if(dontAskAgain) return;

    const fpsChecker = () => {
        if (!runner.enabled || isWarningShown || document.hidden) return;
        
        const currentFps = parseInt(Dom.fpsIndicator.textContent.replace('FPS: ', ''), 10);

        if (currentFps < 15 && currentFps > 0) lowFpsCount++;
        else lowFpsCount = 0;

        if (lowFpsCount >= 5) {
            const waterCount = import('./water.js').waterParticlesPool.filter(p => p.isActive()).length;
            if (waterCount > 100) {
                isWarningShown = true;
                Dom.lowFpsWarning.style.display = 'block';
                runner.enabled = false;
            }
            lowFpsCount = 0;
        }
    };

    setInterval(fpsChecker, 1000);

    addTapListener(Dom.deleteAllWaterBtn, () => {
        deleteAllWater();
        Dom.lowFpsWarning.style.display = 'none';
        isWarningShown = false;
        runner.enabled = true;
        updatePlayPauseIcons(true);
    });

    addTapListener(Dom.pauseFromWarningBtn, () => {
         Dom.lowFpsWarning.style.display = 'none';
         isWarningShown = false;
         updatePlayPauseIcons(false);
    });

    addTapListener(Dom.doNothingBtn, () => {
         Dom.lowFpsWarning.style.display = 'none';
         isWarningShown = false;
         runner.enabled = true;
         updatePlayPauseIcons(true);
         lowFpsCount = -10; 
    });

    addTapListener(Dom.dontAskAgainBtn, () => {
         localStorage.setItem('dontShowLowFpsWarning', 'true');
         Dom.lowFpsWarning.style.display = 'none';
         isWarningShown = false;
         runner.enabled = true;
         updatePlayPauseIcons(true);
    });
}