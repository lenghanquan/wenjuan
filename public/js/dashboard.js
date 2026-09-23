axios.defaults.withCredentials = true;

let allSurveys = [];
let currentFilter = 'all';
let searchKeyword = '';
let bannerIndex = 0;
let bannerTimer = null;
let username = '用户';

window.onload = () => {
  initBanner();
  loadSurveyList();
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim().toLowerCase();
    renderSurveyCards(getFilteredSurveys());
  });
  document.getElementById('searchBtn').addEventListener('click', () => {
    renderSurveyCards(getFilteredSurveys());
  });
};

function initBanner() {
  const slides = document.querySelectorAll('.banner-slide');
  const dots = document.querySelectorAll('.banner-dot');
  if (!slides.length) return;

  function showSlide(i) {
    bannerIndex = i;
    slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
  }

  dots.forEach((dot, i) => dot.addEventListener('click', () => showSlide(i)));
  bannerTimer = setInterval(() => showSlide((bannerIndex + 1) % slides.length), 4000);
}

async function loadSurveyList() {
  try {
    const res = await axios.get('/api/surveys');
    if (!res.data.success) {
      alert('获取评估列表失败：' + (res.data.message || ''));
      return;
    }
    allSurveys = res.data.surveys || [];
    username = res.data.username || '用户';
    updateUserPanel();
    renderSurveyCards(getFilteredSurveys());
  } catch (err) {
    console.error(err);
    location.href = '/pages/login.html';
  }
}

function updateUserPanel() {
  const nameEl = document.getElementById('usernameDisplay');
  const welcomeEl = document.getElementById('welcomeName');
  const avatarEl = document.getElementById('userAvatar');
  if (nameEl) nameEl.textContent = username;
  if (welcomeEl) welcomeEl.textContent = username;
  if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();

  const totalResponses = allSurveys.reduce((sum, s) => sum + (s.responseCount || 0), 0);
  document.getElementById('surveyCount').textContent = allSurveys.length;
  document.getElementById('responseCount').textContent = totalResponses;
}

function setFilter(filter, el) {
  currentFilter = filter;
  document.querySelectorAll('.filter-list li').forEach(li => li.classList.remove('active'));
  el.classList.add('active');
  renderSurveyCards(getFilteredSurveys());
}

function getFilteredSurveys() {
  let list = [...allSurveys];

  if (currentFilter === 'recent') {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    list = list.filter(s => new Date(s.createdAt).getTime() >= weekAgo);
  } else if (currentFilter === 'hasResponse') {
    list = list.filter(s => (s.responseCount || 0) > 0);
  } else if (currentFilter === 'empty') {
    list = list.filter(s => (s.responseCount || 0) === 0);
  }

  if (searchKeyword) {
    list = list.filter(s =>
      s.title.toLowerCase().includes(searchKeyword) ||
      (s.description || '').toLowerCase().includes(searchKeyword)
    );
  }

  return list;
}

function renderSurveyCards(surveys) {
  const container = document.getElementById('surveyList');
  const countEl = document.getElementById('surveyListCount');
  if (countEl) countEl.textContent = surveys.length;

  if (surveys.length === 0) {
    container.innerHTML = '<div class="empty-tip">暂无评估，点击「创建健康评估」开始吧</div>';
    return;
  }

  container.innerHTML = surveys.map(survey => {
    const createTime = new Date(survey.createdAt).toLocaleString();
    const count = survey.responseCount || 0;
    const desc = escapeHtml(survey.description || '无描述');
    const title = escapeHtml(survey.title);
    return `
      <div class="survey-card" data-id="${survey._id}">
        <div class="survey-card-title">${title}</div>
        <div class="survey-card-desc">${desc}</div>
        <div class="survey-card-meta">
          <span>${createTime}</span>
          <span class="badge">${count} 人参与</span>
        </div>
        <div class="survey-card-actions">
          <button class="btn btn-outline" onclick="copyLink('${survey.shareLink}')">复制链接</button>
          <button class="btn btn-primary" onclick="viewStats('${survey._id}')">画像分析</button>
          <button class="btn btn-danger" onclick="deleteSurvey('${survey._id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function copyLink(link) {
  const full = link.startsWith('http') ? link : `${location.origin}${link}`;
  navigator.clipboard.writeText(full).then(() => alert('分享链接已复制！')).catch(() => alert('复制失败，请手动复制'));
}

function viewStats(surveyId) {
  location.href = `/pages/stats.html?id=${surveyId}`;
}

function viewLatestStats() {
  if (allSurveys.length === 0) {
    alert('请先创建一份健康评估');
    return;
  }
  viewStats(allSurveys[0]._id);
}

function copyLatestLink() {
  if (allSurveys.length === 0) {
    alert('请先创建一份健康评估');
    return;
  }
  copyLink(allSurveys[0].shareLink);
}

async function deleteSurvey(surveyId) {
  if (!confirm('删除评估将同时删除所有答卷记录，且无法恢复！确定删除吗？')) return;
  try {
    const res = await axios.delete(`/api/surveys/${surveyId}`);
    if (res.data.success) {
      alert('删除成功');
      loadSurveyList();
    } else {
      alert('删除失败：' + res.data.message);
    }
  } catch (err) {
    alert('删除失败，请稍后重试');
  }
}

async function deleteAccount() {
  if (!confirm('注销账号将永久删除你的账号、所有评估及答卷记录！')) return;
  if (!confirm('再次确认：此操作不可逆，确定注销吗？')) return;
  try {
    const res = await axios.delete('/api/account');
    if (res.data.success) {
      alert('账号已注销');
      location.href = '/pages/login.html';
    } else {
      alert('注销失败：' + res.data.message);
    }
  } catch (err) {
    alert('注销失败，请稍后重试');
  }
}

function logout() {
  location.href = '/api/logout';
}

function scrollToList() {
  document.getElementById('surveyListSection').scrollIntoView({ behavior: 'smooth' });
}
