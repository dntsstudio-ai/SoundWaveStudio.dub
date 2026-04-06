// ============================================================
//  js/comments.js — Комментарии к релизам
// ============================================================

import {
    collection, getDocs, addDoc, deleteDoc,
    doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { esc, showToast } from './core.js';

// ── Загрузка комментариев ──
export async function loadComments(db, auth, curProj, userData, isAdmin) {
    const snap = await getDocs(
        query(collection(db, `releases/${curProj.id}/comments`), orderBy('time', 'desc'))
    );
    document.getElementById('comm-count').innerText = snap.size;
    document.getElementById('comm-list').innerHTML = snap.docs.map(d => {
        const c = d.data();
        // Заменяем @упоминания на ссылки
        const text = esc(c.text).replace(/@([\wа-яА-ЯёЁ]+)/g,
            `<a href="#" class="mention-link" onclick="openUserProfileByName('$1'); return false;">@$1</a>`);
        const canDelete = isAdmin || (userData && c.uid === auth.currentUser?.uid);
        return `<div class="comm-item">
            <img src="${esc(c.ava) || 'https://api.dicebear.com/7.x/identicon/svg'}"
                 class="comm-ava" style="cursor:pointer;" onclick="openUserProfile('${c.uid}')">
            <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:5px;">
                    <b style="font-size:14px;cursor:pointer;" onclick="openUserProfile('${c.uid}')">${esc(c.nick)}</b>
                    <span style="font-size:10px;color:var(--text-dim);">${new Date(c.time).toLocaleString()}</span>
                </div>
                <p style="font-size:13px;margin-top:5px;word-break:break-word;line-height:1.5;">${text}</p>
                ${canDelete ? `<button class="btn-sm" style="background:transparent;color:red;margin-top:5px;padding:0;"
                    onclick="delComm('${d.id}')">Удалить</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Привязка функций комментариев ──
export function bindComments(db, auth, getState) {

    window.sendComment = async () => {
        const { curProj, userData } = getState();
        if (!curProj || !userData) return;
        const txt = document.getElementById('comm-text').value.trim();
        if (!txt) return;
        await addDoc(collection(db, `releases/${curProj.id}/comments`), {
            uid: auth.currentUser.uid,
            nick: userData.nickname,
            ava:  userData.avatar || '',
            text: txt,
            time: Date.now()
        });
        document.getElementById('comm-text').value = '';
        const { isAdmin } = getState();
        await loadComments(db, auth, curProj, userData, isAdmin);
        showToast('Комментарий отправлен!');
    };

    window.delComm = async (id) => {
        if (!confirm('Удалить комментарий?')) return;
        const { curProj, userData, isAdmin } = getState();
        await deleteDoc(doc(db, `releases/${curProj.id}/comments`, id));
        await loadComments(db, auth, curProj, userData, isAdmin);
        showToast('Удалено');
    };
}
