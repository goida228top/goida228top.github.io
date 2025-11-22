
import * as Dom from './dom.js';
import { t } from './lang.js';
import { savePlayer_Data, showFullscreenAdv } from './yandex.js'; // Added showFullscreenAdv
import { serializeWorld, deserializeWorld } from './world_serializer.js';
import { waterParticlesPool } from './water.js';
import { sandParticlesPool } from './sand.js';
import { SoundManager } from './sound.js';
import { addTapListener, showToast, showConfirm, playerData } from './ui_common.js';
import { updateCoinsDisplay } from './ui_rewards.js';
import { startGame } from './ui.js';

export const saveLoadState = {
    isOpen: false
};

export function openSaveLoadPanel(mode, world, cameraData, engineData) {
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
            addTapListener(unlockBtn, () => {
                if (playerData.coins >= price) {
                    playerData.coins -= price;
                    playerData.unlockedSlots[i] = true;
                    updateCoinsDisplay();
                    savePlayer_Data(playerData);
                    openSaveLoadPanel(mode, world, cameraData, engineData);
                    SoundManager.playSound('ui_click');
                }
            });
            actionsDiv.appendChild(unlockBtn);
        } else {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'action-save-load';
            if (mode === 'save') {
                actionBtn.textContent = t('save-button');
                addTapListener(actionBtn, () => {
                    const { worldState } = serializeWorld(world, waterParticlesPool, sandParticlesPool);
                    const saveObj = {
                        timestamp: Date.now(),
                        state: worldState,
                        camera: { scale: cameraData.scale, viewOffset: cameraData.viewOffset }
                    };
                    localStorage.setItem(slotKey, JSON.stringify(saveObj));
                    showToast(t('game-saved-message'), 'success');
                    openSaveLoadPanel(mode, world, cameraData, engineData);
                });
            } else {
                actionBtn.textContent = t('load-button');
                actionBtn.disabled = !slotData;
                if (!slotData) actionBtn.style.opacity = 0.5;
                addTapListener(actionBtn, () => {
                    if (slotData) {
                        // Показываем рекламу при загрузке
                        showFullscreenAdv(engineData, () => {
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
                        });
                    }
                });
            }
            actionsDiv.appendChild(actionBtn);
            if (slotData) {
                 const resetBtn = document.createElement('button');
                 resetBtn.className = 'action-reset';
                 resetBtn.textContent = t('delete-button');
                 addTapListener(resetBtn, () => {
                     showConfirm(t('confirm-title'), t('confirm-delete-save-message'), () => {
                         localStorage.removeItem(slotKey);
                         showToast(t('slot-cleared-message'), 'info');
                         openSaveLoadPanel(mode, world, cameraData, engineData);
                     });
                 });
                 actionsDiv.appendChild(resetBtn);
            }
        }
        slotEl.appendChild(actionsDiv);
        Dom.saveSlotsContainer.appendChild(slotEl);
    }
    Dom.saveLoadPanel.style.display = 'flex';
    saveLoadState.isOpen = true;
}

export function closeSaveLoadPanel() {
    Dom.saveLoadPanel.style.display = 'none';
    saveLoadState.isOpen = false;
}
