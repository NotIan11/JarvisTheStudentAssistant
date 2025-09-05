# 🤖 Jarvis - AI Assistant with Calendar & Task Integration

**Jarvis** is a cross-platform Electron application that acts as an intelligent AI assistant, similar to Jarvis from Iron Man. It integrates with Google Calendar and Google Tasks to help you manage your schedule and tasks through natural conversation.

![Jarvis Interface](https://img.shields.io/badge/Platform-Electron-blue?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green?style=flat-square)
![Google APIs](https://img.shields.io/badge/Google%20APIs-Calendar%20%7C%20Tasks-red?style=flat-square)

## ✨ Features

- **🧠 AI-Powered Conversations** - Powered by Google Gemini AI with contextual memory
- **📅 Google Calendar Integration** - View, create, and manage calendar events
- **✅ Google Tasks Integration** - Create, complete, and delete tasks
- **💾 Persistent Memory** - Remembers your preferences, facts, and conversation history
- **🎨 Beautiful UI** - Modern, dark-themed interface with smooth animations
- **💬 Chat History** - Sidebar with all your previous conversations
- **🔄 Function Calling** - AI can directly interact with your calendar and tasks

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Google Cloud Platform account** (for API access)

### Installation

1. **Clone or download** this repository
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Google APIs** (see [Google API Setup](#google-api-setup) below)

4. **Create your `.env` file:**
   ```bash
   # Copy the example and fill in your credentials
   GEMINI_API_KEY=your_gemini_api_key_here
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   ```

5. **Run the application:**
   ```bash
   npm start
   ```

## 🔧 Google API Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project called "Jarvis" (or use existing)
3. Enable the following APIs:
   - **Google Calendar API**
   - **Google Tasks API**

### Step 2: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Choose **Desktop Application**
4. Download the credentials JSON file
5. Copy the `client_id` and `client_secret` to your `.env` file

### Step 3: Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `GEMINI_API_KEY`

## 🎯 Usage

### First Time Setup

1. **Launch Jarvis** with `npm start`
2. **Click "Integrate Calendar"** button
3. **Complete Google OAuth** flow in your browser
4. **Paste the authorization code** when prompted
5. **Start chatting!** Ask Jarvis about your schedule or tasks

### Example Conversations

```
You: "What do I have scheduled for today?"
Jarvis: Shows your calendar events for today

You: "Create a meeting with the team at 2 PM tomorrow"
Jarvis: ✅ Event "Meeting with the team" created successfully

You: "Add a task to review the quarterly report"
Jarvis: ✅ Task "Review the quarterly report" created successfully

You: "Mark that task as complete"
Jarvis: ✅ Task completed successfully
```

### Available Commands

- **📅 Calendar:** "What's my schedule?", "Create a meeting...", "Do I have conflicts?"
- **✅ Tasks:** "Add a task...", "Mark [task] as done", "Delete the [task] task"
- **🧠 Memory:** "Remember that I prefer morning meetings", "My name is..."
- **💬 General:** Ask questions, get help, have conversations

## 🏗️ Project Structure

```
jarvis/
├── main.js              # Electron main process
├── renderer.js          # UI logic and event handling
├── gemini-service.js    # AI integration and prompt engineering
├── calendar-service.js  # Google Calendar & Tasks API wrapper
├── index.html           # Application UI structure
├── style.css            # Application styling
├── package.json         # Dependencies and scripts
├── .env                 # API keys and credentials (create this)
└── .gitignore          # Git ignore rules
```

## 🛠️ Development

### Key Components

- **Main Process (`main.js`)** - Handles app lifecycle, IPC, and API calls
- **Renderer Process (`renderer.js`)** - Manages UI, animations, and user interactions
- **Gemini Service** - AI conversation handling with function calling
- **Calendar Service** - Google APIs wrapper with OAuth management

### Memory System

Jarvis automatically remembers:
- **User preferences** (name, job, location, etc.)
- **Important facts** from conversations
- **Recent conversation topics**
- **Calendar events and tasks** (for context)

### Function Calling

The AI can execute functions directly:
- `createCalendarEvent` - Creates calendar events
- `createTask` - Creates new tasks
- `completeTask` - Marks tasks as complete
- `deleteTask` - Removes tasks

## 🔒 Privacy & Security

- **Local Storage** - All conversations and memory stored locally
- **Secure OAuth** - Standard Google OAuth 2.0 flow
- **No Data Collection** - Your data stays on your device
- **API Keys** - Stored in `.env` file (excluded from git)

## 🐛 Troubleshooting

### Calendar Integration Issues

1. **Check API enablement** in Google Cloud Console
2. **Verify OAuth credentials** in `.env` file
3. **Clear integration** by deleting `calendar-token.json`
4. **Restart the app** and re-integrate

### Common Errors

- **"No handler registered"** - Restart the app completely
- **"404 Not Found models/gemini-pro"** - Using old model name, should be `gemini-1.5-flash`
- **OAuth errors** - Check client ID/secret, ensure APIs are enabled

### Debug Mode

Open Developer Tools in the app to see console logs:
- **Windows/Linux:** `Ctrl + Shift + I`
- **macOS:** `Cmd + Option + I`

## 🚀 Future Enhancements

- **📧 Gmail Integration** - Read and send emails
- **📝 Notion Integration** - Manage notes and databases
- **🔄 Outlook Support** - Microsoft Calendar integration
- **🎙️ Voice Commands** - Speech-to-text input
- **📱 Mobile Companion** - Cross-platform synchronization

## 📄 License

This project is for educational and personal use. Please ensure compliance with Google's API Terms of Service.

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome! Feel free to:
- Report bugs
- Suggest features
- Share improvements

---

**Built with ❤️ using Electron, Google Gemini AI, and Google APIs**