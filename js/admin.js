document.addEventListener('DOMContentLoaded', () => {

    const clientsPage = document.querySelector('body.profile-page');
    if (!clientsPage) return;

    const searchInput = document.getElementById('client-search');
    const clientsTable = document.getElementById('clients-table');
    const tableBody = clientsTable ? clientsTable.querySelector('tbody') : null;
    const modal = document.getElementById('client-modal');
    const modalBody = document.getElementById('modal-body');
    const closeModal = document.querySelector('.modal-close');

    const clientsData = {
        1: {
            name: "Иванов Иван",
            surname: "Иванович",
            email: "ivanov@email.com",
            phone: "+7 (999) 111-22-33",
            birthdate: "1985-05-20",
            level: "Средний",
            subscription: 'Тариф "Баланс"',
            subStatus: "Активен",
            subExpires: "23.10.2025",
            subLeft: "7 из 12"
        },
        2: {
            name: "Петрова Анна",
            surname: "Сергеевна",
            email: "petrova@email.com",
            phone: "+7 (999) 444-55-66",
            birthdate: "1992-11-12",
            level: "Начинающий",
            subscription: 'Тариф "Интенсив"',
            subStatus: "Активен",
            subExpires: "15.11.2025",
            subLeft: "15 из 16"
        },
        3: {
            name: "Сидоров Алексей",
            surname: "Петрович",
            email: "sidorov@email.com",
            phone: "+7 (999) 777-88-99",
            birthdate: "1990-01-30",
            level: "Продвинутый",
            subscription: 'Тариф "Утро"',
            subStatus: "Неактивен",
            subExpires: "01.10.2025",
            subLeft: "0 из 8"
        },
        4: {
            name: "Мария",
            surname: "Кузнецова",
            email: "kuznetsova@email.com",
            phone: "+7 (999) 123-45-67",
            birthdate: "1995-03-15",
            level: "Средний",
            subscription: 'Тариф "Баланс"',
            subStatus: "Активен",
            subExpires: "18.12.2025",
            subLeft: "10 из 12"
        },
        5: {
            name: "Дмитрий",
            surname: "Смирнов",
            email: "smirnov@email.com",
            phone: "+7 (999) 987-65-43",
            birthdate: "1988-08-08",
            level: "Продвинутый",
            subscription: 'Тариф "Профи"',
            subStatus: "Активен",
            subExpires: "30.11.2025",
            subLeft: "Безлимит"
        }
    };

    // --- Search Logic ---
    if (searchInput && tableBody) {
        searchInput.addEventListener('keyup', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const fullName = row.cells[0].textContent.toLowerCase();
                if (fullName.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    // --- Modal Logic ---
    function openModalWithClientData(clientId) {
        const client = clientsData[clientId];
        if (!client) return;

        modalBody.innerHTML = `
            <section class="profile-content">
                <div class="card card--profile">
                    <div class="card-header">
                        <h2>Личные данные</h2>
                    </div>
                    <form class="profile-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Имя</label>
                                <input type="text" value="${client.name}" readonly>
                            </div>
                            <div class="form-group">
                                <label>Фамилия</label>
                                <input type="text" value="${client.surname}" readonly>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" value="${client.email}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Телефон</label>
                            <input type="tel" value="${client.phone}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Дата рождения</label>
                            <input type="date" value="${client.birthdate}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Уровень подготовки</label>
                             <input type="text" value="${client.level}" readonly>
                        </div>
                    </form>
                </div>
                <div class="card card--subscription">
                    <div class="card-header">
                        <h2>Абонемент</h2>
                        <div class="subscription-status ${client.subStatus === 'Активен' ? 'status-active' : 'status-inactive'}">${client.subStatus}</div>
                    </div>
                    <div class="subscription-info">
                        <div class="subscription-plan">
                            <h3>${client.subscription}</h3>
                        </div>
                        <div class="subscription-details">
                            <div class="detail-item">
                                <span class="detail-label">Действует до:</span>
                                <span class="detail-value">${client.subExpires}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Осталось занятий:</span>
                                <span class="detail-value">${client.subLeft}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
        modal.style.display = 'block';
    }

    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;

            // --- Delete Logic ---
            if (e.target.classList.contains('btn--danger')) {
                if (confirm('Вы уверены, что хотите удалить этого клиента?')) {
                    row.remove();
                }
                return;
            }
            
            // --- Open Modal Logic ---
            const clientId = row.dataset.clientId;
            if (clientId) {
                openModalWithClientData(clientId);
            }
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});
