// Import required packages ISEECloud_bot
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const fs = require('fs');
const moment = require('moment-timezone');

// File paths
const storageFilePath = './storage.json';
const botActionsLogFilePath = './bot_actions.log'; // Renamed
const userActivityLogFilePath = './userActivityLogs.json'; // Path to the user activity log file
const cloudUsersFilePath = './cloudUsers.json'; // Path to store cloud user IDs
const userRatingsFilePath = './userRatings.json'; // File to store user ratings

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
  fs.appendFileSync(botActionsLogFilePath, logMessage);
}

// Current time in GMT+5:30
function getCurrentTime() {
  return moment.tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
}

// Telegram Bot credentials
const token = '7335742201:AAFcnQJMyn90Q1jDZyHbyVYr2mKy97QTZOE'; // Replace with your bot token
const botUsername = 'ISEECloud_bot'; // Replace with your bot's username
const adminUserId = 803543058; // Replace with admin's user_id

// Initialize the bot
const bot = new TelegramBot(token, { polling: true });

// Initialize storage
const fileStore = readStorage();
let batchToken = null;

// Ensure the JSON file exists
if (!fs.existsSync(userRatingsFilePath)) {
  fs.writeFileSync(userRatingsFilePath, JSON.stringify([])); // Initialize as an empty array
}

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

  if (!token) {
    const welcomeMessage = 'Welcome to the bot! Please provide a valid token to access files.';
    const stickerId = 'CAACAgIAAxkBAAIFemdiZIFpueSalCmgqs1SEwEc1o51AAJUAANBtVYMarf4xwiNAfo2BA'; // Sticker file_id

    bot.sendSticker(chatId, stickerId);
    bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Our Channel', url: 'https://t.me/Discussionclouds' }],
          [{ text: 'Contact Support', url: 'https://t.me/aswinlalus' }]
        ]
      }
    });
    return;
  }

  if (token && fileStore[token]) {
    const fileData = fileStore[token];

    if (fileData.files && fileData.files.length > 0) {
      (async () => {
        for (const file of fileData.files) {
          try {
            await bot.sendDocument(chatId, file.fileId, { caption: file.fileName });
          } catch (error) {
            console.error(`Error sending file ${file.fileId}:`, error);
            await bot.sendMessage(chatId, `Failed to send file: ${file.fileName}`);
          }
        }
      })()
        .then(() => {
          bot.sendSticker(chatId, 'CAACAgIAAyEFAASIw5s0AAINuGdiYcH47KUxG6Ew1d6ibfa9qcMNAAJRAANBtVYM-ugutyIO5ug2BA');
          bot.sendMessage(chatId, 'Thank you for using the bot!');
          bot.sendMessage(chatId, 'How would you rate your experience with the bot?', {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '1️⃣', callback_data: 'rate_1' },
                  { text: '2️⃣', callback_data: 'rate_2' },
                  { text: '3️⃣', callback_data: 'rate_3' },
                  { text: '4️⃣', callback_data: 'rate_4' },
                  { text: '5️⃣', callback_data: 'rate_5' }
                ],
                [
                  { text: '6️⃣', callback_data: 'rate_6' },
                  { text: '7️⃣', callback_data: 'rate_7' },
                  { text: '8️⃣', callback_data: 'rate_8' },
                  { text: '9️⃣', callback_data: 'rate_9' },
                  { text: '🔟', callback_data: 'rate_10' }
                ]
              ]
            }
          });
        })
        .catch((error) => {
          console.error('Error after sending files:', error);
          bot.sendMessage(chatId, 'Some files couldn\'t be sent.');
        });
    } else if (fileData.fileId) {
      bot.sendDocument(chatId, fileData.fileId)
        .then(() => bot.sendMessage(chatId, 'Here is your requested file!'))
        .catch((error) => {
          console.error('Error sending file:', error);
          bot.sendMessage(chatId, 'Failed to send the file.');
        });
    } else {
      bot.sendMessage(chatId, 'No files found for the provided token.');
    }
  } else {
    bot.sendMessage(chatId, 'Invalid token! No file or batch found.');
  }
});

