const express = require("express");
const cors = require("cors");
const queueRoutes = require("./routes/queue.routes");
const customerRoutes = require("./routes/customer.routes");
const adminUserRoutes = require("./routes/adminUser.routes");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api", queueRoutes);
app.use("/api", customerRoutes);
app.use("/api", adminUserRoutes);

app.use(errorMiddleware);

module.exports = app;
