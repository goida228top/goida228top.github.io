
import * as Dom from './dom.js';
import { 
    PHYSICS_SCALE, 
    WORLD_BOTTOM_Y, WORLD_TOP_Y, WORLD_LEFT_X, WORLD_RIGHT_X, 
    GRASS_HEIGHT, DIRT_HEIGHT, STONE_HEIGHT,
    CAMERA_MIN_SCALE, CAMERA_MAX_SCALE, CAMERA_INITIAL_SCALE, CAMERA_PAN_START_OFFSET_Y
} from './game_config.js';

let viewOffset = { x: 0, y: 0 };
let scale = CAMERA_INITIAL_SCALE;
const minScale = CAMERA_MIN_SCALE;
const maxScale = CAMERA_MAX_SCALE;

// Состояния управления
let isPanning = false; // Для мыши (средняя кнопка)
let panStart = { x: 0, y: 0 };

// Для сенсорного управления (2 пальца)
let isMultitouch = false;
let lastPinchDistance = 0;
let lastPinchCenter = { x: 0, y: 0 };

const CAMERA_PADDING = GRASS_HEIGHT + DIRT_HEIGHT + STONE_HEIGHT;

function setCanvasSize(canvas) {
    canvas.width = Dom.container.clientWidth;
    canvas.height = Dom.container.clientHeight;
}

export function resizeCamera(render) {
    setCanvasSize(render.canvas);
    setCanvasSize(Dom.waterCanvas);
    setCanvasSize(Dom.sandCanvas);
    setCanvasSize(Dom.backgroundCanvas);
    
    if (Dom.waterEffectContainer) {
        Dom.waterEffectContainer.style.width = `${Dom.container.clientWidth}px`;
        Dom.waterEffectContainer.style.height = `${Dom.container.clientHeight}px`;
    }
    if (Dom.sandEffectContainer) {
        Dom.sandEffectContainer.style.width = `${Dom.container.clientWidth}px`;
        Dom.sandEffectContainer.style.height = `${Dom.container.clientHeight}px`;
    }
}

