console.log('RENDERER.JS IS LOADING!!!')

const { ipcRenderer } = require('electron');
const { has } = require('markdown-it/lib/common/utils.mjs');
const { glob } = require('original-fs');

window.pendingFirstMessage = null;

let globalMemory = {
    userPreferences: {}, // User's personal info (name, preferences, etc.)
    facts: [],           // Important facts from conversations
    previousTopics: []   // Recent conversation topics
};

function saveGlobalMemory() {
    localStorage.setItem('jarvis-memory', JSON.stringify(globalMemory));
}

function loadGlobalMemory() {
    const saved = localStorage.getItem('jarvis-memory');
    if (saved) {
        globalMemory = JSON.parse(saved);
    }
}

// Function to add facts to memory
function addToMemory(type,data) {
    if (type === 'fact') {
        globalMemory.facts.push({
            text: data,
            timestamp: new Date(),
            chatId: currentChatId
        });
    } else if (type === 'preference') {
        Object.assign(globalMemory.userPreferences, data);
    }
    saveGlobalMemory();
}

function extractAndSaveMemory(userMessage, aiResponse) {
    const lowerMessage = userMessage.toLowerCase();
    
    // Manual memory commands
    if (lowerMessage.startsWith('remember that ') || lowerMessage.startsWith('remember: ')) {
        const fact = userMessage.substring(lowerMessage.startsWith('remember that ') ? 14 : 10);
        addToMemory('fact', fact);
        return; // Don't add to topics if it's a memory command
    }
    
    if (lowerMessage.startsWith('my ') && (lowerMessage.includes(' is ') || lowerMessage.includes(' are '))) {
        addToMemory('fact', userMessage);
    }
    
    // Name detection (existing)
    if (lowerMessage.includes('my name is')) {
        const nameMatch = userMessage.match(/my name is (\w+)/i);
        if (nameMatch) {
            addToMemory('preference', { name: nameMatch[1] });
        }
    }
    
    // Job/Work detection
    if (lowerMessage.includes('i work at') || lowerMessage.includes('i am a ') || lowerMessage.includes('my job is')) {
        const jobMatch = userMessage.match(/i work at ([^.!?]+)/i) ||
                        userMessage.match(/i am a ([^.!?]+)/i) ||
                        userMessage.match(/my job is ([^.!?]+)/i);
        if (jobMatch) {
            addToMemory('preference', { job: jobMatch[1].trim() });
        }
    }
    
    // Personal facts
    if (lowerMessage.includes('i have') || lowerMessage.includes('i own')) {
        addToMemory('fact', userMessage);
    }
    
    // Preferences and likes
    if (lowerMessage.includes('i like') || lowerMessage.includes('i love') || lowerMessage.includes('i prefer')) {
        addToMemory('fact', userMessage);
    }
    
    // Skills and experience
    if (lowerMessage.includes('i know how to') || lowerMessage.includes('i can') || lowerMessage.includes('i have experience')) {
        addToMemory('fact', userMessage);
    }
    
    // Current projects or goals
    if (lowerMessage.includes('i am working on') || lowerMessage.includes('my goal is') || lowerMessage.includes('i am building')) {
        addToMemory('fact', userMessage);
    }
    
    // Location
    if (lowerMessage.includes('i live in') || lowerMessage.includes('i am from')) {
        const locationMatch = userMessage.match(/i live in ([^.!?]+)/i) || 
                             userMessage.match(/i am from ([^.!?]+)/i);
        if (locationMatch) {
            addToMemory('preference', { location: locationMatch[1].trim() });
        }
    }
    
    // Add topic to memory (existing)
    globalMemory.previousTopics.push({
        topic: userMessage.substring(0,50),
        timestamp: new Date()
    });

    saveGlobalMemory();
}

