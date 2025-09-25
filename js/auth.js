document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // In a real app, you'd validate credentials here.
            // For this mock, we'll just redirect.
            window.location.href = 'dashboard.html';
        });
    }
});
