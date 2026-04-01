const express = require("express");
const {
  getMoveInChecklist,
  getStudentInsights,
  upsertMoveInChecklist,
} = require("../controllers/studentController");
const { authorizeRoles, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/insights",
  verifyToken,
  authorizeRoles("student"),
  getStudentInsights
);
router.get(
  "/checklist",
  verifyToken,
  authorizeRoles("student"),
  getMoveInChecklist
);
router.put(
  "/checklist",
  verifyToken,
  authorizeRoles("student"),
  upsertMoveInChecklist
);

module.exports = router;
