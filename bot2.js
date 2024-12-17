// Import required packages Cloudmaker2_bot
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Replace with your bot's API token
const token = '7349582365:AAGTpRVnxxwpzecfFg87O3YKFrJu_sYZA-o';

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Store temporary data for user interactions
const userSessions = {};

// Store posts in a JSON file
const postsFile = 'posts.json';
let storedPosts = {};
if (fs.existsSync(postsFile)) {
  storedPosts = JSON.parse(fs.readFileSync(postsFile));
}

// Save posts to the JSON file
const savePostsToFile = () => {
  fs.writeFileSync(postsFile, JSON.stringify(storedPosts, null, 2));
};

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Use /newpost to add inline buttons to your message.\nFor help, use /help.');
});

// Handle /newpost command
bot.onText(/\/newpost/, (msg) => {
  const chatId = msg.chat.id;

  // Initialize session for the user
  userSessions[chatId] = {
    step: 'await_post',
    buttons: [
      { text: '🎬𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗', url: '' },
      { text: '🎥𝐃𝗢𝗪𝗡𝗟𝗢𝗔𝗗', url: '' },
    ],
    post: null,
  };

  bot.sendMessage(chatId, 'Please send the post or newpost a message (media with captions or plain text) to which you want to attach inline buttons.');
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
Here is how to use the bot:

1. **/newpost** - Start creating a new post. You can add buttons with links to your post.
2. **Send your post** - It can be a text or media message (with caption).
3. **Add links** - After sending your post, the bot will ask you to input the links for the buttons.
4. **Confirm Post** - After adding the links, the bot will display the post with the buttons for confirmation.
5. **/view [Post ID]** - View a saved post by ID.
6. **/postids** - View the list of post IDs.

For further assistance, feel free to reach out!`;

  bot.sendMessage(chatId, helpMessage);
});

// Handle /postids command to list all post IDs
bot.onText(/\/postids/, (msg) => {
  const chatId = msg.chat.id;

  // Check if there are any stored posts
  if (Object.keys(storedPosts).length === 0) {
    bot.sendMessage(chatId, 'No posts have been created yet.');
    return;
  }

  // List all post IDs in order and number them
  const postIds = Object.keys(storedPosts).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));

// Prepare the list of post IDs with /view prefix
const postIdsMessage = `Here are the post IDs in order:\n\n${postIds.map((postId, index) => `/view <code>${postId}</code> - Post #<code>${index + 1}</code>`).join('\n')}`;

bot.sendMessage(chatId, postIdsMessage, { parse_mode: 'HTML' });
});


// Handle received messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (!userSessions[chatId]) return;

  const session = userSessions[chatId];

  if (session.step === 'await_post') {
    session.post = msg;
    session.step = 'choose_buttons';

    bot.sendMessage(chatId, 'Choose an option to attach links:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎬𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗', callback_data: 'button_1' }],
          [{ text: '🎥𝐃𝗢𝗪𝗡𝗟𝗢𝗔𝗗', callback_data: 'button_2' }],
        ],
      },
    });
  } else if (session.step === 'input_link_1' || session.step === 'input_link_2') {
    const buttonIndex = session.step === 'input_link_1' ? 0 : 1;
    session.buttons[buttonIndex].url = msg.text;

    // Save the post
    const postId = `post_${Date.now()}`;
    storedPosts[postId] = {
      post: session.post,
      buttons: session.buttons,
    };

    savePostsToFile();

    // Send confirmation with the post ID
    bot.sendMessage(chatId, `Link added successfully!\n\nPost ID: \`${postId}\`\nThis ID has been saved for your reference.`);

    session.step = 'confirm_post';

    // Show the post with buttons for confirmation
    const validButtons = session.buttons.filter(button => button.url);

    const postOptions = {
      reply_markup: {
        inline_keyboard: [
          validButtons.map(button => ({ text: button.text, url: button.url })),
        ],
      },
      parse_mode: session.post.caption_entities ? 'HTML' : undefined,
    };

    const accessLink = `https://t.me/${bot.username}?start=${session.post.text ? session.post.text.split(' ')[0] : 'unknown'}`;

    // Send message with bot username and post ID in monospace format
    bot.sendMessage(chatId, `Here is the post you created:\n\n${session.post.text}\n\nPost ID: \`${postId}\`\nAccess Link: [Click here](${accessLink})`);

    delete userSessions[chatId];
  }
});


// Handle button clicks
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (!userSessions[chatId]) {
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Session expired. Please use /newpost again.' });
    return;
  }

  const session = userSessions[chatId];

  if (data === 'button_1') {
    session.step = 'input_link_1';
    bot.answerCallbackQuery(callbackQuery.id);
    bot.sendMessage(chatId, 'Please send the link for 🎬𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗.');
  } else if (data === 'button_2') {
    session.step = 'input_link_2';
    bot.answerCallbackQuery(callbackQuery.id);
    bot.sendMessage(chatId, 'Please send the link for 🎥𝐃𝗢𝗪𝗡𝗟𝗢𝗔𝗗.');
  }
});

// Handle /view command to retrieve saved posts
bot.onText(/\/view (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const postId = match[1]; // Extract the post ID from the command

  // Check if the post exists
  if (storedPosts[postId]) {
    const savedPost = storedPosts[postId];
    const validButtons = savedPost.buttons.filter(button => button.url);

    const postOptions = {
      reply_markup: {
        inline_keyboard: [
          validButtons.map(button => ({ text: button.text, url: button.url })),
        ],
      },
      parse_mode: savedPost.post.caption_entities ? 'HTML' : undefined,
    };

    // Resend the saved post
    if (savedPost.post.photo) {
      bot.sendPhoto(chatId, savedPost.post.photo[savedPost.post.photo.length - 1].file_id, {
        ...postOptions,
        caption: savedPost.post.caption,
      });
    } else if (savedPost.post.text) {
      bot.sendMessage(chatId, savedPost.post.text, postOptions);
    }
  } else {
    bot.sendMessage(chatId, `Post with ID "${postId}" not found.`);
  }
});

// Log any errors related to polling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});
