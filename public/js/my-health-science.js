let currentTab = 'like';
let likes = [];
let favorites = [];

window.onload = async () => {
  initTabs();
  await loadData();
};

function initTabs() {
  const hash = location.hash.replace('#', '');
  if (hash === 'favorite') currentTab = 'favorite';

  document.querySelectorAll('.mhs-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  switchTab(currentTab);
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.mhs-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  location.hash = tab;
  renderList();
}

async function loadData() {
  try {
    const sessionRes = await fetch('/api/session', { credentials: 'include' });
    const session = await sessionRes.json();
    if (!session.loggedIn) {
      location.href = '/pages/login.html';
      return;
    }

    const welcomeEl = document.getElementById('welcomeName');
    if (welcomeEl) welcomeEl.textContent = session.username || '用户';

    const res = await fetch('/api/video-favorites', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) {
      document.getElementById('mhsList').innerHTML =
        '<div class="mhs-empty"><p>加载失败，请刷新重试</p></div>';
      return;
    }

    likes = data.likes || [];
    favorites = data.favorites || [];
    renderList();
  } catch (e) {
    location.href = '/pages/login.html';
  }
}

function renderList() {
  const list = currentTab === 'like' ? likes : favorites;
  const listEl = document.getElementById('mhsList');
  const label = currentTab === 'like' ? '喜欢' : '收藏';

  if (!list.length) {
    listEl.innerHTML = `
      <div class="mhs-empty">
        <p>还没有${label}的视频</p>
        <a href="/pages/health-science.html">去健康科普视频页看看 →</a>
      </div>
    `;
    return;
  }

  listEl.innerHTML = list.map(item => {
    const watchUrl = '/pages/health-science.html#video/' + encodeURIComponent(item.videoKey);
    const time = formatTime(item.createdAt);
    return `
      <div class="mhs-card">
        <div class="mhs-card-info">
          <h3>${escapeHtml(item.videoTitle)}</h3>
          <div class="mhs-card-meta">${label}于 ${time}</div>
        </div>
        <a href="${watchUrl}" class="btn btn-primary">去观看</a>
      </div>
    `;
  }).join('');
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function logout() {
  location.href = '/api/logout';
}
