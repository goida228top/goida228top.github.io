

const translations = {
    ru: {
        'app-title': 'Физическая песочница',
        'move-title': 'Переместить (точно)',
        'finger-title': 'Палец (физика)',
        'box-title': 'Коробка',
        'polygon-title': 'Полигон',
        'brush-title': 'Кисть',
        'tnt-small-title': 'Малый ТНТ',
        'tnt-medium-title': 'Средний ТНТ',
        'tnt-large-title': 'Мощный ТНТ',
        'water-title': 'Вода',
        'eraser-title': 'Ластик',
        'settings-title': 'Настройки',
        'play-title': 'Воспроизвести',
        'pause-title': 'Пауза',
        'gravity-label': 'Гравитация:',
        'liquid-effect-label': 'Эффект жидкости:',
        'show-hitboxes-label': 'Показывать хитбоксы:',
        'density-setting-label': 'Плотность объектов:',
        'tnt-small-power-label': 'Сила малого ТНТ:',
        'tnt-medium-power-label': 'Сила среднего ТНТ:',
        'tnt-large-power-label': 'Сила мощного ТНТ:',
        'color-label': 'Цвет:',
        'friction-label': 'Трение:',
        'restitution-label': 'Упругость:',
        'density-label': 'Плотность:',
        'static-label': 'Неподвижный:',
        'delete-button': 'Удалить',
        'brush-size-label': 'Толщина:',
        'low-fps-title': 'Низкая производительность',
        'low-fps-message': 'Обнаружен низкий FPS. Большое количество воды может замедлять симуляцию. Что вы хотите сделать?',
        'delete-water-button': 'Удалить всю воду',
        'pause-button': 'Поставить на паузу',
        'do-nothing-button': 'Ничего не делать',
        'dont-ask-again-button': 'Больше не спрашивать',
        'coins-label': 'Резонансы',
        'reward-menu-title': 'Получить Резонансы',
        'reward-claimed': 'Получено!',
        'claim-reward': 'Получить!',
        'back-button': 'Назад',
        'watching-ad-countdown': 'Смотрим рекламу: {time} сек',
        'ad-failed-retry': 'Реклама не загрузилась, повторить?'
    },
    en: {
        'app-title': 'Physics Sandbox',
        'move-title': 'Move (precise)',
        'finger-title': 'Finger (physics)',
        'box-title': 'Box',
        'polygon-title': 'Polygon',
        'brush-title': 'Brush',
        'tnt-small-title': 'Small TNT',
        'tnt-medium-title': 'Medium TNT',
        'tnt-large-title': 'Large TNT',
        'water-title': 'Water',
        'eraser-title': 'Eraser',
        'settings-title': 'Settings',
        'play-title': 'Play',
        'pause-title': 'Pause',
        'gravity-label': 'Gravity:',
        'liquid-effect-label': 'Liquid effect:',
        'show-hitboxes-label': 'Show hitboxes:',
        'density-setting-label': 'Object Density:',
        'tnt-small-power-label': 'Small TNT Power:',
        'tnt-medium-power-label': 'Medium TNT Power:',
        'tnt-large-power-label': 'Large TNT Power:',
        'color-label': 'Color:',
        'friction-label': 'Friction:',
        'restitution-label': 'Restitution:',
        'density-label': 'Density:',
        'static-label': 'Static:',
        'delete-button': 'Delete',
        'brush-size-label': 'Thickness:',
        'low-fps-title': 'Low Performance',
        'low-fps-message': 'Low FPS detected. A large amount of water can slow down the simulation. What would you like to do?',
        'delete-water-button': 'Delete All Water',
        'pause-button': 'Pause',
        'do-nothing-button': 'Do Nothing',
        'dont-ask-again-button': 'Don\'t ask again',
        'coins-label': 'Resonances',
        'reward-menu-title': 'Get Resonances',
        'reward-claimed': 'Claimed!',
        'claim-reward': 'Claim!',
        'back-button': 'Back',
        'watching-ad-countdown': 'Watching ad: {time} sec',
        'ad-failed-retry': 'Ad failed, retry?'
    },
    tr: {
        'app-title': 'Fizik Sandbox',
        'move-title': 'Taşı (hassas)',
        'finger-title': 'Parmak (fizik)',
        'box-title': 'Kutu',
        'polygon-title': 'Çokgen',
        'brush-title': 'Fırça',
        'tnt-small-title': 'Küçük TNT',
        'tnt-medium-title': 'Orta TNT',
        'tnt-large-title': 'Büyük TNT',
        'water-title': 'Su',
        'eraser-title': 'Silgi',
        'settings-title': 'Ayarlar',
        'play-title': 'Oynat',
        'pause-title': 'Duraklat',
        'gravity-label': 'Yerçekimi:',
        'liquid-effect-label': 'Sıvı efekti:',
        'show-hitboxes-label': 'Sınırları göster:',
        'density-setting-label': 'Nesne Yoğunluğu:',
        'tnt-small-power-label': 'Küçük TNT Gücü:',
        'tnt-medium-power-label': 'Orta TNT Gücü:',
        'tnt-large-power-label': 'Büyük TNT Gücü:',
        'color-label': 'Renk:',
        'friction-label': 'Sürtünme:',
        'restitution-label': 'Esneklik:',
        'density-label': 'Yoğunluk:',
        'static-label': 'Sabit:',
        'delete-button': 'Sil',
        'brush-size-label': 'Kalınlık:',
        'low-fps-title': 'Düşük Performans',
        'low-fps-message': 'Düşük FPS algılandı. Çok miktarda su simülasyonu yavaşlatabilir. Ne yapmak istersiniz?',
        'delete-water-button': 'Tüm Suyu Sil',
        'pause-button': 'Duraklat',
        'do-nothing-button': 'Hiçbir Şey Yapma',
        'dont-ask-again-button': 'Tekrar sorma',
        'coins-label': 'Rezonanslar',
        'reward-menu-title': 'Rezonansları Al',
        'reward-claimed': 'Alındı!',
        'claim-reward': 'Al!',
        'back-button': 'Geri',
        'watching-ad-countdown': 'Reklam izleniyor: {time} sn',
        'ad-failed-retry': 'Reklam yüklenemedi, tekrar dene?'
    }
};

let currentLang = 'ru'; // default

export function setLang(lang) {
    if (translations[lang]) {
        currentLang = lang;
    } else {
        currentLang = 'en'; // fallback to English
    }
    console.log(`Language set to: ${currentLang}`);
}

export function t(key, params = {}) {
    let translation = translations[currentLang]?.[key] || translations['en'][key] || `[${key}]`;
    for (const p in params) {
        translation = translation.replace(`{${p}}`, params[p]);
    }
    return translation;
}