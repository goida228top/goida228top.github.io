







import * as Dom from './dom.js';
import { SoundManager } from './sound.js';
import { t } from './lang.js';
import { showFullscreenAdv, savePlayer_Data } from './yandex.js';
import { deleteAllWater, waterParticlesPool } from './water.js';
import { deleteAllSand } from './sand.js';
import { deselectBody, deselectSpring } from './selection.js';
import { TOOL_PRICES } from './game_config.js'; // Import prices

// Импорт новых модулей
import { keyState, playerData, isGameStarted, setGameStarted, addTapListener, showToast, showConfirm, togglePanel, setPlayerData } from './ui_common.js';
import { updateCoinsDisplay, updateRewardButtonUI } from './ui_rewards.js';
import { openSaveLoadPanel, closeSaveLoadPanel, saveLoadState } from './ui_saveload.js';
import { initializeNewSettingsPanel, settingsState } from './ui_settings.js';
import { showObjectPropertiesPanel, hideObjectPropertiesPanel, showSpringPropertiesPanel, hideSpringPropertiesPanel, initializeObjectPropertiesPanel, initializeSpringPropertiesPanel, panelState as propsState } from './ui_properties.js';
import { checkTutorial } from './tutorial.js'; // NEW: Import Tutorial

// Экспорт keyState для engine.js
export { keyState, showObjectPropertiesPanel, hideObjectPropertiesPanel, showSpringPropertiesPanel, hideSpringPropertiesPanel, showToast };

let playtimeInterval = null;
let currentPlaytime = 0;
// Интервал для проверки видимости кнопок управления
let controlVisibilityInterval = null; 

const aboutState = { isOpen: false };
const rewardState = { isOpen: false };

export function initUIData(data) {
    if (data) {
        setPlayerData(data);
        // Ensure unlockedSlots exists
        if (!playerData.unlockedSlots) {
            playerData.unlockedSlots = [false, false, false, false, false];
        }
        // Ensure unlockedTools exists (NEW)
        if (!playerData.unlockedTools) {
            playerData.unlockedTools = [];
        }
        updateCoinsDisplay();
        updateLockedToolsUI(); // Update UI locks on init
    }
}

// Function to update visual lock state of buttons
function updateLockedToolsUI() {
    Dom.toolButtons.forEach(button => {
        const toolName = button.id.replace('-btn', '');
        const price = TOOL_PRICES[toolName];
        
        // Remove existing lock if any
        const existingLock = button.querySelector('.lock-overlay');
        if (existingLock) {
            button.removeChild(existingLock);
        }

        if (price && !playerData.unlockedTools.includes(toolName)) {
            // Add lock overlay
            const lock = document.createElement('div');
            lock.className = 'lock-overlay';
            lock.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" /></svg>';
            button.appendChild(lock);
        }
    });
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

function updateMotorControlsVisibility(world) {
    let hasMotor = false;
    for (let body = world.getBodyList(); body; body = body.getNext()) {
        const userData = body.getUserData();
        if (userData && userData.motor && userData.motor.isEnabled) {
            hasMotor = true;
            break;
        }
    }
    
    const display = hasMotor ? 'flex' : 'none';
    
    // Применяем стиль только если он изменился, чтобы избежать лишних перерисовок
    if (Dom.leftButton.style.display !== display) {
        Dom.leftButton.style.display = display;
    }
    if (Dom.rightButton.style.display !== display) {
        Dom.rightButton.style.display = display;
    }
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

    // Запускаем проверку видимости кнопок управления
    if (controlVisibilityInterval) clearInterval(controlVisibilityInterval);
    controlVisibilityInterval = setInterval(() => {
        if (isGameStarted) {
            updateMotorControlsVisibility(world);
        }
    }, 500);

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

    // --- Tool Button Logic with Unlocking ---
    Dom.toolButtons.forEach(button => {
        addTapListener(button, () => {
            const toolName = button.id.replace('-btn', '');
            const price = TOOL_PRICES[toolName];

            // If tool has a price AND is NOT yet unlocked
            if (price && !playerData.unlockedTools.includes(toolName)) {
                SoundManager.playSound('ui_click');
                showConfirm(
                    t('buy-tool-title'), 
                    t('buy-tool-desc', { price: price, tool: t(toolName + '-title') }), 
                    () => {
                        if (playerData.coins >= price) {
                            playerData.coins -= price;
                            playerData.unlockedTools.push(toolName);
                            
                            updateCoinsDisplay();
                            savePlayer_Data(playerData);
                            updateLockedToolsUI(); // Remove lock icon
                            SoundManager.playSound('reward'); // Success sound
                            
                            // Switch tool after purchase
                            import('./tools.js').then(module => {
                                module.switchTool(toolName);
                            });
                        } else {
                            showToast(t('not-enough-resonances'), 'error');
                        }
                    }
                );
                return;
            }

            // Normal behavior
            SoundManager.playSound('ui_click', { pitch: 1.1 });
            import('./tools.js').then(module => {
                module.switchTool(toolName);
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
             // NEW: Check tutorial after game starts and animations finish
             checkTutorial();
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
    // Added support for placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
        const key = el.getAttribute('data-translate-placeholder');
        el.placeholder = t(key);
    });
}