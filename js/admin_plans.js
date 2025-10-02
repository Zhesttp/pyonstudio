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
  const classesField=document.getElementById('plan-classes');
  
  // Notification system
  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 4000);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
  };
  const clearForm=()=>{idField.value='';titleField.value='';priceField.value='';durField.value='';classesField.value='';descField.value='';};
  const openModal=(plan=null)=>{
    if(plan){
      idField.value=plan.id;
      titleField.value=plan.title;
      priceField.value=plan.price;
      durField.value=plan.duration_days;
      classesField.value=plan.class_count||'';
      descField.value=plan.description||'';
      delBtn.style.display='inline-flex';
      mTitle.textContent='Редактировать абонемент';
    }else{
      clearForm();
      delBtn.style.display='none';
      mTitle.textContent='Новый абонемент';
    }
    modal.style.display='flex';
    document.body.classList.add('modal-open');
    
    // Focus на первое поле
    setTimeout(() => {
      titleField.focus();
    }, 100);
  };
  
  const closeModal=()=>{
    modal.style.display='none';
    document.body.classList.remove('modal-open');
  };
  
  mClose.onclick=closeModal;
  
  // Закрытие по клику на фон
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-wrapper')) {
      closeModal();
    }
  });
  
  // Закрытие по ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });

  addBtn.onclick=()=>openModal();

  const render=()=>{
    if(!plans.length){tbody.innerHTML='<tr><td colspan="6">Абонементов нет</td></tr>';return;}
    tbody.innerHTML='';
    plans.forEach(p=>{
      const tr=document.createElement('tr');
      tr.dataset.planId=p.id;
      const price=Number(p.price).toFixed(2)+' BYN';
      const duration=p.duration_days+' дней';
      const classes=p.class_count?p.class_count:'Безлимит';
      tr.innerHTML=`<td>${p.title}</td><td>${price}</td><td>${duration}</td><td>${classes}</td><td>${p.description||''}</td><td><button class="btn btn--sm btn--outline">Редактировать</button></td>`;
      tbody.appendChild(tr);
    });
  };

  const load=()=>{
    tbody.innerHTML='<tr><td colspan="6">Загрузка...</td></tr>';
    fetch('/api/admin/plans',{credentials:'include'})
      .then(r=>{if(!r.ok) throw new Error();return r.json();})
      .then(data=>{plans=data;render();})
      .catch(()=>{tbody.innerHTML='<tr><td colspan="6">Ошибка загрузки</td></tr>';});
  };

  tbody.addEventListener('click',e=>{
    if(e.target.tagName==='BUTTON'){
      const id=e.target.closest('tr').dataset.planId;
      const plan=plans.find(p=>p.id===id);
      if(plan) openModal(plan);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validation
    const title = titleField.value.trim();
    const price = parseFloat(priceField.value);
    const duration = parseInt(durField.value, 10);
    const classes = classesField.value ? parseInt(classesField.value, 10) : null;
    
    if (!title) {
      alert('Название абонемента обязательно');
      titleField.focus();
      return;
    }
    
    if (isNaN(price) || price <= 0) {
      alert('Цена должна быть положительным числом');
      priceField.focus();
      return;
    }
    
    if (isNaN(duration) || duration <= 0) {
      alert('Длительность должна быть положительным числом дней');
      durField.focus();
      return;
    }
    
    if (classes !== null && (isNaN(classes) || classes < 0)) {
      alert('Количество занятий должно быть положительным числом или пустым');
      classesField.focus();
      return;
    }
    
    const body = { title, price, duration_days: duration, class_count: classes, description: descField.value.trim() || null };
    const method = idField.value ? 'PUT' : 'POST';
    const url = idField.value ? `/api/admin/plans/${idField.value}` : '/api/admin/plans';
    const csrf = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1];
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка сохранения');
      }
      
      const data = method === 'POST' ? await response.json() : null;
      
      if (data && data.id) body.id = data.id;
      
      if (method === 'POST') {
        plans.push({ ...body });
        showNotification('Абонемент успешно создан', 'success');
      } else {
        plans = plans.map(p => p.id === idField.value ? { ...p, ...body } : p);
        showNotification('Абонемент успешно обновлен', 'success');
      }
      
      render();
      closeModal();
      
    } catch (error) {
      console.error('Error saving plan:', error);
      alert(error.message);
    }
  });

  delBtn.addEventListener('click', async () => {
    const id = idField.value;
    const plan = plans.find(p => p.id === id);
    const planName = plan ? plan.title : 'этот абонемент';
    
    if (!confirm(`Вы уверены, что хотите удалить ${planName}?`)) return;
    
    const csrf = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1];
    
    try {
      const response = await fetch(`/api/admin/plans/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка удаления');
      }
      
      plans = plans.filter(p => p.id !== id);
      render();
      closeModal();
      showNotification('Абонемент успешно удален', 'success');
      
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert(error.message);
    }
  });

  load();
});
