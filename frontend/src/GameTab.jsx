import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// CRISIS ON INFINITE WEDNESDAYS — a choose-your-own-adventure
// through the DC multiverse. Pure frontend, no API calls.
// Endings found are remembered per-browser in localStorage.
// ─────────────────────────────────────────────────────────────

const START = { hp: 3, time: 13, hope: 0, items: [], allies: [], flags: [] }
const ENDINGS_KEY = 'excelsior_dcu_endings'

const ITEMS = {
  ring:        { icon: '💍', name: 'Green Lantern Ring' },
  motherbox:   { icon: '📦', name: 'Mother Box' },
  sandwich:    { icon: '🥪', name: 'Suspicious Sandwich' },
  fourthwall:  { icon: '👁️', name: 'Fourth-Wall Awareness' },
  backwards:   { icon: '🔄', name: 'The Backwards Trick' },
  contingency: { icon: '📋', name: 'Laminated Contingency' },
  jokercard:   { icon: '🃏', name: 'PUNCHLINE Card' },
  lasso:       { icon: '✨', name: 'Lasso of Truth' },
  gsptlsnz:    { icon: '☎️', name: "Mxy's Ex's Phone Number" },
}
const ALLIES = {
  batman: 'Batman', harley: 'Harley Quinn', joker: 'the Joker (regrettably)',
  wonderwoman: 'Wonder Woman', league: 'the entire Justice League',
}

const has = (s, item) => s.items.includes(item)
const ally = (s, a) => s.allies.includes(a)
const flag = (s, f) => s.flags.includes(f)
const alliesLine = s => s.allies.length
  ? `By your side: ${s.allies.map(a => ALLIES[a]).join(', ')}.`
  : 'You are, notably, alone.'
const souvenir = s => has(s, 'ring') ? 'a power ring' : has(s, 'motherbox') ? 'a Mother Box' : 'half a sandwich'

