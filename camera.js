import Matter from 'matter-js';
import * as Dom from './dom.js';

const { Mouse } = Matter;

let viewOffset = { x: 0, y: 0 };
let scale = 1;
const minScale = 0.1;
const maxScale = 5.0;
let isPanning = false;
let panStart = { x: 0, y: 0 };

// Для сенсорного управления
let isPinching = false;
let lastPinchDistance = 0;


export function initializeCamera(render) {
    // Мышь
    render.canvas.addEventListener('wheel', handleWheel, { passive: false });
    render.canvas.addEventListener('mousedown', handleMouseDown);
    render.canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    render.canvas.addEventListener('mouseleave', () => {
        if (isPanning) {
            isPanning = false;
            Dom.container.style.cursor = 'default';
        }
    });
    
    // Сенсорное управление
    render.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    render.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    
    // Привязываем мышь Matter.js к рендереру
    const mouse = Mouse.create(render.canvas);

    // --- Обработчики мыши ---
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
        const worldPosBeforeZoom = getMousePos(e);
        const scaleFactor = e.deltaY < 0 ? 0.9 : 1.1;
        let newScale = scale * scaleFactor;

        newScale = Math.max(minScale, Math.min(maxScale, newScale));

        if (newScale !== scale) {
            scale = newScale;
            
            const rect = render.canvas.getBoundingClientRect();
            const mouseScreenX = e.clientX - rect.left;
            const mouseScreenY = e.clientY - rect.top;

            viewOffset.x = worldPosBeforeZoom.x - mouseScreenX * scale;
            viewOffset.y = worldPosBeforeZoom.y - mouseScreenY * scale;

            updateView();
        }
    }

    // --- Обработчики сенсорного ввода ---
    
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
            
            // --- Панорамирование (2 пальца) ---
            const dx = midpoint.clientX - panStart.x;
            const dy = midpoint.clientY - panStart.y;
            viewOffset.x -= dx / scale; // Делим на scale для корректного панорамирования при разном зуме
            viewOffset.y -= dy / scale;
            panStart = { x: midpoint.clientX, y: midpoint.clientY };

            // --- Масштабирование ---
            const pinchDistance = getPinchDistance(e);
            const worldPosBeforeZoom = getMousePos(midpoint);
            
            const scaleFactor = pinchDistance / lastPinchDistance;
            let newScale = scale / scaleFactor; // Делим, а не умножаем, т.к. работаем с bounds
            newScale = Math.max(minScale, Math.min(maxScale, newScale));

            if (newScale.toFixed(4) !== scale.toFixed(4)) {
                scale = newScale;
                const rect = render.canvas.getBoundingClientRect();
                const mouseScreenX = midpoint.clientX - rect.left;
                const mouseScreenY = midpoint.clientY - rect.top;
                
                // Пересчитываем смещение, чтобы зум был от центра между пальцами
                const newWorldX = viewOffset.x + mouseScreenX * scale;
                const newWorldY = viewOffset.y + mouseScreenY * scale;
                viewOffset.x -= (newWorldX - worldPosBeforeZoom.x);
                viewOffset.y -= (newWorldY - worldPosBeforeZoom.y);
            }

            lastPinchDistance = pinchDistance;
            updateView();
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
        
        Mouse.setOffset(mouse, render.bounds.min);
        Mouse.setScale(mouse, { x: 1/scale, y: 1/scale });
        
        const groundScreenY = (Number(localStorage.getItem('ground_y')) - render.bounds.min.y) / scale;
        Dom.groundDiv.style.transform = `translateY(${groundScreenY}px) scaleY(${1/scale})`;
    }
    
    
    function getMousePos(event) {
        const rect = render.canvas.getBoundingClientRect();
        const clientX = event.clientX ?? event.touches?.[0]?.clientX;
        const clientY = event.clientY ?? event.touches?.[0]?.clientY;
        return { 
            x: render.bounds.min.x + (clientX - rect.left) / scale,
            y: render.bounds.min.y + (clientY - rect.top) / scale
        };
    }
    
    function resetCamera(height, groundY) {
         scale = 1;
         viewOffset.x = -render.canvas.width / 2;
         viewOffset.y = groundY - height + 100; // Показываем немного неба над землей
    }

    return {
        get viewOffset() { return viewOffset; },
        get scale() { return scale; },
        isPanning: () => isPanning,
        updateView,
        getMousePos,
        resetCamera,
        mouse
    };
}

export function resizeCamera(render) {
    const { clientWidth: width, clientHeight: height } = Dom.container;
    render.canvas.width = width;
    render.canvas.height = height;
    render.options.width = width;
    render.options.height = height;
    Dom.waterCanvas.width = width;
    Dom.waterCanvas.height = height;
}