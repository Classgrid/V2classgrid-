import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

// Use the CHAT specific env vars
const supabase = createClient(
    process.env.SUPABASE_CHAT_URL,
    process.env.SUPABASE_CHAT_KEY
);

async function checkChat() {
    console.log("=== Checking Chat Table (classroom_messages) in Chat Project ===");
    console.log("Using URL:", process.env.SUPABASE_CHAT_URL);

    // Try to select
    const { data, error } = await supabase
        .from("classroom_messages")
        .select("id")
        .limit(1);

    if (error) {
        console.log("ERROR querying classroom_messages table:", error.message);
        if (error.message.includes("does not exist")) {
            console.log("Status: MISSING");
            console.log("Need to create 'classroom_messages' table in the *Chat* Supabase project.");
        }
    } else {
        console.log("Status: OK - classroom_messages table exists.");
        console.log("Data count:", data.length);
    }
}

checkChat().catch(e => { console.error(e); process.exit(1); });
