document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('clients-page')) return;

    // --- DOM-элементы ---
    const tbody = document.getElementById('clients-body');
    const searchInput = document.getElementById('client-search');
    const accountSearchInput = document.getElementById('account-search');
    const tariffFilter = document.getElementById('tariff-filter');
    const statusFilter = document.getElementById('status-filter');
    
    // Модальные окна
    const editModal = document.getElementById('client-edit-modal');
    const assignModal = document.getElementById('client-assign-modal');
    
    // Элементы модального окна редактирования
    const editModalBody = document.getElementById('client-edit-modal-body');
    const editModalClose = editModal.querySelector('.modal-close');
    const editModalActions = document.getElementById('client-edit-modal-actions');
    const deleteSubBtn = document.getElementById('delete-subscription-btn');
    const saveBtn = document.getElementById('save-client-btn');
    
    // Элементы модального окна назначения абонемента
    const assignModalBody = document.getElementById('client-assign-modal-body');
    const assignModalClose = assignModal.querySelector('.modal-close');
    const assignModalActions = document.getElementById('client-assign-modal-actions');
    const assignSubBtn = document.getElementById('assign-subscription-btn');

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
        
        const accountSearchTerm = accountSearchInput.value.toLowerCase();
        if (accountSearchTerm) {
            // Автоматически добавляем "PY-" если пользователь ввел только цифры
            let searchPattern = accountSearchTerm;
            if (/^\d+$/.test(accountSearchTerm)) {
                searchPattern = `py-${accountSearchTerm}`;
            } else if (accountSearchTerm.startsWith('py-')) {
                searchPattern = accountSearchTerm;
            } else if (accountSearchTerm.startsWith('py')) {
                searchPattern = accountSearchTerm;
            }
            
            filteredClients = filteredClients.filter(c => 
                c.account_number && c.account_number.toLowerCase().includes(searchPattern)
            );
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
            tbody.innerHTML = '<tr><td colspan="8">Клиенты не найдены</td></tr>';
            return;
        }

        tbody.innerHTML = filteredClients.map(client => `
            <tr data-client-id="${client.id}">
                <td>${client.full_name}</td>
                <td>${client.email || '—'}</td>
                <td>${client.phone || '—'}</td>
                <td>
                    ${client.is_quick_registration ? 
                        `<span class="quick-reg-badge">⚡ Быстрая</span>` : 
                        '<span class="normal-reg-badge">Обычная</span>'
                    }
                </td>
                <td>
                    ${client.is_quick_registration && client.account_number ? 
                        `<span class="account-number">${client.account_number}</span>` : 
                        '—'
                    }
                </td>
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

    // --- Модальные окна ---
    const closeModal = (modalElement) => {
        modalElement.style.display = 'none';
        
        // Восстанавливаем скролл
        const scrollY = document.body.style.top;
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        if (scrollY) {
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
        
        // Скрыть ошибки
        const errorElements = modalElement.querySelectorAll('.form-error');
        errorElements.forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
        });
    };


    // Форма редактирования данных клиента
    const renderEditClientModal = (client) => {
        const birthDate = client.birth_date ? new Date(client.birth_date).toISOString().split('T')[0] : '';
        currentClient = client;
        
        editModalBody.innerHTML = `
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
                ${client.is_quick_registration ? `
                <div class="form-group">
                    <label for="account_number">Номер аккаунта</label>
                    <input type="text" id="account_number" value="${client.account_number || ''}" readonly style="background-color: #f5f5f5;">
                    <small class="form-hint">Номер аккаунта для пользователей быстрой регистрации</small>
                </div>
                ` : ''}
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

            // Перемещаем блок действий между уровнем подготовки и информацией об абонементе
            if (editModalActions && editModalBody) {
                editModalActions.style.borderTop = 'none';
                editModalActions.style.background = 'transparent';
                editModalActions.style.padding = '0';
                editModalActions.style.gap = '12px';
                const subInfo = editModalBody.querySelector('.subscription-info');
                if (subInfo) {
                    editModalBody.insertBefore(editModalActions, subInfo);
                } else {
                    editModalBody.appendChild(editModalActions);
                }
            }
        
        // Настраиваем видимость и текст кнопок для редактирования
        saveBtn.querySelector('span').textContent = 'Сохранить';
        deleteSubBtn.querySelector('span').textContent = 'Удалить';
        
        document.getElementById('edit-client-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            
            // Валидация данных
            const firstName = form.querySelector('#first_name').value.trim();
            const lastName = form.querySelector('#last_name').value.trim();
            const email = form.querySelector('#email').value.trim();
            const phone = form.querySelector('#phone').value.trim();
            const birthDate = form.querySelector('#birth_date').value;
            
            // Проверка обязательных полей
            if (!firstName || !lastName || !email) {
                showNotification('Имя, фамилия и email обязательны для заполнения', 'error');
                return;
            }
            
            // Валидация email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showNotification('Введите корректный email адрес', 'error');
                return;
            }
            
            // Валидация телефона (если заполнен)
            if (phone && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(phone)) {
                showNotification('Введите корректный номер телефона', 'error');
                return;
            }
            
            const updatedClient = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone || null,
                birth_date: birthDate || null,
            };

            // Объявляем переменные вне try блока
            const saveBtn = form.querySelector('button[type="submit"]');
            const formError = form.querySelector('.form-error');
            let originalText = '';
            
            if (saveBtn) {
                originalText = saveBtn.textContent;
            }

            try {
                // Показываем индикатор загрузки
                if (saveBtn) {
                    saveBtn.textContent = 'Сохранение...';
                    saveBtn.disabled = true;
                }
                
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
                showNotification('Данные клиента успешно обновлены! Личный кабинет пользователя будет обновлен.', 'success');
                closeModal(editModal);
                
                // Обновляем данные в таблице
                await loadClients();
                
            } catch (err) {
                console.error('Ошибка обновления клиента:', err);
                
                // Показываем ошибку в форме, если элемент существует
                if (formError) {
                    formError.textContent = err.message;
                    formError.style.display = 'block';
                }
                
                showNotification(err.message, 'error');
            } finally {
                // Восстанавливаем кнопку
                if (saveBtn && originalText) {
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                }
            }
        });
    };
    
    // Форма назначения абонемента
    const renderAssignSubscriptionModal = (client) => {
        const planOptions = allPlans.map(p => `<option value="${p.id}">${p.title} (${p.price} BYN, ${p.duration_days} дн.)</option>`).join('');
        currentClient = client;
        
        assignModalBody.innerHTML = `
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
        assignSubBtn.querySelector('span').textContent = 'Назначить';
        
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
                closeModal(assignModal);
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
        document.body.classList.add('modal-open');
        
        try {
            const clientRes = await fetch(`/api/admin/clients/${clientId}`, { credentials: 'include' });
            if (!clientRes.ok) throw new Error('Не удалось загрузить данные клиента');
            const client = await clientRes.json();
            
            // Определяем тип модального окна и рендерим контент
            if (!client.plan_title || client.sub_status === 'Неактивен') {
                // Открываем модальное окно назначения абонемента
                assignModal.style.display = 'flex';
                renderAssignSubscriptionModal(client);
                
                // Focus на первое поле
                setTimeout(() => {
                    const firstInput = assignModal.querySelector('input, select');
                    if (firstInput) firstInput.focus();
                }, 100);
            } else { 
                // Открываем модальное окно редактирования
                editModal.style.display = 'flex';
                renderEditClientModal(client);
                
                // Focus на первое поле
                setTimeout(() => {
                    const firstInput = editModal.querySelector('input, select');
                    if (firstInput) firstInput.focus();
                }, 100);
            }
            
        } catch (err) {
            // Показываем ошибку в модальном окне редактирования
            editModal.style.display = 'flex';
            editModalBody.innerHTML = `<div style="text-align: center; padding: 40px; color: red;"><p>${err.message}</p></div>`;
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
                closeModal(editModal);
                loadClients();
            } catch (error) {
                showNotification(`Ошибка удаления абонемента: ${error.message}`, 'error');
            }
        }
    });
    
    // Кнопка назначения абонемента
    assignSubBtn.addEventListener('click', async () => {
        if (!currentClient) {
            showNotification('Данные клиента не загружены', 'error');
            return;
        }

        const assignForm = document.getElementById('assign-sub-form');
        
        if (assignForm) {
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
    
    // Кнопка сохранения
    saveBtn.addEventListener('click', async () => {
        if (!currentClient) {
            showNotification('Данные клиента не загружены', 'error');
            return;
        }

        const editForm = document.getElementById('edit-client-form');
        
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
            };

            // Нормализуем оригинальные данные для сравнения
            const originalData = {
                first_name: (currentClient.first_name || '').trim(),
                last_name: (currentClient.last_name || '').trim(),
                email: (currentClient.email || '').trim(),
                phone: (currentClient.phone || '').trim(),
                birth_date: currentClient.birth_date ? currentClient.birth_date.split('T')[0] : '',
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
            
        } else {
            showNotification('Форма не найдена. Попробуйте перезагрузить страницу', 'error');
        }
    });
    
    // --- Обработчики событий ---
    [searchInput, tariffFilter, statusFilter].forEach(el => el.addEventListener('input', renderTable));
    
    // Специальная обработка для поиска по номеру аккаунта
    accountSearchInput.addEventListener('input', (e) => {
        let value = e.target.value;
        
        // Если поле пустое, не добавляем ничего и показываем всех клиентов
        if (!value) {
            renderTable();
            return;
        }
        
        // Если пользователь ввел только цифры, автоматически добавляем "PY-"
        if (/^\d+$/.test(value)) {
            e.target.value = `PY-${value}`;
        }
        // Если пользователь ввел "PY" без дефиса, добавляем дефис
        else if (value.toLowerCase() === 'py') {
            e.target.value = 'PY-';
        }
        
        renderTable();
    });
    
    // Обработка фокуса - показываем placeholder, но не заполняем поле
    accountSearchInput.addEventListener('focus', (e) => {
        // Не заполняем поле автоматически, чтобы не мешать очистке фильтра
    });
    
    // Обработка клавиши Escape - очистка поля
    accountSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.target.value = '';
            renderTable();
        }
    });
    
    // Обработка очистки поля - показываем всех клиентов
    accountSearchInput.addEventListener('blur', (e) => {
        if (!e.target.value) {
            renderTable();
        }
    });

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

    // Обработчики закрытия модальных окон
    editModalClose.addEventListener('click', () => closeModal(editModal));
    assignModalClose.addEventListener('click', () => closeModal(assignModal));
    
    // Закрытие по клику на фон (wrapper) но не на сам контент
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal || e.target.classList.contains('modal-wrapper')) {
            closeModal(editModal);
        }
    });
    
    assignModal.addEventListener('click', (e) => {
        if (e.target === assignModal || e.target.classList.contains('modal-wrapper')) {
            closeModal(assignModal);
        }
    });
    
    // Закрытие по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (editModal.style.display === 'flex') {
                closeModal(editModal);
            } else if (assignModal.style.display === 'flex') {
                closeModal(assignModal);
            }
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
