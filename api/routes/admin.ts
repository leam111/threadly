import {Router} from "express";
import {requireAuth} from "../middleware/requireAuth";
import {requireRole} from "../middleware/requireRole";
const router = Router();



router.get("/leaaa", requireAuth, requireRole(["admin","superadmin"]), (req, res) => {
  res.json({ message: "Welcome to the admin route!" });
});

export default router;