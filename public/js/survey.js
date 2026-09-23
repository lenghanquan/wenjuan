// 页面加载完成后执行
window.onload = async function() {
  const surveyTitleEl = document.getElementById('surveyTitle');
  const surveyDescEl = document.getElementById('surveyDesc');
  const questionsContainer = document.getElementById('questionsContainer');
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('message');

  // 1. 获取URL中的问卷ID
  const urlParams = new URLSearchParams(window.location.search);
  const surveyId = urlParams.get('id');
  
  if (!surveyId) {
    surveyTitleEl.textContent = '无效的评估链接';
    surveyDescEl.textContent = '';
    questionsContainer.innerHTML = '<div class="empty-tip">请检查评估链接是否正确！</div>';
    return;
  }

  try {
    // 2. 调用后端接口获取问卷详情
    const response = await fetch(`/api/survey/${surveyId}`);
    const result = await response.json();

    if (!result.success) {
      surveyTitleEl.textContent = '评估不存在';
      surveyDescEl.textContent = '';
      questionsContainer.innerHTML = `<div class="empty-tip">${result.message}</div>`;
      return;
    }

    // 3. 渲染问卷基本信息
    const survey = result.survey;
    surveyTitleEl.textContent = survey.title;
    surveyDescEl.textContent = survey.description || '无描述';

    // 4. 渲染问卷题目（核心修复：按钮宽度auto + 左对齐）
    if (survey.questions.length === 0) {
      questionsContainer.innerHTML = '<div class="empty-tip">该评估暂无题目！</div>';
      return;
    }

    let questionsHtml = '';
    survey.questions.forEach((q, index) => {
      let questionContent = '';
      
      if (q.type === 'single') {
        questionContent = `
          <div class="question-item">
            <h4 style="margin-bottom:12px;color:var(--text-title)">${index + 1}. ${q.title} <span style="color:var(--text-secondary);font-weight:normal">（单选）</span></h4>
            ${q.options.map(opt => `
              <label class="choice-option">
                <input type="radio" name="radio_${index}" value="${opt}" required>
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>
        `;
      } else if (q.type === 'multiple') {
        questionContent = `
          <div class="question-item">
            <h4 style="margin-bottom:12px;color:var(--text-title)">${index + 1}. ${q.title} <span style="color:var(--text-secondary);font-weight:normal">（多选）</span></h4>
            ${q.options.map(opt => `
              <label class="choice-option">
                <input type="checkbox" name="checkbox_${index}" value="${opt}">
                <span>${opt}</span>
              </label>
            `).join('')}
            <small style="color:var(--text-secondary);margin-top:8px;display:block">至少选择一项</small>
          </div>
        `;
      } else if (q.type === 'text') {
        // 文本题
        questionContent = `
          <div class="question-item">
            <h4 style="margin-bottom:12px;color:var(--text-title)">${index + 1}. ${q.title} <span style="color:var(--text-secondary);font-weight:normal">（文本）</span></h4>
            <textarea class="text-answer" name="question_${index}" required></textarea>
          </div>
        `;
      }

      questionsHtml += questionContent;
    });

    questionsContainer.innerHTML = questionsHtml;
    submitBtn.style.display = 'block';

    // 5. 提交问卷答案（保留原有功能）
    submitBtn.addEventListener('click', async () => {
      try {
        // 校验用户信息
        const gender = document.getElementById('gender').value;
        const age = document.getElementById('age').value;
        if (!gender || !age) {
          messageEl.textContent = '请填写性别和年龄信息！';
          messageEl.className = 'message-error';
          return;
        }

        // 收集题目答案
        const answers = [];
        let isValidate = true;

        survey.questions.forEach((q, index) => {
          const name = q.type === 'single' ? `radio_${index}` : (q.type === 'multiple' ? `checkbox_${index}` : `question_${index}`);
          let answer = '';

          if (q.type === 'single') {
            const radio = document.querySelector(`input[name="${name}"]:checked`);
            if (!radio) {
              isValidate = false;
              messageEl.textContent = `第${index + 1}题（${q.title}）未选择答案！`;
              messageEl.className = 'message-error';
              return;
            }
            answer = radio.value;
          } else if (q.type === 'multiple') {
            const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
            if (checkboxes.length === 0) {
              isValidate = false;
              messageEl.textContent = `第${index + 1}题（${q.title}）至少选择一项！`;
              messageEl.className = 'message-error';
              return;
            }
            answer = Array.from(checkboxes).map(cb => cb.value);
          } else if (q.type === 'text') {
            const textArea = document.querySelector(`textarea[name="${name}"]`);
            answer = textArea.value.trim();
            if (!answer) {
              isValidate = false;
              messageEl.textContent = `第${index + 1}题（${q.title}）未填写答案！`;
              messageEl.className = 'message-error';
              return;
            }
          }

          answers.push({ questionUniqueId: q.questionUniqueId, answer });
        });

        if (!isValidate) return;

        // 提交答案到后端
        const submitResponse = await fetch('/api/submitResponse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surveyId: surveyId,
            answers: answers,
            userInfo: { gender, age }
          })
        });

        const submitResult = await submitResponse.json();
        if (submitResult.success) {
          messageEl.textContent = '评估提交成功！感谢你的参与';
          messageEl.className = 'message-success';
          submitBtn.disabled = true;
          submitBtn.textContent = '已提交';
          document.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
        } else {
          messageEl.textContent = `提交失败：${submitResult.message}`;
          messageEl.className = 'message-error';
        }

      } catch (err) {
        messageEl.textContent = `提交失败：${err.message}，请检查服务器是否启动！`;
        messageEl.className = 'message-error';
      }
    });

  } catch (err) {
    surveyTitleEl.textContent = '加载失败';
    surveyDescEl.textContent = '';
    questionsContainer.innerHTML = `<div class="empty-tip">加载评估失败：${err.message}</div>`;
  }
};