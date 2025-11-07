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
            baseVisualWidth: 0.8, // Базовая визуальная ширина в метрах (примерно 3 шашки, 0.8 - ширина одной шашки)
            baseVisualHeight: 0.4, // Базовая визуальная высота в метрах (0.56 - высота одной шашки)
            hitboxWidthRatio: 0.7, // Около 70% ширины, чтобы исключить фитиль и края
            hitboxHeightRatio: 0.85, // Около 85% высоты
            hitboxOffsetXRatio: 0.15 // Смещение вправо на 15% от общей ширины для компенсации фитиля
        },
        medium: { 
            power: 2,
            explosionRadius: 12, // Радиус взрыва в метрах
            baseVisualWidth: 1.6, // Базовая визуальная ширина в метрах (0.8 * 2)
            baseVisualHeight: 1.12, // Базовая визуальная высота в метрах (0.56 * 2)
            hitboxWidthRatio: 0.7, // Около 70% ширины
            hitboxHeightRatio: 0.85, // Около 85% высоты
            hitboxOffsetXRatio: 0.15 // Смещение вправо на 15%
        },
        large: { 
            power: 5,
            explosionRadius: 20, // Радиус взрыва в метрах
            baseVisualWidth: 2.4, // Базовая визуальная ширина в метрах (0.8 * 3)
            baseVisualHeight: 1.68, // Базовая визуальная высота в метрах (0.56 * 3)
            hitboxWidthRatio: 0.7, // Около 70% ширины
            hitboxHeightRatio: 0.85, // Около 85% высоты
            hitboxOffsetXRatio: 0.15 // Смещение вправо на 15%
        }
    },
    density: {
        minMass: 0.0025, // Минимальная масса для очень маленьких объектов
        normal: 0.0075   // Обычная плотность
    },
    brush: {
        radius: 8 // Радиус кисти в пикселях
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

// --- Настройки Yandex SDK ---
export const YANDEX_INIT_TIMEOUT = 500