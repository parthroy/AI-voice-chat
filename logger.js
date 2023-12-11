const winston = require("winston");

// Define your logger configuration
const logger = winston.createLogger({
  level: "info", // Set the logging level
  format: winston.format.simple(), // Use a simple log format
  transports: [
    new winston.transports.Console(), // Log to the console
    new winston.transports.File({ filename: "app.log" }), // Log to a file
  ],
});
module.exports = logger;
