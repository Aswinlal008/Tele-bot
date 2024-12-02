const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Replace with your bot's token from BotFather
const token = '7349582365:AAGTpRVnxxwpzecfFg87O3YKFrJu_sYZA-o';
const bot = new TelegramBot(token, { polling: true });

// Define conversation states
const FILENAME = 'FILENAME';
const FILECONTENT = 'FILECONTENT';
const WAIT_FOR_MOVIE_NAME = 'WAIT_FOR_MOVIE_NAME';

let userData = {};
let userFavorites = {}; // Store user favorites by chatId

// TMDb API key and URL for movie search
const TMDB_API_KEY = 'a43e040291da814d28bfd6d878bc8831'; // Replace with your actual TMDb API key
const TMDB_API_URL = 'https://api.themoviedb.org/3/search/movie'; // API endpoint for searching movies

// Start Command: Welcome message and instructions
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! I can help you with:\n' +
    '/searchmovie <movie name> - Search for a movie\n' +
    '/newfile - Create a new text file\n' +
    '@YourBotUsername inline queries - Try inline posts!');
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Here are the available commands you can use:\n\n' +
    '/start - Get a welcome message and an overview of the available commands.\n' +
    '/searchmovie <movie name> - Search for a movie by name and get details like title, rating, and genre.\n' +
    '/newfile - Start the process of creating a new text file. You can set the file name and content.\n' +
    '/help - Show this help message with information on how to use the bot.\n' +
    'Simply type the command and follow the instructions!');
});

// Command: /newfile
bot.onText(/\/newfile/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Let\'s start over! Tell me the name for the new file.')
    .then(() => {
      userData[chatId] = { state: FILENAME }; // Reset the conversation state
    });
});

// Handle file name input and content
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userState = userData[chatId]?.state;

  if (userState === FILENAME) {
    const fileName = msg.text;
    bot.sendMessage(chatId, `File name set to: ${fileName}. Now, please send me the content for the file.`)
      .then(() => {
        userData[chatId] = { state: FILECONTENT, fileName };
      });
  } else if (userState === FILECONTENT) {
    const fileContent = msg.text;
    const fileName = userData[chatId]?.fileName;

    const buffer = Buffer.from(fileContent, 'utf-8');

    bot.sendDocument(chatId, buffer, {}, { filename: `${fileName}.txt`, contentType: 'text/plain' })
      .then(() => {
        bot.sendMessage(chatId, `File "${fileName}.txt" has been created successfully!`);
      })
      .catch((error) => {
        bot.sendMessage(chatId, `Error sending the file: ${error.message}`);
      });

    userData[chatId] = { state: null };
  } else if (userState === WAIT_FOR_MOVIE_NAME) {
    const movieName = msg.text.trim();

    axios.get(TMDB_API_URL, {
      params: {
        api_key: TMDB_API_KEY,
        query: movieName,
        language: 'en-US',
        page: 1,
      },
    })
      .then((response) => {
        const movie = response.data.results[0];
        if (movie) {
          const movieDetails = `Title: ${movie.title} (${movie.release_date.split('-')[0]})\n` +
            `Rating ⭐️: ${movie.vote_average} / 10\n` +
            `Genres: ${movie.genre_ids.map(id => getGenreName(id)).join(', ') || 'Unknown'}\n` +
            `Language: ${movie.original_language.toUpperCase()}`;

          bot.sendMessage(chatId, movieDetails);
          bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`);
        } else {
          bot.sendMessage(chatId, `Sorry, I couldn't find details for "${movieName}".`);
        }
      })
      .catch((error) => {
        bot.sendMessage(chatId, `Error searching for the movie: ${error.message}`);
      });

    delete userData[chatId];
  }
});

// Command: /searchmovie
bot.onText(/\/searchmovie (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const movieName = match[1];

  userData[chatId] = { state: WAIT_FOR_MOVIE_NAME };
  bot.sendMessage(chatId, `Searching for "${movieName}"...`);
});

