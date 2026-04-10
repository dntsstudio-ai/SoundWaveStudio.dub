// ============================================================
//  js/releases.js — Релизы, плеер IVI, избранное, просмотренное
// ============================================================

import {
    collection, getDocs, getDoc, doc, addDoc, setDoc,
    updateDoc, deleteDoc, query, orderBy, increment, where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast, closeModals, navigate } from './core.js';
import { PLACEHOLDER_IMG, VIEW_COUNT_AFTER_MS } from '../config/config.js';
import { loadComments } from './comments.js';
import { checkAndAwardAch } from './achievements.js';

export let allRel  = [];
export let curProj = null;

let viewTimer      = null;
let playerSettings = { autoSkip: false, autoNext: false };
let currentEpIdx   = 0;
let introTimers    = [];  // все таймеры заставок — отменяем при смене серии

// ── Загрузка релизов ──
export async function loadReleases(db, isAdmin) {
    const snap = await getDocs(query(collection(db,'releases'), orderBy('timestamp','desc')));
    allRel = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGrid(isAdmin);
}

export function renderGrid(isAdmin) {
    let res = [...allRel];
    const q = (document.getElementById('main-search')?.value || '').toLowerCase();
    const g = document.getElementById('filter-genre')?.value || 'all';
    const s = document.getElementById('filter-sort')?.value  || 'new';
    if (q) res = res.filter(r => r.title?.toLowerCase().includes(q));
    if (g !== 'all') res = res.filter(r => r.genre === g);
    if (s === 'pop')    res.sort((a,b) => (b.views||0)-(a.views||0));
    else if (s === 'random') res.sort(() => 0.5-Math.random());
    else res.sort((a,b) => (b.timestamp||0)-(a.timestamp||0));

    document.getElementById('main-grid').innerHTML = res.map(r => `
        <div class="card" onclick="openView('${r.id}')">
            ${isAdmin ? `<div class="adm-tools">
                <button class="btn-sm" style="background:#3897f0;" onclick="event.stopPropagation();openRelModal('${r.id}')">Ред</button>
                <button class="btn-sm" style="background:#ef4444;" onclick="event.stopPropagation();deleteRel('${r.id}')">Удал</button>
            </div>` : ''}
            <img src="${esc(r.img)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">
            <div class="card-info">
                <div><span class="tag">${esc(r.genre)}</span><span class="year-tag">${esc(r.year)}</span></div>
                <div class="card-title">${esc(r.title)}</div>
                <div style="font-size:10px;color:var(--text-dim);margin-top:5px;"><i class="fas fa-eye"></i> ${r.views||0}</div>
            </div>
        </div>`).join('');
}

// ── Открытие страницы релиза ──
export async function openViewRelease(db, auth, id, userData, isAdmin) {
    clearTimeout(viewTimer);
    introTimers.forEach(t => clearTimeout(t));
    introTimers = [];

    const snap = await getDoc(doc(db,'releases',id));
    if (!snap.exists()) return showToast('Релиз не найден','error');
    curProj = { id, ...snap.data() };
    const idx = allRel.findIndex(x => x.id === id);
    if (idx >= 0) allRel[idx] = curProj;
    navigate('view');

    let watchedEpIdx = 0;
    if (userData) {
        try {
            const wSnap = await getDoc(doc(db,`users/${auth.currentUser.uid}/watched`,id));
            if (wSnap.exists() && wSnap.data().lastEpIdx !== undefined)
                watchedEpIdx = wSnap.data().lastEpIdx;
        } catch(e) {}
    }

    if (userData) {
        try {
            const viewedSnap = await getDoc(doc(db,`users/${auth.currentUser.uid}/viewed`,id));
            if (!viewedSnap.exists()) {
                viewTimer = setTimeout(async () => {
                    await updateDoc(doc(db,'releases',id), { views: increment(1) });
                    await setDoc(doc(db,`users/${auth.currentUser.uid}/viewed`,id),
                        { at: Date.now(), title: curProj.title, img: curProj.img });
                    await updateDoc(doc(db,'users',auth.currentUser.uid), { views: increment(1) });
                    curProj.views = (curProj.views||0)+1;
                    userData.views = (userData.views||0)+1;
                    await checkAndAwardAch(db, auth, userData, 'views_1');
                    if (userData.views >= 10) await checkAndAwardAch(db, auth, userData, 'views_10');
                    if (userData.views >= 50) await checkAndAwardAch(db, auth, userData, 'views_50');
                }, VIEW_COUNT_AFTER_MS);
            }
        } catch(e) {}
    }

    renderViewPage(db, auth, userData, isAdmin, watchedEpIdx);
}