// Handle ratings callback
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('rate_')) {
    const rating = parseInt(data.split('_')[1], 10);

    if (rating >= 1 && rating <= 10) {
      const ratingEmojis = ['😭', '😢', '🥺', '😕', '😐', '🙂', '😉', '😌', '😘', '😍'];
      const emoji = ratingEmojis[rating - 1];

      const userId = callbackQuery.from.id;
      const username = callbackQuery.from.username || null;

      // Read ratings
      let userRatings;
      try {
        userRatings = JSON.parse(fs.readFileSync(userRatingsFilePath, 'utf8'));
      } catch (error) {
        console.error('Error reading ratings file:', error);
        userRatings = [];
      }

      // Update or add the rating
      const existingUserIndex = userRatings.findIndex((entry) => entry.userId === userId);
      if (existingUserIndex !== -1) {
        userRatings[existingUserIndex].rating = rating;
      } else {
        userRatings.push({ userId, username, rating });
      }

      // Save updated ratings
      try {
        fs.writeFileSync(userRatingsFilePath, JSON.stringify(userRatings, null, 2));
      } catch (error) {
        console.error('Error saving ratings file:', error);
      }

      bot.sendMessage(chatId, `Thank you for rating us ${rating} out of 10! ${emoji}`);
    } else {
      bot.sendMessage(chatId, 'Invalid rating. Please try again.');
    }

    bot.answerCallbackQuery(callbackQuery.id);
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
  \n/files - List all stored files with their names and access links in a simple format ("1. File name - Access Link")
  \n/editfilename <token> <new_name> - Edit the name of a stored file
  \n/deletefile <token> - Delete a file or batch
  \n/bulkremove <file_numbers> - Remove multiple files by their order numbers (e.g., /bulkremove 1,3,5)
  \n/status - Get bot status
  \n/clearlogs - Clear action logs
  \n/exportfiles - Generate and download a file containing the details of all stored files or batches, including names, tokens, access links, types, sizes, and timestamps.
  \n/broadcast - Send a message to all users
  \n/useractivity - View a list of user activities (last 50 actions)
  \n/viewrating - View the bot's average user rating
  \n/cloudusers - View the list of users who have interacted with the bot.`;
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

const PAGE_SIZE = 10; // Number of files per page
const MAX_MESSAGE_LENGTH = 4000; // Safeguard to avoid exceeding Telegram's message length limit

// State to track page number input requests for each user (chatId)
const userState = {};

// Helper function to format file info for a given page
function formatFileInfo(fileTokens, startIndex, endIndex) {
  return fileTokens.slice(startIndex, endIndex).map((token, index) => {
    const fileData = fileStore[token];
    const fileName = fileData.fileName || 'Unnamed';
    const accessLink = `https://t.me/${botUsername}?start=${token}`;
    const timestamp = fileData.timestamp;

    // File info formatted in Markdown without Type and Size
    return `${startIndex + index + 1}. **File Name**: ${fileName}\n**Token**: \`${token}\`\n**Link**: [Access File](${accessLink})\n**Edit Command**: [Edit File](tg://msg?text=/editfilename%20${token})\n**Delete Command**: [Delete File](tg://msg?text=/deletefile%20${token})\n**Time**: ${timestamp}`;
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
// Handle /exportfiles command
registerCommand(/\/exportfiles/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);

    if (fileTokens.length === 0) {
      bot.sendMessage(chatId, 'No files or batches found to export.');
      return;
    }

    // File content generation
    let fileContent = 'File Name,Token,Access Link,Type,Size,Edit Command,Delete Command,Time\n';
    fileTokens.forEach((token) => {
      const fileData = fileStore[token];
      const fileName = fileData.fileName || 'Unnamed';
      const accessLink = `https://t.me/${botUsername}?start=${token}`;
      const fileType = fileData.mimeType || 'Unknown Type';
      const fileSize = fileData.fileSize
        ? (fileData.fileSize / 1024 / 1024).toFixed(2) + ' MB'
        : 'Unknown';
      const timestamp = fileData.timestamp;
      const editCommand = `/editfilename ${token}`;
      const deleteCommand = `/deletefile ${token}`;

      // Add file details to content
      fileContent += `"${fileName}","${token}","${accessLink}","${fileType}","${fileSize}","${editCommand}","${deleteCommand}","${timestamp}"\n`;
    });

    // Save content to a file
    const filePath = './exported_files.csv';
    fs.writeFileSync(filePath, fileContent);

    // Send the file to the admin
    bot.sendDocument(chatId, filePath, {}, { filename: 'exported_files.csv' })
      .then(() => {
        logAction('File list exported and sent.');
        bot.sendMessage(chatId, 'Export completed. File list sent successfully.');
        // Optionally delete the file after sending
        fs.unlinkSync(filePath);
      })
      .catch((error) => {
        console.error('Error sending file:', error);
        bot.sendMessage(chatId, 'Failed to export file list.');
      });
  });
});