// Fetch user favorites from memory
function getUserFavorites(chatId) {
  return userFavorites[chatId] || [];
}

// Command: @Cloudmaker2_bot (inline query)
bot.on('inline_query', async (query) => {
  const inlineQueryId = query.id;
  const chatId = query.from.id;

  // Fetch user's favorite items
  const userFavs = getUserFavorites(chatId);

  // Prepare "favorites" and "create post" buttons
  const results = [
    {
      type: 'article',
      id: 'favorites',
      title: '📂 Favorites',
      description: 'View and use your saved favorite posts',
      input_message_content: {
        message_text: 'Select one of your favorite posts to use.',
      },
      reply_markup: {
        inline_keyboard: userFavs.map((favorite, index) => [
          [{ text: favorite.title || `Favorite ${index + 1}`, switch_inline_query_current_chat: favorite.content }],
        ]),
      },
    },
    {
      type: 'article',
      id: 'create-post',
      title: '✏️ Create Post',
      description: 'Start creating a new inline post',
      input_message_content: {
        message_text: 'Click below to start creating a new post.',
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Start Creating', callback_data: 'create-post' }],
        ],
      },
    },
  ];

  bot.answerInlineQuery(inlineQueryId, results);
});

// Store user data for creating a post
const userPostCreationState = {};

// Handle button clicks for creating a post
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  if (callbackQuery.data === 'create-post') {
    userPostCreationState[chatId] = { stage: 'type-selection' };

    // Ask the user what type of post they want to create
    await bot.sendMessage(chatId, 'What type of content would you like to create?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Text', callback_data: 'create-text' }],
          [{ text: 'Photo', callback_data: 'create-photo' }],
          [{ text: 'GIF', callback_data: 'create-gif' }],
          [{ text: 'Video', callback_data: 'create-video' }],
          [{ text: 'Sticker', callback_data: 'create-sticker' }],
        ],
      },
    });
  }

  // Handle content type selection
  const userState = userPostCreationState[chatId];
  if (userState?.stage === 'type-selection') {
    const contentType = callbackQuery.data.split('-')[1]; // Extract content type (e.g., 'text', 'photo')

    userPostCreationState[chatId] = { stage: 'waiting-for-content', contentType };
    await bot.sendMessage(chatId, `Please send the ${contentType} content for your post.`);
  }

  // Handle incoming content based on user state
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userState = userPostCreationState[chatId];

    if (userState?.stage === 'waiting-for-content') {
      const contentType = userState.contentType;

      let inlinePost;
      switch (contentType) {
        case 'text':
          inlinePost = {
            type: 'article',
            id: String(Date.now()),
            title: 'Custom Text Post',
            input_message_content: {
              message_text: msg.text,
            },
          };
          break;
        case 'photo':
          inlinePost = {
            type: 'photo',
            id: String(Date.now()),
            photo_url: msg.photo[msg.photo.length - 1].file_id,
            thumb_url: msg.photo[msg.photo.length - 1].file_id,
          };
          break;
        case 'gif':
          inlinePost = {
            type: 'gif',
            id: String(Date.now()),
            gif_url: msg.document.file_id,
            thumb_url: msg.document.file_id,
          };
          break;
        case 'video':
          inlinePost = {
            type: 'video',
            id: String(Date.now()),
            video_url: msg.video.file_id,
            thumb_url: msg.video.file_id,
          };
          break;
        case 'sticker':
          inlinePost = {
            type: 'sticker',
            id: String(Date.now()),
            sticker_url: msg.sticker.file_id,
            thumb_url: msg.sticker.file_id,
          };
          break;
        default:
          break;
      }

      await bot.sendMessage(chatId, 'Your post has been created successfully! Use this as an inline post:');

      // Store inline post data
      userFavorites[chatId] = userFavorites[chatId] || [];
      userFavorites[chatId].push(inlinePost);

      // Reset user state after post creation
      userPostCreationState[chatId] = null;
    }
  });
});
