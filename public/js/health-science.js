let videos = [];
let currentIndex = 0;
let wheelLocked = false;
let wheelTimer = null;
let currentPlaybackRate = 1;
let sessionLoggedIn = false;
let sessionUsername = '';
let commentPanelOpen = false;
let commentCount = 0;
let videoLiked = false;
let videoFavorited = false;

const PLAYBACK_RATES = [1, 1.5, 2, 2.5, 3, 4];

window.onload = async () => {
  initTabs();
  initPromoCards();
  initSpeedMenu();
  initComments();
  initVideoActions();
  await initSession();
  await loadVideos();
  bindWheel();
  handlePageHash();
};

async function initSession() {
  try {
    const res = await fetch('/api/session', { credentials: 'include' });
    const data = await res.json();
    if (data.loggedIn) {
      sessionLoggedIn = true;
      sessionUsername = data.username || '用户';
      updateHeaderForLoggedIn(sessionUsername);
      showCommentForm(true);
    } else {
      showCommentForm(false);
    }
  } catch (e) {
    showCommentForm(false);
  }
}

function updateHeaderForLoggedIn(username) {
  const right = document.getElementById('hsHeaderRight');
  if (!right) return;
  right.innerHTML = `
    <span style="color:rgba(255,255,255,0.9);font-size:14px;margin-right:4px">你好，${escapeHtml(username)}</span>
    <a href="/pages/dashboard.html" class="btn-home-register">进入个人中心</a>
    <a href="/api/logout" class="btn-home-login">退出</a>
  `;
}

function initVideoActions() {
  document.getElementById('videoLikeBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleVideoFavorite('like');
  });
  document.getElementById('videoFavoriteBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleVideoFavorite('favorite');
  });
}

async function loadFavoriteStatus() {
  const likeBtn = document.getElementById('videoLikeBtn');
  const favBtn = document.getElementById('videoFavoriteBtn');
  const videoKey = getCurrentVideoKey();

  if (!sessionLoggedIn || !videoKey) {
    videoLiked = false;
    videoFavorited = false;
    likeBtn.classList.remove('active');
    favBtn.classList.remove('active');
    return;
  }

  try {
    const res = await fetch('/api/video-favorites/status?videoKey=' + encodeURIComponent(videoKey), {
      credentials: 'include'
    });
    const data = await res.json();
    if (data.success) {
      videoLiked = data.liked;
      videoFavorited = data.favorited;
      likeBtn.classList.toggle('active', videoLiked);
      favBtn.classList.toggle('active', videoFavorited);
    }
  } catch (e) {
    /* 忽略 */
  }
}

async function toggleVideoFavorite(type) {
  if (!sessionLoggedIn) {
    if (confirm('请先登录后再操作，是否前往登录？')) {
      location.href = '/pages/login.html';
    }
    return;
  }

  const videoKey = getCurrentVideoKey();
  const video = videos[currentIndex];
  if (!videoKey) return;

  try {
    const res = await fetch('/api/video-favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        videoKey,
        type,
        title: video.title
      })
    });
    const data = await res.json();
    if (!data.success) {
      if (res.status === 401) {
        alert('请先登录');
        location.href = '/pages/login.html';
      } else {
        alert(data.message || '操作失败');
      }
      return;
    }
    if (type === 'like') {
      videoLiked = data.active;
      document.getElementById('videoLikeBtn').classList.toggle('active', videoLiked);
    } else {
      videoFavorited = data.active;
      document.getElementById('videoFavoriteBtn').classList.toggle('active', videoFavorited);
    }
  } catch (e) {
    alert('操作失败，请重试');
  }
}

function initComments() {
  const btn = document.getElementById('videoCommentBtn');
  const closeBtn = document.getElementById('commentPanelClose');
  const backdrop = document.getElementById('commentBackdrop');
  const form = document.getElementById('commentForm');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCommentPanel();
  });
  closeBtn.addEventListener('click', closeCommentPanel);
  backdrop.addEventListener('click', closeCommentPanel);
  form.addEventListener('submit', submitComment);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && commentPanelOpen) closeCommentPanel();
  });
}

