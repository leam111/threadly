import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";

// The API docs: ONE OpenAPI file (api/openapi.json) that describes every route.
// app.ts mounts this router only when NODE_ENV is not "production".
const openapi = JSON.parse(readFileSync(path.join(__dirname, "..", "openapi.json"), "utf8"));

const router = Router();

// the raw file, for tools like Postman (Import > Link)
router.get("/docs.json", (req, res) => {
  res.json(openapi);
});

// the Swagger page, to read the routes and try them in the browser
router.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

export default router;
