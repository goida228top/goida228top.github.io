
import * as Dom from './dom.js';
import { t } from './lang.js';
import { SoundManager } from './sound.js';
import { addTapListener, togglePanel, showConfirm, showToast } from './ui_common.js';
import { setMaxWaterParticles, setWaterColor } from './water.js';
import { setMaxSandParticles, setSandColor } from './sand.js';
import { updatePlayPauseIcons } from './ui.js';
import planck from './planck.js';
import { loadFromJSON, loadFromSVG } from './import_utils.js';
import { PHYSICS_SCALE } from './game_config.js';

export const settingsState = {
    isOpen: false
};

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
    // REMOVED: rootStyles.setProperty('--button-active-bg', opaqueWaterColor);

    // Sand
    const opaqueSandColor = Dom.sandColorPicker.value;
    const transparentSandColor = hexToRgba(opaqueSandColor, 0.75);
    rootStyles.setProperty('--sand-color-opaque', opaqueSandColor);
    rootStyles.setProperty('--sand-color-transparent', transparentSandColor);
    
    // Изменено: песок всегда непрозрачный (по просьбе пользователя для режима без эффекта, 
    // а для режима с эффектом непрозрачность нужна для корректной работы фильтров)
    setSandColor(opaqueSandColor);
    
    Dom.sandButton.style.color = opaqueSandColor;
}

export function initializeNewSettingsPanel(engineData, cameraData, isGameStartedSetter) {
    const { world, render } = engineData;
    const { applyLiquidFilters } = cameraData;

    addTapListener(Dom.settingsButton, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.newSettingsPanel, settingsState, 'isOpen');
    });

    addTapListener(Dom.newSettingsCloseBtn, () => {
        SoundManager.playSound('ui_click');
        togglePanel(Dom.newSettingsPanel, settingsState, 'isOpen');
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
        // wakeAllBodies(world); // Not imported, maybe loop here?
        for (let body = world.getBodyList(); body; body = body.getNext()) {
            body.setAwake(true);
        }
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
        // Sand no longer uses multiply blend mode to prevent green color distortion
        Dom.sandEffectContainer.classList.remove('liquid-effect-enabled');
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
        // We check visibility in main UI loop or CSS, this just sets state
        if (Dom.debugInfo) Dom.debugInfo.style.display = e.target.checked ? 'flex' : 'none';
    });

    // --- Import Modal Logic ---
    let currentImportMode = null;

    const openImportModal = (mode) => {
        currentImportMode = mode;
        Dom.importModalTitle.textContent = mode === 'json' ? 'Загрузить JSON' : 'Загрузить SVG';
        Dom.importTextarea.value = '';
        Dom.importModalOverlay.style.display = 'flex';
        // Закрываем панель настроек, чтобы не мешала
        Dom.newSettingsPanel.style.display = 'none';
        settingsState.isOpen = false;
    };

    const closeImportModal = () => {
        Dom.importModalOverlay.style.display = 'none';
        currentImportMode = null;
    };

    addTapListener(Dom.importJsonBtn, () => {
        SoundManager.playSound('ui_click');
        openImportModal('json');
    });

    addTapListener(Dom.importSvgBtn, () => {
        SoundManager.playSound('ui_click');
        openImportModal('svg');
    });

    addTapListener(Dom.importCancelBtn, () => {
        SoundManager.playSound('ui_click');
        closeImportModal();
    });

    addTapListener(Dom.importConfirmBtn, () => {
        const content = Dom.importTextarea.value.trim();
        if (!content) return;
        
        SoundManager.playSound('ui_click');
        
        // Определяем центр экрана в мировых координатах
        const viewCenter = {
            x: cameraData.viewOffset.x + (engineData.render.canvas.width / 2 * cameraData.scale),
            y: cameraData.viewOffset.y + (engineData.render.canvas.height / 2 * cameraData.scale)
        };
        
        // Конвертируем в метры
        const spawnPos = planck.Vec2(viewCenter.x / PHYSICS_SCALE, viewCenter.y / PHYSICS_SCALE);

        let success = false;
        if (currentImportMode === 'json') {
            success = loadFromJSON(world, content, spawnPos);
        } else if (currentImportMode === 'svg') {
            success = loadFromSVG(world, content, spawnPos);
        }

        if (success) {
            showToast(t('game-loaded-message'), 'success');
            engineData.requestRender();
        } else {
            showToast(t('game-load-failed-message'), 'error');
        }
        closeImportModal();
    });


    // --- Exit Game Button Logic ---
    if (Dom.exitGameBtn) {
        addTapListener(Dom.exitGameBtn, () => {
            SoundManager.playSound('ui_click');
            showConfirm(t('confirm-title'), t('confirm-exit-game'), () => {
                // Explicitly close settings panel
                Dom.newSettingsPanel.style.display = 'none';
                settingsState.isOpen = false;
                
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
                isGameStartedSetter(false);
                updatePlayPauseIcons(false);
            });
        });
    }
}
