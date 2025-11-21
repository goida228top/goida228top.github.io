
import * as Dom from './dom.js';
import { t } from './lang.js';
import { SoundManager } from './sound.js';
import { addTapListener, togglePanel, showConfirm } from './ui_common.js';
import { setMaxWaterParticles, setWaterColor } from './water.js';
import { setMaxSandParticles, setSandColor } from './sand.js';
import { updatePlayPauseIcons } from './ui.js';
import planck from './planck.js';

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
    rootStyles.setProperty('--button-active-bg', opaqueWaterColor);

    // Sand
    const opaqueSandColor = Dom.sandColorPicker.value;
    const transparentSandColor = hexToRgba(opaqueSandColor, 0.75);
    rootStyles.setProperty('--sand-color-opaque', opaqueSandColor);
    rootStyles.setProperty('--sand-color-transparent', transparentSandColor);
    setSandColor(isEnabled ? opaqueSandColor : transparentSandColor);
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
        // We check visibility in main UI loop or CSS, this just sets state
        if (Dom.debugInfo) Dom.debugInfo.style.display = e.target.checked ? 'flex' : 'none';
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
