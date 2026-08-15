const generateReport = require("./generate-report");

module.exports = async function handler(req, res) {
  return generateReport(req, res, { type: "month", cron: true });
};
