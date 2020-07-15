// Things for managing the file system
const path = require('path');
const fs = require('fs');

let SetTextTypeProperties = (process.platform === 'linux')? 'SetTextFreetype2Properties' : 'SetTextGDIPlusProperties';

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
      return this.obs.on(...args);
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
  top_donation = donation.amount;
  return obs.send(SetTextTypeProperties, {
    source: 'top_donator',
    text: `Top donation: ${donation.name} - $${Number(donation.amount).toFixed(2)}`
  });
}

function setLastDonation(donation){
  return obs.send(SetTextTypeProperties, {
    source: 'last_donator',
    text: `Last donation from: ${donation.name} - $${Number(donation.amount).toFixed(2)}`
  });
}

function setDonationTotal(amount){
  return obs.send(SetTextTypeProperties, {
    source: 'donation_total',
    text: `$${amount}`
  });
}

function createTextElement(name, text){
  return obs.send('GetSceneItemProperties', {
    'scene-name': 'donations',
    item: {
      name,
    },
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
  .then(({ source_item, new_item }) => {
    return new Promise(function(resolve, reject) {
      obs.send(SetTextTypeProperties, {
        source: name,
        text,
      })
      .then(() => {
        resolve({ source_item, new_item });
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
}

let donation_total = 0;
function playDonation(donation, update_total = true){
  let donation_amount = Number(donation.amount).toFixed(2);
  // Say donation in twitch chat
  try {
    twitch.say('#gamingforglobalchange', `We have a $${donation_amount} donation from ${donation.name} ${donation.comment === null || donation.comment === ''?'':`with the comment "${donation.comment}"`}`);
  }
  catch(err){
    console.log(err);
  }


  return obs.send('SetSceneItemProperties', {
    item: {
      name: 'bottom_bar',
    },
    visible: false,
  })
  .then(() => {
    if(update_total){
      donation_total += donation.amount;
      // Update donation total on screen
      return setDonationTotal(Number(donation_total).toFixed(2))
      .then(() => {
        // set the last donator on screen
        return setLastDonation(donation);
      })
    }
    return Promise.resolve();
  })
  .then(() => {
    // check if we have a new top donator
    if(donation.amount > top_donation){
      return setTopDonation(donation);
    }
    return Promise.resolve();
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
    return Promise.all([
      createTextElement('donation_name', `Received a donation from ${donation.name}`),
      createTextElement('donation_amount', `$${donation_amount}`),
    ]);
    return ;
  })
  .then((items) => {
    return new Promise(function(resolve, reject) {
      setTimeout(() => { resolve(items) }, 3000);
    });
  })
  .then((items) => {
    return new Promise(async (resolve, reject) => {
      for(let i in items){
        await obs.send("DeleteSceneItem", items[i]);
      };
      resolve();
    });
  })
  .then(() => {
    return obs.send('SetSceneItemProperties', {
      item: {
        name: 'bottom_bar',
      },
      visible: true,
    });
  })
  .catch(Promise.resolve);
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
    return new Promise(function(resolve, reject) {
      return setTopDonation(donations.reduce((acc, cur) => {
        return (acc.amount > cur.amount)? acc : cur;
      }))
      .then(() => {
        resolve(donations);
      })
    });
  })
  .then((donations) => {
    return setLastDonation(donations.reduce((acc, cur) => {
      return (acc.completedAt > cur.completedAt)? acc : cur;
    }));
  })
  .then(() => {
    // Start schedual timeouts to update the game
    return activeCampain.getSchedule()
  })
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
  })
  .then(() => {
    // set donation total
    donation_total = activeCampain.amountRaised;
    return setDonationTotal(Number(donation_total).toFixed(2));
  })
  .then(() => {
    activeCampain.getDonationStream(showDonation);

    // Uncomment to Test
    playDonation({
      amount: 5,
      name: "Smith",
      comment: "Uwu",
    }, false);
  });
});
