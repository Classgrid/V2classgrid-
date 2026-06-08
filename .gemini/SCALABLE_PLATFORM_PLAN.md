# QuantumChem Scalable Platform — Implementation Plan

## Architecture Overview

### Current State
- MongoDB (via Mongoose) for users, note views, quizzes
- Supabase for content storage (materials, quizzes, announcements)
- JWT-based auth with role system (student/teacher)
- Single hardcoded subjects (chemistry, physics, cpp, mathematics)

### Target State
- **Classroom Model** (MongoDB) — Dynamic classrooms created by teachers
- **ClassroomMembership Model** (MongoDB) — Join requests with pending/approved/rejected status
- **ActivityLog Model** (MongoDB) — Comprehensive engagement tracking
- **Message Model** (MongoDB) — Group + private chat with realtime via polling
- **Enhanced auth middleware** — Classroom-level access control

---

## Phase 1: Backend Models

### 1.1 Classroom Model
```
- name, description, subject, classCode (unique invite code)
- teacher (ref: User)
- settings (allowJoinRequests, maxStudents)
- timestamps
```

### 1.2 ClassroomMembership Model
```
- classroom (ref: Classroom)
- student (ref: User)
- status: pending | approved | rejected
- requestedAt, respondedAt
- respondedBy (ref: User)
```

### 1.3 ActivityLog Model
```
- user (ref: User)
- classroom (ref: Classroom)
- action: view_material | view_announcement | view_quiz | submit_quiz | open_chat
- targetType: material | announcement | quiz | chat
- targetId (Supabase ID or Mongo ID)
- targetTitle
- metadata (JSON - extra context)
- timestamp
```

### 1.4 Message Model
```
- classroom (ref: Classroom)
- sender (ref: User)
- receiver (ref: User, null for group messages)
- content (text)
- messageType: group | private
- timestamp
```

## Phase 2: Backend Routes

### 2.1 Classroom Routes (`/api/classrooms`)
- POST `/` — Create classroom (teacher only)
- GET `/` — List classrooms (filtered by role)
- GET `/:id` — Get classroom details (members only)
- PUT `/:id` — Update classroom (owner only)
- DELETE `/:id` — Delete classroom (owner only)
- POST `/:id/join` — Request to join
- GET `/:id/requests` — List join requests (teacher)
- PUT `/:id/requests/:requestId` — Approve/reject (teacher)
- GET `/:id/members` — List approved members
- DELETE `/:id/members/:userId` — Remove member

### 2.2 Activity Routes (`/api/activity`)
- POST `/log` — Log activity
- GET `/classroom/:id` — Get classroom activity (teacher)
- GET `/classroom/:id/analytics` — Engagement analytics (teacher)

### 2.3 Messaging Routes (`/api/messages`)
- POST `/:classroomId` — Send message (group or private)
- GET `/:classroomId` — Get group messages
- GET `/:classroomId/private/:userId` — Get private thread
- GET `/:classroomId/threads` — List private threads (teacher)

## Phase 3: Middleware

### 3.1 Classroom Access Middleware
- `requireClassroomMember` — Only approved members
- `requireClassroomOwner` — Only the teacher who created

## Phase 4: Frontend Updates

### 4.1 Student Dashboard
- Show "My Classrooms" (approved)
- Show "Pending Requests"  
- "Browse & Join" classroom discovery
- Per-classroom: materials, announcements, chat

### 4.2 Teacher Dashboard
- Classroom management panel
- Join request approval/rejection
- Activity analytics per classroom
- Student engagement insights

### 4.3 Messaging UI
- Group chat per classroom
- Private messaging
- Realtime polling updates

## Phase 5: Supabase Schema Updates
- Add `classroom_id` column to materials, quizzes, announcements
- RLS policies scoped to classroom membership
