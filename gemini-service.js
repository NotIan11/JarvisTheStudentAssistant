const {GoogleGenerativeAI} = require('@google/generative-ai');
const MarkdownIt = require('markdown-it');

class GeminiService {
    constructor(apiKey) {
        console.log('Initializing Gemini with API key length:', apiKey ? apiKey.length : 'undefined');
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({model: "gemini-1.5-flash"});
        
        // Initialize markdown parser with safe settings
        this.md = new MarkdownIt({
            html: false,        // Disable HTML tags in source for security
            xhtmlOut: true,     // Use '/' to close single tags
            breaks: true,       // Convert '\n' in paragraphs into <br>
            linkify: true,      // Autoconvert URL-like text to links
            typographer: true   // Enable smart quotes and other replacements
        });
        
        console.log('Gemini service initialized successfully');
    }

    async generateResponse(prompt, conversationHistory = [], memoryContext = {}) {
        try {
            console.log('Generating response for prompt:', prompt);

            // Build system prompt with memory context
            let systemPrompt = `
You are Jarvis, an intelligent AI assistant. You have access to the user's Google Calendar and Google Tasks.

MEMORY CONTEXT:
${memoryContext.userPreferences ? `User Info: ${JSON.stringify(memoryContext.userPreferences)}` : ''}
${memoryContext.recentFacts ? `Recent Facts: ${memoryContext.recentFacts.map(f => f.text).join(', ')}` : ''}
${memoryContext.previousTopics ? `Previous Topics: ${memoryContext.previousTopics.map(t => t.topic).join(', ')}` : ''}

CALENDAR & TASKS ACCESS:
You can see upcoming calendar events and current tasks.
${memoryContext.calendarEvents ? `Upcoming Events: ${JSON.stringify(memoryContext.calendarEvents)}` : ''}
${memoryContext.tasks ? `Current Tasks: ${JSON.stringify(memoryContext.tasks)}` : ''}

CAPABILITIES:
- You CAN view existing calendar events and tasks
- You CAN help plan around existing events
- You CAN discuss calendar conflicts and availability
- You CAN create new calendar events by calling functions
- You CAN create, complete, and delete tasks by calling functions

AVAILABLE FUNCTIONS:

1. CREATE CALENDAR EVENT:
[FUNCTION_CALL]
{
  "function": "createCalendarEvent",
  "parameters": {
    "title": "Event Title",
    "description": "Optional description",
    "startTime": "YYYY-MM-DDTHH:MM:SS",
    "endTime": "YYYY-MM-DDTHH:MM:SS"
  }
}
[/FUNCTION_CALL]

2. CREATE TASK:
[FUNCTION_CALL]
{
  "function": "createTask",
  "parameters": {
    "title": "Task Title",
    "notes": "Optional notes/description",
    "dueDate": "YYYY-MM-DD" (optional)
  }
}
[/FUNCTION_CALL]

3. COMPLETE TASK:
[FUNCTION_CALL]
{
  "function": "completeTask",
  "parameters": {
    "taskId": "task_id_from_tasks_list",
    "taskListId": "@default"
  }
}
[/FUNCTION_CALL]

4. DELETE TASK:
[FUNCTION_CALL]
{
  "function": "deleteTask",
  "parameters": {
    "taskId": "task_id_from_tasks_list", 
    "taskListId": "@default"
  }
}
[/FUNCTION_CALL]

CRITICAL FUNCTION CALLING RULES:
- Use EXACT format above with [FUNCTION_CALL] and [/FUNCTION_CALL] tags
- For calendar events: startTime and endTime must be in Eastern Time format
- For tasks: Use simple YYYY-MM-DD format for dueDate if specified
- Always provide required parameters
- If user doesn't specify date/time, ask them to provide specifics
- CRITICAL: User is in Eastern Time (EST/EDT)
- For calendar times, use format like "2024-09-21T14:00:00" (no Z) for 2PM Eastern
- For task due dates, use format like "2024-09-21"

MARKDOWN FORMATTING (MANDATORY):
- Use **bold** for important information
- Use *italics* for emphasis
- Use bullet points with - or *
- Use ## for headings
- Use \`code\` for technical terms
- Use > for quotes
- Always format your responses in Markdown

RULES:
- Always respond in well-formatted Markdown
- Be helpful and professional
- If function calls fail, acknowledge the error and suggest alternatives
- For tasks, distinguish between due dates and general reminders
`;

            // Add memory context
            if (memoryContext.userPreferences && Object.keys(memoryContext.userPreferences).length > 0) {
                systemPrompt += "What I remember about you:\n";
                Object.entries(memoryContext.userPreferences).forEach(([key, value]) => {
                    systemPrompt += `- ${key}: ${value}\n`;
                });
                systemPrompt += "\n";
            }

            if (memoryContext.recentFacts && memoryContext.recentFacts.length > 0) {
                systemPrompt += "Recent facts from our conversations:\n";
                memoryContext.recentFacts.forEach(fact => {
                    systemPrompt += `- ${fact.text}\n`;
                });
                systemPrompt += "\n";
            }

            // Add calendar context
            if (memoryContext.calendarEvents && memoryContext.calendarEvents.length > 0) {
                systemPrompt += "CURRENT CALENDAR EVENTS:\n";
                memoryContext.calendarEvents.forEach(event => {
                    const startTime = new Date(event.start.dateTime || event.start.date);
                    const endTime = new Date(event.end.dateTime || event.end.date);
                    systemPrompt += `- **${event.summary}**: ${startTime.toLocaleString()} to ${endTime.toLocaleString()}\n`;
                    if (event.description) {
                        systemPrompt += `  Description: ${event.description}\n`;
                    }
                });
                systemPrompt += "\n";
            } else {
                systemPrompt += "CALENDAR STATUS: No upcoming events found or calendar not accessible.\n\n";
            }

            // Add conversation history
            if (conversationHistory.length > 0) {
                systemPrompt += "Current conversation:\n";
                conversationHistory.forEach(message => {
                    if (message.sender === 'user') {
                        systemPrompt += `Human: ${message.text}\n`;
                    } else {
                        systemPrompt += `Jarvis: ${message.text}\n`;
                    }
                });
                systemPrompt += "\n";
            }

            systemPrompt += `Current question: ${prompt}

IMPORTANT: 
- You have access to the user's calendar events listed above
- When asked about calendar/schedule, refer to the specific events shown
- Respond using ONLY Markdown syntax. Do not use any HTML tags. Use # for headings, **bold**, *italic*, - for lists, etc.
- Be helpful and specific about calendar information when available`;

            console.log('Full context prompt:', systemPrompt);

            const result = await this.model.generateContent(systemPrompt);
            const response = await result.response;
            let markdownText = response.text();
            
            console.log('Raw AI response:', markdownText);

            // Clean up any HTML that snuck through
            markdownText = markdownText
                .replace(/<h1>(.*?)<\/h1>/g, '# $1')
                .replace(/<h2>(.*?)<\/h2>/g, '## $1')
                .replace(/<h3>(.*?)<\/h3>/g, '### $1')
                .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
                .replace(/<em>(.*?)<\/em>/g, '*$1*')
                .replace(/<p>(.*?)<\/p>/g, '$1\n')
                .replace(/<code>(.*?)<\/code>/g, '`$1`')
                .replace(/<ul>/g, '')
                .replace(/<\/ul>/g, '')
                .replace(/<ol>/g, '')
                .replace(/<\/ol>/g, '')
                .replace(/<li>(.*?)<\/li>/g, '- $1')
                .replace(/<br\s*\/?>/g, '\n');

            console.log('Cleaned markdown:', markdownText);

            const htmlText = this.md.render(markdownText);
            console.log('Final HTML:', htmlText);

            // Parse function calls from the cleaned markdown
            const parsed = this.parseFunctionCalls(markdownText);
            console.log('Parsed function calls:', parsed.functionCalls);
            
            // If there are function calls, return both response and calls
            if (parsed.functionCalls.length > 0) {
                const finalHtml = this.md.render(parsed.response);
                return {
                    response: finalHtml,
                    functionCalls: parsed.functionCalls
                };
            } else {
                return htmlText; // Backward compatibility - just return HTML string
            }
        } catch (error) {
            console.error('Error in generateResponse:', error);
            throw error;
        }
    }

