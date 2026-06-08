import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Classroom Client (announcements, quizzes, materials)
const CLASSROOM_URL = process.env.CLASSROOM_SUPABASE_URL;
const CLASSROOM_KEY = process.env.CLASSROOM_SUPABASE_SERVICE_ROLE_KEY;
export const classroomClient = createClient(CLASSROOM_URL, CLASSROOM_KEY);

// Student Notes Client (student uploaded notes, notes-files bucket)
const STUDENT_URL = process.env.STUDENT_SUPABASE_URL;
const STUDENT_KEY = process.env.STUDENT_SUPABASE_SERVICE_ROLE_KEY;
export const studentNotesClient = createClient(STUDENT_URL, STUDENT_KEY);
