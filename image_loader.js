// @ts-nocheck
// image_loader.js

const imageCache = new Map();

export const ImageLoader = {
    /**
     * Предварительно загружает массив изображений.
     * @param {string[]} urls - Массив URL-адресов изображений для загрузки.
     * @param {function} onImageLoad - Колбэк, вызываемый после загрузки каждого изображения.
     * @returns {Promise<void>} - Промис, который разрешается, когда все изображения загружены.
     */
    async preloadImages(urls, onImageLoad = () => {}) {
        const loadPromises = urls.map(url => {
            return new Promise((resolve) => {
                if (imageCache.has(url)) {
                    onImageLoad(url);
                    return resolve(imageCache.get(url));
                }

                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    imageCache.set(url, img);
                    onImageLoad(url);
                    resolve(img);
                };
                img.onerror = (e) => {
                    console.error(`Failed to load image from URL: ${url}`, e);
                    imageCache.set(url, null); // Кэшируем null, чтобы не пытаться загрузить снова
                    onImageLoad(url);
                    resolve(null);
                };
                img.src = url;
            });
        });
        await Promise.all(loadPromises);
        console.log('All images preloaded.');
    },

    /**
     * Возвращает загруженное изображение из кэша.
     * @param {string} url - URL изображения.
     * @returns {HTMLImageElement | null} - Объект Image или null, если изображение не было загружено или произошла ошибка.
     */
    getImage(url) {
        if (!imageCache.has(url)) {
            console.warn(`Image "${url}" was requested but not preloaded or failed to load.`);
            // Можно запустить асинхронную загрузку здесь, но лучше всего предварительно загрузить все
            // или возвращать заглушку
            return null; 
        }
        return imageCache.get(url);
    }
};
