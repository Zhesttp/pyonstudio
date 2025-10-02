// JS for subscriptions page
document.addEventListener('DOMContentLoaded',()=>{
  if(!document.body.classList.contains('subscriptions-page')) return;
  const tbody=document.getElementById('plans-body');
  const addBtn=document.getElementById('add-plan-btn');
  const modal=document.getElementById('plan-modal');
  const mClose=modal.querySelector('.modal-close');
  const form=document.getElementById('plan-form');
  const delBtn=document.getElementById('plan-delete');
  const idField=document.getElementById('plan-id');
  const titleField=document.getElementById('plan-title');
  const priceField=document.getElementById('plan-price');
  const durField=document.getElementById('plan-duration');
  const descField=document.getElementById('plan-desc');
  const mTitle=document.getElementById('plan-modal-title');

  let plans=[];
  const clearForm=()=>{idField.value='';titleField.value='';priceField.value='';durField.value='';descField.value='';};
  const openModal=(plan=null)=>{
    if(plan){
      idField.value=plan.id;
      titleField.value=plan.title;
      priceField.value=plan.price;
      durField.value=plan.duration_days;
      descField.value=plan.description||'';
      delBtn.style.display='inline-block';
      mTitle.textContent='Редактировать абонемент';
    }else{
      clearForm();
      delBtn.style.display='none';
      mTitle.textContent='Новый абонемент';
    }
    modal.style.display='block';
  };
  const closeModal=()=>{modal.style.display='none';};
  mClose.onclick=closeModal;
  window.addEventListener('click',e=>{if(e.target===modal) closeModal();});

  addBtn.onclick=()=>openModal();

  const render=()=>{
    if(!plans.length){tbody.innerHTML='<tr><td colspan="5">Абонементов нет</td></tr>';return;}
    tbody.innerHTML='';
    plans.forEach(p=>{
      const tr=document.createElement('tr');
      tr.dataset.planId=p.id;
      tr.innerHTML=`<td>${p.title}</td><td>${p.price}</td><td>${p.duration_days}</td><td>${p.description||''}</td><td><button class="btn btn--sm btn--outline">Редактировать</button></td>`;
      tbody.appendChild(tr);
    });
  };

  const load=()=>{
    tbody.innerHTML='<tr><td colspan="5">Загрузка...</td></tr>';
    fetch('/api/admin/plans',{credentials:'include'})
      .then(r=>{if(!r.ok) throw new Error();return r.json();})
      .then(data=>{plans=data;render();})
      .catch(()=>{tbody.innerHTML='<tr><td colspan="5">Ошибка загрузки</td></tr>';});
  };

  tbody.addEventListener('click',e=>{
    if(e.target.tagName==='BUTTON'){
      const id=e.target.closest('tr').dataset.planId;
      const plan=plans.find(p=>p.id===id);
      if(plan) openModal(plan);
    }
  });

  form.addEventListener('submit',e=>{
    e.preventDefault();
    const body={title:titleField.value,price:parseFloat(priceField.value),duration_days:parseInt(durField.value,10),description:descField.value};
    const method=idField.value?'PUT':'POST';
    const url=idField.value?`/api/admin/plans/${idField.value}`:'/api/admin/plans';
    fetch(url,{method,headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)})
      .then(r=>{if(!r.ok) throw new Error();return (method==='POST'?r.json():null);})
      .then(data=>{if(data&&data.id) body.id=data.id; if(method==='POST') plans.push({...body}); else plans=plans.map(p=>p.id===idField.value?{...p,...body}:p); render(); closeModal();})
      .catch(()=>alert('Ошибка сохранения'));
  });

  delBtn.addEventListener('click',()=>{
    const id=idField.value;
    if(!confirm('Удалить абонемент?')) return;
    fetch(`/api/admin/plans/${id}`,{method:'DELETE',credentials:'include'})
      .then(r=>{if(r.status===204){plans=plans.filter(p=>p.id!==id);render();closeModal();}})
      .catch(()=>alert('Ошибка удаления'));
  });

  load();
});
