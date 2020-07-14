// Things for managing the file system
const path = require('path');
const fs = require('fs');

// Load the auth file
console.log('loading auth file');
let auth;
try {
  auth = fs.readFileSync(path.join(__dirname, 'auth.json'), 'utf-8');
}
catch(err){
  auth = JSON.stringify({
    tiltifyToken: "",
    twitchUsername:"",
    twitchOAuth:"",
    twitchChannel:"",
    obsAddress:"",
    obsPassword:"",
  });
  fs.writeFile(path.join(__dirname, 'data', 'auth.json'), 'utf-8', auth, (err) => {
    if(err){ console.log(err) };
  });
}
try {
  auth = JSON.parse(auth);
}
catch(err) {
  throw err;
}
console.log('auth file loaded');

// API's
const OBSWebSocket = require('obs-websocket-js');
const Tiltify = require('tiltifyapi');
const Twitch = require('tmi.js');

// Create apis
let obs, tiltify, twitch;

tiltify = new Tiltify(auth.tiltifyToken);

twitch = new Twitch.client({
  identity: {
    username: auth.twitchUsername,
    password: auth.twitchOAuth
  },
  channels: [ auth.twitchChannel ]
});

class OBS {
  constructor() {
    this.obs = new OBSWebSocket();
  }

  connect(){
    return new Promise((resolve, reject) => {
      if(this.obs._connected){
        return resolve();
      }
      let _connect = () => {
        this.obs.connect({ address: auth.obsAddress, password: auth.obsPassword })
        .then(() => {
          resolve();
        })
        .catch(() => {
          setTimeout(_connect, 500);
        });
      }
      _connect();
    });
  }

  disconnect(){
    return this.obs.disconnect();
  }

  on(...args){
    this.connect()
    .then(() => {
      this.obs.on(...args);
    });
  }

  send(...args){
    return this.connect()
    .then(() => {
      return this.obs.send(...args);
    });
  }
}
obs = new OBS();

let donationQueue = [];
function showDonation(donation){
  donationQueue.unshift(donation);
  setTimeout(playDonations, 0);
}

let donationsRunning = false;
async function playDonations(){
  if(donationsRunning){
    return;
  }
  donationsRunning = true;
  while(donationQueue.length){
    try {
      await playDonation(donationQueue.pop());
    }
    catch(err){
      console.log(err);
    }
  }
  donationsRunning = false;
}

let top_donation = 0;
function setTopDonation(donation){
  obs.send('SetTextFreetype2Properties', {
    source: 'top_donator',
    text: `top donation: ${donation.name} - $${Number(donation.amount).toFixed(2)}`
  });
}

function setLastDonation(donation){
  obs.send('SetTextFreetype2Properties', {
    source: 'last_donator',
    text: `last donation from: ${donation.name} - $${Number(donation.amount).toFixed(2)}`
  });
}

function setDonationAmount(amount){
  obs.send('SetTextFreetype2Properties', {
    source: 'donation_total',
    text: `$${amount}`
  });
}