// ── Scenes ───────────────────────────────────────────────────
// choice: { label, to | random[] | roll{stat,dc,pass,fail}, time (default 1), fx, req(s), lock }
// scene:  { title, sfx, text (string | fn), fx (applied on enter), choices, ending{name,tone} }
const SCENES = {
  start: {
    title: 'Wednesday. New Comic Day.', sfx: 'KRA-KOOOM!',
    text: `You're working the register at Nth Dimension Comics in downtown Metropolis when the sky tears open like a polybag. Through the rip you can see a thousand Earths stacked like back issues — and every one of them is screaming.

A tiny purple man in a bowler hat pops into existence on top of the pull-list box.

"Name's Mxyzptlk! The multiverse folds shut in thirteen minutes. League's busy, Titans are on spring break, so congratulations — you're the protagonist now! Grab a souvenir. Choose wisely. Or don't! That's funnier."`,
    choices: [
      { label: 'Grab the glowing green ring from the bargain bin', to: 'ring', fx: { item: 'ring' } },
      { label: 'Grab the humming Mother Box glued to the New Gods diorama', to: 'boomtube', fx: { item: 'motherbox' } },
      { label: 'Grab the half-eaten sandwich next to the register', to: 'sandwich', fx: { item: 'sandwich' } },
    ],
  },

  ring: {
    title: 'In Brightest Day…', sfx: 'VWOOOM',
    text: `The ring slides onto your finger and speaks in the voice of a disappointed substitute teacher: "User. You have the ability to overcome great fear. Mostly of phone calls. Provisional Lantern status granted."

You lift off. You immediately hit a pigeon. The pigeon is fine. Your dignity is not.`,
    choices: [
      { label: 'Fly to Gotham and recruit the Batman', to: 'gotham' },
      { label: 'Test your powers: construct a giant green hamster wheel', to: 'hamster' },
      { label: "Fly straight into the crack in the sky. Heroes don't plan.", to: 'rift', time: 2, fx: { hope: 1 } },
    ],
  },

  boomtube: {
    title: 'Boom Tube Roulette', sfx: 'BOOM!',
    text: `The Mother Box chirps. You don't speak Mother Box, but it sounds exactly like a GPS asking for a destination, passive-aggressively.

A swirling tunnel of light opens in the middle of the manga aisle. A customer looks up from a volume of One Piece, shrugs, and keeps reading.`,
    choices: [
      { label: 'Say "Themyscira!" very confidently', to: 'themyscira' },
      { label: 'Say "Apokolips!" because honestly you\'ve always wondered', to: 'apokolips' },
      { label: '🎲 Let the Mother Box decide', random: ['gotham', 'apokolips', 'themyscira', 'watchtower', 'speedforce'] },
    ],
  },

  sandwich: {
    title: 'The Sandwich', sfx: 'CHOMP.',
    fx: { item: 'fourthwall' },
    text: `Mxyzptlk gasps. "The SANDWICH? Oh, I like you."

You take a bite. Ham and swiss and… something else. Something that tastes like narrative structure. Suddenly you can see thin black rectangles around everything. Gutters. Caption boxes. A faint glow at the edge of your vision — like someone is watching you through a screen.

You have gained: FOURTH-WALL AWARENESS.`,
    choices: [
      { label: "Wave at whoever's reading this", to: 'reader_wave', fx: { hope: 1 } },
      { label: 'Ask Mxyzptlk for a lift to Gotham', to: 'gotham' },
      { label: 'Demand he take you to the crack in the sky', to: 'rift' },
    ],
  },

  reader_wave: {
    title: 'Hi.', sfx: '*click*',
    text: `You wave. Nothing happens. Then… something does. A single, distant click. The sound of a choice being made.

"Ohhh no," says Mxyzptlk, sweating through his bowler. "Nobody's supposed to know about THEM."

He panics and snaps his fingers. You file this away for later. It feels important.`,
    choices: [
      { label: 'Materialize at the Justice League Watchtower', to: 'watchtower' },
      { label: 'Materialize on a Gotham rooftop', to: 'gotham' },
    ],
  },

  hamster: {
    title: 'Construct Training', sfx: 'SQUEAK',
    text: `You concentrate. A forty-foot emerald hamster wheel materializes over Centennial Park, complete with a hamster. You did not intend the hamster. The hamster looks at you with ancient, knowing eyes.

It begins to run. The wheel spins. Every light in Metropolis flickers to 200%.`,
    choices: [
      { label: 'Get in the wheel with the hamster. Run. Forever.', to: 'ending_hamster' },
      { label: 'Ask the hamster for advice', to: 'hamster_advice' },
      { label: 'Thank the hamster and fly to Gotham', to: 'gotham', fx: { hope: 1 } },
    ],
  },

  hamster_advice: {
    title: 'The Hamster Speaks', sfx: 'squeak squeak squeak',
    fx: { item: 'backwards' },
    text: `The hamster squeaks three times. The ring translates: "The imp IS the crack. Make him say his name backwards."

The hamster then eats its own construct and vanishes. You will never understand what just happened, and that's okay.`,
    choices: [
      { label: 'Fly to Gotham for backup', to: 'gotham' },
      { label: 'Fly straight to the crack', to: 'rift' },
    ],
  },

  gotham: {
    title: 'Gotham City. Obviously Raining.', sfx: 'FWOOSH',
    text: s => `You find Batman crouched on a gargoyle, because of course. He doesn't turn around.

"No."

"I haven't asked anything yet—"

"You're going to ask me to help stop the multiverse from collapsing. You have ${souvenir(s)} and roughly eleven minutes of experience. No."`,
    choices: [
      { label: 'Give an inspiring speech', roll: { stat: 'hope', dc: 13, pass: 'gotham_yes', fail: 'gotham_no' } },
      { label: 'Show him the Mother Box. He\'s always wanted one.', to: 'gotham_yes', req: s => has(s, 'motherbox'), lock: 'Mother Box' },
      { label: "Point out he's losing the reader's attention", to: 'gotham_yes', req: s => has(s, 'fourthwall'), lock: '???' },
      { label: 'Steal the Batmobile while he broods', to: 'batmobile', fx: { hope: -2 } },
    ],
  },

  gotham_yes: {
    title: 'The Bat Is In', sfx: 'SIGH.',
    fx: { ally: 'batman', item: 'contingency' },
    text: `Batman sighs the sigh of a man who has already calculated every outcome.

"Fine. But I'm driving. And I have a contingency plan for Mxyzptlk."

"Of course you do."

"It's laminated."`,
    choices: [
      { label: 'Head up to the Watchtower', to: 'watchtower' },
      { label: 'Go straight to the rift', to: 'rift' },
    ],
  },

  gotham_no: {
    title: 'Wrong Company', sfx: 'BONK!',
    fx: { hp: -1, time: -1 },
    text: `Your speech includes the phrase "with great power comes great—" and Batman cuts you off.

"Wrong publisher."

A batarang bonks you square in the forehead. When you wake up he's gone, and so is a minute you really needed.`,
    choices: [
      { label: 'Steal the Batmobile out of spite', to: 'batmobile', fx: { hope: -2 } },
      { label: 'Limp to Arkham to find a less picky ally', to: 'arkham' },
    ],
  },

  batmobile: {
    title: 'Nice Car.', sfx: 'VRRRRROOOM',
    text: `The Batmobile recognizes you are not Batman and speaks in a calm voice: "Unauthorized driver. Initiating countermeasures."

You hit a button labeled EJECT. It is not eject. It's Bat-Shark Repellent, and now the car smells like a Red Lobster. You hit the button next to it. That one's eject.

You arc gracefully over Gotham and land, somehow, directly in the courtyard of Arkham Asylum.`,
    choices: [{ label: 'Oh no.', to: 'arkham' }],
  },

  arkham: {
    title: 'Arkham Asylum', sfx: 'HA HA HA!',
    text: `Every light in Arkham is flickering in time with the crack in the sky. In the rec room, the Joker is watching the multiverse collapse on a TV that isn't plugged in.

"Oh, a NEW one!" he says. "You look like someone who's never had a bad day. Want one? Free trial!"

In the next cell, Harley Quinn is doing a crossword. "Don't listen ta him, hon. Hey — what's a nine-letter word for 'cosmic imp'?"`,
    choices: [
      { label: 'Team up with the Joker. Fight chaos with chaos.', to: 'joker_deal', fx: { hope: -3 } },
      { label: 'Help Harley with the crossword', roll: { stat: 'hope', dc: 10, pass: 'harley_join', fail: 'harley_fail' } },
      { label: 'Run before anyone notices you', to: 'rift', time: 2 },
    ],
  },

  joker_deal: {
    title: 'Partners!', sfx: 'BZZZT!',
    fx: { ally: 'joker', item: 'jokercard' },
    text: `The Joker shakes your hand. It buzzes. Joy buzzer. Of course.

"PARTNERS!" he shrieks, pressing a playing card into your palm. "When you meet the little purple fella, play THIS. Trust me. I'm a professional."

The card is blank except for a single word: PUNCHLINE.`,
    choices: [
      { label: "Ride the Joker's stolen ice-cream truck to the rift", to: 'rift' },
      { label: 'Crash the Watchtower first (the Joker insists)', to: 'watchtower' },
    ],
  },

  harley_join: {
    title: 'Road Trip!', sfx: 'WHAM!',
    fx: { ally: 'harley', item: 'backwards' },
    text: `"MXYZPTLK!" you shout. Nine letters.

Harley gasps. "Ya genius! Y'know, the trick with that guy is ya gotta make him say his name backwards. Everybody knows that."

She kicks her cell door open — it was never locked — and hoists a mallet onto her shoulder. "Road trip!"`,
    choices: [
      { label: 'Take the Harley-mobile (a shopping cart) to the rift', to: 'rift' },
      { label: 'Stop by the Watchtower for snacks', to: 'watchtower' },
    ],
  },

  harley_fail: {
    title: 'Ten Letters. All Wrong.', sfx: 'WHOOPS',
    fx: { hope: -1, time: -1 },
    text: `"MAXYZPLIK?"

Harley winces. "Hon, that's ten letters and none of 'em are right."

Behind you, the Joker has escaped. He's pretty sure it's because of you. The multiverse gets very slightly worse.`,
    choices: [
      { label: 'Flee to the Watchtower', to: 'watchtower' },
      { label: 'Flee to the rift', to: 'rift' },
    ],
  },

  themyscira: {
    title: 'Paradise Island', sfx: 'SHAAANG!',
    text: `You tumble out of the Boom Tube onto white sand and directly into the path of a spear. Wonder Woman catches it an inch from your nose.

"Man's World sends us… a cashier?" says Diana, not unkindly. "The Amazons will aid you — if you pass a trial."`,
    choices: [
      { label: 'Trial of Strength: arm-wrestle an Amazon', roll: { stat: 'hp', dc: 16, pass: 'themy_win', fail: 'themy_lose' } },
      { label: 'Trial of Truth: hold the Lasso and say what you really want', to: 'lasso_truth' },
      { label: 'Trial of Snacks: offer her your sandwich', to: 'themy_sandwich', req: s => has(s, 'sandwich'), lock: 'Suspicious Sandwich' },
    ],
  },

  lasso_truth: {
    title: 'The Honest Answer', sfx: 'GLOOOW',
    fx: { item: 'lasso', ally: 'wonderwoman', hope: 2 },
    text: `The Lasso glows gold. You open your mouth to say something noble. What comes out is:

"I want the multiverse to survive mostly so I can find out how my pull list ends."

Silence. Then Diana laughs, loud and warm. "An honest answer! That is rarer than courage." She presses a coil of golden rope into your hands.`,
    choices: [
      { label: 'Take the Invisible Jet to the Watchtower', to: 'watchtower' },
      { label: 'Take the Invisible Jet straight to the rift', to: 'rift' },
    ],
  },

  themy_win: {
    title: 'Impossible Victory', sfx: 'SLAM!',
    fx: { ally: 'wonderwoman', hope: 1 },
    text: `Somehow — SOMEHOW — you win.

The Amazon you beat insists it's because she was laughing at your face. She's probably right. Diana grants you her sword arm and a very firm handshake.`,
    choices: [
      { label: 'Take the Invisible Jet to the Watchtower', to: 'watchtower' },
      { label: 'Take the Invisible Jet straight to the rift', to: 'rift' },
    ],
  },

  themy_lose: {
    title: 'Crunch', sfx: 'CRACK',
    fx: { hp: -1 },
    text: `Your arm makes a noise arms shouldn't make.

The Amazons are extremely nice about it. They bandage you, feed you grapes, and gently place you back in the Boom Tube like a returned library book.`,
    choices: [
      { label: 'Ride the Boom Tube wherever it goes', random: ['watchtower', 'apokolips', 'speedforce'] },
    ],
  },

  themy_sandwich: {
    title: 'Narrative Structure', sfx: 'munch',
    fx: { item: 'lasso', ally: 'wonderwoman' },
    text: `Diana takes a bite. Her eyes widen.

"This sandwich… contains narrative structure." She looks directly at you — no. Past you. At THEM. "I see. We are all in a story."

She hands you the Lasso of Truth. "Use this on the imp. Truth undoes all tricks."`,
    choices: [
      { label: 'Take the Invisible Jet to the Watchtower', to: 'watchtower' },
      { label: 'Take the Invisible Jet straight to the rift', to: 'rift' },
    ],
  },

  apokolips: {
    title: 'Apokolips', sfx: 'DOOOOOM',
    text: `Fire pits. Parademons. The smell of a thousand burnt Hot Pockets. At the end of a long hall of screaming statues sits Darkseid, who looks at you the way you look at a bug that has somehow learned to use a Mother Box.

"YOU ARE IN THE PRESENCE OF DARKSEID."

"Yeah, I— yeah. I figured."`,
    choices: [
      { label: 'Challenge Darkseid to a staring contest', roll: { stat: null, dc: 19, pass: 'ending_darkseid', fail: 'apok_stare_fail' } },
      { label: 'Ask Granny Goodness for directions', to: 'granny' },
      { label: '🎲 Mash every button on the Mother Box', random: ['rift', 'themyscira', 'speedforce', 'gotham'] },
    ],
  },

  apok_stare_fail: {
    title: 'Darkseid Is (Not Blinking)', sfx: 'ZZARRKK!',
    fx: { hp: -2 },
    text: `You blink. Darkseid does not. Darkseid has never blinked.

His Omega Beams casually bounce you around the throne room like a pinball of regret.

"LEAVE," he rumbles. "YOU ARE BORING DARKSEID."`,
    choices: [{ label: 'Crawl back into the Boom Tube', to: 'rift' }],
  },

  granny: {
    title: 'Granny Knows Best', sfx: 'PINCH',
    fx: { item: 'backwards' },
    text: `Granny Goodness pinches your cheek hard enough to leave a bruise.

"Such a sweet little lost soldier! The crack in the sky? That's that dreadful Fifth-Dimensional brat. Everyone knows you beat him by making him say his name backwards, dearie.

"Now. Would you like to join the Female Furies? We have an excellent dental plan."`,
    choices: [
      { label: 'Politely decline and Boom Tube to the rift', to: 'rift' },
      { label: 'Join the Furies. That dental plan, though…', to: 'ending_furies' },
    ],
  },

  watchtower: {
    title: 'The Watchtower', sfx: 'BZZT',
    text: s => `The Justice League is in full crisis mode, which means arguing. Green Arrow is yelling at Hawkman. Aquaman is explaining that this wouldn't happen underwater. Cyborg is trying to reboot reality with a USB stick.

${alliesLine(s)}

In the corner, humming faintly, is the Flash's Cosmic Treadmill. Next to it: a big red button labeled DO NOT PRESS.`,
    choices: [
      { label: 'Take charge of the League (allies help!)', roll: { stat: 'lead', dc: 14, pass: 'league_follow', fail: 'league_ignore' }, req: s => !ally(s, 'league'), lock: 'already done' },
      { label: 'Hop on the Cosmic Treadmill', to: 'speedforce' },
      { label: 'Press the big red button', to: 'red_button', req: s => !has(s, 'gsptlsnz'), lock: 'already pressed' },
    ],
  },

  league_follow: {
    title: 'EVERYBODY SHUT UP', sfx: '!!!',
    fx: { ally: 'league', hope: 2 },
    text: `You climb onto the table. "EVERYBODY SHUT UP."

They do. It's the most shocked anyone's been since the Death of Superman. You explain the plan. You do not have a plan. It doesn't matter.

Superman nods slowly. "I believe in you." You would die for this man.`,
    choices: [
      { label: 'Lead the Justice League into the rift', to: 'rift' },
      { label: 'Quick stop at the Cosmic Treadmill first', to: 'speedforce' },
    ],
  },

  league_ignore: {
    title: 'Um.', sfx: 'thwack',
    fx: { hp: -1 },
    text: `You climb onto the table and say "Um."

Aquaman is still talking about underwater. Hawkman gestures wildly and accidentally maces you in the shin. Nobody notices.`,
    choices: [
      { label: 'Hop on the Cosmic Treadmill', to: 'speedforce' },
      { label: 'Press the big red button', to: 'red_button', req: s => !has(s, 'gsptlsnz'), lock: 'already pressed' },
      { label: 'Go to the rift alone', to: 'rift' },
    ],
  },

  red_button: {
    title: 'You Pressed It', sfx: 'WEEOOWEEOO',
    fx: { item: 'gsptlsnz' },
    text: `Every alarm in the Watchtower goes off at once — and then, silence.

A small hatch opens. Inside is a note in Batman's handwriting: "I knew someone would press this. Here is the phone number for Mxyzptlk's ex-girlfriend."

You call it. Ms. Gsptlsnz picks up on the first ring. She has a LOT to say about him.`,
    choices: [{ label: 'Save the number and head for the rift', to: 'rift' }],
  },

  speedforce: {
    title: 'The Speed Force', sfx: 'ZOOOOOM',
    text: `The Treadmill kicks on and the world smears into lightning. Barry Allen jogs up beside you, looking concerned.

"Hey! Hi! Quick question: did you just change the timeline? Because every time someone runs on that thing I wake up with a different mustache."`,
    choices: [
      { label: 'Run backwards in time to buy more minutes', to: 'rewind', time: 0, fx: { time: 5, hope: -2, flag: 'rewound' }, req: s => !flag(s, 'rewound'), lock: 'only once' },
      { label: 'Run forward and peek at the ending', to: 'peek' },
      { label: 'Run so fast you arrive at the rift before you left', to: 'rift', time: 0 },
    ],
  },

  rewind: {
    title: 'Last Tuesday', sfx: 'ZIIIP',
    text: `You run backwards so hard that Wednesday briefly becomes Tuesday.

Barry facepalms. "Great. Now there's a universe where Superman has a mullet. AGAIN." But you've bought yourself time. Probably at the cost of someone's continuity.`,
    choices: [
      { label: 'Sprint to the rift', to: 'rift' },
      { label: 'Go back to the Watchtower', to: 'watchtower' },
    ],
  },

  peek: {
    title: 'Spoilers', sfx: 'FLASH',
    fx: { item: 'backwards' },
    text: `You glimpse the end: a purple imp laughing, a thousand Earths folding like paper. And in the corner of the vision, something small — his lips moving, saying his own name.

Backwards.

"SPOILERS!" Barry yells, and shoves you out of the Speed Force.`,
    choices: [{ label: 'Tumble toward the rift', to: 'rift' }],
  },

  rift: {
    title: 'The Crack in Everything', sfx: 'KRRRZZZT',
    text: s => `The heart of the crack is a hallway of shattered panels, each one a different Earth. Earth-3's Crime Syndicate screaming. Earth-C's funny animals running in circles. Earth-22, painted in impossible gouache, crumbling at the edges.

On a throne of collapsed continuity sits Mxyzptlk — giant now, his bowler hat the size of a moon.

"YOU MADE IT! Ha! Bet you thought I was the helpful guide. Nope! I'm the villain! I got BORED, kid. Same stories, same crossovers, over and over. So I'm folding it all up and starting fresh!"

${alliesLine(s)}`,
    choices: [
      { label: 'Punch him. Really hard.', roll: { stat: 'hp', dc: 15, pass: 'ending_brawl', fail: 'rift_punch_fail' } },
      { label: 'Trick him into saying his name backwards', roll: { stat: 'hope', dc: 11, pass: 'ending_trick', fail: 'rift_trick_fail' }, req: s => has(s, 'backwards'), lock: 'The Backwards Trick' },
      { label: 'Wrap him in the Lasso of Truth', to: 'ending_lonely', req: s => has(s, 'lasso'), lock: 'Lasso of Truth' },
      { label: 'Call Ms. Gsptlsnz on speakerphone', to: 'ending_ex', req: s => has(s, 'gsptlsnz'), lock: "Mxy's Ex's Phone Number" },
      { label: "Play the Joker's PUNCHLINE card", to: 'ending_punchline', req: s => has(s, 'jokercard'), lock: 'PUNCHLINE Card' },
      { label: "Unfold Batman's laminated contingency", to: 'ending_batman', req: s => has(s, 'contingency'), lock: 'Laminated Contingency' },
      { label: 'Signal the entire Justice League to charge', to: 'ending_hero', req: s => ally(s, 'league'), lock: 'Justice League' },
      { label: 'Turn to the reader and ask for help', to: 'ending_reader', req: s => has(s, 'fourthwall'), lock: '???' },
      { label: 'Join him. Honestly, a reboot sounds kinda fun.', to: 'ending_reboot' },
    ],
  },

  rift_punch_fail: {
    title: 'Fifth-Dimensional Physics', sfx: 'WHIFF',
    fx: { hp: -2 },
    text: `Your fist goes straight through him, like punching a hologram of a bad idea.

He giggles and turns you into a Silver Age dog for thirty seconds. It is humiliating. You have fleas now.`,
    choices: [{ label: 'Get back up', to: 'rift' }],
  },

  rift_trick_fail: {
    title: 'Nice Try!', sfx: 'POOF',
    fx: { hp: -1 },
    text: `"Hey Mxy, bet you can't say your name backwards!"

"Ohoho, NICE try! Nobody falls for that anymore!" He snaps his fingers and your head is briefly a pumpkin. Then a Jack-o'-lantern. Then a pumpkin again. He's just having fun now.`,
    choices: [{ label: 'Shake it off (and the seeds)', to: 'rift' }],
  },

  // ── ENDINGS ──
  ending_hero: {
    ending: { name: 'EXCELSIOR!', tone: 'good' }, title: 'Crisis Averted', sfx: 'EXCELSIOR!',
    text: `The League hits him all at once — Superman's heat vision, Diana's bracelets, Flash vibrating through his hat, Aquaman explaining that this would work better underwater.

Mxyzptlk is so overwhelmed by sheer teamwork he forgets his own name, tries to remember it, and says it backwards by accident. POP.

The multiverse snaps back into shape. Superman shakes your hand. The Watchtower offers you a membership card. You go back to the comic shop, because it's still Wednesday, and you have a pull list to process.`,
  },
  ending_trick: {
    ending: { name: 'Kltpzyxm!', tone: 'good' }, title: 'The Oldest Trick', sfx: 'KLTPZYXM!',
    text: `"Mxy, what's the name on your hat? It looks misspelled."

"What?! It's spelled PERFECTLY! It's K-L-T… oh. OH NO. Kltpzyxm—"

POP. He's gone, back to the Fifth Dimension for ninety days. The crack seals like a zip-lock bag. It is the oldest trick in the book, and the book is from 1944, and it still worked.`,
  },
  ending_lonely: {
    ending: { name: 'Wednesday Regular', tone: 'good' }, title: 'The Truth', sfx: 'GLOOOW',
    text: `The Lasso tightens and glows. Mxyzptlk's face crumples.

"I… I'm not bored. I'm LONELY. Everyone in the Fifth Dimension thinks Earth comics are for babies."

You unwind the lasso and do the only reasonable thing: invite him to Wednesday night trade-paperback club at the shop.

The multiverse unfolds. Every week now, a small purple man sits in the back row with a bag of chips and very strong opinions about Grant Morrison.`,
  },
  ending_ex: {
    ending: { name: "It's Complicated", tone: 'good' }, title: 'Speakerphone', sfx: 'RING RING',
    text: `"Mxy? It's Gsptlsnz. Are you ruining a multiverse AGAIN? Is this about me?"

The giant imp goes pale, then shrinks to regular size, then smaller. "Gsp! Heyyy. No. Totally unrelated. I was just— I'm gonna go."

POP. The crack seals instantly. Ms. Gsptlsnz thanks you for the call and asks if you're seeing anyone. You hang up.`,
  },
  ending_punchline: {
    ending: { name: 'Crisis on Infinite Punchlines', tone: 'weird' }, title: 'The Card', sfx: 'HA HA HA HA HA',
    text: `You flip the card. Mxyzptlk reads it. He stares. His lip trembles. Then he laughs so hard reality hiccups.

"THAT'S the funniest thing I've ever seen!" He and the Joker are best friends within the minute.

The multiverse is saved. Technically. Every Earth is now clown-themed. Superman's cape is a whoopee cushion. Batman has not smiled, and never will, but he's wearing a flower that squirts. You did this.`,
  },
  ending_batman: {
    ending: { name: 'Prep Time', tone: 'good' }, title: 'Contingency #4,471', sfx: 'OF COURSE.',
    text: `You unfold the laminated card. It reads, in Batman's tidy handwriting:

"Say: 'I bet the Fifth Dimension's smartest imp can't spell his own name backwards. Out loud. Right now.'"

You read it aloud. Mxyzptlk's pride kicks in. "Pfft! K-L-T-P-Z-Y-X-M! See? Easy! …Oh, come ON."

POP. Somewhere in Gotham, Batman lowers his binoculars and allows himself one single, microscopic nod.`,
  },
  ending_reader: {
    ending: { name: 'You Did This', tone: 'secret' }, title: 'The Fourth Wall', sfx: '…',
    text: `You turn, look straight out of the panel, and say: "Hey. You. I know you're there."

Mxyzptlk freezes. "Don't. Don't talk to them."

"They've been making every choice this whole time. They're the most powerful being in the multiverse. And they want this story to have a happy ending. Don't you?"

(You do.)

The crack seals because you — yes, you, holding the phone — decided it should. Mxyzptlk, deeply unsettled, leaves on his own. Thanks for reading. Seriously.`,
  },
  ending_reboot: {
    ending: { name: 'The New 52nd', tone: 'bad' }, title: 'Hard Reboot', sfx: 'CTRL+ALT+DEL',
    text: `"Wait, really?!" Mxyzptlk is delighted. He hands you a pencil made of pure retcon.

Together you fold up the whole multiverse and start again. In the new continuity, everyone has more pockets. Superman's origin has seventeen extra steps. You are now the main character of the flagship title, EXCELSIOR #1, with nine variant covers.

It gets cancelled after issue #6.`,
  },
  ending_brawl: {
    ending: { name: 'Knuckle Sandwich', tone: 'weird' }, title: 'That Actually Worked?', sfx: 'KA-POW!!',
    text: `You wind up and throw the single greatest punch in human history.

It should not work. He is a fifth-dimensional being. But he is SO surprised that anyone even tried that he falls off his throne laughing and forgets to hold the multiverse closed.

Everything springs back. Mxyzptlk rubs his jaw, tips his hat, and leaves you a sticky note: "Rematch Thursday."`,
  },
  ending_darkseid: {
    ending: { name: 'Darkseid Blinked', tone: 'weird' }, title: 'Impossible.', sfx: '…blink.',
    text: `Ten seconds. Thirty. Two minutes. Your eyes are drier than a Silver Age letters page.

And then… Darkseid blinks.

The throne room gasps. Parademons drop their weapons. By the laws of Apokolips, you are now its ruler. You spend your first day in charge converting the fire pits into a comic shop. Business is great. The multiverse? Metron fixes it off-panel. He seems annoyed about it.`,
  },
  ending_hamster: {
    ending: { name: 'Hamster Sector 2814', tone: 'weird' }, title: 'The Wheel Turns', sfx: 'SQUEAK SQUEAK SQUEAK',
    text: `You climb into the wheel beside the hamster. You run. It runs. Together you generate so much raw willpower that the crack in the sky simply… closes, out of politeness.

The Guardians of Oa hold an emergency meeting. There is no precedent. They make you and the hamster co-Lanterns of a brand-new sector.

You never stop running. You're happier than you've ever been.`,
  },
  ending_furies: {
    ending: { name: 'Fury Road', tone: 'weird' }, title: 'Welcome, Soldier', sfx: 'HUT! HUT!',
    text: `You join the Female Furies. The training is brutal, the uniforms are pointy, and the dental plan is genuinely incredible.

The multiverse, left unattended, collapses and then — somehow — gets fixed by a random Metropolis intern named Jimmy. You hear about it in the Apokolips newsletter. You don't mind. Your teeth have never looked better.`,
  },
  ending_dead: {
    ending: { name: 'See You Next Crossover', tone: 'bad' }, title: 'You Died', sfx: 'THE END?',
    text: `Everything goes dark. A white glove reaches down and a funeral panel is drawn around you. Superman gives a eulogy. It's very moving.

But this is comics. Nobody stays dead. You'll be back in about six months, probably with a new costume and a darker attitude.`,
  },
  ending_timeout: {
    ending: { name: 'Crisis Complete', tone: 'bad' }, title: 'Time\'s Up', sfx: 'FWUMP.',
    text: `The thirteenth minute ends. Every Earth folds in on itself like a sad origami crane.

For a moment there's nothing. Then, in a single white panel, a caption box appears: "REBIRTH."

Everything starts over. It's still Wednesday. You're behind the register. The sky looks… fine? You have the strangest feeling you've done this before.`,
  },
}

