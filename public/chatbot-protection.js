/**
 * Classgrid Chatbot Protection System
 * Implements login-gated AI assistance with graceful fallback
 */

const ChatbotProtection = (() => {
    const BASIC_RESPONSES = {
        help: `❓ **Quick Help Guide**

1️⃣ Browse our knowledge base
2️⃣ Watch tutorial videos
3️⃣ Access lab manuals
4️⃣ Read safety guidelines

💡 Login for full AI-powered assistance!`,

        contact: `📧 **Contact Information**

**Email:** classgrid25@gmail.com or support@classgrid.in
**Phone:** +91 81492 77038
**Location:** PCCOE, Pune

🕒 **Office Hours:**
Monday - Friday: 9:00 AM - 6:00 PM IST
Saturday: 10:00 AM - 4:00 PM IST`,

        hours: `🕒 **Office Hours**

Monday - Friday: 9:00 AM - 6:00 PM IST
Saturday: 10:00 AM - 4:00 PM IST
Sunday: Closed

📧 Email us anytime at classgrid25@gmail.com or support@classgrid.in`,

        database: `🔬 **knowledge base**

✅ 1000+ academic topics
✅ Safety data sheets
✅ Physical properties
✅ study references

🔐 Login to access advanced search and AI-powered queries!`,

        login: `🔐 **Login Benefits**

✅ Full AI chatbot assistance
✅ Access all tutorials
✅ Save your progress
✅ Personalized recommendations
✅ Download lab manuals
✅ Advanced database features

👉 Click "Login" to get started!`
    };

    /**
     * Initialize chatbot protection
     */
    function init() {
        const chatbotSend = document.getElementById('chatbotSend');
        const chatbotInput = document.getElementById('chatbotInput');

        if (chatbotSend && chatbotInput) {
            // Override the existing sendMessage function
            chatbotSend.onclick = null;
            chatbotSend.addEventListener('click', handleSendMessage);

            chatbotInput.onkeypress = null;
            chatbotInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleSendMessage();
                }
            });
        }

        setupQuickActions();
    }

    /**
     * Setup quick action buttons
     */
    function setupQuickActions() {
        const quickActions = document.getElementById('quickActions');
        if (quickActions) {
            quickActions.onclick = null;
            quickActions.addEventListener('click', (e) => {
                if (e.target.classList.contains('quick-action-btn')) {
                    const action = e.target.dataset.action;
                    handleQuickAction(action);
                }
            });
        }
    }

    /**
     * Handle quick action clicks
     */
    function handleQuickAction(action) {
        const response = BASIC_RESPONSES[action] || BASIC_RESPONSES.help;
        addMessage(response, 'bot');
    }

    /**
     * Handle send message
     */
    async function handleSendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();

        if (!message) return;

        addMessage(message, 'user');
        input.value = '';

        const isLoggedIn = AuthUtils.isUserLoggedIn();

        // Check for basic queries first
        const basicResponse = getBasicResponse(message);
        if (basicResponse) {
            showTypingIndicator();
            setTimeout(() => {
                removeTypingIndicator();
                addMessage(basicResponse, 'bot');
            }, 1000);
            return;
        }

        // If not logged in, show login prompt for advanced queries
        if (!isLoggedIn) {
            showTypingIndicator();
            setTimeout(() => {
                removeTypingIndicator();
                const loginPrompt = `🔐 **Login Required for Full AI Assistance**

I can help with basic questions about:
• Contact information
• Office hours
• Database overview
• Help & navigation

For advanced AI-powered science assistance, please login to unlock:
✨ Detailed educational analysis
✨ Personalized recommendations
✨ Complex problem solving
✨ study assistance

👉 Click the Login button in the navbar to get started!`;
                
                addMessage(loginPrompt, 'bot');
            }, 1000);
            return;
        }

        // User is logged in - make API call
        await sendToAI(message);
    }

    /**
     * Get basic response for common queries
     */
    function getBasicResponse(message) {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('contact') || lowerMessage.includes('email') || lowerMessage.includes('phone')) {
            return BASIC_RESPONSES.contact;
        }
        
        if (lowerMessage.includes('hour') || lowerMessage.includes('time') || lowerMessage.includes('open')) {
            return BASIC_RESPONSES.hours;
        }
        
        if (lowerMessage.includes('database') && lowerMessage.length < 30) {
            return BASIC_RESPONSES.database;
        }
        
        if (lowerMessage.includes('help') || lowerMessage === 'hi' || lowerMessage === 'hello') {
            return BASIC_RESPONSES.help;
        }
        
        if (lowerMessage.includes('login') || lowerMessage.includes('sign in')) {
            return BASIC_RESPONSES.login;
        }

        return null;
    }

    /**
     * Send message to AI backend
     */
    async function sendToAI(message) {
        showTypingIndicator();

        try {
            const response = await fetch(`${AuthUtils.API_BASE}/api/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            removeTypingIndicator();
            addMessage(data.reply, 'bot');

        } catch (error) {
            console.error("Chat error:", error);
            removeTypingIndicator();
            
            addMessage("I'm having trouble connecting to the server right now. Please try again later or contact classgrid25@gmail.com or support@classgrid.in for assistance.", 'bot');
        }
    }

    /**
     * Show typing indicator
     */
    function showTypingIndicator() {
        const messagesDiv = document.getElementById('chatbotMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        
        typingDiv.innerHTML = `
            <div class="typing-avatar">
                <div class="typing-avatar-icon">
                    <i class="fas fa-robot"></i>
                </div>
            </div>
            <div class="typing-content">
                <div class="typing-text">Classgrid is thinking</div>
                <div class="typing-dots">
                    <div class="dot dot-1"></div>
                    <div class="dot dot-2"></div>
                    <div class="dot dot-3"></div>
                </div>
            </div>
        `;
        
        messagesDiv.appendChild(typingDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    /**
     * Remove typing indicator
     */
    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.style.opacity = '0';
            typingIndicator.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                typingIndicator.remove();
            }, 300);
        }
    }

    /**
     * Add message to chat
     */
    function addMessage(text, sender) {
        const messagesDiv = document.getElementById('chatbotMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${sender}`;
        
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        
        messageDiv.innerHTML = formattedText;
        messagesDiv.appendChild(messageDiv);
        
        // Animate in
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            messageDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 10);
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Public API
    return {
        init
    };
})();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ChatbotProtection.init);
} else {
    ChatbotProtection.init();
}

// Make available globally
window.ChatbotProtection = ChatbotProtection;
