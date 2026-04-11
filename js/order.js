// ============================================================
//  js/order.js — Страница "Заказать озвучку"
//  Бесплатные предложения → Firestore
//  Платные заказы → Telegram бот (ссылка с данными)
// ============================================================

import {
    collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast } from './core.js';
import { checkAndAwardAch } from './achievements.js';
import { EMAILJS_CONFIG } from '../config/config.js';

// ── Telegram Bot username (замените на свой) ──
const TG_BOT_USERNAME = 'SoundWaveStudioBot';   // @SoundWaveStudioBot
const TG_CHANNEL      = 'https://t.me/soundwavestudiosws';
const TG_VOICE_RECRUIT= 'https://t.me/soundwavestudiosws'; // Канал набора

// ── Переключение типа заказа ──
window.selectOrderType = (type) => {
    document.getElementById('order-type-grid').style.display  = 'none';
    if (type === 'free') {
        document.getElementById('order-free-form').style.display = 'block';
        document.getElementById('order-paid-form').style.display = 'none';
    } else {
        document.getElementById('order-free-form').style.display = 'none';
        document.getElementById('order-paid-form').style.display = 'block';
        calcOrderPrice();
    }
};

window.backToOrderType = () => {
    document.getElementById('order-type-grid').style.display  = 'grid';
    document.getElementById('order-free-form').style.display  = 'none';
    document.getElementById('order-paid-form').style.display  = 'none';
};

// ── Расчёт ориентировочной цены ──
window.calcOrderPrice = () => {
    const type       = document.getElementById('ord-paid-type')?.value || '';
    const episodes   = parseInt(document.getElementById('ord-paid-episodes')?.value) || 1;
    const duration   = parseInt(document.getElementById('ord-paid-duration')?.value) || 24;
    const popularity = document.getElementById('ord-paid-popularity')?.value || 'unknown';
    const quality    = document.getElementById('ord-paid-quality')?.value || 'medium';
    const year       = parseInt(document.getElementById('ord-paid-year')?.value) || new Date().getFullYear();

    if (!type) {
        const el = document.getElementById('order-price-value');
        if (el) el.textContent = '— ₽';
        return;
    }

    // Базовая цена за минуту озвучки
    let pricePerMin = 300;

    // Тип контента
    const typeMultiplier = { Аниме: 1.1, Сериал: 1.0, Фильм: 1.2, Мультфильм: 0.9, Другое: 1.0 };
    pricePerMin *= (typeMultiplier[type] || 1.0);

    // Качество
    const qualityMultiplier = { low: 0.85, medium: 1.0, high: 1.15, ultra: 1.3 };
    pricePerMin *= (qualityMultiplier[quality] || 1.0);

    // Популярность (более популярный = выше спрос)
    const popMultiplier = { unknown: 0.9, medium: 1.0, popular: 1.15, top: 1.35 };
    pricePerMin *= (popMultiplier[popularity] || 1.0);

    // Возраст проекта (старые сложнее найти материалы)
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    if (age > 20) pricePerMin *= 1.2;
    else if (age > 10) pricePerMin *= 1.1;
    else if (age < 2) pricePerMin *= 1.05; // свежий — часто сложнее

    const totalMinutes = episodes * duration;
    const base  = Math.round(totalMinutes * pricePerMin);
    // Округляем до 500
    const price = Math.round(base / 500) * 500;
    const min   = Math.max(1000, Math.round(price * 0.85 / 500) * 500);
    const max   = Math.round(price * 1.25 / 500) * 500;

    const el = document.getElementById('order-price-value');
    if (el) el.textContent = `${min.toLocaleString('ru')} – ${max.toLocaleString('ru')} ₽`;
};

