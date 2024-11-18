// Import the Telegraf package
const { Telegraf } = require('telegraf');
const crypto = require('crypto');

// Replace with your bot's token from BotFather
const token = '7335742201:AAFoImQFzV8wY1FSO-R7kU7ER3exaizELXs';

// Define the admin user ID (replace with your actual Telegram user ID)
const adminUserId = 803543058; // Replace with the actual admin's user_id

// Create a new bot instance using Telegraf
const bot = new Telegraf(token);

// Object to store file IDs and their associated tokens
const fileStore = {};

// Respond to a "/start" command
bot.start((ctx) => {
  const token = ctx.message.text.split(' ')[1]; // Extract the token from the /start command, if present
  const chatId = ctx.chat.id;

  if (token && fileStore[token]) {
    const fileData = fileStore[token];
    ctx.replyWithDocument(fileData.fileId)
      .then(() => ctx.reply('Here is your requested file!'))
      .catch((error) => {
        ctx.reply('Sorry, there was an issue retrieving the file.');
        console.error(error);
      });
  } else if (token) {
    ctx.reply('Invalid token or file not found.');
  } else {
    ctx.reply('Welcome! I am your Telegram bot.');
  }
});

// Respond to a "/help" command
bot.help((ctx) => {
  const chatId = ctx.chat.id;
  ctx.reply(`Here are the commands I can assist you with:
/start <token> - Retrieve a file using a token
/help - Get help with the bot's features
/singlefile - Store a single file (admin only)
/batchfile - Store multiple files (admin only)
/listfiles - List all stored files (admin only)
/deletefile <token> - Delete a stored file`);
});

// Check if the user is the admin
function isAdmin(ctx) {
  return ctx.from.id === adminUserId;
}

// Handle "/singlefile" command
bot.command('singlefile', (ctx) => {
  if (isAdmin(ctx)) {
    ctx.reply('Please send a single file to store.');
  } else {
    ctx.reply('Sorry, you are not authorized to use this command.');
  }
});

// Handle incoming files
bot.on('document', (ctx) => {
  const chatId = ctx.chat.id;

  if (isAdmin(ctx)) {
    const fileId = ctx.message.document.file_id;
    const fileToken = crypto.randomBytes(16).toString('hex');

    fileStore[fileToken] = { fileId, chatId };

    const botUsername = 'ISEECloud_bot'; // Replace with your bot's username
    const fileLink = `https://t.me/${botUsername}?start=${fileToken}`;

    ctx.reply(
      `Your file has been stored! Use the following link to access it:\n\n[Access File](${fileLink})`,
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.reply('You are not authorized to store files.');
  }
});

// Handle the /deletefile command
bot.command('deletefile', (ctx) => {
  const fileToken = ctx.message.text.split(' ')[1];

  if (isAdmin(ctx) && fileStore[fileToken]) {
    delete fileStore[fileToken];
    ctx.reply('File deleted successfully!');
  } else {
    ctx.reply('Sorry, no file found for that token or unauthorized.');
  }
});

// Handle the /listfiles command
bot.command('listfiles', (ctx) => {
  if (isAdmin(ctx)) {
    const fileTokens = Object.keys(fileStore);
    if (fileTokens.length > 0) {
      const fileList = fileTokens
        .map((token) => `[Access File](https://t.me/ISEECloud_bot?start=${token})`)
        .join('\n');
      ctx.reply(`Here are the stored files:\n${fileList}`, { parse_mode: 'Markdown' });
    } else {
      ctx.reply('No files stored.');
    }
  } else {
    ctx.reply('Sorry, you are not authorized to use this command.');
  }
});

// Start the bot
bot.launch();
