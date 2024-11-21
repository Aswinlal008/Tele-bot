// Import the Telegram Bot API package
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const fs = require('fs');
const moment = require('moment-timezone');  // Import moment-timezone
const storageFilePath = './storage.json';

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
  return moment.tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');  // Format in desired time zone
}

// Respond to a "/start" command or deep link
bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1].trim(); // Extract the token from the deep link if provided

  if (token) {
    // If a token is provided, retrieve the corresponding file(s)
    if (fileStore[token]) {
      const fileData = fileStore[token];
      if (fileData.files) {
        // Handle batch
        const filePromises = fileData.files.map((fileId) => bot.sendDocument(chatId, fileId));
        Promise.all(filePromises)
          .then(() => bot.sendMessage(chatId, 'All files in the batch have been sent!'))
          .catch((error) => {
            bot.sendMessage(chatId, 'There was an issue retrieving the files.');
            console.error(error);
          });
      } else {
        // Handle single file
        bot.sendDocument(chatId, fileData.fileId)
          .then(() => bot.sendMessage(chatId, 'Here is your requested file!'))
          .catch((error) => {
            bot.sendMessage(chatId, 'Sorry, there was an issue retrieving the file.');
            console.error(error);
          });
      }
    } else {
      bot.sendMessage(chatId, 'Invalid token! No file or batch found.');
    }
  } else {
    bot.sendMessage(chatId, 'Welcome! Use /help to see the available commands.');
  }
});

// Respond to a "/help" command with updated commands list
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Here are the commands I can assist you with:\n
/start - Start the bot or access a file using a deep link\n
/help - Get help with the bot's features\n
/deletefile <token> - Delete a stored file or batch (admin only)\n
/listfiles - List all stored files or batches (admin only)`);
});

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

// Handle "/singlefile" command to store a single file for the admin
bot.onText(/\/singlefile/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please send a single file to store.');
  });
});

// Handle "/batchfile" command to start storing multiple files under one token
bot.onText(/\/batchfile/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    batchToken = crypto.randomBytes(16).toString('hex');
    fileStore[batchToken] = { files: [], chatId, timestamp: getCurrentTime() }; // Store the timestamp with GMT+5:30
    writeStorage(fileStore);
    bot.sendMessage(chatId, `Batch mode started! Use token: ${batchToken}. Send files to add them to this batch.`);
  });
});

// Handle incoming files (store single or multiple files)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (msg.document || msg.photo) {
    if (isAdmin(msg)) {
      let fileId;

      if (msg.document) {
        fileId = msg.document.file_id;
      } else if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id; // Highest resolution
      }

      if (batchToken && fileStore[batchToken]) {
        // Add to the current batch
        fileStore[batchToken].files.push(fileId);
        writeStorage(fileStore);
        bot.sendMessage(chatId, `File added to batch! Use link: https://t.me/${botUsername}?start=${batchToken}`);
      } else {
        // Single file handling
        const fileToken = crypto.randomBytes(16).toString('hex');
        fileStore[fileToken] = { fileId, chatId, timestamp: getCurrentTime() }; // Store the timestamp with GMT+5:30
        writeStorage(fileStore);
        bot.sendMessage(chatId, `Your file has been stored! Use this link to access it: https://t.me/${botUsername}?start=${fileToken}`);
      }
    } else {
      bot.sendMessage(chatId, 'You are not authorized to store files.');
    }
  }
});

// Add a new command to delete a file or batch
bot.onText(/\/deletefile (\w{32})/, (msg, match) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileToken = match[1];

    if (fileStore[fileToken]) {
      delete fileStore[fileToken];
      writeStorage(fileStore);
      bot.sendMessage(chatId, 'File or batch deleted successfully!');
    } else {
      bot.sendMessage(chatId, 'Sorry, no file or batch found for that token.');
    }
  });
});

// Add a new command to list all stored files or batches
bot.onText(/\/listfiles/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);

    if (fileTokens.length > 0) {
      const fileList = fileTokens
        .map((token, index) => {
          const fileData = fileStore[token];
          return `${index + 1}. Token: ${token}\nLink: https://t.me/${botUsername}?start=${token}\nTimestamp: ${fileData.timestamp}`;
        })
        .join('\n\n');
      bot.sendMessage(chatId, `Here are the stored files or batches:\n\n${fileList}`);
    } else {
      bot.sendMessage(chatId, 'No files or batches stored.');
    }
  });
});
