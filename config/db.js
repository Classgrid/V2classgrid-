import mongoose from "mongoose";

// Global cache for serverless environments (like Vercel)
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 20,          // handle more concurrent requests (was 10)
      minPoolSize: 4,           // keep warm connections ready at all times
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
      socketTimeoutMS: 45000,   // Kill idle sockets after 45s
    };

    console.log("=> Initializing new MongoDB connection...");
    cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
      console.log("✅ MongoDB connected");
      return mongoose;
    }).catch((error) => {
      console.error("❌ MongoDB connection failed:", error.message);
      cached.promise = null; // Reset promise so we can try again
      throw error; // Do NOT use process.exit(1) in serverless!
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error("Error awaiting MongoDB connection:", error.message);
    throw error;
  }
};

export default connectDB;