// Handle /viewrating command
registerCommand(/\/viewrating/, (msg) => {
  const chatId = msg.chat.id;

  // Read user ratings from the file
  let userRatings;
  try {
    userRatings = JSON.parse(fs.readFileSync(userRatingsFilePath, 'utf8'));
  } catch (error) {
    console.error('Error reading ratings file:', error);
    bot.sendMessage(chatId, 'Could not fetch ratings at the moment. Please try again later.');
    return;
  }

  // Check if there are ratings
  if (userRatings.length === 0) {
    bot.sendMessage(chatId, 'No ratings have been submitted yet.');
    return;
  }

  // Calculate the average rating
  const totalRating = userRatings.reduce((sum, entry) => sum + parseInt(entry.rating, 10), 0);
  const averageRating = (totalRating / userRatings.length).toFixed(2);

  // Send the average rating to the user
  bot.sendMessage(chatId, `The bot's average rating is: ${averageRating} / 10 🌟`);
});

// Handle /files command
registerCommand(/\/files/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;
    const fileTokens = Object.keys(fileStore);
    const totalFiles = fileTokens.length;

    if (totalFiles === 0) {
      bot.sendMessage(chatId, 'No files or batches found.');
      return;
    }

    // Create a list of files in the "1. **File name** - [Access Link](file_access_link)" format
    let fileList = '';
    fileTokens.forEach((token, index) => {
      const fileData = fileStore[token];
      const fileName = fileData.fileName || 'Unnamed';
      const accessLink = `https://t.me/${botUsername}?start=${token}`;
      
      // Add each file info in the required format with bold file name and clickable access link
      fileList += `**${index + 1}. ${fileName} - [Access Link](${accessLink})**\n`;
    });

    // Create inline keyboard with a "Copy" button
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: 'Copy', callback_data: 'copy_files' } // Callback for copy action
        ]
      ]
    };

    // Send the list of files with Markdown formatting enabled and the inline keyboard
    bot.sendMessage(chatId, `Stored files:\n\n${fileList}`, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard,
    });
  });
});

// Handle Copy Inline Button
bot.on('callback_query', (callbackQuery) => {
  const action = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  if (action === 'copy_files') {
    // Send a preview message that users can manually copy
    bot.sendMessage(chatId, 'You can copy the file list from the message above.', {
      reply_to_message_id: messageId,
    });
  }

  // Acknowledge the callback query to remove "loading" animation
  bot.answerCallbackQuery(callbackQuery.id);
});

// Store user chat IDs (for example, dynamically collected when users interact with the bot)
let registeredUsers = []; // Replace with your actual user database or array

// Middleware to restrict admin commands
function restrictAdminCommand(msg, callback) {
  const adminIds = [803543058];
  if (adminIds.includes(msg.from.id)) {
    callback();
  } else {
    bot.sendMessage(msg.chat.id, "Unauthorized access: This command is restricted to admins.");
  }
}

// Handle /broadcast command
let pendingBroadcastMessage = null; // To store the pending message for confirmation

