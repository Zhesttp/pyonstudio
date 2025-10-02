document.addEventListener('DOMContentLoaded', () => {
  if(!document.body.classList.contains('clients-page')) return;
  const tbody=document.getElementById('clients-body');
  fetch('/api/admin/clients',{credentials:'include'})
    .then(r=>r.json())
    .then(list=>{
      if(!Array.isArray(list)||!list.length){
        tbody.innerHTML='<tr><td colspan="6">Клиентов нет</td></tr>';return;}
      tbody.innerHTML='';
      list.forEach(c=>{
        const tr=document.createElement('tr');
        tr.dataset.clientId=c.id;
        tr.innerHTML=`<td>${c.full_name}</td><td>${c.email||''}</td><td>${c.phone||''}</td><td>${c.plan_title||'—'}</td><td><span class="${c.status==='Активен'?'status-active':'status-inactive'}">${c.status}</span></td><td><button class="btn btn--sm btn--danger">Удалить</button></td>`;
        tbody.appendChild(tr);
      });
    })
    .catch(()=>{tbody.innerHTML='<tr><td colspan="6">Ошибка загрузки</td></tr>';});
});
