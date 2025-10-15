async function loadProfile() {
    try {
        const r = await fetch('/api/me', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (r.status === 401) {
            console.log('Unauthorized - redirecting to login');
            location.href = '/login';
            return;
        }
        
        if (r.status !== 200) {
            console.error('Profile load error:', r.status, r.statusText);
            const errorData = await r.json().catch(() => ({}));
            console.error('Error details:', errorData);
            alert('Ошибка загрузки профиля. Попробуйте перезайти в систему.');
            location.href = '/login';
            return;
        }
        
        const data = await r.json();
        console.log('Profile data loaded:', data);
    
    // Проверяем, является ли пользователь быстрой регистрации
    const isQuickRegistration = data.is_quick_registration || (data.email && data.email.includes('@temp.pyon.local'));
    console.log('isQuickRegistration:', isQuickRegistration);
    console.log('account_number:', data.account_number);
    
    // Показываем только имя для пользователей быстрой регистрации
    document.getElementById('first_name').value = data.first_name || '';
    
    if (isQuickRegistration) {
        // Скрываем поля, которые не заполнялись при быстрой регистрации
        console.log('Скрываем поля для пользователя быстрой регистрации');
        document.getElementById('last_name').closest('.form-group').style.display = 'none';
        document.getElementById('email').closest('.form-group').style.display = 'none';
        document.getElementById('phone').closest('.form-group').style.display = 'none';
        document.getElementById('birthdate').closest('.form-group').style.display = 'none';
        
        // Показываем номер аккаунта для пользователей быстрой регистрации
        const accountGroup = document.getElementById('account-number-group');
        const accountInput = document.getElementById('account_number');
        
        if (accountGroup && accountInput) {
            accountGroup.style.display = 'block';
            accountInput.value = data.account_number || '';
        }
        
    } else {
        // Показываем все поля для обычных пользователей
        document.getElementById('last_name').closest('.form-group').style.display = 'block';
        document.getElementById('email').closest('.form-group').style.display = 'block';
        document.getElementById('phone').closest('.form-group').style.display = 'block';
        document.getElementById('birthdate').closest('.form-group').style.display = 'block';
        
        // Скрываем номер аккаунта для обычных пользователей
        document.getElementById('account-number-group').style.display = 'none';
        
        // Заполняем поля
        document.getElementById('last_name').value = data.last_name || '';
        document.getElementById('email').value = data.email || '';
        document.getElementById('phone').value = data.phone || '';
        if (data.birth_date && data.birth_date !== '1990-01-01T00:00:00.000Z') {
            document.getElementById('birthdate').value = data.birth_date.slice(0, 10);
        } else {
            document.getElementById('birthdate').value = '';
        }
    }

    const subscriptionCard = document.getElementById('subscription-card');
    const noSubscriptionCard = document.getElementById('no-subscription');

    if (data.plan_title && data.subscription_status === 'Активен') {
        subscriptionCard.style.display = 'block';
        noSubscriptionCard.style.display = 'none';
        document.getElementById('subscription-status').textContent = data.subscription_status;
        document.getElementById('subscription-status').className = 'subscription-status status-active';
        document.getElementById('plan-title').textContent = data.plan_title;
        const planDescription = document.querySelector('.plan-description');
        if (planDescription) {
            planDescription.textContent = data.plan_description || 'Описание отсутствует.';
        }
        if (data.plan_end_date) {
            const endDate = new Date(data.plan_end_date).toLocaleDateString('ru-RU');
            document.getElementById('plan-end').textContent = endDate;
        }
        if (data.plan_price) {
            document.getElementById('plan-price').textContent = `${data.plan_price} BYN`;
        }
        const planLeftEl = document.getElementById('plan-left');
        const progressContainer = document.querySelector('.subscription-progress');
        if (data.total_classes && data.total_classes > 0) {
            const attendedClasses = parseInt(data.attended_classes, 10) || 0;
            const totalClasses = parseInt(data.total_classes, 10);
            const remainingClasses = totalClasses - attendedClasses;
            const percentage = (attendedClasses / totalClasses) * 100;
            if (planLeftEl) {
                planLeftEl.textContent = `${remainingClasses} из ${totalClasses}`;
                planLeftEl.closest('.detail-item').style.display = '';
            }
            if (progressContainer) {
                progressContainer.style.display = '';
                document.getElementById('progress-text').textContent = `Использовано ${attendedClasses} из ${totalClasses}`;
                document.getElementById('progress-fill').style.width = `${percentage}%`;
            }
        } else {
            if (planLeftEl) planLeftEl.closest('.detail-item').style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'none';
        }
    } else {
        subscriptionCard.style.display = 'none';
        noSubscriptionCard.style.display = 'block';
    }

    if (data.all_achievements) {
        renderAchievements(data.all_achievements, data.unlocked_achievement_ids);
    }
    } catch (error) {
        console.error('Profile loading error:', error);
        alert('Ошибка загрузки профиля. Проверьте подключение к интернету.');
        location.href = '/login';
    }
}

function renderAchievements(all, unlockedIds) {
    const grid = document.querySelector('.achievements-grid');
    if (!grid) return;
    
    if (!all || all.length === 0) {
        grid.innerHTML = '<p class="no-achievements">Достижения пока не доступны. Начните заниматься, чтобы получить первые достижения!</p>';
        return;
    }
    
    grid.innerHTML = all.map(ach => `
        <div class="achievement-item ${unlockedIds.includes(ach.id) ? 'unlocked' : ''}">
            <div class="achievement-icon">
                <i class="fas ${ach.icon || 'fa-question-circle'}"></i>
            </div>
            <div class="achievement-info">
                <h4>${ach.title}</h4>
                <p>${ach.description}</p>
            </div>
        </div>
    `).join('');
}

// Функция для очистки всех cookies и перезагрузки сессии
function clearAllCookies() {
    // Очищаем все cookies
    document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Очищаем localStorage и sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    console.log('All cookies and storage cleared');
}

// Функция для проверки и исправления проблем с сессией
async function checkSessionHealth() {
    try {
        const response = await fetch('/api/me', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            console.log('Session expired, clearing cookies');
            clearAllCookies();
            location.href = '/login';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Session check failed:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем здоровье сессии перед загрузкой профиля
    const sessionOk = await checkSessionHealth();
    if (sessionOk) {
        loadProfile();
    }
});