// ══════════════════════════════════════════════════════════
//  ТРЕЙЛЕР: только YouTube embed — Drive блокирует iframe
// ══════════════════════════════════════════════════════════

function getYtVideoId(url) {
    if (!url) return '';
    try {
        if (url.includes('youtube.com/watch'))  return new URL(url).searchParams.get('v') || '';
        if (url.includes('youtu.be/'))          return url.split('youtu.be/')[1]?.split('?')[0] || '';
        if (url.includes('youtube.com/embed/')) return url.split('youtube.com/embed/')[1]?.split('?')[0] || '';
    } catch(e) {}
    return '';
}

function buildTrailerHTML(trailer) {
    if (!trailer?.url) return '';
    const ytId = getYtVideoId(trailer.url);

    if (ytId) {
        const src = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&modestbranding=1&rel=0`;
        return `
        <div class="trailer-box" id="trailer-box">
            <iframe id="trailer-iframe"
                src="${src}"
                allow="autoplay; picture-in-picture"
                allowfullscreen
                frameborder="0"></iframe>
            <div class="trailer-overlay" id="trailer-overlay" onclick="enableTrailerSound()">
                <i class="fas fa-volume-mute" style="font-size:2.5rem;color:var(--accent);"></i>
                <span style="font-size:13px;font-weight:700;margin-top:8px;">Нажмите для звука</span>
            </div>
        </div>`;
    }

    // Google Drive — iframe невозможен из-за CSP frame-ancestors, показываем кнопку
    if (trailer.url.includes('drive.google.com')) {
        return `
        <div class="trailer-box trailer-drive-fallback">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px;text-align:center;">
                <i class="fas fa-play-circle" style="font-size:3.5rem;color:var(--accent);margin-bottom:14px;opacity:0.8;"></i>
                <p style="font-size:15px;font-weight:700;margin-bottom:8px;">Трейлер</p>
                <p style="font-size:13px;color:var(--text-dim);margin-bottom:18px;line-height:1.5;">
                    Google Drive не позволяет встраивать видео в iframe.<br>
                    Откройте трейлер в новой вкладке.
                </p>
                <a href="${esc(trailer.url)}" target="_blank" class="btn" style="text-decoration:none;">
                    <i class="fas fa-external-link-alt"></i> Смотреть трейлер
                </a>
            </div>
        </div>`;
    }

    return '';
}

window.enableTrailerSound = () => {
    const overlay = document.getElementById('trailer-overlay');
    const iframe  = document.getElementById('trailer-iframe');
    if (!overlay || !iframe) return;
    overlay.style.display = 'none';
    document.getElementById('trailer-box')?.classList.add('active');
    // Перестраиваем URL: снимаем mute, добавляем controls
    const ytId = iframe.src.match(/embed\/([^?]+)/)?.[1];
    if (ytId) {
        iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0`;
        iframe.style.pointerEvents = 'auto';
    }
};

