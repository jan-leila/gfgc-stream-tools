
### obs web socket
https://github.com/Palakis/obs-websocket/releases

### node.js
https://nodejs.org/en/

### get your tiltify token
https://tiltify.com/@me/dashboard/account/apps/create

### get new twitch token (I sent these to you so we dont need to do this)
https://twitchapps.com/tmi/


# Start here

So the first thing you need to do is install all of the things. You are going to need to install `obs web socket` and `node.js` from above. Obs web socket is something that makes it so that code can talk to your code and node.js is the programming language.

After you have those installed open obs. While we are here we are going to need to set up the login information for the code and get the scenes set up for the code.

To set up the login info for the code you are going to need to go to Tools > Websocket Server Settings. Then make sure the port is 4444 and set the password to whatever you want.

To set up the scenes create a donations scene. In this scene you need to create 5 text elements named `last_donator`, `top_donator`, `donation_total`, `donation_message`, `new_donation`

You will need to set the message on donation_message to whatever you want to pop up before the donation shows and then size and position all of the elements where you want them to pop up on screen.

Then on every scene that you want the donations to pop up on you will need to create a folder element named `bottom_bar`. When donations play everything inside of this folder will be hidden and then show back up when the donations are done playing.


Now for the code part. in this folder you are going to need to make a file called `auth.json` and put in it the block of text I send you. (make sure if you used a good password for obs to set the `obsPassword` var to be whatever you made the password)

Now to run the code. You are going to need to open a terminal in this folder. (I think its shift right-click open in terminal on windows). This first command only needs to be done the first time that you run this. Run the command `npm i`. Then after that is done to start the code you should run the command `npm start`. You need to have obs open when you do this otherwise it might be sad but it also might not.

After that you should be good to go. Ill look into getting that start command into a desktop icon but I dont remember how windows works so....

If you run into any problems pm me and Ill get to them when I am awake.
