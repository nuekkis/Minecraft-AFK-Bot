const mineflayer = require('mineflayer');
const config = require('./config.json');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const TIME_ZONE = 'Asia/Shanghai';
const STEP_INTERVAL = 1500;
const JUMP_DURATION = 500;

const clockFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

let bot;
let reconnectAttempts = 0;
let reconnectTimer;
let bedtimeTimer;
let wakeTimer;
let behaviorTimer;
let movementTimer;
let jumpTimer;
let sleeping = false;
let nextShortRestAt;
let nextLongRestAt;
let restEndsAt = 0;
let restType;

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getLocalTimeParts(timestamp = Date.now()) {
  const values = Object.fromEntries(
    clockFormatter.formatToParts(new Date(timestamp))
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)])
  );
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

function localTimeToEpoch({ year, month, day, hour, minute }) {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let result = desired;

  for (let i = 0; i < 3; i += 1) {
    const local = getLocalTimeParts(result);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    result += desired - represented;
  }

  return result;
}

function millisecondsUntilBedtime(now = Date.now()) {
  const local = getLocalTimeParts(now);
  let bedtime = localTimeToEpoch({ ...local, hour: 1, minute: 30 });

  if (bedtime <= now) {
    const nextDay = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
    bedtime = localTimeToEpoch({
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      hour: 1,
      minute: 30
    });
  }

  return bedtime - now;
}

function clearBehaviorTimers() {
  clearTimeout(behaviorTimer);
  clearTimeout(movementTimer);
  clearTimeout(jumpTimer);
  behaviorTimer = undefined;
  movementTimer = undefined;
  jumpTimer = undefined;
}

function stopActions(currentBot) {
  clearTimeout(movementTimer);
  clearTimeout(jumpTimer);
  movementTimer = undefined;
  jumpTimer = undefined;

  try {
    currentBot.clearControlStates();
  } catch (err) {
    // The connection may already be ending.
  }
}

function startMovement(currentBot) {
  let movementPhase = 0;
  currentBot.setControlState('sneak', true);

  function movementCycle() {
    if (sleeping || restEndsAt > Date.now() || bot !== currentBot || !currentBot.entity) return;

    switch (movementPhase) {
      case 0:
        currentBot.setControlState('forward', true);
        currentBot.setControlState('back', false);
        currentBot.setControlState('jump', false);
        break;
      case 1:
        currentBot.setControlState('forward', false);
        currentBot.setControlState('back', true);
        currentBot.setControlState('jump', false);
        break;
      case 2:
        currentBot.setControlState('forward', false);
        currentBot.setControlState('back', false);
        currentBot.setControlState('jump', true);
        jumpTimer = setTimeout(() => {
          if (!sleeping && restEndsAt <= Date.now() && bot === currentBot && currentBot.entity) {
            currentBot.setControlState('jump', false);
          }
        }, JUMP_DURATION);
        break;
      case 3:
        currentBot.setControlState('forward', false);
        currentBot.setControlState('back', false);
        currentBot.setControlState('jump', false);
        break;
    }

    movementPhase = (movementPhase + 1) % 4;
    movementTimer = setTimeout(movementCycle, STEP_INTERVAL);
  }

  movementTimer = setTimeout(movementCycle, STEP_INTERVAL);
}

function scheduleBehavior(currentBot, startOnResume = true) {
  clearTimeout(behaviorTimer);
  if (sleeping || bot !== currentBot || !currentBot.entity) return;

  const now = Date.now();
  if (restEndsAt > now) {
    stopActions(currentBot);
    behaviorTimer = setTimeout(() => scheduleBehavior(currentBot), restEndsAt - now);
    return;
  }

  if (restType) {
    restType = undefined;
    restEndsAt = 0;
    console.log('▶️ Break finished; resuming activity.');
    if (startOnResume) startMovement(currentBot);
  }

  if (now >= nextLongRestAt) {
    beginRest(currentBot, 'long');
    return;
  }

  if (now >= nextShortRestAt) {
    beginRest(currentBot, 'short');
    return;
  }

  behaviorTimer = setTimeout(
    () => scheduleBehavior(currentBot),
    Math.max(1, Math.min(nextShortRestAt, nextLongRestAt) - now)
  );
}

function beginRest(currentBot, type) {
  const isLong = type === 'long';
  const durationMinutes = isLong ? randomBetween(5, 8) : randomBetween(2, 3);
  restType = type;
  restEndsAt = Date.now() + durationMinutes * MINUTE;
  nextShortRestAt = restEndsAt + randomBetween(30, 60) * MINUTE;
  if (isLong) nextLongRestAt = restEndsAt + 3 * HOUR;

  stopActions(currentBot);
  console.log(`☕ ${isLong ? 'Long' : 'Short'} break for ${durationMinutes} minutes.`);
  scheduleBehavior(currentBot);
}

function scheduleBedtime() {
  clearTimeout(bedtimeTimer);
  bedtimeTimer = setTimeout(() => {
    bedtimeTimer = undefined;
    beginNightSleep();
  }, millisecondsUntilBedtime());
}

