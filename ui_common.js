


import * as Dom from './dom.js';
import { t } from './lang.js';

export const keyState = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

export let playerData = {
    coins: 0,
    rewardProgress: {},
    unlockedSlots: [false, false, false, false, false],
    unlockedTools: [] // NEW: List of purchased tools
};

// Флаг, отслеживающий, началась ли игра (пройдено ли главное меню)
export let isGameStarted = false;

export function setGameStarted(value) {
    isGameStarted = value;
}

export function setPlayerData(data) {
    playerData = data;
}

// Вспомогательная функция для надежной обработки кликов на мобильных
export function addTapListener(element, callback) {
    if (!element) return;
    
    // Используем onclick как основной метод для ПК и надежности
    element.onclick = (e) => {
        callback(e);
    };

    // Дополнительная страховка для мобильных
    element.addEventListener('touchend', (e) => {
        // Если событие можно отменить (значит, это не скролл и т.д.)
        if (e.cancelable) {
            e.preventDefault(); // Предотвращаем генерацию click, чтобы не было дубля
            e.stopPropagation(); // ВАЖНО: Останавливаем всплытие, чтобы игра не перехватила событие
            callback(e);
        }
    }, { passive: false }); 
}

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    Dom.toastContainer.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            if(toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);
    }, 3000);
}

let currentConfirmHandler = null;
let currentCancelHandler = null;

export function showConfirm(title, message, onConfirm) {
    Dom.confirmModalTitle.textContent = title;
    Dom.confirmModalMessage.textContent = message;
    Dom.confirmModalOverlay.style.display = 'flex';
    
    // Удаляем старые слушатели
    if (currentConfirmHandler) {
        Dom.confirmModalConfirmBtn.onclick = null;
    }
    if (currentCancelHandler) {
        Dom.confirmModalCancelBtn.onclick = null;
    }
    
    // Используем addTapListener для новых
    addTapListener(Dom.confirmModalConfirmBtn, () => {
        Dom.confirmModalOverlay.style.display = 'none';
        onConfirm();
    });
    
    addTapListener(Dom.confirmModalCancelBtn, () => {
        Dom.confirmModalOverlay.style.display = 'none';
    });
}

export function togglePanel(panel, stateObj, stateKey) {
    const isOpen = panel.style.display === 'flex' || panel.style.display === 'block';
    const displayStyle = (panel.id === 'about-panel' || panel.id === 'new-settings-panel') ? 'flex' : 'block';
    
    panel.style.display = isOpen ? 'none' : displayStyle;
     if(panel.id === 'reward-menu-panel' || panel.id === 'save-load-panel') {
        panel.style.display = isOpen ? 'none' : 'flex';
    }

    if (stateObj && stateKey) {
        stateObj[stateKey] = !isOpen;
    }
}