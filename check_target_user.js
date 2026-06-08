import "./env.js";
import connectDB from "./config/db.js";
import User from "./src/models/User.js";

const run = async () => {
    await connectDB();
    const user = await User.findOne({ email: "nikhilnick5050@gmail.com" });
    const user2 = await User.findOne({ email: "nikhil.shinde@classgrid.in" });
    console.log("NikhilNick Gmail:", user ? {
        id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        status: user.status
    } : null);

    console.log("Classgrid Email:", user2 ? {
        id: user2._id,
        email: user2.email,
        isEmailVerified: user2.isEmailVerified,
        status: user2.status
    } : null);

    process.exit(0);
};

run();
