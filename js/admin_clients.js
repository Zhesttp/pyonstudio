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

    // --- Состояние приложения ---
    let allClients = []; // Все загруженные клиенты
    let allPlans = []; // Все абонементы для селектора
    
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
        document.body.classList.remove('modal-open');
    };

    // Форма редактирования данных клиента
    const renderEditClientModal = (client) => {
        const birthDate = client.birth_date ? new Date(client.birth_date).toISOString().split('T')[0] : '';
        const levelRu = { beginner: 'Начинающий', medium: 'Средний', advanced: 'Продвинутый' };
        
        modalBody.innerHTML = `
            <h2>Редактировать клиента</h2>
            <form id="edit-client-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Имя</label>
                        <input type="text" id="first_name" value="${client.first_name}" required>
                    </div>
                    <div class="form-group">
                        <label>Фамилия</label>
                        <input type="text" id="last_name" value="${client.last_name}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" value="${client.email || ''}" required>
                </div>
                <div class="form-group">
                    <label>Телефон</label>
                    <input type="tel" id="phone" value="${client.phone || ''}">
                </div>
                <div class="form-group">
                    <label>Дата рождения</label>
                    <input type="date" id="birth_date" value="${birthDate}">
                </div>
                <div class="form-group">
                    <label>Уровень</label>
                    <select id="level">
                        <option value="beginner" ${client.level === 'beginner' ? 'selected' : ''}>Начинающий</option>
                        <option value="medium" ${client.level === 'medium' ? 'selected' : ''}>Средний</option>
                        <option value="advanced" ${client.level === 'advanced' ? 'selected' : ''}>Продвинутый</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="btn btn--primary">Сохранить</button>
                </div>
                <div class="form-error" style="display:none;"></div>
            </form>
            <hr>
            <h3>Абонемент</h3>
            <p><strong>Текущий:</strong> ${client.plan_title || 'Нет'}</p>
            <p><strong>Статус:</strong> <span class="${client.sub_status === 'Активен' ? 'status-active' : 'status-inactive'}">${client.sub_status || 'Нет'}</span></p>
            <p><strong>Действует до:</strong> ${client.end_date ? new Date(client.end_date).toLocaleDateString('ru-RU') : '—'}</p>
        `;
        
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
                if (!res.ok) throw new Error('Ошибка сохранения');
                closeModal();
                loadClients();
            } catch (err) {
                form.querySelector('.form-error').textContent = err.message;
                form.querySelector('.form-error').style.display = 'block';
            }
        });
    };
    
    // Форма назначения абонемента
    const renderAssignSubscriptionModal = (client) => {
        const planOptions = allPlans.map(p => `<option value="${p.id}">${p.title} (${p.price} BYN, ${p.duration_days} дн.)</option>`).join('');
        modalBody.innerHTML = `
            <h2>Назначить абонемент</h2>
            <p><strong>Клиент:</strong> ${client.first_name} ${client.last_name}</p>
            <form id="assign-sub-form">
                <div class="form-group">
                    <label for="plan-select">Выберите абонемент:</label>
                    <select id="plan-select" required>${planOptions}</select>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="btn btn--primary">Назначить</button>
                </div>
                <div class="form-error" style="display:none;"></div>
            </form>
        `;
        
        document.getElementById('assign-sub-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const planId = form.querySelector('#plan-select').value;
            try {
                const res = await fetch(`/api/admin/clients/${client.id}/subscription`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
                    credentials: 'include',
                    body: JSON.stringify({ plan_id: planId })
                });
                if (!res.ok) throw new Error('Ошибка назначения');
                closeModal();
                loadClients();
            } catch (err) {
                form.querySelector('.form-error').textContent = err.message;
                form.querySelector('.form-error').style.display = 'block';
            }
        });
    };
    
    // Главная функция открытия модального окна
    const openClientModal = async (clientId) => {
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        modalBody.innerHTML = '<p>Загрузка...</p>';
        try {
            const clientRes = await fetch(`/api/admin/clients/${clientId}`, { credentials: 'include' });
            if (!clientRes.ok) throw new Error('Не удалось загрузить данные клиента');
            const client = await clientRes.json();
            
            // Если у клиента нет абонемента ИЛИ он неактивен, показываем форму назначения
            if (!client.plan_title || client.sub_status === 'Неактивен') {
                 renderAssignSubscriptionModal(client);
            } else { // Иначе - форму редактирования
                 renderEditClientModal(client);
            }
        } catch (err) {
            modalBody.innerHTML = `<p style="color: red;">${err.message}</p>`;
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
    window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // --- Инициализация ---
    loadPlans();
    loadClients();
});
