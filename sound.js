
// @ts-nocheck
// sound.js

// Создаем единственный AudioContext для всего приложения
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const sounds = new Map(); // Кэш для загруженных AudioBuffer

// NEW: Sound categories
const soundCategories = {
    'ui_click': 'ui',
    'reward': 'ui',
    'create_object': 'object',
    'collision_light': 'object',
    'collision_heavy': 'object',
    'water_pour': 'environment',
    'sand_pour': 'environment',
    'explosion_small': 'environment',
    'explosion_medium': 'environment',
    'explosion_large': 'environment',
};

// NEW: Muted state for each category
let mutedCategories = {
    ui: false,
    object: false,
    environment: false
};


// Master Gain Node для общего контроля громкости
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);


/**
 * Генерирует резервный звук, если основной не удалось загрузить.
 * @param {string} name - Имя звука для определения типа генерации.
 * @param {AudioContext} context - Аудио-контекст.
 * @returns {Promise<AudioBuffer>}
 */
async function generateFallbackSound(name, context) {
    const sampleRate = context.sampleRate;
    let duration = 0.1;
    let buffer = null;

    switch (name) {
        case 'ui_click':
            duration = 0.05;
            buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
            const dataClick = buffer.getChannelData(0);
            for (let i = 0; i < dataClick.length; i++) {
                const progress = i / dataClick.length;
                dataClick[i] = Math.sin(2 * Math.PI * 2000 * progress) * Math.exp(-progress * 20) * 0.5;
            }
            break;

        case 'create_object':
            duration = 0.1;
            buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
            const dataCreate = buffer.getChannelData(0);
            for (let i = 0; i < dataCreate.length; i++) {
                const progress = i / dataCreate.length;
                dataCreate[i] = Math.sin(2 * Math.PI * 800 * progress) * Math.exp(-progress * 15) * 0.5;
            }
            break;
        
        case 'explosion_small':
        case 'explosion_medium':
        case 'explosion_large':
            duration = name === 'explosion_small' ? 0.3 : (name === 'explosion_medium' ? 0.6 : 1.0);
            buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
            const dataExplosion = buffer.getChannelData(0);
            for (let i = 0; i < dataExplosion.length; i++) {
                const progress = i / dataExplosion.length;
                dataExplosion[i] = (Math.random() * 2 - 1) * Math.exp(-progress * 5); // Белый шум с затуханием
            }
            break;

        case 'water_pour':
        case 'sand_pour':
            duration = 0.2;
            buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
            const dataPour = buffer.getChannelData(0);
            let lastOut = 0.0;
            // Генерация розового шума
            for (let i = 0; i < dataPour.length; i++) {
                const white = Math.random() * 2 - 1;
                dataPour[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = dataPour[i];
                dataPour[i] *= 3.5; // Компенсация усиления
            }
            break;

        case 'collision_light':
        case 'collision_heavy':
            duration = name === 'collision_light' ? 0.2 : 0.4;
            const freq = name === 'collision_light' ? 1200 : 600;
            buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
            const dataCollision = buffer.getChannelData(0);
            for (let i = 0; i < dataCollision.length; i++) {
                const progress = i / dataCollision.length;
                const s1 = Math.sin(2 * Math.PI * freq * progress);
                const s2 = Math.sin(2 * Math.PI * freq * 1.5 * progress);
                dataCollision[i] = (s1 + s2) * 0.25 * Math.exp(-progress * 10);
            }
            break;

        case 'reward':
            duration = 0.4;
            buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
            const dataReward = buffer.getChannelData(0);
            const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
            const noteDuration = Math.floor(dataReward.length / 3);
            for (let i = 0; i < dataReward.length; i++) {
                const noteIndex = Math.floor(i / noteDuration);
                const progressInNote = (i % noteDuration) / noteDuration;
                if(noteIndex < freqs.length) {
                    dataReward[i] = Math.sin(2 * Math.PI * freqs[noteIndex] * progressInNote) * Math.exp(-progressInNote * 5) * 0.5;
                }
            }
            break;
        
        default:
            // Общий резервный звук
            duration = 0.1;
            buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
            const dataDefault = buffer.getChannelData(0);
            for (let i = 0; i < dataDefault.length; i++) {
                 const progress = i / dataDefault.length;
                 dataDefault[i] = Math.sin(2 * Math.PI * 440 * progress) * Math.exp(-progress * 10) * 0.5;
            }
            break;
    }

    return buffer;
}


export const SoundManager = {
    /**
     * Загружает все звуки из списка с резервным механизмом.
     * @param {Array<{name: string, url: string}>} soundList - Массив объектов со звуками.
     * @param {function} onSoundLoad - Колбэк, вызываемый после загрузки каждого звука.
     * @returns {Promise<void>}
     */
    async loadAllSounds(soundList, onSoundLoad = () => {}) {
        const loadPromises = soundList.map(async (soundInfo) => {
            if (sounds.has(soundInfo.name)) {
                onSoundLoad(soundInfo.name);
                return;
            }

            let audioBuffer = null;
            try {
                const response = await fetch(soundInfo.url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            } catch (error) {
                console.warn(`Failed to load sound from ${soundInfo.url}, generating fallback for "${soundInfo.name}". Error:`, error.message);
                // Генерируем резервный звук при ошибке
                audioBuffer = await generateFallbackSound(soundInfo.name, audioContext);
            }

            if (audioBuffer) {
                sounds.set(soundInfo.name, audioBuffer);
            }
            onSoundLoad(soundInfo.name);
        });
        await Promise.all(loadPromises);
        console.log('All sounds preloaded.');
    },

    /**
     * Воспроизводит звук.
     * @param {string} name - Имя звука (из soundList).
     * @param {object} [options] - Опции воспроизведения.
     * @param {number} [options.volume=1.0] - Громкость от 0.0 до 1.0.
     * @param {number} [options.pitch=1.0] - Скорость воспроизведения (1.0 = нормальная).
     */
    playSound(name, { volume = 1.0, pitch = 1.0 } = {}) {
        // Возобновляем AudioContext, если он был приостановлен браузером
        if (audioContext.state === 'suspended' && !audioContext._forceSuspended) {
            audioContext.resume();
        }

        // NEW: Check category mute status
        const category = soundCategories[name];
        if (category && mutedCategories[category]) {
            return; // Sound category is muted, do not play
        }


        const audioBuffer = sounds.get(name);
        if (!audioBuffer) {
            // console.warn(`Sound "${name}" not found.`);
            return;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Создаем GainNode для индивидуального контроля громкости этого звука
        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;
        
        source.playbackRate.value = pitch;

        source.connect(gainNode).connect(masterGain);
        source.start(0);
    },

    // NEW: Function to set mute status for a category and save it
    setCategoryMute(category, isMuted) {
        if (mutedCategories.hasOwnProperty(category)) {
            mutedCategories[category] = isMuted;
            try {
                const settings = JSON.parse(localStorage.getItem('soundSettings') || '{}');
                settings[category] = isMuted;
                localStorage.setItem('soundSettings', JSON.stringify(settings));
            } catch (e) {
                console.error("Failed to save sound settings to localStorage", e);
            }
        }
    },

    // NEW: Function to load settings from localStorage
    loadMuteSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('soundSettings') || '{}');
            for (const category in settings) {
                if (mutedCategories.hasOwnProperty(category)) {
                    mutedCategories[category] = settings[category];
                }
            }
        } catch (e) {
            console.error("Failed to load sound settings from localStorage", e);
        }
        return { ...mutedCategories }; // Return a copy
    },
    
    // NEW: Function to control master volume
    setMasterVolume(volume) {
        if (masterGain) {
            masterGain.gain.setValueAtTime(volume, audioContext.currentTime);
        }
    },
    
    // NEW: Global mute toggle for Ads and Window minimization
    toggleMuteAll(shouldMute) {
        if (shouldMute) {
            audioContext.suspend();
            audioContext._forceSuspended = true; // Флаг, чтобы playSound не включал его обратно сам
        } else {
            audioContext._forceSuspended = false;
            audioContext.resume();
        }
    }
};

// Проверяем, был ли AudioContext создан успешно.
if (!audioContext) {
    console.error("Web Audio API is not supported in this browser.");
    // "Заглушки" для всех функций, чтобы игра не вылетала
    SoundManager.playSound = () => {};
    SoundManager.setCategoryMute = () => {};
    SoundManager.setMasterVolume = () => {};
    SoundManager.toggleMuteAll = () => {};
    SoundManager.loadMuteSettings = () => ({ ui: false, object: false, environment: false });
    SoundManager.loadAllSounds = async () => {};
}
