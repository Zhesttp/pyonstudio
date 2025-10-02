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

    // --- INITIALIZATION ---
    await loadTrainers();
    await loadClasses();
    setupEventListeners();

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        addClassBtn.addEventListener('click', openAddModal);
        classForm.addEventListener('submit', handleFormSubmit);
        classDeleteBtn.addEventListener('click', handleDelete);
        modalClose.addEventListener('click', closeModal);
        classModal.addEventListener('click', (e) => {
            if (e.target === classModal) closeModal();
        });
        trainerFilter.addEventListener('change', filterClasses);
        dateFilter.addEventListener('change', filterClasses);
    }

    // --- API FUNCTIONS ---
    async function loadClasses() {
        try {
            const response = await fetch('/api/classes', { credentials: 'include' });
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

    async function saveClass(classData) {
        const url = currentEditingId ? `/api/classes/${currentEditingId}` : '/api/classes';
        const method = currentEditingId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
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

        try {
            const response = await fetch(`/api/classes/${id}`, {
                method: 'DELETE',
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
            classesBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Занятия не найдены</td></tr>';
            return;
        }

        classesBody.innerHTML = classesToRender.map(classItem => {
            const classDate = new Date(classItem.class_date);
            const time = classItem.class_time;
            const trainer = trainers.find(t => t.id === classItem.trainer_id);
            const trainerName = trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Не назначен';
            const status = getClassStatus(classItem);
            const statusBadge = getStatusBadge(status);

            return `
                <tr>
                    <td>${classDate.toLocaleDateString('ru-RU')}</td>
                    <td>${time}</td>
                    <td>${trainerName}</td>
                    <td>${getClassTypeLabel(classItem.class_type)}</td>
                    <td>${classItem.max_participants}</td>
                    <td>${classItem.booked_count || 0}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn--small btn--edit" onclick="editClass('${classItem.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Редактировать
                            </button>
                            <button class="btn btn--small btn--delete" onclick="deleteClass('${classItem.id}')">
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

    function getClassStatus(classItem) {
        const now = new Date();
        const classDateTime = new Date(`${classItem.class_date}T${classItem.class_time}`);
        
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
        document.body.style.overflow = 'hidden';
    }

    function editClass(id) {
        const classItem = classes.find(c => c.id === id);
        if (!classItem) return;

        currentEditingId = id;
        classModalTitle.textContent = 'Редактировать занятие';
        classDeleteBtn.style.display = 'inline-flex';

        // Fill form with class data
        document.getElementById('class-id').value = classItem.id;
        document.getElementById('class-date').value = classItem.class_date;
        document.getElementById('class-time').value = classItem.class_time;
        document.getElementById('class-trainer').value = classItem.trainer_id;
        document.getElementById('class-type').value = classItem.class_type;
        document.getElementById('class-max-participants').value = classItem.max_participants;
        document.getElementById('class-description').value = classItem.description || '';

        classModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        classModal.style.display = 'none';
        document.body.style.overflow = '';
        currentEditingId = null;
    }

    // --- FORM HANDLING ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(classForm);
        const classData = {
            class_date: document.getElementById('class-date').value,
            class_time: document.getElementById('class-time').value,
            trainer_id: document.getElementById('class-trainer').value,
            class_type: document.getElementById('class-type').value,
            max_participants: parseInt(document.getElementById('class-max-participants').value),
            description: document.getElementById('class-description').value
        };

        // Validation
        if (!classData.class_date || !classData.class_time || !classData.trainer_id || !classData.class_type) {
            showError('Пожалуйста, заполните все обязательные поля');
            return;
        }

        if (classData.max_participants < 1 || classData.max_participants > 20) {
            showError('Количество участников должно быть от 1 до 20');
            return;
        }

        await saveClass(classData);
    }

    async function handleDelete() {
        if (currentEditingId) {
            await deleteClass(currentEditingId);
        }
    }

    // --- FILTERING ---
    function filterClasses() {
        let filteredClasses = [...classes];

        // Filter by trainer
        const selectedTrainer = trainerFilter.value;
        if (selectedTrainer) {
            filteredClasses = filteredClasses.filter(c => c.trainer_id === selectedTrainer);
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

    // --- GLOBAL FUNCTIONS (for onclick handlers) ---
    window.editClass = editClass;
    window.deleteClass = deleteClass;
});
