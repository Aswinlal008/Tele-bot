const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = '5194771522:AAEbqOMVqNRBkpV406YjOhcNv4l8HXT8B9s';
const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome to your File Store Bot!');
});

bot.on('document', (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;

  bot.getFile(fileId).then((file) => {
      const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
      fs.writeFileSync(`files/${msg.document.file_name}`, fileUrl, (err) => {
          if (err) return bot.sendMessage(chatId, 'Error saving file.');
          bot.sendMessage(chatId, 'File uploaded successfully!');
      });
  });
});

bot.onText(/\/getlink (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const fileName = match[1];
  const fileLink = `https://t.me/YourBotName?start=${fileName}`;

  bot.sendMessage(chatId, `Your permanent file link: ${fileLink}`);
});

bot.onText(/\/setaccess (.+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const fileName = match[1];
  const accessLevel = match[2]; // public, private, subscriber-only

  // Save access level in a JSON file
  const fileData = JSON.parse(fs.readFileSync('fileData.json', 'utf8'));
  fileData[fileName] = { accessLevel };
  fs.writeFileSync('fileData.json', JSON.stringify(fileData));

  bot.sendMessage(chatId, `Access for ${fileName} set to ${accessLevel}`);
});

bot.onText(/\/batchupload/, async (msg) => {
  const chatId = msg.chat.id;

  const files = fs.readdirSync('files/');
  if (files.length > 0) {
      files.forEach((file) => {
          bot.sendDocument(chatId, `files/${file}`);
      });
      bot.sendMessage(chatId, 'Batch upload complete!');
  } else {
      bot.sendMessage(chatId, 'No files available for batch upload.');
  }
});

bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const fileData = JSON.parse(fs.readFileSync('fileData.json', 'utf8'));

  const totalFiles = Object.keys(fileData).length;
  bot.sendMessage(chatId, `Total files: ${totalFiles}`);
});

bot.onText(/\/customize (.+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const feature = match[1];
  const value = match[2];

  bot.sendMessage(chatId, `Feature "${feature}" updated to "${value}"!`);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  const helpText = `
  Welcome to your File Store Bot! Here are the available commands:

  /help - Shows this help message
  /getlink <file_name> - Get a permanent link for a file
  /setaccess <file_name> <access_level> - Set access level for a file (public, private, subscriber-only)
  /batchupload - Upload multiple files at once
  /stats - View your file storage stats
  /customize <feature> <value> - Customize bot settings

  You can upload files and manage your content securely!
  `;

  bot.sendMessage(chatId, helpText);
});
