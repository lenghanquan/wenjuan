let banners = [];
let currentIndex = 0;
let timer = null;

window.onload = async () => {
  try {
    const res = await fetch('/api/session', { credentials: 'include' });
    const data = await res.json();
    if (data.loggedIn) {
      updateHeaderForLoggedIn(data.username);
    }
  } catch (e) {
    /* 继续展示首页 */
  }

  await loadBanners();
  if (banners.length) {
    buildCarousel();
    startAutoPlay();
  } else {
    hideCarousel();
  }
};

async function loadBanners() {
  try {
    const res = await fetch('/api/banners');
    const data = await res.json();
    if (data.success && data.banners.length) {
      banners = data.banners;
    }
  } catch (e) {
    banners = [];
  }
}

function hideCarousel() {
  const section = document.querySelector('.hero-carousel');
  if (section) section.style.display = 'none';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateHeaderForLoggedIn(username) {
  const right = document.querySelector('.home-header-right');
  if (!right) return;
  const name = username || '用户';
  right.innerHTML = `
    <span style="color:rgba(255,255,255,0.9);font-size:14px;margin-right:4px">你好，${escapeHtml(name)}</span>
    <a href="/pages/dashboard.html" class="btn-home-register">进入个人中心</a>
    <a href="/api/logout" class="btn-home-login">退出</a>
  `;
}

function buildCarousel() {
  const viewport = document.getElementById('carouselViewport');
  const thumbs = document.getElementById('carouselThumbs');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const single = banners.length === 1;

  viewport.innerHTML = '';
  thumbs.innerHTML = '';

  banners.forEach((b, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide' + (i === 0 ? ' active' : '');
    slide.innerHTML = `
      <img src="${b.image}" alt="${escapeHtml(b.title)}">
      <div class="carousel-caption">
        <h2>${escapeHtml(b.title)}</h2>
        <p>${escapeHtml(b.desc)}</p>
        <a href="${escapeHtml(b.link)}" class="btn-cta">${escapeHtml(b.linkText)}</a>
      </div>
    `;
    viewport.appendChild(slide);

    const thumb = document.createElement('button');
    thumb.className = 'carousel-thumb' + (i === 0 ? ' active' : '');
    thumb.type = 'button';
    thumb.innerHTML = `<img src="${b.image}" alt="">`;
    thumb.onclick = () => goTo(i, true);
    thumbs.appendChild(thumb);
  });

  if (prevBtn) prevBtn.style.display = single ? 'none' : '';
  if (nextBtn) nextBtn.style.display = single ? 'none' : '';
  thumbs.style.display = single ? 'none' : '';

  prevBtn.onclick = () => goTo(currentIndex - 1, true);
  nextBtn.onclick = () => goTo(currentIndex + 1, true);

  viewport.addEventListener('mouseenter', stopAutoPlay);
  viewport.addEventListener('mouseleave', startAutoPlay);
}

function goTo(index, resetTimer) {
  const slides = document.querySelectorAll('.carousel-slide');
  const thumbEls = document.querySelectorAll('.carousel-thumb');
  const total = slides.length;
  if (!total) return;

  currentIndex = ((index % total) + total) % total;

  slides.forEach((s, i) => s.classList.toggle('active', i === currentIndex));
  thumbEls.forEach((t, i) => t.classList.toggle('active', i === currentIndex));

  if (resetTimer) {
    stopAutoPlay();
    startAutoPlay();
  }
}

function startAutoPlay() {
  if (banners.length <= 1) return;
  stopAutoPlay();
  timer = setInterval(() => goTo(currentIndex + 1, false), 4500);
}

function stopAutoPlay() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleQuickSearch(e) {
  if (e.key === 'Enter') location.href = '/pages/help.html';
}

document.querySelectorAll('.feature-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.feature-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

function goRegister() {
  location.href = '/pages/register.html';
}
