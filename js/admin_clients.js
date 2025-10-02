document.addEventListener('DOMContentLoaded', () => {
  if(!document.body.classList.contains('clients-page')) return;
  const tbody=document.getElementById('clients-body');
  const search=document.getElementById('client-search');
  const tariffFilter=document.getElementById('tariff-filter');
  const statusFilter=document.getElementById('status-filter');
  const modal=document.getElementById('client-modal');
  const modalBody=document.getElementById('modal-body');
  const modalClose=modal.querySelector('.modal-close');
  const closeModal=()=>{modal.style.display='none';document.body.classList.remove('modal-open');};
  modalClose.addEventListener('click',closeModal);
  window.addEventListener('click',e=>{if(e.target===modal) closeModal();});

  async function openModalWithClientData(id){
    modalBody.innerHTML='<p>Загрузка...</p>';
    modal.style.display='block';
    document.body.classList.add('modal-open');
    try{
      const r=await fetch(`/api/admin/clients/${id}`,{credentials:'include'});
      if(!r.ok){modalBody.textContent='Ошибка загрузки';return;}
      const c=await r.json();
      const until=c.end_date?new Date(c.end_date).toLocaleDateString('ru-RU'):'—';
      const levelRu={beginner:'Начинающий',medium:'Средний',advanced:'Продвинутый'};
      modalBody.innerHTML=`<section class="profile-content"><div class="card card--profile"><div class="card-header"><h2>Личные данные</h2></div><div class="profile-info"><p><strong>Email:</strong> ${c.email||''}</p><p><strong>Телефон:</strong> ${c.phone||''}</p><p><strong>Дата рождения:</strong> ${c.birth_date?new Date(c.birth_date).toLocaleDateString('ru-RU'):''}</p><p><strong>Уровень:</strong> ${levelRu[c.level]||c.level||''}</p></div></div><div class="card card--subscription"><div class="card-header"><h2>Абонемент</h2><div class="subscription-status ${c.sub_status==='Активен'?'status-active':'status-inactive'}">${c.sub_status}</div></div><div class="subscription-info"><div class="subscription-plan"><h3>${c.plan_title??'—'}</h3></div><p><strong>Действует до:</strong> ${until}</p></div></div></section>`;
    }catch{modalBody.textContent='Ошибка';}
  }

  let clients=[];

  const render=()=>{
    let list=clients;
    const term=search.value.toLowerCase();
    if(term) list=list.filter(c=>c.full_name.toLowerCase().includes(term));
    const t=tariffFilter.value;
    if(t!=='all') list=list.filter(c=>c.plan_title===t);
    const s=statusFilter.value;
    if(s!=='all') list=list.filter(c=>c.status===s);

    if(!list.length){
      tbody.innerHTML='<tr><td colspan="6">Клиентов нет</td></tr>';return;}
    tbody.innerHTML='';
    list.forEach(c=>{
      const tr=document.createElement('tr');
      tr.dataset.clientId=c.id;
      tr.innerHTML=`<td>${c.full_name}</td><td>${c.email||''}</td><td>${c.phone||''}</td><td>${c.plan_title||'—'}</td><td><span class="${c.status==='Активен'?'status-active':'status-inactive'}">${c.status}</span></td><td><button class="btn btn--icon btn--danger" title="Удалить"><svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' viewBox='0 0 24 24'><path d='M3 6h18M9 6V4h6v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h12z'/></svg></button></td>`;
      tbody.appendChild(tr);
    });
  };

  fetch('/api/admin/clients',{credentials:'include'})
    .then(r=>{if(!r.ok) throw new Error(r.status); return r.json();})
    .then(data=>{clients=data;render();})
    .catch(()=>{tbody.innerHTML='<tr><td colspan="6">Ошибка загрузки</td></tr>';});

  // fetch all plans for filter
  fetch('/api/admin/plans',{credentials:'include'})
    .then(r=>r.ok?r.json():[])
    .then(plans=>{
       tariffFilter.innerHTML='<option value="all">Все абонементы</option>';
       plans.forEach(p=>{const o=document.createElement('option');o.value=p.title;o.textContent=p.title;tariffFilter.appendChild(o);});
    });

  [search,tariffFilter,statusFilter].forEach(el=>el&&el.addEventListener('input',render));

  tbody.addEventListener('click',e=>{
    if(e.target.classList.contains('btn--danger')){
      const tr=e.target.closest('tr');
      const id=tr.dataset.clientId;
      if(!confirm('Удалить клиента?')) return;
      const csrf=document.cookie.split('; ').find(c=>c.startsWith('XSRF-TOKEN='))?.split('=')[1];
      fetch(`/api/admin/clients/${id}`,{method:'DELETE',credentials:'include',headers:{'X-CSRF-Token':csrf}})
        .then(r=>{if(r.status===204){clients=clients.filter(c=>c.id!==id);render();}});
    }else{
      const tr=e.target.closest('tr');
      if(tr) openModalWithClientData(tr.dataset.clientId);
    }
  });
});
