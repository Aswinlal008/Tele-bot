// Import the Telegram Bot API package
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

// Replace with your bot's token from BotFather
const token = '7335742201:AAFoImQFzV8wY1FSO-R7kU7ER3exaizELXs';

// Define the admin user ID (replace with your actual Telegram user ID)
const adminUserId = 803543058; // Replace with the actual admin's user_id

// Create a new bot instance using polling
const bot = new TelegramBot(token, { polling: true });

// Object to store file IDs and their associated tokens
const fileStore = {};

// Respond to a "/start" command
bot.onText(/\/start(?: (.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1]; // Extract the token from the /start command, if present

  if (token && fileStore[token]) {
    const fileData = fileStore[token];
    bot.sendDocument(chatId, fileData.fileId)
      .then(() => bot.sendMessage(chatId, 'Here is your requested file!'))
      .catch((error) => {
        bot.sendMessage(chatId, 'Sorry, there was an issue retrieving the file.');
        console.error(error);
      });
  } else if (token) {
    bot.sendMessage(chatId, 'Invalid token or file not found.');
  } else {
    bot.sendMessage(chatId, 'Welcome! I am your Telegram bot.');
  }
});

// Respond to a "/help" command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Here are the commands I can assist you with:\n
/start <token> - Retrieve a file using a token\n
/help - Get help with the bot's features\n
/singlefile - Store a single file (admin only)\n
/batchfile - Store multiple files (admin only)\n
/listfiles - List all stored files (admin only)\n
/deletefile <token> - Delete a stored file`);
});

// Check if the user is the admin
function isAdmin(msg) {
  return msg.from.id === adminUserId;
}

// Handle "/singlefile" command
bot.onText(/\/singlefile/, (msg) => {
  const chatId = msg.chat.id;
  if (isAdmin(msg)) {
    bot.sendMessage(chatId, 'Please send a single file to store.');
  } else {
    bot.sendMessage(chatId, 'Sorry, you are not authorized to use this command.');
  }
});

// Handle incoming files
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if ((msg.document || msg.photo) && isAdmin(msg)) {
    let fileId;
    let fileToken = crypto.randomBytes(16).toString('hex');

    if (msg.document) {
      fileId = msg.document.file_id;
    } else if (msg.photo) {
      fileId = msg.photo[msg.photo.length - 1].file_id; // Highest resolution
    }

    fileStore[fileToken] = { fileId, chatId };

    const botUsername = 'ISEECloud_bot'; // Replace with your bot's username
    const fileLink = `https://t.me/${botUsername}?start=${fileToken}`;

    bot.sendMessage(
      chatId,
      `Your file has been stored! Use the following link to access it:\n\n[Access File](${fileLink})`,
      { parse_mode: 'Markdown' }
    );
  } else if (!isAdmin(msg)) {
    bot.sendMessage(chatId, 'You are not authorized to store files.');
  }
});

// Handle the /deletefile command
bot.onText(/\/deletefile (\w{32})/, (msg, match) => {
  const chatId = msg.chat.id;
  const fileToken = match[1];

  if (isAdmin(msg) && fileStore[fileToken]) {
    delete fileStore[fileToken];
    bot.sendMessage(chatId, 'File deleted successfully!');
  } else {
    bot.sendMessage(chatId, 'Sorry, no file found for that token or unauthorized.');
  }
});

// Handle the /listfiles command
bot.onText(/\/listfiles/, (msg) => {
  const chatId = msg.chat.id;

  if (isAdmin(msg)) {
    const fileTokens = Object.keys(fileStore);
    if (fileTokens.length > 0) {
      const fileList = fileTokens
        .map((token) => `[Access File](https://t.me/ISEECloud_bot?start=${token})`)
        .join('\n');
      bot.sendMessage(chatId, `Here are the stored files:\n${fileList}`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, 'No files stored.');
    }
  } else {
    bot.sendMessage(chatId, 'Sorry, you are not authorized to use this command.');
  }
});
// Add a command to generate clickable links for tokens
bot.onText(/\/listfiles/, (msg) => {
  const chatId = msg.chat.id;

  if (isAdmin(msg)) {
    const fileTokens = Object.keys(fileStore);
    if (fileTokens.length > 0) {
      const fileList = fileTokens
        .map((token) => `[Get File](https://t.me/ISEECloud_bot?start=${token})`)
        .join('\n');
      bot.sendMessage(chatId, `Here are the stored files:\n${fileList}`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, 'No files stored.');
    }
  } else {
    bot.sendMessage(chatId, 'Sorry, you are not authorized to use this command.');
  }
});
