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
    const adminHelpMessage = `Admin Commands:
  \n/sendfile <file_name> - Start a batch and send files to it
  \n/addfiletobatch <batch_token> - Add files to an existing batch
  \n/removefilefrombatch <batch_token> <file_index> - Remove a file from a batch
  \n/listfiles - List all stored files or batches with details (File name, token, access link, type, size, edit and delete commands, time) with pagination
  \n/editfilename <token> <new_name> - Edit the name of a stored file
  \n/deletefile <token> - Delete a file or batch
  \n/bulkremove <file_numbers> - Remove multiple files by their order numbers (e.g., /bulkremove 1,3,5)
  \n/movielist - List all stored movie files with details (File name, token, access link)
  \n/status - Get bot status
  \n/clearlogs - Clear action logs`;

    bot.sendMessage(chatId, adminHelpMessage);
  });
});


// Handle /sendfile command
registerCommand(/\/sendfile/, (msg) => {
  restrictAdminCommand(msg, () => {
    bot.sendMessage(msg.chat.id, 'Please reply with a name for the file/batch.');
    bot.once('message', (titleMsg) => {
      const fileName = titleMsg.text.trim();
      
      // Generate a new batch token only when the /sendfile command is given
      batchToken = crypto.randomBytes(16).toString('hex');
      
      // Store the batch details
      fileStore[batchToken] = {
        files: [],
        fileName,
        chatId: msg.chat.id,
        timestamp: getCurrentTime()
      };

      // Save to storage
      writeStorage(fileStore);
      
      // Send confirmation
      bot.sendMessage(msg.chat.id, `Batch mode started with name "${fileName}". Use token: \`${batchToken}\``);
      logAction(`Batch created with token: ${batchToken} and name: ${fileName}`);
      
      // Prompt the user to send files
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

      // Add the file to the batch or store as a standalone file
      if (batchToken && fileStore[batchToken]) {
        // Add the file to the batch
        fileStore[batchToken].files.push({ fileId, fileName, mimeType, fileSize });
        writeStorage(fileStore); // Update storage with new file

        bot.sendMessage(chatId, `File added to batch. Token: ${batchToken}`);
        logAction(`File added to batch: ${batchToken}`);
      } else {
        // Store as a standalone file if no batch is in progress
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
// Handle /editfilename command
registerCommand(/\/editfilename (\w{32}) (.+)/, (msg, match) => {
  restrictAdminCommand(msg, () => {
    const fileToken = match[1]; // Extract token from the command
    const newFileName = match[2].trim(); // Extract the new file name

    if (fileStore[fileToken]) {
      const oldFileName = fileStore[fileToken].fileName || 'Unnamed';
      fileStore[fileToken].fileName = newFileName; // Update the file name in storage
      writeStorage(fileStore); // Save changes to the storage file

      bot.sendMessage(
        msg.chat.id,
        `File name updated successfully.\n\n**Old Name**: ${oldFileName}\n**New Name**: ${newFileName}`,
        { parse_mode: 'Markdown' }
      );

      logAction(`File name updated for token ${fileToken}: "${oldFileName}" → "${newFileName}"`);
    } else {
      bot.sendMessage(msg.chat.id, 'Invalid token. File or batch not found.');
    }
  });
});
// Handle /addfiletobatch command
registerCommand(/\/addfiletobatch (\w{32})/, (msg, match) => {
  restrictAdminCommand(msg, () => {
    const batchToken = match[1]; // Extract the batch token from the command

    if (fileStore[batchToken] && fileStore[batchToken].files) {
      bot.sendMessage(
        msg.chat.id,
        `Batch found. Please send the file(s) you want to add to the batch named "${fileStore[batchToken].fileName}".`
      );

      // Temporarily store the batchToken for adding files
      bot.once('message', (fileMsg) => {
        if (fileMsg.document || fileMsg.photo || fileMsg.audio || fileMsg.video || fileMsg.voice || fileMsg.video_note) {
          let fileId, fileName, mimeType, fileSize;

          // Handle different types of files
          if (fileMsg.document) {
            fileId = fileMsg.document.file_id;
            fileName = fileMsg.document.file_name || 'Unnamed Document';
            mimeType = fileMsg.document.mime_type;
            fileSize = fileMsg.document.file_size;
          } else if (fileMsg.photo) {
            fileId = fileMsg.photo[fileMsg.photo.length - 1].file_id; // The largest photo
            fileName = 'Photo File';
            mimeType = 'image/jpeg'; // Default for photos
            fileSize = fileMsg.photo[fileMsg.photo.length - 1].file_size;
          } else if (fileMsg.audio) {
            fileId = fileMsg.audio.file_id;
            fileName = fileMsg.audio.file_name || 'Unnamed Audio';
            mimeType = fileMsg.audio.mime_type;
            fileSize = fileMsg.audio.file_size;
          } else if (fileMsg.video) {
            fileId = fileMsg.video.file_id;
            fileName = fileMsg.video.file_name || 'Unnamed Video';
            mimeType = fileMsg.video.mime_type;
            fileSize = fileMsg.video.file_size;
          } else if (fileMsg.voice) {
            fileId = fileMsg.voice.file_id;
            fileName = 'Voice Message';
            mimeType = 'audio/ogg'; // Default for voice
            fileSize = fileMsg.voice.file_size;
          } else if (fileMsg.video_note) {
            fileId = fileMsg.video_note.file_id;
            fileName = 'Video Note';
            mimeType = 'video/mp4'; // Default for video notes
            fileSize = fileMsg.video_note.file_size;
          }

          // Add the file to the batch
          fileStore[batchToken].files.push({ fileId, fileName, mimeType, fileSize });
          writeStorage(fileStore);

          bot.sendMessage(
            msg.chat.id,
            `File added to batch "${fileStore[batchToken].fileName}". Token: \`${batchToken}\``,
            { parse_mode: 'Markdown' }
          );
          logAction(`File added to batch: ${batchToken}`);
        } else {
          bot.sendMessage(msg.chat.id, 'Invalid file type. Please send a valid file.');
        }
      });
    } else {
      bot.sendMessage(msg.chat.id, 'Invalid batch token. Batch not found.');
    }
  });
});

const PAGE_SIZE = 5; // Number of files per page
const MAX_MESSAGE_LENGTH = 4000; // Safeguard to avoid exceeding Telegram's message length limit

// State to track page number input requests for each user (chatId)
const userState = {};

// Helper function to format file info for a given page
function formatFileInfo(fileTokens, startIndex, endIndex) {
  return fileTokens.slice(startIndex, endIndex).map((token, index) => {
    const fileData = fileStore[token];
    const fileName = fileData.fileName || 'Unnamed';
    const accessLink = `https://t.me/${botUsername}?start=${token}`;
    const fileType = fileData.mimeType || 'Unknown Type';
    const fileSize = fileData.fileSize
      ? (fileData.fileSize / 1024 / 1024).toFixed(2) + ' MB'  // Convert to MB
      : 'Unknown';
    const timestamp = fileData.timestamp;

    // File info formatted in Markdown
    return `${startIndex + index + 1}. **File Name**: ${fileName}\n**Token**: \`${token}\`\n**Link**: [Access File](${accessLink})\n**Type**: ${fileType}\n**Size**: ${fileSize}\n**Edit Command**: [Edit File](tg://msg?text=/editfilename%20${token})\n**Delete Command**: [Delete File](tg://msg?text=/deletefile%20${token})\n**Time**: ${timestamp}`;
  }).join('\n\n');
}

// Handle /listfiles command with pagination
registerCommand(/\/listfiles/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);
    const totalFiles = fileTokens.length;

    if (totalFiles === 0) {
      bot.sendMessage(chatId, 'No files or batches found.');
      return;
    }

    const totalPages = Math.ceil(totalFiles / PAGE_SIZE);

    // Function to send the files for a specific page
    function sendPage(page = 1, chatId) {
      if (page < 1 || page > totalPages) return;

      const startIndex = (page - 1) * PAGE_SIZE;
      const endIndex = Math.min(startIndex + PAGE_SIZE, totalFiles);

      const fileInfo = formatFileInfo(fileTokens, startIndex, endIndex);

      // Generate buttons for all pages
      const pageButtons = [];
      for (let i = 1; i <= totalPages; i++) {
        pageButtons.push({ text: `${i}`, callback_data: `page_${i}` });
      }

      const inlineKeyboard = {
        inline_keyboard: [
          pageButtons // All page numbers as buttons
        ]
      };

      // Send the page message with page number buttons
      bot.sendMessage(chatId, `Stored files (Page ${page}/${totalPages}):\n\n${fileInfo}`, { parse_mode: 'Markdown', reply_markup: inlineKeyboard });
    }

    // Send the first page
    sendPage(1, chatId);
  });
});

// Handle the callback query for page selection
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // If the user clicks on a page number button, send that page's files
  if (data.startsWith('page_')) {
    const page = parseInt(data.split('_')[1], 10);
    sendPage(page, chatId); // Ensure chatId is passed here
    bot.answerCallbackQuery(callbackQuery.id);  // Acknowledge the callback query
  }
});

// Improved sendPage function with additional checks
function sendPage(page, chatId) {
  const fileTokens = Object.keys(fileStore);
  const totalFiles = fileTokens.length;
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);

  // If page is out of bounds, handle it
  if (page < 1 || page > totalPages) {
    return;
  }

  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalFiles);

  const fileInfo = formatFileInfo(fileTokens, startIndex, endIndex);

  // Generate buttons for all pages
  const pageButtons = [];
  for (let i = 1; i <= totalPages; i++) {
    pageButtons.push({ text: `${i}`, callback_data: `page_${i}` });
  }

  const inlineKeyboard = {
    inline_keyboard: [
      pageButtons // All page numbers as buttons
    ]
  };

  bot.sendMessage(chatId, `Stored files (Page ${page}/${totalPages}):\n\n${fileInfo}`, { parse_mode: 'Markdown', reply_markup: inlineKeyboard });
}
// Handle /movielist command with pagination
registerCommand(/\/movielist/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);
    const totalFiles = fileTokens.length;

    if (totalFiles === 0) {
      bot.sendMessage(chatId, 'No movies found.');
      return;
    }

    const totalPages = Math.ceil(totalFiles / PAGE_SIZE);

    // Function to format movie info for a specific page
    function formatMovieInfo(fileTokens, startIndex, endIndex) {
      return fileTokens.slice(startIndex, endIndex).map((token, index) => {
        const fileData = fileStore[token];
        const fileName = fileData.fileName || 'Unnamed Movie';
        const accessLink = `https://t.me/${botUsername}?start=${token}`;
        const fileSize = fileData.fileSize
          ? (fileData.fileSize / 1024 / 1024).toFixed(2) + ' MB' // Convert to MB
          : 'Unknown';
        const timestamp = fileData.timestamp;

        // Movie info formatted in Markdown
        return `${startIndex + index + 1}. **Movie Name**: ${fileName}\n**Link**: [Access Movie](${accessLink})\n**Size**: ${fileSize}\n**Uploaded On**: ${timestamp}`;
      }).join('\n\n');
    }

    // Function to send the movies for a specific page
    function sendMoviePage(page = 1) {
      const startIndex = (page - 1) * PAGE_SIZE;
      const endIndex = Math.min(startIndex + PAGE_SIZE, totalFiles);

      const movieInfo = formatMovieInfo(fileTokens, startIndex, endIndex);

      // Generate buttons for all pages
      const pageButtons = [];
      for (let i = 1; i <= totalPages; i++) {
        pageButtons.push({ text: `${i}`, callback_data: `movie_page_${i}` });
      }

      const inlineKeyboard = {
        inline_keyboard: [
          pageButtons // All page numbers as buttons
        ]
      };

      bot.sendMessage(
        chatId,
        `Movies List (Page ${page}/${totalPages}):\n\n${movieInfo}`,
        { parse_mode: 'Markdown', reply_markup: inlineKeyboard }
      );
    }

    // Send the first page of movies
    sendMoviePage(1);
  });
});

