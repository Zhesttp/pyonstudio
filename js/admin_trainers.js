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
    
    // Photo upload elements
    const photoInput = document.getElementById('trainer-photo');
    const photoUploadArea = document.getElementById('photo-upload-area');
    const photoPreview = document.getElementById('photo-preview');
    const previewImage = document.getElementById('preview-image');
    const removePhotoBtn = document.getElementById('remove-photo');
    
    // Crop modal elements
    const cropModal = document.getElementById('crop-modal');
    const cropImage = document.getElementById('crop-image');
    const cropModalClose = document.getElementById('crop-modal-close');
    const cropCancel = document.getElementById('crop-cancel');
    const cropConfirm = document.getElementById('crop-confirm');

    // --- Состояние приложения ---
    let allTrainers = [];
    let currentTrainer = null;
    let selectedPhotoFile = null;
    let cropper = null;

    // --- Утилиты ---
    const getCsrfToken = () => document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1];
    
    // --- Photo upload functions ---
    const showPhotoPreview = (file) => {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target.result) {
                previewImage.src = e.target.result;
                photoUploadArea.style.display = 'none';
                photoPreview.style.display = 'block';
            }
        };
        reader.onerror = () => {
            console.error('Error reading file');
            showNotification('Ошибка чтения файла', 'error');
        };
        reader.readAsDataURL(file);
    };
    
    const hidePhotoPreview = () => {
        photoUploadArea.style.display = 'block';
        photoPreview.style.display = 'none';
        // Очищаем src только если изображение загружено
        if (previewImage.src && !previewImage.src.startsWith('data:')) {
            previewImage.src = '';
        }
        selectedPhotoFile = null;
        photoInput.value = '';
    };
    
    const showExistingPhoto = (photoUrl) => {
        if (photoUrl && photoUrl.trim() !== '' && photoUrl !== 'null' && photoUrl !== 'undefined') {
            previewImage.src = photoUrl;
            photoUploadArea.style.display = 'none';
            photoPreview.style.display = 'block';
        } else {
            hidePhotoPreview();
        }
    };
    
    const validatePhotoFile = (file) => {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        
        if (!allowedTypes.includes(file.type)) {
            showNotification('Поддерживаются только JPG и PNG файлы', 'error');
            return false;
        }
        
        if (file.size > maxSize) {
            showNotification('Размер файла не должен превышать 5MB', 'error');
            return false;
        }
        
        return true;
    };
    
    // --- Crop functions ---
    const openCropModal = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target.result) {
                cropImage.src = e.target.result;
                cropModal.style.display = 'flex';
                document.body.classList.add('modal-open');
                
                // Initialize cropper after image loads
                cropImage.onload = () => {
                    if (cropper) {
                        cropper.destroy();
                    }
                    cropper = new Cropper(cropImage, {
                        aspectRatio: 1, // Square crop
                        viewMode: 1,
                        dragMode: 'move',
                        autoCropArea: 0.8,
                        restore: false,
                        guides: false,
                        center: false,
                        highlight: false,
                        cropBoxMovable: true,
                        cropBoxResizable: true,
                        toggleDragModeOnDblclick: false,
                    });
                };
            }
        };
        reader.onerror = () => {
            console.error('Error reading file for crop');
            showNotification('Ошибка чтения файла', 'error');
        };
        reader.readAsDataURL(file);
    };
    
    const closeCropModal = () => {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        cropModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        // Очищаем src только если изображение загружено
        if (cropImage.src && !cropImage.src.startsWith('data:')) {
            cropImage.src = '';
        }
    };
    
    const getCroppedImage = () => {
        if (!cropper) return null;
        
        const canvas = cropper.getCroppedCanvas({
            width: 400,
            height: 400,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });
        
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const file = new File([blob], 'cropped-photo.jpg', {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                });
                resolve(file);
            }, 'image/jpeg', 0.9);
        });
    };
    
    // --- Функции модального окна ---
    const openModal = (trainer = null) => {
        currentTrainer = trainer;
        
        // Prevent body scroll
        document.body.classList.add('modal-open');
        
        if (trainer) {
            // Редактирование
            modalTitle.textContent = 'Редактировать тренера';
            form.querySelector('#trainer-first-name').value = trainer.first_name || '';
            form.querySelector('#trainer-last-name').value = trainer.last_name || '';
            form.querySelector('#trainer-birth-date').value = trainer.birth_date ? trainer.birth_date.split('T')[0] : '';
            form.querySelector('#trainer-bio').value = trainer.bio || '';
            form.querySelector('#trainer-email').value = trainer.email || '';
            form.querySelector('#trainer-password').value = '';
            deleteBtn.style.display = 'inline-flex';
            
            // Показать существующее фото если есть
            showExistingPhoto(trainer.photo_url);
        } else {
            // Добавление
            modalTitle.textContent = 'Добавить тренера';
            form.reset();
            deleteBtn.style.display = 'none';
            hidePhotoPreview();
            form.querySelector('#trainer-email').value = '';
            form.querySelector('#trainer-password').value = '';
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
        document.body.classList.remove('modal-open');
        
        form.reset();
        currentTrainer = null;
        selectedPhotoFile = null;
        
        // Скрыть ошибки
        const errorElement = form.querySelector('.form-error');
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
        
        // Сбросить состояние фото
        hidePhotoPreview();
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
            // Если есть новое фото, загружаем его отдельно
            let photoUrl = null;
            if (selectedPhotoFile) {
                photoUrl = await uploadPhoto(selectedPhotoFile);
            } else if (isEdit && currentTrainer.photo_url && photoPreview.style.display !== 'none') {
                // При редактировании сохраняем существующее фото только если предпросмотр видим
                photoUrl = currentTrainer.photo_url;
            }
            // Если photoUrl остается null, это означает удаление фото

            const dataToSend = {
                ...trainerData,
                photo_url: photoUrl
            };

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken()
                },
                credentials: 'include',
                body: JSON.stringify(dataToSend)
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
                errorElement.textContent = error.message || 'Ошибка сохранения тренера';
                errorElement.style.display = 'block';
            }
            
            showNotification(error.message || 'Ошибка сохранения тренера', 'error');
        }
    };

    const uploadPhoto = async (file) => {
        const formData = new FormData();
        formData.append('photo', file);

        try {
            const res = await fetch('/api/admin/trainers/upload-photo', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': getCsrfToken()
                },
                credentials: 'include',
                body: formData
            });

            if (!res.ok) {
                const error = await res.json().catch(() => ({ message: 'Ошибка загрузки фото' }));
                throw new Error(error.message || 'Ошибка загрузки фото');
            }

            const result = await res.json();
            if (!result.photo_url) {
                throw new Error('Сервер не вернул URL фото');
            }
            
            return result.photo_url;
        } catch (error) {
            console.error('Upload photo error:', error);
            throw error;
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
            bio: formData.get('bio').trim() || null,
            email: (formData.get('email')||'').trim() || null,
            password: (formData.get('password')||'').trim() || null
        };

        // Валидация
        if (!trainerData.first_name || !trainerData.last_name) {
            showNotification('Имя и фамилия обязательны', 'error');
            return;
        }
        if (trainerData.password && trainerData.password.length < 6) {
            showNotification('Пароль должен быть не менее 6 символов', 'error');
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
        
        // Не обрабатываем ошибки для пустых или data URL
        if (!img.src || img.src === '' || img.src.startsWith('data:')) {
            return;
        }
        
        // Устанавливаем SVG placeholder при ошибке загрузки
        img.src = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" fill="#f0f0f0"/><circle cx="75" cy="60" r="25" fill="#ccc"/><path d="M30 120 Q75 100 120 120 L120 150 L30 150 Z" fill="#ccc"/></svg>`)}`;
        
        // Log error for debugging
        console.warn(`Failed to load image for trainer ${trainerId}:`, img.src);
    };
    
    // Handle preview image errors
    const handlePreviewImageError = (e) => {
        const img = e.target;
        // Не показываем ошибку для пустых или data URL
        if (!img.src || img.src === '' || img.src.startsWith('data:')) {
            return;
        }
        console.warn('Failed to load preview image:', img.src);
        hidePhotoPreview();
        showNotification('Ошибка загрузки изображения', 'error');
    };

    // --- Photo upload event listeners ---
    photoUploadArea.addEventListener('click', () => {
        photoInput.click();
    });
    
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && validatePhotoFile(file)) {
            openCropModal(file);
        }
    });
    
    removePhotoBtn.addEventListener('click', () => {
        hidePhotoPreview();
    });
    
    // Drag and drop support
    photoUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        photoUploadArea.style.borderColor = 'var(--primary-color)';
        photoUploadArea.style.backgroundColor = 'rgba(181, 168, 176, 0.1)';
    });
    
    photoUploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        photoUploadArea.style.borderColor = 'rgba(181, 168, 176, 0.3)';
        photoUploadArea.style.backgroundColor = 'rgba(181, 168, 176, 0.05)';
    });
    
    photoUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        photoUploadArea.style.borderColor = 'rgba(181, 168, 176, 0.3)';
        photoUploadArea.style.backgroundColor = 'rgba(181, 168, 176, 0.05)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file && validatePhotoFile(file)) {
                openCropModal(file);
            }
        }
    });

    // --- Crop modal event listeners ---
    cropModalClose.addEventListener('click', closeCropModal);
    cropCancel.addEventListener('click', closeCropModal);
    
    cropConfirm.addEventListener('click', async () => {
        try {
            const croppedFile = await getCroppedImage();
            if (croppedFile) {
                selectedPhotoFile = croppedFile;
                showPhotoPreview(croppedFile);
                closeCropModal();
            }
        } catch (error) {
            console.error('Error cropping image:', error);
            showNotification('Ошибка при кадрировании фото', 'error');
        }
    });
    
    // Close crop modal on background click
    cropModal.addEventListener('click', (e) => {
        if (e.target === cropModal || e.target.classList.contains('modal-wrapper')) {
            closeCropModal();
        }
    });
    
    // Close crop modal on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && cropModal.style.display === 'flex') {
            closeCropModal();
        }
    });

    // --- Инициализация ---
    loadTrainers();
    
    // Добавляем обработчик ошибок для всех изображений
    document.addEventListener('error', handleImageError, true);
    
    // Добавляем обработчик ошибок для preview изображения
    previewImage.addEventListener('error', handlePreviewImageError);
});
