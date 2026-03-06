import express from "express";
import { User } from "../config/database.js";
import { authenticate } from "../middleware/auth.js";
import { getRedisClient } from "../config/redis.js";

const router = express.Router();

// -- GET /profile ---------------------------------------------------------------
router.get("/profile", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Try cache first
    const redis = getRedisClient();
    const cached = await redis.get(`user:${userId}`);
    if (cached) {
      return res.json({ user: JSON.parse(cached) });
    }

    const user = await User.findByPk(userId, {
      attributes: [
        "id",
        "email",
        "first_name",
        "last_name",
        "phone",
        "role",
        "created_at",
      ],
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const payload = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
    };

    await redis.setEx(`user:${userId}`, 3600, JSON.stringify(payload));

    res.json({ user: { ...payload, createdAt: user.created_at } });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

// -- PUT /profile ---------------------------------------------------------------
router.put("/profile", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, phone } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    await user.update({
      ...(firstName !== undefined && { first_name: firstName }),
      ...(lastName !== undefined && { last_name: lastName }),
      ...(phone !== undefined && { phone }),
    });

    // Invalidate cache
    const redis = getRedisClient();
    await redis.del(`user:${userId}`);

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// -- GET /:id (admin only) ------------------------------------------------------
router.get("/:id", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const user = await User.findByPk(req.params.id, {
      attributes: [
        "id",
        "email",
        "first_name",
        "last_name",
        "phone",
        "role",
        "created_at",
      ],
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

export default router;
