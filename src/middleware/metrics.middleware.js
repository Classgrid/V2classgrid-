// ═══════════════════════════════════════════════════════════
//  API Metrics Middleware — Zero-overhead buffered tracking
//  Strategy: All per-request work is fully sync (in-memory).
//  A setInterval flushes to MongoDB every 60 seconds.
//  This means NO async DB write overhead on the hot path.
// ═══════════════════════════════════════════════════════════

// ── In-memory buffer ──
// Key: "METHOD /api/route-pattern" → accumulator object
const buffer = new Map();

// Keep a rolling list of the last 50 failures for the dashboard
const recentFailuresGlobal = [];
const MAX_GLOBAL_FAILURES = 50;

function roundToHour(date) {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d;
}

function normalizeRoute(req) {
    // Replace MongoDB-style ObjectIDs (24 hex chars) and numeric IDs with :id
    let route = req.path
        .replace(/\/[0-9a-fA-F]{24}/g, "/:id")
        .replace(/\/\d+/g, "/:id");
    // Cap at 120 chars
    return route.slice(0, 120);
}

export function metricsMiddleware(req, res, next) {
    // Only track /api/* routes
    if (!req.path.startsWith("/api")) return next();

    const startTime = process.hrtime.bigint();

    res.on("finish", () => {
        try {
            const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
            const status = res.statusCode;
            const method = req.method;
            const route = normalizeRoute(req);
            const key = `${method} ${route}`;
            const bucket = roundToHour(new Date());
            const orgId = req.user?.organization_id?.toString() || null;

            // Accumulate in buffer
            if (!buffer.has(key)) {
                buffer.set(key, {
                    route,
                    method,
                    bucket,
                    totalRequests: 0,
                    successCount: 0,
                    clientErrCount: 0,
                    serverErrCount: 0,
                    totalRespTimeMs: 0,
                    recentFailures: [],
                    lastFailureAt: null,
                });
            }

            const entry = buffer.get(key);
            entry.totalRequests++;
            entry.totalRespTimeMs += elapsedMs;

            if (status >= 200 && status < 300) entry.successCount++;
            else if (status >= 400 && status < 500) entry.clientErrCount++;
            else if (status >= 500) {
                entry.serverErrCount++;
                const failure = {
                    statusCode: status,
                    errorMessage: `${method} ${route} → ${status}`,
                    timestamp: new Date(),
                    orgId,
                };
                entry.recentFailures = [failure, ...entry.recentFailures].slice(0, 10);
                entry.lastFailureAt = failure.timestamp;

                // Global failure log
                recentFailuresGlobal.unshift(failure);
                if (recentFailuresGlobal.length > MAX_GLOBAL_FAILURES) recentFailuresGlobal.pop();
            }
        } catch (_) {
            // Never let metrics crash the app
        }
    });

    next();
}

// ── Periodic flush to MongoDB ──
let flushTimer = null;

export function startMetricsFlush() {
    if (flushTimer) return;
    flushTimer = setInterval(flushToMongo, 60_000); // every 60 seconds
    flushTimer.unref(); // Don't block process exit
}

async function flushToMongo() {
    if (buffer.size === 0) return;
    try {
        const { default: ApiMetricBucket } = await import("../models/ApiMetricBucket.js");
        const snapshot = [...buffer.entries()];
        buffer.clear();

        const ops = snapshot.map(([_, entry]) => ({
            updateOne: {
                filter: { route: entry.route, method: entry.method, bucket: entry.bucket },
                update: {
                    $inc: {
                        totalRequests: entry.totalRequests,
                        successCount: entry.successCount,
                        clientErrCount: entry.clientErrCount,
                        serverErrCount: entry.serverErrCount,
                        totalRespTimeMs: entry.totalRespTimeMs,
                    },
                    $set: { updatedAt: new Date() },
                    ...(entry.lastFailureAt && {
                        $set: { lastFailureAt: entry.lastFailureAt, updatedAt: new Date() },
                        $push: {
                            recentFailures: {
                                $each: entry.recentFailures,
                                $slice: -10,
                            }
                        }
                    }),
                },
                upsert: true,
            }
        }));

        if (ops.length > 0) {
            await ApiMetricBucket.bulkWrite(ops, { ordered: false });
        }
    } catch (err) {
        console.error("[Metrics] Flush error:", err.message);
        // Re-buffer is complex so we accept a 60-second data loss window on error
    }
}

// ── In-memory snapshot for dashboard (real-time, before flush) ──
export function getInMemorySnapshot() {
    return [...buffer.values()];
}

export function getRecentFailures() {
    return recentFailuresGlobal;
}
