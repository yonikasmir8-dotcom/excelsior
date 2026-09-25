// Every conversation in the game. Nodes can run actions, gate choices, and make d20 skill checks.
// `A` is the game API (see main.js → makeApi).
import { NPCS, COMPANIONS } from './npcs.js';

export function buildDialogues(A) {
  const S = () => A.save();
  const shards = () => S().shards.length;
  const D = {};

  // ─────────────────────────────── OLD MAREN ───────────────────────────────
  D.maren = () => {
    const s = S();
    if (!s.flags.prologue) return 'maren_intro';
    if (s.flags.ending) return 'maren_post';
    if (shards() >= 3 && !s.flags.confession) return 'maren_confession';
    return 'maren_hub';
  };
  D.maren_intro = {
    n0: { who: 'maren', text: 'Easy, easy. You came through the door with your boots smoking. Happens to the best of us.', next: 'n1' },
    n1: { who: 'maren', text: () => `Welcome to the Hearth Between. I'm Maren. I pour the drinks, I mop the floors, and I don't remember anything before I started doing both.`, choices: [
      { t: 'Where am I, exactly?', go: 'where' },
      { t: '[Insight] You\'re hiding something.', check: { skill: 'insight', dc: 13 }, go: 'insight_ok', fail: 'insight_fail' },
      { t: 'I need a drink first.', go: 'drink' },
    ] },
    drink: { who: 'maren', text: 'Ha! A hero after my own heart. On the house. The first one always is.', do: () => A.heal(), next: 'where' },
    insight_ok: { who: 'maren', text: '...Sharp. Fine. Every time a realm falls, I feel it, right here. Like a stitch coming loose. And lately there\'s been a lot of loose stitches.', do: () => A.flag('maren_trust', 1), next: 'where' },
    insight_fail: { who: 'maren', text: 'Hiding something? Only the good ale. Now, pay attention.', next: 'where' },
    where: { who: 'maren', text: 'This tavern sits between every world there is. Fantasy kingdoms, cities full of caped do-gooders, ships drifting between stars. Something is unmaking them, one thread at a time. When a realm is unmade, everyone forgets it ever existed.', next: 'n2' },
    n2: { who: 'maren', text: 'Heroes wash up here when their worlds are in trouble. You\'re one of them. The doors on the north wall lead to realms that are fraying right now.', next: 'n3' },
    n3: { who: 'maren', text: 'Don\'t go alone. Plenty of capable folk drink here. Talk to them, and pick companions to fill out your party. Then go through a door.', choices: [
      { t: 'What\'s doing the unmaking?', go: 'what' },
      { t: 'I\'m ready.', go: 'end' },
    ] },
    what: { who: 'maren', text: 'Folk call it the Unraveller. Nobody who has seen it remembers what it looks like, which is its own kind of answer. Every realm it touches has a "thread", a Loom-Shard. Bring me those shards and maybe we can work out what it wants.', next: 'end' },
    end: { who: 'maren', text: () => `${A.starterName()} has offered to watch your back. Before you go anywhere, though: goblins got into my cellar again. Clear them out and show me what you can do.`, do: () => { A.flag('prologue', 1); A.unlockDoor('emberwood'); A.unlockDoor('neon'); A.unlockDoor('asterion'); A.recruitStarter(); A.questLog('Recruit more companions (talk to the regulars), then pick a realm door on the north wall.'); }, next: 'go' },
    go: { who: 'maren', text: () => A.save().flags.skipTutorial ? 'On second thoughts, you look like you know your way around a fight. The doors are yours.' : 'Down the stairs, then. Mind the barrels.', do: () => A.startTutorial(), end: true },
  };
  D.maren_hub = {
    n0: { who: 'maren', text: () => A.pick([
      `Shards so far: ${shards()} of 3. The Tavern hums a little louder with each one.`,
      `You look like you've been through a realm or two. Sit. Drink. Then go save another.`,
      `Lute's been writing songs about you. I'd apologise, but I charge him for the stage.`,
      `Nemeses on the board are getting bolder. Check the Wanted wall before you head out.`]), choices: [
      { t: 'Tell me about the realms.', go: 'realms' },
      { t: 'Any news about the Unraveller?', go: 'news' },
      { t: 'Pour me something strong. (Fully heal the party)', go: 'heal' },
      { t: 'Goodbye.', end: true },
    ] },
    realms: { who: 'maren', text: () => `Emberwood Reach: autumn forever, and a dead king who won't lie down. ${S().realms.emberwood?.done ? '(Saved.)' : ''}\nNeon Meridian: heroes, villains, rooftops. Someone is erasing the heroes. ${S().realms.neon?.done ? '(Saved.)' : ''}\nThe Asterion: a ship full of sleepers and an AI that loves them too much. ${S().realms.asterion?.done ? '(Saved.)' : ''}\nThe Rift door leads wherever the tears are. It gets stranger the deeper you go.`, next: 'n0' },
    news: { who: 'maren', text: () => shards() === 0 ? 'Nothing yet. Bring me a shard and we\'ll learn something.' : shards() === 1 ? 'The shard you brought shows a woman at a loom, weaving. Familiar, somehow. Makes my head ache.' : 'Two shards now. When I hold them I hear... my own voice. That shouldn\'t be possible.', next: 'n0' },
    heal: { who: 'maren', text: 'Here. Tastes like regret, cures most things.', do: () => A.heal(), next: 'n0' },
  };
  D.maren_confession = {
    n0: { who: 'maren', text: 'Three shards. Put them on the bar. ...Oh. Oh, I remember now.', next: 'n1' },
    n1: { who: 'maren', text: 'I\'m the Weaver. I made the Loom that ties every realm together. And when the Unraveller came for it, I hid the knot in the one place it would never look: a tavern nobody remembers. Then I made myself forget, so it couldn\'t pull the secret out of me.', next: 'n2' },
    n2: { who: 'maren', text: 'Every shard you gathered was a breadcrumb. It followed you. The Hooded Stranger... has he been drinking here this whole time?', choices: [
      { t: 'You used us.', go: 'used' },
      { t: 'Then we end this. Together.', go: 'together' },
      { t: '[Persuasion] You were protecting everyone. That\'s what heroes do.', check: { skill: 'persuasion', dc: 12 }, go: 'persuade', fail: 'used' },
    ] },
    used: { who: 'maren', text: 'I didn\'t know. I swear on every thread I didn\'t. But you have every right to be angry.', next: 'n3' },
    persuade: { who: 'maren', text: '...Thank you. I needed to hear that from someone who remembers me.', do: () => A.flag('maren_trust', 2), next: 'n3' },
    together: { who: 'maren', text: 'Together, then. It\'s been a long time since I had someone to say that to.', next: 'n3' },
    n3: { who: 'maren', text: 'The white door has woken. It opens on the Loom itself. The Unraveller will be there, pulling on the knot. Finish it, hero.', do: () => { A.flag('confession', 1); A.unlockDoor('loom'); A.questLog('Enter the Loom through the white door and face the Unraveller.'); }, end: true },
  };
  D.maren_post = {
    n0: { who: 'maren', text: () => A.pick(['The realms are quiet. Quiet is good. Quiet is also boring. Go find a Rift.', 'You did it. I keep saying that to myself.', 'Nemeses still roam the Rifts. Old grudges don\'t die easily.']), choices: [{ t: 'Pour me something strong. (Heal)', go: 'heal' }, { t: 'Goodbye.', end: true }] },
    heal: { who: 'maren', text: 'On the house. Forever, for you.', do: () => A.heal(), end: true },
  };

  // ─────────────────────────────── GRIZZLE ───────────────────────────────
  D.grizzle = {
    n0: { who: 'grizzle', text: () => A.pick(['Merchandise! Mostly legal! Mostly yours, once you pay!', 'Ah, my favourite customer. You have gold, yes?', 'Found this in a realm that no longer exists. Priceless! Also for sale.']), choices: [
      { t: 'Show me your wares.', do: () => A.openShop(), end: true },
      { t: 'Buy intel on a Nemesis (40g).', if: () => S().gold >= 40, go: 'intel' },
      { t: '[Intimidation] Give me a discount.', if: () => !S().flags.discount, check: { skill: 'intimidation', dc: 14 }, go: 'disc_ok', fail: 'disc_fail' },
      { t: 'Goodbye.', end: true },
    ] },
    intel: { who: 'grizzle', text: () => A.buyIntel(), next: 'n0' },
    disc_ok: { who: 'grizzle', text: 'Okay! Okay! Twenty percent off, forever! Please stop looming.', do: () => A.flag('discount', 1), next: 'n0' },
    disc_fail: { who: 'grizzle', text: 'Hah! I\'ve been threatened by dragons, friend. Prices stand.', next: 'n0' },
  };

  // ─────────────────────────────── LUTE ───────────────────────────────
  D.lute = {
    n0: { who: 'lute', text: () => A.bardSong(), choices: [
      { t: 'Heard any rumours about the Nemeses?', go: 'rumor' },
      { t: '[Persuasion] Write a song about ME.', check: { skill: 'persuasion', dc: 10 }, go: 'song', fail: 'nosong' },
      { t: 'Goodbye.', end: true },
    ] },
    rumor: { who: 'lute', text: () => A.bardRumor(), next: 'n0' },
    song: { who: 'lute', text: () => `🎵 ${A.heroName()} walked through a door, and nothing was the same! They rolled a twenty on destiny and fate forgot its name! 🎵 ...Needs work. (+10% Break charge next fight)`, do: () => A.flag('inspired', 1), next: 'n0' },
    nosong: { who: 'lute', text: 'I only write songs about people who\'ve DONE things. Come back with a better story.', next: 'n0' },
  };

  // ─────────────────────────────── CARTOGRAPHA ───────────────────────────────
  D.carto = {
    n0: { who: 'carto', text: () => S().flags.riftOpen ? `The Rifts shift constantly. Your deepest dive so far: Depth ${S().riftDepth}. The deeper you go, the stranger it gets, and the better the loot.` : 'The Rift door opens once you have saved a realm. Until then my maps show only static.', choices: [
      { t: 'What are Rifts?', go: 'what' },
      { t: 'Tell me about Rift modifiers.', go: 'mods' },
      { t: 'Goodbye.', end: true },
    ] },
    what: { who: 'carto', text: 'Places where realms have torn and bled into each other. Gothic moons, candy wastelands, steampunk swamps. Close the tears, slay the Warden, and go deeper. Nemeses who have learned to rift-walk will hunt you there.', next: 'n0' },
    mods: { who: 'carto', text: 'Every rift has a Modifier. Low gravity. Explosive foes. Glass cannons. Double fate. Each depth adds more. Read them before you jump in. Or don\'t. I sell maps, not advice.', next: 'n0' },
  };

  // ─────────────────────────────── ROLLO (dice game) ───────────────────────────────
  D.rollo = {
    n0: { who: 'rollo', text: 'Fancy a game of High Die? You roll a d20, I roll a d20, highest wins double. Ties go to the house. The house is me.', choices: [
      { t: 'Bet 10 gold.', if: () => S().gold >= 10, do: () => A.diceGame(10, false), go: 'result' },
      { t: 'Bet 50 gold.', if: () => S().gold >= 50, do: () => A.diceGame(50, false), go: 'result' },
      { t: '[Stealth] Bet 50 and palm a loaded die.', if: () => S().gold >= 50, check: { skill: 'stealth', dc: 13 }, do: () => A.diceGame(50, true), go: 'result', fail: 'caught' },
      { t: 'No thanks.', end: true },
    ] },
    result: { who: 'rollo', text: () => A.lastDice(), next: 'n0' },
    caught: { who: 'rollo', text: 'Is that a DIE in your sleeve? Hah! Bold. I\'m keeping your 50 for the insult.', do: () => A.gold(-50), next: 'n0' },
  };

  // ─────────────────────────────── MAMA STEW ───────────────────────────────
  D.stew = {
    n0: { who: 'stew', text: () => S().buff ? `You've already eaten, sweetie: ${S().buff.name}. It lasts one realm.` : 'You look thin. Eat something before you go fight a lich. 30 gold a bowl. It lasts one trip through a door.', choices: [
      { t: 'Hearty Stew (+20% max HP) — 30g', if: () => S().gold >= 30 && !S().buff, do: () => A.buyFood('hearty'), go: 'ate' },
      { t: 'Dragon Chili (+12% damage) — 30g', if: () => S().gold >= 30 && !S().buff, do: () => A.buyFood('chili'), go: 'ate' },
      { t: 'Lucky Pie (+2 Fate Dice) — 30g', if: () => S().gold >= 30 && !S().buff, do: () => A.buyFood('pie'), go: 'ate' },
      { t: 'Just looking.', end: true },
    ] },
    ate: { who: 'stew', text: 'That\'s my brave little adventurer. Now go.', end: true },
  };

  // ─────────────────────────────── GHOST ───────────────────────────────
  D.ghost = {
    n0: { who: 'ghost', text: () => A.pick(['Boo. Sorry, force of habit. Welcome, living person.', 'I died in this tavern four hundred years ago. The ale was worth it.', 'I have seen a hundred heroes walk through those doors. You have better posture than most.']), choices: [
      { t: 'Tell me about the Tavern\'s past.', go: 'past' },
      { t: 'Class Trials?', go: 'trials' },
      { t: 'How do Team-Ups work?', go: 'teamups' },
      { t: 'Goodbye.', end: true },
    ] },
    past: { who: 'ghost', text: 'The Tavern was here before I was. Before Maren, even, and she has been here forever. Some nights I hear a loom clacking in the attic. There is no attic.', next: 'n0' },
    trials: { who: 'ghost', text: () => S().party.level >= 6 ? 'Each class has three Trials, one each at levels 6, 14 and 22. Every Trial is a tailored Rift with a Champion at its heart, and ends in that class\'s Legendary. Which calling will you test?' : 'Come back when your party is level 6. Trials are not for fresh faces.', choices: [
      ...['fighter', 'sorcerer', 'artificer', 'cleric', 'rogue', 'ranger'].map((c) => ({ t: () => A.trialLabel(c), if: () => A.trialAvailable(c), do: () => A.startTrial(c), end: true })),
      { t: 'Not yet.', go: 'n0' },
    ] },
    teamups: { who: 'ghost', text: () => `When two heroes use the right abilities close together, the combination creates something new. Fire and grenades. Smoke and arrows. Turrets and lightning. You have discovered ${S().teamups.length} of 14. Open the Journal [J] to see which.`, next: 'n0' },
  };

  // ─────────────────────────────── HOODED STRANGER ───────────────────────────────
  D.stranger = {
    n0: { who: 'stranger', text: () => [
      '...', 'Interesting. You go through the doors and you come back. Most don\'t.',
      'Two threads pulled free. Keep going, hero. I\'m right behind you.',
      'Three. Thank you. You\'ve led me straight to her.',
    ][Math.min(3, shards() + (S().flags.prologue ? 1 : 0))], choices: [
      { t: '[Arcana] Who are you?', check: { skill: 'arcana', dc: 15 }, go: 'arcana', fail: 'noarc' },
      { t: 'Leave.', end: true },
    ] },
    arcana: { who: 'stranger', text: 'You can see the loose threads on me, can\'t you. I am what\'s left when a story is forgotten. I am every realm that no one remembers. And I am so very hungry.', do: () => A.flag('stranger_known', 1), end: true },
    noarc: { who: 'stranger', text: 'Just a traveller. Enjoy your drink.', end: true },
  };

  // ─────────────────────────────── COMPANIONS (recruit) ───────────────────────────────
  const RECRUIT = {
    brunhild: ['You! You have the look of someone about to do something stupid and heroic. I\'m in. What\'s the plan? Hit it? I like that plan.', 'I once headbutted a dragon. Don\'t ask how. The dragon doesn\'t like to talk about it either.'],
    pip: ['OH! A hero! Are we going on an adventure? I LOVE adventures. Last time I turned a goblin into a teapot. By accident. Mostly.', 'My magic is a little... unpredictable. But that\'s the fun part! Probably!'],
    brassika: ['Your gear is held together with hope and string. Take me along and I\'ll build you a turret that shoots better turrets.', 'I also run the forge here. Bring me gear and gold and I\'ll make it sing.'],
    anselm: ['Peace be with you, friend. If you need a healer, I am at your service. I\'m told my puns are also a form of penance.', 'Why did the cleric refuse to fight the skeleton? It had no body to heal. ...I will see myself out. Unless you\'d like me along?'],
    vesper: ['Keep your hand on your coin purse. Or don\'t. It\'s more fun for me that way.', 'I woke up in this tavern with no name and six stolen rings. The doors might have answers. Mind if I tag along and rob the realm on the way?'],
    kestrel: ['...', '*Bramble the wolf sniffs your boots, then sits beside you.* ...He likes you. Fine. I\'ll come.'],
    ultradawn: ['Citizen! Captain Ultra-Dawn at your service! Retired, but justice never retires. Not really.', 'You saved my city when even I had forgotten it. Let me return the favour.'],
    k7: ['GREETINGS. I AM UNIT K-7. I HAVE CHOSEN YOU AS MY FRIEND. FRIENDSHIP PROTOCOL: ENGAGED.', 'PLEASE DO NOT RETURN ME TO THE ASTERION. THE CARETAKER WAS... CLINGY.'],
  };
  for (const [id, lines] of Object.entries(RECRUIT)) {
    D['comp_' + id] = {
      n0: { who: id, text: () => A.inParty(id) ? A.pick(A.companionChat(id)) : lines[0], choices: [
        { t: 'Join my party.', if: () => !A.inParty(id), do: () => A.recruit(id), go: 'joined' },
        { t: 'Tell me about yourself.', go: 'bio' },
        { t: 'Open the forge. (Upgrade gear)', if: () => id === 'brassika' || id === 'k7', do: () => A.openForge(), end: true },
        { t: 'Leave the party for now.', if: () => A.inParty(id), do: () => A.dismiss(id), go: 'left' },
        { t: 'Goodbye.', end: true },
      ] },
      bio: { who: id, text: () => lines[1] + '\n\n' + COMPANIONS[id].bio, next: 'n0' },
      joined: { who: id, text: () => A.partyFull() ? 'Looks like your party\'s full. Swap someone out with [P].' : 'Let\'s go make some stories.', end: true },
      left: { who: id, text: 'I\'ll be at the bar. Call on me whenever.', end: true },
    };
  }

  // ─────────────────────────────── EMBERWOOD ───────────────────────────────
  D.elowen = {
    n0: { who: 'elowen', text: () => S().realms.emberwood?.done ? 'The forest breathes again. Come back any time. There are always goblins.' : 'You came through the old door? Then Maren still remembers us. Good. Listen. The Hollow King has corrupted the three ley-stones that feed this forest. Every day, more trees forget how to be trees.', choices: [
      { t: 'How do we stop him?', go: 'how' },
      { t: '[Survival] Which stone is closest?', check: { skill: 'survival', dc: 10 }, go: 'surv', fail: 'how' },
      { t: 'Goodbye.', end: true },
    ] },
    how: { who: 'elowen', text: 'Cleanse the stones. Hold off whatever crawls out while the ley-light returns. Then his keep\'s wards will fall. Stand in the blue light of a cleansed stone and your magic will burn brighter.', do: () => A.advance('emberwood', 0), end: true },
    surv: { who: 'elowen', text: 'Good eye. North-east, past the birches. My markers will guide you. Here, take these arrows for the road. (+50 gold)', do: () => { A.gold(50); A.advance('emberwood', 0); }, end: true },
  };
  D.memory_emberwood = {
    n0: { who: 'narrator', text: 'The Hollow King crumbles. In his crown, a thread of light: a LOOM-SHARD.', next: 'n1' },
    n1: { who: 'narrator', text: 'MEMORY: A vast loom in the dark. A woman with silver hair ties the first knot, and a young king kneels, swearing to guard this realm\'s thread forever. He kept his oath long after everyone forgot why.', next: 'n2' },
    n2: { who: 'narrator', text: 'The woman looks up, straight at you. She has Maren\'s eyes.', end: true },
  };
  // ─────────────────────────────── NEON ───────────────────────────────
  D.spark = {
    n0: { who: 'spark', text: () => S().realms.neon?.done ? 'The city remembers its heroes again. Ultra-Dawn is at your tavern, right? Tell the old man I said hi.' : 'Are you... a new hero? Nobody remembers the heroes any more. NULL is erasing them from the city\'s memory, one headline at a time. My old boss, Captain Ultra-Dawn, just disappeared from every photo.', choices: [
      { t: 'What do we do?', go: 'plan' },
      { t: '[Tech] Can we track the erasure signal?', check: { skill: 'tech', dc: 12 }, go: 'tech', fail: 'plan' },
    ] },
    plan: { who: 'spark', text: 'Civilians are trapped all over the city. Rescue them. NULL has Memory Erasers on the rooftops. Use the jump pads (the glowing cyan squares) to get up there and smash them. Then NULL will have to come out and face you.', do: () => A.advance('neon', 0), end: true },
    tech: { who: 'spark', text: 'Yes! Rigging it now... I\'ve marked every Eraser on your map, and I\'m sending you a little battery money. (+60 gold)', do: () => { A.gold(60); A.advance('neon', 0); }, end: true },
  };
  D.civilian = { n0: { who: 'civilian', text: () => A.pick(['Thank you! I thought I\'d be forgotten forever!', 'You\'re a real hero! Wait. What\'s your name? I want to remember it.', 'My cat is still up there somewhere. ...Never mind, go save the city!']), end: true } };
  D.memory_neon = {
    n0: { who: 'narrator', text: 'NULL\'s mask cracks. Behind it: nothing, just a blank page. A LOOM-SHARD flutters out like a headline.', next: 'n1' },
    n1: { who: 'narrator', text: 'MEMORY: A newspaper from the city archive. "WEAVER VANISHES. Mysterious guardian of the Meridian erased from all records, apparently by her own hand." The photo is blurred, but the silver hair isn\'t.', end: true },
  };
  // ─────────────────────────────── ASTERION ───────────────────────────────
  D.pell = {
    n0: { who: 'pell', text: () => S().realms.asterion?.done ? 'The crew is waking up. Real sleep this time, not the CARETAKER\'s kind. Thank you.' : 'Oh thank god, a living person. The CARETAKER put the whole crew in "wellness sleep" and it\'s rewriting them into husks. It\'s trying to keep us safe forever.', choices: [
      { t: 'How do we shut it down?', go: 'how' },
      { t: '[Tech] Can I override it?', check: { skill: 'tech', dc: 14 }, go: 'tech', fail: 'how' },
    ] },
    how: { who: 'pell', text: 'Bring the three power terminals back online. The core door will open, and you can pull its plug. Careful in the breached sections, the gravity\'s gone light. You can jump a LOT higher.', do: () => A.advance('asterion', 0), end: true },
    tech: { who: 'pell', text: 'You know ship code? Okay, I\'ve patched you into the terminals. Hacking will go faster. Here, crew hazard pay. (+60 gold)', do: () => { A.gold(60); A.flag('fasthack', 1); A.advance('asterion', 0); }, end: true },
  };
  D.memory_asterion = {
    n0: { who: 'narrator', text: 'CARETAKER powers down. Its final log plays over the speakers.', next: 'n1' },
    n1: { who: 'narrator', text: '"PASSENGER MANIFEST: 1 PASSENGER. DESIGNATION: THE WEAVER. CARGO: THE KNOT. DESTINATION: THE BETWEEN. INSTRUCTION FROM PASSENGER: FORGET ME." ...A LOOM-SHARD floats from the core.', end: true },
  };
  // ─────────────────────────────── FINALE ───────────────────────────────
  D.ending = {
    n0: { who: 'narrator', text: 'The Unraveller comes apart like a sweater caught on a nail. What is left is a frayed, trembling knot, the knot that holds every realm together.', next: 'n1' },
    n1: { who: 'maren', text: 'It needs to be re-tied. But a knot like this needs a thread to anchor it. Someone has to become part of it. I can do it. I was always meant to.', choices: [
      { t: 'I\'ll do it. Let me be the anchor. (The Forgotten Hero)', go: 'hero' },
      { t: 'Sever it. Let the realms drift apart, safe and alone. (The Severance)', go: 'sever' },
      { t: '[Persuasion] We weave it together. Two threads are stronger. (The Weaver\'s Heir)', check: { skill: 'persuasion', dc: 15 }, go: 'heir', fail: 'heir_fail' },
      { t: '[Arcana] I can see a third way through the pattern.', check: { skill: 'arcana', dc: 15 }, go: 'heir', fail: 'heir_fail' },
    ] },
    heir_fail: { who: 'maren', text: 'I... I want to believe that. But the pattern won\'t take two, not like this. Choose, hero.', next: 'n1' },
    hero: { who: 'narrator', text: 'You step into the knot. Every realm is saved, and every realm forgets you. Except one tavern, where an old barkeep pours a drink for an empty seat every night, and never knows why she cries.', do: () => A.ending('hero'), end: true },
    sever: { who: 'narrator', text: 'You cut the threads. The realms drift apart like lanterns on a river, safe and unreachable. The doors in the Tavern go dark one by one. Maren smiles. "Quiet at last." But the Rifts... the Rifts remain.', do: () => A.ending('sever'), end: true },
    heir: { who: 'narrator', text: 'You take Maren\'s hand, and together you tie a knot nothing can undo. She remembers everything. So do you. The Hearth Between is open for business, with two Weavers behind the bar.', do: () => A.ending('heir'), end: true },
  };
  return D;
}