function animateInputToBottom() {
    const textInput = document.getElementById('request');
    
    // Get the actual current position from computed styles
    const computedStyle = window.getComputedStyle(textInput);
    const currentTop = parseInt(computedStyle.top);
    
    // Calculate end position
    const endTop = window.innerHeight - 100; // 100px from bottom
    
    // Animation parameters
    const duration = 600;
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-in-out)
        const easeInOut = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        // Calculate current position - only move DOWN
        const animatedTop = currentTop + (endTop - currentTop) * easeInOut;
        
        // Apply the position
        textInput.style.top = animatedTop + 'px';
        
        // Continue animation if not finished
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete - add the CSS class for final state
            textInput.classList.add('bottom-position');
        }
    }
    
    // Start the animation
    requestAnimationFrame(animate);
}

function fadeGoodEvening() {
    const heading = document.querySelector('.main-content h1');
    heading.classList.add('fade-out');
}

function showChatWindow() {
    const chatDisplay = document.getElementById('chat-display');
    chatDisplay.classList.remove('hidden');
    chatDisplay.classList.add('active');
}

// Call Gemini
async function callGeminiAPI(userMessage) {
    try {
        console.log('Calling Gemini API with message:', userMessage);

        // Get current conversation history
        const currentChat = chatHistory.find(c => c.id === currentChatId);
        const conversationHistory = currentChat ? currentChat.messages.slice(-10) : [];

        // Add global memory context
        const calendarEvents = await getCalendarEvents();
        const tasks = await getTasks();
        const memoryContext = {
            userPreferences: globalMemory.userPreferences,
            recentFacts: globalMemory.facts.slice(-10), // Increased from 5 to 10
            previousTopics: globalMemory.previousTopics.slice(-5), // Increased from 3 to 5
            calendarEvents: calendarEvents,
            tasks: tasks
        }
        
        //Add user message to chat
        addMessageToChat(currentChatId, userMessage, 'user');

        // Show loading state
        showLoadingState();

        // Call Gemini via IPC
        console.log('Sending IPC request...');
        const result = await ipcRenderer.invoke('gemini-request', userMessage, conversationHistory, memoryContext);
        console.log('Received IPC result:', result);

        if (result.success) {
            console.log('Success! Adding response to chat');
            
            // Handle function execution results first
            let combinedResponse = result.response;
            
            if (result.functionCalls && result.functionResults) {
                console.log('=== PROCESSING FUNCTION RESULTS ===');
                console.log('Function calls:', result.functionCalls);
                console.log('Function results:', result.functionResults);
                
                // Build success/failure messages
                const functionMessages = [];
                result.functionResults.forEach(functionResult => {
                    if (functionResult.success) {
                        console.log(`Function ${functionResult.function} executed successfully`);
                        functionMessages.push(`<div class="function-success"> ${functionResult.message}</div>`);
                    } else {
                        console.error(`Function ${functionResult.function} failed:`, functionResult.error);
                        functionMessages.push(`<div class="function-error"> Function failed: ${functionResult.error}</div>`);
                    }
                });
                
                // Combine AI response with function results
                if (functionMessages.length > 0) {
                    combinedResponse = result.response + functionMessages.join('');
                }
            }
            
            // Add combined response to chat
            addMessageToChat(currentChatId, combinedResponse, 'assistant');

            // Extract and save new info
            extractAndSaveMemory(userMessage, result.response, 'assistant');
        } else {
            console.log('Error from Gemini:', result.error);
            //Handle error
            addMessageToChat(currentChatId, 'Sorry, I encountered an error: ' + result.error, 'assistant');
        }

        hideLoadingState();

    } catch (error) {
        console.error('Error calling Gemini:', error);
        addMessageToChat(currentChatId, 'Sorry, I encountered an error.', 'assistant');
        hideLoadingState();
    }
}

//Add loading state functions
function showLoadingState() {
    console.log('loading...');
}

function hideLoadingState() {
    console.log('Done loading');
}

let chatHistory = [];
let currentChatId = null;

