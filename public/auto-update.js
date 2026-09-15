// Auto-update script running every 2 minutes
setInterval(async () => {
    try {
        const response = await fetch('/version.json?t=' + Date.now());
        const data = await response.json();
        const currentVersion = localStorage.getItem('app_version');
        
        if (currentVersion && currentVersion !== data.version) {
            console.log('New version detected! Auto-updating...');
            localStorage.setItem('app_version', data.version);
            
            // Aggressively clear caches
            if ('caches' in window) {
                const names = await caches.keys();
                for (let name of names) {
                    await caches.delete(name);
                }
            }
            
            // Force hard reload
            window.location.reload(true);
        } else if (!currentVersion) {
            localStorage.setItem('app_version', data.version);
        }
    } catch (e) {
        console.error("Auto-update check failed", e);
    }
}, 120000); // 2 minutes (120,000 milliseconds)
