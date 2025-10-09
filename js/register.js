document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('register-form');
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
        const passwordConf = passwordConfInput.value;
        
        if (passwordConf && password !== passwordConf) {
            passwordConfInput.classList.add('input-error');
            passwordConfInput.setCustomValidity('Пароли не совпадают');
        } else {
            passwordConfInput.classList.remove('input-error');
            passwordConfInput.setCustomValidity('');
        }
    }

    passwordConfInput.addEventListener('input', validatePasswordMatch);

    // Phone number formatting
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.startsWith('375')) {
            value = '+' + value;
        } else if (value.startsWith('80')) {
            value = '+375' + value.substring(2);
        } else if (value.length > 0 && !value.startsWith('375')) {
            value = '+375' + value;
        }
        e.target.value = value;
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous errors
        form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        
        const data = Object.fromEntries(new FormData(form));
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Создание аккаунта...';
        
        const errBox = document.getElementById('reg-error');
        errBox.style.display = 'none';
        
        const csrf = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1];
        
        try {
            const r = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            if (r.status === 201) {
                location.href = 'http://localhost:3000/profile';
                return;
            }
            
            if (r.status === 409) {
                errBox.textContent = 'Пользователь с таким email или телефоном уже существует';
                errBox.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Создать аккаунт';
                return;
            }

            const resp = await r.json();
            if (resp.errors) {
                resp.errors.forEach(err => {
                    const el = form.querySelector(`[name=${err.param}]`);
                    if (el) {
                        el.classList.add('input-error');
                        // Show specific error message
                        const errorMsg = document.createElement('div');
                        errorMsg.className = 'field-error';
                        errorMsg.textContent = err.msg;
                        errorMsg.style.color = '#c62828';
                        errorMsg.style.fontSize = '12px';
                        errorMsg.style.marginTop = '4px';
                        
                        // Remove existing error message
                        const existingError = el.parentNode.querySelector('.field-error');
                        if (existingError) existingError.remove();
                        
                        el.parentNode.appendChild(errorMsg);
                    }
                });
                errBox.textContent = 'Проверьте корректность выделенных полей';
                errBox.style.display = 'block';
            } else if (resp.message || resp.msg) {
                errBox.textContent = resp.message || resp.msg;
                errBox.style.display = 'block';
            } else {
                errBox.textContent = 'Ошибка регистрации';
                errBox.style.display = 'block';
            }
            btn.disabled = false;
            btn.textContent = 'Создать аккаунт';
        } catch (err) {
            errBox.textContent = 'Сервер недоступен. Проверьте подключение к интернету.';
            errBox.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Создать аккаунт';
        }
    });
});
