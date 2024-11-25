const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Replace with your bot's token from BotFather
const token = '7349582365:AAGTpRVnxxwpzecfFg87O3YKFrJu_sYZA-o';
const bot = new TelegramBot(token, { polling: true });

// Define conversation states
const FILENAME = 'FILENAME';
const TEXT = 'TEXT';

// Define conversation handlers
let userData = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Send me any text and I will convert it to a .txt file. But first, tell me what name you want for the file.')
    .then(() => {
      userData[chatId] = { state: FILENAME };
    });
});

bot.onText(/\/newfile/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Let\'s start over! Tell me the name for the new file.')
    .then(() => {
      userData[chatId] = { state: FILENAME }; // Reset the conversation state
    });
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (userData[chatId]) {
    const state = userData[chatId].state;

    if (state === FILENAME) {
      // User is providing the filename
      userData[chatId].filename = text.trim();
      userData[chatId].state = TEXT;
      bot.sendMessage(chatId, `Got it! Now, send me the text you want to save in the file '${text.trim()}.txt'.`);
    } else if (state === TEXT) {
      // User is providing the text to save
      const fileName = userData[chatId].filename + '.txt';
      const userText = text;

      // Save the text to the .txt file
      fs.writeFile(fileName, userText, (err) => {
        if (err) {
          bot.sendMessage(chatId, `Error saving file: ${err.message}`);
          return;
        }

        // Send the .txt file back to the user
        bot.sendDocument(chatId, fileName)
          .then(() => {
            // Clean up by deleting the file after sending
            fs.unlink(fileName, (err) => {
              if (err) {
                bot.sendMessage(chatId, `Error deleting file: ${err.message}`);
              }
            });
          })
          .catch((err) => {
            bot.sendMessage(chatId, `Error sending file: ${err.message}`);
          });

        // End the conversation
        bot.sendMessage(chatId, `Your file '${fileName}' has been sent.`);
        delete userData[chatId]; // Remove user from the conversation state
      });
    }
  }
});