// ── Отправить бесплатное предложение ──
window.submitFreeOrder = async (db, auth, getState) => {
    const title  = document.getElementById('ord-free-title')?.value.trim();
    const type   = document.getElementById('ord-free-type')?.value;
    const link   = document.getElementById('ord-free-link')?.value.trim();
    const reason = document.getElementById('ord-free-reason')?.value.trim();
    if (!title || !type || !reason) return showToast('Заполните обязательные поля!', 'error');

    const { userData } = typeof getState === 'function' ? getState() : { userData: null };
    const senderName  = userData?.nickname || document.getElementById('ord-free-name')?.value.trim() || 'Аноним';
    const senderEmail = userData?.email    || document.getElementById('ord-free-email')?.value.trim() || '';

    await addDoc(collection(db, 'suggestions'), {
        title, type, link, reason, senderName, senderEmail,
        uid: auth?.currentUser?.uid || null,
        date: Date.now(), status: 'new'
    });

    // EmailJS уведомление
    try {
        if (window.emailjs) {
            await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateSuggest, {
                to_email:   'soundwavestudiosws@gmail.com',
                from_name:  senderName,
                from_email: senderEmail || 'нет',
                title, media_type: type, link: link || 'не указана', reason,
                date: new Date().toLocaleString('ru')
            }, EMAILJS_CONFIG.publicKey);
        }
    } catch(e) { console.warn('EmailJS:', e); }

    showToast('Предложение отправлено! Спасибо 🎉', 'success');
    // Ачивка
    if (userData && auth) await checkAndAwardAch(db, auth, userData, 'suggest_1');

    // Сброс
    ['ord-free-title','ord-free-link','ord-free-reason','ord-free-name','ord-free-email'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    backToOrderType();
};

// ── Отправить платный заказ → Telegram ──
window.submitPaidOrder = () => {
    const title      = document.getElementById('ord-paid-title')?.value.trim();
    const type       = document.getElementById('ord-paid-type')?.value;
    const genre      = document.getElementById('ord-paid-genre')?.value.trim();
    const year       = document.getElementById('ord-paid-year')?.value;
    const episodes   = document.getElementById('ord-paid-episodes')?.value;
    const duration   = document.getElementById('ord-paid-duration')?.value;
    const popularity = document.getElementById('ord-paid-popularity')?.value;
    const quality    = document.getElementById('ord-paid-quality')?.value;
    const link       = document.getElementById('ord-paid-link')?.value.trim();
    const notes      = document.getElementById('ord-paid-notes')?.value.trim();
    const priceEl    = document.getElementById('order-price-value');

    if (!title || !type) return showToast('Укажите название и тип контента!', 'error');

    const popularityLabel = { unknown: 'Малоизвестный', medium: 'Средняя аудитория', popular: 'Популярный', top: 'Топ / Легенда' };
    const qualityLabel    = { low: 'Низкое (SD)', medium: 'Среднее (HD)', high: 'Высокое (FHD)', ultra: 'Ультра (4K)' };

    // Формируем сообщение для бота
    const msg = [
        '🎙 *Заказ озвучки* — Sound Wave Studio',
        '',
        `📌 *Название:* ${title}`,
        `🎭 *Тип:* ${type}`,
        genre      ? `🎨 *Жанр:* ${genre}`                         : '',
        year       ? `📅 *Год:* ${year}`                           : '',
        episodes   ? `📺 *Серий / частей:* ${episodes}`            : '',
        duration   ? `⏱ *Длительность:* ${duration} мин/эп`       : '',
        `⭐ *Популярность:* ${popularityLabel[popularity] || popularity}`,
        `🎬 *Качество:* ${qualityLabel[quality] || quality}`,
        link       ? `🔗 *Ссылка:* ${link}`                        : '',
        notes      ? `📝 *Пожелания:* ${notes}`                    : '',
        '',
        priceEl?.textContent ? `💰 *Ориент. стоимость:* ${priceEl.textContent}` : '',
        '',
        '⬇️ Выберите способ оплаты и продолжите оформление заказа ниже.'
    ].filter(Boolean).join('
');

    // Ссылка на бота с предзаполненным текстом
    const encoded = encodeURIComponent(msg);
    const tgLink  = `https://t.me/${TG_BOT_USERNAME}?start=order_${Date.now()}&text=${encoded}`;

    // Открываем Telegram
    window.open(tgLink, '_blank');
    showToast('Открываем Telegram-бота...', 'info');
};

// ── Bind ──
export function bindOrder(db, auth, getState) {
    // Перепривязываем submitFreeOrder с контекстом
    window.submitFreeOrder = () => submitFreeOrder(db, auth, getState);

    // Навигация на страницу заказа добавляет n-order в navMap
    const navMap = { order: 'n-order' };
    // core.js navigate не знает про order — расширяем через window
    const origNavigate = window.navigate;
    window.navigate = (page, pushState = true) => {
        origNavigate(page, pushState);
        // Сбросить форму при уходе
        if (page !== 'order') {
            backToOrderType();
        }
    };
}