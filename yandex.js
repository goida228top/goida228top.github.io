// @ts-nocheck

let ysdkInstance = null;
const INIT_TIMEOUT = 5000; // 5 секунд
let isStickyAdvVisible = false;

export async function initYandexSDK() {
    if (typeof YaGames === 'undefined') {
        console.warn('Yandex SDK script not loaded.');
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
        
        // Автоматически показываем стики-баннер после успешной инициализации
        showStickyAdv();

        return ysdkInstance;
    } catch (error) {
        console.error('Yandex SDK initialization failed:', error.message);
        return null;
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

    window.ysdk.adv.showFullscreenAdv({
        callbacks: {
            onClose: (wasShown) => {
                console.log(`Fullscreen ad closed. Was shown: ${wasShown}`);
                if (wasRunning) {
                    runner.enabled = true;
                }
                if (onCloseCallback) onCloseCallback();
            },
            onError: (error) => {
                console.error('Fullscreen ad error:', error);
                if (wasRunning) {
                    runner.enabled = true;
                }
                 if (onCloseCallback) onCloseCallback();
            },
        }
    });
}


export function showRewardedVideo(engineData, onRewarded) {
    if (!window.ysdk) {
        console.warn('Yandex SDK not available. Simulating successful ad reward for testing.');
        onRewarded(); 
        return;
    }

    hideStickyAdv(); // Скрываем баннер перед показом видео
    const { runner } = engineData;
    const wasRunning = runner.enabled;
    runner.enabled = false; 

    window.ysdk.adv.showRewardedVideo({
        callbacks: {
            onOpen: () => {
                console.log('Rewarded video ad opened.');
            },
            onRewarded: () => {
                console.log('User was rewarded!');
                onRewarded();
            },
            onClose: () => {
                console.log('Rewarded video ad closed.');
                if (wasRunning) {
                    runner.enabled = true;
                }
                showStickyAdv(); // Показываем баннер снова
            },
            onError: (error) => {
                console.error('Rewarded video error:', error);
                if (wasRunning) {
                    runner.enabled = true;
                }
                showStickyAdv(); // Показываем баннер снова
            },
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