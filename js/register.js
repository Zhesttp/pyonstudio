document.addEventListener('DOMContentLoaded',()=>{
 const form=document.getElementById('register-form');
 if(!form) return;
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  const btn=form.querySelector('button[type=submit]');
  btn.disabled=true;
  const errBox=document.getElementById('reg-error');errBox.style.display='none';
  try{
    const r=await fetch('http://localhost:3000/api/register',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify(data)
    });
    if(r.status===201){location.href='http://localhost:3000/profile';return;}
    const errBox=document.getElementById('reg-error');
    if(r.status===409){errBox.textContent='Пользователь с таким email или телефоном уже существует';errBox.style.display='block';btn.disabled=false;return;}

    const resp=await r.json();
    if(resp.errors){
      resp.errors.forEach(err=>{
        const el=form.querySelector(`[name=${err.path}]`);
        if(el) el.classList.add('input-error');
      });
      errBox.textContent='Проверьте корректность выделенных полей';errBox.style.display='block';
    }else if(resp.message||resp.msg){
      errBox.textContent=resp.message||resp.msg;errBox.style.display='block';
    }else{
      alert('Ошибка регистрации');
    }
    btn.disabled=false;
  }catch(err){alert('Сервер недоступен');btn.disabled=false;}
 });
});
