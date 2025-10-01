document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            const email = emailInput ? emailInput.value : '';
            const password = passwordInput ? passwordInput.value : '';

            const errBox=document.getElementById('login-error');errBox.style.display='none';
            fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            })
                .then(r => {
                    if (r.status === 200) { window.location.href = 'http://localhost:3000/profile'; return;}
                    else if (r.status === 404) {errBox.textContent='Пользователь не зарегистрирован';errBox.style.display='block';}
                    else if (r.status === 401) {errBox.textContent='Неверная почта или пароль';errBox.style.display='block';}
                    else {errBox.textContent='Ошибка входа';errBox.style.display='block';}
                })
                .catch(() => alert('Сервер недоступен'));
        });
    }
});

document.addEventListener('DOMContentLoaded',()=>{
  const openReg=document.getElementById('open-register');
  const backLogin=document.getElementById('back-login');
  const loginContainer=document.querySelector('.auth-container');
  const regModal=document.getElementById('register-modal');
  if(openReg){openReg.addEventListener('click',e=>{e.preventDefault();loginContainer.style.display='none';regModal.style.display='flex';});}
  if(backLogin){backLogin.addEventListener('click',e=>{e.preventDefault();regModal.style.display='none';loginContainer.style.display='flex';});}
});

document.querySelectorAll('.toggle-pass').forEach(btn=>{
  btn.addEventListener('mousedown',()=>{const inp=document.getElementById(btn.dataset.target);inp.type='text';});
  btn.addEventListener('mouseup',()=>{const inp=document.getElementById(btn.dataset.target);inp.type='password';});
  btn.addEventListener('mouseleave',()=>{const inp=document.getElementById(btn.dataset.target);inp.type='password';});
});

// Registration validation
document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('register-form');
  if(!form) return;
  form.addEventListener('submit',e=>{
    let firstInvalid=null;
    [...form.elements].forEach(el=>{
      if(el.tagName!=='INPUT'&&el.tagName!=='SELECT')return;
      if(!el.checkValidity()){
        el.classList.add('input-error');
        if(!firstInvalid) firstInvalid=el;
      }else el.classList.remove('input-error');
    });
    if(firstInvalid){
      e.preventDefault();
      firstInvalid.focus();
    }
  });
  form.querySelectorAll('input,select').forEach(el=>{
    el.addEventListener('input',()=>el.classList.remove('input-error'));
    el.addEventListener('focus',()=>el.classList.remove('input-error'));
  });
});
