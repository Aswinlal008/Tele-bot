const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');

// Replace with your bot's token from BotFather
const token = '7349582365:AAGTpRVnxxwpzecfFg87O3YKFrJu_sYZA-o';
const bot = new TelegramBot(token, { polling: true });

// Define conversation states
const FILENAME = 'FILENAME';
const FILECONTENT = 'FILECONTENT';
const WAIT_FOR_MOVIE_NAME = 'WAIT_FOR_MOVIE_NAME';

let userData = {};

// TMDb API key and URL for movie search
const TMDB_API_KEY = 'a43e040291da814d28bfd6d878bc8831'; // Replace with your actual TMDb API key
const TMDB_API_URL = 'https://api.themoviedb.org/3/search/movie'; // API endpoint for searching movies

// Start Command: Welcome message and instructions
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! I can help you with these commands:\n' +
    '/searchmovie <movie name> - Search for a movie\n' +
    '/newfile - Create a new text file');
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

// Handle file name input
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userState = userData[chatId]?.state;

  // If the user is in the FILENAME state (creating a file)
  if (userState === FILENAME) {
    const fileName = msg.text;
    bot.sendMessage(chatId, `File name set to: ${fileName}. Now, please send me the content for the file.`)
      .then(() => {
        userData[chatId] = { state: FILECONTENT, fileName }; // Store file name and transition to content state
      });
  }

  // If the user is in the FILECONTENT state (adding content to file)
  if (userState === FILECONTENT) {
    const fileContent = msg.text;
    const fileName = userData[chatId]?.fileName;

    // Create the content as a Buffer (an in-memory file)
    const buffer = Buffer.from(fileContent, 'utf-8');

    // Send the in-memory file directly to the user
    bot.sendDocument(chatId, buffer, {}, { filename: `${fileName}.txt`, contentType: 'text/plain' })
      .then(() => {
        bot.sendMessage(chatId, `File "${fileName}.txt" has been created successfully!`); // Confirmation message
      })
      .catch((error) => {
        bot.sendMessage(chatId, `Error sending the file: ${error.message}`);
      });

    // Reset the state after the file is created and sent
    userData[chatId] = { state: null };
  }

  // Handle movie search (user in WAIT_FOR_MOVIE_NAME state)
  if (userState === WAIT_FOR_MOVIE_NAME) {
    const movieName = msg.text.trim(); // Extract the movie name

    // Fetch movie details from TMDb API
    axios.get(TMDB_API_URL, {
      params: {
        api_key: TMDB_API_KEY, // API key for TMDb
        query: movieName, // Movie name
        language: 'en-US', // Language of the response
        page: 1, // First page of results
      },
    })
    .then((response) => {
      const movie = response.data.results[0]; // Get the first result
      if (movie) {
        // Extract movie details
        const movieDetails = `Title: ${movie.title} [${movie.release_date.split('-')[0]}]\nRating ⭐️: ${movie.vote_average} / 10\nGenre: ${movie.genre_ids.map(id => getGenreName(id)).join('#') || 'Unknown'}\nLanguage: ${movie.original_language.toUpperCase() === 'EN' ? '#English' : '#Other'}`;

        // Send Movie Details and Poster URL
        bot.sendMessage(chatId, movieDetails);
        bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`); // Send the movie poster image
      } else {
        bot.sendMessage(chatId, `Sorry, I couldn't find details for "${movieName}".`);
      }
    })
    .catch((error) => {
      bot.sendMessage(chatId, `Error searching for the movie: ${error.message}`);
    });

    // End the movie search state
    delete userData[chatId]; // Reset the state
  }
});

// Function to map genre IDs to genre names (basic mapping, extend it if needed)
function getGenreName(id) {
  const genreMap = {
    28: 'Action',
    12: 'Adventure',
    878: 'Sci-Fi',
    35: 'Comedy',
    18: 'Drama',
    53: 'Thriller',
    27: 'Horror',
    80: 'Crime',
    99: 'Documentary',
    10402: 'Music',
    10749: 'Romance',
    14: 'Fantasy',
    36: 'History',
    10751: 'Family',
    10752: 'War',
    37: 'Western',
    10763: 'News',
    10764: 'Reality',
    10765: 'Sci-Fi & Fantasy',
    10766: 'Soap',
    10767: 'Talk',
    10768: 'War & Politics',
    // Add more genres as per TMDb's genre IDs
  };

  return genreMap[id] || 'Unknown';
}
