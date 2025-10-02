document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('trainers-page')) return;

    // --- DOM элементы ---
    const trainersGrid = document.querySelector('.trainers-grid');
    const addTrainerBtn = document.querySelector('.btn--primary');
    const modal = document.getElementById('trainer-modal');
    const modalClose = modal.querySelector('.modal-close');
    const form = document.getElementById('trainer-form');
    const modalTitle = document.getElementById('trainer-modal-title');
    const deleteBtn = document.getElementById('trainer-delete');

    // --- Состояние приложения ---
    let allTrainers = [];
    let currentTrainer = null;

    // --- Утилиты ---
    const getCsrfToken = () => document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1];
    
    // --- Функции модального окна ---
    const openModal = (trainer = null) => {
        currentTrainer = trainer;
        
        // Сохраняем текущую позицию скролла
        const scrollY = window.scrollY;
        document.body.style.top = `-${scrollY}px`;
        
        if (trainer) {
            // Редактирование
            modalTitle.textContent = 'Редактировать тренера';
            form.querySelector('#trainer-first-name').value = trainer.first_name;
            form.querySelector('#trainer-last-name').value = trainer.last_name;
            form.querySelector('#trainer-birth-date').value = trainer.birth_date ? trainer.birth_date.split('T')[0] : '';
            form.querySelector('#trainer-photo-url').value = trainer.photo_url || '';
            form.querySelector('#trainer-bio').value = trainer.bio || '';
            deleteBtn.style.display = 'inline-flex';
        } else {
            // Добавление
            modalTitle.textContent = 'Добавить тренера';
            form.reset();
            deleteBtn.style.display = 'none';
        }
        
        // Показать модальное окно с анимацией
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        
        // Focus на первое поле
        setTimeout(() => {
            form.querySelector('#trainer-first-name').focus();
        }, 100);
    };

    const closeModal = () => {
        modal.style.display = 'none';
        
        // Восстанавливаем скролл
        const scrollY = document.body.style.top;
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        if (scrollY) {
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
        
        form.reset();
        currentTrainer = null;
        
        // Скрыть ошибки
        const errorElement = form.querySelector('.form-error');
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
    };

    // --- Рендеринг ---
    const renderTrainers = () => {
        if (!allTrainers.length) {
            trainersGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Тренеров нет</p>';
            return;
        }

        trainersGrid.innerHTML = allTrainers.map(trainer => {
            const photoUrl = trainer.photo_url || `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" fill="#f0f0f0"/><circle cx="75" cy="60" r="25" fill="#ccc"/><path d="M30 120 Q75 100 120 120 L120 150 L30 150 Z" fill="#ccc"/></svg>`)}`;
            const fullName = `${trainer.first_name} ${trainer.last_name}`;
            const classesText = trainer.classes_count ? `${trainer.classes_count} занятий` : 'Нет занятий';
            
            return `
                <div class="trainer-card" data-trainer-id="${trainer.id}">
                    <img src="${photoUrl}" alt="Фото тренера" data-trainer-id="${trainer.id}">
                    <h4>${fullName}</h4>
                    <p>${trainer.bio || 'Описание не указано'}</p>
                    <span class="trainer-stat">${classesText}</span>
                    <div class="trainer-actions">
                        <button class="btn btn--sm btn--outline btn-edit" title="Редактировать">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                            </svg>
                            Редактировать
                        </button>
                        <button class="btn btn--sm btn--danger btn-delete" title="Удалить">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                            Удалить
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    // --- API функции ---
    const loadTrainers = async () => {
        try {
            const res = await fetch('/api/admin/trainers', { credentials: 'include' });
            if (!res.ok) throw new Error('Ошибка сети');
            allTrainers = await res.json();
            renderTrainers();
        } catch (error) {
            console.error('Error loading trainers:', error);
            trainersGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Ошибка загрузки тренеров</p>';
        }
    };

    const saveTrainer = async (trainerData) => {
        const isEdit = !!currentTrainer;
        const url = isEdit ? `/api/admin/trainers/${currentTrainer.id}` : '/api/admin/trainers';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken()
                },
                credentials: 'include',
                body: JSON.stringify(trainerData)
            });

            const result = res.ok ? (method === 'POST' ? await res.json() : null) : null;
            
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Ошибка сохранения');
            }

            closeModal();
            loadTrainers(); // Перезагружаем список
            
            // Показываем уведомление об успехе
            showNotification(isEdit ? 'Тренер обновлен' : 'Тренер добавлен', 'success');
            
        } catch (error) {
            console.error('Error saving trainer:', error);
            
            // Показать ошибку в форме
            const errorElement = form.querySelector('.form-error');
            if (errorElement) {
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
            }
            
            showNotification(error.message, 'error');
        }
    };

    const deleteTrainer = async (trainerId) => {
        try {
            const res = await fetch(`/api/admin/trainers/${trainerId}`, {
                method: 'DELETE',
                headers: { 'X-CSRF-Token': getCsrfToken() },
                credentials: 'include'
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Ошибка удаления');
            }

            closeModal();
            loadTrainers();
            showNotification('Тренер удален', 'success');

        } catch (error) {
            console.error('Error deleting trainer:', error);
            showNotification(error.message, 'error');
        }
    };

    // --- Уведомления ---
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

    // --- Event Listeners ---
    
    // Открытие модального окна добавления
    addTrainerBtn.addEventListener('click', () => openModal());

    // Закрытие модального окна
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

    // Обработка кликов по карточкам тренеров
    trainersGrid.addEventListener('click', async (e) => {
        const card = e.target.closest('.trainer-card');
        if (!card) return;

        const trainerId = card.dataset.trainerId;
        const trainer = allTrainers.find(t => t.id === trainerId);

        if (e.target.closest('.btn-edit')) {
            // Редактирование
            if (trainer) {
                openModal(trainer);
            }
        } else if (e.target.closest('.btn-delete')) {
            // Удаление
            if (trainer && confirm(`Вы уверены, что хотите удалить тренера ${trainer.first_name} ${trainer.last_name}?`)) {
                await deleteTrainer(trainerId);
            }
        }
    });

    // Отправка формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const trainerData = {
            first_name: formData.get('first_name').trim(),
            last_name: formData.get('last_name').trim(),
            birth_date: formData.get('birth_date') || null,
            photo_url: formData.get('photo_url').trim() || null,
            bio: formData.get('bio').trim() || null
        };

        // Валидация
        if (!trainerData.first_name || !trainerData.last_name) {
            showNotification('Имя и фамилия обязательны', 'error');
            return;
        }

        await saveTrainer(trainerData);
    });

    // Удаление из модального окна
    deleteBtn.addEventListener('click', async () => {
        if (currentTrainer && confirm(`Вы уверены, что хотите удалить тренера ${currentTrainer.first_name} ${currentTrainer.last_name}?`)) {
            await deleteTrainer(currentTrainer.id);
        }
    });

    // --- Обработка ошибок изображений ---
    const handleImageError = (e) => {
        const img = e.target;
        const trainerId = img.dataset.trainerId;
        // Устанавливаем SVG placeholder при ошибке загрузки
        img.src = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" fill="#f0f0f0"/><circle cx="75" cy="60" r="25" fill="#ccc"/><path d="M30 120 Q75 100 120 120 L120 150 L30 150 Z" fill="#ccc"/></svg>`)}`;
    };

    // --- Инициализация ---
    loadTrainers();
    
    // Добавляем обработчик ошибок для всех изображений
    document.addEventListener('error', handleImageError, true);
});
