// PM2 Ecosystem Config — Classgrid Platform
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save          ← persists across reboots
//   pm2 startup       ← auto-start on server reboot
//   pm2 monit         ← live monitoring dashboard

module.exports = {
    apps: [
        {
            name: "classgrid",
            script: "./server.js",

            // ── Cluster mode: spawn one process per CPU core
            instances: "max",        // uses ALL available CPU cores
            exec_mode: "cluster",    // load-balances across processes

            // ── Auto restart on crash (resilience)
            watch: false,            // don't watch files in production
            autorestart: true,       // restart crashed processes automatically
            max_restarts: 10,        // max 10 restarts before giving up
            restart_delay: 2000,     // wait 2s between restarts

            // ── Memory guard — restart if process leaks beyond 512 MB
            max_memory_restart: "512M",

            // ── Environment
            env: {
                NODE_ENV: "development",
                PORT: 3000,
            },
            env_production: {
                NODE_ENV: "production",
                PORT: 3000,
            },

            // ── Logging
            out_file: "./logs/pm2-out.log",
            error_file: "./logs/pm2-error.log",
            merge_logs: true,
            log_date_format: "YYYY-MM-DD HH:mm:ss",
        },
    ],
};
