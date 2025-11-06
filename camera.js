import * as Dom from './dom.js';
import { PHYSICS_SCALE } from './config.js';
// Импортируем все необходимые константы
import { WORLD_BOTTOM_Y, WORLD_TOP_Y, WORLD_LEFT_X, WORLD_RIGHT_X, GRASS_HEIGHT, DIRT_HEIGHT, STONE_HEIGHT } from './world.js';

let viewOffset = { x: 0, y: 0 };
let scale = 0.6; // Начальный зум -40%
const minScale = 0.1;
const maxScale = 7.0; // Увеличено до 7.0 для 600% отдаления
let isPanning = false;
let panStart = { x: 0, y: 0 };

// Для сенсорного управления
let isPinching = false;
let lastPinchDistance = 0;

const CAMERA_PADDING = GRASS_HEIGHT + DIRT_HEIGHT + STONE_HEIGHT;


export function initializeCamera(render) {
    // Устанавливаем начальную позицию камеры до первого рендера
    viewOffset.x = 0 - (render.options.width * scale / 2);
    viewOffset.y = 900 - (render.options.height * scale / 2);
    
    Dom.container.addEventListener('wheel', handleWheel, { passive: false });
    Dom.container.addEventListener('mousedown', handleMouseDown);
    Dom.container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    Dom.container.addEventListener('mouseleave', () => {
        if (isPanning) {
            isPanning = false;
            Dom.container.style.cursor = 'default';
        }
    });
    
    Dom.container.addEventListener('touchstart', handleTouchStart, { passive: false });
    Dom.container.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    function applyWaterFilter() {
        if (Dom.liquidEffectToggle.checked) {
            const blurAmount = 5 / scale;
            const contrastAmount = 25;
            Dom.waterEffectContainer.style.filter = `blur(${blurAmount.toFixed(2)}px) contrast(${contrastAmount})`;
        } else {
            Dom.waterEffectContainer.style.filter = 'none';
        }
    }

    function clampViewOffset() {
        const maxOffsetX = WORLD_RIGHT_X - render.canvas.width * scale + CAMERA_PADDING;
        const minOffsetX = WORLD_LEFT_X - CAMERA_PADDING;
        
        const maxOffsetY = WORLD_BOTTOM_Y - render.canvas.height * scale;
        const minOffsetY = WORLD_TOP_Y - CAMERA_PADDING;
        
        viewOffset.x = Math.max(minOffsetX, Math.min(viewOffset.x, maxOffsetX));
        viewOffset.y = Math.max(minOffsetY, Math.min(viewOffset.y, maxOffsetY));
    }

    function handleMouseDown(e) {
        if (e.button === 1) { // Средняя кнопка мыши
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
        const worldPosBeforeZoom = getMousePos(e, true); // Получаем в пикселях
        const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
        let newScale = scale * scaleFactor;

        newScale = Math.max(minScale, Math.min(maxScale, newScale));

        if (newScale !== scale) {
            scale = newScale;
            
            const rect = render.canvas.getBoundingClientRect();
            const mouseScreenX = e.clientX - rect.left;
            const mouseScreenY = e.clientY - rect.top;

            viewOffset.x = worldPosBeforeZoom.x - mouseScreenX * scale;
            viewOffset.y = worldPosBeforeZoom.y - mouseScreenY * scale;

            clampViewOffset();

            updateView();
            applyWaterFilter();
        }
    }
    
    function getPinchDistance(e) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        return Math.sqrt(Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2));
    }
    
    function getPinchMidpoint(e) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        return { clientX: (t1.clientX + t2.clientX) / 2, clientY: (t1.clientY + t2.clientY) / 2 };
    }

    function handleTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            isPinching = true;
            isPanning = true;
            lastPinchDistance = getPinchDistance(e);
            const midpoint = getPinchMidpoint(e);
            panStart = { x: midpoint.clientX, y: midpoint.clientY };
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 2 && isPinching) {
            e.preventDefault();
            
            const midpoint = getPinchMidpoint(e);
            
            const dx = midpoint.clientX - panStart.x;
            const dy = midpoint.clientY - panStart.y;
            viewOffset.x -= dx * scale;
            viewOffset.y -= dy * scale;
            panStart = { x: midpoint.clientX, y: midpoint.clientY };

            const pinchDistance = getPinchDistance(e);
            const worldPosBeforeZoom = getMousePos(midpoint, true); // Получаем в пикселях
            
            const scaleFactor = pinchDistance / lastPinchDistance;
            let newScale = scale * scaleFactor;
            newScale = Math.max(minScale, Math.min(maxScale, newScale));

            if (newScale.toFixed(4) !== scale.toFixed(4)) {
                scale = newScale;
                const rect = render.canvas.getBoundingClientRect();
                const mouseScreenX = midpoint.clientX - rect.left;
                const mouseScreenY = midpoint.clientY - rect.top;
                viewOffset.x = worldPosBeforeZoom.x - mouseScreenX * scale;
                viewOffset.y = worldPosBeforeZoom.y - mouseScreenY * scale;
            }

            lastPinchDistance = pinchDistance;
            
            clampViewOffset();

            updateView();
            applyWaterFilter();
        }
    }

    function handleTouchEnd(e) {
        if (e.touches.length < 2 && isPinching) {
            isPinching = false;
            isPanning = false;
        }
    }
    
    function updateView() {
        render.bounds.min.x = viewOffset.x;
        render.bounds.min.y = viewOffset.y;
        render.bounds.max.x = viewOffset.x + render.canvas.width * scale;
        render.bounds.max.y = viewOffset.y + render.canvas.height * scale;
        
        if (Dom.zoomIndicator) {
            const zoomPercentage = (1 - scale) * -100;
            Dom.zoomIndicator.textContent = `Zoom: ${zoomPercentage.toFixed(0)}%`;
        }
        if (Dom.coordsIndicator) {
            const centerX = (render.bounds.min.x + render.bounds.max.x) / (2 * PHYSICS_SCALE);
            const centerY = (render.bounds.min.y + render.bounds.max.y) / (2 * PHYSICS_SCALE);
            Dom.coordsIndicator.textContent = `X: ${centerX.toFixed(0)}, Y: ${centerY.toFixed(0)}`;
        }
    }
    
    function getMousePos(event, inPixels = false) {
        const rect = render.canvas.getBoundingClientRect();
        const clientX = event.clientX ?? 0;
        const clientY = event.clientY ?? 0;
        
        const worldX = viewOffset.x + (clientX - rect.left) * scale;
        const worldY = viewOffset.y + (clientY - rect.top) * scale;

        if (inPixels) {
            return planck.Vec2(worldX, worldY);
        }
        
        return planck.Vec2(worldX / PHYSICS_SCALE, worldY / PHYSICS_SCALE);
    }
    
    function resetCamera(height, groundY) {
         scale = 1;
         viewOffset.x = -render.canvas.width / 2;
         viewOffset.y = groundY - height + 100;
    }

    updateView();
    applyWaterFilter();

    return {
        render,
        get viewOffset() { return viewOffset; },
        get scale() { return scale; },
        isPanning: () => isPanning,
        updateView,
        getMousePos,
        resetCamera,
        applyWaterFilter
    };
}

export function resizeCamera(render) {
    const { clientWidth: width, clientHeight: height } = Dom.container;
    // Обновляем все canvas
    render.canvas.width = width;
    render.canvas.height = height;
    Dom.waterCanvas.width = width;
    Dom.waterCanvas.height = height;
    Dom.backgroundCanvas.width = width;
    Dom.backgroundCanvas.height = height;
}