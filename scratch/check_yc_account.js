import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Organization from '../src/models/Organization.js';

async function run() {
    await mongoose.connect('mongodb+srv://classgrid-admin:aiLfOjcURw9UUALw@cluster0.ktur3iv.mongodb.net/classgrid?retryWrites=true&w=majority&appName=Cluster0');
    
    const user = await User.findOne({ email: 'yc@classgrid.in' }).lean();
    if (user) {
        console.log("User Found:", user.email);
        const org = await Organization.findById(user.organization_id).lean();
        console.log("Organization:", org ? org.name : 'No Org');
    } else {
        console.log("User yc@classgrid.in not found in database.");
    }
    
    // Check for demo accounts in Classgrid Demo School
    const cdsOrg = await Organization.findOne({ name: /Classgrid Demo School/i }).lean();
    if (cdsOrg) {
        console.log("Found CDS Org:", cdsOrg.name);
        const demoUsers = await User.find({ organization_id: cdsOrg._id }).lean();
        console.log("Demo Users in CDS:");
        demoUsers.forEach(u => console.log(`- ${u.email} (Role: ${u.role})`));
    }
    
    process.exit(0);
}
run();