// Admin command to initiate a broadcast
bot.on('message', (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;

    // Check if the admin is initiating a broadcast
    if (msg.text && msg.text.startsWith('/broadcast')) {
      if (!pendingBroadcastMessage) {
        bot.sendMessage(
          chatId,
          'Please send the message (text, media, sticker, or forwarded message) that you want to broadcast. Use /cancel to abort.'
        );
        pendingBroadcastMessage = { chatId }; // Store the chatId for confirmation
      } else {
        bot.sendMessage(chatId, 'You already have a pending broadcast message. Use /cancel to abort.');
      }
      return;
    }

    // If there is a pending broadcast, save the message for confirmation
    if (pendingBroadcastMessage && msg.chat.id === pendingBroadcastMessage.chatId) {
      pendingBroadcastMessage.message = msg; // Store the message object

      // Inline buttons for confirmation
      const confirmButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, Send', callback_data: 'confirm_broadcast' },
              { text: '❌ No, Cancel', callback_data: 'cancel_broadcast' },
            ],
          ],
        },
      };

      bot.sendMessage(
        chatId,
        'This is the message you want to broadcast:\n\nPlease confirm:',
        {
          reply_to_message_id: msg.message_id,
          ...confirmButtons,
        }
      );
    }
  });
});

// Handle confirmation and cancellation via inline buttons
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (!pendingBroadcastMessage || pendingBroadcastMessage.chatId !== chatId) return;

  if (data === 'confirm_broadcast') {
    // Read cloud users
    if (!fs.existsSync(cloudUsersFilePath)) {
      bot.sendMessage(chatId, 'No users have been added yet for broadcasting.');
      pendingBroadcastMessage = null;
      return;
    }

    let cloudUsers = [];
    try {
      cloudUsers = JSON.parse(fs.readFileSync(cloudUsersFilePath, 'utf8')) || [];
    } catch (error) {
      console.error('Error reading or parsing cloud user file:', error);
      bot.sendMessage(chatId, 'An error occurred while retrieving the cloud user list.');
      pendingBroadcastMessage = null;
      return;
    }

    if (cloudUsers.length === 0) {
      bot.sendMessage(chatId, 'No users have been added yet for broadcasting.');
      pendingBroadcastMessage = null;
      return;
    }

    const { message } = pendingBroadcastMessage;

    // Broadcast the message
    cloudUsers.forEach((user) => {
      bot.copyMessage(user.id, message.chat.id, message.message_id).catch((error) => {
        console.error(`Failed to send message to user ${user.id}:`, error.message);
      });
    });

    // Notify the admin
    bot.sendMessage(chatId, `Message broadcasted to ${cloudUsers.length} users.`);
    pendingBroadcastMessage = null;

    // Acknowledge the button press
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Broadcast sent successfully!' });
  } else if (data === 'cancel_broadcast') {
    bot.sendMessage(chatId, 'Broadcast cancelled.');
    pendingBroadcastMessage = null;

    // Acknowledge the button press
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Broadcast cancelled.' });
  }
});

// Command to cancel the broadcast manually
registerCommand(/\/cancel/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;

    if (pendingBroadcastMessage && pendingBroadcastMessage.chatId === chatId) {
      pendingBroadcastMessage = null;
      bot.sendMessage(chatId, 'Broadcast cancelled.');
    } else {
      bot.sendMessage(chatId, 'No pending broadcast to cancel.');
    }
  });
});


// Function to log user activities
const logUserActivity = (userId, username, action) => {
  // Create a log entry
  const logEntry = {
    userId,
    username,
    action,
    time: new Date().toISOString(),
  };

  // Read existing logs or initialize a new array
  let logs = [];
  if (fs.existsSync(userActivityLogFilePath)) {
    try {
      logs = JSON.parse(fs.readFileSync(userActivityLogFilePath, "utf8")) || [];
    } catch (error) {
      console.error("Error reading or parsing log file:", error);
    }
  }

  // Add the new log entry
  logs.push(logEntry);

  // Write back to the log file
  fs.writeFileSync(userActivityLogFilePath, JSON.stringify(logs, null, 2), "utf8");
};

