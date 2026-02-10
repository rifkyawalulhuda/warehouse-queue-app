const dashboardService = require("../services/dashboard.service");

async function summary(req, res, next) {
  try {
    const result = await dashboardService.getSummary(req.query.date);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function hourly(req, res, next) {
  try {
    const result = await dashboardService.getHourly(req.query.date);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function scheduleSummary(req, res, next) {
  try {
    const result = await dashboardService.getScheduleSummary(req.query.date);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function progressSummary(req, res, next) {
  try {
    const result = await dashboardService.getProgressSummary(req.query.date);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function status(req, res, next) {
  try {
    const result = await dashboardService.getStatus(req.query.date);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function topCustomers(req, res, next) {
  try {
    const result = await dashboardService.getTopCustomers(req.query.date);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function overSla(req, res, next) {
  try {
    const result = await dashboardService.getOverSla(req.query.date);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  summary,
  scheduleSummary,
  progressSummary,
  hourly,
  status,
  topCustomers,
  overSla,
};
