// ============================================================
//  js/releases.js — Релизы: список, просмотр, эпизоды, лайки
// ============================================================

import {
    collection, getDocs, getDoc, doc, addDoc,
    updateDoc, deleteDoc, query, orderBy, increment
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast, closeModals, navigate } from './core.js';
import { PLACEHOLDER_IMG } from '../config/config.js';
import { loadComments } from './comments.js';

export let allRel  = [];
export let curProj = null;

// ── Загрузка всех релизов ──
}
--//


// ── Открытие карточки релиза ──
export async function openView(db, auth, id, userData, isAdmin) {
    const snap = await getDoc(doc(db, 'releases', id));
    if (!snap.exists()) return showToast('Релиз не найден', 'error');
    curProj = { id, ...snap.data() };
    const idx = allRel.findIndex(x => x.id === id);
    if (idx >= 0) allRel[idx] = curProj;
    navigate('view');
    if (userData) {
        updateDoc(doc(db, 'releases', id), { views: increment(1) });
        updateDoc(doc(db, 'users', auth.currentUser.uid), { views: increment(1) });
    }
    document.getElementById('v-info').innerHTML = `
        <div class="view-header">
            <img src="${esc(curProj.img)}" class="v-poster" onerror="this.src='${PLACEHOLDER_IMG}'">
            <div style="flex:1;">
                <h1 class="view-title">${esc(curProj.title)}</h1>
                <p style="color:var(--text-dim); margin-bottom:12px; font-size:14px;">${esc(curProj.year)} • ${esc(curProj.genre)}</p>
                <p style="font-size:13px; line-height:1.6; margin-bottom:14px; color:#ddd;">${esc(curProj.desc)}</p>
                <div style="font-size:12px; color:var(--text-dim);">
                    <b>Авторы:</b> ${esc(curProj.authors)}<br>
                    <b style="color:var(--accent);">Озвучка:</b> ${esc(curProj.voiceover)}
                </div>
                ${isAdmin ? `<button class="btn btn-blue" style="margin-top:14px;" onclick="document.getElementById('m-ep').style.display='flex'"><i class="fas fa-plus"></i> Добавить медиа</button>` : ''}
            </div>
        </div>`;
    updateLikesUI(auth, userData);
    renderEps(db, isAdmin);
    loadComments(db, auth, curProj, userData, isAdmin);
}

