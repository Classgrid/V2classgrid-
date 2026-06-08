import { getFacultyInviteEmailHtml } from "./src/services/email-templates.service.js";

try {
    const html = getFacultyInviteEmailHtml("Test User", "Test Org", "http://link.com", undefined);
    console.log("SUCCESS length:", html.length);
} catch (e) {
    console.error("CRASH IN TEMPLATE:", e);
}
