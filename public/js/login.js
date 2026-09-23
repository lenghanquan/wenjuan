document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = {
    username: formData.get('username'),
    password: formData.get('password')
  };

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  const message = document.getElementById('message');
  message.textContent = result.message;
  
  if (result.success) {
    message.className = 'message-success';
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } else {
    message.className = 'message-error';
  }
});