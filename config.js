module.exports = {
  discord: {
    token: "CHANGE_ME",
    clientId: "CHANGE_ME"
  },
  database: {
    // Supported: "postgres" or "mysql"
    dialect: "postgres",
    host: "YOUR_SQL_HOST",
    port: 5432,
    name: "cerberus",
    user: "YOUR_SQL_USER",
    password: "YOUR_SQL_PASSWORD",
    ssl: false
  },
  dashboard: {
    enabled: true,
    port: 3000,
    publicUrl: "https://dashboard.example.com",
    clientSecret: "CHANGE_ME",
    // Discord user IDs with full dashboard access to every server Cerberus is in.
    globalAdmins: []
  },
  logLevel: "info"
};
