
import express from "express";
import { protect } from "../middleware/protect.js";

import {
  generateWorkflowDraft,
  createWorkflow,
  listWorkflows,
  getWorkflow,
  runWorkflow,
  listAllWorkflowRuns,
  getWorkflowRuns,
  resumeWorkflowRun,
} from "../controllers/workflow.controller.js";

const router = express.Router();

// All workflow operations require login.
router.use((req, res, next) => {
  console.log("WORKFLOW DEBUG:", {
    method: req.method,
    path: req.path,
    hasCookie: Boolean(req.cookies?.token),
  });
  next();
});
router.use(protect);

router.post("/generate", generateWorkflowDraft);
router.post("/", createWorkflow);
router.get("/", listWorkflows);
router.get("/runs", listAllWorkflowRuns);
router.get("/:id", getWorkflow);
router.post("/:id/run", runWorkflow);
router.get("/:id/runs", getWorkflowRuns);
router.post("/runs/:runId/resume", resumeWorkflowRun);
export default router;
