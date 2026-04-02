import {
    collection, getDocs, getDoc, doc, addDoc, setDoc,
    updateDoc, deleteDoc, query, orderBy, increment
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast, closeModals, navigate } from './core.js';
import { loadComments } from './comments.js';

export let allRel  = [];

export async function loadReleases(db) {
    const snap = await getDocs(query(collection(db,'releases'), orderBy('timestamp','desc')));
    allRel = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    filterData();
}

export function filterData() {
    let res = [...allRel];
    const q = document.getElementById('main-search')?.value.toLowerCase() || '';
    const g = document.getElementById('filter-genre')?.value || 'all';
    const s = document.getElementById('filter-sort')?.value || 'new';

    if (q) res = res.filter(r => r.title?.toLowerCase().includes(q));
    if (g !== 'all') res = res.filter(r => r.genre === g);
    if (s === 'pop') res.sort((a,b) => (b.views||0) - (a.views||0));

    const grid = document.getElementById('releases-grid');
    if (!grid) return;
    grid.innerHTML = res.map(r => `
        <div class="rel-card" onclick="openView('${r.id}')">
            <img src="${r.img || 'https://via.placeholder.com/300x450'}" class="rel-img">
            <div class="rel-info">
                <div class="rel-title">${esc(r.title)}</div>
                <div style="font-size:12px; color:var(--text-dim);">${esc(r.genre)} • ${r.year}</div>
            </div>
        </div>
    `).join('');
}

export async function openView(db, auth, id, isAdmin, userData) {
    const snap = await getDoc(doc(db, 'releases', id));
    if (!snap.exists()) return;
    const cur = { id: snap.id, ...snap.data() };

    await updateDoc(doc(db, 'releases', id), { views: increment(1) });

    document.getElementById('v-img').src = cur.img || '';
    document.getElementById('v-title').innerText = cur.title;
    document.getElementById('v-desc').innerText = cur.desc;
    document.getElementById('v-meta').innerText = `${cur.year} • ${cur.genre} • 👀 ${cur.views || 0}`;

    const epCont = document.getElementById('v-episodes');
    epCont.innerHTML = (cur.episodes || []).map((e, i) => `
        <div class="ep-row" onclick="window.open('${e.link}', '_blank')">
            <span>Серия ${i + 1}: ${esc(e.name)}</span>
            <i class="fas fa-play-circle"></i>
        </div>
    `).join('') || '<p>Серии скоро появятся</p>';

    document.getElementById('adm-rel-edit').onclick = () => window.openRelModal(id);
    document.getElementById('adm-rel-edit').style.display = isAdmin ? 'block' : 'none';
    
    loadComments(db, auth, cur, userData, isAdmin);
    navigate('view');
}

// ЭКСПОРТ ДЛЯ УДАЛЕНИЯ
export async function deleteRel(db, id) {
    if (!confirm('Удалить этот релиз навсегда?')) return;
    await deleteDoc(doc(db, 'releases', id));
    showToast('Релиз удален');
    loadReleases(db);
    navigate('home');
}

export async function openPrivacy(db, isAdmin) {
    const snap = await getDoc(doc(db,'settings','privacy'));
    document.getElementById('priv-text').innerText = snap.exists() ? snap.data().text : 'Текст не добавлен.';
    document.getElementById('priv-adm-btns').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('m-privacy').style.display = 'flex';
}
