
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
        'reward-title': 'Смотреть рекламу и получить дождь из объектов',
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
        'reward-button-text': 'Награда',
        'low-fps-title': 'Низкая производительность',
        'low-fps-message': 'Обнаружен низкий FPS. Большое количество воды может замедлять симуляцию. Что вы хотите сделать?',
        'delete-water-button': 'Удалить всю воду',
        'pause-button': 'Поставить на паузу',
        'do-nothing-button': 'Ничего не делать',
        'dont-ask-again-button': 'Больше не спрашивать'
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
        'reward-title': 'Watch an ad and get a rain of objects',
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
        'reward-button-text': 'Reward',
        'low-fps-title': 'Low Performance',
        'low-fps-message': 'Low FPS detected. A large amount of water can slow down the simulation. What would you like to do?',
        'delete-water-button': 'Delete All Water',
        'pause-button': 'Pause',
        'do-nothing-button': 'Do Nothing',
        'dont-ask-again-button': 'Don\'t ask again'
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
        'silgi-title': 'Silgi',
        'reward-title': 'Nesne yağmuru için reklam izle',
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
        'reward-button-text': 'Ödül',
        'low-fps-title': 'Düşük Performans',
        'low-fps-message': 'Düşük FPS algılandı. Çok miktarda su simülasyonu yavaşlatabilir. Ne yapmak istersiniz?',
        'delete-water-button': 'Tüm Suyu Sil',
        'pause-button': 'Duraklat',
        'do-nothing-button': 'Hiçbir Şey Yapma',
        'dont-ask-again-button': 'Tekrar sorma'
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

export function t(key) {
    return translations[currentLang]?.[key] || translations['en'][key] || `[${key}]`;
}
    