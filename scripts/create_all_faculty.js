import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const facultyList = [

    {
        name: 'Prof (Faculty)',
        email: 'physics@classgrid.in',
        subject: 'physics',
        password: 'classgrid@5049'
    },
    {
        name: 'Prof. Math Faculty',
        email: 'math@classgrid.in',
        subject: 'mathematics',
        password: 'classgrid@5049'
    },
    {
        name: 'Prof. CPP Faculty',
        email: 'cpp@classgrid.in',
        subject: 'cpp',
        password: 'classgrid@5049'
    },
    {
        name: 'Prof. Amol Kharche',
        email: 'amol.kharche@classgrid.in',
        subject: 'science',
        password: 'pass@123'
    }
];

const createAllFaculty = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        for (const faculty of facultyList) {
            const hashedPassword = await bcrypt.hash(faculty.password, 12);
            let user = await User.findOne({ email: faculty.email.toLowerCase().trim() });

            if (user) {
                console.log(`🔄 Updating: ${faculty.email}`);
                user.name = faculty.name; // Added name update
                user.password = hashedPassword;
                user.role = 'teacher';
                user.subject = faculty.subject;
                user.isEmailVerified = true;
                user.authProvider = 'manual';
                if (!user.linkedProviders) user.linkedProviders = [];
                if (!user.linkedProviders.includes('manual')) user.linkedProviders.push('manual');
                await user.save();
                console.log(`   ✅ Updated → ${faculty.name} (${faculty.subject})`);
            } else {
                console.log(`🆕 Creating: ${faculty.email}`);
                user = new User({
                    name: faculty.name,
                    email: faculty.email.toLowerCase().trim(),
                    password: hashedPassword,
                    role: 'teacher',
                    subject: faculty.subject,
                    isEmailVerified: true,
                    authProvider: 'manual',
                    linkedProviders: ['manual']
                });
                await user.save();
                console.log(`   ✅ Created → ${faculty.name} (${faculty.subject})`);
            }
        }

        console.log('\n🎉 All faculty accounts ready!');
        console.log('================================');
        console.log('Login Credentials:');
        facultyList.forEach(f => {
            console.log(`  📧 ${f.email} → 🔑 ${f.password} → 📚 ${f.subject}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

createAllFaculty();