// ── Рендер страницы релиза ──
function renderViewPage(db, auth, userData, isAdmin, startEpIdx = 0) {
    const eps     = curProj.episodes || [];
    const trailer = eps.find(e => e.type === 'trailer');
    const series  = eps.filter(e => e.type !== 'trailer');
    currentEpIdx  = startEpIdx;

    const userListBtns = userData ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
            <button class="btn btn-outline btn-sm" id="btn-watch-later" onclick="toggleWatchList('later')">
                <i class="fas fa-clock"></i> Буду смотреть
            </button>
            <button class="btn btn-outline btn-sm" id="btn-favorite" onclick="toggleWatchList('favorite')">
                <i class="fas fa-star"></i> Избранное
            </button>
        </div>` : '';

    // Кнопка «Добавить медиа» для Admin — теперь вызывает openEpManager()
    const adminBtn = isAdmin
        ? `<button class="btn btn-blue btn-sm" onclick="openEpManager()"><i class="fas fa-film"></i> Серии</button>`
        : '';

    document.getElementById('v-info').innerHTML = `
        <div class="view-ivi-wrap">
            ${buildTrailerHTML(trailer)}

            <div class="view-meta-row">
                <img src="${esc(curProj.img)}" class="v-poster" onerror="this.src='${PLACEHOLDER_IMG}'">
                <div class="view-meta-info">
                    <h1 class="view-title">${esc(curProj.title)}</h1>
                    <p style="color:var(--text-dim);margin-bottom:10px;font-size:14px;">
                        ${esc(curProj.year)} · ${esc(curProj.genre)}
                    </p>
                    <p style="font-size:13px;line-height:1.7;color:#ddd;margin-bottom:14px;">${esc(curProj.desc)}</p>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">
                        <b>Авторы:</b> ${esc(curProj.authors)}
                    </div>
                    <div style="font-size:12px;color:var(--text-dim);">
                        <b style="color:var(--accent);">Озвучка:</b> ${esc(curProj.voiceover)}
                    </div>
                    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center;">
                        <button id="btn-like" class="react-btn" onclick="rateProj('like')">
                            <i class="fas fa-thumbs-up"></i> <span id="v-like-cnt">0</span>
                        </button>
                        <button id="btn-dislike" class="react-btn" onclick="rateProj('dislike')">
                            <i class="fas fa-thumbs-down"></i> <span id="v-dislike-cnt">0</span>
                        </button>
                        ${adminBtn}
                    </div>
                    ${userListBtns}
                </div>
            </div>

            <!-- ПЛЕЕР -->
            <div class="main-player-section">
                <div class="player-header-row">
                    <h3 id="v-current-ep-title" style="font-size:1rem;color:var(--accent);">
                        ${esc(series[startEpIdx]?.name || '')}
                    </h3>
                    <div class="player-settings-row">
                        <label class="player-setting-toggle">
                            <input type="checkbox" id="ps-autoskip" onchange="updatePlayerSettings()">
                            Авто-пропуск заставок
                        </label>
                        <label class="player-setting-toggle">
                            <input type="checkbox" id="ps-autonext" onchange="updatePlayerSettings()">
                            Авто-следующая серия
                        </label>
                    </div>
                </div>
                <div class="video-box" id="v-player-container">
                    ${series.length === 0 ? `
                    <div id="v-tape" class="no-episodes">
                        <i class="fas fa-hourglass-start" style="font-size:3rem;color:var(--accent);opacity:0.35;margin-bottom:14px;"></i>
                        <h3>Серий пока нет</h3>
                        <p style="color:var(--text-dim);font-size:14px;">Скоро появятся!</p>
                    </div>` : ''}
                    <iframe id="v-iframe"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowfullscreen frameborder="0"
                        style="${series.length === 0 ? 'display:none;' : ''}"></iframe>
                    <!-- Кнопки пропуска ВНУТРИ плеера -->
                    <button class="player-skip-btn" id="btn-skip-intro" style="display:none;"
                            onclick="skipIntro()">
                        <i class="fas fa-forward"></i> Пропустить заставку
                    </button>
                    <button class="player-next-btn" id="btn-next-ep" style="display:none;"
                            onclick="playNextEp()">
                        Следующая серия <i class="fas fa-step-forward"></i>
                    </button>
                    <!-- Стрелка △ для панели серий -->
                    ${series.length > 0 ? `
                    <div class="player-ep-arrow" id="player-ep-arrow" onclick="toggleEpPanel()">
                        <i class="fas fa-chevron-up"></i>
                    </div>
                    <!-- Выдвижная панель серий снизу плеера -->
                    <div class="ep-slide-panel" id="ep-slide-panel">
                        <div class="ep-panel-bar">
                            <span style="font-size:12px;font-weight:800;color:white;text-transform:uppercase;letter-spacing:1px;">Серии</span>
                            <button onclick="toggleEpPanel()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:14px;">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                        <div class="ep-panel-list" id="ep-panel-list"></div>
                    </div>` : ''}
                    <!-- Полноэкранная панель (CSS fullscreen) -->
                    <div class="fs-ep-panel" id="fs-ep-panel"></div>
                </div>
                <div class="ep-grid" id="v-ep-list"></div>
            </div>
        </div>`;

    updateLikesUI(auth, userData);
    if (series.length > 0) {
        renderEpGrid(series, isAdmin);
        renderEpPanelBtns(series);
        playEpByIdx(series, startEpIdx, isAdmin);
    }
    if (userData) loadWatchListStatus(db, auth, curProj.id);
    loadComments(db, auth, curProj, userData, isAdmin);
}

// ── Панель серий в плеере ──
window.toggleEpPanel = () => {
    const panel = document.getElementById('ep-slide-panel');
    const arrow = document.getElementById('player-ep-arrow');
    if (!panel) return;
    const open = panel.classList.toggle('ep-panel-open');
    if (arrow) arrow.style.opacity = open ? '0' : '0.7';
};

function renderEpPanelBtns(series) {
    const panelList = document.getElementById('ep-panel-list');
    if (!panelList) return;
    panelList.innerHTML = series.map((ep, i) => `
        <button class="ep-panel-btn ${i===currentEpIdx?'ep-panel-btn--active':''}"
                onclick="playEpByIdxGlobal(${i});document.getElementById('ep-slide-panel')?.classList.remove('ep-panel-open');document.getElementById('player-ep-arrow').style.opacity='0.7'">
            ${ep.thumb ? `<img src="${esc(ep.thumb)}" class="ep-panel-thumb" onerror="this.style.display='none'">` : ''}
            <span>${esc(ep.name)}</span>
        </button>`).join('');
}

// ── Сетка эпизодов — кнопки Edit + Delete для Admin ──
function renderEpGrid(series, isAdmin) {
    const globalIndices = series.map(ep =>
        (curProj.episodes||[]).findIndex(e =>
            e === ep || (e.url === ep.url && e.name === ep.name && e.type === ep.type)
        )
    );

    const epList = document.getElementById('v-ep-list');
    if (epList) epList.innerHTML = series.map((ep, i) => `
        <div class="ep-card ${i===currentEpIdx?'ep-card--active':''}" onclick="playEpByIdxGlobal(${i})">
            <div class="ep-card-thumb">
                ${ep.thumb ? `<img src="${esc(ep.thumb)}" alt="" onerror="this.style.display='none'">` : ''}
                <span style="${ep.thumb?'display:none;':''}width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:var(--text-dim);">
                    <i class="fas fa-film"></i>
                </span>
                ${isAdmin ? `
                <div class="ep-card-adm">
                    <button class="ep-adm-btn ep-adm-btn--edit" title="Редактировать"
                        onclick="event.stopPropagation();editEp(${globalIndices[i]})">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="ep-adm-btn ep-adm-btn--del" title="Удалить"
                        onclick="event.stopPropagation();delEp(${globalIndices[i]})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>` : ''}
            </div>
            <div class="ep-card-name">${esc(ep.name)}</div>
            ${ep.title ? `<div class="ep-card-title">${esc(ep.title)}</div>` : ''}
        </div>`).join('');

    const fsPanel = document.getElementById('fs-ep-panel');
    if (fsPanel) fsPanel.innerHTML = series.map((ep, i) => `
        <button class="fs-ep-btn ${i===currentEpIdx?'active':''}" onclick="playEpByIdxGlobal(${i})">
            ${esc(ep.name)}
        </button>`).join('');
}

// ── Воспроизвести эпизод ──
function playEpByIdx(series, idx, isAdmin) {
    if (!series[idx]) return;

    // Отменяем предыдущие таймеры заставок
    introTimers.forEach(t => clearTimeout(t));
    introTimers = [];

    // Скрываем кнопки
    const skipBtn = document.getElementById('btn-skip-intro');
    const nextBtn = document.getElementById('btn-next-ep');
    if (skipBtn) skipBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';

    currentEpIdx = idx;
    const ep = series[idx];

    // Строим правильный src для серии
    let src = ep.url || '';
    if (src.includes('drive.google.com')) {
        src = src.replace(/\/view.*$/, '/preview');
    } else {
        const ytId = getYtVideoId(src);
        if (ytId) src = `https://www.youtube.com/embed/${ytId}?enablejsapi=1&rel=0&modestbranding=1`;
    }

    const iframe = document.getElementById('v-iframe');
    if (iframe) { iframe.src = src; iframe.style.display = 'block'; }
    const tape = document.getElementById('v-tape');
    if (tape) tape.style.display = 'none';

    const titleEl = document.getElementById('v-current-ep-title');
    if (titleEl) titleEl.innerText = ep.name + (ep.title ? ' — ' + ep.title : '');

    document.querySelectorAll('.ep-card').forEach((c, i) => c.classList.toggle('ep-card--active', i===idx));
    document.querySelectorAll('.fs-ep-btn').forEach((b, i) => b.classList.toggle('active', i===idx));
    document.querySelectorAll('.ep-panel-btn').forEach((b, i) => b.classList.toggle('ep-panel-btn--active', i===idx));

    // ── Тайминги заставок ──
    if (ep.introStart && ep.introStart > 0) {
        const t1 = setTimeout(() => {
            if (currentEpIdx !== idx) return; // серия сменилась
            if (playerSettings.autoSkip) { skipIntro(); return; }
            if (skipBtn) skipBtn.style.display = 'flex';
            const t2 = setTimeout(() => {
                if (skipBtn) skipBtn.style.display = 'none';
            }, (ep.introDuration || 90) * 1000);
            introTimers.push(t2);
        }, ep.introStart * 1000);
        introTimers.push(t1);
    }

    if (ep.outroStart && ep.outroStart > 0) {
        const t3 = setTimeout(() => {
            if (currentEpIdx !== idx) return;
            const s = (curProj?.episodes||[]).filter(e => e.type !== 'trailer');
            if (idx >= s.length - 1) return;
            if (playerSettings.autoNext) { playNextEp(); return; }
            if (nextBtn) nextBtn.style.display = 'flex';
        }, ep.outroStart * 1000);
        introTimers.push(t3);
    }
}