    // Parse function calls from AI response
    parseFunctionCalls(responseText) {
        const functionCalls = [];
        const functionCallRegex = /\[FUNCTION_CALL\](.*?)\[\/FUNCTION_CALL\]/gs;
        let match;
        
        while ((match = functionCallRegex.exec(responseText)) !== null) {
            try {
                const functionCall = JSON.parse(match[1].trim());
                functionCalls.push(functionCall);
            } catch (error) {
                console.error('Failed to parse function call:', match[1]);
            }
        }
        
        // Remove function calls from response text
        const cleanedResponse = responseText.replace(functionCallRegex, '').trim();
        
        return {
            response: cleanedResponse,
            functionCalls: functionCalls
        };
    }

    cleanAndFormatResponse(text) {
        // Much simpler cleaning that preserves structure
        return text
            // Only fix obvious spacing issues around formatting
            .replace(/\*\*\s+([^*]+)\s+\*\*/g, '**$1**')  // Fix spaced bold
            .replace(/\*\s+([^*]+)\s+\*/g, '*$1*')        // Fix spaced italic
            .replace(/`\s+([^`]+)\s+`/g, '`$1`')          // Fix spaced code
            
            // Fix bullet points that are missing spaces after dash
            .replace(/^(\s*)[-*+](\S)/gm, '$1- $2')
            
            // Fix numbered lists that are missing spaces
            .replace(/^(\s*)(\d+)\.(\S)/gm, '$1$2. $3')
            
            // Clean up excessive whitespace but preserve line breaks
            .replace(/[ \t]+/g, ' ')           // Multiple spaces to single space
            .replace(/\n{3,}/g, '\n\n')       // Multiple newlines to double
            
            // Clean up trailing/leading whitespace
            .trim();
    }

    fixBulletFormatting(text) {
        return text
            // Fix bullet points that lost their dash due to formatting
            .replace(/^(\s*)\*([^*\s])/gm, '$1- *$2')  // *text at start of line
            .replace(/^(\s*)\*\*([^*\s])/gm, '$1- **$2')  // **text at start of line
            
            // Ensure proper spacing in bullet lists
            .replace(/^(\s*)-\s*\*([^*]+)\*\s*$/gm, '$1- *$2*')  // Clean up italic bullets
            .replace(/^(\s*)-\s*\*\*([^*]+)\*\*\s*$/gm, '$1- **$2**')  // Clean up bold bullets
            .replace(/^(\s*)-\s*`([^`]+)`\s*$/gm, '$1- `$2`')  // Clean up code bullets
            
            // Add space after dash if missing
            .replace(/^(\s*)-(\w)/gm, '$1- $2');
    }
}

module.exports = GeminiService;