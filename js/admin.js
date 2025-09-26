document.addEventListener('DOMContentLoaded', () => {
    // --- SECURITY CHECK ---
    // This should be the very first thing on any admin page.
    if (sessionStorage.getItem('userRole') !== 'admin') {
        // If the user is not an admin, redirect them to the login page.
        // This prevents direct URL access to admin pages.
        window.location.href = 'login.html';
        return; // Stop further script execution
    }

    // --- Sidebar Logic ---
    const burgerMenu = document.querySelector('.burger-menu-dashboard');
    const layout = document.querySelector('.dashboard-layout');
    const sidebar = document.querySelector('.sidebar');

    if (burgerMenu && layout && sidebar) {
        burgerMenu.addEventListener('click', (event) => {
            event.stopPropagation();
            burgerMenu.classList.toggle('is-active');
            layout.classList.toggle('sidebar-open');
        });

        document.addEventListener('click', (event) => {
            if (layout.classList.contains('sidebar-open')) {
                const isClickInsideSidebar = sidebar.contains(event.target);
                const isClickOnBurger = burgerMenu.contains(event.target);

                if (!isClickInsideSidebar && !isClickOnBurger) {
                    burgerMenu.classList.remove('is-active');
                    layout.classList.remove('sidebar-open');
                }
            }
        });
    }


    // --- Admin Pages Logic ---
    const clientsPage = document.querySelector('body.profile-page');
    if (!clientsPage) return;

    const searchInput = document.getElementById('client-search');
    const clientsTable = document.getElementById('clients-table');
    const tableBody = clientsTable ? clientsTable.querySelector('tbody') : null;
    const modal = document.getElementById('client-modal');
    const modalBody = document.getElementById('modal-body');
    const closeModal = document.querySelector('.modal-close');
    const tariffFilter = document.getElementById('tariff-filter');
    const statusFilter = document.getElementById('status-filter');

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

    function filterClients() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const selectedTariff = tariffFilter ? tariffFilter.value : 'all';
        const selectedStatus = statusFilter ? statusFilter.value : 'all';
        
        if (!tableBody) return;
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const fullName = row.cells[0].textContent.toLowerCase();
            const tariff = row.cells[3].textContent;
            const status = row.cells[4].textContent;

            const matchesSearch = fullName.includes(searchTerm);
            const matchesTariff = selectedTariff === 'all' || tariff === selectedTariff;
            const matchesStatus = selectedStatus === 'all' || status === selectedStatus;

            if (matchesSearch && matchesTariff && matchesStatus) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    // --- Event Listeners ---
    if (searchInput) {
        searchInput.addEventListener('keyup', filterClients);
    }
    if (tariffFilter) {
        tariffFilter.addEventListener('change', filterClients);
    }
    if(statusFilter) {
        statusFilter.addEventListener('change', filterClients);
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
