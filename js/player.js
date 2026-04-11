// ============================================================
//  js/player.js — SWS Player v2
//  ▸ Кнопка △ → меню (серии, качество, субтитры, авто-функции)
//  ▸ Тайминги в минутах (мм:сс), конвертируются в секунды
//  ▸ Google Drive: нативный плеер Drive (без лишних iframe params)
//  ▸ YouTube: embed с управлением
// ============================================================

// ── Конфигурация — редактируйте здесь ──
export const PLAYER_CONFIG = {
    controlsTimeout: 3000,    // мс до скрытия UI
    seekStep:        10,      // секунд для перемотки
    accentColor:     'var(--accent)',
};

// ── Утилиты: конвертация мм:сс ↔ секунды ──
export function minsToSec(val) {
    if (!val && val !== 0) return 0;
    const s = String(val).trim();
    if (s.includes(':')) {
        const [m, sec] = s.split(':').map(Number);
        return (m || 0) * 60 + (sec || 0);
    }
    // Если передано просто число — считаем что это уже секунды
    return parseFloat(s) || 0;
}

export function secToMins(sec) {
    if (!sec || sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function getYtVideoId(url) {
    if (!url) return '';
    try {
        if (url.includes('youtube.com/watch'))  return new URL(url).searchParams.get('v') || '';
        if (url.includes('youtu.be/'))          return url.split('youtu.be/')[1]?.split('?')[0] || '';
        if (url.includes('youtube.com/embed/')) return url.split('youtube.com/embed/')[1]?.split('?')[0] || '';
    } catch(e) {}
    return '';
}

export function buildEmbedSrc(url, startSec = 0) {
    if (!url) return '';
    const ytId = getYtVideoId(url);
    if (ytId) {
        const start = startSec > 0 ? `&start=${Math.floor(startSec)}` : '';
        // enablejsapi=1 нужен для postMessage управления
        return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1${start}`;
    }
    if (url.includes('drive.google.com')) {
        // ТОЛЬКО /preview — без лишних параметров (CSP Drive блокирует остальное)
        const base = url.replace(/\/view.*$/, '/preview');
        return base;
    }
    return url;
}

// ── Состояние КАЖДОГО плеера хранится в его контейнере ──
function getPlayerState(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return {};
    if (!el._swsState) {
        el._swsState = {
            isDrive: false, isYoutube: false,
            menuOpen: false, controlsTimer: null,
            autoSkip: false, autoNext: false,
            episodes: [], currentIdx: 0,
            onNext: null, onSkip: null,
        };
    }
    return el._swsState;
}

// ══════════════════════════════════════════════════════════════
//  initPlayer — создаёт плеер в контейнере
// ══════════════════════════════════════════════════════════════
export function initPlayer(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const {
        url = '', title = '', muted = false,
        episodes = [],    // массив серий для меню
        currentIdx = 0,
        autoSkip = false, autoNext = false,
        onNext = null, onSkip = null,
        isTrailer = false,
    } = options;

    const st = getPlayerState(containerId);
    st.isDrive   = !getYtVideoId(url) && url.includes('drive.google.com');
    st.isYoutube = !!getYtVideoId(url);
    st.episodes  = episodes;
    st.currentIdx = currentIdx;
    st.autoSkip  = autoSkip;
    st.autoNext  = autoNext;
    st.onNext    = onNext;
    st.onSkip    = onSkip;

    const src = buildEmbedSrc(url);

    container.innerHTML = buildHTML(containerId, src, title, st.isDrive, st.isYoutube, muted, episodes, currentIdx, isTrailer);
    attachEvents(containerId);
}

// ── HTML плеера ──
function buildHTML(containerId, src, title, isDrive, isYoutube, muted, episodes, currentIdx, isTrailer) {
    const mutedAttr  = muted ? '&mute=1' : '';
    const finalSrc   = isDrive ? src : (src + (muted ? '&mute=1' : ''));

    return `
<div class="swsp" id="swsp-${containerId}">
    <!-- IFRAME -->
    <iframe class="swsp-iframe" id="swsp-iframe-${containerId}"
        src="${finalSrc}"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen frameborder="0"
        title="${title}"></iframe>

    <!-- Оверлей (показывается при клике/наведении) -->
    <div class="swsp-overlay" id="swsp-ov-${containerId}">

        <!-- Заголовок сверху -->
        ${title ? `<div class="swsp-top"><span class="swsp-title">${title}</span></div>` : ''}

        <!-- Зона клика посередине -->
        <div class="swsp-midzone" id="swsp-mid-${containerId}"></div>

        <!-- Нижняя панель управления -->
        <div class="swsp-controls" id="swsp-ctrl-${containerId}">
            <div class="swsp-ctrl-row">
                <!-- Drive: только ссылка -->
                ${isDrive ? `
                <a class="swsp-btn" href="${src}" target="_blank" title="Открыть в Drive">
                    <i class="fas fa-external-link-alt"></i>
                </a>
                <span class="swsp-drive-hint">Drive — управление внутри</span>
                ` : `
                <button class="swsp-btn" id="swsp-mute-${containerId}" title="Звук">
                    <i class="fas fa-${muted ? 'volume-mute' : 'volume-up'}"></i>
                </button>
                `}
                <div style="flex:1"></div>

                <!-- Кнопка △ меню -->
                ${!isTrailer ? `
                <button class="swsp-btn swsp-menu-btn" id="swsp-menu-btn-${containerId}"
                        title="Меню плеера" onclick="swspToggleMenu('${containerId}')">
                    <i class="fas fa-chevron-up"></i>
                </button>` : ''}

                <!-- Полный экран -->
                <button class="swsp-btn" id="swsp-fs-btn-${containerId}" title="Полный экран">
                    <i class="fas fa-expand" id="swsp-fs-icon-${containerId}"></i>
                </button>
            </div>
        </div>

        <!-- Кнопки пропуска (показываются по таймингу) -->
        <button class="swsp-skip-btn" id="swsp-skip-${containerId}" style="display:none;">
            <i class="fas fa-forward"></i> Пропустить заставку
        </button>
        <button class="swsp-next-btn" id="swsp-next-${containerId}" style="display:none;">
            Следующая серия <i class="fas fa-step-forward"></i>
        </button>
    </div>

    <!-- Меню (выдвигается снизу) -->
    ${!isTrailer ? `
    <div class="swsp-menu" id="swsp-menu-${containerId}">
        <div class="swsp-menu-header">
            <span class="swsp-menu-title"><i class="fas fa-sliders-h"></i> Настройки</span>
            <button class="swsp-menu-close" onclick="swspToggleMenu('${containerId}')">
                <i class="fas fa-chevron-down"></i>
            </button>
        </div>
        <div class="swsp-menu-body">

            <!-- Переключатели -->
            <div class="swsp-menu-section">
                <div class="swsp-menu-label">Авто-функции</div>
                <label class="swsp-toggle-row" id="swsp-autoskip-row-${containerId}">
                    <div class="swsp-toggle-info">
                        <i class="fas fa-forward" style="color:var(--accent)"></i>
                        <span>Авто-пропуск заставки</span>
                    </div>
                    <div class="swsp-toggle" id="swsp-tog-skip-${containerId}" onclick="swspToggleAutoSkip('${containerId}')">
                        <div class="swsp-toggle-knob"></div>
                    </div>
                </label>
                <label class="swsp-toggle-row" id="swsp-autonext-row-${containerId}">
                    <div class="swsp-toggle-info">
                        <i class="fas fa-step-forward" style="color:var(--accent)"></i>
                        <span>Авто-следующая серия</span>
                    </div>
                    <div class="swsp-toggle" id="swsp-tog-next-${containerId}" onclick="swspToggleAutoNext('${containerId}')">
                        <div class="swsp-toggle-knob"></div>
                    </div>
                </label>
            </div>

            <!-- Список серий -->
            ${episodes.length > 1 ? `
            <div class="swsp-menu-section">
                <div class="swsp-menu-label">Серии</div>
                <div class="swsp-ep-list" id="swsp-ep-list-${containerId}">
                    ${episodes.map((ep, i) => `
                    <button class="swsp-ep-btn ${i === currentIdx ? 'active' : ''}"
                            onclick="swspSelectEp('${containerId}', ${i})">
                        <span class="swsp-ep-num">${i + 1}</span>
                        <span class="swsp-ep-name">${ep.name || `Серия ${i + 1}`}</span>
                        ${i === currentIdx ? '<i class="fas fa-play" style="color:var(--accent);font-size:10px;margin-left:auto;"></i>' : ''}
                    </button>`).join('')}
                </div>
            </div>` : ''}
        </div>
    </div>` : ''}
</div>`;
}

// ── Привязка событий ──
function attachEvents(containerId) {
    const root   = document.getElementById(`swsp-${containerId}`);
    const overlay= document.getElementById(`swsp-ov-${containerId}`);
    const mid    = document.getElementById(`swsp-mid-${containerId}`);
    const fsBtn  = document.getElementById(`swsp-fs-btn-${containerId}`);
    const fsIcon = document.getElementById(`swsp-fs-icon-${containerId}`);
    const muteBtn= document.getElementById(`swsp-mute-${containerId}`);
    const iframe = document.getElementById(`swsp-iframe-${containerId}`);
    const st     = getPlayerState(containerId);

    // Показать/скрыть оверлей
    function showOverlay() {
        if (!overlay) return;
        overlay.classList.add('swsp-ov--active');
        clearTimeout(st.controlsTimer);
        st.controlsTimer = setTimeout(() => {
            if (!st.menuOpen) overlay.classList.remove('swsp-ov--active');
        }, PLAYER_CONFIG.controlsTimeout);
    }

    if (overlay) {
        overlay.addEventListener('mousemove', showOverlay);
        overlay.addEventListener('touchstart', showOverlay, { passive: true });
    }
    if (mid) mid.addEventListener('click', showOverlay);

    // Fullscreen
    if (fsBtn && root) {
        fsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                root.requestFullscreen?.() || root.webkitRequestFullscreen?.();
                if (fsIcon) fsIcon.className = 'fas fa-compress';
            } else {
                document.exitFullscreen?.() || document.webkitExitFullscreen?.();
                if (fsIcon) fsIcon.className = 'fas fa-expand';
            }
        });
    }

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && fsIcon) fsIcon.className = 'fas fa-expand';
    });

    // Mute (YouTube через postMessage)
    if (muteBtn && iframe && st.isYoutube) {
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const icon = muteBtn.querySelector('i');
            const isMuted = icon?.classList.contains('fa-volume-mute');
            ytMsg(iframe, isMuted ? 'unMute' : 'mute');
            if (icon) icon.className = isMuted ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        });
    }

    // Кнопки пропуска
    const skipBtn = document.getElementById(`swsp-skip-${containerId}`);
    const nextBtn = document.getElementById(`swsp-next-${containerId}`);
    if (skipBtn) skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        skipBtn.style.display = 'none';
        if (st.onSkip) st.onSkip();
    });
    if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        nextBtn.style.display = 'none';
        if (st.onNext) st.onNext();
    });
}

function ytMsg(iframe, cmd, args = []) {
    try {
        iframe?.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: cmd, args }),
            '*'
        );
    } catch(e) {}
}

// ── Меню △ ──
window.swspToggleMenu = (containerId) => {
    const menu = document.getElementById(`swsp-menu-${containerId}`);
    const btn  = document.getElementById(`swsp-menu-btn-${containerId}`);
    const ov   = document.getElementById(`swsp-ov-${containerId}`);
    const st   = getPlayerState(containerId);
    if (!menu) return;
    st.menuOpen = !st.menuOpen;
    menu.classList.toggle('swsp-menu--open', st.menuOpen);
    if (btn) {
        btn.classList.toggle('swsp-menu-btn--active', st.menuOpen);
        btn.querySelector('i').className = st.menuOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
    }
    // При открытии меню — оверлей остаётся видимым
    if (ov) ov.classList.toggle('swsp-ov--active', true);
};

window.swspToggleAutoSkip = (containerId) => {
    const st  = getPlayerState(containerId);
    const tog = document.getElementById(`swsp-tog-skip-${containerId}`);
    st.autoSkip = !st.autoSkip;
    tog?.classList.toggle('swsp-toggle--on', st.autoSkip);
    // Синхронизируем с чекбоксами вне плеера (если есть)
    const cb = document.getElementById('ps-autoskip');
    if (cb) cb.checked = st.autoSkip;
    if (window.updatePlayerSettings) window.updatePlayerSettings();
};

window.swspToggleAutoNext = (containerId) => {
    const st  = getPlayerState(containerId);
    const tog = document.getElementById(`swsp-tog-next-${containerId}`);
    st.autoNext = !st.autoNext;
    tog?.classList.toggle('swsp-toggle--on', st.autoNext);
    const cb = document.getElementById('ps-autonext');
    if (cb) cb.checked = st.autoNext;
    if (window.updatePlayerSettings) window.updatePlayerSettings();
};

window.swspSelectEp = (containerId, idx) => {
    // Закрываем меню
    swspToggleMenu(containerId);
    // Переключаем серию через releases.js
    if (window.playEpByIdxGlobal) window.playEpByIdxGlobal(idx);
};

// ── API ──

/** Загрузить новый URL в существующий плеер */
export function playerLoad(containerId, url, title = '', startSec = 0) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const iframe = container.querySelector(`#swsp-iframe-${containerId}`);
    if (!iframe) { initPlayer(containerId, { url, title }); return; }

    const st = getPlayerState(containerId);
    st.isDrive   = !getYtVideoId(url) && url.includes('drive.google.com');
    st.isYoutube = !!getYtVideoId(url);

    iframe.src = buildEmbedSrc(url, startSec);
    const titleEl = container.querySelector('.swsp-title');
    if (titleEl && title) titleEl.textContent = title;
}

/** Обновить список серий в меню */
export function playerUpdateEpisodes(containerId, episodes, currentIdx) {
    const st = getPlayerState(containerId);
    st.episodes   = episodes;
    st.currentIdx = currentIdx;
    const listEl = document.getElementById(`swsp-ep-list-${containerId}`);
    if (!listEl) return;
    listEl.innerHTML = episodes.map((ep, i) => `
        <button class="swsp-ep-btn ${i === currentIdx ? 'active' : ''}"
                onclick="swspSelectEp('${containerId}', ${i})">
            <span class="swsp-ep-num">${i + 1}</span>
            <span class="swsp-ep-name">${ep.name || `Серия ${i + 1}`}</span>
            ${i === currentIdx ? '<i class="fas fa-play" style="color:var(--accent);font-size:10px;margin-left:auto;"></i>' : ''}
        </button>`).join('');
}

/** Показать кнопку «Пропустить заставку» */
export function playerShowSkip(containerId, onSkip) {
    const st  = getPlayerState(containerId);
    const btn = document.getElementById(`swsp-skip-${containerId}`);
    if (!btn) return;
    st.onSkip = onSkip;
    btn.style.display = 'flex';
}

export function playerHideSkip(containerId) {
    const btn = document.getElementById(`swsp-skip-${containerId}`);
    if (btn) btn.style.display = 'none';
}

/** Показать кнопку «Следующая серия» */
export function playerShowNext(containerId, onNext) {
    const st  = getPlayerState(containerId);
    const btn = document.getElementById(`swsp-next-${containerId}`);
    if (!btn) return;
    st.onNext = onNext;
    btn.style.display = 'flex';
}

export function playerHideNext(containerId) {
    const btn = document.getElementById(`swsp-next-${containerId}`);
    if (btn) btn.style.display = 'none';
}

export function playerHideAllOverlays(containerId) {
    playerHideSkip(containerId);
    playerHideNext(containerId);
}

/** Скип в позицию (YouTube — перезагрузка iframe с start=) */
export function playerSeekTo(containerId, seconds) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const iframe = container.querySelector(`#swsp-iframe-${containerId}`);
    if (!iframe) return;
    const st = getPlayerState(containerId);
    if (st.isYoutube) {
        const base = iframe.src.replace(/[?&]start=\d+/, '');
        iframe.src = base + `&start=${Math.floor(seconds)}`;
    }
    // Drive: нельзя перемотать через iframe
}

/** Синхронизировать состояние автофункций с плеером */
export function playerSyncSettings(containerId, autoSkip, autoNext) {
    const st = getPlayerState(containerId);
    st.autoSkip = autoSkip;
    st.autoNext = autoNext;
    document.getElementById(`swsp-tog-skip-${containerId}`)?.classList.toggle('swsp-toggle--on', autoSkip);
    document.getElementById(`swsp-tog-next-${containerId}`)?.classList.toggle('swsp-toggle--on', autoNext);
}
