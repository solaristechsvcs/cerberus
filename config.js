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
  logLevel: "info"
};