function beginNightSleep(wakeAt) {
  if (sleeping) return;
  sleeping = true;
  clearBehaviorTimers();
  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  if (bot) stopActions(bot);

  if (bot && typeof bot.quit === 'function') bot.quit('disconnect.quitting');
  else if (bot && typeof bot.end === 'function') bot.end('disconnect.quitting');

  const sleepMinutes = wakeAt
    ? Math.max(0, Math.ceil((wakeAt - Date.now()) / MINUTE))
    : randomBetween(6 * 60, 7 * 60);
  console.log(`🌙 Sleeping for ${sleepMinutes} minutes (${TIME_ZONE}).`);
  wakeTimer = setTimeout(() => {
    wakeTimer = undefined;
    sleeping = false;
    nextShortRestAt = undefined;
    nextLongRestAt = undefined;
    restEndsAt = 0;
    restType = undefined;
    scheduleBedtime();
    createBot();
  }, sleepMinutes * MINUTE);
}

function createBot() {
  const currentBot = mineflayer.createBot({
    host: config.serverHost,
    port: config.serverPort,
    username: config.botUsername,
    auth: 'offline',
    version: false,
    viewDistance: config.botChunk
  });
  bot = currentBot;

  let readyTimer;
  let stableTimer;
  let ended = false;

  currentBot.once('inject_allowed', () => {
    const sendsClientTickEndPacket = currentBot.supportFeature('sendsClientTickEndPacket');
    console.log(`[protocol] Mineflayer ${currentBot.version} (protocol ${currentBot.protocolVersion}), tick_end ${sendsClientTickEndPacket ? 'enabled' : 'not required'}.`);

    const writePacket = currentBot._client.write.bind(currentBot._client);
    let supplementedPackets = 0;
    let teleportConfirms = 0;
    currentBot._client.write = (name, packet) => {
      const result = writePacket(name, packet);
      if (sendsClientTickEndPacket && currentBot._client.state === 'play' && ['position', 'position_look', 'look', 'flying'].includes(name)) {
        writePacket('tick_end', {});
        supplementedPackets += 1;
        if (supplementedPackets <= 3) {
          console.log(`[protocol] ${name} followed by tick_end (#${supplementedPackets}).`);
        }
      }
      if (name === 'teleport_confirm' && teleportConfirms < 3) {
        teleportConfirms += 1;
        console.log(`[protocol] teleport_confirm #${teleportConfirms}: ${JSON.stringify(packet)}.`);
      }
      return result;
    };

    let receivedPositions = 0;
    currentBot._client.on('position', (packet) => {
      if (receivedPositions >= 3) return;
      receivedPositions += 1;
      console.log(`[protocol] server position #${receivedPositions}: ${JSON.stringify({ teleportId: packet.teleportId, x: packet.x, y: packet.y, z: packet.z, yaw: packet.yaw, pitch: packet.pitch })}.`);
    });
  });

  function clearSessionTimers() {
    clearTimeout(readyTimer);
    clearTimeout(stableTimer);
    clearTimeout(behaviorTimer);
    clearTimeout(movementTimer);
    clearTimeout(jumpTimer);
  }

  currentBot.on('spawn', () => {
    clearTimeout(readyTimer);
    clearTimeout(stableTimer);
    stopActions(currentBot);
    stableTimer = setTimeout(() => {
      if (!ended && bot === currentBot) reconnectAttempts = 0;
    }, 60000);
    readyTimer = setTimeout(() => {
      if (ended || bot !== currentBot || !currentBot.entity) return;
      console.log(`✅ ${config.botUsername} is Ready!`);
    }, 3000);

    const now = Date.now();
    if (nextShortRestAt === undefined) nextShortRestAt = now + randomBetween(30, 60) * MINUTE;
    if (nextLongRestAt === undefined) nextLongRestAt = now + 3 * HOUR;
    scheduleBehavior(currentBot, false);
    if (!sleeping && restEndsAt <= now) startMovement(currentBot);
  });

  currentBot.on('error', (err) => {
    console.error('⚠️ Error:', err);
  });

  currentBot.on('end', () => {
    if (ended) return;
    ended = true;
    clearSessionTimers();
    if (bot === currentBot) bot = undefined;
    console.log('⛔️ Bot Disconnected!');
    if (sleeping || reconnectTimer) return;

    const delay = Math.min(5000 * 2 ** reconnectAttempts, 60000);
    reconnectAttempts += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      if (!sleeping) createBot();
    }, delay);
  });
}

function start() {
  const local = getLocalTimeParts();
  const localMinute = local.hour * 60 + local.minute;

  if (localMinute >= 90 && localMinute < 7 * 60 + 30) {
    const wakeMinute = randomBetween(7 * 60 + 30, 8 * 60 + 30);
    const wakeAt = localTimeToEpoch({
      ...local,
      hour: Math.floor(wakeMinute / 60),
      minute: wakeMinute % 60
    });
    beginNightSleep(wakeAt);
    return;
  }

  scheduleBedtime();
  createBot();
}

start();