window.playEpByIdxGlobal = (idx) => {
    const series = (curProj?.episodes||[]).filter(e => e.type !== 'trailer');
    playEpByIdx(series, idx, document.body.classList.contains('admin-mode'));
};

window.skipIntro = () => {
    const series = (curProj?.episodes||[]).filter(e => e.type !== 'trailer');
    const ep = series[currentEpIdx];
    if (!ep) return;
    const skipTo = (ep.introStart || 0) + (ep.introDuration || 90);
    const iframe = document.getElementById('v-iframe');
    if (iframe) {
        const ytId = iframe.src.match(/embed\/([^?]+)/)?.[1];
        if (ytId) iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&start=${skipTo}&enablejsapi=1&rel=0&modestbranding=1`;
    }
    const btn = document.getElementById('btn-skip-intro');
    if (btn) btn.style.display = 'none';
};

window.playNextEp = () => {
    const series = (curProj?.episodes||[]).filter(e => e.type !== 'trailer');
    if (currentEpIdx < series.length - 1)
        playEpByIdx(series, currentEpIdx + 1, document.body.classList.contains('admin-mode'));
};

window.updatePlayerSettings = () => {
    playerSettings.autoSkip = document.getElementById('ps-autoskip')?.checked || false;
    playerSettings.autoNext = document.getElementById('ps-autonext')?.checked || false;
};

function updateLikesUI(auth, userData) {
    const uid = userData ? auth.currentUser?.uid : null;
    const lc = document.getElementById('v-like-cnt');
    const dc = document.getElementById('v-dislike-cnt');
    if (lc) lc.innerText = (curProj?.likes    || []).length;
    if (dc) dc.innerText = (curProj?.dislikes || []).length;
    document.getElementById('btn-like')?.classList.toggle('active',    !!(uid&&(curProj?.likes   ||[]).includes(uid)));
    document.getElementById('btn-dislike')?.classList.toggle('active', !!(uid&&(curProj?.dislikes||[]).includes(uid)));
}

async function loadWatchListStatus(db, auth, relId) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        const snap = await getDoc(doc(db,`users/${uid}/watchlist`,relId));
        if (!snap.exists()) return;
        const { type } = snap.data();
        if (type === 'later') {
            const b = document.getElementById('btn-watch-later');
            if (b) { b.classList.add('btn-active'); b.innerHTML = '<i class="fas fa-check"></i> В списке'; }
        }
        if (type === 'favorite') {
            const b = document.getElementById('btn-favorite');
            if (b) { b.classList.add('btn-active'); b.innerHTML = '<i class="fas fa-star"></i> В избранном'; }
        }
    } catch(e) {}
}

// ═══════════════════════════════════════════════════
//  BIND
// ═══════════════════════════════════════════════════
export function bindReleases(db, auth, getState) {

    window.filterData = () => { const { isAdmin } = getState(); renderGrid(isAdmin); };

    window.openView = async (id) => {
        const { userData, isAdmin } = getState();
        await openViewRelease(db, auth, id, userData, isAdmin);
        getState().curProj = curProj;
    };

    window.rateProj = async (type) => {
        const { userData } = getState();
        if (!userData) return showToast('Авторизуйтесь для оценки','error');
        const uid = auth.currentUser.uid;
        let likes = [...(curProj.likes||[])], dislikes = [...(curProj.dislikes||[])];
        if (type==='like') {
            if (likes.includes(uid)) likes = likes.filter(x=>x!==uid);
            else { likes.push(uid); dislikes = dislikes.filter(x=>x!==uid); }
        } else {
            if (dislikes.includes(uid)) dislikes = dislikes.filter(x=>x!==uid);
            else { dislikes.push(uid); likes = likes.filter(x=>x!==uid); }
        }
        curProj.likes = likes; curProj.dislikes = dislikes;
        await updateDoc(doc(db,'releases',curProj.id), { likes, dislikes });
        updateLikesUI(auth, userData);
        await checkAndAwardAch(db, auth, userData, 'like_1');
    };

    window.toggleWatchList = async (type) => {
        const { userData } = getState();
        if (!userData) return showToast('Войдите для добавления в список','error');
        const uid  = auth.currentUser.uid;
        const ref  = doc(db,`users/${uid}/watchlist`,curProj.id);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().type === type) {
            await deleteDoc(ref);
            if (type==='later') {
                const b = document.getElementById('btn-watch-later');
                if (b) { b.classList.remove('btn-active'); b.innerHTML='<i class="fas fa-clock"></i> Буду смотреть'; }
            } else {
                const b = document.getElementById('btn-favorite');
                if (b) { b.classList.remove('btn-active'); b.innerHTML='<i class="fas fa-star"></i> Избранное'; }
            }
            showToast('Удалено из списка');
        } else {
            await setDoc(ref, { type, relId: curProj.id, title: curProj.title, img: curProj.img, addedAt: Date.now() });
            if (type==='later') {
                const b = document.getElementById('btn-watch-later');
                if (b) { b.classList.add('btn-active'); b.innerHTML='<i class="fas fa-check"></i> В списке'; }
                showToast('Добавлено в «Буду смотреть»');
            } else {
                const b = document.getElementById('btn-favorite');
                if (b) { b.classList.add('btn-active'); b.innerHTML='<i class="fas fa-star"></i> В избранном'; }
                showToast('Добавлено в избранное ⭐');
                await checkAndAwardAch(db, auth, userData, 'favorite_1');
            }
        }
    };

    // ── Открыть менеджер серий (кнопка «Серии» у Admin) ──
    window.openEpManager = () => {
        // Сбрасываем форму, скрываем ed-ep-idx
        const editIdxEl = document.getElementById('ed-ep-idx');
        if (editIdxEl) editIdxEl.value = '';
        ['ad-ep-name','ad-ep-title','ad-ep-url','ad-ep-thumb'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        ['ad-ep-intro-start','ad-ep-intro-dur','ad-ep-outro-start'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const heading = document.getElementById('m-ep-heading');
        if (heading) heading.textContent = 'Добавить медиа';
        document.getElementById('m-ep').style.display = 'flex';
    };

    // ── Редактировать серию (заполняет форму данными) ──
    window.editEp = (globalIdx) => {
        const ep = (curProj.episodes||[])[globalIdx];
        if (!ep) return;
        const editIdxEl = document.getElementById('ed-ep-idx');
        if (editIdxEl) editIdxEl.value = globalIdx;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
        set('ad-ep-type',        ep.type || 'series');
        set('ad-ep-name',        ep.name);
        set('ad-ep-title',       ep.title);
        set('ad-ep-url',         ep.url);
        set('ad-ep-thumb',       ep.thumb);
        set('ad-ep-intro-start', ep.introStart);
        set('ad-ep-intro-dur',   ep.introDuration);
        set('ad-ep-outro-start', ep.outroStart);
        const heading = document.getElementById('m-ep-heading');
        if (heading) heading.textContent = 'Редактировать медиа';
        document.getElementById('m-ep').style.display = 'flex';
    };

    // ── Сохранить (добавить или обновить) серию ──
    window.saveEp = async () => {
        if (!curProj) return;
        const { isAdmin } = getState();
        const editIdxEl = document.getElementById('ed-ep-idx');
        const editIdx = (editIdxEl?.value !== '' && editIdxEl?.value !== undefined)
            ? parseInt(editIdxEl.value) : -1;

        const ep = {
            type:          document.getElementById('ad-ep-type').value,
            name:          document.getElementById('ad-ep-name').value.trim(),
            title:         document.getElementById('ad-ep-title')?.value.trim() || '',
            url:           document.getElementById('ad-ep-url').value.trim(),
            thumb:         document.getElementById('ad-ep-thumb')?.value.trim() || '',
            introStart:    parseInt(document.getElementById('ad-ep-intro-start')?.value) || 0,
            introDuration: parseInt(document.getElementById('ad-ep-intro-dur')?.value)   || 90,
            outroStart:    parseInt(document.getElementById('ad-ep-outro-start')?.value) || 0,
        };
        if (!ep.name || !ep.url) return showToast('Заполните название и URL!','error');

        const eps = [...(curProj.episodes||[])];
        if (editIdx >= 0 && editIdx < eps.length) {
            eps[editIdx] = ep;
        } else {
            eps.push(ep);
        }
        await updateDoc(doc(db,'releases',curProj.id), { episodes: eps });
        curProj.episodes = eps;
        closeModals();

        const series = eps.filter(e => e.type !== 'trailer');
        renderEpGrid(series, isAdmin);
        renderEpPanelBtns(series);
        if (editIdx < 0 && series.length === 1) playEpByIdx(series, 0, isAdmin);
        showToast(editIdx >= 0 ? 'Медиа обновлено!' : 'Медиа добавлено!');

        // Сброс
        ['ad-ep-name','ad-ep-title','ad-ep-url','ad-ep-thumb'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        if (editIdxEl) editIdxEl.value = '';
    };

    // ── Удалить серию (принимает ГЛОБАЛЬНЫЙ индекс) ──
    window.delEp = async (globalIdx) => {
        if (!confirm('Удалить медиа?')) return;
        const { isAdmin } = getState();
        const eps = [...(curProj.episodes||[])];
        eps.splice(globalIdx, 1);
        await updateDoc(doc(db,'releases',curProj.id), { episodes: eps });
        curProj.episodes = eps;
        const series = eps.filter(e => e.type !== 'trailer');
        if (currentEpIdx >= series.length) currentEpIdx = Math.max(0, series.length - 1);
        renderEpGrid(series, isAdmin);
        renderEpPanelBtns(series);
        if (series.length > 0) playEpByIdx(series, currentEpIdx, isAdmin);
        showToast('Удалено');
    };

    // CRUD релизов
    window.openRelModal = async (id='') => {
        document.getElementById('ed-rel-id').value = id;
        if (id) {
            const r = allRel.find(x=>x.id===id);
            if (r) {
                ['title','year','voiceover','authors','img','desc'].forEach(f => {
                    const el = document.getElementById('ad-'+f); if (el) el.value = r[f]||'';
                });
                const g = document.getElementById('ad-genre'); if (g) g.value = r.genre||'';
            }
        } else {
            ['title','year','voiceover','authors','img','desc'].forEach(f => {
                const el = document.getElementById('ad-'+f); if (el) el.value = '';
            });
        }
        document.getElementById('m-rel').style.display = 'flex';
    };

    window.saveRel = async () => {
        const { isAdmin } = getState();
        const id = document.getElementById('ed-rel-id').value;
        const data = {
            title:     document.getElementById('ad-title').value,
            genre:     document.getElementById('ad-genre').value,
            year:      document.getElementById('ad-year').value,
            voiceover: document.getElementById('ad-voiceover').value,
            authors:   document.getElementById('ad-authors').value,
            img:       document.getElementById('ad-img').value,
            desc:      document.getElementById('ad-desc').value,
            timestamp: id ? (allRel.find(x=>x.id===id)?.timestamp||Date.now()) : Date.now()
        };
        if (!data.title) return showToast('Введите название!','error');
        if (!id) await addDoc(collection(db,'releases'), data);
        else     await updateDoc(doc(db,'releases',id), data);
        closeModals(); await loadReleases(db, isAdmin); showToast('Релиз сохранён!');
    };

    window.deleteRel = async (id) => {
        if (!confirm('Удалить релиз?')) return;
        const { isAdmin } = getState();
        await deleteDoc(doc(db,'releases',id));
        await loadReleases(db, isAdmin); showToast('Удалено');
    };

    window.openPrivacy = async () => {
        const { isAdmin } = getState();
        try {
            const snap = await getDoc(doc(db,'settings','privacy'));
            document.getElementById('priv-text').innerText = snap.exists() ? snap.data().text : 'Текст не добавлен.';
        } catch { document.getElementById('priv-text').innerText = 'Текст не добавлен.'; }
        document.getElementById('priv-adm-btns').style.display = isAdmin ? 'block' : 'none';
        document.getElementById('m-privacy').style.display = 'flex';
    };

    window.editPriv = () => {
        const txt = document.getElementById('priv-text').innerText;
        document.getElementById('priv-text').style.display    = 'none';
        document.getElementById('priv-edit').style.display    = 'block';
        document.getElementById('priv-edit').value            = txt;
        document.getElementById('priv-btn-edit').style.display = 'none';
        document.getElementById('priv-btn-save').style.display = 'block';
    };

    window.savePriv = async () => {
        const txt = document.getElementById('priv-edit').value;
        await setDoc(doc(db,'settings','privacy'), { text: txt });
        document.getElementById('priv-text').innerText         = txt;
        document.getElementById('priv-text').style.display     = 'block';
        document.getElementById('priv-edit').style.display     = 'none';
        document.getElementById('priv-btn-edit').style.display = 'block';
        document.getElementById('priv-btn-save').style.display = 'none';
        showToast('Сохранено!');
    };

    window.loadMyLists = async () => {
        const { userData } = getState();
        if (!userData || !auth.currentUser) return;
        const uid = auth.currentUser.uid;
        const container = document.getElementById('my-lists-wrap');
        if (!container) return;
        container.innerHTML = `<p style="font-size:12px;color:var(--text-dim);">Загрузка...</p>`;
        try {
            const wSnap    = await getDocs(collection(db,`users/${uid}/watchlist`));
            const all      = wSnap.docs.map(d => d.data());
            const later    = all.filter(x => x.type === 'later');
            const favorite = all.filter(x => x.type === 'favorite');
            const vSnap    = await getDocs(collection(db,`users/${uid}/viewed`));
            const viewed   = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            for (const v of viewed) {
                if (!v.title) {
                    const found = allRel.find(r => r.id === v.id);
                    v.title = found?.title || '(неизвестный релиз)';
                    v.img   = found?.img   || '';
                }
            }
            const mkSection = (id, icon, title, count, content) => `
                <div class="list-section-wrap">
                    <div class="list-section-header" onclick="toggleListSection('${id}')">
                        <span>${icon} <b>${title}</b>&nbsp;<span style="color:var(--text-dim);font-size:12px;">(${count})</span></span>
                        <i class="fas fa-chevron-down list-section-chevron" id="chev-${id}"></i>
                    </div>
                    <div class="list-section-body" id="body-${id}">${content}</div>
                </div>`;
            const favHtml = favorite.length
                ? `<div class="lists-grid">${favorite.map(r=>`
                    <div class="list-card" onclick="openView('${r.relId}')">
                        <img src="${esc(r.img)}" onerror="this.src='${PLACEHOLDER_IMG}'">
                        <div class="list-card-title">${esc(r.title)}</div>
                    </div>`).join('')}</div>`
                : `<p class="list-empty">Пусто — нажмите ⭐ на странице релиза</p>`;
            const laterHtml = later.length
                ? `<div class="lists-grid">${later.map(r=>`
                    <div class="list-card" onclick="openView('${r.relId}')">
                        <img src="${esc(r.img)}" onerror="this.src='${PLACEHOLDER_IMG}'">
                        <div class="list-card-title">${esc(r.title)}</div>
                    </div>`).join('')}</div>`
                : `<p class="list-empty">Пусто — нажмите 🕐 на странице релиза</p>`;
            const viewedHtml = viewed.length
                ? viewed.map(v => `
                    <div class="viewed-row" onclick="openView('${v.id}')">
                        ${v.img ? `<img src="${esc(v.img)}" class="viewed-thumb" onerror="this.style.display='none'">` : ''}
                        <div style="flex:1;min-width:0;">
                            <div class="viewed-title">${esc(v.title)}</div>
                            <div class="viewed-date"><i class="fas fa-check-circle" style="color:#22c55e;font-size:10px;"></i> ${new Date(v.at).toLocaleDateString('ru')}</div>
                        </div>
                    </div>`).join('')
                : `<p class="list-empty">Пусто — смотрите релизы более 10 мин</p>`;
            container.innerHTML =
                mkSection('fav',    '⭐','Избранное',     favorite.length, favHtml)
              + mkSection('later',  '🕐','Буду смотреть', later.length,    laterHtml)
              + mkSection('viewed', '👁', 'Просмотрено',  viewed.length,   viewedHtml);
        } catch(e) {
            container.innerHTML = `<p style="color:#ef4444;font-size:13px;">Ошибка загрузки.</p>`;
            console.error(e);
        }
    };

    window.toggleListSection = (id) => {
        const body = document.getElementById('body-'+id);
        const chev = document.getElementById('chev-'+id);
        if (!body) return;
        const open = body.classList.toggle('list-section-open');
        if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
    };
}
