window.onload = () => {
  initHelpCards();
  handleHelpHash();
};

function initHelpCards() {
  document.querySelectorAll('.help-card.clickable').forEach(card => {
    card.addEventListener('click', () => openHelpModal(card.dataset.helpId));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openHelpModal(card.dataset.helpId);
      }
    });
  });

  document.getElementById('helpModalClose').addEventListener('click', closeHelpModal);
  document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') closeHelpModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHelpModal();
  });
}

function handleHelpHash() {
  const match = location.hash.match(/^#help\/(\w+)$/);
  if (match) {
    setTimeout(() => openHelpModal(match[1]), 100);
  }
}

function openHelpModal(id) {
  const article = HELP_ARTICLES.find(a => a.id === id);
  if (!article) return;

  document.getElementById('helpModalTitle').textContent = article.title;

  const body = document.getElementById('helpModalBody');
  body.innerHTML = article.sections.map(section => {
    let content = '';
    if (section.body) {
      content = `<p>${escapeHtml(section.body)}</p>`;
    }
    if (section.list) {
      content += '<ul>' + section.list.map(item => `<li>${escapeHtml(item)}</li>`).join('') + '</ul>';
    }
    return `<div class="help-detail-section"><h4>${escapeHtml(section.heading)}</h4>${content}</div>`;
  }).join('');

  const actionBtn = document.getElementById('helpModalAction');
  if (article.footerLink) {
    actionBtn.href = article.footerLink.href;
    actionBtn.textContent = article.footerLink.text;
    actionBtn.style.display = '';
  } else {
    actionBtn.style.display = 'none';
  }

  document.getElementById('helpModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  location.hash = `help/${id}`;
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.remove('show');
  document.body.style.overflow = '';
  if (location.hash.startsWith('#help/')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
