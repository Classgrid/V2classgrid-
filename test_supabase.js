import 'dotenv/config';
import { studentNotesClient } from "./src/config/supabaseClient.js";

async function test() {
    const { data: items, error } = await studentNotesClient.storage
        .from('notes-files')
        .list('student-notes', { limit: 100 });

    console.log("Items in student-notes/:", items);

    // Check if we can do an empty query to get everything?
    const { data: allItems, error: err2 } = await studentNotesClient.storage
        .from('notes-files')
        .list('', { limit: 100, search: '' });

    console.log("All Items empty path:", allItems);
}
test();
