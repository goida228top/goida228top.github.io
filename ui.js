
import * as Dom from './dom.js';
import { SoundManager } from './sound.js';
import { t } from './lang.js';
import { showFullscreenAdv } from './yandex.js';
import { deleteAllWater, waterParticlesPool } from './water.js';
import { deleteAllSand } from './sand.js';
import { deselectBody, deselectSpring } from './selection.js';

// Импорт новых модулей
import { keyState, playerData, isGameStarted, setGameStarted, addTapListener, showToast, showConfirm, togglePanel, setPlayerData } from './ui_common.js';
import { updateCoinsDisplay, updateRewardButtonUI } from './ui_rewards.js';
import { openSaveLoadPanel, closeSaveLoadPanel, saveLoadState } from './ui_saveload.js';
import { initializeNewSettingsPanel, settingsState } from './ui_settings.js';
import { showObjectPropertiesPanel, hideObjectPropertiesPanel, showSpringPropertiesPanel, hideSpringPropertiesPanel, initializeObjectPropertiesPanel, initializeSpringPropertiesPanel, panelState as propsState } from './ui_properties.js';

// Экспорт keyState для engine.js
export { keyState, showObjectPropertiesPanel, hideObjectPropertiesPanel, showSpringPropertiesPanel, hideSpringPropertiesPanel, showToast };

let playtimeInterval = null;
let currentPlaytime = 0;

const aboutState = { isOpen: false };
const rewardState = { isOpen: false };

export function initUIData(data) {
    if (data) {
        setPlayerData(data);
        // Ensure unlockedSlots exists
        if (!playerData.unlockedSlots) {
            playerData.unlockedSlots = [false, false, false, false, false];
        }
        updateCoinsDisplay();
    }
}

export function initializeUI(engineData, cameraData, worldData) {
    const { world, runner } = engineData;
    
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
        togglePanel(Dom.aboutPanel, aboutState, 'isOpen');
    });

    addTapListener(Dom.aboutPanelCloseBtn, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.aboutPanel, aboutState, 'isOpen');
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
            // We need to import switchTool from tools.js or selection.js? 
            // Actually tools.js imports selection.js, UI just triggers it. 
            // But since switchTool is inside tools.js closure, we need to access it.
            // For now, tools.js initializes listeners. But we need to switch active state.
            // Let's do it via custom event or export.
            // Better: tools.js exports switchTool
            import('./tools.js').then(module => {
                module.switchTool(newTool);
            });
        });
    });

    // --- Centralized play/pause handler ---
    const handlePlayPause = () => {
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
    initializeNewSettingsPanel(engineData, cameraData, setGameStarted);

    initializeObjectPropertiesPanel(world);
    initializeSpringPropertiesPanel(world);
    initializeLowFpsWarning(runner);
    initializeMotorControls();
    
    addTapListener(Dom.coinsDisplay, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.rewardMenuPanel, rewardState, 'isOpen');
        updateRewardButtonUI(Dom.reward10Btn, engineData);
        updateRewardButtonUI(Dom.reward50Btn, engineData);
        updateRewardButtonUI(Dom.reward100Btn, engineData);
    });

    addTapListener(Dom.rewardMenuCloseBtn, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.rewardMenuPanel, rewardState, 'isOpen');
    });

    updateRewardButtonUI(Dom.reward10Btn, engineData);
    updateRewardButtonUI(Dom.reward50Btn, engineData);
    updateRewardButtonUI(Dom.reward100Btn, engineData);


    document.addEventListener('mousedown', (e) => {
        if (propsState.isPropertiesOpen && !Dom.objectPropertiesPanel.contains(e.target)) {
            hideObjectPropertiesPanel();
        }
        if (propsState.isSpringPropertiesOpen && !Dom.springPropertiesPanel.contains(e.target)) {
            hideSpringPropertiesPanel();
        }
        if (settingsState.isOpen && !Dom.newSettingsPanel.contains(e.target) && !Dom.settingsButton.contains(e.target)) {
            togglePanel(Dom.newSettingsPanel, settingsState, 'isOpen');
        }
        if (saveLoadState.isOpen && !Dom.saveLoadPanel.contains(e.target) && !Dom.saveButton.contains(e.target) && !Dom.loadButton.contains(e.target)) {
             closeSaveLoadPanel();
        }
        if (rewardState.isOpen && !Dom.rewardMenuPanel.contains(e.target) && !Dom.coinsDisplay.contains(e.target) && !Dom.rewardMenuCloseBtn.contains(e.target)) { 
             togglePanel(Dom.rewardMenuPanel, rewardState, 'isOpen');
        }
        if (aboutState.isOpen && !Dom.aboutPanel.contains(e.target) && !Dom.aboutGameBtn.contains(e.target) && !Dom.aboutPanelCloseBtn.contains(e.target)) {
            togglePanel(Dom.aboutPanel, aboutState, 'isOpen');
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

export function updatePlayPauseIcons(isPlaying) {
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

export function startGame(engineData) {
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
        setGameStarted(true);
        updatePlayPauseIcons(true);
    }, 500);
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
            const waterCount = waterParticlesPool.filter(p => p.isActive()).length;
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
