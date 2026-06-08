# 🚀 QUANTUMCHEM — FULL BUILD EXECUTION PLAN

> **Mission**: An AI-powered collaborative chemistry learning platform that integrates verified notes, contextual AI tutoring, and automated quiz generation.

---

## 📐 ARCHITECTURE OVERVIEW

### Tech Stack
- **Backend**: Express.js (ESM) + MongoDB (Mongoose) — deployed on Vercel (single serverless function)
- **Frontend**: Static HTML/CSS/JS served from `/public`
- **AI**: Groq (Llama 3.3 70B) primary + Gemini 1.5 Flash fallback
- **Auth**: JWT + Cookies, Passport.js (Google, Facebook, GitHub OAuth)
- **Email**: Brevo/Nodemailer

### Key Files Map
```
api/index.js              → Express app entry (Vercel serverless)
server.js                 → Local dev server
src/
  controllers/
    auth.controller.js    → Login, signup, OAuth callbacks
    googleAuth.controller.js → (legacy, to consolidate)
  middleware/
    auth.middleware.js     → JWT verification middleware
  models/
    User.js               → User schema
    Verification.js       → Email verification tokens
  routes/
    auth.routes.js        → Auth endpoints
    user.routes.js        → Profile endpoints
    chat.routes.js        → AI chat endpoint
  services/
    chat.js               → AI logic (Groq + Gemini)
    passport.service.js   → Passport strategies
    brevo.service.js      → Email sending
    email-templates.service.js → Email HTML templates
public/
    index.html            → Home page
    login.html            → Login/Signup page
    profile.html          → User profile
    quatumchem_assistant.html → AI chatbot
    tutorials.html        → Tutorial listing
    notes.html            → Notes page
    classroom (NEW)       → Role-based classroom dashboard
```

---

## 🧱 STAGE 1 — FOUNDATION (Architecture Lock)

### 1.1 Add `role` field to User Model
**File**: `src/models/User.js`
- Add: `role: { type: String, enum: ["student", "teacher"], default: "student" }`
- This is the single source of truth for role-based routing

### 1.2 Update Auth to include role
**File**: `src/controllers/auth.controller.js`
- `completeSignup`: Accept `role` from request body, save to User
- `login` response: Include `user.role` in response
- `oauthCallback`: Default role to "student" for new OAuth users, redirect to `/classroom`
- `getCurrentUser`: Include role in response

**File**: `src/routes/user.routes.js`
- Update profile response to include `role`

### 1.3 Update Auth Middleware
**File**: `src/middleware/auth.middleware.js`
- Add `requireRole(role)` middleware for protected routes
- Decode role from user lookup (not just JWT id)

### 1.4 Create Classroom Page
**File**: `public/classroom.html`
- Single page that checks `role` from `/api/auth/me`
- If `role === "teacher"` → render Teacher Dashboard
- If `role === "student"` → render Student Dashboard
- Both dashboards on same page, toggled by role

### 1.5 Update Login Redirect
- After login → redirect to `/classroom` instead of `/profile`
- OAuth callback → redirect to `/classroom`

### 1.6 Clean URL Routes
- Keep: `/` (home), `/classroom`, `/assistant`, `/notes`, `/login`, `/profile`
- Remove experimental and obsolete pages (subjects.html, individual subject pages) from navigation

---

## 🤖 STAGE 2 — AI BEHAVIOR ENGINEERING

### 2.1 System Prompt Upgrade
**File**: `src/services/chat.js`
- Completely rewrite SYSTEM_PROMPT to enforce structured responses
- Every response MUST contain:
  - Title
  - Simple Explanation
  - Formula (if applicable)
  - Bullet variable explanation
  - Worked example (if applicable)
  - Short summary

### 2.2 Smart Intent Detection
**File**: `src/services/chat.js`
- Before sending to AI, analyze message keywords
- Intent mapping:
  - `"calculate"` → Enforce step-by-step solution format
  - `"difference"` / `"compare"` → Enforce comparison table
  - `"define"` → Short definition + example
  - `"mechanism"` → Step-based explanation with arrows
  - `"derive"` → Full derivation with numbered steps
  - `"explain"` → Structured explanation
- Append intent-specific instructions to the system prompt dynamically

### 2.3 Conversation Memory (Session)
**File**: `src/services/chat.js` + `src/routes/chat.routes.js`
- Accept `conversationHistory[]` from frontend
- Pass previous messages to AI for context
- Frontend stores history in sessionStorage

---

## 📚 STAGE 3 — AI-POWERED NOTES SYSTEM

### 3.1 Note Model
**File**: `src/models/Note.js` (NEW)
```
{
  title: String,
  content: String (rich text or markdown),
  subject: String,
  topic: String,
  uploadedBy: ObjectId (ref: User),
  isVerified: Boolean (default: false),
  aiSummary: String,
  keyConcepts: [String],
  difficultyLevel: String (enum: easy/medium/hard),
  quizGenerated: Boolean,
  createdAt, updatedAt
}
```

