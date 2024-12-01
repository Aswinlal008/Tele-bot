const TelegramBot = require('node-telegram-bot-api');

// Your bot's token
const token = '6687867709:AAETARF0SueDToxrizRDGBknAa3hujofNck'; // Replace with your bot token
const bot = new TelegramBot(token, { polling: true });

// Simulated databases
let posts = {};
let favorites = {};
let activeFlows = {}; // Track active post creation flows for each user

// Default reply markup with "Create Post" and "Favorites" options
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📃Create Post', '🌟Favorites'], // Row 1 with Create Post and Favorites
      ['Back'],  // Row with Back button to return to the main menu
    ],
    resize_keyboard: true, // Resize the keyboard to fit the screen
  },
};

// Define the custom menu for post types with a regular keyboard
const postTypeMenu = {
  reply_markup: {
    keyboard: [
      ['Text', 'Photo'],  // Row 1 with Text and Photo
      ['GIF', 'Video'],   // Row 2 with GIF and Video
      ['Stickers'],       // Row 3 with Stickers
      ['Back'],           // Row with Back button to return to main menu
    ],
    resize_keyboard: true, // Resize the keyboard to fit the screen
  },
};

// Define the "Cancel" and "Back" buttons
const cancelBackMenu = {
  reply_markup: {
    keyboard: [
      ['Cancel', 'Back'], // Options to cancel or go back
    ],
    resize_keyboard: true, // Resize the keyboard to fit the screen
  },
};

// Start command handler
bot.onText(/\/start(?: (.+))?/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Choose an option:', mainMenu);
});

// Handle user messages from the main menu (Create Post and Favorites)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === '📃Create Post') {
    // Prevent starting a new post creation if a post creation flow is active
    if (activeFlows[chatId]) {
      bot.sendMessage(chatId, 'You are already in the middle of creating a post. Please finish or cancel the current post creation before starting a new one.');
      return;
    }

    bot.sendMessage(chatId, 'Choose a type of post to create:', postTypeMenu);
    activeFlows[chatId] = 'postTypeSelection'; // Track that the user is selecting a post type
  } else if (text === '🌟Favorites') {
    handleFavoritesMenu(chatId);
  } else if (text === 'Back') {
    returnToMainMenu(chatId);
  } else if (['Text', 'Photo', 'GIF', 'Video', 'Stickers'].includes(text)) {
    if (activeFlows[chatId] === 'postTypeSelection') {
      handlePostCreation(chatId, text.toLowerCase());
      activeFlows[chatId] = 'postCreation'; // Track that the user is in the post creation process
    } else {
      bot.sendMessage(chatId, 'Something went wrong. Please start the post creation again.');
    }
  } else if (text === '/cancel') {
    returnToMainMenu(chatId);
  }
});

// Function to handle post creation based on type
function handlePostCreation(chatId, type) {
  const typeMessages = {
    text: 'Please provide the text content:',
    photo: 'Please send the photo you want to attach.',
    gif: 'Please send the GIF you want to attach.',
    video: 'Please send the video you want to attach.',
    stickers: 'Please send the sticker you want to attach.',
  };

  // Remove keyboard to allow users to send content
  bot.sendMessage(chatId, `You selected: ${capitalizeFirstLetter(type)}.`, {
    reply_markup: { remove_keyboard: true },
  });
  bot.sendMessage(chatId, typeMessages[type]);

  // Listen for the corresponding type of content
  const onceListener = {
    text: 'message',
    photo: 'photo',
    gif: 'animation',
    video: 'video',
    stickers: 'sticker',
  }[type];

  bot.once(onceListener, (msg) => {
    let content = getContent(type, msg);
    askForLinks(chatId, content, type);
  });
}

// Function to get content based on post type
function getContent(type, msg) {
  const contentExtractors = {
    text: () => msg.text.trim(),
    photo: () => msg.photo[msg.photo.length - 1].file_id,
    gif: () => msg.animation.file_id,
    video: () => msg.video.file_id,
    stickers: () => msg.sticker.file_id,
  };

  return contentExtractors[type] ? contentExtractors[type]() : null;
}

