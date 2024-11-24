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
  if (isAdmin(msg)) {
    callback();
  } else {
    bot.sendMessage(msg.chat.id, 'You are not authorized to use this command.');
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

  // If no token is provided, send a welcome message with a contact button
  if (!token) {
    const welcomeMessage = 'Welcome to the bot! Please provide a valid token to access files.';
    
    // Creating an inline keyboard with a contact button
    const contactButton = {
      text: 'Contact Support',  // Button text
      url: 'https://t.me/aswinlalus' // Link to BotFather (replace with your contact link or support link)
    };
    
    const inlineKeyboard = {
      inline_keyboard: [
        [contactButton]  // Adding the button to the keyboard
      ]
    };

    bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: inlineKeyboard  // Attach the inline keyboard to the message
    });
    return;
  }

  // If a token is provided
  if (token && fileStore[token]) {
    const fileData = fileStore[token];
    if (fileData.files) {
      const filePromises = fileData.files.map((fileData) => bot.sendDocument(chatId, fileData.fileId));
      Promise.all(filePromises)
        .then(() => bot.sendMessage(chatId, 'All files in the batch have been sent!'))
        .catch((error) => bot.sendMessage(chatId, 'There was an issue retrieving the files.'));
    } else {
      bot.sendDocument(chatId, fileData.fileId)
        .then(() => bot.sendMessage(chatId, 'Here is your requested file!'));
    }
  } else {
    bot.sendMessage(chatId, 'Invalid token! No file or batch found.');
  }
});

// Handle /help command
registerCommand(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Commands:\n/start - Access a file or batch with a token\n/help - Get help with bot features`);
});

// Handle /helpadmin command
registerCommand(/\/helpadmin/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Admin Commands:\n
/sendfile <file_name> - Store a file or start a batch\n
/addfiletobatch <batch_token> - Add files to an existing batch\n
/removefilefrombatch <batch_token> <file_index> - Remove a file from a batch\n
/listfiles - List all stored files or batches\n
/listfilenames - List file names with links\n
/editfilename <token> <new_name> - Edit the name of a stored file\n
/deletefile <token> - Delete a file or batch\n
/status - Get bot status\n
/clearlogs - Clear action logs`);
  });
});

// Handle /sendfile command
registerCommand(/\/sendfile/, (msg) => {
  restrictAdminCommand(msg, () => {
    bot.sendMessage(msg.chat.id, 'Please reply with a name for the file/batch.');
    bot.once('message', (titleMsg) => {
      const fileName = titleMsg.text.trim();
      batchToken = crypto.randomBytes(16).toString('hex');
      fileStore[batchToken] = {
        files: [],
        fileName,
        chatId: msg.chat.id,
        timestamp: getCurrentTime()
      };
      bot.sendMessage(msg.chat.id, `Batch mode started with name "${fileName}". Use token: \`${batchToken}\``);
      logAction(`Batch created with token: ${batchToken} and name: ${fileName}`);
      bot.sendMessage(msg.chat.id, `Now send the file(s) to add to the batch.`);
    });
  });
});

