import Matter from 'matter-js';
import * as Dom from './dom.js';
import { toolState, getSelectedBody, deselectBody, deleteSelectedBody } from './selection.js';
import { setWaterColor } from './water.js';

const { Body, World, Composite, Sleeping } = Matter;

// Хранит состояние панелей
const panelState = {
    isSettingsOpen: false,
    isPropertiesOpen: false,
};

export function initializeUI(engineData, cameraData, worldData) {
    const { world, runner, render } = engineData;
    const { getMousePos, updateView } = cameraData;

    // --- Панель настроек ---
    Dom.settingsButton.addEventListener('click', () => togglePanel(Dom.settingsPanel, 'isSettingsOpen'));

    // --- Настройки мира ---
    Dom.gravitySlider.addEventListener('input', (e) => {
        const gravity = parseFloat(e.target.value);
        world.gravity.y = gravity;
        Dom.gravityValue.textContent = gravity.toFixed(1);
        wakeAllBodies(world);
    });

    // --- Эффект жидкости ---
    Dom.liquidEffectToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        Dom.waterEffectContainer.classList.toggle('liquid-effect-enabled', isEnabled);

        // В зависимости от состояния эффекта, выбираем правильный цвет для частиц
        const rootStyles = getComputedStyle(document.documentElement);
        const opaqueColor = rootStyles.getPropertyValue('--water-color-opaque').trim();
        const transparentColor = rootStyles.getPropertyValue('--water-color-transparent').trim();

        setWaterColor(isEnabled ? opaqueColor : transparentColor);
    });
    // Вызываем событие при загрузке, чтобы установить начальное состояние
    Dom.liquidEffectToggle.dispatchEvent(new Event('change'));

    // --- Переключение инструментов ---
    Dom.toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            const newTool = button.id.replace('-btn', '');
            switchTool(newTool);
        });
    });

    // --- Панель управления симуляцией ---
    Dom.playPauseButton.addEventListener('click', () => {
        runner.enabled = !runner.enabled;
        Dom.playIcon.style.display = runner.enabled ? 'none' : 'block';
        Dom.pauseIcon.style.display = runner.enabled ? 'block' : 'none';
        Dom.playPauseButton.title = runner.enabled ? 'Пауза' : 'Воспроизвести';
    });

    // --- Панель свойств объекта ---
    initializeObjectPropertiesPanel(world, render);

    // --- Глобальные клики для закрытия панелей ---
    document.addEventListener('mousedown', (e) => {
        // Закрываем панель свойств, если клик был не по ней
        if (panelState.isPropertiesOpen && !Dom.objectPropertiesPanel.contains(e.target)) {
            hideObjectPropertiesPanel();
        }
         // Закрываем панель настроек, если клик был не по ней и не по кнопке настроек
        if (panelState.isSettingsOpen && !Dom.settingsPanel.contains(e.target) && !Dom.settingsButton.contains(e.target)) {
             togglePanel(Dom.settingsPanel, 'isSettingsOpen');
        }
    }, true);
}


function switchTool(newTool) {
    toolState.currentTool = newTool;
    Dom.toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.id.startsWith(newTool));
    });
    // Сбрасываем выделение при смене инструмента, кроме инструментов перемещения
    if (newTool !== 'move' && newTool !== 'finger') {
        deselectBody();
    }
}

function initializeObjectPropertiesPanel(world, render) {
    const updateBodyProperty = (prop, value, isRenderProp = false) => {
        const body = getSelectedBody();
        if (!body) return;

        if (isRenderProp) {
            body.render[prop] = value;
        } else {
            // Для плотности нужно использовать специальный метод
            if (prop === 'density') {
                 Body.setDensity(body, parseFloat(value));
            } else {
                 Body.set(body, prop, value);
            }
        }
        Sleeping.set(body, false);
    };

    Dom.objColorInput.addEventListener('input', (e) => updateBodyProperty('fillStyle', e.target.value, true));
    Dom.objFrictionSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateBodyProperty('friction', value);
        Dom.objFrictionValue.textContent = value.toFixed(2);
    });
    Dom.objRestitutionSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateBodyProperty('restitution', value);
        Dom.objRestitutionValue.textContent = value.toFixed(2);
    });
    Dom.objDensitySlider.addEventListener('input', (e) => {
         const value = parseFloat(e.target.value);
        updateBodyProperty('density', value);
        Dom.objDensityValue.textContent = value.toExponential(1);
    });
    Dom.objStaticToggle.addEventListener('change', (e) => {
        const isStatic = e.target.checked;
        const body = getSelectedBody();
        if(body){
            Body.setStatic(body, isStatic);
        }
    });

    Dom.deleteSelectedButton.addEventListener('click', () => {
        deleteSelectedBody(world);
        hideObjectPropertiesPanel();
    });
}

export function showObjectPropertiesPanel(body, x, y) {
    // Обновляем значения в панели
    Dom.objColorInput.value = body.render.fillStyle || '#cccccc';
    Dom.objFrictionSlider.value = body.friction.toString();
    Dom.objFrictionValue.textContent = body.friction.toFixed(2);
    Dom.objRestitutionSlider.value = body.restitution.toString();
    Dom.objRestitutionValue.textContent = body.restitution.toFixed(2);
    Dom.objDensitySlider.value = body.density.toString();
    Dom.objDensityValue.textContent = body.density.toExponential(1);
    Dom.objStaticToggle.checked = body.isStatic;
    
    // Показываем панель
    Dom.objectPropertiesPanel.style.display = 'flex';
    Dom.objectPropertiesPanel.style.left = `${x}px`;
    Dom.objectPropertiesPanel.style.top = `${y}px`;
    panelState.isPropertiesOpen = true;
}

export function hideObjectPropertiesPanel() {
    Dom.objectPropertiesPanel.style.display = 'none';
    panelState.isPropertiesOpen = false;
}

function wakeAllBodies(world) {
    Composite.allBodies(world).forEach(body => {
        Sleeping.set(body, false);
    });
}

function togglePanel(panel, stateKey) {
    const isOpening = !panelState[stateKey];
    panel.style.display = isOpening ? 'flex' : 'none';
    if (isOpening) {
        // Позиционирование панели настроек относительно кнопки
        const rect = Dom.settingsButton.getBoundingClientRect();
        panel.style.top = `${rect.bottom + 10}px`;
        panel.style.right = '10px';
    }
    panelState[stateKey] = isOpening;
}