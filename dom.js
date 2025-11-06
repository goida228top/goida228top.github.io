// Этот файл централизует все обращения к DOM дереву.

export const container = document.getElementById('simulation-container');

// Панели
export const settingsPanel = document.getElementById('settings-panel');
export const objectPropertiesPanel = document.getElementById('object-properties-panel');

// Эффекты
export const waterEffectContainer = document.getElementById('water-effect-container');
export const waterCanvas = document.getElementById('water-canvas');
export const waterContext = waterCanvas.getContext('2d');

// Фон
export const backgroundCanvas = document.getElementById('background-canvas');
export const backgroundContext = backgroundCanvas.getContext('2d');

// Кнопки верхней панели
export const moveButton = document.getElementById('move-btn');
export const fingerButton = document.getElementById('finger-btn');
export const boxButton = document.getElementById('box-btn');
export const polygonButton = document.getElementById('polygon-btn');
export const brushButton = document.getElementById('brush-btn');
export const tntSmallButton = document.getElementById('tnt-small-btn');
export const tntMediumButton = document.getElementById('tnt-medium-btn');
export const tntLargeButton = document.getElementById('tnt-large-btn');
export const waterButton = document.getElementById('water-btn');
export const eraserButton = document.getElementById('eraser-btn');
export const settingsButton = document.getElementById('settings-btn');
export const rewardButton = document.getElementById('reward-btn');
export const rewardButtonText = document.getElementById('reward-btn-text');

export const toolButtons = [moveButton, fingerButton, boxButton, polygonButton, brushButton, tntSmallButton, tntMediumButton, tntLargeButton, waterButton, eraserButton];

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
export const objFrictionSlider = document.getElementById('obj-friction');
export const objFrictionValue = document.getElementById('obj-friction-value');
export const objRestitutionSlider = document.getElementById('obj-restitution');
export const objRestitutionValue = document.getElementById('obj-restitution-value');
export const objDensitySlider = document.getElementById('obj-density');
export const objDensityValue = document.getElementById('obj-density-value');
export const objStaticToggle = document.getElementById('obj-static');
export const deleteSelectedButton = document.getElementById('delete-selected-btn');

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
