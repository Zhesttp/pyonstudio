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

    // --- Load admin info ---
    const loadAdminInfo = async () => {
        try {
            const response = await fetch('/api/me', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.first_name && data.last_name) {
                    document.getElementById('admin-name').textContent = `${data.first_name} ${data.last_name}`;
                }
                if (data.email) {
                    document.getElementById('admin-email').textContent = data.email;
                }
            }
        } catch (error) {
            console.error('Error loading admin info:', error);
        }
    };

    loadAdminInfo();

    // --- Logout functionality ---
    const logoutLink = document.querySelector('.sidebar__footer .nav-item');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Clear both tokens
            document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            window.location.href = '/login';
        });
    }
});