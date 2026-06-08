import 'dotenv/config';
import { studentNotesClient } from "./src/config/supabaseClient.js";

async function test() {
    const { data: objects, error } = await studentNotesClient
        .from('objects') // This might not work if it's not exposed
        .select('metadata')
        .eq('bucket_id', 'notes-files');

    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Total objects:", objects?.length);
    }
}
test();