let donation_total = 0;
function playDonation(donation){
  let donation_amount = Number(donation.amount).toFixed(2);
  // Say donation in twitch chat
  twitch.say('#gamingforglobalchange', `We have a $${donation_amount} donation from ${donation.name} ${donation.comment === null || donation.comment === ''?'':`with the comment "${donation.comment}"`}`);

  donation_total += donation.amount;
  // Update donation total on screen
  setDonationAmount(donation_amount);

  // set the last donator on screen
  setLastDonation(donation);

  // check if we have a new top donator
  if(donation.amount > top_donation){
    setTopDonation(donation);
  }

  // Show donation on screen
  return new Promise((resolve, reject) => {
    obs.send('SetSceneItemProperties', {
      item: {
        name: 'bottom_bar',
      },
      visible: false,
    })
    .then(() => {
      return obs.send('GetSceneItemProperties', {
        'scene-name': 'donations',
        item: {
          name: 'new_donation',
        },
      });
    })
    .then((source_item) => {
      return new Promise((resolve, reject) => {
        obs.send('DuplicateSceneItem', {
          fromScene: 'donations',
          item: {
            id: source_item.itemId,
          },
        })
        .then((new_item) => {
          resolve({ source_item, new_item})
        })
        .catch(reject);
      });
    })
    .then(({ source_item: { position,  rotation, scale, crop, bounds }, new_item: { scene, item } }) => {
      return new Promise((resolve, reject) => {
        obs.send('SetSceneItemProperties', {
          scene,
          item: item,
          position,
          rotation,
          scale,
          crop,
          bounds,
          visible: true,
        })
        .then(() => {
          resolve({ scene, item })
        })
        .catch(reject);
      });
    })
    .then((item) => {
      return new Promise(function(resolve, reject) {
        setTimeout(() => { resolve(item) }, 1000);
      });
    })
    .then(({ scene, item }) => {
      return obs.send("DeleteSceneItem", {
        scene,
        item,
      });
    })
    .then(() => {
      return obs.send('SetSceneItemProperties', {
        'scene-name': 'donations',
        item: {
          name: 'new_donation',
        },
        visible: false,
      })
    })
    .then(() => {
      return obs.send('GetSceneItemProperties', {
        'scene-name': 'donations',
        item: {
          name: 'donation_message',
        },
      });
    })
    .then((source_item) => {
      return new Promise((resolve, reject) => {
        obs.send('DuplicateSceneItem', {
          fromScene: 'donations',
          item: {
            id: source_item.itemId,
          },
        })
        .then((new_item) => {
          resolve({ source_item, new_item})
        })
        .catch(reject);
      });
    })
    .then(({ source_item: { position,  rotation, scale, crop, bounds }, new_item: { scene, item } }) => {
      return new Promise((resolve, reject) => {
        obs.send('SetSceneItemProperties', {
          scene,
          item: item,
          position,
          rotation,
          scale,
          crop,
          bounds,
          visible: true,
        })
        .then(() => {
          resolve({ scene, item })
        })
        .catch(reject);
      });
    })
    .then(({ scene, item: { id, name }}) => {
      return new Promise(function(resolve, reject) {
        obs.send('SetTextFreetype2Properties', {
          source: name,
          text: `Received a $${donation_amount} donation from ${donation.name}`,
        })
        .then(() => {
          resolve({ scene, id });
        })
        .catch(reject);
      });
    })
    .then((item) => {
      return new Promise(function(resolve, reject) {
        setTimeout(() => { resolve(item) }, 3000);
      });
    })
    .then(({ scene, id }) => {
      return obs.send("DeleteSceneItem", {
        scene: scene,
        item: {
          id: id,
        },
      });
    })
    .then(() => {
      return obs.send('SetSceneItemProperties', {
        'scene-name': 'donations',
        item: {
          name: 'donation_message',
        },
        visible: false,
      })
    })
    .then(() => {
      return obs.send('SetSceneItemProperties', {
        item: {
          name: 'bottom_bar',
        },
        visible: true,
      });
    })
    .then(resolve)
    .catch(reject);
  });
}

// Connect to everything
twitch.connect()
.then(() => {
  return tiltify.getUser('gamingforglobalchange')
  .then((user) => {
    return user.getCampaigns()
  })
})
.then((campaigns) => {
  campaigns = campaigns.filter((campaign) => {
    return campaign.slug === 'relay-for-relief'
  })
  let activeCampain = campaigns[0];

  // Update obs
  activeCampain.getDonations()
  .then((donations) => {
    setTopDonation(donations.reduce((acc, cur) => {
      return (acc.amount > cur.amount)? acc : cur;
    }));
    setLastDonation(donations.reduce((acc, cur) => {
      return (acc.completedAt > cur.completedAt)? acc : cur;
    }));
  })

  // Start schedual timeouts to update the game
  activeCampain.getSchedule()
  .then((events) => {
    let now = Date.now();
    for(let i in events){
      if(events[i].startsAt < now){
        continue;
      }
      setTimeout(() => {
        twitch.set(`!game ${events[i].name}`);
      }, events[i].startsAt - now);
    };
  });

  // set donation total
  donation_total = activeCampain.amountRaised;
  setDonationAmount(Number(donation_total).toFixed(2));

  activeCampain.getDonationStream(showDonation);
});
