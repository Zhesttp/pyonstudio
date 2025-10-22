module.exports = {
  apps: [{
    name: 'pyon-studio',
    script: 'app.js',
    instances: 1, // Явно указываем 1 процесс
    exec_mode: 'fork', // Используем fork режим вместо cluster
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000
    }
  }]
};