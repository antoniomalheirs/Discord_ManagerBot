module.exports = {
    apps: [{
        name: "DiscordManager",
        script: "./index.js",
        watch: false,
        max_memory_restart: "1G",
        exec_mode: "cluster",
        instances: 1,
        env: {
            NODE_ENV: "development",
        },
        env_production: {
            NODE_ENV: "production",
        },
        error_file: "./logs/err.log",
        out_file: "./logs/out.log",
        log_date_format: "YYYY-MM-DD HH:mm Z"
    }]
};
