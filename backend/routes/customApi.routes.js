import express from "express";
import { protect } from "../middleware/protect.js";
import {
  createConnection,
  deleteConnection,
  listConnections,
  validateConnection,
} from "../controllers/customApi.controller.js";

const customApiRouter = express.Router();

customApiRouter.use(protect);
customApiRouter.post("/", createConnection);
customApiRouter.get("/", listConnections);
customApiRouter.post("/:id/validate", validateConnection);
customApiRouter.delete("/:id", deleteConnection);

export default customApiRouter;
