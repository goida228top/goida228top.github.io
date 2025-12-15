
import * as Dom from './dom.js';
import { getSelectedBody, getSelectedSpring, deselectBody, deselectSpring, deleteSelectedBody, deleteSelectedSpring } from './selection.js';
import { addTapListener } from './ui_common.js';
import { TutorialHooks } from './tutorial.js'; // NEW

export const panelState = {
    isPropertiesOpen: false,
    isSpringPropertiesOpen: false,
};

function clampPanelPosition(panel, targetX, targetY) {
    // Сначала показываем панель, чтобы браузер рассчитал её размеры
    panel.style.display = 'flex';
    
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    
    // Используем clientWidth/Height документа для надежности в iframe
    const windowW = document.documentElement.clientWidth || window.innerWidth;
    const windowH = document.documentElement.clientHeight || window.innerHeight;
    const padding = 10; // Отступ от краев экрана

    let left = targetX;
    let top = targetY;

    // Жесткая математика ограничений:
    // 1. Если меню вылазит справа -> сдвигаем влево
    if (left + width > windowW - padding) {
        left = windowW - width - padding;
    }
    // 2. Если меню вылазит слева -> прибиваем к левому краю
    if (left < padding) {
        left = padding;
    }

    // 3. Если меню вылазит снизу -> сдвигаем вверх
    if (top + height > windowH - padding) {
        top = windowH - height - padding;
        
        // Проверка: если при сдвиге вверх оно улезло за верхний край -> центрируем по вертикали или прибиваем к верху
        if (top < padding) {
             // Если меню выше чем экран (маловероятно, но возможно на мобилках), прижимаем к верху и даем скролл (он есть в CSS)
             top = padding;
        }
    }
    // 4. Если меню вылазит сверху -> прибиваем к верху
    if (top < padding) {
        top = padding;
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
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

    // --- Stabilizer UI Logic ---
    if (!hasCircleFixture && body.isDynamic()) {
        Dom.stabilizerSection.style.display = 'flex';
        const stabilizerData = userData.stabilizer || { isEnabled: false, maxAngle: 60 };
        Dom.objStabilizerEnableToggle.checked = stabilizerData.isEnabled;
        Dom.objStabilizerAngleSlider.value = stabilizerData.maxAngle;
        Dom.objStabilizerAngleValue.textContent = stabilizerData.maxAngle + '°';
        
        if (stabilizerData.isEnabled) {
            Dom.objStabilizerAngleSlider.parentElement.style.display = 'flex';
        } else {
            Dom.objStabilizerAngleSlider.parentElement.style.display = 'none';
        }
    } else {
        Dom.stabilizerSection.style.display = 'none';
    }

    if (hasCircleFixture) {
        Dom.motorPropertiesSection.style.display = 'flex';
        const motorData = userData.motor || { isEnabled: false, speed: 10.0, grip: 0.8, power: 50 };
        Dom.objMotorEnableToggle.checked = motorData.isEnabled;
        Dom.objMotorSpeedSlider.value = motorData.speed;
        Dom.objMotorSpeedValue.textContent = motorData.speed.toFixed(1);
        
        const power = motorData.power !== undefined ? motorData.power : 50;
        Dom.objMotorAccelerationSlider.value = power;
        Dom.objMotorAccelerationValue.textContent = power;

        const currentFriction = body.getFixtureList().getFriction();
        Dom.objMotorGripSlider.value = currentFriction;
        Dom.objMotorGripValue.textContent = currentFriction.toFixed(1);
        
        if (motorData.isEnabled) {
             Dom.objMotorSpeedSlider.parentElement.style.display = 'flex';
             Dom.objMotorAccelerationSlider.parentElement.style.display = 'flex';
             Dom.objMotorGripContainer.style.display = 'flex';
             Dom.objFrictionContainer.style.display = 'none';
        } else {
             Dom.objMotorSpeedSlider.parentElement.style.display = 'none';
             Dom.objMotorAccelerationSlider.parentElement.style.display = 'none';
             Dom.objMotorGripContainer.style.display = 'none';
             Dom.objFrictionContainer.style.display = 'flex';
        }
    } else {
        Dom.motorPropertiesSection.style.display = 'none';
        Dom.objFrictionContainer.style.display = 'flex';
    }

    // Используем новую функцию безопасного позиционирования
    clampPanelPosition(Dom.objectPropertiesPanel, x, y);
    panelState.isPropertiesOpen = true;
    TutorialHooks.onPropertiesOpened(); // NEW
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

    // Используем новую функцию безопасного позиционирования
    clampPanelPosition(Dom.springPropertiesPanel, x, y);
    panelState.isSpringPropertiesOpen = true;
}

export function hideSpringPropertiesPanel() {
    Dom.springPropertiesPanel.style.display = 'none';
    deselectSpring();
    panelState.isSpringPropertiesOpen = false;
}

export function initializeObjectPropertiesPanel(world) {
    // Кнопка закрытия
    addTapListener(document.getElementById('object-properties-close-btn'), () => {
        hideObjectPropertiesPanel();
        TutorialHooks.onPanelClosed(); // NEW
    });

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
    
    // --- Stabilizer Listeners ---
    Dom.objStabilizerEnableToggle.addEventListener('change', (e) => {
        const body = getSelectedBody();
        if (body) {
            const isEnabled = e.target.checked;
            const userData = body.getUserData() || {};
            if (!userData.stabilizer) userData.stabilizer = { maxAngle: 60 };
            userData.stabilizer.isEnabled = isEnabled;
            body.setUserData(userData);
            
            if (isEnabled) {
                Dom.objStabilizerAngleSlider.parentElement.style.display = 'flex';
            } else {
                Dom.objStabilizerAngleSlider.parentElement.style.display = 'none';
            }
            // Пересчитываем позицию меню, так как размер изменился
            const rect = Dom.objectPropertiesPanel.getBoundingClientRect();
            clampPanelPosition(Dom.objectPropertiesPanel, rect.left, rect.top);
        }
    });

    Dom.objStabilizerAngleSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const angle = parseInt(e.target.value);
            Dom.objStabilizerAngleValue.textContent = angle + '°';
            const userData = body.getUserData();
            if (userData?.stabilizer) userData.stabilizer.maxAngle = angle;
        }
    });


    Dom.objMotorEnableToggle.addEventListener('change', (e) => {
        const body = getSelectedBody();
        if (body) {
            const isEnabled = e.target.checked;
            const userData = body.getUserData() || {};
            if (!userData.motor) userData.motor = { speed: 10.0, grip: 0.8, power: 50 };
            userData.motor.isEnabled = isEnabled;
            body.setUserData(userData);
            if (isEnabled) {
                 Dom.objMotorSpeedSlider.parentElement.style.display = 'flex';
                 Dom.objMotorAccelerationSlider.parentElement.style.display = 'flex';
                 Dom.objMotorGripContainer.style.display = 'flex';
                 Dom.objFrictionContainer.style.display = 'none';
            } else {
                 Dom.objMotorSpeedSlider.parentElement.style.display = 'none';
                 Dom.objMotorAccelerationSlider.parentElement.style.display = 'none';
                 Dom.objMotorGripContainer.style.display = 'none';
                 Dom.objFrictionContainer.style.display = 'flex';
            }
            // Пересчитываем позицию меню, так как размер изменился
            const rect = Dom.objectPropertiesPanel.getBoundingClientRect();
            clampPanelPosition(Dom.objectPropertiesPanel, rect.left, rect.top);
            
            if (isEnabled) TutorialHooks.onMotorEnabled(); // NEW
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

    Dom.objMotorAccelerationSlider.addEventListener('input', (e) => {
        const body = getSelectedBody();
        if (body) {
            const power = parseFloat(e.target.value);
            Dom.objMotorAccelerationValue.textContent = power;
            const userData = body.getUserData();
            if (userData?.motor) userData.motor.power = power;
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

export function initializeSpringPropertiesPanel(world) {
    // Кнопка закрытия
    addTapListener(document.getElementById('spring-properties-close-btn'), () => {
        hideSpringPropertiesPanel();
    });

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