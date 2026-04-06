// ============================================================
//  js/releases.js — Релизы, плеер, избранное, просмотренное
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

let viewTimer      = null; // таймер для засчёта просмотра
let playerSettings = { autoSkip: false, autoNext: false }; // настройки плеера
let currentEpIdx   = 0;    // текущий эпизод

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
                <div style="font-size:10px;color:var(--text-dim);margin-top:5px;display:flex;gap:8px;align-items:center;">
                    <span><i class="fas fa-eye"></i> ${r.views||0}</span>
                </div>
            </div>
        </div>`).join('');
}

// ── Открытие страницы релиза ──
export async function openViewRelease(db, auth, id, userData, isAdmin) {
    clearTimeout(viewTimer);
    const snap = await getDoc(doc(db,'releases',id));
    if (!snap.exists()) return showToast('Релиз не найден','error');
    curProj = { id, ...snap.data() };
    const idx = allRel.findIndex(x => x.id === id);
    if (idx >= 0) allRel[idx] = curProj;
    navigate('view');

    // Определяем любимую серию (из истории просмотра)
    let watchedEpIdx = 0;
    if (userData) {
        const wSnap = await getDoc(doc(db,`users/${auth.currentUser.uid}/watched`,id));
        if (wSnap.exists() && wSnap.data().lastEpIdx !== undefined) {
            watchedEpIdx = wSnap.data().lastEpIdx;
        }
    }

    // Таймер просмотра — засчитываем через VIEW_COUNT_AFTER_MS, только если не смотрел раньше
    if (userData) {
        const viewedSnap = await getDoc(doc(db,`users/${auth.currentUser.uid}/viewed`, id));
        if (!viewedSnap.exists()) {
            viewTimer = setTimeout(async () => {
                await updateDoc(doc(db,'releases',id), { views: increment(1) });
                await setDoc(doc(db,`users/${auth.currentUser.uid}/viewed`,id), { at: Date.now(), title: curProj.title, img: curProj.img });
                await updateDoc(doc(db,'users',auth.currentUser.uid), { views: increment(1) });
                curProj.views = (curProj.views||0)+1;
                await checkAndAwardAch(db, auth, userData, 'views_1');
                const totalViews = (userData.views||0)+1;
                if (totalViews >= 10) await checkAndAwardAch(db, auth, userData, 'views_10');
                if (totalViews >= 50) await checkAndAwardAch(db, auth, userData, 'views_50');
            }, VIEW_COUNT_AFTER_MS);
        }
    }

    renderViewPage(db, auth, userData, isAdmin, watchedEpIdx);
}

// ── Рендер страницы релиза в стиле IVI ──
function renderViewPage(db, auth, userData, isAdmin, startEpIdx = 0) {
    const eps = curProj.episodes || [];
    const trailer = eps.find(e => e.type === 'trailer');
    const series  = eps.filter(e => e.type !== 'trailer');
    currentEpIdx = startEpIdx;

    // Статус избранного / буду смотреть
    const userListBtns = userData ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
            <button class="btn btn-outline btn-sm" id="btn-watch-later" onclick="toggleWatchList('later')">
                <i class="fas fa-clock"></i> Буду смотреть
            </button>
            <button class="btn btn-outline btn-sm" id="btn-favorite" onclick="toggleWatchList('favorite')">
                <i class="fas fa-star"></i> Избранное
            </button>
        </div>` : '';

    document.getElementById('v-info').innerHTML = `
        <div class="view-ivi-wrap">
            <!-- ТРЕЙЛЕР-плеер (автоплей без звука) -->
            ${trailer ? `
            <div class="trailer-box" id="trailer-box">
                <iframe id="trailer-iframe"
                    src="${trailerSrc(trailer.url)}${trailer.url.includes('?')?'&':'?'}autoplay=1&mute=1&loop=1&controls=0&modestbranding=1"
                    allow="autoplay; fullscreen" allowfullscreen
                    title="Трейлер"
                    onclick="enableTrailerSound()"></iframe>
                <div class="trailer-overlay" id="trailer-overlay" onclick="enableTrailerSound()">
                    <i class="fas fa-volume-mute"></i>
                    <span>Нажмите для звука и управления</span>
                </div>
            </div>` : ''}

            <!-- Мета-информация -->
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
                        <div id="v-likes-bar" style="display:flex;gap:10px;">
                            <button id="btn-like" class="react-btn" onclick="rateProj('like')">
                                <i class="fas fa-thumbs-up"></i> <span id="v-like-cnt">0</span>
                            </button>
                            <button id="btn-dislike" class="react-btn" onclick="rateProj('dislike')">
                                <i class="fas fa-thumbs-down"></i> <span id="v-dislike-cnt">0</span>
                            </button>
                        </div>
                        ${isAdmin ? `<button class="btn btn-blue btn-sm" onclick="document.getElementById('m-ep').style.display='flex'">
                            <i class="fas fa-plus"></i> Медиа</button>` : ''}
                    </div>
                    ${userListBtns}
                </div>
            </div>

            <!-- ОСНОВНОЙ ПЛЕЕР (серии/фильм) -->
            ${series.length > 0 ? `
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
                    <div id="v-tape" class="no-episodes" style="display:none;">
                        <i class="fas fa-hourglass-start" style="font-size:3rem;color:var(--accent);opacity:0.4;margin-bottom:15px;"></i>
                        <h3>Серий пока нет</h3><p style="color:var(--text-dim);font-size:14px;">Скоро появятся!</p>
                    </div>
                    <iframe id="v-iframe" allow="autoplay; fullscreen" allowfullscreen></iframe>
                    <!-- Кнопки поверх плеера -->
                    <button class="player-skip-btn" id="btn-skip-intro" style="display:none;"
                        onclick="skipIntro()">Пропустить заставку ⏭</button>
                    <button class="player-next-btn" id="btn-next-ep" style="display:none;"
                        onclick="playNextEp()">Следующая серия →</button>
                    <!-- Список серий в полноэкранном режиме -->
                    <div class="fs-ep-panel" id="fs-ep-panel"></div>
                </div>
                <!-- Сетка серий -->
                <div class="ep-grid" id="v-ep-list"></div>
            </div>` : `
            <div class="video-box" id="v-player-container">
                <div id="v-tape" class="no-episodes">
                    <i class="fas fa-hourglass-start" style="font-size:3rem;color:var(--accent);opacity:0.4;margin-bottom:15px;"></i>
                    <h3>Серий пока нет</h3><p style="color:var(--text-dim);font-size:14px;">Скоро появятся!</p>
                </div>
                <iframe id="v-iframe" allow="autoplay; fullscreen" allowfullscreen></iframe>
            </div>`}
        </div>`;

    updateLikesUI(auth, userData);
    if (series.length > 0) {
        renderEpGrid(series, isAdmin);
        playEpByIdx(series, startEpIdx, isAdmin);
    }
    if (userData) loadWatchListStatus(db, auth, curProj.id);
    loadComments(db, auth, curProj, userData, isAdmin);
}

