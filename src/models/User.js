import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // 🎓 Role-based access (determines dashboard view)
    role: {
      type: String,
      enum: ["student", "teacher", "faculty", "org_admin", "super_admin"],
      default: "student",
    },

    status: {
      type: String,
      enum: ["active", "suspended", "blocked", "deleted"],
      default: "active",
    },

    organization_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    // 🆔 PRN / Roll Number — set once by student, immutable, unique per org
    prn: {
      type: String,
      sparse: true,
      trim: true,
      default: null,
    },



    // 📚 Subject assignment (for teachers only)
    subject: {
      type: String,
      enum: ["science", "physics", "cpp", "mathematics", null],
      default: null,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    phoneNumber: {
      type: String,
      default: "",
    },

    // 🎓 Faculty profile fields
    qualification: {
      type: String,
      default: "",
    },

    department: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },

    // 🔐 hashed password (for manual auth)
    password: {
      type: String, // hashed
      default: null,
      select: false, // Don't return by default
    },

    // ⏳ password expiry (optional policy)
    passwordExpiresAt: {
      type: Date,
      default: null,
    },

    // 🗓️ Track password changes for JWT invalidation
    passwordChangedAt: {
      type: Date,
    },

    // Password Reset
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // Org Admin Activation Token (secure single-use, expires 24h)
    activationToken: { type: String, default: null },
    activationTokenExpires: { type: Date, default: null },

    // Force password reset on next login (set for admin-created faculty accounts)
    mustResetPassword: {
      type: Boolean,
      default: false,
    },

    // List of all auth providers used by this user
    linkedProviders: {
      type: [String],
      default: ["manual"],
    },

    // Current/Most recent auth provider used for this session
    authProvider: {
      type: String,
      enum: ["manual", "google", "facebook", "github", "linkedin"],
      default: "manual",
    },

    // Social IDs
    googleId: { type: String, unique: true, sparse: true },
    facebookId: { type: String, unique: true, sparse: true },
    githubId: { type: String, unique: true, sparse: true },
    linkedinId: { type: String, unique: true, sparse: true },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // 🔒 Trusted devices — suppress login notification emails for known devices
    trustedDevices: [{
      fingerprint: { type: String, required: true }, // SHA-256 hash of userAgent + IP
      browser: { type: String, default: "" },
      os: { type: String, default: "" },
      ipHash: { type: String, default: "" }, // SHA-256 hash of IP
      addedAt: { type: Date, default: Date.now },
    }],

    // 📧 Email notification preferences
    emailNotifications: {
      // Delivery mode: instant (default), daily digest, weekly summary
      digestMode: { type: String, enum: ['instant', 'daily', 'weekly'], default: 'instant' },
      // Reliable digest tracking — queries from this date, not fixed 24h window
      lastDigestSentAt: { type: Date, default: null },
      // Global kill switch — if false, NO emails are sent
      global: { type: Boolean, default: true },
      // Per-type toggles (students + faculty)
      announcements: { type: Boolean, default: true },
      notes: { type: Boolean, default: true },
      quizzes: { type: Boolean, default: true },
      joinApproval: { type: Boolean, default: true },
      // Faculty-only: whether posting content triggers student emails
      emailOnPost: { type: Boolean, default: true },
      // Attendance report preference
      attendanceReportMode: { type: String, enum: ['daily', 'weekly', 'off'], default: 'off' },
    },

    // 🧪 Demo / Role Sandbox flags
    is_demo: {
      type: Boolean,
      default: false,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 🧪 Sandbox isolation — sandbox users cannot affect real data/analytics
    isSandbox: {
      type: Boolean,
      default: false,
    },

    sandboxCreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Plaintext password for sandbox accounts only (so admin can view it in the dashboard)
    sandboxPassword: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// email index is already created by unique: true
userSchema.index({ organization_id: 1 });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true }); // fast reset-token lookups
userSchema.index({ activationToken: 1 }, { sparse: true }); // fast activation-token lookups
// PRN unique per organization (same PRN cannot exist twice in one org)
// partialFilterExpression ensures null PRNs don't conflict
userSchema.index(
  { organization_id: 1, prn: 1 },
  { unique: true, partialFilterExpression: { prn: { $type: "string" } } }
);


export default mongoose.models.User || mongoose.model("User", userSchema);