export function initializeCamera(render) {
    // Центрируем камеру при старте
    viewOffset.x = 0 - (render.options.width * scale / 2);
    viewOffset.y = CAMERA_PAN_START_OFFSET_Y - (render.options.height * scale / 2);
    
    // --- Мышь ---
    Dom.container.addEventListener('wheel', handleWheel, { passive: false });
    Dom.container.addEventListener('mousedown', handleMouseDown);
    Dom.container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // --- Тач (Сенсор) ---
    // Используем Dom.container вместо window, чтобы не перехватывать касания на UI
    Dom.container.addEventListener('touchstart', handleTouchStart, { passive: false });
    Dom.container.addEventListener('touchmove', handleTouchMove, { passive: false });
    Dom.container.addEventListener('touchend', handleTouchEnd);
    Dom.container.addEventListener('touchcancel', handleTouchEnd);

    function applyLiquidFilters() {
        if (Dom.newLiquidEffectToggle && Dom.newLiquidEffectToggle.checked) {
            const blurAmount = 5 / scale;
            const contrastAmount = 25;
            const filterStyle = `blur(${blurAmount.toFixed(2)}px) contrast(${contrastAmount})`;
            Dom.waterEffectContainer.style.filter = filterStyle;
            Dom.sandEffectContainer.style.filter = filterStyle;
        } else {
            if (Dom.waterEffectContainer) Dom.waterEffectContainer.style.filter = 'none';
            if (Dom.sandEffectContainer) Dom.sandEffectContainer.style.filter = 'none';
        }
    }

    function clampViewOffset() {
        // Ограничиваем камеру, чтобы не улететь в бесконечность
        const maxOffsetX = WORLD_RIGHT_X - render.canvas.width * scale + CAMERA_PADDING;
        const minOffsetX = WORLD_LEFT_X - CAMERA_PADDING;
        
        const maxOffsetY = WORLD_BOTTOM_Y - render.canvas.height * scale;
        const minOffsetY = WORLD_TOP_Y - CAMERA_PADDING;
        
        viewOffset.x = Math.max(minOffsetX, Math.min(viewOffset.x, maxOffsetX));
        viewOffset.y = Math.max(minOffsetY, Math.min(viewOffset.y, maxOffsetY));
    }

    // --- Логика Мыши ---
    function handleMouseDown(e) {
        if (e.button === 1) { // Средняя кнопка мыши (колесо)
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
            Dom.container.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    function handleMouseMove(e) {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            
            viewOffset.x -= dx * scale;
            viewOffset.y -= dy * scale;

            clampViewOffset();
            updateView();
            panStart = { x: e.clientX, y: e.clientY };
        }
    }

    function handleMouseUp(e) {
        if (isPanning && e.button === 1) {
            isPanning = false;
            Dom.container.style.cursor = 'default';
        }
    }

    function handleWheel(e) {
        e.preventDefault();
        const worldPosBeforeZoom = getMousePos(e, true); // Точка под курсором в мире (пиксели)
        const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
        zoomAtPoint(worldPosBeforeZoom, scaleFactor, e.clientX, e.clientY);
    }

    // --- Логика Тач (Мультитач) ---
    
    function getPinchDistance(t1, t2) {
        return Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
    }
    
    function getPinchCenter(t1, t2) {
        return { 
            x: (t1.clientX + t2.clientX) / 2, 
            y: (t1.clientY + t2.clientY) / 2 
        };
    }

    function handleTouchStart(e) {
        if (e.touches.length === 2) {
            // Начало жеста двумя пальцами
            isMultitouch = true;
            lastPinchDistance = getPinchDistance(e.touches[0], e.touches[1]);
            lastPinchCenter = getPinchCenter(e.touches[0], e.touches[1]);
            e.preventDefault(); // Предотвращаем нативные жесты браузера
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 2 && isMultitouch) {
            e.preventDefault();

            const currentDistance = getPinchDistance(e.touches[0], e.touches[1]);
            const currentCenter = getPinchCenter(e.touches[0], e.touches[1]);

            // 1. Панорамирование (смещение центра щипка)
            const dx = currentCenter.x - lastPinchCenter.x;
            const dy = currentCenter.y - lastPinchCenter.y;
            
            viewOffset.x -= dx * scale;
            viewOffset.y -= dy * scale;

            // 2. Зум (изменение расстояния между пальцами)
            if (lastPinchDistance > 0) {
                const scaleFactor = lastPinchDistance / currentDistance; // Инвертируем, так как scale увеличивается при отдалении
                
                // Точка в мире, вокруг которой зумим (центр между пальцами)
                const rect = render.canvas.getBoundingClientRect();
                const worldFocusPoint = {
                    x: viewOffset.x + (currentCenter.x - rect.left) * scale,
                    y: viewOffset.y + (currentCenter.y - rect.top) * scale
                };
                
                let newScale = scale * scaleFactor;
                newScale = Math.max(minScale, Math.min(maxScale, newScale));

                if (Math.abs(newScale - scale) > 0.0001) {
                    scale = newScale;
                    // Корректируем viewOffset, чтобы точка под пальцами осталась на месте
                    viewOffset.x = worldFocusPoint.x - (currentCenter.x - rect.left) * scale;
                    viewOffset.y = worldFocusPoint.y - (currentCenter.y - rect.top) * scale;
                }
            }

            lastPinchDistance = currentDistance;
            lastPinchCenter = currentCenter;

            clampViewOffset();
            updateView();
            applyLiquidFilters();
        }
    }

    function handleTouchEnd(e) {
        if (e.touches.length < 2) {
            isMultitouch = false;
        }
    }

    // Общая функция зума
    function zoomAtPoint(worldPointPx, scaleFactor, screenX, screenY) {
        let newScale = scale * scaleFactor;
        newScale = Math.max(minScale, Math.min(maxScale, newScale));

        if (newScale !== scale) {
            scale = newScale;
            
            const rect = render.canvas.getBoundingClientRect();
            const mouseScreenX = screenX - rect.left;
            const mouseScreenY = screenY - rect.top;

            // Пересчитываем offset так, чтобы точка под курсором осталась на месте в мире
            viewOffset.x = worldPointPx.x - mouseScreenX * scale;
            viewOffset.y = worldPointPx.y - mouseScreenY * scale;

            clampViewOffset();
            updateView();
            applyLiquidFilters();
        }
    }
    
    function updateView() {
        render.bounds.min.x = viewOffset.x;
        render.bounds.min.y = viewOffset.y;
        render.bounds.max.x = viewOffset.x + render.canvas.width * scale;
        render.bounds.max.y = viewOffset.y + render.canvas.height * scale;
        
        if (Dom.zoomIndicator) {
            const zoomPercentage = (1 - scale) * -100; // Примерная визуализация
            Dom.zoomIndicator.textContent = `Zoom: ${(1/scale * 100).toFixed(0)}%`;
        }
        if (Dom.coordsIndicator) {
            const centerX = (render.bounds.min.x + render.bounds.max.x) / (2 * PHYSICS_SCALE);
            const centerY = (render.bounds.min.y + render.bounds.max.y) / (2 * PHYSICS_SCALE);
            Dom.coordsIndicator.textContent = `X: ${centerX.toFixed(0)}, Y: ${centerY.toFixed(0)}`;
        }
    }
    
    function getMousePos(event, inPixels = false) {
        const rect = render.canvas.getBoundingClientRect();
        // Поддержка и мыши, и первого касания
        const clientX = event.touches ? event.touches[0].clientX : (event.clientX ?? 0);
        const clientY = event.touches ? event.touches[0].clientY : (event.clientY ?? 0);
        
        const worldX = viewOffset.x + (clientX - rect.left) * scale;
        const worldY = viewOffset.y + (clientY - rect.top) * scale;

        if (inPixels) {
            return { x: worldX, y: worldY }; // Простой объект, не planck.Vec2, чтобы не зависеть от библиотеки здесь
        }
        
        // Возвращаем объект, совместимый с planck.Vec2 (имеет x и y)
        return { x: worldX / PHYSICS_SCALE, y: worldY / PHYSICS_SCALE, clone: function() { return {x: this.x, y: this.y} } };
    }

    return {
        get scale() { return scale; },
        get viewOffset() { return viewOffset; },
        get render() { return render; },
        isPanning: () => isPanning || isMultitouch, // UI может использовать это, чтобы знать, занята ли камера
        getMousePos,
        updateView,
        applyLiquidFilters,
        restoreCameraState: (state) => {
            scale = state.scale;
            viewOffset.x = state.viewOffset.x;
            viewOffset.y = state.viewOffset.y;
        }
    };
}