// Admin command to view user activity
bot.onText(/\/useractivity/, (msg) => {
  const adminId = 803543058; // Replace with the admin's Telegram user ID
  const chatId = msg.chat.id;

  // Restrict the command to the admin
  if (msg.from.id !== adminId) {
    bot.sendMessage(chatId, "You are not authorized to use this command.");
    return;
  }

  // Check if the log file exists
  if (!fs.existsSync(userActivityLogFilePath)) {
    bot.sendMessage(chatId, "No user activity logs available.");
    return;
  }

  // Read logs from the file
  const logs = JSON.parse(fs.readFileSync(userActivityLogFilePath, "utf8") || "[]");

  if (logs.length === 0) {
    bot.sendMessage(chatId, "No user activity logs available.");
    return;
  }

  // Get the last 20 log entries
  const recentLogs = logs.slice(-20);

  // Format logs into a readable message
  const logMessage = recentLogs
    .map((log, index) => {
      const timeString = new Date(log.time).toLocaleString();
      const username = log.username
        ? `[@${log.username}](tg://user?id=${log.userId})`
        : `\`${log.userId}\``;
      return `${index + 1}. [${timeString}] ${username} - ${log.action}`;
    })
    .join("\n");

  // Ensure the final message fits within Telegram's limit
  const trimmedMessage = logMessage.length > 3000
    ? logMessage.substring(0, 3000) + "\n...\nLogs trimmed for length."
    : logMessage;

  // Send the logs as a single message
  bot.sendMessage(chatId, `User Activity Logs (Last 20):\n\n${trimmedMessage}`, {
    parse_mode: "Markdown",
  });
});

// Example usage: Logging user commands
bot.onText(/\/.*/, (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || null;
  const command = msg.text;

  logUserActivity(userId, username, `Command executed: ${command}`);

  // Handle commands normally...
});

// Example usage: Logging user messages
bot.on('message', (msg) => {
  if (msg.text) {
    const userId = msg.from.id;
    const username = msg.from.username || null;
    const message = msg.text;

    logUserActivity(userId, username, `Sent message: ${message}`);
  }

  // Handle other message logic...
});

// Example usage: Logging file uploads
bot.on('document', (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || null;
  const fileName = msg.document.file_name;

  logUserActivity(userId, username, `Uploaded file: ${fileName}`);

  // Handle file upload logic...
});

// Function to add a user to cloudUsers.json
const addCloudUser = (user) => {
  let cloudUsers = [];

  // Read existing users from the file
  if (fs.existsSync(cloudUsersFilePath)) {
    try {
      cloudUsers = JSON.parse(fs.readFileSync(cloudUsersFilePath, 'utf8')) || [];
    } catch (error) {
      console.error('Error reading or parsing cloud user file:', error);
    }
  }

  // Check if the user already exists
  const userExists = cloudUsers.some((u) => u.id === user.id);
  if (!userExists) {
    cloudUsers.push(user);

    // Save updated list back to the file
    fs.writeFileSync(cloudUsersFilePath, JSON.stringify(cloudUsers, null, 2), 'utf8');
  }
};

// Command to handle /cloudusers
registerCommand(/\/cloudusers/, (msg) => {
  restrictAdminCommand(msg, () => {
    const chatId = msg.chat.id;

    // Check if the cloudUsers file exists
    if (!fs.existsSync(cloudUsersFilePath)) {
      bot.sendMessage(chatId, 'No users have been added yet.');
      return;
    }

    // Read the cloud users from the file
    let cloudUsers = [];
    try {
      cloudUsers = JSON.parse(fs.readFileSync(cloudUsersFilePath, 'utf8')) || [];
    } catch (error) {
      console.error('Error reading or parsing cloud user file:', error);
      bot.sendMessage(chatId, 'An error occurred while retrieving the cloud user list.');
      return;
    }

    // If there are no users, send a message
    if (cloudUsers.length === 0) {
      bot.sendMessage(chatId, 'No users have been added yet.');
      return;
    }

    // Format the user data into a readable message
    const userListMessage = cloudUsers
      .map((user, index) => {
        const username = user.username
          ? `[@${user.username}](tg://user?id=${user.id})`
          : `[User ID: ${user.id}](tg://user?id=${user.id})`;
        return `${index + 1}. ${username}`;
      })
      .join('\n');

    // Send the list of cloud users
    bot.sendMessage(chatId, `Cloud Users:\n\n${userListMessage}`, { parse_mode: 'Markdown' });
  });
});

// Track users who use the bot
bot.on('message', (msg) => {
  const user = {
    id: msg.from.id,
    username: msg.from.username || null, // Save username if available
  };

  // Add the user to the cloudUsers list
  addCloudUser(user);

  // Handle other message logic if needed...
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
