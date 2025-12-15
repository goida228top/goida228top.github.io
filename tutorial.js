
import * as Dom from './dom.js';
import { t } from './lang.js';
import { SoundManager } from './sound.js';
import { addTapListener } from './ui_common.js';
import { toolState } from './selection.js';

let currentStep = 0;
let isTutorialActive = false;

// Подсветка (Spotlight) через маску
function highlightElement(elementId, customTextKey = null, customTextParams = {}) {
    const el = document.getElementById(elementId);
    const mask = document.getElementById('tutorial-mask');
    const uiContainer = document.getElementById('tutorial-ui-container');
    const textBox = document.getElementById('tutorial-text');
    const arrowWrapper = document.getElementById('tutorial-pointer-wrapper');

    if (!el || !mask) return;

    // Скрываем стрелку по умолчанию при каждом новом шаге, если она не запрошена явно
    if(arrowWrapper) arrowWrapper.style.display = 'none';

    // Скроллим элемент в поле зрения, если он спрятан (для тулбара)
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    const rect = el.getBoundingClientRect();
    
    mask.style.display = 'block';
    mask.style.top = `${rect.top}px`;
    mask.style.left = `${rect.left}px`;
    mask.style.width = `${rect.width}px`;
    mask.style.height = `${rect.height}px`;
    
    const radius = getComputedStyle(el).borderRadius;
    mask.style.borderRadius = radius === '0px' ? '8px' : radius;
    mask.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.7)';

    // Позиционируем текст
    let top = rect.bottom + 20;
    let left = rect.left + rect.width / 2 - 150; 

    // Адаптация: если элемент внизу экрана, текст сверху
    if (top + 150 > window.innerHeight) {
        top = rect.top - 180;
    }
    
    // Границы экрана по горизонтали
    if (left < 10) left = 10;
    if (left + 300 > window.innerWidth) left = window.innerWidth - 310;

    uiContainer.style.top = `${top}px`;
    uiContainer.style.left = `${left}px`;
    
    if (customTextKey) {
        textBox.textContent = t(customTextKey, customTextParams);
    }
}

// Новая функция: Показать стрелку, указывающую на элемент
function showPointerAt(elementId, direction = 'down') {
    const el = document.getElementById(elementId);
    const arrowWrapper = document.getElementById('tutorial-pointer-wrapper');
    if (!el || !arrowWrapper) return;

    const rect = el.getBoundingClientRect();
    arrowWrapper.style.display = 'block';
    
    // Сброс стилей вращения
    arrowWrapper.style.transform = '';
    
    // Базовая позиция (указывает вниз, находится над элементом)
    let arrowTop = rect.top - 40;
    let arrowLeft = rect.left + rect.width / 2; 

    if (direction === 'up') {
        // Указывает вверх, находится под элементом
        arrowWrapper.style.transform = 'rotate(180deg)';
        arrowTop = rect.bottom + 10;
    } else if (direction === 'left') {
        // Указывает влево, находится справа от элемента
        arrowWrapper.style.transform = 'rotate(90deg)';
        arrowTop = rect.top + rect.height / 2;
        arrowLeft = rect.right + 25; // Сдвиг для компенсации ширины
    } else if (direction === 'right') {
        // Указывает вправо, находится слева от элемента
        arrowWrapper.style.transform = 'rotate(-90deg)';
        arrowTop = rect.top + rect.height / 2;
        arrowLeft = rect.left - 25;
    }

    arrowWrapper.style.top = `${arrowTop}px`;
    arrowWrapper.style.left = `${arrowLeft}px`;
}

// Специальная функция для шага "Нажми ПКМ" (круг в центре)
function highlightCenterCircle() {
    const mask = document.getElementById('tutorial-mask');
    const arrowWrapper = document.getElementById('tutorial-pointer-wrapper');
    
    const centerX = window.innerWidth / 2 - 50;
    const centerY = window.innerHeight / 2 - 50;
    
    mask.style.display = 'block';
    mask.style.top = `${centerY}px`;
    mask.style.left = `${centerX}px`;
    mask.style.width = '100px';
    mask.style.height = '100px';
    mask.style.borderRadius = '50%';
    mask.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.7)';
    
    // Текст
    const uiContainer = document.getElementById('tutorial-ui-container');
    uiContainer.style.top = `${centerY + 120}px`;
    uiContainer.style.left = `${window.innerWidth / 2 - 150}px`;
    document.getElementById('tutorial-text').textContent = t('tut-click-object');

    // Стрелка
    arrowWrapper.style.display = 'block';
    arrowWrapper.style.transform = ''; // Down
    arrowWrapper.style.top = `${centerY - 40}px`;
    arrowWrapper.style.left = `${window.innerWidth / 2}px`;
}