// ── Трейлер — строим embed URL с нуля (без дублирования параметров) ──
function buildTrailerSrc(url) {
    if (!url) return '';
    let videoId = '';
    try {
        if (url.includes('youtube.com/watch')) {
            videoId = new URL(url).searchParams.get('v') || '';
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
        } else if (url.includes('youtube.com/embed/')) {
            videoId = url.split('youtube.com/embed/')[1]?.split('?')[0] || '';
        }
    } catch(e) {}
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0`;
    }
    if (url.includes('drive.google.com')) return url.replace(/\/view.*$/, '/preview');
    return url;
}
// Алиас для совместимости
const trailerSrc = buildTrailerSrc;

window.enableTrailerSound = () => {
    const overlay = document.getElementById('trailer-overlay');
    const iframe  = document.getElementById('trailer-iframe');
    if (!overlay || !iframe) return;
    overlay.style.display = 'none';
    document.getElementById('trailer-box')?.classList.add('active');
    // Перестраиваем URL: убираем mute=1, включаем controls
    let newSrc = iframe.src
        .replace(/[&?]mute=1/, '&mute=0')
        .replace(/[&?]controls=0/, '&controls=1');
    if (newSrc === iframe.src) {
        newSrc = iframe.src + '&controls=1&mute=0';
    }
    iframe.src = newSrc;
    iframe.setAttribute('allowfullscreen','');
};

// ── Сетка эпизодов — delEp использует глобальный индекс ──
function renderEpGrid(series, isAdmin) {
    // Вычисляем глобальные индексы (в curProj.episodes) для кнопок удаления
    const globalIndices = series.map(ep =>
        (curProj.episodes || []).findIndex(e => e === ep || (e.url === ep.url && e.name === ep.name))
    );

    const epList = document.getElementById('v-ep-list');
    if (epList) epList.innerHTML = series.map((ep, i) => `
        <div class="ep-card ${i===currentEpIdx?'ep-card--active':''}" onclick="playEpByIdxGlobal(${i})">
            <div class="ep-card-thumb">
                ${ep.thumb ? `<img src="${esc(ep.thumb)}" alt="" onerror="this.style.display='none'">` : ''}
                <span style="${ep.thumb?'display:none;':''}width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:var(--text-dim);">
                    <i class="fas fa-film"></i>
                </span>
                ${isAdmin ? `<button class="ep-card-del" onclick="event.stopPropagation();delEp(${globalIndices[i]})">×</button>` : ''}
            </div>
            <div class="ep-card-name">${esc(ep.name)}</div>
            ${ep.title ? `<div class="ep-card-title">${esc(ep.title)}</div>` : ''}
        </div>`).join('');

    // Полноэкранная панель серий
    const fsPanel = document.getElementById('fs-ep-panel');
    if (fsPanel) fsPanel.innerHTML = series.map((ep, i) => `
        <button class="fs-ep-btn ${i===currentEpIdx?'active':''}" onclick="playEpByIdxGlobal(${i})">
            ${esc(ep.name)}
        </button>`).join('');
}

// ── Воспроизвести эпизод по индексу ──
function playEpByIdx(series, idx, isAdmin) {
    if (!series[idx]) return;
    currentEpIdx = idx;
    const ep  = series[idx];
    let src = ep.url;
    if (src.includes('drive.google.com')) src = src.replace(/\/view.*$/,'/preview');
    else if (src.includes('youtube.com/watch')) src = src.replace('watch?v=','embed/');
    else if (src.includes('youtu.be/')) src = 'https://www.youtube.com/embed/'+src.split('youtu.be/')[1];
    document.getElementById('v-iframe').src = src;
    const title = document.getElementById('v-current-ep-title');
    if (title) title.innerText = ep.name + (ep.title ? ' — ' + ep.title : '');

    // Обновляем активную карточку
    document.querySelectorAll('.ep-card').forEach((c,i) => c.classList.toggle('ep-card--active', i===idx));
    document.querySelectorAll('.fs-ep-btn').forEach((b,i) => b.classList.toggle('active', i===idx));

    // Тайминги заставок
    handleIntroSkip(ep, isAdmin);
}
window.playEpByIdxGlobal = (idx) => {
    const series = (curProj?.episodes||[]).filter(e=>e.type!=='trailer');
    // Нужен isAdmin — читаем из closure через getState не можем, используем data-атрибут
    playEpByIdx(series, idx, document.body.classList.contains('admin-mode'));
};

function handleIntroSkip(ep, isAdmin) {
    const skipBtn = document.getElementById('btn-skip-intro');
    const nextBtn = document.getElementById('btn-next-ep');
    if (!skipBtn || !nextBtn) return;
    skipBtn.style.display = 'none';
    nextBtn.style.display = 'none';

    if (!ep.introStart && !ep.outroStart) return;

    // Слушаем iframe через postMessage (для YouTube это ограничено)
    // Для Google Drive — показываем кнопку через setTimeout
    if (ep.introStart) {
        const ms = ep.introStart * 1000;
        const dur = (ep.introDuration || 90) * 1000;
        setTimeout(() => {
            if (currentEpIdx !== (curProj?.episodes||[]).filter(e=>e.type!=='trailer').indexOf(ep)) return;
            if (playerSettings.autoSkip) { skipIntro(); return; }
            skipBtn.style.display = 'block';
            setTimeout(() => skipBtn.style.display = 'none', dur);
        }, ms);
    }
    if (ep.outroStart) {
        const ms = ep.outroStart * 1000;
        setTimeout(() => {
            if (currentEpIdx !== (curProj?.episodes||[]).filter(e=>e.type!=='trailer').indexOf(ep)) return;
            const series = (curProj?.episodes||[]).filter(e=>e.type!=='trailer');
            if (currentEpIdx < series.length-1) {
                if (playerSettings.autoNext) { playNextEp(); return; }
                nextBtn.style.display = 'block';
            }
        }, ms);
    }
}

window.skipIntro = () => {
    const series = (curProj?.episodes||[]).filter(e=>e.type!=='trailer');
    const ep = series[currentEpIdx];
    if (!ep) return;
    const skipTo = (ep.introStart || 0) + (ep.introDuration || 90);
    // Перезагружаем iframe с таймингом (работает для YouTube embed)
    const iframe = document.getElementById('v-iframe');
    if (iframe && iframe.src.includes('youtube.com')) {
        iframe.src = iframe.src.replace(/&start=\d+/,'') + '&start=' + skipTo;
    }
    document.getElementById('btn-skip-intro').style.display = 'none';
};

window.playNextEp = () => {
    const series = (curProj?.episodes||[]).filter(e=>e.type!=='trailer');
    if (currentEpIdx < series.length-1) {
        playEpByIdx(series, currentEpIdx+1, document.body.classList.contains('admin-mode'));
    }
};

window.updatePlayerSettings = () => {
    playerSettings.autoSkip = document.getElementById('ps-autoskip')?.checked || false;
    playerSettings.autoNext = document.getElementById('ps-autonext')?.checked || false;
};

// ── Лайки ──
function updateLikesUI(auth, userData) {
    const uid = userData ? auth.currentUser?.uid : null;
    document.getElementById('v-like-cnt').innerText    = (curProj?.likes||[]).length;
    document.getElementById('v-dislike-cnt').innerText = (curProj?.dislikes||[]).length;
    document.getElementById('btn-like')?.classList.toggle('active',    !!(uid&&(curProj?.likes||[]).includes(uid)));
    document.getElementById('btn-dislike')?.classList.toggle('active', !!(uid&&(curProj?.dislikes||[]).includes(uid)));
}

// ── Избранное / Буду смотреть ──
async function loadWatchListStatus(db, auth, relId) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
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
}

// ── Bind всех функций релизов ──
export function bindReleases(db, auth, getState) {

    window.filterData = () => { const { isAdmin } = getState(); renderGrid(isAdmin); };

    window.openView = async (id) => {
        const { userData, isAdmin } = getState();
        await openViewRelease(db, auth, id, userData, isAdmin);
        getState().curProj = curProj; // синхронизируем в state
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

    // ── Избранное/Буду смотреть ──
    window.toggleWatchList = async (type) => {
        const { userData } = getState();
        if (!userData) return showToast('Войдите для добавления в список','error');
        const uid  = auth.currentUser.uid;
        const ref  = doc(db,`users/${uid}/watchlist`,curProj.id);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().type === type) {
            // Убираем
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

    // ── Добавить/удалить эпизод ──
    window.saveEp = async () => {
        if (!curProj) return;
        const { isAdmin } = getState();
        const ep = {
            type:          document.getElementById('ad-ep-type').value,
            name:          document.getElementById('ad-ep-name').value,
            title:         document.getElementById('ad-ep-title').value,
            url:           document.getElementById('ad-ep-url').value,
            thumb:         document.getElementById('ad-ep-thumb')?.value || '',
            introStart:    parseInt(document.getElementById('ad-ep-intro-start')?.value)||0,
            introDuration: parseInt(document.getElementById('ad-ep-intro-dur')?.value)||90,
            outroStart:    parseInt(document.getElementById('ad-ep-outro-start')?.value)||0,
        };
        if (!ep.name || !ep.url) return showToast('Заполните название и URL!','error');
        const eps = [...(curProj.episodes||[])];
        eps.push(ep);
        await updateDoc(doc(db,'releases',curProj.id), { episodes: eps });
        curProj.episodes = eps;
        closeModals();
        const series = eps.filter(e=>e.type!=='trailer');
        renderEpGrid(series, isAdmin);
        showToast('Медиа добавлено!');
        ['ad-ep-name','ad-ep-title','ad-ep-url'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    };

    // delEp принимает ГЛОБАЛЬНЫЙ индекс в curProj.episodes
    window.delEp = async (globalIdx) => {
        if (!confirm('Удалить медиа?')) return;
        const { isAdmin } = getState();
        const eps = [...(curProj.episodes || [])];
        eps.splice(globalIdx, 1);
        await updateDoc(doc(db,'releases',curProj.id), { episodes: eps });
        curProj.episodes = eps;
        const series = eps.filter(e => e.type !== 'trailer');
        if (currentEpIdx >= series.length) currentEpIdx = Math.max(0, series.length - 1);
        renderEpGrid(series, isAdmin);
        if (series.length > 0) playEpByIdx(series, currentEpIdx, isAdmin);
        showToast('Удалено');
    };

    // ── CRUD релизов ──
    window.openRelModal = async (id='') => {
        document.getElementById('ed-rel-id').value = id;
        if (id) {
            const r = allRel.find(x=>x.id===id);
            if (r) {
                ['title','year','voiceover','authors','img','desc'].forEach(f=>{
                    const el = document.getElementById('ad-'+f);
                    if (el) el.value = r[f]||'';
                });
                const g = document.getElementById('ad-genre');
                if (g) g.value = r.genre||'';
            }
        } else {
            ['title','year','voiceover','authors','img','desc'].forEach(f=>{
                const el = document.getElementById('ad-'+f);
                if (el) el.value = '';
            });
        }
        document.getElementById('m-rel').style.display = 'flex';
    };

    window.saveRel = async () => {
        const { isAdmin } = getState();
        const id   = document.getElementById('ed-rel-id').value;
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

    // ── Политика конфиденциальности ──
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
        document.getElementById('priv-text').style.display   = 'none';
        document.getElementById('priv-edit').style.display   = 'block';
        document.getElementById('priv-edit').value           = txt;
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

    // ── Раздел «Мои списки» в профиле — с названиями и сворачиванием ──
    window.loadMyLists = async () => {
        const { userData } = getState();
        if (!userData || !auth.currentUser) return;
        const uid = auth.currentUser.uid;
        const container = document.getElementById('my-lists-wrap');
        if (!container) return;
        container.innerHTML = `<p style="font-size:12px;color:var(--text-dim);">Загрузка...</p>`;
        try {
            const wSnap    = await getDocs(collection(db, `users/${uid}/watchlist`));
            const all      = wSnap.docs.map(d => d.data());
            const later    = all.filter(x => x.type === 'later');
            const favorite = all.filter(x => x.type === 'favorite');
            const vSnap    = await getDocs(collection(db, `users/${uid}/viewed`));
            const viewed   = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Для старых записей без title — берём из кэша релизов
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
                mkSection('fav',    '⭐', 'Избранное',     favorite.length, favHtml)
              + mkSection('later',  '🕐', 'Буду смотреть', later.length,    laterHtml)
              + mkSection('viewed', '👁',  'Просмотрено',   viewed.length,   viewedHtml);
        } catch(e) {
            container.innerHTML = `<p style="color:#ef4444;font-size:13px;">Ошибка загрузки списков.</p>`;
            console.error(e);
        }
    };

    // Переключение секции
    window.toggleListSection = (id) => {
        const body = document.getElementById('body-' + id);
        const chev = document.getElementById('chev-' + id);
        if (!body) return;
        const open = body.classList.toggle('list-section-open');
        if (chev) chev.style.transform = open ? 'rotate(180deg)' : '';
    };
}
