import { Router, type IRouter } from "express";
import healthRouter from "./health";
import membersRouter from "./members";
import dutyLogsRouter from "./duty-logs";
import licensesRouter from "./licenses";
import statsRouter from "./stats";
import activeDutyRouter from "./active-duty";
import panelLogsRouter from "./panel-logs";
import staffRolesRouter from "./staff-roles";
import authRouter from "./auth";
import shiftConfigRouter from "./shift-config";
import qualificationChartRouter from "./qualification-chart";
import validateAccessRouter from "./validate-access";
import exEmsRouter from "./ex-ems";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(membersRouter);
router.use(dutyLogsRouter);
router.use(licensesRouter);
router.use(statsRouter);
router.use(activeDutyRouter);
router.use(panelLogsRouter);
router.use(staffRolesRouter);
router.use(shiftConfigRouter);
router.use(qualificationChartRouter);
router.use(validateAccessRouter);
router.use(exEmsRouter);

export default router;