function toggleCommentPanel() {
  if (commentPanelOpen) closeCommentPanel();
  else openCommentPanel();
}

function openCommentPanel() {
  commentPanelOpen = true;
  document.getElementById('videoCommentPanel').classList.add('open');
  document.getElementById('videoCommentPanel').setAttribute('aria-hidden', 'false');
  document.getElementById('commentBackdrop').classList.add('show');
  loadComments();
}

function closeCommentPanel() {
  commentPanelOpen = false;
  document.getElementById('videoCommentPanel').classList.remove('open');
  document.getElementById('videoCommentPanel').setAttribute('aria-hidden', 'true');
  document.getElementById('commentBackdrop').classList.remove('show');
}

function showCommentForm(loggedIn) {
  document.getElementById('commentLoginHint').style.display = loggedIn ? 'none' : 'block';
  document.getElementById('commentForm').style.display = loggedIn ? 'flex' : 'none';
}

function getCurrentVideoKey() {
  if (!videos.length) return null;
  return videos[currentIndex].key || null;
}

async function loadComments() {
  const videoKey = getCurrentVideoKey();
  const listEl = document.getElementById('commentList');
  if (!videoKey) {
    listEl.innerHTML = '<p class="comment-empty">暂无评论</p>';
    updateCommentCountDisplay(0);
    return;
  }

  listEl.innerHTML = '<p class="comment-empty">加载中...</p>';

  try {
    const res = await fetch('/api/video-comments?videoKey=' + encodeURIComponent(videoKey));
    const data = await res.json();
    if (!data.success) {
      listEl.innerHTML = '<p class="comment-empty">加载失败</p>';
      return;
    }
    renderComments(data.comments);
    updateCommentCountDisplay(data.comments.length);
  } catch (e) {
    listEl.innerHTML = '<p class="comment-empty">加载失败</p>';
  }
}

function renderComments(comments) {
  const listEl = document.getElementById('commentList');
  if (!comments.length) {
    listEl.innerHTML = '<p class="comment-empty">暂无评论，快来抢沙发吧</p>';
    return;
  }

  listEl.innerHTML = comments.map(c => `
    <div class="comment-item">
      <div class="comment-item-header">
        <span class="comment-item-user">${escapeHtml(c.username)}</span>
        <span class="comment-item-time">${formatCommentTime(c.createdAt)}</span>
      </div>
      <p class="comment-item-content">${escapeHtml(c.content)}</p>
    </div>
  `).join('');
}

function updateCommentCountDisplay(count) {
  commentCount = count;
  const text = count > 0 ? String(count) : '';
  document.getElementById('commentBtnCount').textContent = text;
  document.getElementById('commentPanelCount').textContent = count > 0 ? `(${count})` : '';
}

function formatCommentTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function submitComment(e) {
  e.preventDefault();
  const videoKey = getCurrentVideoKey();
  const input = document.getElementById('commentInput');
  const content = input.value.trim();
  const btn = e.target.querySelector('.btn-comment-submit');

  if (!videoKey || !content) return;

  btn.disabled = true;
  try {
    const res = await fetch('/api/video-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ videoKey, content })
    });
    const data = await res.json();
    if (!data.success) {
      if (res.status === 401) {
        alert('请先登录后再评论');
        location.href = '/pages/login.html';
      } else {
        alert(data.message || '发表失败');
      }
      return;
    }
    input.value = '';
    await loadComments();
  } catch (err) {
    alert('发表失败，请重试');
  } finally {
    btn.disabled = false;
  }
}

function configureVideoElement(video) {
  video.controls = false;
  video.disablePictureInPicture = true;
  video.setAttribute('disablepictureinpicture', '');
  video.setAttribute('disableremoteplayback', '');
  video.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
}

