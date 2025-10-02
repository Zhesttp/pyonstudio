document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('clients-page')) return;

    // --- DOM-элементы ---
    const tbody = document.getElementById('clients-body');
    const searchInput = document.getElementById('client-search');
    const tariffFilter = document.getElementById('tariff-filter');
    const statusFilter = document.getElementById('status-filter');
    const modal = document.getElementById('client-modal');
    const modalBody = document.getElementById('modal-body');
    const modalClose = modal.querySelector('.modal-close');
    const modalActions = document.getElementById('modal-actions');
    const deleteSubBtn = document.getElementById('delete-subscription-btn');
    const saveBtn = document.getElementById('save-client-btn');

    // --- Состояние приложения ---
    let allClients = []; // Все загруженные клиенты
    let allPlans = []; // Все абонементы для селектора
    
    // Инициализация кнопок модального окна
    if (deleteSubBtn && saveBtn) {
        deleteSubBtn.style.display = 'inline-flex';
        saveBtn.style.display = 'inline-flex';
        deleteSubBtn.className = 'btn btn--danger';
        saveBtn.className = 'btn btn--primary';
    }
    
    // --- Утилиты ---
    const getCsrfToken = () => document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1];
    
    // --- Логика рендеринга ---

    // Рендер таблицы
    const renderTable = () => {
        let filteredClients = [...allClients];
        
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            filteredClients = filteredClients.filter(c => c.full_name.toLowerCase().includes(searchTerm));
        }
        
        const tariff = tariffFilter.value;
        if (tariff !== 'all') {
            filteredClients = filteredClients.filter(c => c.plan_title === tariff);
        }
        
        const status = statusFilter.value;
        if (status !== 'all') {
            filteredClients = filteredClients.filter(c => c.status === status);
        }

        if (filteredClients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Клиенты не найдены</td></tr>';
            return;
        }

        tbody.innerHTML = filteredClients.map(client => `
            <tr data-client-id="${client.id}">
                <td>${client.full_name}</td>
                <td>${client.email || '—'}</td>
                <td>${client.phone || '—'}</td>
                <td>${client.plan_title || '—'}</td>
                <td><span class="${client.status === 'Активен' ? 'status-active' : 'status-inactive'}">${client.status}</span></td>
                <td class="actions-cell">
                    <button class="btn btn--icon btn-edit" title="Редактировать">
                        <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' stroke='currentColor' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 20h9'/><path d='M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z'/></svg>
                    </button>
                    <button class="btn btn--icon btn--danger" title="Удалить">
                        <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' stroke='currentColor' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/><line x1='10' y1='11' x2='10' y2='17'/><line x1='14' y1='11' x2='14' y2='17'/></svg>
                    </button>
                </td>
            </tr>
        `).join('');
    };

    // --- Модальное окно ---
    const closeModal = () => {
        modal.style.display = 'none';
        
        // Восстанавливаем скролл
        const scrollY = document.body.style.top;
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        if (scrollY) {
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
        
        // Скрыть ошибки
        const errorElements = modal.querySelectorAll('.form-error');
        errorElements.forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
        });
        
        // Кнопки остаются всегда видны
    };


    // Форма редактирования данных клиента
    const renderEditClientModal = (client) => {
        const birthDate = client.birth_date ? new Date(client.birth_date).toISOString().split('T')[0] : '';
        currentClient = client;
        
        modalBody.innerHTML = `
            <form id="edit-client-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="first_name">Имя</label>
                        <input type="text" id="first_name" value="${client.first_name}" required placeholder="Введите имя">
                    </div>
                    <div class="form-group">
                        <label for="last_name">Фамилия</label>
                        <input type="text" id="last_name" value="${client.last_name}" required placeholder="Введите фамилию">
                    </div>
                </div>
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" value="${client.email || ''}" required placeholder="example@email.com">
                </div>
                <div class="form-group">
                    <label for="phone">Телефон</label>
                    <input type="tel" id="phone" value="${client.phone || ''}" placeholder="+375 (XX) XXX-XX-XX">
                </div>
                <div class="form-group">
                    <label for="birth_date">Дата рождения</label>
                    <input type="date" id="birth_date" value="${birthDate}">
                </div>
                <div class="form-group">
                    <label for="level">Уровень подготовки</label>
                    <select id="level">
                        <option value="Начинающий" ${client.level === 'Начинающий' ? 'selected' : ''}>Начинающий</option>
                        <option value="Средний" ${client.level === 'Средний' ? 'selected' : ''}>Средний</option>
                        <option value="Продвинутый" ${client.level === 'Продвинутый' ? 'selected' : ''}>Продвинутый</option>
                    </select>
                </div>
                <div class="form-error" style="display:none;"></div>
            </form>
            
            <div class="subscription-info">
                <h3>Информация об абонементе</h3>
                <div class="subscription-details">
                    <div class="detail-item">
                        <span class="detail-label">Текущий абонемент:</span>
                        <span class="detail-value">${client.plan_title || 'Не назначен'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Статус:</span>
                        <span class="detail-value ${client.sub_status === 'Активен' ? 'status-active' : 'status-inactive'}">${client.sub_status || 'Неактивен'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Действует до:</span>
                        <span class="detail-value">${client.end_date ? new Date(client.end_date).toLocaleDateString('ru-RU') : '—'}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Настраиваем видимость и текст кнопок для редактирования
        saveBtn.querySelector('span').textContent = 'Сохранить изменения';
        deleteSubBtn.querySelector('span').textContent = 'Удалить абонемент';
        
        document.getElementById('edit-client-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const updatedClient = {
                first_name: form.querySelector('#first_name').value,
                last_name: form.querySelector('#last_name').value,
                email: form.querySelector('#email').value,
                phone: form.querySelector('#phone').value,
                birth_date: form.querySelector('#birth_date').value,
                level: form.querySelector('#level').value,
            };

            try {
                const res = await fetch(`/api/admin/clients/${client.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
                    credentials: 'include',
                    body: JSON.stringify(updatedClient)
                });
                
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.message || 'Ошибка сохранения');
                }
                
                // Показываем уведомление об успехе
                showNotification('Данные клиента успешно обновлены', 'success');
                closeModal();
                loadClients();
                
            } catch (err) {
                form.querySelector('.form-error').textContent = err.message;
                form.querySelector('.form-error').style.display = 'block';
                showNotification(err.message, 'error');
            }
        });
    };
    
    // Форма назначения абонемента
    const renderAssignSubscriptionModal = (client) => {
        const planOptions = allPlans.map(p => `<option value="${p.id}">${p.title} (${p.price} BYN, ${p.duration_days} дн.)</option>`).join('');
        currentClient = client;
        
        modalBody.innerHTML = `
            <div class="client-info">
                <p><strong>Клиент:</strong> ${client.first_name} ${client.last_name}</p>
                <p><strong>Email:</strong> ${client.email}</p>
            </div>
            
            <form id="assign-sub-form" data-client-id="${client.id}">
                <div class="form-group">
                    <label for="plan-select">Выберите абонемент</label>
                    <select id="plan-select" required>
                        <option value="">Выберите абонемент...</option>
                        ${planOptions}
                    </select>
                </div>
                <div class="form-error" style="display:none;"></div>
            </form>
        `;
        
        // Настраиваем видимость и текст кнопок для назначения абонемента
        saveBtn.querySelector('span').textContent = 'Назначить абонемент';
        deleteSubBtn.querySelector('span').textContent = 'Удалить абонемент';
        
        document.getElementById('assign-sub-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const planId = form.querySelector('#plan-select').value;
            const clientId = form.dataset.clientId; // <-- Получаем ID из data-атрибута
            try {
                const res = await fetch(`/api/admin/clients/${clientId}/subscription`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
                    credentials: 'include',
                    body: JSON.stringify({ plan_id: planId })
                });
                
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.message || 'Ошибка назначения');
                }
                
                // Показываем уведомление об успехе
                showNotification('Абонемент успешно назначен', 'success');
                closeModal();
                loadClients();
                
            } catch (err) {
                form.querySelector('.form-error').textContent = err.message;
                form.querySelector('.form-error').style.display = 'block';
                showNotification(err.message, 'error');
            }
        });
    };
    
    // Главная функция открытия модального окна
    const openClientModal = async (clientId) => {
        // Сначала показываем модальное окно с загрузкой
        const scrollY = window.scrollY;
        document.body.style.top = `-${scrollY}px`;
        
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        
        // Показываем состояние загрузки
        const modalTitle = document.getElementById('client-modal-title');
        const modalActions = document.getElementById('modal-actions');
        
        modalTitle.textContent = 'Загрузка данных...';
        modalBody.innerHTML = '<div style="text-align: center; padding: 40px;"><p>Загрузка...</p></div>';
        modalActions.style.display = 'flex';
        
        try {
            const clientRes = await fetch(`/api/admin/clients/${clientId}`, { credentials: 'include' });
            if (!clientRes.ok) throw new Error('Не удалось загрузить данные клиента');
            const client = await clientRes.json();
            
            // Определяем тип модального окна и рендерим контент
            if (!client.plan_title || client.sub_status === 'Неактивен') {
                modalTitle.textContent = 'Назначить абонемент';
                renderAssignSubscriptionModal(client);
            } else { 
                modalTitle.textContent = 'Редактировать клиента';
                renderEditClientModal(client);
            }
            
            // Убеждаемся что кнопки действий видны
            if (modalActions) {
                modalActions.style.display = 'flex';
            }
            
            // Focus на первое поле
            setTimeout(() => {
                const firstInput = modal.querySelector('input, select');
                if (firstInput) firstInput.focus();
            }, 100);
            
        } catch (err) {
        modalTitle.textContent = 'Ошибка';
        modalBody.innerHTML = `<div style="text-align: center; padding: 40px; color: red;"><p>${err.message}</p></div>`;
        }
    };
    
    // --- Загрузка данных ---
    const loadClients = async () => {
        try {
            const res = await fetch('/api/admin/clients', { credentials: 'include' });
            if (!res.ok) throw new Error('Ошибка сети');
            allClients = await res.json();
            renderTable();
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6">Ошибка загрузки клиентов</td></tr>';
        }
    };
    
    const loadPlans = async () => {
        try {
            const res = await fetch('/api/admin/plans', { credentials: 'include' });
            if (!res.ok) return;
            allPlans = await res.json();
            tariffFilter.innerHTML = '<option value="all">Все абонементы</option>' + 
                allPlans.map(p => `<option value="${p.title}">${p.title}</option>`).join('');
        } catch (error) {
            // Ошибка не критична, фильтр просто будет неполным
        }
    };
    
    // --- Обработчики событий кнопок модального окна ---
    let currentClient = null;
    
    // Кнопка удаления абонемента
    deleteSubBtn.addEventListener('click', async () => {
        if (!currentClient) {
            showNotification('Данные клиента не загружены', 'error');
            return;
        }
        
        // Более точная проверка наличия активного абонемента
        const hasActiveSubscription = currentClient.plan_title && 
            currentClient.sub_status && 
            currentClient.sub_status !== 'Неактивен' &&
            currentClient.end_date &&
            new Date(currentClient.end_date) > new Date();
        
        if (!hasActiveSubscription) {
            showNotification('У клиента нет активного абонемента для удаления', 'warning');
            return;
        }
        
        if (confirm(`Вы уверены, что хотите удалить абонемент "${currentClient.plan_title}" у ${currentClient.first_name} ${currentClient.last_name}?`)) {
            try {
                const res = await fetch(`/api/admin/clients/${currentClient.id}/subscription`, {
                    method: 'DELETE',
                    headers: { 'X-CSRF-Token': getCsrfToken() },
                    credentials: 'include'
                });
                
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.message || 'Ошибка удаления абонемента');
                }
                
                showNotification('Абонемент успешно удален', 'success');
                closeModal();
                loadClients();
            } catch (error) {
                showNotification(`Ошибка удаления абонемента: ${error.message}`, 'error');
            }
        }
    });
    
    // Кнопка сохранения
    saveBtn.addEventListener('click', async () => {
        if (!currentClient) {
            showNotification('Данные клиента не загружены', 'error');
            return;
        }

        const editForm = document.getElementById('edit-client-form');
        const assignForm = document.getElementById('assign-sub-form');
        
        if (editForm) {
            // Проверяем валидность формы перед проверкой изменений
            if (!editForm.checkValidity()) {
                editForm.reportValidity();
                showNotification('Пожалуйста, заполните все обязательные поля корректно', 'warning');
                return;
            }

            // Собираем текущие данные формы
            const currentData = {
                first_name: editForm.querySelector('#first_name').value.trim(),
                last_name: editForm.querySelector('#last_name').value.trim(),
                email: editForm.querySelector('#email').value.trim(),
                phone: editForm.querySelector('#phone').value.trim(),
                birth_date: editForm.querySelector('#birth_date').value,
                level: editForm.querySelector('#level').value
            };

            // Нормализуем оригинальные данные для сравнения
            const originalData = {
                first_name: (currentClient.first_name || '').trim(),
                last_name: (currentClient.last_name || '').trim(),
                email: (currentClient.email || '').trim(),
                phone: (currentClient.phone || '').trim(),
                birth_date: currentClient.birth_date ? currentClient.birth_date.split('T')[0] : '',
                level: currentClient.level || ''
            };
            
            // Проверяем наличие изменений
            const hasChanges = Object.keys(currentData).some(key => 
                currentData[key] !== originalData[key]
            );
            
            if (!hasChanges) {
                showNotification('Нет изменений для сохранения', 'warning');
                return;
            }
            
            // Если есть изменения, отправляем форму
            editForm.dispatchEvent(new Event('submit'));
            
        } else if (assignForm) {
            const selectedPlan = assignForm.querySelector('#plan-select').value;
            
            if (!selectedPlan) {
                showNotification('Выберите абонемент для назначения', 'warning');
                assignForm.querySelector('#plan-select').focus();
                return;
            }
            
            if (assignForm.checkValidity()) {
                assignForm.dispatchEvent(new Event('submit'));
            } else {
                assignForm.reportValidity();
            }
        } else {
            showNotification('Форма не найдена. Попробуйте перезагрузить страницу', 'error');
        }
    });
    
    // --- Обработчики событий ---
    [searchInput, tariffFilter, statusFilter].forEach(el => el.addEventListener('input', renderTable));

    tbody.addEventListener('click', (e) => {
        const editButton = e.target.closest('.btn-edit');
        const deleteButton = e.target.closest('.btn--danger');
        
        if (editButton) {
            const clientId = editButton.closest('tr').dataset.clientId;
            openClientModal(clientId);
            return;
        }

        if (deleteButton) {
            const row = deleteButton.closest('tr');
            const clientId = row.dataset.clientId;
            if (confirm('Вы уверены, что хотите удалить этого клиента?')) {
                fetch(`/api/admin/clients/${clientId}`, {
                    method: 'DELETE',
                    headers: { 'X-CSRF-Token': getCsrfToken() },
                    credentials: 'include',
                }).then(res => {
                    if (res.ok) {
                        row.remove();
                        allClients = allClients.filter(c => c.id !== clientId);
                        if (allClients.length === 0) renderTable();
                    } else {
                        alert('Не удалось удалить клиента.');
                    }
                });
            }
        }
    });

    modalClose.addEventListener('click', closeModal);
    
    // Закрытие по клику на фон (wrapper) но не на сам контент
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

    // --- Уведомления (аналогично admin_trainers.js) ---
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Автоудаление через 4 секунды
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 4000);
        
        // Кнопка закрытия
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    };

    // --- Инициализация ---
    loadPlans();
    loadClients();
});
