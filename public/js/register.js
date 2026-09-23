// 注册表单提交逻辑
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  // 1. 双重阻止表单默认提交（彻底防刷新）
  e.preventDefault();
  e.stopPropagation();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const message = document.getElementById('message');
  
  // 2. 防止重复提交（点击后禁用按钮）
  submitBtn.disabled = true;
  submitBtn.textContent = '注册中...';
  message.textContent = '';

  try {
    // 获取表单数据
    const formData = new FormData(e.target);
    const data = {
      username: formData.get('username').trim(),
      email: formData.get('email').trim(),
      password: formData.get('password').trim()
    };

    // 前置校验（避免空数据提交）
    if (!data.username || !data.email || !data.password) {
      message.textContent = '用户名/邮箱/密码不能为空！';
      message.className = 'message-error';
      submitBtn.disabled = false;
      submitBtn.textContent = '注册';
      return;
    }

    // 调用注册接口
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      // 3. 超时设置（避免请求卡住导致刷新）
      timeout: 5000
    });

    // 校验响应状态（非200则抛错）
    if (!response.ok) {
      throw new Error(`网络错误：${response.status}`);
    }

    const result = await response.json();
    message.textContent = result.message;
    
    // 根据结果处理
    if (result.success) {
      message.className = 'message-success';
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    } else {
      message.className = 'message-error';
      submitBtn.disabled = false;
      submitBtn.textContent = '注册';
    }
  } catch (err) {
    // 异常兜底（避免报错后页面刷新）
    message.textContent = `注册失败：${err.message}，请检查服务器是否启动！`;
    message.className = 'message-error';
    submitBtn.disabled = false;
    submitBtn.textContent = '注册';
  }
});

// 额外：阻止页面刷新的兜底（监听回车事件）
document.getElementById('registerForm').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('registerForm').querySelector('button[type="submit"]').click();
  }
});