import express from "express";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import connectDB from "../../config/db.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

// =======================
// GET USER PROFILE
// =======================
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("organization_id")
      .select("-password -verificationToken");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber || "",
        profilePicture: user.profilePicture || "",
        photoURL: user.profilePicture || "", // Alias for compatibility
        qualification: user.qualification || "",
        department: user.department || "",
        bio: user.bio || "",
        prn: user.prn || null,
        authProvider: user.authProvider,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        organization_id: user.organization_id ? {
          id: user.organization_id._id,
          name: user.organization_id.name,
          logo_url: user.organization_id.logo_url,
          rollNumberLabel: user.organization_id.rollNumberLabel || "PRN",
        } : null
      },
    });
  } catch (error) {
    console.error("PROFILE ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// UPDATE USER PROFILE
// =======================
router.put("/update", isAuthenticated, async (req, res) => {
  try {
    const { name, phoneNumber, profilePicture, qualification, department, bio, prn } = req.body;

    // Safety check: Don't allow empty name
    if (name !== undefined && (name === null || name.trim() === "")) {
      return res.status(400).json({ message: "Name cannot be empty" });
    }

    // Build update object
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
    if (qualification !== undefined) updateData.qualification = qualification;
    if (department !== undefined) updateData.department = department;
    if (bio !== undefined) updateData.bio = (bio || '').substring(0, 300);

    // PRN: can only be set once (immutable), unique per organization
    if (prn !== undefined && prn !== null && prn.trim() !== "") {
      const trimmedPrn = prn.trim();
      if (!/^[a-zA-Z0-9]{1,9}$/.test(trimmedPrn)) {
        return res.status(400).json({ message: "PRN must be alphanumeric and up to 9 characters only." });
      }

      const currentUser = await User.findById(req.user._id).select("prn organization_id").lean();
      if (currentUser && currentUser.prn) {
        return res.status(400).json({ message: "PRN has already been set and cannot be changed." });
      }
      // Check uniqueness within the same organization
      if (currentUser?.organization_id) {
        const existing = await User.findOne({
          organization_id: currentUser.organization_id,
          prn: trimmedPrn,
        }).lean();
        if (existing) {
          return res.status(409).json({ message: "This PRN is already registered in your organization. Please contact your faculty or organization admin." });
        }
      }
      updateData.prn = trimmedPrn;
    }

    // Use findByIdAndUpdate
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { returnDocument: "after", runValidators: true } // Return updated doc, validate
    ).select("-password -verificationToken");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber || "",
        profilePicture: user.profilePicture || "",
        qualification: user.qualification || "",
        department: user.department || "",
        bio: user.bio || "",
        prn: user.prn || null,
        authProvider: user.authProvider,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      }
    });

  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error.message);
    res.status(500).json({ message: "Server error updating profile" });
  }
});

// =======================
// GET EMAIL PREFERENCES
// =======================
router.get("/email-preferences", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("emailNotifications").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Return with safe defaults for users who predate this feature
    const defaults = {
      digestMode: "instant",
      global: true,
      announcements: true,
      notes: true,
      quizzes: true,
      joinApproval: true,
      emailOnPost: true,
    };

    res.json({
      emailNotifications: { ...defaults, ...(user.emailNotifications || {}) },
    });
  } catch (error) {
    console.error("GET EMAIL PREFS ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// UPDATE EMAIL PREFERENCES
// =======================
router.put("/email-preferences", isAuthenticated, async (req, res) => {
  try {
    const booleanKeys = ["global", "announcements", "notes", "quizzes", "joinApproval", "emailOnPost"];
    const allowedDigestModes = ["instant", "daily", "weekly"];
    const updates = {};

    // Accept known boolean keys
    for (const key of booleanKeys) {
      if (typeof req.body[key] === "boolean") {
        updates[`emailNotifications.${key}`] = req.body[key];
      }
    }

    // Accept digestMode enum (strict validation — never trust frontend)
    if (typeof req.body.digestMode === "string" && allowedDigestModes.includes(req.body.digestMode)) {
      updates["emailNotifications.digestMode"] = req.body.digestMode;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid preferences provided" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { returnDocument: "after" }
    ).select("emailNotifications");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "Email preferences updated",
      emailNotifications: user.emailNotifications,
    });
  } catch (error) {
    console.error("UPDATE EMAIL PREFS ERROR:", error.message);
    res.status(500).json({ message: "Server error updating preferences" });
  }
});

export default router;
