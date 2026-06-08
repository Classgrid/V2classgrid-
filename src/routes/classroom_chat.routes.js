
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireClassroomMember } from '../middleware/classroom.middleware.js';

const router = express.Router();

// Initialize Supabase Client for Chat (Project 2)
const supabaseUrl = process.env.SUPABASE_CHAT_URL;
const supabaseKey = process.env.SUPABASE_CHAT_KEY;

// Lazy initialization to avoid crash if env vars missing
let supabase;

const getSupabase = () => {
    if (!supabase) {
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase Chat credentials missing in .env');
        }
        supabase = createClient(supabaseUrl, supabaseKey);
    }
    return supabase;
};

// ─────────────────────────────────────────────
// AUTO-DELETE: Purge messages older than 48 hours
// ─────────────────────────────────────────────
const MESSAGE_TTL_HOURS = 48;
let lastPurgeTime = 0;
const PURGE_COOLDOWN_MS = 10 * 60 * 1000; // Throttle: max once per 10 minutes

async function purgeOldMessages() {
    try {
        const sb = getSupabase();
        const cutoff = new Date(Date.now() - MESSAGE_TTL_HOURS * 60 * 60 * 1000).toISOString();

        const { data, error } = await sb
            .from('classroom_messages')
            .delete()
            .lt('created_at', cutoff)
            .select('id');

        if (error) {
            console.error('[Chat Cleanup] Purge error:', error.message);
            return 0;
        }

        const count = data?.length || 0;
        if (count > 0) {
            console.log(`[Chat Cleanup] Purged ${count} messages older than ${MESSAGE_TTL_HOURS}h`);
        }
        return count;
    } catch (err) {
        console.error('[Chat Cleanup] Unexpected error:', err.message);
        return 0;
    }
}

// Throttled lazy cleanup — runs silently during normal GET requests
async function lazyPurge() {
    const now = Date.now();
    if (now - lastPurgeTime < PURGE_COOLDOWN_MS) return;
    lastPurgeTime = now;
    // Fire and forget — don't block the response
    purgeOldMessages().catch(() => { });
}

// ─────────────────────────────────────────────
// CLEANUP ENDPOINT (for Vercel Cron)
// Must be BEFORE /:id to avoid Express matching "cleanup" as a classroom ID
// Secured by CRON_SECRET env variable
// ─────────────────────────────────────────────
router.get('/cleanup', async (req, res) => {
    // Verify cron secret to prevent unauthorized access
    const secret = req.headers['authorization']?.replace('Bearer ', '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const deleted = await purgeOldMessages();
    res.json({
        message: `Cleanup complete. ${deleted} messages purged.`,
        deletedCount: deleted,
        ttlHours: MESSAGE_TTL_HOURS,
        timestamp: new Date().toISOString()
    });
});

// ─────────────────────────────────────────────
// GET MESSAGES
// ─────────────────────────────────────────────
router.get('/:id', isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, before } = req.query;
        const sb = getSupabase();

        // Trigger lazy cleanup (fire-and-forget, won't slow down response)
        lazyPurge();

        let query = sb
            .from('classroom_messages')
            .select('*')
            .eq('classroom_id', id)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (before) {
            query = query.lt('created_at', before);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Return reversed (chronological) for frontend
        res.json({ messages: data.reverse() });

    } catch (err) {
        console.error('Chat fetch error:', err);
        res.status(500).json({ message: 'Error fetching messages', error: err.message });
    }
});

// ─────────────────────────────────────────────
// SEND MESSAGE
// ─────────────────────────────────────────────
router.post('/:id', isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const user = req.user;
        const sb = getSupabase();

        if (!message || !message.trim()) {
            return res.status(400).json({ message: 'Message content required' });
        }

        const newMessage = {
            classroom_id: id,
            sender_id: user._id.toString(),
            sender_name: user.name,
            user_avatar: user.profilePicture, // Optional
            message: message.trim(),
            created_at: new Date().toISOString()
        };

        const { data, error } = await sb
            .from('classroom_messages')
            .insert([newMessage])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ message: data });

    } catch (err) {
        console.error('Chat send error:', err);
        res.status(500).json({ message: 'Error sending message', error: err.message });
    }
});

export default router;

