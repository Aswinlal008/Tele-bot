const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Your bot's token
const token = '6687867709:AAETARF0SueDToxrizRDGBknAa3hujofNck'; // Replace with your bot token
const bot = new TelegramBot(token, { polling: true });

// Simulated databases
let posts = {};
let favorites = loadFavorites();
let activeFlows = {};

// Default reply markup with "Create Post" and "Favorites" options
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📃Create Post', '🌟Favorites'],
      ['Back'],
    ],
    resize_keyboard: true,
  },
};

const postTypeMenu = {
  reply_markup: {
    keyboard: [
      ['Text', 'Photo'],
      ['GIF', 'Video'],
      ['Stickers'],
      ['Back'],
    ],
    resize_keyboard: true,
  },
};

const cancelBackMenu = {
  reply_markup: {
    keyboard: [['Cancel', 'Back']],
    resize_keyboard: true,
  },
};

// Start command handler
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Choose an option:', mainMenu);
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
Welcome to the Bot! Here are the commands and features:

1. */start*: Start the bot and see the main menu.
2. *📃Create Post*: Create a new post by choosing a type (Text, Photo, GIF, Video, Stickers).
3. *🌟Favorites*: View your favorite posts.
4. */post {postId}*: View a specific post by its ID (e.g., /post abc123).
5. */cancel*: Cancel the current action and return to the main menu.
`;
  bot.sendMessage(chatId, helpMessage);
});

// Main menu handler
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === '📃Create Post') {
    if (activeFlows[chatId]) {
      bot.sendMessage(chatId, 'You are already in the middle of creating a post.');
      return;
    }
    bot.sendMessage(chatId, 'Choose a type of post to create:', postTypeMenu);
    activeFlows[chatId] = 'postTypeSelection';
  } else if (text === '🌟Favorites') {
    handleFavoritesMenu(chatId);
  } else if (text === 'Back') {
    returnToMainMenu(chatId);
  } else if (['Text', 'Photo', 'GIF', 'Video', 'Stickers'].includes(text)) {
    if (activeFlows[chatId] === 'postTypeSelection') {
      handlePostCreation(chatId, text.toLowerCase());
      activeFlows[chatId] = 'postCreation';
    } else {
      bot.sendMessage(chatId, 'Something went wrong. Please start again.');
    }
  } else if (text === '/cancel') {
    returnToMainMenu(chatId);
  }
});

// Handle post creation
function handlePostCreation(chatId, type) {
  const typeMessages = {
    text: 'Please provide the text content:',
    photo: 'Please send the photo you want to attach (with or without a caption).',
    gif: 'Please send the GIF you want to attach (with or without a caption).',
    video: 'Please send the video you want to attach (with or without a caption).',
    stickers: 'Please send the sticker you want to attach.',
  };

  bot.sendMessage(chatId, `You selected: ${capitalizeFirstLetter(type)}.`, {
    reply_markup: { remove_keyboard: true },
  });
  bot.sendMessage(chatId, typeMessages[type]);

  const listenerType = {
    text: 'message',
    photo: 'photo',
    gif: 'animation',
    video: 'video',
    stickers: 'sticker',
  }[type];

  bot.once(listenerType, (msg) => {
    const content = getContent(type, msg);
    const caption = msg.caption || null;
    askForLinks(chatId, { content, caption }, type);
  });
}

function getContent(type, msg) {
  const contentExtractors = {
    text: () => msg.text.trim(),
    photo: () => msg.photo[msg.photo.length - 1].file_id,
    gif: () => msg.animation.file_id,
    video: () => msg.video.file_id,
    stickers: () => msg.sticker.file_id,
  };

  return contentExtractors[type]();
}

function askForLinks(chatId, { content, caption }, type) {
  bot.sendMessage(chatId, 
    '*Send the link(s) in the format:*\n' +
    '\\[Button text + link\]\n' +
    'Example: [Translator + https://t.me/TransioBot]', 
    { parse_mode: 'Markdown' }
  );

  bot.once('message', (msg) => {
    const links = msg.text.trim();
    try {
      const inlineKeyboard = formatLinksToInlineButtons(links);
      const postId = savePost(type, { content, caption, links });

      sendMediaWithButtons(chatId, type, content, inlineKeyboard, caption);
      sendPostReadyMessage(chatId, postId);
      delete activeFlows[chatId];
    } catch (error) {
      bot.sendMessage(chatId, 'Invalid format. Please try again.');
    }
  });
}

function formatLinksToInlineButtons(links) {
  const rows = links.split('\n').map(row => row.trim());
  return rows.map(row => {
    const buttons = row.match(/\[([^\]]+?)\s?\+\s?([^\]]+?)\]/g).map(button => {
      const [text, url] = button.replace(/^\[|\]$/g, '').split(' + ');
      if (!url.startsWith('http')) throw new Error('Invalid URL format');
      return { text: text.trim(), url: url.trim() };
    });
    return buttons;
  });
}

function savePost(type, data) {
  const postId = Math.random().toString(36).substring(2, 15);
  posts[postId] = { type, data };
  return postId;
}

function sendMediaWithButtons(chatId, type, content, inlineKeyboard, caption = null) {
  const options = { 
    reply_markup: { inline_keyboard: inlineKeyboard },
    caption: caption,
    parse_mode: 'Markdown',
  };

  if (type === 'text') {
    bot.sendMessage(chatId, content, options);
  } else if (type === 'photo') {
    bot.sendPhoto(chatId, content, options);
  } else if (type === 'gif') {
    bot.sendAnimation(chatId, content, options);
  } else if (type === 'video') {
    bot.sendVideo(chatId, content, options);
  } else if (type === 'stickers') {
    bot.sendSticker(chatId, content, options);
  }
}

function sendPostReadyMessage(chatId, postId) {
  const message = `Your post is ready! Use the code below:\n\n\`/${postId}\``;
  bot.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Forward', switch_inline_query_current_chat: `${postId}` },
          { text: 'Add to Favorites', callback_data: `favorite_${postId}` },
        ],
      ],
    },
    parse_mode: 'Markdown',
  });
}

function returnToMainMenu(chatId) {
  delete activeFlows[chatId];
  bot.sendMessage(chatId, 'Returning to main menu:', mainMenu);
}

function loadFavorites() {
  try {
    return JSON.parse(fs.readFileSync('postbot.json')).favorites || {};
  } catch {
    return {};
  }
}

function saveFavorites() {
  fs.writeFileSync('postbot.json', JSON.stringify({ favorites }, null, 2));
}

function handleFavoritesMenu(chatId) {
  const userFavorites = favorites[chatId] || {};
  const favoriteList = Object.keys(userFavorites)
    .map(id => `Post ID: ${id}\nContent: ${userFavorites[id].data.caption || 'No caption'}`)
    .join('\n\n') || 'No favorites yet.';
  bot.sendMessage(chatId, favoriteList, cancelBackMenu);
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
