async function loadProfile(){
  const r=await fetch('/api/me');
  if(r.status!==200){location.href='/login';return;}
  const data=await r.json();
  document.getElementById('name').value=data.first_name;
  document.getElementById('surname').value=data.last_name;
  document.getElementById('email').value=data.email;
  document.getElementById('phone').value=data.phone;
  if(data.birth_date){
    document.getElementById('birthdate').value=data.birth_date.slice(0,10);
  }
  document.getElementById('level').value=data.level;

  if(data.subscription){
    const card=document.getElementById('subscription-card');card.style.display='block';
    document.getElementById('subscription-status').textContent='Активен';
    document.getElementById('plan-title').textContent=data.subscription.title;
    document.getElementById('plan-end').textContent=data.subscription.end;
    document.getElementById('plan-left').textContent=`${data.subscription.left} из ${data.subscription.total}`;
    document.getElementById('plan-price').textContent=`${data.subscription.price} BYN/мес`;
    const pct=(data.subscription.left/data.subscription.total)*100;
    document.getElementById('progress-text').textContent=`${data.subscription.left} из ${data.subscription.total}`;
    document.getElementById('progress-fill').style.width=`${pct}%`;
  }else{
    document.getElementById('no-subscription').style.display='block';
  }
  if(data.avatar_url){
    document.querySelector('.profile-avatar img').src=data.avatar_url;
  }else{
    document.querySelector('.profile-avatar img').style.display='none';
  }
}
loadProfile();
