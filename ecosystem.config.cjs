module.exports = {
  apps: [
    {
      name: "citrus-platform",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      max_memory_restart: "300M"
    }
  ]
};
