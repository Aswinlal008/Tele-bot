node bot.js


Now, when provided with Text, Photo, GIF, Video, and stickers; when user selects text, the bot should provide a menu with 3 buttons, which markup format(when clicked on converts the text format given to Text,Markdown,HTMl), Link Preview and a back button; for photo, the bot asks the user to "send a photo with the title", where the title is optional and a button for going back; for GIF and Video and Stickers  its similiar to Photo,


LINK BOT
Step 1: The bot receives a media (photo, sticker, GIF, or video).
Step 2: The bot asks if the media is ready or if the user wants to cancel.
Step 3: The bot asks the user to provide a caption for the media.
Step 4: The bot shows a preview of the media with the caption and asks if it’s okay.
Step 5: The bot asks for the inline links with the correct format ([Button text + link]).
Step 6: The bot confirms the inline links and sends the final message if the user is ready.