### 3.2 Quiz Model
**File**: `src/models/Quiz.js` (NEW)
```
{
  noteId: ObjectId (ref: Note),
  title: String,
  questions: [{
    type: "mcq" | "short-answer",
    question: String,
    options: [String] (for MCQ),
    correctAnswer: String,
    explanation: String
  }],
  createdBy: ObjectId (ref: User),
  createdAt
}
```

### 3.3 Notes API Routes
**File**: `src/routes/notes.routes.js` (NEW)
- `POST /api/notes/upload` — Teacher uploads note (auth + role: teacher)
- `POST /api/notes/:id/verify` — AI verifies & summarizes note
- `GET /api/notes` — List all verified notes (students)
- `GET /api/notes/:id` — Get single note
- `DELETE /api/notes/:id` — Teacher deletes own note

### 3.4 Quiz API Routes
**File**: `src/routes/quiz.routes.js` (NEW)
- `POST /api/quiz/generate/:noteId` — AI generates quiz from note
- `GET /api/quiz/:noteId` — Get quiz for a note
- `POST /api/quiz/:id/submit` — Student submits quiz answers, get score

### 3.5 AI Notes Service
**File**: `src/services/notes-ai.service.js` (NEW)
- `verifyAndSummarize(noteContent)` — Returns summary, key concepts, difficulty
- `generateQuiz(noteContent, title)` — Returns 5 MCQs + 1 short answer with explanations

### 3.6 Teacher Upload UI
- In Teacher Dashboard (classroom.html):
  - Upload form (title, subject, content textarea/file)
  - "AI Verify & Summarize" button → calls verify API
  - Shows AI summary, key concepts, difficulty
  - "Generate Quiz" button → calls quiz generation API
  - "Publish" button → marks as verified

### 3.7 Student Notes Browser
- In Student Dashboard or `/notes`:
  - Browse verified notes by subject
  - View note + AI summary
  - Attempt quiz
  - Score display

---

## 🎓 STAGE 4 — CONTEXTUAL INTELLIGENCE

### 4.1 Contextual Chat API
**File**: `src/routes/chat.routes.js`
- New endpoint: `POST /api/chat/contextual`
- Accepts: `{ message, noteTitle, noteSummary, noteContent }`
- Passes context to AI so it answers within topic scope

### 4.2 Note Page Integration
- On note detail page, add button: "Ask AI About This Topic"
- Opens chat panel with topic context pre-loaded
- AI responds with awareness of the specific note

---

## 🎨 STAGE 5 — UI POLISHING

### 5.1 Design System
- Increased spacing throughout
- Clear heading hierarchy
- Large readable fonts (16px+ body)
- Clean button hierarchy (primary, secondary, ghost)
- Remove unnecessary icons
- Consistent color palette

### 5.2 Error Handling
- Loading spinners for all async operations
- try/catch with friendly error messages
- No console.error visible during demo
- Toast notifications for success/error

---

## 🔬 STAGE 6 — TESTING

### Teacher Flow
1. Login as teacher
2. Upload a note
3. Click "AI Verify & Summarize" → see result
4. Click "Generate Quiz" → see quiz
5. Click "Publish"

### Student Flow
1. Login as student
2. Browse verified notes
3. Read note + summary
4. Attempt quiz → see score
5. Click "Ask AI About This Topic" → contextual chat

### Edge Cases
- Long note content
- Short note content
- Slow internet
- Invalid file upload
- Empty quiz submission

---

## 📋 EXECUTION ORDER

| Step | Task | Status |
|------|------|--------|
| 1 | Add `role` to User model | ⬜ |
| 2 | Update auth controller (role in signup, login, response) | ⬜ |
| 3 | Add `requireRole` middleware | ⬜ |
| 4 | Update login redirect to `/classroom` | ⬜ |
| 5 | Create `classroom.html` with role-based dashboards | ⬜ |
| 6 | Upgrade AI system prompt | ⬜ |
| 7 | Add intent detection to chat.js | ⬜ |
| 8 | Add conversation memory | ⬜ |
| 9 | Create Note model | ⬜ |
| 10 | Create Quiz model | ⬜ |
| 11 | Create notes-ai.service.js | ⬜ |
| 12 | Create notes routes | ⬜ |
| 13 | Create quiz routes | ⬜ |
| 14 | Build teacher upload UI in classroom | ⬜ |
| 15 | Build student notes browser | ⬜ |
| 16 | Add contextual chat endpoint | ⬜ |
| 17 | Add "Ask AI" button on note pages | ⬜ |
| 18 | UI polish pass | ⬜ |
| 19 | Error handling pass | ⬜ |
| 20 | Full flow testing | ⬜ |
