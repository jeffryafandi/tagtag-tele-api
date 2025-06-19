module.exports = {
    apps: [{
        name: 'tagtag-api',
        script: 'npm',
        args: 'run offline',
        cwd: process.cwd(),
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        env_staging: {
            NODE_ENV: 'staging',
            PORT: 3001
        },
        instances: 1,
        exec_mode: 'fork',
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        error_file: './logs/error.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        time: true,
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 3000,
        ignore_watch: [
            'node_modules',
            'logs',
            '.git',
            '*.log'
        ]
    }, {
        name: 'tagtag-api-staging',
        script: 'npm',
        args: 'run offline',
        cwd: process.cwd(),
        env: {
            NODE_ENV: 'staging',
            PORT: 3001
        },
        instances: 1,
        exec_mode: 'fork',
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        error_file: './logs/staging-error.log',
        out_file: './logs/staging-out.log',
        log_file: './logs/staging-combined.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        time: true,
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 3000,
        ignore_watch: [
            'node_modules',
            'logs',
            '.git',
            '*.log'
        ]
    }]
}; 