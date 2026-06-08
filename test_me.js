import connectDB from "./config/db.js";
import User from "./src/models/User.js";
import Organization from "./src/models/Organization.js";
import "./env.js";

async function run() {
    await connectDB();
    const superAdmin = await User.findOne({ role: "super_admin" });
    if (!superAdmin) return console.log("no user");

    const req = {
        user: superAdmin
    };
    const res = {
        json: (data) => console.log("JSON:", data),
        status: (code) => ({ json: (data) => console.log("STATUS", code, data) })
    };

    try {
        const userWithOrg = await User.findById(req.user._id).populate("organization_id");
        console.log("Success", userWithOrg.organization_id);
    } catch (e) {
        console.log("Error:", e);
    }
    process.exit();
}
run();
