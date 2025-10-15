document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('quick-register-form');
    if (!form) return;

    // Password strength checker
    const passwordInput = document.getElementById('password_reg');
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    const passwordConfInput = document.getElementById('password_conf');

    function checkPasswordStrength(password) {
        let score = 0;
        let feedback = [];

        if (password.length >= 8) score += 1;
        else feedback.push('минимум 8 символов');

        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('строчные буквы');

        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('заглавные буквы');

        if (/\d/.test(password)) score += 1;
        else feedback.push('цифры');

        if (/[^a-zA-Z\d]/.test(password)) score += 1;

        const strengthLevels = ['', 'weak', 'fair', 'good', 'strong'];
        const strengthLabels = ['', 'Слабый', 'Средний', 'Хороший', 'Отличный'];
        
        strengthFill.className = `strength-fill ${strengthLevels[score]}`;
        strengthText.className = `strength-text ${strengthLevels[score]}`;
        
        if (password.length === 0) {
            strengthText.textContent = 'Введите пароль';
        } else if (score < 3) {
            strengthText.textContent = `${strengthLabels[score]} - добавьте: ${feedback.join(', ')}`;
        } else {
            strengthText.textContent = strengthLabels[score];
        }
    }

    // Real-time password validation
    passwordInput.addEventListener('input', (e) => {
        checkPasswordStrength(e.target.value);
        validatePasswordMatch();
    });

    // Password confirmation validation
    function validatePasswordMatch() {
        const password = passwordInput.value;
        const confirmPassword = passwordConfInput.value;
        
        if (confirmPassword && password !== confirmPassword) {
            passwordConfInput.setCustomValidity('Пароли не совпадают');
        } else {
            passwordConfInput.setCustomValidity('');
        }
    }

    passwordConfInput.addEventListener('input', validatePasswordMatch);

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const errorDiv = document.getElementById('reg-error');
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';

        // Get form data
        const formData = new FormData(form);
        const data = {
            first_name: formData.get('first_name'),
            password: formData.get('password'),
            password_conf: formData.get('password_conf')
        };

        // Basic validation
        if (!data.first_name || !data.password || !data.password_conf) {
            showError('Все поля обязательны для заполнения');
            return;
        }

        if (data.password !== data.password_conf) {
            showError('Пароли не совпадают');
            return;
        }

        if (data.password.length < 8) {
            showError('Пароль должен содержать минимум 8 символов');
            return;
        }

        if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(data.password)) {
            showError('Пароль должен содержать буквы и цифры');
            return;
        }

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Создаем аккаунт...';
        submitBtn.disabled = true;

        try {
            // Get CSRF token
            const csrfToken = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1];
            
            if (!csrfToken) {
                showError('Ошибка безопасности. Перезагрузите страницу и попробуйте снова.');
                return;
            }
            
            const response = await fetch('/api/quick-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                // Success - redirect to dashboard
                window.location.href = '/dashboard.html';
            } else {
                showError(result.message || 'Ошибка при создании аккаунта');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showError('Ошибка соединения. Попробуйте еще раз.');
        } finally {
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    function showError(message) {
        const errorDiv = document.getElementById('reg-error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Password toggle functionality
    document.querySelectorAll('.toggle-pass').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const isPassword = input.type === 'password';
            
            input.type = isPassword ? 'text' : 'password';
            button.querySelector('svg').style.opacity = isPassword ? '0.5' : '1';
        });
    });
});
