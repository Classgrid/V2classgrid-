
// Classgrid Floating AI Assistant Widget
(function () {
    // 1. Add Widget Styles
    const style = document.createElement('style');
    style.innerHTML = `
        /* Widget Container */
        .qc-widget-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            font-family: 'Inter', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }

        /* Floating Button (Clean Ask AI) */
        .qc-float-btn {
            height: 48px;
            padding: 0 22px;
            border-radius: 24px;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            border: 1px solid rgba(0, 212, 255, 0.25);
            box-shadow: 0 4px 20px rgba(0, 212, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            overflow: hidden;
            color: #e2e8f0;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.3px;
        }

        .qc-float-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 30px rgba(0, 212, 255, 0.25), 0 12px 40px rgba(0, 0, 0, 0.4);
            border-color: rgba(0, 212, 255, 0.5);
        }

        .qc-float-btn.active {
            height: 48px;
            width: 48px;
            padding: 0;
            justify-content: center;
            border-radius: 50%;
            background: #ef4444;
            border-color: rgba(239, 68, 68, 0.5);
            box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
        }

        .qc-btn-label {
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
        }

        .qc-btn-emoji {
            font-size: 18px;
            line-height: 1;
        }

        .qc-close-icon {
            display: none;
            color: white;
            font-size: 20px;
        }

        .qc-float-btn.active .qc-btn-emoji,
        .qc-float-btn.active .qc-btn-label {
            display: none;
        }

        .qc-float-btn.active .qc-close-icon {
            display: block;
        }


        /* Chat Window */
        .qc-chat-window {
            width: 380px;
            height: 600px;
            max-height: 80vh;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s ease;
            transform-origin: bottom right;
            margin-bottom: 20px;
            position: absolute;
            bottom: 70px;
            right: 0;
        }

        .qc-chat-window.open {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }

        /* Header */
        .qc-header {
            padding: 15px 20px;
            background: rgba(255, 255, 255, 0.03);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .qc-title {
            font-weight: 600;
            color: white;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 16px;
        }
        
        .qc-title i { color: #00d4ff; }

        /* Messages Area */
        .qc-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
            font-size: 14px;
        }

        .qc-msg {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 12px;
            line-height: 1.5;
            word-wrap: break-word;
        }

        .qc-msg.assistant {
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.05);
            color: #e2e8f0;
            border-bottom-left-radius: 2px;
        }

        .qc-msg.user {
            align-self: flex-end;
            background: linear-gradient(135deg, #00d4ff, #0090ff);
            color: white;
            border-bottom-right-radius: 2px;
        }

        /* Input Area */
        .qc-input-area {
            padding: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            background: rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .qc-input-wrapper {
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 5px 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .qc-input {
            flex: 1;
            background: transparent;
            border: none;
            color: white;
            font-family: inherit;
            resize: none;
            height: 24px;
            max-height: 100px;
            outline: none;
            font-size: 14px;
            padding: 8px 0;
        }

        .qc-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }

        .qc-btn:hover {
            color: white;
            background: rgba(255, 255, 255, 0.1);
        }

        .qc-send-btn {
            color: #00d4ff;
            background: rgba(0, 212, 255, 0.1);
        }

        .qc-send-btn:hover {
            color: white;
            background: #00d4ff;
        }

        .qc-voice-btn.recording {
            color: #ff4757;
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }

        /* Files */
        .qc-files {
            padding: 5px 20px;
            display: none;
            gap: 5px;
            overflow-x: auto;
        }
        
        .qc-file-preview {
            background: rgba(255, 255, 255, 0.1);
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            color: #00d4ff;
            white-space: nowrap;
        }

        /* Mobile */
        @media (max-width: 480px) {
            .qc-chat-window {
                width: calc(100vw - 40px);
                height: 500px;
                right: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // 2. Create Widget HTML
    const container = document.createElement('div');
    container.className = 'qc-widget-container';
    container.innerHTML = `
        <div class="qc-chat-window" id="qcChatWindow">
            <div class="qc-header">
                <div class="qc-title"><i class="fas fa-robot"></i> Classgrid Assistant</div>
                <div class="qc-status" style="font-size:12px;color:#cbd5e1">Online</div>
            </div>
            
            <div class="qc-messages" id="qcMessages">
                <div class="qc-msg assistant">
                    Hello! I'm here to help you with science concepts. Ask me anything or upload a problem! 🧪
                </div>
            </div>
            
            <div class="qc-files" id="qcFiles"></div>

            <div class="qc-input-area">
                <div class="qc-input-wrapper">
                    <input type="file" id="qcFileInput" hidden accept="image/*,.pdf">
                    <button class="qc-btn" title="Attach file" onclick="document.getElementById('qcFileInput').click()">
                        <i class="fas fa-paperclip"></i>
                    </button>
                    <textarea class="qc-input" id="qcInput" placeholder="Ask something..." rows="1"></textarea>
                    <button class="qc-btn qc-voice-btn" title="Voice input" id="qcVoiceBtn">
                        <i class="fas fa-microphone"></i>
                    </button>
                </div>
                <button class="qc-btn qc-send-btn" id="qcSendBtn">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>

        <button class="qc-float-btn" id="qcFloatBtn">
            <span class="qc-btn-emoji">🧠</span>
            <span class="qc-btn-label">Ask AI</span>
            <div class="qc-close-icon">
                <i class="fas fa-times"></i>
            </div>
        </button>
    `;
    document.body.appendChild(container);

    // 3. Logic
    const chatWindow = document.getElementById('qcChatWindow');
    const floatBtn = document.getElementById('qcFloatBtn');
    const input = document.getElementById('qcInput');
    const sendBtn = document.getElementById('qcSendBtn');
    const messages = document.getElementById('qcMessages');
    const fileInput = document.getElementById('qcFileInput');
    const filesContainer = document.getElementById('qcFiles');
    const voiceBtn = document.getElementById('qcVoiceBtn');

    let currentFile = null;

    // Toggle Chat
    floatBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        floatBtn.classList.toggle('active');
        if (chatWindow.classList.contains('open')) input.focus();
    });

    // Auto-resize textarea
    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight < 100 ? this.scrollHeight : 100) + 'px';
    });

    // File Selection
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            currentFile = file;
            filesContainer.style.display = 'flex';
            filesContainer.innerHTML = `
                <div class="qc-file-preview">
                    <i class="fas ${file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-image'}"></i>
                    ${file.name.substring(0, 15)}...
                    <i class="fas fa-times" onclick="window.removeQcFile()" style="cursor:pointer;margin-left:5px"></i>
                </div>
            `;
        }
    });

    window.removeQcFile = () => {
        currentFile = null;
        fileInput.value = '';
        filesContainer.innerHTML = '';
        filesContainer.style.display = 'none';
    };

    // Send Message
    async function sendMessage() {
        const text = input.value.trim();
        if (!text && !currentFile) return;

        addMessage(text, 'user', currentFile);

        const messageText = text;
        const fileToSend = currentFile;

        input.value = '';
        input.style.height = '24px'; // Reset height
        window.removeQcFile();

        const loadingId = addLoading();

        try {
            const formData = new FormData();
            formData.append('message', messageText);
            if (fileToSend) formData.append('file', fileToSend);

            const res = await fetch('/api/chat', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            removeLoading(loadingId);

            if (data.reply) {
                addMessage(data.reply, 'assistant');
            } else {
                addMessage("I'm having trouble responding right now.", 'assistant');
            }

        } catch (err) {
            console.error(err);
            removeLoading(loadingId);
            addMessage("Error connecting to server.", 'assistant');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Voice Input
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            voiceBtn.classList.add('recording');
        };

        recognition.onend = () => {
            voiceBtn.classList.remove('recording');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            input.value += (input.value ? ' ' : '') + transcript;
            // Trigger input event to resize
            input.dispatchEvent(new Event('input'));
        };

        voiceBtn.addEventListener('click', () => {
            if (voiceBtn.classList.contains('recording')) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        voiceBtn.style.display = 'none';
    }

    // Helpers
    function addMessage(text, type, file = null) {
        const div = document.createElement('div');
        div.className = `qc-msg ${type}`;

        let content = '';
        if (file) {
            content += `<div style="font-size:12px;opacity:0.8;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1)">
                <i class="fas ${file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-image'}"></i> Attached: ${file.name}
            </div>`;
        }
        // Basic markdown parser (bold, italic, list)
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        content += formattedText;

        div.innerHTML = content;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    function addLoading() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'qc-msg assistant';
        div.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Thinking...';
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
        return id;
    }

    function removeLoading(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

})();