const ENDING_IDS = Object.keys(SCENES).filter(k => SCENES[k].ending)
const TONE = {
  good:   { color: 'var(--green)',  label: 'HEROIC ENDING' },
  weird:  { color: 'var(--yellow)', label: 'WEIRD ENDING' },
  bad:    { color: 'var(--red)',    label: 'BAD ENDING' },
  secret: { color: '#b36bff',       label: 'SECRET ENDING' },
}

function loadEndings() {
  try { return JSON.parse(localStorage.getItem(ENDINGS_KEY) || '[]') } catch { return [] }
}
function saveEndings(list) {
  try { localStorage.setItem(ENDINGS_KEY, JSON.stringify(list)) } catch { /* private mode — ignore */ }
}

function applyFx(s, fx = {}) {
  const n = { ...s, items: [...s.items], allies: [...s.allies], flags: [...s.flags] }
  if (fx.hp)   n.hp   = Math.min(5, n.hp + fx.hp)
  if (fx.time) n.time = n.time + fx.time
  if (fx.hope) n.hope = Math.max(-5, Math.min(5, n.hope + fx.hope))
  if (fx.item && !n.items.includes(fx.item)) n.items.push(fx.item)
  if (fx.ally && !n.allies.includes(fx.ally)) n.allies.push(fx.ally)
  if (fx.flag && !n.flags.includes(fx.flag)) n.flags.push(fx.flag)
  return n
}

