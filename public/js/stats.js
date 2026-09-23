axios.defaults.withCredentials = true;

let currentSurveyId = '';
let allSurveyData = {};
let barChartInstance = null;
let pieChartInstance = null;

function initCharts() {
  barChartInstance = echarts.init(document.getElementById('barChart'));
  pieChartInstance = echarts.init(document.getElementById('pieChart'));
  window.addEventListener('resize', () => {
    barChartInstance?.resize();
    pieChartInstance?.resize();
  });
}

function getSurveyIdFromUrl() {
  return new URLSearchParams(location.search).get('id');
}

async function loadSurveyStats() {
  currentSurveyId = getSurveyIdFromUrl();
  const sel = document.getElementById('questionSelect');
  if (!currentSurveyId) {
    sel.innerHTML = '<option>无效评估</option>';
    return;
  }
  try {
    const res = await axios.get(`/api/stats/${currentSurveyId}`);
    if (res.data.success) {
      allSurveyData = res.data;
      document.getElementById('totalCount').textContent =
        `总答题人数：${allSurveyData.totalRespondents || 0} 人`;
      sel.innerHTML = '<option value="">请选择要查看的题目</option>';
      allSurveyData.questionStats.forEach((item, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = item.questionTitle || item.question;
        sel.appendChild(opt);
      });
    } else {
      alert('获取统计失败：' + res.data.message);
    }
  } catch (e) {
    console.error(e);
    location.href = '/pages/login.html';
  }
}

function handleQuestionChange(e) {
  const idx = Number(e.target.value);
  if (isNaN(idx)) {
    clearCharts();
    return;
  }
  const q = allSurveyData.questionStats[idx];
  if (!q) return;

  const keys = Object.keys(q.optionData);
  const countObj = {};
  const pieData = keys.map(k => {
    const num = Number(q.optionData[k].count) || 0;
    countObj[k] = num;
    return { name: k, value: num };
  });

  renderCharts(q.questionTitle, keys, countObj, pieData);
  renderAnswerTable();
}

function renderCharts(title, options, count, pieData) {
  if (!barChartInstance) initCharts();
  const primary = '#1E9E8F';
  barChartInstance.setOption({
    title: { text: title + ' - 柱状图', left: 'center', textStyle: { fontSize: 14 } },
    color: [primary],
    xAxis: { type: 'category', data: options },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{ type: 'bar', data: options.map(x => count[x]), barMaxWidth: 50 }]
  });
  pieChartInstance.setOption({
    title: { text: title + ' - 饼状图', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    color: ['#1E9E8F', '#67C23A', '#E6A23C', '#F56C6C', '#909399'],
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: pieData,
      label: { show: true, formatter: '{b}: {c}人' }
    }]
  });
}

function clearCharts() {
  barChartInstance?.clear();
  pieChartInstance?.clear();
}

function renderAnswerTable() {
  const tb = document.querySelector('#answerTable tbody');
  tb.innerHTML = '';
  const list = allSurveyData.rawResponses || [];
  if (list.length === 0) {
    tb.innerHTML = '<tr><td colspan="4" class="empty-tip">暂无数据</td></tr>';
    return;
  }
  list.forEach(resp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${resp.userInfo?.gender || '未填'}</td>
      <td>${resp.userInfo?.age || '未填'}</td>
      <td>${new Date(resp.createdAt).toLocaleString()}</td>
      <td>已作答</td>
    `;
    tb.appendChild(tr);
  });
}

async function runAiAnalyze() {
  const btn = document.getElementById('aiAnalyzeBtn');
  const box = document.getElementById('aiAnalysisBox');
  const content = document.getElementById('aiAnalysisContent');
  btn.disabled = true;
  btn.textContent = '分析中...';
  try {
    const res = await axios.post('/api/ai/analyze', { surveyId: currentSurveyId });
    content.textContent = res.data.aiAnalysis || '暂无分析结果';
    box.style.display = 'block';
  } catch (e) {
    content.textContent = 'AI 分析暂不可用';
    box.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = '生成 AI 综合分析报告';
}

async function sendChatMessage() {
  const input = document.getElementById('aiChatInput');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('chatMessages');
  container.innerHTML += `<div class="chat-message user-message">${msg}</div>`;
  input.value = '';
  try {
    const res = await axios.post('/api/ai/chat', { surveyId: currentSurveyId, message: msg });
    container.innerHTML += `<div class="chat-message ai-message">${res.data.reply || '暂无回复'}</div>`;
  } catch (e) {
    container.innerHTML += `<div class="chat-message ai-message">AI 聊天暂不可用</div>`;
  }
  container.scrollTop = container.scrollHeight;
}

function toggleSection(headerId, contentId, iconId) {
  document.getElementById(contentId).classList.toggle('collapsed');
  document.getElementById(iconId).classList.toggle('collapsed');
}

window.onload = () => {
  initCharts();
  loadSurveyStats();
  document.getElementById('questionSelect').onchange = handleQuestionChange;
  document.getElementById('aiAnalyzeBtn').onclick = runAiAnalyze;
  document.getElementById('aiAnalysisHeader').onclick = () =>
    toggleSection('aiAnalysisHeader', 'aiAnalysisContentWrapper', 'aiAnalysisToggle');
  document.getElementById('aiChatHeader').onclick = () =>
    toggleSection('aiChatHeader', 'aiChatContentWrapper', 'aiChatToggle');
  document.getElementById('aiChatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChatMessage();
  });
};
