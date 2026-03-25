module.exports = {
  apps: [
    {
      name: 'crm-backend',
      script: 'packages/backend/dist/index.js',
      // CRITICAL: Fork mode only — ESL daemon is singleton, Socket.IO needs sticky sessions
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      // Log rotation
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      max_size: '50M',
      retain: 5,
    },
  ],
};
