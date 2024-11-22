// Import required packages
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const fs = require('fs');
const moment = require('moment-timezone');

// File paths
const storageFilePath = './storage.json';
const logFilePath = './bot_actions.log';

// Read storage file
function readStorage() {
  try {
    if (fs.existsSync(storageFilePath)) {
      const data = fs.readFileSync(storageFilePath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error reading storage file:', error);
    return {};
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

// Current time in GMT+5:30
function getCurrentTime() {
  return moment.tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
}

// Telegram Bot credentials
const token = '7335742201:AAFoImQFzV8wY1FSO-R7kU7ER3exaizELXs'; // Replace with your bot token
const botUsername = 'ISEECloud_bot'; // Replace with your bot's username
const adminUserId = 803543058; // Replace with admin's user_id

// Initialize the bot
const bot = new TelegramBot(token, { polling: true });

// Initialize storage
const fileStore = readStorage();
let batchToken = null;

// Helper function to check if the user is an admin
function isAdmin(msg) {
  return msg.from.id === adminUserId;
}

// Helper function to restrict admin-only commands
function restrictAdminCommand(msg, callback) {
  const chatId = msg.chat.id;
  if (isAdmin(msg)) {
    callback();
  } else {
    bot.sendMessage(chatId, 'You are not authorized to use this command.');
  }
}

// Prevent duplicate commands
const registeredCommands = new Set();

// Register commands only once
function registerCommand(command, callback) {
  if (!registeredCommands.has(command)) {
    bot.onText(command, callback);
    registeredCommands.add(command);
  }
}

// Handle /start command
registerCommand(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1].trim();

  if (token) {
    if (fileStore[token]) {
      const fileData = fileStore[token];
      if (fileData.files) {
        const filePromises = fileData.files.map((fileData) => bot.sendDocument(chatId, fileData.fileId));
        Promise.all(filePromises)
          .then(() => bot.sendMessage(chatId, 'All files in the batch have been sent!'))
          .catch((error) => {
            bot.sendMessage(chatId, 'There was an issue retrieving the files.');
            console.error(error);
          });
      } else {
        bot.sendDocument(chatId, fileData.fileId)
          .then(() => bot.sendMessage(chatId, 'Here is your requested file!'))
          .catch((error) => {
            bot.sendMessage(chatId, 'There was an issue retrieving the file.');
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

// Handle /help command
registerCommand(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Commands:\n
/start - Access a file or batch with a token\n
/help - Get help with bot features\n
/singlefile - Store a single file (admin only)\n
/batchfile - Start a batch (admin only)\n
/listfiles - List all stored files or batches (admin only)\n
/deletefile <token> - Delete a stored file or batch (admin only)`);
});

// Handle /singlefile command
registerCommand(/\/singlefile/, (msg) => {
  restrictAdminCommand(msg, () => {
    bot.sendMessage(msg.chat.id, 'Please send a single file to store.');
  });
});

// Handle /batchfile command
registerCommand(/\/batchfile/, (msg) => {
  restrictAdminCommand(msg, () => {
    batchToken = crypto.randomBytes(16).toString('hex');
    fileStore[batchToken] = { files: [], chatId: msg.chat.id, timestamp: getCurrentTime() };
    writeStorage(fileStore);
    bot.sendMessage(msg.chat.id, `Batch mode started. Use token: ${batchToken}`);
    logAction(`Batch created with token: ${batchToken}`);
  });
});

// Handle incoming files
bot.on('message', (msg) => {
  if (msg.document || msg.photo) {
    const chatId = msg.chat.id;
    if (isAdmin(msg)) {
      let fileId, fileName;
      if (msg.document) {
        fileId = msg.document.file_id;
        fileName = msg.document.file_name || 'Unnamed File';
      } else if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
        fileName = 'Photo File';
      }

      if (batchToken && fileStore[batchToken]) {
        fileStore[batchToken].files.push({ fileId, fileName });
        writeStorage(fileStore);
        bot.sendMessage(chatId, `File added to batch. Token: ${batchToken}`);
        logAction(`File added to batch: ${batchToken}`);
      } else {
        const fileToken = crypto.randomBytes(16).toString('hex');
        fileStore[fileToken] = { fileId, fileName, chatId, timestamp: getCurrentTime() };
        writeStorage(fileStore);
        bot.sendMessage(chatId, `File stored. Token: ${fileToken}`);
        logAction(`File stored: ${fileToken}`);
      }
    } else {
      bot.sendMessage(chatId, 'You are not authorized to store files.');
    }
  }
});

// Handle /deletefile command
registerCommand(/\/deletefile (\w{32})/, (msg, match) => {
  restrictAdminCommand(msg, () => {
    const fileToken = match[1];
    if (fileStore[fileToken]) {
      delete fileStore[fileToken];
      writeStorage(fileStore);
      bot.sendMessage(msg.chat.id, 'File or batch deleted successfully.');
      logAction(`File deleted: ${fileToken}`);
    } else {
      bot.sendMessage(msg.chat.id, 'No file or batch found for the given token.');
    }
  });
});

// Handle /listfiles command
registerCommand(/\/listfiles/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);

    if (fileTokens.length > 0) {
      const fileList = fileTokens
        .map((token, index) => {
          const fileData = fileStore[token];
          const link = `https://t.me/${botUsername}?start=${token}`;
          return `${index + 1}. Token: ${token}\nFile: ${fileData.fileName || 'Unnamed'}\nLink: ${link}\nTime: ${fileData.timestamp}`;
        })
        .join('\n\n');
      bot.sendMessage(chatId, `Stored files:\n\n${fileList}`);
    } else {
      bot.sendMessage(chatId, 'No files or batches stored.');
    }
  });
});
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