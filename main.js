const { create } = require('domain');
const {app, BrowserWindow, ipcMain, shell} = require('electron');
const path =require('path');
const GeminiService = require('./gemini-service');
const CalendarService = require('./calendar-service');
const { error } = require('console');

// Initialize Gemini
require('dotenv').config();
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

// Initialize Calendar
const calendarService = new CalendarService(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
)

// ADD THIS DEBUG LINE:
console.log('Calendar service initialized. Client ID exists:', !!process.env.GOOGLE_CLIENT_ID);

//Add IPC Handler
ipcMain.handle('gemini-request', async (event, message, conversationHistory = [], memoryContext = {}) => {
    try {
        console.log('Received message:', message);
        console.log('Conversation history length::', conversationHistory.length);
        console.log('Memory Context:', memoryContext);
        console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
        console.log('API Key length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'undefined');

        const response = await geminiService.generateResponse(message, conversationHistory, memoryContext);
        console.log('Gemini response:', response);

        // Check if response contains function calls
        if (response.functionCalls) {
            console.log('=== FUNCTION CALLS DETECTED ===');
            console.log('Functio ncalls:', response.functionCalls);

            // Execute function calls
            const functionResults = [];
            for (const functionCall of response.functionCalls) {
                try {
                    console.log(`Executing function: ${functionCall.function}`);
                    const result = await executeFunctionCall(functionCall);
                    functionResults.push(result);
                    console.log(`Function result:`, result);
                } catch (functionError) {
                    console.error(`Function execution error:`, functionError);
                    functionResults.push({
                        success: false,
                        error: functionError.message,
                        function : functionCall.function
                    });
                }
            }

            return {
                success: true,
                response: response.response,
                functionCalls: response.functionCalls,
                functionResults: functionResults
            };
        } else {
            // Backward compatibility - no function calls
            return {success: true, response};
        }
    } catch (error) {
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        return {success: false, error:error.message};
    }
});

// Function to execute function calls
async function executeFunctionCall(functionCall) {
    console.log('=== EXECUTING FUNCTION CALL ===');
    console.log('Function:', functionCall.function);
    console.log('Parameters:', functionCall.parameters);

    switch (functionCall.function) {
        case 'createCalendarEvent':
            try {
                const eventDetails = {
                    title: functionCall.parameters.title,
                    description: functionCall.parameters.description,
                    startTime: functionCall.parameters.startTime,
                    endTime: functionCall.parameters.endTime
                };

                console.log('Creating calendar event with details:', eventDetails);
                const event = await calendarService.createEvent(eventDetails);
                console.log('Calendar event created successfully:', event);

                return {
                    success: true,
                    function: 'createCalendarEvent',
                    result: event,
                    message: `Event "${eventDetails.title}" created successfully`
                };
            } catch (error) {
                console.error('Calendar event creation failed:', error);
                throw new Error(`Failed to create calendar event: ${error.message}`);
            }

        case 'createTask':
            try {
                const taskDetails = {
                    title: functionCall.parameters.title,
                    notes: functionCall.parameters.notes || functionCall.parameters.description,
                    dueDate: functionCall.parameters.dueDate
                };

                console.log('Creating task with details:', taskDetails);
                const task = await calendarService.createTask(taskDetails);
                console.log('Task created successfully:', task);

                return {
                    success: true,
                    function: 'createTask',
                    result: task,
                    message: `Task "${taskDetails.title}" created successfully`
                };
            } catch (error) {
                console.error('Task creation failed:', error);
                throw new Error(`Failed to create task: ${error.message}`);
            }

        case 'completeTask':
            try {
                const { taskId, taskListId } = functionCall.parameters;

                console.log('Completing task:', {taskId,taskListId});
                const task = await calendarService.completeTask(taskId,taskListId);
                console.log('Task completed succesfully:', task);

                return {
                    success: true,
                    function: 'completeTask',
                    result: task,
                    message: `Task completed successfully`
                };
            } catch (error) {
                console.error('Task completion failed:', error);
                throw new Error(`Failed to complete task: ${error.message}`);
            }

        case 'deleteTask':
            try {
                const {taskId, taskListId} = functionCall.parameters;

                console.log('Deleting task:', {taskId, taskListId});
                const result = await calendarService.deleteTask(taskId, taskListId);
                console.log('Task deleted successfully:', result);

                return {
                    success: true,
                    function: 'deleteTask',
                    result: result,
                    message: `Task deleted successfully`
                };
            } catch (error) {
                console.error('Task deletion failed:', error);
                throw new Error(`Failed to delete task: ${error.message}`);
            }
        
        default:
            throw new Error(`Unknown function: ${functionCall.function}`);
    }
}

ipcMain.handle('calendar-authenticate', async (event) => {
    try {
        console.log('=== IPC CALENDAR-AUTHENTICATE START ===');
        console.log('About to call calendarService.getAuthUrl()...');
        
        const authUrl = calendarService.getAuthUrl();
        console.log('Auth URL generated successfully:', authUrl);
        
        console.log('About to open external URL...');
        require('electron').shell.openExternal(authUrl);
        console.log('External URL opened successfully');
        
        console.log('=== IPC CALENDAR-AUTHENTICATE SUCCESS ===');
        return {success: true, authUrl};
    } catch (error) {
        console.error('=== IPC CALENDAR-AUTHENTICATE ERROR ===');
        console.error('Calendar auth error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('=== IPC CALENDAR-AUTHENTICATE ERROR END ===');
        return { success: false, error: error.message};
    }
});

ipcMain.handle('calendar-set-auth-code', async (event, authCode) => {
    try {
        const success = await calendarService.setAuthCode(authCode);
        return { success };
    } catch (error) {
        console.error('Calendar auth code error:', error);
        return {success: false, error:error.message};
    }
});

ipcMain.handle('calendar-get-events', async (event,maxResults=10) => {
    try {
        const events = await calendarService.getEvents(maxResults);
        return { success: true, events };
    } catch (error) {
        console.error('Calendar get events error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('calendar-create-event', async (event, eventDetails) => {
    try {
        const event = await calendarService.createEvent(eventDetails);
        return { success: true, event };
    } catch (error) {
        console.error('Calendar create event error:', error);
        return {success: false, error: error.message};
    }
});

// Tasks IPC handlers
ipcMain.handle('tasks-get-lists', async (event) => {
    try {
        const tasklists = await calendarService.getTaskLists();
        return { success: true, tasklists };
    } catch (error) {
        console.error('Tasks get lists error', error);
        return { success: false, error: error.message };
    }
})

ipcMain.handle('tasks-get-tasks', async (event, taskListId = '@default', maxResults = 20) => {
    try {
        const tasks = await calendarService.getTasks(taskListId, maxResults);
        return { success: true, tasks };
    } catch (error) {
        console.error('Tasks get tasks error:', error);
        return {success :false, error: error.message};
    }
});

ipcMain.handle('tasks-create-task', async (event, taskDetails, taskListId = '@default') => {
    try {
        const task = await calendarService.createTask(taskDetails, taskListId);
        return { success: true, task };
    } catch (error) {
        console.error('Tasks create task error:', error);
        return { success: false, error: error.message};
    }
});

ipcMain.handle('tasks-complete-task', async (event, taskId, taskListId = '@default') => {
    try {
        const task = await calendarService.completeTask(taskId, taskListId);
        return {success: true, task};
    } catch (error) {
        console.error('Tasks complete task error:', error);
        return { success: false, error: error.message};
    }
});

ipcMain.handle('tasks-delete-task', async (event, taskId, taskListId = '@default') => {
    try {
        const result = await calendarService.deleteTask(taskId,taskListId);
        return { success: true, result };
    } catch (error) {
        console.error('Tasks delete task error:', error);
        return { success: false, error: error.message };
    }
});

function createWindow() {
    // Create browser window
    const mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    // Load HTML file
    mainWindow.loadFile('index.html')
}

// Call App
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
