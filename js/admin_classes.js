document.addEventListener('DOMContentLoaded', async () => {
    // --- SECURITY CHECK ---
    // Server-side validation of admin role
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (!response.ok || response.status !== 200) {
            window.location.href = '/login';
            return;
        }
        const userData = await response.json();
        if (userData.role !== 'admin') {
            window.location.href = '/login';
            return;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
        return;
    }

    // --- GLOBAL VARIABLES ---
    let classes = [];
    let trainers = [];
    let classTypes = [];
    let currentEditingId = null;

    // --- DOM ELEMENTS ---
    const classesBody = document.getElementById('classes-body');
    const addClassBtn = document.getElementById('add-class-btn');
    const classModal = document.getElementById('class-modal');
    const classModalTitle = document.getElementById('class-modal-title');
    const classForm = document.getElementById('class-form');
    const classDeleteBtn = document.getElementById('class-delete');
    const modalClose = document.querySelector('.modal-close');
    const trainerFilter = document.getElementById('trainer-filter');
    const dateFilter = document.getElementById('date-filter');
    
    // Type modal elements
    const addTypeBtn = document.getElementById('add-type-btn');
    const typeModal = document.getElementById('type-modal');
    const typeForm = document.getElementById('type-form');
    const typeCancelBtn = document.getElementById('type-cancel');

    // --- INITIALIZATION ---
    await loadTrainers();
    await loadClassTypes();
    await loadClasses();
    setupEventListeners();

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        addClassBtn.addEventListener('click', openAddModal);
        classForm.addEventListener('submit', handleFormSubmit);
        classDeleteBtn.addEventListener('click', handleDelete);
        modalClose.addEventListener('click', closeModal);
        
        // Type modal event listeners
        addTypeBtn.addEventListener('click', openTypeModal);
        typeForm.addEventListener('submit', handleTypeFormSubmit);
        typeCancelBtn.addEventListener('click', closeTypeModal);
        
        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (classModal.style.display === 'block') {
                    closeModal();
                } else if (typeModal.style.display === 'block') {
                    closeTypeModal();
                }
            }
        });
        
        classModal.addEventListener('click', (e) => {
            if (e.target === classModal) closeModal();
        });
        
        // Закрытие модального окна типов по клику на фон
        typeModal.addEventListener('click', (e) => {
            if (e.target === typeModal || e.target.classList.contains('modal-wrapper')) {
                closeTypeModal();
            }
        });
        
        // Закрытие модального окна типов по крестику
        const typeModalClose = typeModal.querySelector('.modal-close');
        if (typeModalClose) {
            typeModalClose.addEventListener('click', closeTypeModal);
        }
        
        trainerFilter.addEventListener('change', filterClasses);
        dateFilter.addEventListener('change', filterClasses);
        
        // Делегирование событий для кнопок в таблице
        classesBody.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            if (target.classList.contains('btn--edit')) {
                const classId = target.dataset.classId;
                if (classId) editClass(classId);
            } else if (target.classList.contains('btn--delete')) {
                const classId = target.dataset.classId;
                if (classId) deleteClass(classId);
            }
        });
    }

    // --- UTILITY FUNCTIONS ---
    function getCsrfToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'XSRF-TOKEN') {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    function isClassPast(classItem) {
        const now = new Date();
        const classDateTime = new Date(`${classItem.class_date}T${classItem.start_time}`);
        return classDateTime < now;
    }

    // --- API FUNCTIONS ---
    async function loadClasses() {
        try {
            const response = await fetch('/api/admin/classes', { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to load classes');
            
            classes = await response.json();
            renderClasses(classes);
        } catch (error) {
            console.error('Error loading classes:', error);
            showError('Ошибка загрузки занятий');
        }
    }

    async function loadTrainers() {
        try {
            const response = await fetch('/api/admin/trainers', { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to load trainers');
            
            trainers = await response.json();
            populateTrainerSelects();
        } catch (error) {
            console.error('Error loading trainers:', error);
            showError('Ошибка загрузки тренеров');
        }
    }

    async function loadClassTypes() {
        try {
            const response = await fetch('/api/admin/class-types', { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to load class types');
            
            classTypes = await response.json();
            populateClassTypeSelects();
        } catch (error) {
            console.error('Error loading class types:', error);
            showError('Ошибка загрузки типов занятий');
        }
    }

    async function createClassType(typeData) {
        const csrfToken = getCsrfToken();

        try {
            const response = await fetch('/api/admin/class-types', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(typeData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create class type');
            }

            const result = await response.json();
            await loadClassTypes(); // Перезагружаем типы
            closeTypeModal();
            showSuccess('Тип занятия создан');
            
            // Автоматически выбираем созданный тип
            document.getElementById('class-type').value = result.id;
            
            return result;
        } catch (error) {
            console.error('Error creating class type:', error);
            showError(error.message || 'Ошибка создания типа занятия');
        }
    }

    async function saveClass(classData) {
        const url = currentEditingId ? `/api/admin/classes/${currentEditingId}` : '/api/admin/classes';
        const method = currentEditingId ? 'PUT' : 'POST';
        const csrfToken = getCsrfToken();

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(classData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save class');
            }

            await loadClasses();
            closeModal();
            showSuccess(currentEditingId ? 'Занятие обновлено' : 'Занятие добавлено');
        } catch (error) {
            console.error('Error saving class:', error);
            showError(error.message || 'Ошибка сохранения занятия');
        }
    }

    async function deleteClass(id) {
        if (!confirm('Вы уверены, что хотите удалить это занятие?')) return;

        const csrfToken = getCsrfToken();

        try {
            const response = await fetch(`/api/admin/classes/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-XSRF-TOKEN': csrfToken
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete class');
            }

            await loadClasses();
            closeModal();
            showSuccess('Занятие удалено');
        } catch (error) {
            console.error('Error deleting class:', error);
            showError(error.message || 'Ошибка удаления занятия');
        }
    }

    // --- UI FUNCTIONS ---
    function renderClasses(classesToRender) {
        if (classesToRender.length === 0) {
            classesBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">Занятия не найдены</td></tr>';
            return;
        }

        classesBody.innerHTML = classesToRender.map(classItem => {
            const classDate = new Date(classItem.class_date);
            const time = classItem.start_time;
            const trainerName = classItem.trainer_name || 'Не назначен';
            const status = getClassStatus(classItem);
            const statusBadge = getStatusBadge(status);
            const isPast = isClassPast(classItem);
            const rowClass = isPast ? 'class-row--past' : '';

            return `
                <tr class="${rowClass}">
                    <td>${classDate.toLocaleDateString('ru-RU')}</td>
                    <td>${time}</td>
                    <td>${classItem.duration_minutes || 60} мин</td>
                    <td>${classItem.type_name || 'Не указано'}</td>
                    <td>${trainerName}</td>
                    <td>${classItem.title || 'Не указано'}</td>
                    <td>${classItem.place || 'Не указано'}</td>
                    <td>${classItem.bookings_count || 0}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn--small btn--edit" data-class-id="${classItem.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Редактировать
                            </button>
                            <button class="btn btn--small btn--delete" data-class-id="${classItem.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Удалить
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function populateTrainerSelects() {
        const trainerSelects = document.querySelectorAll('#class-trainer, #trainer-filter');
        
        trainerSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = select.id === 'trainer-filter' 
                ? '<option value="">Все тренеры</option>'
                : '<option value="">Выберите тренера</option>';
            
            trainers.forEach(trainer => {
                const option = document.createElement('option');
                option.value = trainer.id;
                option.textContent = `${trainer.first_name} ${trainer.last_name}`;
                select.appendChild(option);
            });
            
            if (currentValue) select.value = currentValue;
        });
    }

    function populateClassTypeSelects() {
        const classTypeSelects = document.querySelectorAll('#class-type');
        
        classTypeSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Выберите тип</option>';
            
            classTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = type.name;
                select.appendChild(option);
            });

            if (currentValue) select.value = currentValue;
        });
    }

    function getClassStatus(classItem) {
        const now = new Date();
        const classDateTime = new Date(`${classItem.class_date}T${classItem.start_time}`);
        
        if (classDateTime < now) {
            return 'completed';
        } else if (classItem.status === 'cancelled') {
            return 'cancelled';
        } else {
            return 'active';
        }
    }

    function getStatusBadge(status) {
        const badges = {
            active: '<span class="status-badge status-badge--active">Активно</span>',
            completed: '<span class="status-badge status-badge--completed">Завершено</span>',
            cancelled: '<span class="status-badge status-badge--cancelled">Отменено</span>'
        };
        return badges[status] || '<span class="status-badge">Неизвестно</span>';
    }

    function getClassTypeLabel(type) {
        const types = {
            pilates: 'Пилатес',
            yoga: 'Йога',
            stretching: 'Стретчинг',
            fitness: 'Фитнес',
            dance: 'Танцы'
        };
        return types[type] || type;
    }

    // --- MODAL FUNCTIONS ---
    function openAddModal() {
        currentEditingId = null;
        classModalTitle.textContent = 'Новое занятие';
        classForm.reset();
        classDeleteBtn.style.display = 'none';
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('class-date').value = today;
        
        classModal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Добавляем анимацию
        setTimeout(() => {
            classModal.classList.add('show');
        }, 10);
    }

    function editClass(id) {
        const classItem = classes.find(c => c.id === id);
        if (!classItem) return;

        currentEditingId = id;
        classModalTitle.textContent = 'Редактировать занятие';
        classDeleteBtn.style.display = 'inline-flex';

        // Fill form with class data
        document.getElementById('class-id').value = classItem.id;
        document.getElementById('class-title').value = classItem.title || '';
        document.getElementById('class-date').value = classItem.class_date;
        document.getElementById('class-time').value = classItem.start_time;
        document.getElementById('class-duration').value = classItem.duration_minutes || 60;
        // Найдем trainer_id по имени тренера
        const trainer = trainers.find(t => `${t.first_name} ${t.last_name}` === classItem.trainer_name);
        document.getElementById('class-trainer').value = trainer ? trainer.id : '';
        // Найдем type_id по имени типа
        const classType = classTypes.find(t => t.name === classItem.type_name);
        document.getElementById('class-type').value = classType ? classType.id : '';
        document.getElementById('class-place').value = classItem.place || '';
        document.getElementById('class-description').value = classItem.description || '';

        classModal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Добавляем анимацию
        setTimeout(() => {
            classModal.classList.add('show');
        }, 10);
    }

    function closeModal() {
        // Убираем анимацию
        classModal.classList.remove('show');
        
        // Ждем завершения анимации и скрываем модальное окно
        setTimeout(() => {
            classModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            currentEditingId = null;
        }, 300);
    }

    function openTypeModal() {
        typeForm.reset();
        typeModal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        setTimeout(() => {
            typeModal.classList.add('show');
        }, 10);
    }

    function closeTypeModal() {
        typeModal.classList.remove('show');
        
        setTimeout(() => {
            typeModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }, 300);
    }

    // --- FORM HANDLING ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(classForm);
        const classDate = document.getElementById('class-date').value;
        const startTime = document.getElementById('class-time').value;
        const duration = parseInt(document.getElementById('class-duration').value);
        
        // Вычисляем время окончания
        const [hours, minutes] = startTime.split(':').map(Number);
        const startDateTime = new Date();
        startDateTime.setHours(hours, minutes, 0, 0);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
        const endTime = endDateTime.toTimeString().slice(0, 5);
        
        const classData = {
            title: document.getElementById('class-title').value,
            class_date: classDate, // Используем дату как есть, без преобразований
            start_time: startTime,
            end_time: endTime,
            duration_minutes: duration,
            trainer_id: document.getElementById('class-trainer').value,
            type_id: document.getElementById('class-type').value,
            description: document.getElementById('class-description').value,
            place: document.getElementById('class-place').value
        };

        // Validation
        if (!classData.title || !classData.class_date || !classData.start_time || !classData.trainer_id || !classData.place || !classData.duration_minutes || !classData.type_id) {
            showError('Пожалуйста, заполните все обязательные поля');
            return;
        }

        // Отладочная информация
        console.log('Отправляемые данные занятия:', classData);
        console.log('Дата занятия:', classData.class_date);
        console.log('Время начала:', classData.start_time);
        console.log('Время окончания:', classData.end_time);

        await saveClass(classData);
    }

    async function handleDelete() {
        if (currentEditingId) {
            await deleteClass(currentEditingId);
        }
    }

    async function handleTypeFormSubmit(e) {
        e.preventDefault();
        
        const typeData = {
            name: document.getElementById('type-name').value,
            description: document.getElementById('type-description').value
        };

        if (!typeData.name) {
            showError('Пожалуйста, введите название типа');
            return;
        }

        await createClassType(typeData);
    }

    // --- FILTERING ---
    function filterClasses() {
        let filteredClasses = [...classes];

        // Filter by trainer
        const selectedTrainer = trainerFilter.value;
        if (selectedTrainer) {
            filteredClasses = filteredClasses.filter(c => {
                const matches = c.trainer_id === selectedTrainer;
                console.log(`Class ${c.id}: trainer_id=${c.trainer_id}, selected=${selectedTrainer}, matches=${matches}`);
                return matches;
            });
        }

        // Filter by date
        const selectedDate = dateFilter.value;
        if (selectedDate) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            filteredClasses = filteredClasses.filter(c => {
                const classDate = new Date(c.class_date);
                
                switch (selectedDate) {
                    case 'today':
                        return classDate.getTime() === today.getTime();
                    case 'week':
                        const weekStart = new Date(today);
                        weekStart.setDate(today.getDate() - today.getDay());
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        return classDate >= weekStart && classDate <= weekEnd;
                    case 'month':
                        return classDate.getMonth() === today.getMonth() && classDate.getFullYear() === today.getFullYear();
                    default:
                        return true;
                }
            });
        }

        console.log(`Filtered classes: ${filteredClasses.length} out of ${classes.length}`);
        renderClasses(filteredClasses);
    }

    // --- UTILITY FUNCTIONS ---
    function showSuccess(message) {
        // Simple success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: var(--body-font);
            font-weight: 600;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function showError(message) {
        // Simple error notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: var(--body-font);
            font-weight: 600;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Функции editClass и deleteClass теперь используются через делегирование событий
});
