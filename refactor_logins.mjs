import fs from "fs";

function patchLoginHtml() {
   let content = fs.readFileSync("public/login.html", "utf8");

   // 1. Remove adminSetupModal
   content = content.replace(/<!-- Admin Password Setup Modal -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, "");
   content = content.replace(/const adminSetupModal.*?;/g, "");
   content = content.replace(/const closeAdminModal.*?;/g, "");
   content = content.replace(/const adminSetupForm.*?;/g, "");
   content = content.replace(/closeAdminModal\.addEventListener[\s\S]*?adminSetupModal\.classList\.remove[^;]*;/g, "");
   content = content.replace(/adminSetupModal\.addEventListener[\s\S]*?adminSetupModal\.classList\.remove.*?;.*?;.*?;.*?} }\);/g, "");
   content = content.replace(/\/\/ Admin Setup Modal Logic[\s\S]*?btn\.disabled = false; btn\.innerHTML = orig;\s*}\s*}\);/, "");

   // 2. Adjust fetch call in login Form
   const originalFetch = "body: JSON.stringify({ email, password, role: selectedRole, recaptchaToken })";
   const patchedFetch = 'body: JSON.stringify({ email, password, role: selectedRole, expectedLoginType: "standard", recaptchaToken })';
   content = content.replace(originalFetch, patchedFetch);

   // 3. Login redirect
   const originalLoginRedirect = `          // Role-based routing
          const role = d.user && d.user.role;
          if (role === 'super_admin') {
            window.location.href = '/super-admin-dashboard';
          } else if (role === 'org_admin') {
            const orgName = d.user.organization && d.user.organization.name ? encodeURIComponent(d.user.organization.name.replace(/\\s+/g, '-').toLowerCase()) : 'dashboard';
            window.location.href = \`/org/\${orgName}/admin\`;
          } else {
            window.location.href = '/classroom';
          }`;
   const patchedLoginRedirect = `          // Role-based routing
          const role = d.user && d.user.role;
          if (role === 'super_admin' || role === 'org_admin') {
             showMessage("Admins must use the dedicated Admin Login portals.", "error");
             localStorage.removeItem("jwt_token");
          } else if (role === 'teacher' || role === 'faculty') {
             window.location.href = '/faculty/dashboard';
          } else {
             window.location.href = '/student/dashboard';
          }`;
   if (content.includes(originalLoginRedirect)) {
      content = content.replace(originalLoginRedirect, patchedLoginRedirect);
   } else {
      console.error("Failed to find originalLoginRedirect");
   }

   // 4. Init routing token logic
   const originalInitRedirect1 = `          .then(u => {
            const role = u && u.role;
            let dest = '/classroom';
            if (role === 'super_admin') dest = '/super-admin-dashboard';
            else if (role === 'org_admin') {
                 const orgName = u.organization && u.organization.name ? encodeURIComponent(u.organization.name.replace(/\\s+/g, '-').toLowerCase()) : 'dashboard';
                 dest = \`/org/\${orgName}/admin\`;
            }
            setTimeout(() => window.location.href = dest, 1500);
          })
          .catch(() => window.location.href = '/login');`;

   const patchedInitRedirect1 = `          .then(u => {
            const role = u && u.role;
            if (role === 'super_admin' || role === 'org_admin') {
                localStorage.removeItem("jwt_token");
                window.location.href = (role === 'super_admin') ? "/superadmin/login" : "/admin/login";
            } else if (role === 'teacher' || role === 'faculty') {
                setTimeout(() => window.location.href = "/faculty/dashboard", 1500);
            } else {
                setTimeout(() => window.location.href = "/student/dashboard", 1500);
            }
          })
          .catch(() => window.location.href = '/login');`;

   const originalInitRedirect1_alternate = `          .then(u => {
            const role = u && u.role;
            let dest = '/classroom';
            if (role === 'super_admin') dest = '/super-admin-dashboard';
            else if (role === 'org_admin') {
              const orgName = u.organization && u.organization.name ? encodeURIComponent(u.organization.name.replace(/\\s+/g, '-').toLowerCase()) : 'dashboard';
              dest = \`/org/\${orgName}/admin\`;
            }
            setTimeout(() => window.location.href = dest, 1500);
          })
          .catch(() => window.location.href = '/login');`;

   if (content.includes(originalInitRedirect1)) {
      content = content.replace(originalInitRedirect1, patchedInitRedirect1);
   } else if (content.includes(originalInitRedirect1_alternate)) {
      content = content.replace(originalInitRedirect1_alternate, patchedInitRedirect1);
   } else {
      console.error("Failed to find originalInitRedirect1");
   }

   // 5. Init routing fallback logic
   const originalInitRedirect2 = `            if (r.ok) {
              const u = await r.json();
              const role = u && u.role;
              if (role === 'super_admin') { window.location.href = '/super-admin-dashboard'; }
              else if (role === 'org_admin') { 
                 const orgName = u.organization && u.organization.name ? encodeURIComponent(u.organization.name.replace(/\\s+/g, '-').toLowerCase()) : 'dashboard';
                 window.location.href = \`/org/\${orgName}/admin\`;
              }
              else { window.location.href = '/classroom'; }
            } else localStorage.removeItem('jwt_token');`;

   const patchedInitRedirect2 = `            if (r.ok) {
              const u = await r.json();
              const role = u && u.role;
              if (role === 'super_admin' || role === 'org_admin') { 
                 localStorage.removeItem("jwt_token");
                 window.location.href = (role === 'super_admin') ? "/superadmin/login" : "/admin/login";
              } else if (role === 'teacher' || role === 'faculty') {
                 window.location.href = "/faculty/dashboard";
              } else { 
                 window.location.href = '/student/dashboard'; 
              }
            } else localStorage.removeItem('jwt_token');`;

   if (content.includes(originalInitRedirect2)) {
      content = content.replace(originalInitRedirect2, patchedInitRedirect2);
   } else {
      // Alternative spacing fallback
      console.error("Failed to find originalInitRedirect2. Check formatting.");
   }

   fs.writeFileSync("public/login.html", content);
}

patchLoginHtml();
console.log("Patch finished for login.html");