// Function to ask for links
async function askForLinks(chatId, content, type) {
  bot.sendMessage(chatId, 
    '*Send the link(s) in the format:*\n' +
    '\\[Button text + link\]\n\n' +
    'Example:\n\\[Translator + https://t.me/TransioBot\]\n\n' +
    'To add several buttons in one row, write links next to the previous ones:\n' +
    'Example:\n\\[Translator + https://t.me/TransioBot] [Support + https://example.com]\n\n' +
    'To add several buttons in a new line, write links from a new line:\n' +
    ' \\[Translator + https://t.me/TransioBot]\n \\[Second text + second link\]', { parse_mode: 'Markdown' });
  
  bot.once('message', (msg) => {
    const links = msg.text.trim();
    try {
      const inlineKeyboard = formatLinksToInlineButtons(links);
      const postId = savePost(type, { content, links });

      sendMediaWithButtons(chatId, type, content, inlineKeyboard);
      sendPostReadyMessage(chatId, postId);
      delete activeFlows[chatId]; // Reset the flow after post is created
    } catch (error) {
      bot.sendMessage(chatId, 'Invalid format. Please try again following the provided format.');
    }
  });
}

// Function to format links into inline keyboard buttons
function formatLinksToInlineButtons(links) {
  const rows = links.split('\n').map(row => row.trim());

  const inlineKeyboard = rows.map(row => {
    const buttons = row.match(/\[([^\]]+?)\s?\+\s?([^\]]+?)\]/g).map(button => {
      const match = button.replace(/^\[|\]$/g, '').split(' + ');
      const text = match[0].trim();
      const url = match[1].trim();

      if (!text || !url || !url.startsWith('http')) {
        throw new Error('Invalid button format');
      }

      return { text: text, url: url };
    });
    return buttons;
  });
  
  return inlineKeyboard;
}

// Save the post data
function savePost(type, data) {
  const postId = Math.random().toString(36).substring(2, 15); // Generate a random ID
  posts[postId] = { type, data };
  return postId;
}

// Send the media with inline buttons
function sendMediaWithButtons(chatId, type, content, inlineKeyboard) {
  if (type === 'text') {
    bot.sendMessage(chatId, content, { reply_markup: { inline_keyboard: inlineKeyboard } });
  } else if (type === 'photo') {
    bot.sendPhoto(chatId, content, { caption: 'Your photo post', reply_markup: { inline_keyboard: inlineKeyboard } });
  } else if (type === 'gif') {
    bot.sendAnimation(chatId, content, { caption: 'Your GIF post', reply_markup: { inline_keyboard: inlineKeyboard } });
  } else if (type === 'video') {
    bot.sendVideo(chatId, content, { caption: 'Your video post', reply_markup: { inline_keyboard: inlineKeyboard } });
  } else if (type === 'stickers') {
    bot.sendSticker(chatId, content, { reply_markup: { inline_keyboard: inlineKeyboard } });
  }
}

// Send the "Your post is ready" message with token, share button, and favorite button
function sendPostReadyMessage(chatId, postId) {
  const tokenMessage = `Your post is ready! You can use it in any chat using the code below: \n\n\`${bot.username} ${postId}\``;

  const shareButton = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Forward', switch_inline_query_current_chat: `${bot.username} ${postId}` },
          { text: 'Add to Favorites', callback_data: `favorite_${postId}` },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, tokenMessage, shareButton);
}

// Function to reset to the main menu
function returnToMainMenu(chatId) {
  bot.sendMessage(chatId, 'Process canceled. Returning to the main menu...', mainMenu);
  delete activeFlows[chatId]; // Reset active flow when returning to the main menu
}

// Handle Favorites menu
function handleFavoritesMenu(chatId) {
  bot.sendMessage(chatId, 'Here are your favorite posts (feature coming soon).', cancelBackMenu);
}

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
