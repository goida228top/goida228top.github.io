
// @ts-nocheck
import { setLang } from './lang.js';
import { YANDEX_INIT_TIMEOUT } from './game_config.js';
import { SoundManager } from './sound.js'; // Import SoundManager for muting

let ysdkInstance = null;
let player = null; // Переменная для хранения объекта игрока
const INIT_TIMEOUT = YANDEX_INIT_TIMEOUT; 
let isStickyAdvVisible = false;

export async function initYandexSDK() {
    if (typeof YaGames === 'undefined') {
        console.warn('Yandex SDK script not loaded.');
        setLang('ru'); // Fallback to russian if SDK is not available
        return null;
    }
    try {
        console.log('Initializing Yandex SDK...');
        const initPromise = YaGames.init();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Yandex SDK init timeout')), INIT_TIMEOUT)
        );

        ysdkInstance = await Promise.race([initPromise, timeoutPromise]);
        
        window.ysdk = ysdkInstance; 
        console.log('Yandex SDK initialized.');
        
        // Получаем объект игрока после успешной инициализации
        // ВАЖНО: scopes: false предотвращает появление диалога авторизации (требование 1.2.1)
        try {
            player = await ysdkInstance.getPlayer({ scopes: false });
            console.log('Yandex Player object received (Guest/Authorized).');
        } catch (e) {
            console.error('Could not get Yandex Player object:', e);
            player = null; // Убедимся, что player равен null в случае ошибки
        }

        // Устанавливаем язык на основе SDK
        if (ysdkInstance.environment?.i18n?.lang) {
            setLang(ysdkInstance.environment.i18n.lang);
        }

        // Автоматически показываем стики-баннер после успешной инициализации
        showStickyAdv();

        return ysdkInstance;
    } catch (error) {
        console.error('Yandex SDK initialization failed:', error.message);
        setLang('ru'); // Fallback to russian on error
        return null;
    }
}

export function gameReady() {
    if (ysdkInstance && ysdkInstance.features?.LoadingAPI?.ready) {
        console.log('Calling Game Ready API');
        ysdkInstance.features.LoadingAPI.ready();
    } else {
        console.log('Game Ready API not available or Yandex SDK not initialized.');
    }
}

// Новая функция для сохранения данных в облако
export async function savePlayer_Data(data) {
    if (!player) {
        console.warn('Yandex Player not available, cannot save to cloud.');
        return;
    }
    try {
        // Если игрок не авторизован (Guest), setData может предложить авторизацию или сохранить локально
        // Для соответствия требованиям, мы просто пытаемся сохранить. Если вылезет промпт - это действие пользователя (нажатие Save).
        await player.setData(data, true); // true для немедленной отправки
        console.log('Player data saved to cloud:', data);
    } catch (e) {
        console.error('Failed to save data to Yandex Cloud:', e);
    }
}

// Новая функция для загрузки данных из облака
export async function loadPlayer_Data() {
    if (!player) {
        console.warn('Yandex Player not available, cannot load from cloud.');
        return null;
    }
    try {
        const data = await player.getData();
        console.log('Player data loaded from cloud:', data);
        return data || {}; // Возвращаем пустой объект, если данных нет
    } catch (e) {
        console.error('Failed to load data from Yandex Cloud:', e);
        return null; // Возвращаем null при ошибке для запуска отката
    }
}


export function showFullscreenAdv(engineData, onCloseCallback) {
    if (!window.ysdk) {
        console.warn('Yandex SDK not available. Simulating fullscreen ad close for testing.');
        if (onCloseCallback) onCloseCallback();
        return;
    }

    const { runner } = engineData;
    const wasRunning = runner.enabled;
    runner.enabled = false; 
    
    // Mute sound (Requirement 4.7)
    SoundManager.toggleMuteAll(true);

    window.ysdk.adv.showFullscreenAdv({
        callbacks: {
            onClose: (wasShown) => {
                console.log(`Fullscreen ad closed. Was shown: ${wasShown}`);
                if (wasRunning) {
                    runner.enabled = true;
                }
                // Unmute sound
                SoundManager.toggleMuteAll(false);
                
                if (onCloseCallback) onCloseCallback();
            },
            onError: (error) => {
                console.error('Fullscreen ad error:', error);
                if (wasRunning) {
                    runner.enabled = true;
                }
                // Unmute sound on error too
                SoundManager.toggleMuteAll(false);
                
                if (onCloseCallback) onCloseCallback();
            },
        }
    });
}


export function showRewardedVideo(engineData, onRewarded, onError) {
    if (!window.ysdk) {
        console.warn('Yandex SDK not available. Simulating successful ad reward for testing.');
        onRewarded();
        return;
    }

    hideStickyAdv();
    const { runner } = engineData;
    const wasRunning = runner.enabled;
    runner.enabled = false;
    
    // Mute sound (Requirement 4.7)
    SoundManager.toggleMuteAll(true);
    
    let isRewarded = false;
    let errorHandled = false;

    const cleanup = () => {
        // Restore sound and game state
        if (wasRunning) runner.enabled = true;
        SoundManager.toggleMuteAll(false);
        showStickyAdv();
    };

    const handleError = (error) => {
        if (!errorHandled) {
            errorHandled = true;
            if (error) console.error('Rewarded video error:', error);
            if (onError) onError();
            cleanup();
        }
    };

    window.ysdk.adv.showRewardedVideo({
        callbacks: {
            onOpen: () => {
                console.log('Rewarded video ad opened.');
            },
            onRewarded: () => {
                console.log('User was rewarded!');
                isRewarded = true;
                onRewarded();
            },
            onClose: () => {
                console.log('Rewarded video ad closed.');
                if (!isRewarded) {
                    handleError(); // Closed without reward
                } else {
                    // Ad was successful, just restore state
                    cleanup();
                }
            },
            onError: handleError,
        },
    });
}


function showStickyAdv() {
    if (window.ysdk && !isStickyAdvVisible) {
        try {
            window.ysdk.adv.showStickyAdv({
                bottom: true
            });
            isStickyAdvVisible = true;
            console.log('Sticky ad shown.');
        } catch (e) {
            console.error('Sticky ad error:', e);
        }
    }
}

function hideStickyAdv() {
    if (window.ysdk && isStickyAdvVisible) {
        try {
            window.ysdk.adv.hideStickyAdv();
            isStickyAdvVisible = false;
            console.log('Sticky ad hidden.');
        } catch (e) {
            console.error('Sticky ad hide error:', e);
        }
    }
}