function initPromoCards() {
  document.querySelectorAll('.promo-card.clickable').forEach(card => {
    card.addEventListener('click', () => openPromoModal(card.dataset.promoId));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPromoModal(card.dataset.promoId);
      }
    });
  });

  document.getElementById('promoModalClose').addEventListener('click', closePromoModal);
  document.getElementById('promoModal').addEventListener('click', (e) => {
    if (e.target.id === 'promoModal') closePromoModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePromoModal();
  });
}

function handlePageHash() {
  const promoMatch = location.hash.match(/^#promo\/(\w+)$/);
  if (promoMatch) {
    switchTab('promo');
    setTimeout(() => openPromoModal(promoMatch[1]), 100);
    return;
  }

  const videoMatch = location.hash.match(/^#video\/(.+)$/);
  if (videoMatch && videos.length) {
    const videoKey = decodeURIComponent(videoMatch[1]);
    const idx = videos.findIndex(v => v.key === videoKey);
    if (idx >= 0) {
      switchTab('video');
      currentIndex = idx;
      document.querySelectorAll('.video-slide').forEach((s, i) => {
        s.classList.toggle('active', i === currentIndex);
        const icon = s.querySelector('.video-pause-icon');
        if (icon) icon.classList.remove('show');
      });
      updateCounter();
      playCurrentVideo();
      loadComments();
      loadFavoriteStatus();
    }
  }
}

function openPromoModal(id) {
  const article = PROMO_ARTICLES.find(a => a.id === id);
  if (!article) return;

  document.getElementById('promoModalTitle').textContent = article.title;

  const body = document.getElementById('promoModalBody');
  body.innerHTML = article.sections.map(section => {
    let content = '';
    if (section.body) {
      content = `<p>${escapeHtml(section.body)}</p>`;
    }
    if (section.list) {
      content += '<ul>' + section.list.map(item => `<li>${escapeHtml(item)}</li>`).join('') + '</ul>';
    }
    return `<div class="promo-detail-section"><h4>${escapeHtml(section.heading)}</h4>${content}</div>`;
  }).join('');

  if (article.linkVideo) {
    body.innerHTML += `<a href="javascript:void(0)" class="promo-modal-link" onclick="closePromoModal();switchTab('video')">→ 前往观看健康科普视频</a>`;
  }

  document.getElementById('promoModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  location.hash = `promo/${id}`;
}

function closePromoModal() {
  document.getElementById('promoModal').classList.remove('show');
  document.body.style.overflow = '';
  if (location.hash.startsWith('#promo/')) {
    history.replaceState(null, '', location.pathname + location.search + '#promo');
  }
}

function initTabs() {
  const hash = location.hash.replace('#', '');
  const defaultTab = (hash === 'promo' || hash.startsWith('promo/')) ? 'promo' : 'video';

  document.querySelectorAll('.hs-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  switchTab(defaultTab);
}

function switchTab(name) {
  document.querySelectorAll('.hs-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.hs-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${name}`);
  });

  if (name === 'video') {
    playCurrentVideo();
  } else {
    pauseAllVideos();
  }
}

async function loadVideos() {
  const feed = document.getElementById('videoFeed');
  feed.innerHTML = '<div class="video-loading">加载视频中...</div>';

  try {
    const res = await fetch('/api/health-videos');
    const data = await res.json();
    if (!data.success || !data.videos.length) {
      feed.innerHTML = '<div class="video-loading">暂无科普视频</div>';
      return;
    }
    videos = data.videos;
    renderVideos();
  } catch (e) {
    feed.innerHTML = '<div class="video-loading">加载失败，请刷新重试</div>';
  }
}

function renderVideos() {
  const feed = document.getElementById('videoFeed');

  feed.innerHTML = '';

  videos.forEach((v, i) => {
    const slide = document.createElement('div');
    slide.className = 'video-slide' + (i === 0 ? ' active' : '');
    slide.dataset.index = i;
    slide.innerHTML = `
      <video playsinline preload="metadata" src="${v.src}"></video>
      <div class="video-pause-icon" aria-hidden="true">▶</div>
      <div class="video-overlay">
        <h3>${escapeHtml(v.title)}</h3>
        <p>${escapeHtml(v.desc)}</p>
      </div>
    `;
    const video = slide.querySelector('video');
    const pauseIcon = slide.querySelector('.video-pause-icon');
    configureVideoElement(video);

    video.addEventListener('ended', () => onVideoEnded());
    video.addEventListener('click', () => {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
    video.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showSpeedMenu(e.clientX, e.clientY);
    });
    video.addEventListener('play', () => {
      pauseIcon.classList.remove('show');
    });
    video.addEventListener('pause', () => {
      if (slide.classList.contains('active')) {
        pauseIcon.classList.add('show');
      }
    });

    feed.appendChild(slide);
  });

  updateCounter();
  playCurrentVideo();
  loadComments();
  loadFavoriteStatus();
}

function initSpeedMenu() {
  const menu = document.getElementById('speedMenu');
  menu.querySelectorAll('button[data-rate]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setPlaybackRate(parseFloat(btn.dataset.rate));
    });
  });

  document.addEventListener('click', () => hideSpeedMenu());
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('#speedMenu') && !e.target.closest('.video-slide video')) {
      hideSpeedMenu();
    }
  });
}