function rollBonus(s, stat) {
  if (stat === 'hope') return s.hope
  if (stat === 'hp')   return s.hp
  if (stat === 'lead') return s.hope + s.allies.length * 2
  return 0
}
const STAT_LABEL = { hope: 'Hope', hp: 'Health', lead: 'Hope + 2/ally' }

// ── UI bits ──────────────────────────────────────────────────
const bc = "'Barlow Condensed', sans-serif"
const bangers = "'Bangers', cursive"

function Chip({ children, color = 'var(--mid)' }) {
  return (
    <span style={{ background: color, border: '1px solid var(--border)', borderRadius: '2px', padding: '0.2rem 0.45rem',
      fontFamily: bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--white)', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function Hud({ s }) {
  const hopePct = ((s.hope + 5) / 10) * 100
  return (
    <div style={{ background: 'var(--panel)', border: '2px solid var(--border)', padding: '0.75rem', marginBottom: '1rem', display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div aria-label={`Health ${s.hp}`} style={{ fontSize: '1rem', letterSpacing: '0.1em' }}>
          {Array.from({ length: Math.max(s.hp, 0) }, (_, i) => <span key={i}>❤️</span>)}
          {s.hp <= 0 && <span style={{ fontFamily: bc, color: 'var(--muted)' }}>💀</span>}
        </div>
        <div style={{ fontFamily: bangers, fontSize: '1.15rem', letterSpacing: '0.05em',
          color: s.time <= 3 ? 'var(--red)' : 'var(--yellow)', animation: s.time <= 3 ? 'bang 1s ease-in-out infinite' : 'none' }}>
          ⏱ {Math.max(s.time, 0)} MIN UNTIL COLLAPSE
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: bc, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.2rem' }}>
          <span>CHAOS</span><span>HOPE {s.hope > 0 ? `+${s.hope}` : s.hope}</span>
        </div>
        <div style={{ height: '8px', background: 'linear-gradient(90deg, var(--red), var(--mid) 50%, var(--blue))', borderRadius: '2px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-3px', left: `calc(${hopePct}% - 5px)`, width: '10px', height: '14px', background: 'var(--yellow)', border: '2px solid var(--ink)', transition: 'left 0.3s' }} />
        </div>
      </div>
      {(s.items.length > 0 || s.allies.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {s.items.map(i => <Chip key={i}>{ITEMS[i].icon} {ITEMS[i].name}</Chip>)}
          {s.allies.map(a => <Chip key={a} color="var(--blue)">🤝 {ALLIES[a]}</Chip>)}
        </div>
      )}
    </div>
  )
}

export default function GameTab({ isMobile }) {
  const [started, setStarted] = useState(false)
  const [s, setS] = useState({ ...START, scene: 'start' })
  const [lastRoll, setLastRoll] = useState(null)
  const [found, setFound] = useState(loadEndings)
  const [panelKey, setPanelKey] = useState(0)

  const scene = SCENES[s.scene]
  const isEnding = !!scene.ending

  useEffect(() => {
    if (isEnding && !found.includes(s.scene)) {
      const next = [...found, s.scene]
      setFound(next)
      saveEndings(next)
    }
  }, [s.scene])

  const goTo = (base, target) => {
    let n = applyFx(base, SCENES[target].fx)
    if (!SCENES[target].ending) {
      if (n.hp <= 0) target = 'ending_dead'
      else if (n.time <= 0) target = 'ending_timeout'
    }
    setS({ ...n, scene: target })
    setPanelKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const choose = c => {
    let n = applyFx(s, c.fx)
    n.time -= (c.time ?? 1)
    let target = c.to
    if (c.random) target = c.random[Math.floor(Math.random() * c.random.length)]
    if (c.roll) {
      const d = 1 + Math.floor(Math.random() * 20)
      const bonus = rollBonus(n, c.roll.stat)
      const total = d + bonus
      const ok = d === 20 || (d !== 1 && total >= c.roll.dc)
      setLastRoll({ d, bonus, total, dc: c.roll.dc, ok, crit: d === 20 ? 'NAT 20!' : d === 1 ? 'NAT 1!' : null })
      target = ok ? c.roll.pass : c.roll.fail
    } else {
      setLastRoll(null)
    }
    goTo(n, target)
  }

  const restart = () => {
    setS({ ...START, scene: 'start' })
    setLastRoll(null)
    setPanelKey(k => k + 1)
    setStarted(true)
  }

  const text = typeof scene.text === 'function' ? scene.text(s) : scene.text

  // ── Title screen ──
  if (!started) {
    return (
      <div className="anim-up" style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: 'var(--red)', border: '4px solid var(--ink)', boxShadow: '8px 8px 0 var(--yellow)',
          padding: isMobile ? '2rem 1.25rem' : '3rem 2rem', backgroundImage: 'var(--halftone)', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: bc, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.25em', color: 'var(--yellow)', marginBottom: '0.5rem' }}>
            AN EXCELSIOR! CHOOSE-YOUR-OWN-ADVENTURE
          </div>
          <h1 style={{ fontFamily: bangers, fontSize: isMobile ? '2.4rem' : '3.6rem', lineHeight: 0.95, color: 'var(--white)',
            textShadow: '4px 4px 0 var(--ink)', letterSpacing: '0.03em', margin: 0 }}>
            CRISIS ON INFINITE WEDNESDAYS
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: 1.6, marginTop: '1rem' }}>
            You're a comic-shop cashier. The multiverse collapses in 13 minutes. A fifth-dimensional imp has made you the protagonist.
            Recruit heroes, collect weird items, roll the dice — and find all {ENDING_IDS.length} endings.
          </p>
          <button onClick={restart} style={{ marginTop: '1.25rem', background: 'var(--yellow)', color: 'var(--ink)', border: '3px solid var(--ink)',
            boxShadow: '4px 4px 0 var(--ink)', fontFamily: bangers, fontSize: '1.5rem', letterSpacing: '0.06em', padding: '0.5rem 2rem', cursor: 'pointer' }}>
            {found.length ? 'PLAY AGAIN!' : 'START!'}
          </button>
        </div>
        <EndingGallery found={found} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {!isEnding && <Hud s={s} />}

      {lastRoll && (
        <div style={{ animation: 'popIn 0.35s ease', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', textAlign: 'center',
          background: lastRoll.ok ? 'var(--green)' : 'var(--red-dark)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)',
          fontFamily: bc, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.06em', color: 'var(--white)' }}>
          🎲 ROLLED {lastRoll.d}{lastRoll.bonus ? ` ${lastRoll.bonus > 0 ? '+' : '−'} ${Math.abs(lastRoll.bonus)}` : ''} = {lastRoll.total} vs DC {lastRoll.dc}
          {' — '}{lastRoll.crit ? `${lastRoll.crit} ` : ''}{lastRoll.ok ? 'SUCCESS!' : 'FAILURE!'}
        </div>
      )}

      <article key={panelKey} className="anim-up" style={{ background: '#f4ecd8', color: 'var(--ink)', border: '4px solid var(--ink)',
        boxShadow: `8px 8px 0 ${isEnding ? TONE[scene.ending.tone].color : 'var(--red)'}`, position: 'relative', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--yellow)', borderBottom: '3px solid var(--ink)', padding: '0.5rem 0.9rem',
          fontFamily: bangers, fontSize: isMobile ? '1.3rem' : '1.6rem', letterSpacing: '0.04em', lineHeight: 1.1 }}>
          {scene.title}
        </div>
        {scene.sfx && (
          <div aria-hidden style={{ position: 'absolute', top: isMobile ? '-0.9rem' : '-1.2rem', right: '0.75rem', transform: 'rotate(6deg)',
            fontFamily: bangers, fontSize: isMobile ? '1.4rem' : '1.9rem', color: 'var(--red)', background: 'var(--white)',
            border: '3px solid var(--ink)', padding: '0.1rem 0.6rem', boxShadow: '3px 3px 0 var(--ink)', animation: 'popIn 0.4s ease', maxWidth: '60%' }}>
            {scene.sfx}
          </div>
        )}
        <div style={{ padding: isMobile ? '1rem' : '1.4rem 1.6rem', fontSize: isMobile ? '0.95rem' : '1.02rem', lineHeight: 1.65 }}>
          {text.split('\n\n').map((p, i) => <p key={i} style={{ margin: i ? '0.9rem 0 0' : 0 }}>{p}</p>)}
        </div>
      </article>

      {!isEnding && (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {scene.choices.map((c, i) => {
            const locked = c.req && !c.req(s)
            return (
              <button key={i} disabled={locked} onClick={() => choose(c)} style={{
                textAlign: 'left', background: locked ? 'var(--panel)' : 'var(--mid)', color: locked ? 'var(--muted)' : 'var(--white)',
                border: `2px solid ${locked ? 'var(--border)' : 'var(--ink)'}`, boxShadow: locked ? 'none' : '4px 4px 0 var(--red)',
                padding: '0.75rem 0.9rem', cursor: locked ? 'not-allowed' : 'pointer', fontSize: '0.95rem', lineHeight: 1.4,
                display: 'flex', gap: '0.6rem', alignItems: 'baseline', justifyContent: 'flex-start', transition: 'transform 0.1s',
              }}
                onMouseEnter={e => { if (!locked) e.currentTarget.style.transform = 'translate(-2px,-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
                <span style={{ fontFamily: bangers, fontSize: '1.1rem', color: locked ? 'var(--muted)' : 'var(--yellow)', flexShrink: 0 }}>
                  {locked ? '🔒' : String.fromCharCode(65 + i)}
                </span>
                <span>
                  {locked ? (c.lock === '???' ? '??? (you lack a certain… awareness)' : `${c.label} — requires ${c.lock}`) : c.label}
                  {!locked && c.roll && (
                    <span style={{ display: 'block', fontFamily: bc, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--yellow)', marginTop: '0.2rem' }}>
                      🎲 d20{c.roll.stat ? ` + ${STAT_LABEL[c.roll.stat]} (${rollBonus(s, c.roll.stat) >= 0 ? '+' : ''}${rollBonus(s, c.roll.stat)})` : ''} vs DC {c.roll.dc}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {isEnding && (
        <div className="anim-up" style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: bc, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', color: TONE[scene.ending.tone].color }}>
            {TONE[scene.ending.tone].label}
          </div>
          <div style={{ fontFamily: bangers, fontSize: isMobile ? '2rem' : '2.6rem', color: 'var(--white)', textShadow: '3px 3px 0 var(--red)', margin: '0.2rem 0 0.4rem' }}>
            "{scene.ending.name}"
          </div>
          <div style={{ fontFamily: bc, fontSize: '0.8rem', color: 'var(--light)', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
            ENDINGS FOUND: {found.length} / {ENDING_IDS.length}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <button onClick={restart} style={{ background: 'var(--yellow)', color: 'var(--ink)', border: '3px solid var(--ink)', boxShadow: '4px 4px 0 var(--red)',
              fontFamily: bangers, fontSize: '1.3rem', letterSpacing: '0.05em', padding: '0.45rem 1.5rem', cursor: 'pointer' }}>
              REBOOT THE MULTIVERSE
            </button>
            <button onClick={() => setStarted(false)} style={{ background: 'var(--mid)', color: 'var(--white)', border: '2px solid var(--border)',
              fontFamily: bc, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', padding: '0.5rem 1.2rem', cursor: 'pointer' }}>
              TITLE SCREEN
            </button>
          </div>
          <EndingGallery found={found} />
        </div>
      )}
    </div>
  )
}

function EndingGallery({ found }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontFamily: bc, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--muted)', marginBottom: '0.5rem' }}>
        ENDING GALLERY — {found.length}/{ENDING_IDS.length}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
        {ENDING_IDS.map(id => {
          const got = found.includes(id)
          const e = SCENES[id].ending
          return (
            <div key={id} style={{ background: got ? 'var(--mid)' : 'var(--panel)', border: `2px solid ${got ? TONE[e.tone].color : 'var(--border)'}`,
              padding: '0.5rem 0.6rem', fontFamily: bc, fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.03em',
              color: got ? 'var(--white)' : 'var(--muted)' }}>
              {got ? e.name : '? ? ?'}
            </div>
          )
        })}
      </div>
    </div>
  )
}
