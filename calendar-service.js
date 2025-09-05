const {google} = require('googleapis');
const fs = require('fs');
const path = require('path');

class CalendarService {
    constructor(clientId, clientSecret) {
        this.oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'urn:ietf:wg:oauth:2.0:oob'
        );

        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
        this.tasks = google.tasks({version: 'v1', auth: this.oauth2Client });
        this.tokenPath = path.join(__dirname, 'calendar-token.json');

        // Try to load existing tokens
        this.loadTokens();
    }

    loadTokens() {
        try {
            if (fs.existsSync(this.tokenPath)) {
                const tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
                this.oauth2Client.setCredentials(tokens);
                console.log('Calendar tokens loaded successfully');
            }
        } catch (error) {
            console.log('No existing calendar tokens found');
        }
    }

    saveTokens(tokens) {
        try {
            fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));
            this.oauth2Client.setCredentials(tokens);
            console.log('Calendar tokens saved successfully');
        } catch (error) {
            console.error('Failed to save calendar tokens', error);
        }
    }

    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/tasks'
        ];
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
        });
    }

    async setAuthCode(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.saveTokens(tokens);
            return true;
        } catch (error) {
            console.error('Failed to exchange auth code', error);
            return false;
        }
    }

    isAuthenticated() {
        const credentials = this.oauth2Client.credentials;
        return credentials && credentials.access_token;
    }

    async getEvents(maxResults=10) {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated with Google Calendar');
            }

            const response = await this.calendar.events.list({
                calendarId: 'primary',
                timeMin: new Date().toISOString(),
                maxResults: maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });

            return response.data.items || [];
        } catch (error) {
            console.error('Error fetching calendar events', error);
            throw error;
        }
    }

    async createEvent(eventDetails) {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated with Google Calendar');
            }

            const event = {
                summary: eventDetails.title,
                description: eventDetails.description || '',
                start: {
                    dateTime: eventDetails.startTime,
                    timeZone: 'America/New_York', // Eastern Time (handles EST/EDT automatically)
                },
                end: {
                    dateTime: eventDetails.endTime,
                    timeZone: 'America/New_York', // Eastern Time (handles EST/EDT automatically)
                },
            };

            console.log('Creating event in Eastern Time:');
            console.log('Event details:', event);

            const response = await this.calendar.events.insert({
                calendarId: 'primary',
                resource: event,
            });

            return response.data;
        } catch (error) {
            console.error('Error creating calendar event:', error);
            throw error;
        }
    }

    // Tasks Methods
    async getTaskLists() {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated with Google Tasks');
            }

            const response = await this.tasks.tasklists.list();
            return response.data.items || [];
        } catch (error) {
            console.error('Error fetching task lists:', error);
            throw error;
        }
    }

    async getTasks(taskListId = '@default', maxResults=20) {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated with Google Tasks');
            }

            const response = await this.tasks.tasks.list({
                tasklist: taskListId,
                maxResults: maxResults,
                showCompleted: false, // Only show incomplete tasks by default
                showHidden: false
            });

            return response.data.items || [];
        } catch (error) {
            console.error('Error fetching tasks:', error);
            throw error;
        }
    }

    async createTask(taskDetails, taskListId = '@default') {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated with Google Tasks');
            }

            const task = {
                title: taskDetails.title,
                notes: taskDetails.notes || taskDetails.description || '',
                due: taskDetails.dueDate ? new Date(taskDetails.dueDate).toISOString() : undefined
            };

            console.log('Creating task:', task);

            const response = await this.tasks.tasks.insert({
                tasklist: taskListId,
                resource: task
            });

            return response.data;
        } catch (error) {
            console.error('Erorr creating task:', error);
            throw error;
        }
    }

    async completeTask(taskId, taskListId = '@default') {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated with Google Tasks');
            }

            const response = await this.tasks.tasks.patch({
                tasklist: taskListId,
                task: taskId,
                resource: {
                    status: 'completed'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Erro completing tasj:' ,error);
            throw error;
        }
    }

    async deleteTask(taskId, taskListId = '@default') {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated with Google Tasks');
            }

            await this.tasks.tasks.delete({
                tasklist: taskListId,
                task: taskId
            });

            return { success:true };
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    }
}



module.exports = CalendarService