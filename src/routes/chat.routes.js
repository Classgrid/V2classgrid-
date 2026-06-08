
import express from 'express';
import multer from 'multer';
import { getChatReply, getVisionReply } from '../services/chat.js';
import { parsePDF } from '../services/file-parser.js';
import connectDB from '../../config/db.js';
import Classroom from '../models/Classroom.js';
import ClassroomMembership from '../models/ClassroomMembership.js';
import { classroomClient } from '../config/supabaseClient.js';

const router = express.Router();

// Memory storage for Vercel/Serverless compatibility
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 } // 5MB limit
});

/**
 * Build classroom context string for AI
 * Includes: classroom info, materials (with latest PDF text), announcements, quizzes
 */
async function getClassroomContext(classroomId) {
  try {
    await connectDB();
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return '';

    let context = `Classroom: ${classroom.name || 'Unnamed'}`;
    if (classroom.subject) context += `\nSubject: ${classroom.subject}`;
    if (classroom.description) context += `\nDescription: ${classroom.description}`;

    // Fetch materials from Supabase (include file_url for PDF extraction)
    const { data: materials } = await classroomClient
      .from('classroom_content')
      .select('title, type, description, file_url, created_at')
      .eq('classroom_id', classroomId)
      .eq('content_type', 'materials')
      .order('created_at', { ascending: false })
      .limit(10);

    if (materials?.length) {
      context += `\n\nRecent Materials (${materials.length}):`;
      materials.forEach((m, i) => {
        context += `\n${i + 1}. "${m.title}" (${m.type || 'file'})`;
        if (m.description) context += ` — ${m.description}`;
      });

      // Try to extract text from the latest PDF material
      const latestPdf = materials.find(m =>
        m.file_url && (m.type === 'pdf' || m.file_url.endsWith('.pdf') || m.title?.toLowerCase().endsWith('.pdf'))
      );

      if (latestPdf?.file_url) {
        try {
          console.log(`Fetching latest PDF for AI context: "${latestPdf.title}"`);
          const pdfRes = await fetch(latestPdf.file_url);
          if (pdfRes.ok) {
            const buffer = Buffer.from(await pdfRes.arrayBuffer());
            const pdfText = await parsePDF(buffer);
            // Limit to ~5000 chars to avoid overloading the prompt
            const trimmedText = pdfText.substring(0, 5000);
            context += `\n\n[Latest PDF Content: "${latestPdf.title}"]\n${trimmedText}\n[End of PDF Content]`;
          }
        } catch (pdfErr) {
          console.warn('Could not extract PDF text for AI context:', pdfErr.message);
        }
      }
    }

    // Fetch announcements (FULL text, not truncated)
    const { data: announcements } = await classroomClient
      .from('classroom_content')
      .select('message, created_at')
      .eq('classroom_id', classroomId)
      .eq('content_type', 'announcements')
      .order('created_at', { ascending: false })
      .limit(5);

    if (announcements?.length) {
      context += `\n\nRecent Announcements:`;
      announcements.forEach((a, i) => {
        context += `\n${i + 1}. ${a.message || '(no content)'}`;
      });
    }

    // Fetch quizzes
    const { data: quizzes } = await classroomClient
      .from('classroom_content')
      .select('title, description, duration')
      .eq('classroom_id', classroomId)
      .eq('content_type', 'quizzes')
      .order('created_at', { ascending: false })
      .limit(5);

    if (quizzes?.length) {
      context += `\n\nQuizzes:`;
      quizzes.forEach((q, i) => {
        context += `\n${i + 1}. "${q.title}" (${q.duration || 30} min)`;
        if (q.description) context += ` — ${q.description}`;
      });
    }

    return context;
  } catch (err) {
    console.error('Failed to fetch classroom context:', err.message);
    return '';
  }
}

/**
 * GET /api/chat/classroom-context/:classroomId
 * Returns recent classroom activity as JSON for the assistant welcome screen
 */
