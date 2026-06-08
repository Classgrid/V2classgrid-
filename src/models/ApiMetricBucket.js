import mongoose from "mongoose";

// ═══════════════════════════════════════════════════════════
//  ApiMetrics — In-memory aggregated request tracking
//  Strategy: Buffer in-process, flush to DB every 60s.
//  Per-route stats are aggregated (not per-request docs) to
//  avoid write pressure at scale.
// ═══════════════════════════════════════════════════════════

const ApiMetricBucketSchema = new mongoose.Schema({
    // e.g. "GET /api/auth/me"
    route: { type: String, required: true },
    method: { type: String, required: true },
    // Hour-level bucketing — one doc per route per hour
    bucket: { type: Date, required: true },   // rounded to hour
    totalRequests: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },   // 2xx
    clientErrCount: { type: Number, default: 0 },   // 4xx
    serverErrCount: { type: Number, default: 0 },   // 5xx
    totalRespTimeMs: { type: Number, default: 0 }, // sum — divide by totalRequests for avg
    // Rolling last-10 failures (capped array)
    recentFailures: [{
        statusCode: Number,
        errorMessage: String,
        timestamp: Date,
        orgId: String,
    }],
    lastFailureAt: { type: Date },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

ApiMetricBucketSchema.index({ route: 1, method: 1, bucket: -1 });
ApiMetricBucketSchema.index({ bucket: -1 });

export default mongoose.model("ApiMetricBucket", ApiMetricBucketSchema);