// Handle incoming files for batch or single
bot.on('message', (msg) => {
  if (msg.document || msg.photo || msg.audio || msg.video || msg.voice || msg.video_note) {
    const chatId = msg.chat.id;
    if (isAdmin(msg)) {
      let fileId, fileName, mimeType, fileSize;

      // Handle different types of files
      if (msg.document) {
        fileId = msg.document.file_id;
        fileName = msg.document.file_name || 'Unnamed Document';
        mimeType = msg.document.mime_type;
        fileSize = msg.document.file_size;
      } else if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id; // The largest photo
        fileName = 'Photo File';
        mimeType = 'image/jpeg'; // Default for photos
        fileSize = msg.photo[msg.photo.length - 1].file_size;
      } else if (msg.audio) {
        fileId = msg.audio.file_id;
        fileName = msg.audio.file_name || 'Unnamed Audio';
        mimeType = msg.audio.mime_type;
        fileSize = msg.audio.file_size;
      } else if (msg.video) {
        fileId = msg.video.file_id;
        fileName = msg.video.file_name || 'Unnamed Video';
        mimeType = msg.video.mime_type;
        fileSize = msg.video.file_size;
      } else if (msg.voice) {
        fileId = msg.voice.file_id;
        fileName = 'Voice Message';
        mimeType = 'audio/ogg'; // Default for voice
        fileSize = msg.voice.file_size;
      } else if (msg.video_note) {
        fileId = msg.video_note.file_id;
        fileName = 'Video Note';
        mimeType = 'video/mp4'; // Default for video notes
        fileSize = msg.video_note.file_size;
      }

      // Store the file in batch or as a single file
      if (batchToken && fileStore[batchToken]) {
        fileStore[batchToken].files.push({ fileId, fileName, mimeType, fileSize });
        writeStorage(fileStore);
        bot.sendMessage(chatId, `File added to batch. Token: ${batchToken}`);
        logAction(`File added to batch: ${batchToken}`);
      } else {
        const fileToken = crypto.randomBytes(16).toString('hex');
        fileStore[fileToken] = { fileId, fileName, mimeType, fileSize, chatId, timestamp: getCurrentTime() };
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
      bot.sendMessage(msg.chat.id, 'File not found.');
    }
  });
});

// Handle /listfiles command
registerCommand(/\/listfiles/, (msg) => {
  restrictAdminCommand(msg, () => {
    const fileTokens = Object.keys(fileStore);
    if (fileTokens.length === 0) {
      bot.sendMessage(msg.chat.id, 'No files or batches found.');
    } else {
      const fileList = fileTokens
        .map((token, index) => {
          const fileData = fileStore[token];
          const link = `https://t.me/${botUsername}?start=${token}`;
          return `${index + 1}. **File Name**: ${fileData.fileName || 'Unnamed'}\n**Token**: \`${token}\`\n**Link**: [Access File](${link})\n**Type**: ${fileData.mimeType || 'Unknown Type'}\n**Size**: ${fileData.fileSize ? (fileData.fileSize / 1024).toFixed(2) + ' KB' : 'Unknown'}\n**Time**: ${fileData.timestamp}`;
        })
        .join('\n\n');
      bot.sendMessage(msg.chat.id, fileList, { parse_mode: 'Markdown' });
    }
  });
});
// Handle /listfilenames command
registerCommand(/\/listfilenames/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);

    if (fileTokens.length > 0) {
      const fileList = fileTokens
        .map((token, index) => {
          const fileData = fileStore[token];
          const accessLink = `https://t.me/${botUsername}?start=${token}`;
          const editCommand = `tg://msg?text=/editfilename%20${token}`; // Edit file link
          const deleteCommand = `tg://msg?text=/deletefile%20${token}`; // Delete file link
          const fileName = fileData.fileName || 'Unnamed';

          return `${index + 1}. **File Name**: ${fileName}\n**Access Link**: [Open File](${accessLink})\n**Edit Command**: [Edit File](${editCommand})\n**Delete Command**: [Delete File](${deleteCommand})`;
        })
        .join('\n\n');
      bot.sendMessage(chatId, `Stored files:\n\n${fileList}`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, 'No files or batches stored.');
    }
  });
});


// Handle /status command
registerCommand(/\/status/, (msg) => {
  restrictAdminCommand(msg, () => {
    bot.sendMessage(msg.chat.id, `Bot is running and functional.`);
  });
});

// Handle /clearlogs command
registerCommand(/\/clearlogs/, (msg) => {
  restrictAdminCommand(msg, () => {
    fs.truncateSync(logFilePath, 0);
    bot.sendMessage(msg.chat.id, 'Logs have been cleared.');
    logAction('Logs cleared');
  });
});
