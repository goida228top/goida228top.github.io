import Matter from 'matter-js';
import * as Dom from './dom';

const { Mouse } = Matter;

let viewOffset = { x: 0, y: 0 };
let scale = 1;
const minScale = 0.1;
const maxScale = 5.0;
let isPanning = false;
let panStart = { x: 0, y: 0 };

export function initializeCamera(render) {
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
    
    // Привязываем мышь Matter.js к рендереру
    const mouse = Mouse.create(render.canvas);

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

    function updateView() {
        // Обновляем видимую область рендера
        render.bounds.min.x = viewOffset.x;
        render.bounds.min.y = viewOffset.y;
        render.bounds.max.x = viewOffset.x + render.canvas.width * scale;
        render.bounds.max.y = viewOffset.y + render.canvas.height * scale;
        
        // Синхронизируем мышь с новой видимой областью
        Mouse.setOffset(mouse, render.bounds.min);
        Mouse.setScale(mouse, { x: scale, y: scale });
        
        // Синхронизируем визуальную землю
        const groundScreenY = (Number(localStorage.getItem('ground_y')) - viewOffset.y) / scale;
        Dom.groundDiv.style.transform = `translateY(${groundScreenY}px)`;
    }
    
    // Преобразуем экранные координаты в мировые с учетом масштаба
    function getMousePos(event) {
        const rect = render.canvas.getBoundingClientRect();
        return { 
            x: viewOffset.x + (event.clientX - rect.left) * scale,
            y: viewOffset.y + (event.clientY - rect.top) * scale
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
