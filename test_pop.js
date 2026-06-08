import connectDB from "./config/db.js";
import User from "./src/models/User.js";
import Organization from "./src/models/Organization.js";
import "./env.js";

async function run() {
    await connectDB();
    const superAdmin = await User.findOne({ role: "super_admin" });
    if (!superAdmin) {
        console.log("No super admin found");
        process.exit();
    }
    console.log("Super Admin:", superAdmin.name, "Org ID:", superAdmin.organization_id);

    try {
        const userWithOrg = await User.findById(superAdmin._id).populate("organization_id");
        console.log("Populated User Org:", userWithOrg.organization_id);
        console.log("Success");
    } catch (e) {
        console.error("Error populating:", e);
    }
    process.exit();
}
run();
