import 'dotenv/config';
import connectDB from '../config/db.js';
import AttendanceSession from '../src/models/AttendanceSession.js';
import User from '../src/models/User.js';

async function run() {
    await connectDB();
    
    const ladekar = await User.findOne({ email: 'chandrakishor.ladekar@gmail.com' });
    const bill = await User.findOne({ email: 'classgrid29@gmail.com' });

    for (const u of [ladekar, bill]) {
        if (!u) continue;
        console.log(`\nUser: ${u.name} (${u.email})`);
        
        const sessions = await AttendanceSession.find({ faculty: u._id }).lean();
        console.log(`Sessions count: ${sessions.length}`);
        if (sessions.length > 0) {
            console.log(`Latest session date: ${sessions[sessions.length-1].createdAt}`);
        }
        
        const classes = await mongoose.connection.db.collection('classrooms').find({ teacher: u._id }).toArray();
        console.log(`Classrooms: ${classes.length}`);
        
        for (const c of classes) {
            const memberships = await mongoose.connection.db.collection('classroommemberships').find({ classroom: c._id }).toArray();
            console.log(`- ${c.name}: ${memberships.length} students`);
        }
    }
    
    process.exit(0);
}
run();
