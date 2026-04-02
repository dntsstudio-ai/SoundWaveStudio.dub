# 🎙️ Sound Wave Studio — Сайт студии

Сайт студии фандаба **Sound Wave Studio**: релизы, команда, DUB-in платформа.

---

## 📁 Структура проекта

```
/
├── index.html              ← Главная страница (только HTML-разметка)
├── favicon.png             ← Иконка сайта
├── .gitignore
│
├── css/
│   └── style.css           ← Все стили сайта
│
├── config/
│   └── config.js           ← 🔑 Ключи Firebase, EmailJS, настройки
│
└── js/
    ├── app.js              ← Точка входа, инициализация, маршрутизация
    ├── core.js             ← Утилиты: toast, модалы, навигация, роли
    ├── auth.js             ← Авторизация, профиль пользователя
    ├── releases.js         ← Релизы, эпизоды, лайки, политика конф.
    ├── comments.js         ← Комментарии к релизам
    ├── team.js             ← Команда студии, страницы участников
    ├── users.js            ← Профили, подписки, управление ролями
    ├── achievements.js     ← Достижения пользователей
    └── dubin.js            ← DUB-in: архив проектов, загрузка файлов
```

---

## 🚀 Деплой на GitHub Pages

1. Создайте репозиторий на GitHub
2. Загрузите все файлы:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/ВАШ_НИКИ/ВАШ_РЕПО.git
   git push -u origin main
   ```
3. В настройках репозитория → **Pages** → Source: `main` branch → `/ (root)`
4. Сайт будет доступен по адресу: `https://ВАШ_НИК.github.io/ВАШ_РЕПО/`

---

## 🔑 Настройка ключей

Откройте `config/config.js` и замените значения:

### Firebase
1. Перейдите в [Firebase Console](https://console.firebase.google.com/)
2. Ваш проект → Настройки → Общие → Веб-приложения
3. Скопируйте `firebaseConfig` в `FIREBASE_CONFIG`

### EmailJS
1. Зарегистрируйтесь на [emailjs.com](https://emailjs.com)
2. Создайте Service и Template
3. Замените `serviceId`, `templateSuggest`, `publicKey`

### Google Form
Замените `JOIN_FORM_URL` на ссылку вашей формы заявки.

---

## 🔒 Безопасность

Firebase API-ключи для веб-клиента **безопасно** хранить в открытом коде.
Настоящая защита — это **правила Firestore** (`firestore.rules`).

Пример правил (разместите в Firebase Console → Firestore → Rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Релизы — читают все, пишут только admin
    match /releases/{id} {
      allow read: if true;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Комментарии — читают все, пишут авторизованные
    match /releases/{id}/comments/{cid} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null
        && (resource.data.uid == request.auth.uid
          || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    // Пользователи — читают и пишут только сам пользователь или admin
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && (request.auth.uid == uid
          || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    // Команда — читают все, пишут admin
    match /team/{id} {
      allow read: if true;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // DUB-in — только dub и admin
    match /dubinProjects/{id} {
      allow read: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['dub', 'admin'];
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['dub', 'admin'];
    }

    // Предложения — создают все авторизованные, читают admin
    match /suggestions/{id} {
      allow create: if request.auth != null || true;
      allow read, update, delete: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

---

## 📦 Используемые технологии

| Технология | Версия | Назначение |
|---|---|---|
| Firebase JS SDK | 10.8.1 | Auth + Firestore |
| EmailJS | 4.x | Отправка писем |
| SortableJS | 1.15.0 | Drag & drop в команде |
| Font Awesome | 6.0.0 | Иконки |

---

© 2024–2026 Sound Wave Studio