function createNewChat() {
    const chatId = Date.now().toString();
    const newChat = {
        id: chatId,
        title: "New Conversation",
        messages: [],
        createdAt: new Date()
    };

    chatHistory.push(newChat);
    currentChatId = chatId;
    updateChatSidebar();
    return chatId
}

function addMessageToChat(chatId, message, sender) {
    console.log('Adding message:', { chatId, message, sender });
    
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
        chat.messages.push({
            text: message,
            sender: sender,
            timestamp: new Date()
        });

        console.log('Message added to chat:', chat.messages[chat.messages.length - 1]);

        // Update chat title if it's the first message
        if (chat.messages.length === 1) {
            chat.title = message.substring(0,30) + (message.length > 30 ? '...' : '');
            updateChatSidebar();
        }

        // Display updated messages
        console.log('Calling displayMessages with chatId:', chatId);
        displayMessages(chatId);
    } else {
        console.error('Chat not found for ID:', chatId);
    }
}

function displayMessages(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    const chatDisplay = document.getElementById('chat-display');

    if (!chat || !chatDisplay) {
        console.log('Chat or chatDisplay not found:', { chat: !!chat, chatDisplay: !!chatDisplay });
        return;
    }

    // Clear existing messages
    chatDisplay.innerHTML = '';

    // Display each message
    chat.messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender}`;
        
        if (message.sender === 'assistant') {
            // Use innerHTML for AI messages to render HTML
            console.log('Setting AI message HTML:', message.text);
            messageDiv.innerHTML = message.text;
        } else {
            // Use textContent for user messages for security
            messageDiv.textContent = message.text;
        }
        
        chatDisplay.appendChild(messageDiv);
    });

    // Scroll to bottom
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function processFirstMessage() {
    const userInput = window.pendingFirstMessage;

    // Show chat display (but it should already be visible)
    showChatDisplay();

    // Create new chat if none exists
    if (!currentChatId) {
        createNewChat();
    }

    // Call Gemini with the stored message
    callGeminiAPI(userInput);

    // Clear pending message
    window.pendingFirstMessage = null;
}

function playInitialAnimation() {
    // Stage 1: Start both animations simultaneously
    fadeGoodEvening();
    animateInputToBottom();

    // Stage 2: Show chat window after 600ms (reduced since input moves faster now)
    setTimeout(() => {
        showChatWindow();
    }, 600);

    // Stage 3: Enable message processing after 800ms
    setTimeout(() => {
        processFirstMessage();
    }, 800);
}

function updateChatSidebar() {
    const chatList = document.querySelector('.chat-list');
    chatList.innerHTML = '';

    chatHistory.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.textContent = chat.title;
        chatItem.onclick = () => loadChat(chat.id);

        if (chat.id === currentChatId) {
            chatItem.classList.add('active');
        }

        chatList.appendChild(chatItem);
    });
}

function loadChat(chatId) {
    currentChatId = chatId;
    updateChatSidebar();
    displayMessages(chatId);
    // Load chat messages here
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadGlobalMemory();
    updateChatSidebar();

    // ALWAYS start in initial state, regardless of previous usage
    const chatDisplay = document.getElementById('chat-display');
    const textInput = document.getElementById('request');
    const heading = document.querySelector('.main-content h1');
    const cardsContainer = document.querySelector('.cards-container');
    
    // Reset to initial state
    chatDisplay.classList.add('hidden');
    chatDisplay.classList.remove('active');
    textInput.classList.remove('bottom-position');
    heading.classList.remove('fade-out');
    
    // Make sure cards are visible
    if (cardsContainer) {
        cardsContainer.style.display = 'flex';
        cardsContainer.classList.remove('hidden');
    }

    // Connect calendar integration button
    console.log('=== BUTTON CONNECTION DEBUG ===');
    const calendarButton = document.querySelector('.calendar-button');
    console.log('Calendar button found:', !!calendarButton);
    console.log('Calendar button element:', calendarButton);
    
    if (calendarButton) {
        console.log('Adding click listener to calendar button');
        calendarButton.addEventListener('click', function() {
            console.log('Calendar button clicked!');
            integrateCalendar();
        });
        console.log('Click listener added successfully');
    } else {
        console.log('ERROR: Calendar button not found!');
    }
    console.log('=== BUTTON CONNECTION DEBUG END ===');
    
    console.log('App started in initial state');

    checkCalendarIntegration();
});

// Text input handler
document.getElementById('request').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const userInput = this.value;
        if (userInput.trim() !== '') {
            
            // Check if chat display is currently hidden (meaning this is the first message)
            const chatDisplay = document.getElementById('chat-display');
            const isFirstMessage = chatDisplay.classList.contains('hidden');
            
            if (isFirstMessage) {
                // Store user input for later processing
                window.pendingFirstMessage = userInput;
                this.value = '';
                playInitialAnimation();
            } else {
                // Normal processing for subsequent messages
                showChatDisplay();
                if (!currentChatId) {
                    createNewChat();
                }
                callGeminiAPI(userInput);
                this.value = '';
            }
        }
    }
});

function showChatDisplay() {
    const chatDisplay = document.getElementById('chat-display');
    const cardsContainer = document.querySelector('.cards-container');

    // Always show chat display when called
    if (chatDisplay) {
        chatDisplay.classList.remove('hidden');
        chatDisplay.classList.add('active');
    }

    // Hide cards
    if (cardsContainer) {
        cardsContainer.classList.add('hidden');
        setTimeout(() => {
            cardsContainer.style.display = 'none';
        }, 300);
    }
}

// Calendar Integration Functions
async function integrateCalendar() {
    // Check if already integrated first
    const calendarButton = document.querySelector('.calendar-button');
    if (calendarButton && calendarButton.classList.contains('integrated')) {
        alert('Calendar is already integrated! You can view and create events by asking Jarvis.');
        return; // Exit early - don't proceed with integration
    }
    
    console.log('=== CALENDAR INTEGRATION DEBUG START ===');
    
    try {
        console.log('Step 1: Starting calendar integration...');
        
        console.log('Step 2: Calling IPC calendar-authenticate...');
        const result = await ipcRenderer.invoke('calendar-authenticate');
        console.log('Step 3: IPC result received:', result);

        if (result.success) {
            console.log('Step 4: Authentication URL opened in browser');

            // Show a custom dialog instead of prompt()
            console.log('Step 5: Creating custom auth code input...');
            
            // Create a simple dialog for auth code input
            const authCode = await showAuthCodeDialog();
            console.log('Step 6: User provided auth code:', authCode ? 'YES' : 'NO');

            if (authCode && authCode.trim()) {
                console.log('Step 7: Calling IPC calendar-set-auth-code...');
                const authResult = await ipcRenderer.invoke('calendar-set-auth-code', authCode.trim());
                console.log('Step 8: Auth code result:', authResult);

                if (authResult.success) {
                    alert('Calendar connected successfully!');
                    updateCalendarButton();
                } else {
                    alert('Failed to connect calendar. Please try again.');
                }
            } else {
                console.log('Step 7: No auth code provided');
            }
        } else {
            console.log('Step 4: Authentication failed:', result.error);
            alert('Failed to start calendar authentication: ' + result.error);
        }
    } catch (error) {
        console.error('Step ERROR: Calendar integration error:', error);
        console.error('Error details:', error.message);
        alert('An error occurred during calendar integration.');
    }
    
    console.log('=== CALENDAR INTEGRATION DEBUG END ===');
}

// Custom dialog function to replace prompt()
function showAuthCodeDialog() {
    return new Promise((resolve) => {
        // Create dialog elements
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(26,23,24,1);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 10px;
            padding: 30px;
            z-index: 1000;
            color: white;
            font-family: inherit;
            text-align: center;
            min-width: 400px;
        `;

        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 999;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Google Calendar Authentication';
        title.style.marginBottom = '20px';

        const message = document.createElement('p');
        message.textContent = 'Please copy the authorization code from your browser and paste it here:';
        message.style.marginBottom = '20px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Paste authorization code here';
        input.style.cssText = `
            width: 100%;
            padding: 10px;
            margin-bottom: 20px;
            border: 1px solid #666;
            border-radius: 5px;
            background: #333;
            color: white;
            font-size: 14px;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Connect';
        submitBtn.style.cssText = `
            padding: 10px 20px;
            background: #4285f4;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            background: #666;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;

        // Event handlers
        submitBtn.onclick = () => {
            const code = input.value.trim();
            document.body.removeChild(backdrop);
            document.body.removeChild(dialog);
            resolve(code);
        };

        cancelBtn.onclick = () => {
            document.body.removeChild(backdrop);
            document.body.removeChild(dialog);
            resolve(null);
        };

        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        };

        // Build dialog
        buttonContainer.appendChild(submitBtn);
        buttonContainer.appendChild(cancelBtn);
        dialog.appendChild(title);
        dialog.appendChild(message);
        dialog.appendChild(input);
        dialog.appendChild(buttonContainer);

        // Show dialog
        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
        input.focus();
    });
}

