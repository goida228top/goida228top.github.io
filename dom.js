
// Этот файл централизует все обращения к DOM дереву.

export const container = document.getElementById('simulation-container');

// Панели
export const objectPropertiesPanel = document.getElementById('object-properties-panel');
export const springPropertiesPanel = document.getElementById('spring-properties-panel'); // NEW
export const rewardMenuPanel = document.getElementById('reward-menu-panel'); // Новое меню наград
export const toolbar = document.getElementById('toolbar');
export const bottomToolbar = document.getElementById('bottom-toolbar');


// Main Menu
export const mainMenuOverlay = document.getElementById('main-menu-overlay');
export const mainMenuContainer = document.getElementById('main-menu-container'); // NEW
export const startGameBtn = document.getElementById('start-game-btn');
export const loadGameMenuBtn = document.getElementById('load-game-menu-btn');
export const aboutGameBtn = document.getElementById('about-game-btn');

// About Panel
export const aboutPanel = document.getElementById('about-panel');
export const aboutPanelCloseBtn = document.getElementById('about-panel-close-btn');

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
export const leftButton = document.getElementById('left-btn'); // NEW
export const rightButton = document.getElementById('right-btn'); // NEW
export const playPauseButton = document.getElementById('play-pause-btn');
export const playIcon = document.getElementById('play-icon');
export const pauseIcon = document.getElementById('pause-icon');
export const clearAllButton = document.getElementById('clear-all-btn');

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

// NEW: Элементы панели свойств стабилизатора
export const stabilizerSection = document.getElementById('stabilizer-section');
export const objStabilizerEnableToggle = document.getElementById('obj-stabilizer-enable');
export const objStabilizerAngleSlider = document.getElementById('obj-stabilizer-angle');
export const objStabilizerAngleValue = document.getElementById('obj-stabilizer-angle-value');


// NEW: Элементы панели свойств мотора
export const motorPropertiesSection = document.getElementById('motor-properties-section');
export const objMotorEnableToggle = document.getElementById('obj-motor-enable');
export const objMotorSpeedSlider = document.getElementById('obj-motor-speed');
export const objMotorSpeedValue = document.getElementById('obj-motor-speed-value');
export const objMotorAccelerationSlider = document.getElementById('obj-motor-acceleration'); // NEW
export const objMotorAccelerationValue = document.getElementById('obj-motor-acceleration-value'); // NEW
export const objMotorGripContainer = document.getElementById('obj-motor-grip-container'); // NEW
export const objMotorGripSlider = document.getElementById('obj-motor-grip'); // NEW
export const objMotorGripValue = document.getElementById('obj-motor-grip-value'); // NEW


// NEW: Элементы панели свойств пружины
export const springStiffnessSlider = document.getElementById('spring-stiffness');
export const springStiffnessValue = document.getElementById('spring-stiffness-value');
export const springDampingSlider = document.getElementById('spring-damping');
export const springDampingValue = document.getElementById('spring-damping-value');
export const deleteSelectedSpringButton = document.getElementById('delete-selected-spring-btn');
export const springLengthContainer = document.getElementById('spring-length-container');
export const springLengthSlider = document.getElementById('spring-length');
export const springLengthValue = document.getElementById('spring-length-value');
export const springFixedToggle = document.getElementById('spring-fixed-toggle');


// Индикаторы для отладки
export const debugInfo = document.getElementById('debug-info');
export const zoomIndicator = document.getElementById('zoom-indicator');
export const coordsIndicator = document.getElementById('coords-indicator');
export const fpsIndicator = document.getElementById('fps-indicator');

// Предупреждение о низкой производительности
export const lowFpsWarning = document.getElementById('low-fps-warning');
export const deleteAllWaterBtn = document.getElementById('delete-all-water-btn');
export const pauseFromWarningBtn = document.getElementById('pause-from-warning-btn');
export const doNothingBtn = document.getElementById('do-nothing-btn');
export const dontAskAgainBtn = document.getElementById('dont-ask-again-btn');

// NEW: Toast Container
export const toastContainer = document.getElementById('toast-container');

// NEW: Confirmation Modal Elements
export const confirmModalOverlay = document.getElementById('confirm-modal-overlay');
export const confirmModalTitle = document.getElementById('confirm-modal-title');
export const confirmModalMessage = document.getElementById('confirm-modal-message');
export const confirmModalConfirmBtn = document.getElementById('confirm-modal-confirm-btn');
export const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');

// --- Новые элементы панели настроек ---
export const newSettingsPanel = document.getElementById('new-settings-panel');
export const newSettingsCloseBtn = document.getElementById('new-settings-close-btn');
export const exitGameBtn = document.getElementById('exit-game-btn'); // Кнопка выхода в меню

// Physics Settings
export const newGravitySlider = document.getElementById('new-gravity-slider');
export const newGravityValue = document.getElementById('new-gravity-value');
export const velocityIterationsSlider = document.getElementById('velocity-iterations-slider');
export const velocityIterationsValue = document.getElementById('velocity-iterations-value');
export const positionIterationsSlider = document.getElementById('position-iterations-slider');
export const positionIterationsValue = document.getElementById('position-iterations-value');

// Graphics Settings
export const newLiquidEffectToggle = document.getElementById('new-liquid-effect-toggle');
export const newShowHitboxesToggle = document.getElementById('new-show-hitboxes-toggle');
export const maxWaterSlider = document.getElementById('max-water-slider');
export const maxWaterValue = document.getElementById('max-water-value');
export const maxSandSlider = document.getElementById('max-sand-slider');
export const maxSandValue = document.getElementById('max-sand-value');
export const waterColorPicker = document.getElementById('water-color-picker');
export const sandColorPicker = document.getElementById('sand-color-picker');

// Sound Settings
export const masterVolumeSlider = document.getElementById('master-volume-slider');
export const masterVolumeValue = document.getElementById('master-volume-value');
export const newUiSoundsToggle = document.getElementById('new-ui-sounds-toggle');
export const newObjectSoundsToggle = document.getElementById('new-object-sounds-toggle');
export const newEnvSoundsToggle = document.getElementById('new-env-sounds-toggle');

// Interface Settings
export const showDebugToggle = document.getElementById('show-debug-toggle');
