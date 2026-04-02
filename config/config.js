// ============================================================
//  config/config.js — Все ключи и настройки Sound Wave Studio
//  ⚠️  ВАЖНО: Не публикуйте этот файл в публичный репозиторий!
//             Для защиты ключей Firebase используйте правила
//             Firestore (firestore.rules) — они ограничивают
//             доступ на уровне сервера, даже если ключ виден.
//             EmailJS Public Key — безопасен для фронтенда.
// ============================================================

export const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyD34TTNdG1V4SZmuQ1ULVdo3iBB3q-7pC8",
    authDomain:        "my-dub-site.firebaseapp.com",
    projectId:         "my-dub-site",
    storageBucket:     "my-dub-site.firebasestorage.app",
    messagingSenderId: "302896869866",
    appId:             "1:302896869866:web:a003a8f24d682cb3ac0293"
};

// EmailJS — настройки для отправки писем на soundwavestudiosws@gmail.com
// Зарегистрируйтесь на https://emailjs.com и замените значения своими
export const EMAILJS_CONFIG = {
    serviceId:          'service_sws',
    templateSuggest:    'template_suggest',
    publicKey:          'FExFPIAtSKcFcS2yy'
};

// Ссылки на соцсети студии
export const SOCIAL_LINKS = {
    vk:       'https://vk.ru/soundwavestudiosws',
    telegram: 'https://t.me/soundwavestudiosws',
    youtube:  'https://www.youtube.com/@SoundWaveDUB'
};

// Ссылка на Google Form для заявки на участие
export const JOIN_FORM_URL = 'https://forms.gle/YOUR_GOOGLE_FORM_ID';

// Заглушка для сломанных постеров
export const PLACEHOLDER_IMG = 'https://via.placeholder.com/300x400/141417/ff2e2e?text=SWS';
export const PLACEHOLDER_TEAM_IMG = 'https://api.dicebear.com/7.x/identicon/svg';
