document.addEventListener('DOMContentLoaded', () => {
  if(!document.body.classList.contains('clients-page')) return;
  const tbody=document.getElementById('clients-body');
  const search=document.getElementById('client-search');
  const tariffFilter=document.getElementById('tariff-filter');
  const statusFilter=document.getElementById('status-filter');
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
      tr.innerHTML=`<td>${c.full_name}</td><td>${c.email||''}</td><td>${c.phone||''}</td><td>${c.plan_title||'—'}</td><td><span class="${c.status==='Активен'?'status-active':'status-inactive'}">${c.status}</span></td><td><button class="btn btn--sm btn--danger">Удалить</button></td>`;
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
