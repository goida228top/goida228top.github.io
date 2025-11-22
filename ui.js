
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

// Безопасная очистка мира, которая не убивает пул воды/песка
function clearWorldCompletely(world) {
    // Собираем тела для удаления
    const bodiesToDestroy = [];
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData() || {};
        // Не удаляем границы, воду и песок (их просто деактивируем)
        if (userData.label !== 'boundary' && userData.label !== 'water' && userData.label !== 'sand') {
            bodiesToDestroy.push(body);
        }
    }
    
    // Удаляем обычные объекты
    bodiesToDestroy.forEach(body => world.destroyBody(body));
    
    // Деактивируем (прячем) воду и песок вместо удаления
    deleteAllWater();
    deleteAllSand();
    
    deselectBody();
    deselectSpring();
}

export function initializeUI(engineData, cameraData, worldData) {
    const { world, runner } = engineData;
    
    initializeObjectPropertiesPanel(world);
    initializeSpringPropertiesPanel(world);
    
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
        applyTranslations(); // Apply translations when opening to ensure content is correct
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
            import('./tools.js').then(module => {
                module.switchTool(newTool);
            });
        });
    });

    // --- Centralized play/pause handler (NO ADS HERE) ---
    const handlePlayPause = () => {
        if (!isGameStarted) return;

        if (runner.enabled) {
            runner.enabled = false;
            updatePlayPauseIcons(false);
        } else {
            runner.enabled = true;
            updatePlayPauseIcons(true);
        }
    };
    
    addTapListener(Dom.playPauseButton, () => {
        SoundManager.playSound('ui_click');
        handlePlayPause();
    });

    // --- Clear All with Interstitial Ad ---
    addTapListener(Dom.clearAllButton, () => {
        SoundManager.playSound('ui_click');
        showConfirm(t('confirm-title'), t('confirm-clear-all'), () => {
            // Показываем рекламу перед очисткой
            showFullscreenAdv(engineData, () => {
                clearWorldCompletely(world);
                SoundManager.playSound('explosion_medium', { volume: 0.5 });
                showToast(t('world-cleared-message'), 'info');
            });
        });
    });

    // --- Controls (Keyboard & UI) ---
    const updateKeyState = (code, value) => {
        if (keyState.hasOwnProperty(code)) {
            keyState[code] = value;
        }
    };

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            return;
        }
        
        // Update keyState
        updateKeyState(e.code, true);

        // Блокируем пробел в меню
        if (e.code === 'Space') {
            e.preventDefault();
            if (isGameStarted) {
                SoundManager.playSound('ui_click');
                handlePlayPause();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
         updateKeyState(e.code, false);
    });

    // Touch UI
    const bindControlBtn = (btn, code) => {
        if(!btn) return;
        const set = (v) => (e) => {
            if(e.cancelable) e.preventDefault(); // Prevent text selection etc.
            updateKeyState(code, v);
        };
        
        btn.addEventListener('mousedown', set(true));
        window.addEventListener('mouseup', set(false)); 
        btn.addEventListener('touchstart', set(true), { passive: false });
        btn.addEventListener('touchend', set(false));
        btn.addEventListener('touchcancel', set(false));
    };

    bindControlBtn(Dom.leftButton, 'ArrowLeft');
    bindControlBtn(Dom.rightButton, 'ArrowRight');


    // --- New Settings Panel Logic ---
    initializeNewSettingsPanel(engineData, cameraData, setGameStarted);
    
    // --- Low FPS Warning Logic ---
    Dom.deleteAllWaterBtn.onclick = () => {
        deleteAllWater();
        Dom.lowFpsWarning.style.display = 'none';
    };
    Dom.pauseFromWarningBtn.onclick = () => {
        runner.enabled = false;
        updatePlayPauseIcons(false);
        Dom.lowFpsWarning.style.display = 'none';
    };
    Dom.doNothingBtn.onclick = () => Dom.lowFpsWarning.style.display = 'none';
    Dom.dontAskAgainBtn.onclick = () => {
        localStorage.setItem('suppressLowFpsWarning', 'true');
        Dom.lowFpsWarning.style.display = 'none';
    };

    // Reward Menu Logic
    addTapListener(Dom.coinsDisplay, () => {
        SoundManager.playSound('ui_click');
        updateRewardButtonUI(Dom.reward10Btn, engineData);
        updateRewardButtonUI(Dom.reward50Btn, engineData);
        updateRewardButtonUI(Dom.reward100Btn, engineData);
        togglePanel(Dom.rewardMenuPanel, rewardState, 'isOpen');
    });
    
    addTapListener(Dom.rewardMenuCloseBtn, () => {
         SoundManager.playSound('ui_click');
         togglePanel(Dom.rewardMenuPanel, rewardState, 'isOpen');
    });

    // Initial Translation
    applyTranslations();
}

export function startGame(engineData) {
    if (isGameStarted) return;
    
    // Animation for UI entrance
    Dom.mainMenuContainer.classList.remove('smoke-animation');
    Dom.mainMenuContainer.classList.add('fade-out-menu');
    
    setTimeout(() => {
        Dom.mainMenuOverlay.style.display = 'none';
        Dom.toolbar.style.display = 'flex';
        Dom.toolbar.classList.add('ui-fade-in');
        Dom.bottomToolbar.style.display = 'flex';
        Dom.bottomToolbar.classList.add('ui-fade-in');
        if (Dom.showDebugToggle.checked) Dom.debugInfo.style.display = 'flex';
        Dom.container.classList.add('game-start-zoom');
        
        setTimeout(() => {
             Dom.container.classList.remove('game-start-zoom');
        }, 800);

        engineData.runner.enabled = true;
        setGameStarted(true);
        updatePlayPauseIcons(true);
        
        // Show welcome toast or tip?
        // showToast("Welcome to Physics Sandbox!", "info");
    }, 400);
}

export function updatePlayPauseIcons(isPlaying) {
    if (isPlaying) {
        Dom.playIcon.style.display = 'none';
        Dom.pauseIcon.style.display = 'block';
    } else {
        Dom.playIcon.style.display = 'block';
        Dom.pauseIcon.style.display = 'none';
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-translate-text]').forEach(el => {
        const key = el.getAttribute('data-translate-text');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-translate-title]').forEach(el => {
        const key = el.getAttribute('data-translate-title');
        el.title = t(key);
    });
    // Added support for HTML content in translations
    document.querySelectorAll('[data-translate-html]').forEach(el => {
        const key = el.getAttribute('data-translate-html');
        el.innerHTML = t(key);
    });
}