function showSpeedMenu(x, y) {
  const menu = document.getElementById('speedMenu');
  menu.style.display = 'block';
  menu.style.visibility = 'hidden';
  menu.style.left = '0';
  menu.style.top = '0';

  menu.querySelectorAll('button[data-rate]').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.rate) === currentPlaybackRate);
  });

  const rect = menu.getBoundingClientRect();
  let left = x;
  let top = y;
  if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8;
  if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.visibility = 'visible';
}

function hideSpeedMenu() {
  const menu = document.getElementById('speedMenu');
  if (menu) menu.style.display = 'none';
}

function setPlaybackRate(rate) {
  if (!PLAYBACK_RATES.includes(rate)) return;
  currentPlaybackRate = rate;
  const active = document.querySelector('.video-slide.active video');
  if (active) active.playbackRate = rate;
  hideSpeedMenu();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function bindWheel() {
  const wrap = document.getElementById('videoFeedWrap');
  wrap.addEventListener('wheel', (e) => {
    const videoPanel = document.getElementById('panel-video');
    if (!videoPanel.classList.contains('active') || !videos.length) return;

    e.preventDefault();

    if (wheelLocked) return;
    wheelLocked = true;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelLocked = false; }, 500);

    hideSpeedMenu();
    if (e.deltaY > 0) goTo(currentIndex + 1, true);
    else if (e.deltaY < 0) goTo(currentIndex - 1, true);
  }, { passive: false });
}

function goTo(index, wrapAround = false) {
  if (!videos.length) return;

  let next = index;
  if (wrapAround) {
    next = ((index % videos.length) + videos.length) % videos.length;
  } else {
    if (index < 0) next = 0;
    else if (index >= videos.length) next = videos.length - 1;
    else next = index;
  }

  if (next === currentIndex) return;
  currentIndex = next;

  hideSpeedMenu();
  document.querySelectorAll('.video-slide').forEach((s, i) => {
    s.classList.toggle('active', i === currentIndex);
    const icon = s.querySelector('.video-pause-icon');
    if (icon) icon.classList.remove('show');
  });

  updateCounter();
  playCurrentVideo();
  loadComments();
  loadFavoriteStatus();
}

function onVideoEnded() {
  if (currentIndex < videos.length - 1) {
    goTo(currentIndex + 1);
  } else {
    goTo(0);
  }
}

function playCurrentVideo() {
  pauseAllVideos();
  const active = document.querySelector('.video-slide.active video');
  if (active) {
    active.playbackRate = currentPlaybackRate;
    active.currentTime = 0;
    active.play().catch(() => {});
  }
}

function pauseAllVideos() {
  document.querySelectorAll('.video-slide video').forEach(v => {
    v.pause();
  });
}

function updateCounter() {
  const el = document.getElementById('videoCounter');
  if (el && videos.length) {
    el.textContent = `${currentIndex + 1} / ${videos.length}`;
  }
}
