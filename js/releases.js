// ============================================================
//  js/releases.js — Релизы: список, просмотр, эпизоды, лайки
// ============================================================

import {
    collection, getDocs, getDoc, doc, addDoc,
    updateDoc, deleteDoc, setDoc, query, orderBy, increment
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast, closeModals, navigate } from './core.js';
import { PLACEHOLDER_IMG } from '../config/config.js';
import { loadComments } from './comments.js';

// Общее состояние релизов (читается через getState в app.js)
export let allRel  = [];
export let curProj = null;

// ── Загрузка всех релизов ──
export async function loadReleases(db, isAdmin) {
    const snap = await getDocs(query(collection(db, 'releases'), orderBy('timestamp', 'desc')));
    allRel = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGrid(isAdmin);
}

// ── Фильтрация и отображение карточек ──
export function renderGrid(isAdmin) {
    let res = [...allRel];
    const q = (document.getElementById('main-search')?.value || '').toLowerCase();
    const g = document.getElementById('filter-genre')?.value || 'all';
    const s = document.getElementById('filter-sort')?.value  || 'new';

    if (q) res = res.filter(r => r.title?.toLowerCase().includes(q));
    if (g !== 'all') res = res.filter(r => r.genre === g);
    if (s === 'pop')    res.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (s === 'random') res.sort(() => 0.5 - Math.random());
    else res.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    document.getElementById('main-grid').innerHTML = res.map(r => `
        <div class="card" onclick="openView('${r.id}')">
            ${isAdmin ? `<div class="adm-tools">
                <button class="btn-sm" style="background:#3897f0;"
                    onclick="event.stopPropagation();openRelModal('${r.id}')">Ред</button>
                <button class="btn-sm" style="background:#ef4444;"
                    onclick="event.stopPropagation();deleteRel('${r.id}')">Удал</button>
            </div>` : ''}
            <img src="${esc(r.img)}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">
            <div class="card-info">
                <div><span class="tag">${esc(r.genre)}</span><span class="year-tag">${esc(r.year)}</span></div>
                <div class="card-title">${esc(r.title)}</div>
                <div style="font-size:10px;color:var(--text-dim);margin-top:5px;">
                    <i class="fas fa-eye"></i> ${r.views || 0}
                </div>
            </div>
        </div>`).join('');
}

// ── Эпизоды ──
export function renderEps(isAdmin) {
    const list = document.getElementById('v-ep-list');
    const eps  = curProj?.episodes || [];
    document.getElementById('v-current-ep-title').style.display = 'none';
    if (eps.length === 0) {
        list.innerHTML = '';
        document.getElementById('v-iframe').style.display = 'none';
        document.getElementById('v-tape').style.display   = 'flex';
        return;
    }
    document.getElementById('v-iframe').style.display = 'block';
    document.getElementById('v-tape').style.display   = 'none';
    list.innerHTML = eps.map((ep, i) => `
        <div style="display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;">
            ${isAdmin ? `<button class="btn-sm"
                style="background:red;position:absolute;top:-8px;right:-8px;z-index:10;border-radius:50%;width:18px;height:18px;font-size:9px;display:flex;align-items:center;justify-content:center;"
                onclick="delEp(${i})">×</button>` : ''}
            <button class="ep-btn"
                onclick="playEp('${esc(ep.url)}', this, '${esc(ep.title || '')}')">${esc(ep.name)}</button>
        </div>`).join('');
    const firstBtn = list.querySelector('.ep-btn');
    if (firstBtn) playEp(eps[0].url, firstBtn, eps[0].title || '');
}

// ── Лайки (утилита) ──
export function updateLikesUI(auth, userData) {
    const uid = userData ? auth.currentUser?.uid : null;
    document.getElementById('v-like-cnt').innerText    = (curProj?.likes || []).length;
    document.getElementById('v-dislike-cnt').innerText = (curProj?.dislikes || []).length;
    document.getElementById('btn-like').classList.toggle('active',
        !!(uid && (curProj?.likes || []).includes(uid)));
    document.getElementById('btn-dislike').classList.toggle('active',
        !!(uid && (curProj?.dislikes || []).includes(uid)));
}

