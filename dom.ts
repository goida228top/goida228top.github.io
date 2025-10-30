// Этот файл централизует все обращения к DOM дереву.

export const container = document.getElementById('simulation-container') as HTMLElement;
export const groundDiv = document.getElementById('ground') as HTMLElement;

// Панели
export const settingsPanel = document.getElementById('settings-panel') as HTMLElement;
export const objectPropertiesPanel = document.getElementById('object-properties-panel') as HTMLElement;

// Эффекты
export const waterEffectContainer = document.getElementById('water-effect-container') as HTMLElement;
export const waterCanvas = document.getElementById('water-canvas') as HTMLCanvasElement;
export const waterContext = waterCanvas.getContext('2d');

// Кнопки верхней панели
export const moveButton = document.getElementById('move-btn') as HTMLButtonElement;
export const fingerButton = document.getElementById('finger-btn') as HTMLButtonElement;
export const boxButton = document.getElementById('box-btn') as HTMLButtonElement;
export const polygonButton = document.getElementById('polygon-btn') as HTMLButtonElement;
export const lineButton = document.getElementById('line-btn') as HTMLButtonElement;
export const brushButton = document.getElementById('brush-btn') as HTMLButtonElement;
export const waterButton = document.getElementById('water-btn') as HTMLButtonElement;
export const eraserButton = document.getElementById('eraser-btn') as HTMLButtonElement;
export const settingsButton = document.getElementById('settings-btn') as HTMLButtonElement;

export const toolButtons = [moveButton, fingerButton, boxButton, polygonButton, lineButton, brushButton, waterButton, eraserButton];

// Кнопки нижней панели
export const playPauseButton = document.getElementById('play-pause-btn') as HTMLButtonElement;
export const playIcon = document.getElementById('play-icon') as HTMLElement;
export const pauseIcon = document.getElementById('pause-icon') as HTMLElement;

// Элементы панели настроек
export const gravitySlider = document.getElementById('gravity-slider') as HTMLInputElement;
export const gravityValue = document.getElementById('gravity-value') as HTMLElement;
export const liquidEffectToggle = document.getElementById('liquid-effect-toggle') as HTMLInputElement;

// Элементы панели свойств объекта
export const objColorInput = document.getElementById('obj-color') as HTMLInputElement;
export const objFrictionSlider = document.getElementById('obj-friction') as HTMLInputElement;
export const objFrictionValue = document.getElementById('obj-friction-value') as HTMLElement;
export const objRestitutionSlider = document.getElementById('obj-restitution') as HTMLInputElement;
export const objRestitutionValue = document.getElementById('obj-restitution-value') as HTMLElement;
export const objDensitySlider = document.getElementById('obj-density') as HTMLInputElement;
export const objDensityValue = document.getElementById('obj-density-value') as HTMLElement;
export const objStaticToggle = document.getElementById('obj-static') as HTMLInputElement;
export const deleteSelectedButton = document.getElementById('delete-selected-btn') as HTMLButtonElement;