document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            const email = emailInput ? emailInput.value : '';
            const password = passwordInput ? passwordInput.value : '';

            // Check for admin credentials
            if (email === 'admin@gmail.com' && password === 'admin') {
                sessionStorage.setItem('userRole', 'admin');
                window.location.href = 'admin.html';
            } else {
                // In a real app, you'd validate credentials here.
                // For this mock, we'll just redirect for any other credentials.
                sessionStorage.setItem('userRole', 'user');
                window.location.href = 'dashboard.html';
            }
        });
    }
});