// ── Привязка всех функций релизов к актуальному состоянию ──
export function bindReleases(db, auth, getState) {

    // Фильтрация
    window.filterData = () => {
        const { isAdmin } = getState();
        renderGrid(isAdmin);
    };

    // Открыть релиз
    window.openView = async (id) => {
        const { userData, isAdmin } = getState();
        const snap = await getDoc(doc(db, 'releases', id));
        if (!snap.exists()) return showToast('Релиз не найден', 'error');
        curProj = { id, ...snap.data() };
        // Обновляем в кэше
        const idx = allRel.findIndex(x => x.id === id);
        if (idx >= 0) allRel[idx] = curProj;

        navigate('view');

        if (userData) {
            updateDoc(doc(db, 'releases', id), { views: increment(1) });
            updateDoc(doc(db, 'users', auth.currentUser.uid), { views: increment(1) });
        }

        document.getElementById('v-info').innerHTML = `
            <div class="view-header">
                <img src="${esc(curProj.img)}" class="v-poster"
                     onerror="this.src='${PLACEHOLDER_IMG}'">
                <div style="flex:1;">
                    <h1 class="view-title">${esc(curProj.title)}</h1>
                    <p style="color:var(--text-dim);margin-bottom:12px;font-size:14px;">
                        ${esc(curProj.year)} • ${esc(curProj.genre)}</p>
                    <p style="font-size:13px;line-height:1.6;margin-bottom:14px;color:#ddd;">
                        ${esc(curProj.desc)}</p>
                    <div style="font-size:12px;color:var(--text-dim);">
                        <b>Авторы:</b> ${esc(curProj.authors)}<br>
                        <b style="color:var(--accent);">Озвучка:</b> ${esc(curProj.voiceover)}
                    </div>
                    ${isAdmin ? `<button class="btn btn-blue" style="margin-top:14px;"
                        onclick="document.getElementById('m-ep').style.display='flex'">
                        <i class="fas fa-plus"></i> Добавить медиа</button>` : ''}
                </div>
            </div>`;

        updateLikesUI(auth, userData);
        renderEps(isAdmin);
        await loadComments(db, auth, curProj, userData, isAdmin);
    };

    // Лайк / Дизлайк
    window.rateProj = async (type) => {
        const { userData } = getState();
        if (!userData) return showToast('Авторизуйтесь для оценки', 'error');
        const uid = auth.currentUser.uid;
        let likes    = [...(curProj.likes    || [])];
        let dislikes = [...(curProj.dislikes || [])];
        if (type === 'like') {
            if (likes.includes(uid)) likes = likes.filter(x => x !== uid);
            else { likes.push(uid); dislikes = dislikes.filter(x => x !== uid); }
        } else {
            if (dislikes.includes(uid)) dislikes = dislikes.filter(x => x !== uid);
            else { dislikes.push(uid); likes = likes.filter(x => x !== uid); }
        }
        curProj.likes    = likes;
        curProj.dislikes = dislikes;
        await updateDoc(doc(db, 'releases', curProj.id), { likes, dislikes });
        updateLikesUI(auth, userData);
    };

    // Воспроизведение эпизода
    window.playEp = (url, btn, epTitle) => {
        if (!url) return;
        let src = url;
        if (url.includes('drive.google.com'))
            src = url.replace(/\/view.*$/, '/preview');
        else if (url.includes('youtube.com/watch'))
            src = url.replace('watch?v=', 'embed/');
        else if (url.includes('youtu.be/'))
            src = 'https://www.youtube.com/embed/' + url.split('youtu.be/')[1];
        document.getElementById('v-iframe').src = src;
        document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active-ep'));
        if (btn) btn.classList.add('active-ep');
        const titleEl = document.getElementById('v-current-ep-title');
        if (epTitle?.trim()) { titleEl.innerText = epTitle; titleEl.style.display = 'block'; }
        else titleEl.style.display = 'none';
    };

    // Добавить эпизод
    window.saveEp = async () => {
        if (!curProj) return;
        const { isAdmin } = getState();
        const ep = {
            type:  document.getElementById('ad-ep-type').value,
            name:  document.getElementById('ad-ep-name').value,
            title: document.getElementById('ad-ep-title').value,
            url:   document.getElementById('ad-ep-url').value
        };
        if (!ep.name || !ep.url) return showToast('Заполните название и URL!', 'error');
        const eps = [...(curProj.episodes || [])];
        eps.push(ep);
        await updateDoc(doc(db, 'releases', curProj.id), { episodes: eps });
        curProj.episodes = eps;
        closeModals();
        renderEps(isAdmin);
        showToast('Медиа добавлено!');
        ['ad-ep-name', 'ad-ep-title', 'ad-ep-url'].forEach(id =>
            document.getElementById(id).value = '');
    };

    // Удалить эпизод
    window.delEp = async (idx) => {
        if (!confirm('Удалить медиа?')) return;
        const { isAdmin } = getState();
        curProj.episodes.splice(idx, 1);
        await updateDoc(doc(db, 'releases', curProj.id), { episodes: curProj.episodes });
        renderEps(isAdmin);
        showToast('Удалено');
    };

    // Открыть модал добавления/редактирования релиза
    window.openRelModal = async (id = '') => {
        document.getElementById('ed-rel-id').value = id;
        if (id) {
            const r = allRel.find(x => x.id === id);
            if (r) {
                ['title', 'year', 'voiceover', 'authors', 'img', 'desc'].forEach(f =>
                    document.getElementById(`ad-${f}`).value = r[f] || '');
                document.getElementById('ad-genre').value = r.genre || '';
            }
        } else {
            ['title', 'year', 'voiceover', 'authors', 'img', 'desc'].forEach(f =>
                document.getElementById(`ad-${f}`).value = '');
        }
        document.getElementById('m-rel').style.display = 'flex';
    };

    // Сохранить релиз
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
            timestamp: id
                ? (allRel.find(x => x.id === id)?.timestamp || Date.now())
                : Date.now()
        };
        if (!data.title) return showToast('Введите название!', 'error');
        if (!id) await addDoc(collection(db, 'releases'), data);
        else     await updateDoc(doc(db, 'releases', id), data);
        closeModals();
        await loadReleases(db, isAdmin);
        showToast('Релиз сохранён!');
    };

    // Удалить релиз
    window.deleteRel = async (id) => {
        if (!confirm('Удалить этот релиз навсегда?')) return;
        const { isAdmin } = getState();
        await deleteDoc(doc(db, 'releases', id));
        await loadReleases(db, isAdmin);
        showToast('Релиз удалён!');
    };

    // Политика конфиденциальности
    window.openPrivacy = async () => {
        const { isAdmin } = getState();
        try {
            const snap = await getDoc(doc(db, 'settings', 'privacy'));
            document.getElementById('priv-text').innerText =
                snap.exists() ? snap.data().text : 'Текст не добавлен.';
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
        await setDoc(doc(db, 'settings', 'privacy'), { text: txt });
        document.getElementById('priv-text').innerText         = txt;
        document.getElementById('priv-text').style.display     = 'block';
        document.getElementById('priv-edit').style.display     = 'none';
        document.getElementById('priv-btn-edit').style.display = 'block';
        document.getElementById('priv-btn-save').style.display = 'none';
        showToast('Сохранено!');
    };
}
