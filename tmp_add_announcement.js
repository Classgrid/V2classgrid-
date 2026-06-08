import fs from 'fs';

const content = fs.readFileSync('src/controllers/organization.controller.js', 'utf8');

const missingFunctions = `
// ─────────────────────────────────────────────────────────
// SMART ORGANIZATION ANNOUNCEMENTS API
// ─────────────────────────────────────────────────────────
const checkAnnouncementPlanLimits = async (organization_id, target_type, target_classrooms) => {
    const org = await Organization.findById(organization_id);
    const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);

    if (effectivePlan === 'FREE') {
        if (target_type === 'all') throw new Error('PLAN_LIMIT_REACHED: Send to All is a Pro feature.');
        if (target_classrooms && target_classrooms.length > 5) throw new Error('PLAN_LIMIT_REACHED: Free plan is limited to maximum 5 target classrooms per announcement.');
    } else if (effectivePlan === 'PLUS') {
        if (target_type === 'all') throw new Error('PLAN_LIMIT_REACHED: Send to All is a Pro feature.');
        if (target_classrooms && target_classrooms.length > 10) throw new Error('PLAN_LIMIT_REACHED: Plus plan is limited to maximum 10 target classrooms per announcement.');
    }
    return effectivePlan;
};

export const createOrganizationAnnouncement = async (req, res) => {
    try {
        await connectDB();
        const { title, content, type, target_type, target_classrooms, status, expires_at } = req.body;
        const organization_id = req.user.organization_id;
        if (!organization_id) return res.status(403).json({ message: 'You do not belong to an organization' });

        try {
            const effectivePlan = await checkAnnouncementPlanLimits(organization_id, target_type, target_classrooms);
            if (status === 'scheduled' && effectivePlan === 'FREE') return res.status(403).json({ message: 'Scheduling announcements is a Pro feature.', code: 'PLAN_LIMIT_REACHED' });

            const cleanContent = sanitizeHtml(content, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'style' ]),
                allowedAttributes: {
                    ...sanitizeHtml.defaults.allowedAttributes,
                    '*': ['style', 'class']
                }
            });

            const announcement = new OrganizationAnnouncement({
                title,
                content: cleanContent,
                type: type || 'announcement',
                organization_id,
                created_by: req.user._id,
                target_type,
                target_classrooms: target_type === 'specific' ? target_classrooms : [],
                plan_snapshot: effectivePlan,
                status: status || 'published',
                expires_at: expires_at || null,
                sent_at: status === 'published' ? Date.now() : null,
            });

            await announcement.save();

            const { default: ActivityLog } = await import('../models/ActivityLog.js');
            ActivityLog.create({
                user: req.user._id,
                action: 'announcement_created',
                targetType: 'org_announcement',
                targetId: announcement._id,
            }).catch(e => console.error('Failed to log activity:', e));

            res.status(201).json({ message: 'Announcement created successfully', announcement });
        } catch (limitErr) {
            return res.status(403).json({ message: limitErr.message.replace('PLAN_LIMIT_REACHED: ', ''), code: 'PLAN_LIMIT_REACHED' });
        }
    } catch (err) {
        console.error('createOrganizationAnnouncement error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export const getOrganizationAnnouncements = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) return res.status(403).json({ message: 'You do not belong to an organization' });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = { organization_id };
        if (req.user.role !== 'org_admin' && req.user.role !== 'super_admin') {
            query.status = 'published';
            query.$or = [{ expires_at: { $gt: Date.now() } }, { expires_at: null }];
        }

        const total = await OrganizationAnnouncement.countDocuments(query);
        const announcements = await OrganizationAnnouncement.find(query)
            .populate('created_by', 'name email')
            .populate('target_classrooms', 'name subject')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({ announcements: announcements, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
        console.error('getOrganizationAnnouncements error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export const updateOrganizationAnnouncement = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { title, content, type, target_type, target_classrooms, status, expires_at } = req.body;
        const organization_id = req.user.organization_id;

        const announcement = await OrganizationAnnouncement.findOne({ _id: id, organization_id });
        if (!announcement) return res.status(404).json({ message: 'Announcement not found' });

        if (announcement.status === 'published' && status === 'draft') return res.status(400).json({ message: 'Cannot revert a published announcement to draft.' });

        try {
            const effectivePlan = await checkAnnouncementPlanLimits(organization_id, target_type || announcement.target_type, target_classrooms || announcement.target_classrooms);
            if (status === 'scheduled' && effectivePlan === 'FREE') return res.status(403).json({ message: 'Scheduling announcements is a Pro feature.', code: 'PLAN_LIMIT_REACHED' });

            if (title) announcement.title = title;
            if (content) {
                announcement.content = sanitizeHtml(content, {
                    allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'style' ]),
                    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style', 'class'] }
                });
            }
            if (type) announcement.type = type;
            if (expires_at !== undefined) announcement.expires_at = expires_at;
            if (target_type) {
                announcement.target_type = target_type;
                announcement.target_classrooms = target_type === 'specific' ? (target_classrooms || []) : [];
            }
            if (status === 'published' && announcement.status !== 'published') {
                announcement.status = 'published';
                announcement.sent_at = Date.now();
            } else if (status) {
                announcement.status = status;
            }

            await announcement.save();
            res.json({ message: 'Announcement updated successfully', announcement });
        } catch (limitErr) {
            return res.status(403).json({ message: limitErr.message.replace('PLAN_LIMIT_REACHED: ', ''), code: 'PLAN_LIMIT_REACHED' });
        }
    } catch (err) {
        console.error('updateOrganizationAnnouncement error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export const deleteOrganizationAnnouncement = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        const result = await OrganizationAnnouncement.deleteOne({ _id: id, organization_id });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Announcement not found' });

        res.json({ message: 'Announcement deleted successfully' });
    } catch (err) {
        console.error('deleteOrganizationAnnouncement error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export const getOrganizationAnnouncementStats = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        const org = await Organization.findById(organization_id);
        const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);

        if (effectivePlan === 'FREE') return res.status(403).json({ message: 'Announcement Delivery Analytics is a Pro feature.', code: 'PLAN_LIMIT_REACHED' });

        const announcement = await OrganizationAnnouncement.findOne({ _id: id, organization_id });
        if (!announcement) return res.status(404).json({ message: 'Announcement not found' });

        let targetSize = 0;
        if (announcement.target_type === 'all') {
             targetSize = await User.countDocuments({ organization_id });
        } else {
             const classrooms = await Classroom.find({ _id: { $in: announcement.target_classrooms } });
             targetSize = classrooms.reduce((acc, c) => acc + (c.students ? c.students.length : 0) + 1, 0);
        }

        res.json({
            stats: {
                views: announcement.views_count || 0,
                targetAudienceSize: targetSize,
                reachPercentage: targetSize > 0 ? Math.min(100, Math.round(((announcement.views_count || 0) / targetSize) * 100)) : 0,
            }
        });
    } catch (err) {
        console.error('getOrganizationAnnouncementStats error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
`;

fs.writeFileSync('src/controllers/organization.controller.js', content + '\n' + missingFunctions);
console.log('Appended missing exports to organization.controller.js');
