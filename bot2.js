const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');

// Replace with your bot's token from BotFather
const token = '7349582365:AAGTpRVnxxwpzecfFg87O3YKFrJu_sYZA-o';
const bot = new TelegramBot(token, { polling: true });

// Define conversation states
const FILENAME = 'FILENAME';
const TEXT = 'TEXT';

let userData = {};

// TMDb API key and URL for movie search
const TMDB_API_KEY = 'a43e040291da814d28bfd6d878bc8831'; // Replace with your actual TMDb API key
const TMDB_API_URL = 'https://api.themoviedb.org/3/search/movie'; // API endpoint for searching movies

// Start Command: Welcome message and instructions
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! I can help you with these commands:\n' +
    '/searchmovie <movie name> - Search for a movie\n' +
    '/searchseries <series name> - Search for a series\n' +
    '/newfile - Create a new text file');
});

// New File Command: Start the text file creation process
bot.onText(/\/newfile/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Let\'s start over! Tell me the name for the new file.')
    .then(() => {
      userData[chatId] = { state: FILENAME }; // Reset the conversation state
    });
});

// Search Movie Command
bot.onText(/\/searchmovie/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Please provide the name of the movie you want to search for.');
  userData[chatId] = { state: 'WAIT_FOR_MOVIE_NAME' }; // Wait for the movie name
});

// Handle movie name input and fetch movie details
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (userData[chatId]) {
    const state = userData[chatId].state;

    if (state === 'WAIT_FOR_MOVIE_NAME') {
      const movieName = text.trim(); // Extract the movie name

      try {
        const response = await axios.get(TMDB_API_URL, {
          params: {
            api_key: TMDB_API_KEY, // API key for TMDb
            query: movieName, // Movie name
            language: 'en-US', // Language of the response
            page: 1, // First page of results
          },
        });

        const movie = response.data.results[0]; // Get the first result
        if (movie) {
          // Extract movie details
          const movieDetails = `
Title: ${movie.title} [${movie.release_date.split('-')[0]}]
Rating ⭐️: ${movie.vote_average} / 10
Genre: ${movie.genre_ids.map(id => getGenreName(id)).join('#') || 'Unknown'}
Language: ${movie.original_language.toUpperCase() === 'EN' ? '#English' : '#Other'}
          `;

          // Send Movie Details and Poster URL
          bot.sendMessage(chatId, movieDetails);
          bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`); // Send the movie poster image
        } else {
          bot.sendMessage(chatId, `Sorry, I couldn't find details for "${movieName}".`);
        }
      } catch (error) {
        bot.sendMessage(chatId, `Error searching for the movie: ${error.message}`);
      }

      // End the movie search state
      delete userData[chatId];
    }
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
    // Add more genres as per TMDb's genre IDs
  };

  return genreMap[id] || 'Unknown';
}
