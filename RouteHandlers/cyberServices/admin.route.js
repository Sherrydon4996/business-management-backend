// src/routes/cyber-services/cyberServices.routes.js

import { Router } from "express";
import {
  createCyberService,
  deleteCyberService,
  updateCyberService,
} from "../../Controllers/Cyberservices/cyberservices.controller.js";
const cyberServicesAdminRouter = Router();

cyberServicesAdminRouter.post("/create", createCyberService);

cyberServicesAdminRouter.put("/update/:id", updateCyberService);

cyberServicesAdminRouter.delete(
  "/delete/:id",

  deleteCyberService,
);

export default cyberServicesAdminRouter;
