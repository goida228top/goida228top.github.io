// Этот файл содержит все глобальные настройки игры и константы.

// --- Глобальные физические настройки ---
export const PHYSICS_SCALE = 50.0; // 50 пикселей на экране = 1 метр в физическом мире

// --- Настройки мира ---
export const WORLD_LEFT_X = -4000; // Левая граница мира в пикселях
export const WORLD_RIGHT_X = 8000; // Правая граница мира в пикселях
export const WORLD_TOP_Y = -3000; // Верхняя граница мира в пикселях
export const GROUND_Y = 1000;      // Уровень земли в пикселях

// --- Высоты слоев фона в пикселях ---
export const GRASS_HEIGHT = 20;
export const DIRT_HEIGHT = 150;
export const STONE_HEIGHT = DIRT_HEIGHT * 2;
export const WORLD_WIDTH = WORLD_RIGHT_X - WORLD_LEFT_X; // Ширина мира в пикселях
export const WORLD_BOTTOM_Y = GROUND_Y + GRASS_HEIGHT + DIRT_HEIGHT + STONE_HEIGHT; // Нижняя граница мира в пикселях

// --- Настройки камеры ---
export const CAMERA_MIN_SCALE = 0.1; // Минимальный зум
export const CAMERA_MAX_SCALE = 7.0; // Максимальный зум
export const CAMERA_INITIAL_SCALE = 0.6; // Начальный зум (-40%)
export const CAMERA_PAN_START_OFFSET_Y = 900; // Начальное смещение Y для камеры

// --- Настройки инструментов ---
export const TOOL_SETTINGS = {
    tnt: {
        small: { 
            power: 0.3,
            explosionRadius: 6, // Радиус взрыва в метрах
            baseVisualWidth: 0.8, // Базовая визуальная ширина в метрах
            baseVisualHeight: 0.3125, // Скорректировано для соответствия соотношению сторон текстуры (0.8 / 2.56)
            hitboxWidthRatio: 0.85, // Хитбокс соответствует текстуре по ширине, исключая фитиль
            hitboxHeightRatio: 0.70, // Хитбокс соответствует текстуре по высоте
            hitboxOffsetXRatio: 0.075 // Смещение хитбокса вправо для центрирования на динамитных шашках
        },
        medium: { 
            power: 2,
            explosionRadius: 12, // Радиус взрыва в метрах
            baseVisualWidth: 1.6, // Базовая визуальная ширина в метрах
            baseVisualHeight: 0.625, // Скорректировано для соответствия соотношению сторон текстуры (1.6 / 2.56)
            hitboxWidthRatio: 0.85, // Хитбокс соответствует текстуре по ширине, исключая фитиль
            hitboxHeightRatio: 0.70, // Хитбокс соответствует текстуре по высоте
            hitboxOffsetXRatio: 0.075 // Смещение хитбокса вправо для центрирования на динамитных шашках
        },
        large: { 
            power: 5,
            explosionRadius: 20, // Радиус взрыва в метрах
            baseVisualWidth: 2.4, // Базовая визуальная ширина в метрах
            baseVisualHeight: 0.9375, // Скорректировано для соответствия соотношению сторон текстуры (2.4 / 2.56)
            hitboxWidthRatio: 0.80, // Хитбокс соответствует текстуре по ширине, исключая фитиль
            hitboxHeightRatio: 0.70, // Хитбокс соответствует текстуре по высоте
            hitboxOffsetXRatio: 0.075 // Смещение хитбокса вправо для центрирования на динамитных шашках
        }
    },
    density: {
        minMass: 0.0025, // Минимальная масса для очень маленьких объектов
        normal: 0.0075   // Обычная плотность
    },
    brush: {
        radius: 8 // Радиус кисти в пикселях
    },
    spring: { // NEW
        defaultStiffness: 5.0, // frequencyHz
        defaultDamping: 0.5,   // dampingRatio
        minStiffness: 0.0,
        maxStiffness: 100.0,
        minDamping: 0.0,
        maxDamping: 1.0,
    }
};

// --- Настройки воды ---
export const WATER_MAX_PARTICLES = 1500;
export const WATER_VISUAL_RADIUS = 10;
export const WATER_PHYSICAL_RADIUS_FACTOR = 0.6;
// Константы для симуляции жидкости (поведение SPH)
export const WATER_GROUP_INDEX = -1;
export const WATER_INTERACTION_RADIUS_FACTOR = 3; // Радиус взаимодействия = WATER_PHYSICAL_RADIUS * фактор
export const WATER_STIFFNESS = 0.08;
export const WATER_REPULSION_STRENGTH = 0.1;
export const WATER_VISCOSITY = 0.05;
export const WATER_MAX_FORCE_SQ = 4.0; // Максимальная квадрат силы

// --- Настройки песка (квадратики) ---
export const SAND_MAX_PARTICLES = 1500;
export const SAND_VISUAL_RADIUS = 5; // Визуальный "радиус" (половина стороны) квадрата
export const SAND_PHYSICAL_RADIUS_FACTOR = 0.6; // Физический хитбокс меньше визуального
export const SAND_FRICTION = 1.0;
export const SAND_RESTITUTION = 0.0;
export const SAND_DENSITY = 0.2;

// --- Настройки Yandex SDK ---
export const YANDEX_INIT_TIMEOUT = 5000; // 5 секунд

// --- Настройки производительности ---
export const LOW_FPS_THRESHOLD = 5; // Порог FPS для предупреждения
export const LOW_FPS_COOLDOWN_MS = 30000; // 30 секунд

// --- URL-адреса всех изображений для предварительной загрузки ---
export const ALL_IMAGE_URLS = [
    'https://goida228top.github.io/textures/монетка.png',
    'https://goida228top.github.io/textures/10 монет.png',
    'https://goida228top.github.io/textures/50 монет.png',
    'https://goida228top.github.io/textures/100 монет.png',
    'https://goida228top.github.io/textures/крас.png', // Small TNT
    'https://goida228top.github.io/textures/син.png', // Medium TNT
    'https://goida228top.github.io/textures/жел.png', // Large TNT
    'https://goida228top.github.io/textures/реклама.png', // Ad icon
    'https://goida228top.github.io/textures/сохранение.png', // Save icon
];

// --- URL-адреса всех звуков для предварительной загрузки ---
export const ALL_SOUND_URLS = [
    { name: 'ui_click', url: 'https://goida228top.github.io/sounds/click.wav' },
    { name: 'create_object', url: 'https://goida228top.github.io/sounds/create.wav' },
    { name: 'explosion_small', url: 'https://goida228top.github.io/sounds/explosion_small.wav' },
    { name: 'explosion_medium', url: 'https://goida228top.github.io/sounds/explosion_medium.wav' },
    { name: 'explosion_large', url: 'https://goida228top.github.io/sounds/explosion_large.wav' },
    { name: 'water_pour', url: 'https://goida228top.github.io/sounds/water_pour.wav' },
    { name: 'sand_pour', url: 'https://goida228top.github.io/sounds/sand_pour.wav' },
    { name: 'collision_light', url: 'https://goida228top.github.io/sounds/impact_light.wav' },
    { name: 'collision_heavy', url: 'https://goida228top.github.io/sounds/impact_heavy.wav' },
    { name: 'reward', url: 'https://goida228top.github.io/sounds/reward.wav' },
];