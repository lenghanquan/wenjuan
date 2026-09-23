axios.defaults.withCredentials = true;

window.onload = () => addQuestion();

function addQuestion() {
  const questionsList = document.getElementById('questionsList');
  const questionItem = document.createElement('div');
  questionItem.className = 'question-item';
  questionItem.innerHTML = `
    <div class="form-group">
      <label>问题类型</label>
      <select class="question-type">
        <option value="single">单选题</option>
        <option value="multiple">多选题</option>
      </select>
    </div>
    <div class="form-group">
      <label>问题内容</label>
      <input type="text" class="question-title" placeholder="请输入问题内容" required>
    </div>
    <div class="form-group options-group">
      <label>选项（每行一个）</label>
      <textarea class="question-options" rows="3" placeholder="例如：&#10;选项1&#10;选项2&#10;选项3"></textarea>
    </div>
    <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">删除题目</button>
  `;
  questionsList.appendChild(questionItem);
}

document.getElementById('createSurveyForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('surveyTitle').value.trim();
  const description = document.getElementById('surveyDescription').value.trim();
  const questionItems = document.querySelectorAll('.question-item');

  if (!title) {
    alert('请填写评估名称');
    return;
  }
  if (questionItems.length === 0) {
    alert('至少需要添加一个题目');
    return;
  }

  const questions = [];
  for (let i = 0; i < questionItems.length; i++) {
    const item = questionItems[i];
    const type = item.querySelector('.question-type').value;
    const qTitle = item.querySelector('.question-title').value.trim();
    const options = item.querySelector('.question-options').value
      .split('\n').map(o => o.trim()).filter(Boolean);

    if (!qTitle) {
      alert(`第 ${i + 1} 题内容不能为空`);
      return;
    }
    if (options.length < 2) {
      alert(`第 ${i + 1} 题至少需要 2 个选项`);
      return;
    }
    questions.push({ type, title: qTitle, options });
  }

  try {
    const res = await axios.post('/api/createSurvey', { title, description, questions });
    if (res.data.success) {
      document.getElementById('surveyShareLink').value = res.data.shareLink;
      document.getElementById('surveyQrcode').src = res.data.qrCodeUrl;
      document.getElementById('shareModal').classList.add('show');
    } else {
      alert('创建失败：' + res.data.message);
    }
  } catch (err) {
    if (err.response?.status === 302 || err.response?.status === 401) {
      alert('请先登录');
      location.href = '/pages/login.html';
    } else {
      alert('创建失败，请稍后重试');
    }
  }
});

function copyShareLink() {
  const input = document.getElementById('surveyShareLink');
  navigator.clipboard.writeText(input.value)
    .then(() => alert('分享链接已复制！'))
    .catch(() => { input.select(); alert('请手动复制链接'); });
}

function closeModal() {
  document.getElementById('shareModal').classList.remove('show');
}