function clearHighlight() {
    const mask = document.getElementById('tutorial-mask');
    const arrowWrapper = document.getElementById('tutorial-pointer-wrapper');
    if (mask) {
         mask.style.width = '0';
         mask.style.height = '0';
         mask.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.0)';
    }
    if (arrowWrapper) arrowWrapper.style.display = 'none';
}

// Шаги обучения
const steps = [
    {
        // 0. Скролл (если нужно)
        id: 'scroll',
        check: () => {
            const scrollArea = document.getElementById('toolbar-scroll-area');
            return scrollArea && scrollArea.scrollWidth > scrollArea.clientWidth;
        },
        action: () => {
             highlightElement('toolbar-scroll-area', 'tut-scroll-toolbar');
        }
    },
    {
        // 1. Выбор круга. Жесткая проверка.
        id: 'select_circle',
        action: () => {
            highlightElement('circle-btn', 'tut-select-circle');
            showPointerAt('circle-btn', 'down');
        },
        // Этот шаг завершится только через хук onToolSelected с проверкой имени
    },
    {
        // 2. Рисование (СЛОЖНЫЙ ШАГ)
        id: 'draw_circle',
        allowSkipStep: true, // Показываем кнопку пропуска
        action: () => {
            clearHighlight(); // Убрать стрелку с кнопки
            
            const mask = document.getElementById('tutorial-mask');
            const centerX = window.innerWidth / 2 - 50;
            const centerY = window.innerHeight / 2 - 50;
            
            mask.style.top = `${centerY}px`;
            mask.style.left = `${centerX}px`;
            mask.style.width = '100px';
            mask.style.height = '100px';
            mask.style.borderRadius = '50%';
            mask.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.7)';
            
            const uiContainer = document.getElementById('tutorial-ui-container');
            uiContainer.style.top = `${centerY + 120}px`;
            uiContainer.style.left = `${window.innerWidth / 2 - 150}px`;
            
            document.getElementById('tutorial-text').textContent = t('tut-draw-circle');
        },
        nextOnAction: 'object_created' 
    },
    {
        // 3. Сразу после создания - призыв открыть меню (СЛОЖНЫЙ ШАГ)
        id: 'open_props',
        allowSkipStep: true,
        action: () => {
            highlightCenterCircle();
        },
        nextOnAction: 'properties_opened'
    },
    {
        // 4. Включение мотора (СЛОЖНЫЙ ШАГ)
        id: 'enable_motor',
        allowSkipStep: true,
        action: () => {
            // Ждем отрисовки попапа
            setTimeout(() => {
                 highlightElement('obj-motor-enable', 'tut-enable-motor');
                 showPointerAt('obj-motor-enable', 'right'); // Стрелка слева, указывает вправо
            }, 100);
        },
        nextOnAction: 'motor_enabled'
    },
    {
        // 5. Закрытие меню (крестик)
        id: 'close_props',
        action: () => {
            setTimeout(() => {
                highlightElement('object-properties-close-btn', 'tut-close-props');
                showPointerAt('object-properties-close-btn', 'left'); // Стрелка справа, указывает влево
            }, 50);
        },
        nextOnAction: 'panel_closed'
    },
    {
        // 6. Управление (показываем кнопки)
        id: 'controls',
        action: () => {
            if(document.getElementById('left-btn').style.display === 'none') {
                 document.getElementById('left-btn').style.display = 'flex';
                 document.getElementById('right-btn').style.display = 'flex';
            }
            highlightElement('bottom-toolbar', 'tut-controls');
            showPointerAt('bottom-toolbar', 'up'); // Стрелка снизу вверх
        }
    },
    // --- ЭКСКУРСИЯ ПО ИНТЕРФЕЙСУ (Информационные шаги) ---
    {
        id: 'info_box',
        action: () => highlightElement('box-btn', 'tut-info-box')
    },
    {
        id: 'info_poly',
        action: () => highlightElement('polygon-btn', 'tut-info-poly')
    },
    {
        id: 'info_brush',
        action: () => highlightElement('brush-btn', 'tut-info-brush')
    },
    {
        id: 'info_water',
        action: () => highlightElement('water-btn', 'tut-info-water')
    },
    {
        id: 'info_sand',
        action: () => highlightElement('sand-btn', 'tut-info-sand')
    },
    {
        id: 'info_eraser',
        action: () => highlightElement('eraser-btn', 'tut-info-eraser')
    },
    {
        id: 'info_joints',
        action: () => highlightElement('weld-btn', 'tut-info-joints')
    },
    {
        id: 'info_tnt',
        // Указываем на маленький (красный) ТНТ, так как остальные могут быть заблокированы
        action: () => highlightElement('tnt-small-btn', 'tut-info-tnt') 
    },
    {
        id: 'info_save',
        action: () => highlightElement('save-btn', 'tut-info-save')
    },
    {
        id: 'info_coins',
        action: () => highlightElement('reward-btn', 'tut-info-coins')
    },
    {
        id: 'info_settings',
        action: () => highlightElement('settings-btn', 'tut-info-settings')
    },
    {
        id: 'final',
        action: () => {
            clearHighlight();
            const uiContainer = document.getElementById('tutorial-ui-container');
            uiContainer.style.top = '50%';
            uiContainer.style.left = '50%';
            uiContainer.style.transform = 'translate(-50%, -50%)';
            document.getElementById('tutorial-text').textContent = t('tut-final-goodluck');
        }
    }
];