// ── Эпизоды ──
export function renderEps(db, isAdmin) {
    const list = document.getElementById('v-ep-list');
    const eps  = curProj.episodes || [];
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
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px; position:relative;">
            ${isAdmin ? `<button class="btn-sm" style="background:red; position:absolute; top:-8px; right:-8px; z-index:10; border-radius:50%; width:18px; height:18px; font-size:9px; display:flex; align-items:center; justify-content:center;" onclick="delEp(${i})">×</button>` : ''}
            <button class="ep-btn" onclick="playEp('${esc(ep.url)}', this, '${esc(ep.title||'')}')">${esc(ep.name)}</button>
        </div>`).join('');
    const firstBtn = list.querySelector('.ep-btn');
    if (firstBtn) playEp(eps[0].url, firstBtn, eps[0].title || '');
}
window.renderEps = renderEps;

window.saveEp = async function(db, curProj) {
    const ep = {
        type:  document.getElementById('ad-ep-type').value,
        name:  document.getElementById('ad-ep-name').value,
        title: document.getElementById('ad-ep-title').value,
        url:   document.getElementById('ad-ep-url').value
    };
    if (!ep.name || !ep.url) return showToast('Заполните название и URL!', 'error');
    const eps = [...(curProj.episodes||[])];
    eps.push(ep);
    await updateDoc(doc(db,'releases',curProj.id), { episodes: eps });
    curProj.episodes = eps;
    closeModals(); renderEps(db, false); showToast('Медиа добавлено!');
    ['ad-ep-name','ad-ep-title','ad-ep-url'].forEach(id => document.getElementById(id).value = '');
};

window.delEp = async function(db, curProj, idx) {
    if (!confirm('Удалить медиа?')) return;
    curProj.episodes.splice(idx,1);
    await updateDoc(doc(db,'releases',curProj.id), { episodes: curProj.episodes });
    renderEps(db, true); showToast('Удалено');
};

window.playEp = function(url, btn, epTitle) {
    if (!url) return;
    let src = url;
    if (url.includes('drive.google.com'))    src = url.replace(/\/view.*$/,'/preview');
    else if (url.includes('youtube.com/watch')) src = url.replace('watch?v=','embed/');
    else if (url.includes('youtu.be/'))      src = url.replace('youtu.be/','youtube.com/embed/');
    document.getElementById('v-iframe').src = src;
    document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active-ep'));
    if (btn) btn.classList.add('active-ep');
    const titleEl = document.getElementById('v-current-ep-title');
    if (epTitle?.trim()) { titleEl.innerText = epTitle; titleEl.style.display = 'block'; }
    else titleEl.style.display = 'none';
};

// ── CRUD Релизов (только для Admin) ──
export async function openRelModal(db, id = '') {
    document.getElementById('ed-rel-id').value = id;
    if (id) {
        const snap = await getDoc(doc(db,'releases',id));
        const d = snap.data();
        document.getElementById('ad-title').value     = d.title||'';
        document.getElementById('ad-genre').value     = d.genre||'';
        document.getElementById('ad-year').value      = d.year||'';
        document.getElementById('ad-voiceover').value = d.voiceover||'';
        document.getElementById('ad-authors').value   = d.authors||'';
        document.getElementById('ad-img').value       = d.img||'';
        document.getElementById('ad-desc').value      = d.desc||'';
    } else {
        ['ad-title','ad-year','ad-voiceover','ad-authors','ad-img','ad-desc'].forEach(i => document.getElementById(i).value = '');
    }
    document.getElementById('m-rel').style.display = 'flex';
}
window.openRelModal = openRelModal;

export async function saveRel(db) {
    const id   = document.getElementById('ed-rel-id').value;
    const data = {
        title:     document.getElementById('ad-title').value,
        genre:     document.getElementById('ad-genre').value,
        year:      document.getElementById('ad-year').value,
        voiceover: document.getElementById('ad-voiceover').value,
        authors:   document.getElementById('ad-authors').value,
        img:       document.getElementById('ad-img').value,
        desc:      document.getElementById('ad-desc').value,
        timestamp: Date.now()
    };
    if (!id) await addDoc(collection(db,'releases'), data);
    else     await updateDoc(doc(db,'releases',id), data);
    closeModals(); loadReleases(db); showToast('Релиз сохранён!');
}
window.saveRel = saveRel;

export async function deleteRel(db, id) {
    if (!confirm('Удалить релиз?')) return;
    await deleteDoc(doc(db,'releases',id));
    loadReleases(db); showToast('Удалено');
}
window.deleteRel = deleteRel;

// ── Политика конфиденциальности ──
export async function openPrivacy(db, isAdmin) {
    const snap = await getDoc(doc(db,'settings','privacy'));
    document.getElementById('priv-text').innerText = snap.exists() ? snap.data().text : 'Текст не добавлен.';
    document.getElementById('priv-adm-btns').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('m-privacy').style.display = 'flex';
}

window.savePriv = async function(db) {
    const txt = document.getElementById('priv-edit').value;
    await setDoc(doc(db,'settings','privacy'), { text: txt });
    document.getElementById('priv-text').innerText       = txt;
    document.getElementById('priv-text').style.display   = 'block';
    document.getElementById('priv-edit').style.display   = 'none';
    document.getElementById('priv-btn-edit').style.display = 'block';
    document.getElementById('priv-btn-save').style.display = 'none';
    showToast('Сохранено!');
};
