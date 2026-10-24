import "dotenv/config";
import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import orgRoutes from "./modules/org/org.routes.js";
import employeesRoutes from "./modules/employees/employees.routes.js";
import attendanceRoutes from "./modules/attendance/attendance.routes.js";
import leaveRoutes from "./modules/leave/leave.routes.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});
app.use("/auth", authRoutes);
app.use("/org", orgRoutes);
app.use("/employees", employeesRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/leave", leaveRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`HCM Lite backend listening on port ${port}`);
});