export function checkTutorial() {
    const isCompleted = localStorage.getItem('tutorial_completed');
    if (!isCompleted) {
        document.getElementById('tutorial-question-overlay').style.display = 'flex';
        
        addTapListener(document.getElementById('tut-yes-btn'), () => {
            document.getElementById('tutorial-question-overlay').style.display = 'none';
            startTutorial();
        });
        
        addTapListener(document.getElementById('tut-no-btn'), () => {
            document.getElementById('tutorial-question-overlay').style.display = 'none';
            localStorage.setItem('tutorial_completed', 'true');
        });
    }
}

function startTutorial() {
    isTutorialActive = true;
    currentStep = 0;
    document.getElementById('tutorial-overlay').style.display = 'block';
    
    // Кнопка глобального выхода
    addTapListener(document.getElementById('tutorial-exit-btn'), endTutorial);
    
    // Кнопка "Далее"
    addTapListener(document.getElementById('tutorial-next-btn'), nextStep);
    
    // Кнопка "Пропустить шаг"
    addTapListener(document.getElementById('tutorial-skip-step-btn'), nextStep);
    
    showStep();
}

function showStep() {
    if (currentStep >= steps.length) {
        endTutorial();
        return;
    }
    
    const step = steps[currentStep];
    
    if (step.check && !step.check()) {
        currentStep++;
        showStep();
        return;
    }
    
    // Логика кнопки "Пропустить шаг"
    const skipStepBtn = document.getElementById('tutorial-skip-step-btn');
    if (step.allowSkipStep) {
        skipStepBtn.style.display = 'block';
    } else {
        skipStepBtn.style.display = 'none';
    }
    
    step.action();
}

function nextStep() {
    SoundManager.playSound('ui_click');
    currentStep++;
    showStep();
}

function endTutorial() {
    isTutorialActive = false;
    document.getElementById('tutorial-overlay').style.display = 'none';
    localStorage.setItem('tutorial_completed', 'true');
    clearHighlight();
    // Сброс стилей контейнера туториала (если меняли в final)
    document.getElementById('tutorial-ui-container').style.transform = 'none';
}

// Hooks
export const TutorialHooks = {
    onToolSelected: (toolName) => {
        if (!isTutorialActive) return;
        const step = steps[currentStep];
        // Если текущий шаг - выбор круга, проверяем, реально ли выбрали круг
        if (step.id === 'select_circle') {
            if (toolName === 'circle') {
                nextStep();
            }
        }
    },
    onObjectCreated: () => {
        if (isTutorialActive && steps[currentStep].nextOnAction === 'object_created') {
            nextStep();
        }
    },
    onPropertiesOpened: () => {
        if (isTutorialActive && steps[currentStep].nextOnAction === 'properties_opened') {
            nextStep();
        }
    },
    onMotorEnabled: () => {
        if (isTutorialActive && steps[currentStep].nextOnAction === 'motor_enabled') {
            nextStep();
        }
    },
    onPanelClosed: () => {
        if (isTutorialActive && steps[currentStep].nextOnAction === 'panel_closed') {
            nextStep();
        }
    }
};
