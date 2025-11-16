// Этот файл централизует все обращения к DOM дереву.

export const container = document.getElementById('simulation-container');

// Панели
export const settingsPanel = document.getElementById('settings-panel');
export const objectPropertiesPanel = document.getElementById('object-properties-panel');
export const springPropertiesPanel = document.getElementById('spring-properties-panel'); // NEW
export const rewardMenuPanel = document.getElementById('reward-menu-panel'); // Новое меню наград

// Эффекты
export const waterEffectContainer = document.getElementById('water-effect-container');
export const waterCanvas = document.getElementById('water-canvas');
export const waterContext = waterCanvas.getContext('2d');

export const sandEffectContainer = document.getElementById('sand-effect-container'); // Новый контейнер для песка
export const sandCanvas = document.getElementById('sand-canvas'); // Новый канвас для песка
export const sandContext = sandCanvas.getContext('2d'); // Новый контекст для песка


// Фон
export const backgroundCanvas = document.getElementById('background-canvas');
export const backgroundContext = backgroundCanvas.getContext('2d');

// Кнопки верхней панели
export const moveButton = document.getElementById('move-btn');
export const fingerButton = document.getElementById('finger-btn');
export const boxButton = document.getElementById('box-btn');
export const circleButton = document.getElementById('circle-btn'); // NEW
export const polygonButton = document.getElementById('polygon-btn');
export const brushButton = document.getElementById('brush-btn');
export const weldButton = document.getElementById('weld-btn');
export const springButton = document.getElementById('spring-btn'); // NEW
export const rodButton = document.getElementById('rod-btn'); // NEW: Стержень
export const tntSmallButton = document.getElementById('tnt-small-btn');
export const tntMediumButton = document.getElementById('tnt-medium-btn');
export const tntLargeButton = document.getElementById('tnt-large-btn');
export const waterButton = document.getElementById('water-btn');
export const sandButton = document.getElementById('sand-btn'); // Новая кнопка для песка
export const eraserButton = document.getElementById('eraser-btn');
export const saveButton = document.getElementById('save-btn');
export const loadButton = document.getElementById('load-btn');
export const settingsButton = document.getElementById('settings-btn');
export const coinsDisplay = document.getElementById('reward-btn'); // Теперь div для отображения монет
export const coinsCountSpan = document.getElementById('coins-count'); // Span для количества монет

// Кнопки меню наград
export const reward10Btn = document.getElementById('reward-10-btn');
export const reward50Btn = document.getElementById('reward-50-btn');
export const reward100Btn = document.getElementById('reward-100-btn');
export const rewardMenuCloseBtn = document.getElementById('reward-menu-close-btn'); // Кнопка "Закрыть"

// Новые элементы для Сохранения/Загрузки
export const saveLoadPanel = document.getElementById('save-load-panel');
export const saveLoadCloseBtn = document.getElementById('save-load-close-btn');
export const saveLoadTitle = document.getElementById('save-load-title');
export const saveSlotsContainer = document.getElementById('save-slots-container');

export const toolButtons = [moveButton, fingerButton, boxButton, circleButton, polygonButton, brushButton, weldButton, springButton, rodButton, tntSmallButton, tntMediumButton, tntLargeButton, waterButton, sandButton, eraserButton];

// Кнопки нижней панели
export const playPauseButton = document.getElementById('play-pause-btn');
export const playIcon = document.getElementById('play-icon');
export const pauseIcon = document.getElementById('pause-icon');

// Элементы панели настроек
export const gravitySlider = document.getElementById('gravity-slider');
export const gravityValue = document.getElementById('gravity-value');
export const liquidEffectToggle = document.getElementById('liquid-effect-toggle');
export const showHitboxesToggle = document.getElementById('show-hitboxes-toggle');

// Элементы панели свойств объекта
export const objColorInput = document.getElementById('obj-color');
export const objFrictionContainer = document.getElementById('obj-friction-container'); // NEW
export const objFrictionSlider = document.getElementById('obj-friction');
export const objFrictionValue = document.getElementById('obj-friction-value');
export const objRestitutionSlider = document.getElementById('obj-restitution');
export const objRestitutionValue = document.getElementById('obj-restitution-value');
export const objDensitySlider = document.getElementById('obj-density');
export const objDensityValue = document.getElementById('obj-density-value');
export const objResistanceSlider = document.getElementById('obj-resistance'); // NEW
export const objResistanceValue = document.getElementById('obj-resistance-value'); // NEW
export const objStaticToggle = document.getElementById('obj-static');
export const deleteSelectedButton = document.getElementById('delete-selected-btn');

// NEW: Элементы панели свойств мотора
export const motorPropertiesSection = document.getElementById('motor-properties-section');
export const objMotorEnableToggle = document.getElementById('obj-motor-enable');
export const objMotorSpeedSlider = document.getElementById('obj-motor-speed');
export const objMotorSpeedValue = document.getElementById('obj-motor-speed-value');
export const objMotorGripContainer = document.getElementById('obj-motor-grip-container'); // NEW
export const objMotorGripSlider = document.getElementById('obj-motor-grip'); // NEW
export const objMotorGripValue = document.getElementById('obj-motor-grip-value'); // NEW


// NEW: Элементы панели свойств пружины
export const springStiffnessSlider = document.getElementById('spring-stiffness');
export const springStiffnessValue = document.getElementById('spring-stiffness-value');
export const springDampingSlider = document.getElementById('spring-damping');
export const springDampingValue = document.getElementById('spring-damping-value');
export const deleteSelectedSpringButton = document.getElementById('delete-selected-spring-btn');


// Индикаторы для отладки
export const zoomIndicator = document.getElementById('zoom-indicator');
export const coordsIndicator = document.getElementById('coords-indicator');
export const fpsIndicator = document.getElementById('fps-indicator');

// Предупреждение о низкой производительности
export const lowFpsWarning = document.getElementById('low-fps-warning');
export const deleteAllWaterBtn = document.getElementById('delete-all-water-btn');
export const pauseFromWarningBtn = document.getElementById('pause-from-warning-btn');
export const doNothingBtn = document.getElementById('do-nothing-btn');
export const dontAskAgainBtn = document.getElementById('dont-ask-again-btn');