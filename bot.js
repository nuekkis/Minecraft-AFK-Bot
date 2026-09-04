const mineflayer = require('mineflayer');
const config = require('./config.json');

// Declare bot globally so it can be reassigned on reconnect
let bot;
let movementPhase = 0;
const STEP_INTERVAL = 1500;
const STEP_SPEED    = 1;
const JUMP_DURATION = 500;
const RECONNECT_TIME = 5000; // Time to wait before reconnecting (in milliseconds)

function createBot() {
  console.log('🔄 Attempting to connect to the server...');
  
  bot = mineflayer.createBot({
    host: config.serverHost,
    port: config.serverPort,
    username: config.botUsername,
    auth: 'offline',
    version: false,
    viewDistance: config.botChunk
  });

  bot.on('spawn', () => {
    movementPhase = 0; // Reset movement phase on fresh spawn
    
    setTimeout(() => {
      bot.setControlState('sneak', true);
      console.log(`✅ ${config.botUsername} is Ready!`);
    }, 3000);

    setTimeout(movementCycle, STEP_INTERVAL);
  });

  bot.on('error', (err) => {
    console.error('⚠️ Error:', err.message);
    // Note: We don't reconnect on 'error' directly because Mineflayer usually 
    // emits an 'end' event immediately after a fatal connection error.
  });

  bot.on('end', (reason) => {
    console.log(`⛔️ Bot Disconnected! Reason: ${reason}`);
    console.log(`⏳ Reconnecting in ${RECONNECT_TIME / 1000} seconds...`);
    
    // Auto-rejoin logic
    setTimeout(createBot, RECONNECT_TIME);
  });
}

function movementCycle() {
  // Stop the loop if the bot disconnected
  if (!bot || !bot.entity) return; 

  switch (movementPhase) {
    case 0:
      bot.setControlState('forward', true);
      bot.setControlState('back', false);
      bot.setControlState('jump', false);
      break;
    case 1:
      bot.setControlState('forward', false);
      bot.setControlState('back', true);
      bot.setControlState('jump', false);
      break;
    case 2:
      bot.setControlState('forward', false);
      bot.setControlState('back', false);
      bot.setControlState('jump', true);
      setTimeout(() => {
        // Ensure bot is still connected before clearing jump
        if (bot && bot.entity) bot.setControlState('jump', false);
      }, JUMP_DURATION);
      break;
    case 3:
      bot.setControlState('forward', false);
      bot.setControlState('back', false);
      bot.setControlState('jump', false);
      break;
  }

  movementPhase = (movementPhase + 1) % 4;

  setTimeout(movementCycle, STEP_INTERVAL);
}

// Start the bot for the first time
createBot();
