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