async function getCalendarEvents() {
    try {
        const result = await ipcRenderer.invoke('calendar-get-events', 10);

        if (result.success) {
            return result.events;
        } else {
            console.error('Failed to get calendar events:', result.error);
            return [];
        }
    } catch (error) {
        console.error('Error getting calendar events:', error);
        return [];
    }
}

async function createCalendarEvent(eventDetails) {
    try {
        const result = await ipcRenderer.invoke('calendar-create-event', eventDetails);

        if (result.success) {
            console.log('Calendar event created:', result.event);
            return result.event;
        } else {
            console.error('Failed to create calendar event', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error creating calendar event:', error);
        return null;
    }
}

function updateCalendarButton() {
    const calendarButton = document.querySelector('.calendar-button');
    const buttonText = calendarButton.querySelector('p');
    
    if (calendarButton && buttonText) {
        // Add integrated class for styling
        calendarButton.classList.add('integrated');
        
        // Change text to "Integrated!"
        buttonText.textContent = 'Integrated!';
        
        console.log('Calendar button updated to integrated state');
    }
}

async function checkCalendarIntegration() {
    try {
        // Try to get calendar events to test if already integrated
        const result = await ipcRenderer.invoke('calendar-get-events', 1);

        if (result.success) {
            console.log('Calendar already integrated');
            updateCalendarButton();
        } else {
            console.log('Calendar not yet integrated');
        }
    } catch (error) {
        console.log('Calendar integration check failed:', error);
    }
}

// Task management functions
async function getTasks() {
    try {
        const result = await ipcRenderer.invoke('tasks-get-tasks', '@default', 20);

        if (result.success) {
            return result.tasks;
        } else {
            console.error('Failed to get tasks:', result.error);
            return [];
        }
    } catch (error) {
        console.error('Error getting tasks:', error);
        return [];
    }
}

async function createTask(taskDetails) {
    try {
        const result = await ipcRenderer.invoke('tasks-create-task', taskDetails, '@default');

        if (result.success) {
            console.log('Task created:', result.task);
            return result.task;
        } else {
            console.error('Failed to create task:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error creating task:', error);
        return null;
    }
}

async function completeTask(taskId) {
    try {
        const result = await ipcRenderer.invoke('tasks-complete-task', taskId, '@default');

        if (result.success) {
            console.log('Task completed:', result.task);
            return result.task;
        } else {
            console.error('Failed to complete task:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error completing task:', error);
        return null;
    }
}

async function deleteTask(taskId) {
    try {
        const result = await ipcRenderer.invoke('tasks-delete-task', taskId, '@default');

        if (result.success) {
            console.log('Task deleted successfully');
            return result.result;
        } else {
            console.error('Failed to delete task:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        return null;
    }
}