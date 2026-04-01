const express = require("express");
const { chatWithAssistant } = require("../controllers/assistantController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/chat", verifyToken, chatWithAssistant);

module.exports = router;
