// Import required packages HeadManager_bot
const TelegramBot = require('node-telegram-bot-api');

// Replace 'YOUR_BOT_TOKEN' with your bot's token from BotFather
const bot = new TelegramBot('6687867709:AAEETh0ohI-JEZsC1-bBZ-aquDwnc5jqtYo', { polling: true });

// Listen for all messages
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // Check if the message is a join message
    if (msg.new_chat_members) {
        // Delete the join message
        bot.deleteMessage(chatId, msg.message_id).catch((err) => {
            console.error('Failed to delete join message:', err);
        });
    }

    // Check if the message is a leave message
    if (msg.left_chat_member) {
        // Delete the leave message
        bot.deleteMessage(chatId, msg.message_id).catch((err) => {
            console.error('Failed to delete leave message:', err);
        });
    }
});

console.log('Bot is running and listening for join/leave messages...');

// Finding sticker id in the message
bot.on('message', (msg) => {
  if (msg.sticker) {
    console.log(`Sticker ID: ${msg.sticker.file_id}`);
    bot.sendMessage(msg.chat.id, `Sticker ID: ${msg.sticker.file_id}`);
  }
});

// Store the most recent message for copying purpose
let lastMessage = null;

// Listening to all messages
bot.on('message', (msg) => {
  // Store the message (preserve formatting)
  lastMessage = msg;
});

// Handle /copy command to copy the last message
bot.onText(/\/copy/, (msg) => {
  const chatId = msg.chat.id;

  if (lastMessage) {
    // Check if the last message contains text
    if (lastMessage.text) {
      // Copy the last message with text formatting
      bot.sendMessage(chatId, lastMessage.text, { parse_mode: 'Markdown' })  // or 'HTML'
        .then(() => {
          console.log('Message copied successfully!');
        })
        .catch((err) => {
          console.error('Error sending copied message:', err);
        });
    }
    // If the last message contains a document (file), forward it
    else if (lastMessage.document) {
      bot.sendDocument(chatId, lastMessage.document.file_id)
        .then(() => {
          console.log('Document copied successfully!');
        })
        .catch((err) => {
          console.error('Error sending copied document:', err);
        });
    }
    // If the last message contains a sticker, forward it
    else if (lastMessage.sticker) {
      bot.sendSticker(chatId, lastMessage.sticker.file_id)
        .then(() => {
          console.log('Sticker copied successfully!');
        })
        .catch((err) => {
          console.error('Error sending copied sticker:', err);
        });
    }
    // Handle other types of messages (photos, videos, etc.)
    else {
      bot.sendMessage(chatId, "Cannot copy this type of message.");
    }
  } else {
    bot.sendMessage(chatId, "No message to copy.");
  }
});