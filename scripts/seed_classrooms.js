import "../env.js";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Classroom from "../src/models/Classroom.js";

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const teachers = await User.find({ role: "teacher" }).lean();
    console.log(`Found ${teachers.length} teachers`);

    const subjectNames = {
        science: "Engineering science",
        physics: "Engineering Physics",
        mathematics: "Engineering Mathematics",
        cpp: "C++ Programming",
    };

    for (const teacher of teachers) {
        console.log(`\nProcessing: ${teacher.name} (${teacher.subject})`);

        if (!teacher.subject) {
            console.log("  SKIP: No subject assigned");
            continue;
        }

        // Check existing
        const existing = await Classroom.findOne({
            teacher: teacher._id,
            subject: teacher.subject,
        });

        if (existing) {
            console.log(`  SKIP: Already has classroom "${existing.name}" (${existing.classCode})`);
            continue;
        }

        try {
            const classroom = await Classroom.create({
                name: subjectNames[teacher.subject] || teacher.subject,
                description: `Official classroom for ${subjectNames[teacher.subject] || teacher.subject}`,
                subject: teacher.subject,
                subjectSlug: teacher.subject,
                teacher: teacher._id,
            });
            console.log(`  CREATED: "${classroom.name}" Code: ${classroom.classCode}`);
        } catch (err) {
            console.log(`  ERROR: ${err.message}`);
            if (err.code === 11000) {
                console.log(`  Duplicate key details:`, JSON.stringify(err.keyValue));
            }
        }
    }

    console.log("\nDone!");
    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
