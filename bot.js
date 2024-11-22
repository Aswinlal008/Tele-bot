// Import the Telegram Bot API package
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const fs = require('fs');
const moment = require('moment-timezone'); // Import moment-timezone
const storageFilePath = './storage.json';
const logFilePath = './bot_actions.log'; // Log file to track actions

// Read storage file
function readStorage() {
  try {
    if (fs.existsSync(storageFilePath)) {
      const data = fs.readFileSync(storageFilePath, 'utf8');
      return JSON.parse(data); // Parse JSON content
    }
    return {}; // If file doesn't exist, return an empty object
  } catch (error) {
    console.error('Error reading storage file:', error);
    return {}; // Return empty object if JSON parsing fails
  }
}

// Write to storage file
function writeStorage(data) {
  try {
    fs.writeFileSync(storageFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing to storage file:', error);
  }
}

// Log actions to a file
function logAction(action) {
  const logMessage = `${getCurrentTime()} - ${action}\n`;
  fs.appendFileSync(logFilePath, logMessage);
}

// Replace with your bot's token from BotFather
const token = '7335742201:AAFoImQFzV8wY1FSO-R7kU7ER3exaizELXs'; // Replace with your bot token
const botUsername = 'ISEECloud_bot'; // Replace with your bot's username, e.g., ISEECloud_bot

// Define the admin user ID (replace with your actual Telegram user ID)
const adminUserId = 803543058; // Replace with the actual admin's user_id

// Create a new bot instance using polling
const bot = new TelegramBot(token, { polling: true });

// Load stored data on startup
const fileStore = readStorage();
let batchToken = null; // Temporary batch token for storing multiple files

// Function to get the current time in GMT +5:30
function getCurrentTime() {
  return moment.tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // Format in desired time zone
}

// Check if the user is the admin
function isAdmin(msg) {
  return msg.from.id === adminUserId;
}

// Restrict admin-only commands
function restrictAdminCommand(msg, callback) {
  const chatId = msg.chat.id;
  if (isAdmin(msg)) {
    callback();
  } else {
    bot.sendMessage(chatId, 'Sorry, you are not authorized to use this command.');
  }
}

// Add a new command to list all stored files or batches with access and delete links
bot.onText(/\/listfiles/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);

    if (fileTokens.length > 0) {
      const fileList = fileTokens
        .map((token, index) => {
          const fileData = fileStore[token];
          const accessLink = `https://t.me/${botUsername}?start=${token}`;
          const deleteCommand = `/deletefile ${token}`;
          const fileName = fileData.fileName || 'Unnamed';

          return `${index + 1}. **File Name**: ${fileName}\n**Access Link**: [Open File](${accessLink})\n**Delete Command**: [Delete File](tg://msg?text=${deleteCommand})\n**Timestamp**: ${fileData.timestamp}`;
        })
        .join('\n\n'); // Separate each entry with newlines

      bot.sendMessage(chatId, `Here are the stored files or batches:\n\n${fileList}`, {
        parse_mode: 'Markdown', // Enable Markdown formatting
      });
    } else {
      bot.sendMessage(chatId, 'No files or batches stored.');
    }
  });
});

// Add a new command to list only file names and their access links
bot.onText(/\/listfilenames/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);

    if (fileTokens.length > 0) {
      const fileList = fileTokens
        .map((token, index) => {
          const fileData = fileStore[token];
          const accessLink = `https://t.me/${botUsername}?start=${token}`;
          const fileName = fileData.fileName || 'Unnamed';

          return `${index + 1}. **File Name**: ${fileName}\n**Access Link**: [Open File](${accessLink})`;
        })
        .join('\n\n'); // Separate each entry with newlines

      bot.sendMessage(chatId, `Here are the stored files or batches:\n\n${fileList}`, {
        parse_mode: 'Markdown', // Enable Markdown formatting
      });
    } else {
      bot.sendMessage(chatId, 'No files or batches stored.');
    }
  });
});
