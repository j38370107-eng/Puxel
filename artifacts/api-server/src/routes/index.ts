import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/projects", projectsRouter);

export default router;
