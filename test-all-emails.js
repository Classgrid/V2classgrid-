import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
    const { sendEmail } = await import('./src/services/brevo.service.js');
    const temp = await import('./src/services/email-templates.service.js');

    const recipients = ["support@classgrid.in", "sunitasubhashsun123@gmail.com"];

    // Mock Data
    const fakeDate = new Date();
    const fakeExpiry = new Date();
    fakeExpiry.setDate(fakeExpiry.getDate() + 30);

    const mockUser = { name: "Test User", email: "test@example.com" };
    const mockSubject = "Global Theme Automated Test";

    const emailsToTest = [
        // 1. Faculty Welcome
        {
            subject: "[1] Faculty Welcome",
            html: temp.getFacultyWelcomeEmailHtml("Prof. Test", "Test Org", "http://localhost/dash"),
            text: temp.getFacultyWelcomePlainText("Prof. Test", "Test Org", "http://localhost/dash")
        },
        // 2. Student Welcome
        {
            subject: "[2] Student Welcome",
            html: temp.getStudentWelcomeEmailHtml("Student Test", "http://localhost/dash"),
            text: temp.getStudentWelcomePlainText("Student Test", "http://localhost/dash")
        },
        // 3. Login Notification
        {
            subject: "[3] Login Notification",
            html: temp.getLoginNotificationHtml(mockUser),
            text: temp.getLoginNotificationPlainText(mockUser)
        },
        // 4. Verification Email
        {
            subject: "[4] Account Verification",
            html: temp.getVerificationEmailHtml("Test User", "http://localhost/verify"),
            text: temp.getVerificationEmailPlainText("Test User", "http://localhost/verify")
        },
        // 5. Password Reset
        {
            subject: "[5] Password Reset",
            html: temp.getPasswordResetEmailHtml("http://localhost/reset"),
            text: temp.getPasswordResetEmailPlainText("http://localhost/reset")
        },
        // 6. Faculty Invite
        {
            subject: "[6] Faculty Invite",
            html: temp.getFacultyInviteEmailHtml("Prof. Invite", "Test Org", "http://localhost/invite", "ORG-123"),
            text: temp.getFacultyInviteEmailPlainText("Prof. Invite", "Test Org", "http://localhost/invite", "ORG-123")
        },
        // 7. Org Approval
        {
            subject: "[7] Org Approval",
            html: temp.getOrgApprovalEmailHtml("Test Org", "Org Owner", "ORG-123", "HON-123", 50, "http://localhost"),
            text: temp.getOrgApprovalEmailPlainText("Test Org", "Org Owner", "ORG-123", "HON-123", 50, "http://localhost")
        },
        // 8. Admin Org App Notification
        {
            subject: "[8] Admin: New Org App",
            html: temp.getAdminOrgApplicationNotificationHtml({ instituteName: "New Org", ownerName: "Owner", email: "owner@test.com", phone: "123", plan: "PRO" }),
            text: temp.getAdminOrgApplicationNotificationPlainText({ instituteName: "New Org", ownerName: "Owner", email: "owner@test.com", phone: "123", plan: "PRO" })
        },
        // 9. Admin Org Approval Notification
        {
            subject: "[9] Admin: Org Approved Internal",
            html: temp.getAdminOrgApprovalNotificationHtml("New Org", "owner@test.com", "ORG-NEW", "HON-NEW", "http://localhost/dash"),
            text: temp.getAdminOrgApprovalNotificationPlainText("New Org", "owner@test.com", "ORG-NEW", "HON-NEW", "http://localhost/dash")
        },
        // 10. Org App Confirmation
        {
            subject: "[10] Applicant: App Confirmation",
            html: temp.getOrgApplicationConfirmationHtml("Test Owner", "Test Org", "PRO"),
            text: temp.getOrgApplicationConfirmationPlainText("Test Owner", "Test Org", "PRO")
        },
        // 11. Org Rejection
        {
            subject: "[11] Applicant: Org Rejected",
            html: temp.getOrgRejectionEmailHtml("Test Owner", "Test Org", "Incomplete verification documents"),
            text: temp.getOrgRejectionEmailPlainText("Test Owner", "Test Org", "Incomplete verification documents")
        },
        // 12. Org Admin Activated
        {
            subject: "[12] Org Admin Activated",
            html: temp.getOrgAdminActivatedHtml("Admin Name", "http://localhost/dash", "http://localhost/login"),
            text: temp.getOrgAdminActivatedPlainText("Admin Name", "http://localhost/dash", "http://localhost/login")
        },
        // 13. Super Admin Created
        {
            subject: "[13] Super Admin Created",
            html: temp.getSuperAdminCredentialsHtml("Super", "super@test.com", "password123", "http://localhost/login"),
            text: temp.getSuperAdminCredentialsPlainText("Super", "super@test.com", "password123", "http://localhost/login")
        },
        // 14. Org Delete Verification
        {
            subject: "[14] Org Delete Verification",
            html: temp.getOrgDeleteVerificationEmailHtml("Test Org", "Owner", "http://localhost/verify"),
            text: temp.getOrgDeleteVerificationEmailPlainText("Test Org", "Owner", "http://localhost/verify")
        },
        // 15. Plan Activation
        {
            subject: "[15] Plan Activated",
            html: temp.getPlanActivationHtml("PRO", fakeDate, fakeExpiry, 500, "User Name", 30),
            text: temp.getPlanActivationPlainText("PRO", fakeDate, fakeExpiry, 500, "User Name", 30)
        },
        // 16. Classroom Activity
        {
            subject: "[16] Classroom Activity",
            html: temp.getClassroomActivityEmailHtml({ orgName: "Org", classroomName: "Class 101", facultyName: "Prof", contentType: "Announcement", title: "Test", preview: "Test msg", classroomUrl: "http://dash" }),
            text: temp.getClassroomActivityEmailPlainText({ orgName: "Org", classroomName: "Class 101", facultyName: "Prof", contentType: "Announcement", title: "Test", preview: "Test msg", classroomUrl: "http://dash" })
        },
        // 17. Join Request
        {
            subject: "[17] Join Request (Faculty)",
            html: temp.getJoinRequestEmailHtml({ studentName: "Student", classroomName: "Class 101", reviewUrl: "http://dash" }),
            text: temp.getJoinRequestEmailPlainText({ studentName: "Student", classroomName: "Class 101", reviewUrl: "http://dash" })
        },
        // 18. Join Approved
        {
            subject: "[18] Join Approved (Student)",
            html: temp.getJoinApprovedEmailHtml({ classroomName: "Class 101", classroomUrl: "http://dash" }),
            text: temp.getJoinApprovedEmailPlainText({ classroomName: "Class 101", classroomUrl: "http://dash" })
        },
        // 19. Attendance Started
        {
            subject: "[19] Attendance Started",
            html: temp.getAttendanceStartedEmailHtml({ classroomName: "Class 101", facultyName: "Prof", classroomUrl: "http://dash" }),
            text: temp.getAttendanceStartedEmailPlainText({ classroomName: "Class 101", facultyName: "Prof", classroomUrl: "http://dash" })
        },
        // 20. Absence Notification
        {
            subject: "[20] Absence Notification",
            html: temp.getAbsenceNotificationEmailHtml({ classroomName: "Class 101", sessionDate: "Today", classroomUrl: "http://dash" }),
            text: temp.getAbsenceNotificationEmailPlainText({ classroomName: "Class 101", sessionDate: "Today", classroomUrl: "http://dash" })
        },
        // 21. Daily Digest
        {
            subject: "[21] Daily Digest",
            html: temp.getDailyDigestEmailHtml({ userName: "User", notifications: [], grouped: {}, totalCount: 0, settingsUrl: "http://dash", frontendUrl: "http://dash" }),
            text: temp.getDailyDigestEmailPlainText({ userName: "User", notifications: [], totalCount: 0, settingsUrl: "http://dash" })
        },
        // 22. Plan Expiry
        {
            subject: "[22] Plan Expiry Reminder",
            html: temp.getPlanExpiryReminderHtml("Org", "Owner", "PRO", fakeExpiry, 3),
            text: temp.getPlanExpiryReminderPlainText("Org", "Owner", "PRO", fakeExpiry, 3)
        }
    ];

    for (const recipient of recipients) {
        console.log(`\n\n======================================`);
        console.log(`Dispatching sequence to: ${recipient}`);
        console.log(`======================================`);

        for (const email of emailsToTest) {
            try {
                await sendEmail({
                    to: recipient,
                    subject: email.subject,
                    html: email.html,
                    text: email.text
                });
                console.log(`✅ Sent: ${email.subject}`);
                // Wait gracefully to avoid Brevo rate limits (200ms)
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                console.error(`❌ Failed on ${email.subject}:`, err.message);
            }
        }
    }

    console.log("\\n\\n 🎉 All tests completed globally.");
}

runTest();
