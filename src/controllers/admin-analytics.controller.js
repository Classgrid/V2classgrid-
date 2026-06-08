import SystemSettings from "../models/SystemSettings.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import EmailJob from "../models/EmailJob.js";
import Classroom from "../models/Classroom.js";
import { studentNotesClient } from "../config/supabaseClient.js";

// GET /api/admin/system-settings
export const getSystemSettings = async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({});
        }
        res.status(200).json(settings);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/system-settings
export const updateSystemSettings = async (req, res) => {
    try {
        const updates = req.body;
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = new SystemSettings(updates);
        } else {
            Object.assign(settings, updates);
        }
        await settings.save();
        res.status(200).json({ message: "Settings updated", settings });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/admin/usage/:orgId
export const getOrgUsage = async (req, res) => {
    try {
        const { orgId } = req.params;

        // 1. Supabase Storage (list files in bucket with pagination)
        let totalStorageBytes = 0;
        let fileCount = 0;
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: files, error: storageError } = await studentNotesClient.storage
                .from('notes-files')
                .list(`student-notes/${orgId}`, { limit, offset });

            if (storageError) {
                console.error("Supabase Storage Error:", storageError);
                break; // Stop pagination on error, return what we have
            }

            if (!files || files.length === 0) {
                hasMore = false;
            } else {
                files.forEach(f => {
                    if (f.metadata && f.metadata.size) {
                        totalStorageBytes += f.metadata.size;
                        fileCount++;
                    }
                });

                if (files.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            }
        }

        // 2. Supabase DB rows (notes count)
        const { count, error: dbError } = await studentNotesClient
            .from('student_notes')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId);

        // 3. Email counts for this org
        const emailCount = await EmailJob.countDocuments({ organizationId: orgId });

        // If the org has legacy emails linked to users, we might miss them, so let's check users too for a more accurate count if it's 0.
        let totalEmails = emailCount;
        if (totalEmails === 0) {
            const orgUsers = await User.find({ organization_id: orgId }).select('_id');
            const userIds = orgUsers.map(u => u._id);
            if (userIds.length > 0) {
                totalEmails = await EmailJob.countDocuments({ userId: { $in: userIds } });
            }
        }

        res.status(200).json({
            storage: {
                bytes: totalStorageBytes,
                mb: (totalStorageBytes / (1024 * 1024)).toFixed(2),
                fileCount
            },
            db: {
                notesCount: count || 0
            },
            email: {
                totalSent: totalEmails
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/admin/email-analytics (optional ?orgId=...)
export const getEmailAnalytics = async (req, res) => {
    try {
        const { orgId } = req.query;
        let filter = {};

        if (orgId) {
            const orgUsers = await User.find({ organization_id: orgId }).select('_id');
            const userIds = orgUsers.map(u => u._id);
            filter = {
                $or: [
                    { organizationId: orgId },
                    { userId: { $in: userIds } }
                ]
            };
        }

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [total, daily, monthly] = await Promise.all([
            EmailJob.countDocuments(filter),
            EmailJob.countDocuments({ ...filter, createdAt: { $gte: startOfDay } }),
            EmailJob.countDocuments({ ...filter, createdAt: { $gte: startOfMonth } }),
        ]);

        // Breakdown by type (all-time)
        const breakdown = await EmailJob.aggregate([
            { $match: Object.keys(filter).length ? filter : {} },
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);
        const typeBreakdown = {};
        breakdown.forEach(b => { typeBreakdown[b._id || 'other'] = b.count; });

        // Per-day chart for current month
        const dailyChartRaw = await EmailJob.aggregate([
            {
                $match: {
                    ...(Object.keys(filter).length ? filter : {}),
                    createdAt: { $gte: startOfMonth }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill in all days of the month with 0 for missing days
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const todayDay = now.getDate();
        const dailyChart = [];
        const rawMap = {};
        dailyChartRaw.forEach(d => { rawMap[d._id] = d.count; });

        for (let day = 1; day <= todayDay; day++) {
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dailyChart.push({ date: dateStr, count: rawMap[dateStr] || 0 });
        }

        res.status(200).json({ total, daily, monthly, typeBreakdown, dailyChart });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// GET /api/admin/dashboard-analytics
export const getDashboardAnalytics = async (req, res) => {

    try {
        // 1. Notes tracking (from Supabase)
        const { data: allNotes, error } = await studentNotesClient
            .from('student_notes')
            .select('status, id');

        let notesStats = { total: 0, pending: 0, approved: 0, rejected: 0 };
        if (!error && allNotes) {
            notesStats.total = allNotes.length;
            allNotes.forEach(n => {
                if (n.status === 'pending') notesStats.pending++;
                else if (n.status === 'approved') notesStats.approved++;
                else if (n.status === 'rejected') notesStats.rejected++;
            });
        }

        // 2. Student Growth metrics
        const users = await User.find({ role: 'student' }).select('createdAt organization_id').lean();

        const now = new Date();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOf7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let growth = {
            total: users.length,
            today: 0,
            last7Days: 0,
            thisMonth: 0
        };

        users.forEach(u => {
            const d = new Date(u.createdAt);
            if (d >= startOfDay) growth.today++;
            if (d >= startOf7Days) growth.last7Days++;
            if (d >= startOfMonth) growth.thisMonth++;
        });

        res.status(200).json({
            notes: notesStats,
            students: growth
        });
    } catch (err) {
        console.error('getDashboardAnalytics error:', err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/admin/system-activity
export const getSystemActivity = async (req, res) => {
    try {
        const [recentLogins, recentOrgs, failedEmails, newUsers, suspendedUsers, newClassrooms] = await Promise.all([
            // 1. Recent logins
            User.find({ lastLoginAt: { $ne: null }, is_demo: { $ne: true } })
                .sort({ lastLoginAt: -1 }).limit(5)
                .select('name email role lastLoginAt').lean(),

            // 2. Recent org onboardings
            Organization.find()
                .sort({ createdAt: -1 }).limit(4)
                .select('name plan createdAt').lean(),

            // 3. Failed emails
            EmailJob.find({ status: 'failed' })
                .sort({ updatedAt: -1 }).limit(4)
                .select('to type error updatedAt').lean(),

            // 4. New student signups (last 7 days)
            User.find({
                role: 'student',
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }).sort({ createdAt: -1 }).limit(5)
                .select('name email createdAt').lean(),

            // 5. Recently suspended / blocked users
            User.find({ status: { $in: ['suspended', 'blocked'] } })
                .sort({ updatedAt: -1 }).limit(4)
                .select('name email status role updatedAt').lean(),

            // 6. New classrooms (last 7 days)
            Classroom.find({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }).sort({ createdAt: -1 }).limit(4)
                .select('name subject createdAt').lean(),
        ]);

        // 7. Recent note uploads from Supabase
        let formattedNotes = [];
        try {
            const { data: recentNotes } = await studentNotesClient
                .from('student_notes')
                .select('title, uploaded_by_name, created_at')
                .order('created_at', { ascending: false })
                .limit(4);
            if (recentNotes) {
                formattedNotes = recentNotes.map(n => ({
                    type: 'note_upload',
                    message: `"${n.title || 'Untitled'}" uploaded${n.uploaded_by_name ? ' by ' + n.uploaded_by_name : ''}`,
                    time: n.created_at
                }));
            }
        } catch (e) { /* non-critical */ }

        const formattedLogins = recentLogins.map(u => ({
            type: 'login',
            message: `${u.name || 'User'} (${(u.role || 'unknown').replace('_', ' ')}) logged in`,
            time: u.lastLoginAt,
            metadata: { email: u.email }
        }));

        const formattedOrgs = recentOrgs.map(o => ({
            type: 'org_approved',
            message: `Organization "${o.name || 'Unknown'}" was onboarded (${o.plan || 'FREE'})`,
            time: o.createdAt
        }));

        const formattedEmails = failedEmails.map(e => ({
            type: 'email_failed',
            message: `Failed ${e.type || 'unknown'} email to ${e.to || 'unknown'}`,
            time: e.updatedAt,
            error: e.error
        }));

        const formattedSignups = newUsers.map(u => ({
            type: 'signup',
            message: `New student joined: ${u.name || u.email || 'Unknown'}`,
            time: u.createdAt
        }));

        const formattedSuspended = suspendedUsers.map(u => ({
            type: u.status === 'blocked' ? 'user_blocked' : 'user_suspended',
            message: `${u.name || u.email} (${(u.role || 'student').replace('_', ' ')}) was ${u.status}`,
            time: u.updatedAt
        }));

        const formattedClassrooms = newClassrooms.map(c => ({
            type: 'classroom_created',
            message: `New classroom: "${c.name}"${c.subject ? ' — ' + c.subject : ''}`,
            time: c.createdAt
        }));

        let timeline = [
            ...formattedLogins,
            ...formattedOrgs,
            ...formattedEmails,
            ...formattedSignups,
            ...formattedSuspended,
            ...formattedClassrooms,
            ...formattedNotes
        ];
        timeline.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

        res.status(200).json(timeline.slice(0, 20));
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/admin/global-storage
export const getGlobalStorageUsage = async (req, res) => {
    try {
        const orgs = await Organization.find().select('_id').lean();

        // 1. Supabase DB rows (notes count) across all orgs
        const { count, error: dbError } = await studentNotesClient
            .from('student_notes')
            .select('*', { count: 'exact', head: true });

        // 2. Estimate storage bytes
        // Doing storage.list() for every single organization is O(N) API calls and too slow for a dashboard.
        // We use an estimated average of 2.5MB per PDF note file.
        const assumedBytesPerFile = 2.5 * 1024 * 1024;
        const totalStorageBytes = (count || 0) * assumedBytesPerFile;

        res.status(200).json({
            storage: {
                bytes: totalStorageBytes,
                mb: (totalStorageBytes / (1024 * 1024)).toFixed(0),
                fileCount: count || 0,
                avgMbPerOrg: orgs.length > 0 ? ((totalStorageBytes / (1024 * 1024)) / orgs.length).toFixed(1) : 0
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
