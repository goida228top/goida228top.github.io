
import planck from './planck.js';
import * as Dom from './dom.js';
import { toolState, getSelectedBody, deselectBody, deleteSelectedBody } from './selection.js';
import { setWaterColor, deleteAllWater } from './water.js';
import { showRewardedVideo, showFullscreenAdv } from './yandex.js';
import { t } from './lang.js';
import { PHYSICS_SCALE } from './config.js';

// Хранит состояние панелей
const panelState = {
    isSettingsOpen: false,
    isPropertiesOpen: false,
};

// --- Логика для предупреждения о низкой производительности ---
let latestFPS = 60;
let lowFpsWarningCooldown = 0;
let askAboutLowFps = true;
const LOW_FPS_THRESHOLD = 5;
const LOW_FPS_COOLDOWN_MS = 30000; // 30 секунд

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
    
    Dom.rewardButton.addEventListener('click', () => {
        showRewardedVideo(engineData, () => {
            makeItRain(world, render);
        });
    });

    document.addEventListener('mousedown', (e) => {
        if (panelState.isPropertiesOpen && !Dom.objectPropertiesPanel.contains(e.target)) {
            hideObjectPropertiesPanel();
        }
        if (panelState.isSettingsOpen && !Dom.settingsPanel.contains(e.target) && !Dom.settingsButton.contains(e.target)) {
             togglePanel(Dom.settingsPanel, 'isSettingsOpen');
        }
    }, true);

    updatePlayPauseIcons(runner.enabled);
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
        const rect = Dom.settingsButton.getBoundingClientRect();
        panel.style.top = `${rect.bottom + 10}px`;
        panel.style.right = '10px';
    }
    panelState[stateKey] = isOpening;
}
    