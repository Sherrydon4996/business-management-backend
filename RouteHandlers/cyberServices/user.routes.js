// src/routes/cyber-services/cyberServices.routes.js

import { Router } from "express";
import { getCyberServices } from "../../Controllers/Cyberservices/cyberservices.controller.js";

const cyberServicesUserRouter = Router();

cyberServicesUserRouter.get("/get", getCyberServices);

export default cyberServicesUserRouter;
