const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = '1309035023:AAEtS50HYL7pv64pWhAN5nZdpkE5qlkuioI';
const bot = new TelegramBot(token, { polling: true });

let posts = {};

// Load posts from file
function loadPostsFromFile() {
  try {
    posts = JSON.parse(fs.readFileSync('posts.json'));
  } catch (error) {
    posts = {};
  }
}

// Save posts to file
function savePostToFile() {
  fs.writeFileSync('posts.json', JSON.stringify(posts, null, 2));
}

// Command to handle /post <postId>
bot.onText(/\/post (\w+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const postId = match[1];

  if (!posts[postId]) {
    bot.sendMessage(chatId, `❌ Post with ID \`${postId}\` not found.`, {
      parse_mode: 'Markdown',
    });
    return;
  }

  const { caption, links } = posts[postId];
  const linksPreview = links.map((link, idx) => `[${link.text} + ${link.url}] (${idx + 1})`).join('\n') || 'No links available.';
  
  bot.sendMessage(chatId, `📝 *Editing Post ID*: \`${postId}\`\n\n📋 *Caption Preview:*\n${caption}\n\n🔗 *Current Links:*\n${linksPreview}`, {
    parse_mode: 'Markdown',
  });
});

// Command to add a new post
bot.onText(/\/addpost/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Please send the caption for the new post.');

  bot.once('message', (msg) => {
    const postId = Date.now().toString(); // Generate a unique ID based on timestamp
    const caption = msg.text.trim();
    posts[postId] = { caption, links: [] };
    savePostToFile();
    bot.sendMessage(chatId, `✅ Post created with ID: \`${postId}\``, { parse_mode: 'Markdown' });
  });
});

// Command to edit a post's caption
bot.onText(/\/editpost (\w+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const postId = match[1];

  if (!posts[postId]) {
    bot.sendMessage(chatId, `❌ Post with ID \`${postId}\` not found.`, {
      parse_mode: 'Markdown',
    });
    return;
  }

  bot.sendMessage(chatId, 'Please send the new caption for the post.');

  bot.once('message', (msg) => {
    posts[postId].caption = msg.text.trim();
    savePostToFile();
    bot.sendMessage(chatId, `✅ Post ID: \`${postId}\` updated successfully.`, { parse_mode: 'Markdown' });
  });
});

// Command to delete a post
bot.onText(/\/deletepost (\w+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const postId = match[1];

  if (!posts[postId]) {
    bot.sendMessage(chatId, `❌ Post with ID \`${postId}\` not found.`, {
      parse_mode: 'Markdown',
    });
    return;
  }

  delete posts[postId];
  savePostToFile();
  bot.sendMessage(chatId, `✅ Post ID: \`${postId}\` deleted successfully.`, { parse_mode: 'Markdown' });
});

// Command to view all posts
bot.onText(/\/viewposts/, (msg) => {
  const chatId = msg.chat.id;
  const postList = Object.keys(posts).map(postId => {
    const { caption } = posts[postId];
    return `Post ID: \`${postId}\`, Caption: ${caption}`;
  }).join('\n') || 'No posts available.';

  bot.sendMessage(chatId, `📜 *All Posts:*\n${postList}`, { parse_mode: 'Markdown' });
});

// Command to add a link to a post
bot.onText(/\/addlink (\w+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const postId = match[1];
  
    // Check if the post exists
    if (!posts[postId]) {
      bot.sendMessage(chatId, `❌ Post with ID \`${postId}\` not found.`, {
        parse_mode: 'Markdown',
      });
      return;
    }
  
    // Prompt the user to send the link
    bot.sendMessage(
      chatId,
      'Please send the link in the format:\n`[Button text + link]`\n\nExample: `[Visit Google + https://google.com]`',
      { parse_mode: 'Markdown' }
    );
  
    // Handle the next message to capture the link
    bot.once('message', (msg) => {
      const linkInput = msg.text.trim();
      try {
        // Parse and format the new link
        const newLink = formatLinkToButton(linkInput);
  
        // Add the new link to the post's links
        if (!posts[postId].links) {
          posts[postId].links = [];
        }
        posts[postId].links.push(newLink);
  
        // Save the updated posts to file (persistent storage)
        savePostToFile();
  
        // Confirm success to the user
        bot.sendMessage(
          chatId,
          `✅ Link added to Post ID: \`${postId}\` successfully.\n\nNew link: [${newLink.text}](${newLink.url})`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        // Handle invalid link format
        bot.sendMessage(
          chatId,
          '❌ Invalid format. Please try again using the correct format:\n`[Button text + link]`',
          { parse_mode: 'Markdown' }
        );
      }
    });
  });
  
  // Helper function to parse and format the link
  function formatLinkToButton(linkInput) {
    const match = linkInput.match(/^\[([^\]]+)\s?\+\s?(https?:\/\/[^\s\]]+)\]$/);
    if (!match) {
      throw new Error('Invalid link format');
    }
    return { text: match[1].trim(), url: match[2].trim() };
  }
  
  // Save posts to file for persistence
  function savePostToFile() {
    fs.writeFileSync('posts.json', JSON.stringify(posts, null, 2));
  }
  
// Function to format link input to button object
function formatLinkToButton(linkInput) {
  const match = linkInput.match(/^\[(.+?) \+ (.+?)\]$/);
  if (!match) throw new Error('Invalid format');
  return { text: match[1], url: match[2] };
}