router.get('/classroom-context/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    if (!classroomId) return res.status(400).json({ error: 'classroomId required' });

    await connectDB();
    const classroom = await Classroom.findById(classroomId).select('name subject description').lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // Fetch recent announcements
    const { data: announcements } = await classroomClient
      .from('classroom_content')
      .select('id, message, created_at')
      .eq('classroom_id', classroomId)
      .eq('content_type', 'announcements')
      .order('created_at', { ascending: false })
      .limit(3);

    // Fetch recent materials/notes
    const { data: materials } = await classroomClient
      .from('classroom_content')
      .select('id, title, type, description, created_at')
      .eq('classroom_id', classroomId)
      .eq('content_type', 'materials')
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch recent quizzes
    const { data: quizzes } = await classroomClient
      .from('classroom_content')
      .select('id, title, description, duration, created_at')
      .eq('classroom_id', classroomId)
      .eq('content_type', 'quizzes')
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      classroom: { name: classroom.name, subject: classroom.subject || '' },
      announcements: announcements || [],
      materials: materials || [],
      quizzes: quizzes || []
    });
  } catch (err) {
    console.error('Classroom context fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch classroom context' });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    let message = req.body.message || '';
    const file = req.file;
    const mode = req.body.mode || 'chat';
    const classroomId = req.body.classroomId || '';

    // Build user profile context
    const userName = req.body.userName || req.body.username || req.body.displayName || 'Student';
    const userPrn = req.body.userPrn || '';
    const userRole = req.body.userRole || 'Student';
    const userDept = req.body.userDept || '';
    const userOrg = req.body.userOrg || '';
    const userId = req.body.userId || '';
    const isFirstMessage = req.body.isFirstMessage === 'true' || req.body.isFirstMessage === true;

    let userContext = '';

    // Always build the profile if we have ANY identifier
    userContext = `\n[STUDENT PROFILE]`;
    userContext += `\nName: ${userName}`;
    if (userPrn) userContext += `\nPRN/Roll No: ${userPrn}`;
    if (userRole) userContext += `\nRole: ${userRole}`;
    if (userDept) userContext += `\nDepartment: ${userDept}`;
    if (userOrg) userContext += `\nCollege/Organization: ${userOrg}`;

    // Try to get enrolled classrooms count
    if (userId) {
      try {
        await connectDB();
        // The ClassroomMembership schema uses "student" ObjectId and references "Classroom"
        const memberships = await ClassroomMembership.find({ student: userId, status: 'approved' }).populate('classroom', 'name subject').lean();
        if (memberships.length) {
          userContext += `\nEnrolled Classrooms: ${memberships.map(m => m.classroom ? m.classroom.name : 'Unknown Classroom').join(', ')}`;
        } else {
          userContext += `\nEnrolled Classrooms: 0 (New User)`;

          if (isFirstMessage) {
            userContext += `\n
[NEW USER ONBOARDING INSTRUCTIONS]
This student hasn't joined any classrooms yet. They are brand new!
Greet them enthusiastically as "Hi ${userName}!"
Tell them you are excited to help them, and clearly explain the following steps using emojis:
1. **Join a Classroom**: "First, ask your teacher for a 10-digit Classroom Code to join their class! 🏫"
2. **Auto-Link**: "Once you join your first classroom, you are automatically linked to your college/organization."
3. **Features**: "After joining, I can help you with lecture notes, quizzes, announcements, and even simulate oral viva exams! 🎓"
4. **Honor Code**: "Remember to uphold the Classgrid Honor Code as we learn together."
Keep the tone very warm, helpful, and structured.
[END ONBOARDING INSTRUCTIONS]`;
          }
        }
      } catch (e) { /* non-critical */ }
    }

    userContext += `\n[END STUDENT PROFILE]`;

    if (isFirstMessage) {
      userContext += '\n[INSTRUCTION: This is the first message of the session. Please include a short, professional greeting using the student\'s first name as instructed.]';
    } else {
      userContext += '\n[INSTRUCTION: This is an ongoing conversation. DO NOT include any greetings or welcome messages. Do NOT use the student\'s name. Start your response directly with the answer/information.]';
    }

    // Fetch classroom context if provided
    let classroomContext = '';
    if (classroomId) {
      classroomContext = await getClassroomContext(classroomId);
    }

    // Merge user + classroom context
    const fullContext = (userContext + '\n' + classroomContext).trim();

    // If file is present
    if (file) {
      console.log(`Processing file: ${file.originalname} (${file.mimetype})`);

      if (file.mimetype === 'application/pdf') {
        const pdfText = await parsePDF(file.buffer);
        message += `\n\n[Attached PDF Content: ${file.originalname}]\n${pdfText}\n[End of PDF]`;
        const reply = await getChatReply(message, 'groq', mode, fullContext);
        return res.json({ reply });

      } else if (file.mimetype.startsWith('image/')) {
        const base64Image = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        const reply = await getVisionReply(message, base64Image, mimeType, 'groq');
        return res.json({ reply });
      }
    }

    // Standard text-only chat
    const reply = await getChatReply(message, 'groq', mode, fullContext);
    res.json({ reply });

  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

export default router;
