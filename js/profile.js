async function loadProfile() {
    const r = await fetch('/api/me');
    if (r.status !== 200) {
        location.href = '/login';
        return;
    }
    const data = await r.json();
    document.getElementById('first_name').value = data.first_name;
    document.getElementById('last_name').value = data.last_name;
    document.getElementById('email').value = data.email;
    document.getElementById('phone').value = data.phone;
    if (data.birth_date) {
        document.getElementById('birthdate').value = data.birth_date.slice(0, 10);
    }
    document.getElementById('level').value = data.level || '';

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
}

function renderAchievements(all, unlockedIds) {
    const grid = document.querySelector('.achievements-grid');
    if (!grid) return;
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

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
});