// Handle callback queries for /movielist pagination
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('movie_page_')) {
    const page = parseInt(data.split('_')[2], 10);
    const fileTokens = Object.keys(fileStore);
    const totalFiles = fileTokens.length;
    const totalPages = Math.ceil(totalFiles / PAGE_SIZE);

    // If the page is out of bounds, do nothing
    if (page < 1 || page > totalPages) return;

    // Format and send the requested movie page
    function sendMoviePage(page) {
      const startIndex = (page - 1) * PAGE_SIZE;
      const endIndex = Math.min(startIndex + PAGE_SIZE, totalFiles);

      const movieInfo = fileTokens.slice(startIndex, endIndex).map((token, index) => {
        const fileData = fileStore[token];
        const fileName = fileData.fileName || 'Unnamed Movie';
        const accessLink = `https://t.me/${botUsername}?start=${token}`;
        const fileSize = fileData.fileSize
          ? (fileData.fileSize / 1024 / 1024).toFixed(2) + ' MB' // Convert to MB
          : 'Unknown';
        const timestamp = fileData.timestamp;

        return `${startIndex + index + 1}. **Movie Name**: ${fileName}\n**Link**: [Access Movie](${accessLink})\n**Size**: ${fileSize}\n**Uploaded On**: ${timestamp}`;
      }).join('\n\n');

      // Generate inline keyboard for page navigation
      const pageButtons = Array.from({ length: totalPages }, (_, i) => ({
        text: `${i + 1}`,
        callback_data: `movie_page_${i + 1}`
      }));

      bot.editMessageText(`Movies List (Page ${page}/${totalPages}):\n\n${movieInfo}`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [pageButtons] }
      });
    }

    sendMoviePage(page);
    bot.answerCallbackQuery(callbackQuery.id);
  }
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
