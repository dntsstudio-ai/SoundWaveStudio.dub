// ============================================================
//  config/config.js — Все ключи и настройки Sound Wave Studio
// ============================================================

export const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyD34TTNdG1V4SZmuQ1ULVdo3iBB3q-7pC8",
    authDomain:        "my-dub-site.firebaseapp.com",
    projectId:         "my-dub-site",
    storageBucket:     "my-dub-site.firebasestorage.app",
    messagingSenderId: "302896869866",
    appId:             "1:302896869866:web:a003a8f24d682cb3ac0293"
};

export const EMAILJS_CONFIG = {
    serviceId:       'service_sws',
    templateSuggest: 'template_suggest',
    publicKey:       'FExFPIAtSKcFcS2yy'
};

export const SOCIAL_LINKS = {
    vk:       'https://vk.ru/soundwavestudiosws',
    telegram: 'https://t.me/soundwavestudiosws',
    youtube:  'https://www.youtube.com/@SoundWaveDUB'
};

export const JOIN_FORM_URL        = 'https://forms.gle/YOUR_GOOGLE_FORM_ID';
export const PLACEHOLDER_IMG      = 'https://via.placeholder.com/300x400/141417/ff2e2e?text=SWS';
export const PLACEHOLDER_TEAM_IMG = 'https://api.dicebear.com/7.x/identicon/svg';

// Просмотр засчитывается после N минут на странице релиза
export const VIEW_COUNT_AFTER_MS = 10 * 60 * 1000; // 10 минут

// Базовые ачивки — выдаются автоматически
export const AUTO_ACHIEVEMENTS = [
    { id: 'first_view',     name: 'Первый просмотр',    desc: 'Посмотрел первый релиз',           img: '👁️',  trigger: 'views_1'    },
    { id: 'views_10',       name: 'Киноман',             desc: '10 просмотренных релизов',          img: '🎬',  trigger: 'views_10'   },
    { id: 'views_50',       name: 'Синефил',             desc: '50 просмотренных релизов',          img: '🏆',  trigger: 'views_50'   },
    { id: 'first_comment',  name: 'Голос',               desc: 'Оставил первый комментарий',        img: '💬',  trigger: 'comment_1'  },
    { id: 'first_like',     name: 'Меценат',             desc: 'Поставил первый лайк',              img: '❤️',  trigger: 'like_1'     },
    { id: 'first_favorite', name: 'Коллекционер',        desc: 'Добавил релиз в избранное',         img: '⭐',  trigger: 'favorite_1' },
    { id: 'subs_1',         name: 'Популярный',          desc: 'Получил первого подписчика',        img: '🌟',  trigger: 'subs_1'     },
    { id: 'suggest_1',      name: 'Инициатор',           desc: 'Предложил проект для озвучки',      img: '💡',  trigger: 'suggest_1'  },
    { id: 'profile_filled', name: 'Личность',            desc: 'Заполнил профиль полностью',        img: '🎭',  trigger: 'profile_ok' },
    { id: 'newcomer',       name: 'Новичок',             desc: 'Зарегистрировался на сайте',        img: '👋',  trigger: null         },
];
