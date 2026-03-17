#!/usr/bin/env node
/**
 * Generate a 10,000-entry comic catalog seed with Open Library cover images.
 * Run: node generate-seed.js
 * Output: seed-catalog.json
 */

const fs = require('fs');
const path = require('path');

// ── Series definitions: real comic data ──────────────────────────────────────
// Each series: { title, publisher, writer, artist, issueRange, tags, era }
// issueRange: [start, end] or count of issues to generate
const SERIES = [
  // ═══ MARVEL ═══
  { title: 'The Amazing Spider-Man', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Steve Ditko', issues: [1, 100], tags: 'superhero', era: 'Silver Age' },
  { title: 'The Amazing Spider-Man', publisher: 'Marvel', writer: 'Gerry Conway', artist: 'Ross Andru', issues: [101, 200], tags: 'superhero', era: 'Bronze Age' },
  { title: 'The Amazing Spider-Man', publisher: 'Marvel', writer: 'Roger Stern', artist: 'John Romita Jr.', issues: [201, 300], tags: 'superhero', era: 'Modern Age' },
  { title: 'Uncanny X-Men', publisher: 'Marvel', writer: 'Chris Claremont', artist: 'Dave Cockrum', issues: [94, 143], tags: 'superhero,team-up', era: 'Bronze Age' },
  { title: 'Uncanny X-Men', publisher: 'Marvel', writer: 'Chris Claremont', artist: 'John Byrne', issues: [144, 200], tags: 'superhero,team-up', era: 'Bronze Age' },
  { title: 'Uncanny X-Men', publisher: 'Marvel', writer: 'Chris Claremont', artist: 'Marc Silvestri', issues: [201, 280], tags: 'superhero,team-up', era: 'Modern Age' },
  { title: 'X-Men', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Jack Kirby', issues: [1, 66], tags: 'superhero,team-up', era: 'Silver Age' },
  { title: 'The Invincible Iron Man', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Don Heck', issues: [1, 60], tags: 'superhero,sci-fi', era: 'Silver Age' },
  { title: 'The Invincible Iron Man', publisher: 'Marvel', writer: 'David Michelinie', artist: 'Bob Layton', issues: [116, 170], tags: 'superhero,sci-fi', era: 'Bronze Age' },
  { title: 'Captain America', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Jack Kirby', issues: [100, 160], tags: 'superhero,action', era: 'Silver Age' },
  { title: 'Captain America', publisher: 'Marvel', writer: 'Ed Brubaker', artist: 'Steve Epting', issues: [1, 50], tags: 'superhero,action,thriller', era: 'Contemporary', titleSuffix: ' (2005)' },
  { title: 'The Avengers', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Jack Kirby', issues: [1, 60], tags: 'superhero,team-up', era: 'Silver Age' },
  { title: 'The Avengers', publisher: 'Marvel', writer: 'Roy Thomas', artist: 'John Buscema', issues: [61, 130], tags: 'superhero,team-up', era: 'Bronze Age' },
  { title: 'New Avengers', publisher: 'Marvel', writer: 'Brian Michael Bendis', artist: 'David Finch', issues: [1, 64], tags: 'superhero,team-up', era: 'Contemporary' },
  { title: 'Thor', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Jack Kirby', issues: [126, 200], tags: 'superhero,fantasy', era: 'Silver Age' },
  { title: 'Thor', publisher: 'Marvel', writer: 'Jason Aaron', artist: 'Russell Dauterman', issues: [1, 25], tags: 'superhero,fantasy', era: 'Contemporary', titleSuffix: ' (2014)' },
  { title: 'The Mighty Thor', publisher: 'Marvel', writer: 'Walt Simonson', artist: 'Walt Simonson', issues: [337, 382], tags: 'superhero,fantasy', era: 'Modern Age' },
  { title: 'Fantastic Four', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Jack Kirby', issues: [1, 102], tags: 'superhero,sci-fi,team-up', era: 'Silver Age' },
  { title: 'Fantastic Four', publisher: 'Marvel', writer: 'John Byrne', artist: 'John Byrne', issues: [232, 293], tags: 'superhero,sci-fi,team-up', era: 'Modern Age' },
  { title: 'Daredevil', publisher: 'Marvel', writer: 'Frank Miller', artist: 'Frank Miller', issues: [168, 191], tags: 'superhero,noir,crime', era: 'Modern Age' },
  { title: 'Daredevil', publisher: 'Marvel', writer: 'Brian Michael Bendis', artist: 'Alex Maleev', issues: [26, 81], tags: 'superhero,noir,crime', era: 'Contemporary' },
  { title: 'The Incredible Hulk', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Jack Kirby', issues: [1, 6], tags: 'superhero,sci-fi', era: 'Silver Age' },
  { title: 'The Incredible Hulk', publisher: 'Marvel', writer: 'Peter David', artist: 'Todd McFarlane', issues: [331, 400], tags: 'superhero,sci-fi', era: 'Modern Age' },
  { title: 'Wolverine', publisher: 'Marvel', writer: 'Chris Claremont', artist: 'Frank Miller', issues: [1, 4], tags: 'superhero,action', era: 'Modern Age', titleSuffix: ' (Limited Series)' },
  { title: 'Wolverine', publisher: 'Marvel', writer: 'Larry Hama', artist: 'Marc Silvestri', issues: [1, 80], tags: 'superhero,action', era: 'Modern Age', titleSuffix: ' (1988)' },
  { title: 'The Punisher', publisher: 'Marvel', writer: 'Garth Ennis', artist: 'Steve Dillon', issues: [1, 37], tags: 'action,crime,noir', era: 'Contemporary' },
  { title: 'Ultimate Spider-Man', publisher: 'Marvel', writer: 'Brian Michael Bendis', artist: 'Mark Bagley', issues: [1, 110], tags: 'superhero,all-ages', era: 'Contemporary' },
  { title: 'Deadpool', publisher: 'Marvel', writer: 'Joe Kelly', artist: 'Ed McGuinness', issues: [1, 33], tags: 'superhero,comedy,action', era: 'Contemporary' },
  { title: 'Ms. Marvel', publisher: 'Marvel', writer: 'G. Willow Wilson', artist: 'Adrian Alphona', issues: [1, 19], tags: 'superhero,all-ages', era: 'Contemporary' },
  { title: 'Black Panther', publisher: 'Marvel', writer: 'Ta-Nehisi Coates', artist: 'Brian Stelfreeze', issues: [1, 18], tags: 'superhero,sci-fi', era: 'Contemporary' },
  { title: 'Moon Knight', publisher: 'Marvel', writer: 'Jeff Lemire', artist: 'Greg Smallwood', issues: [1, 14], tags: 'superhero,noir,mystery', era: 'Contemporary' },
  { title: 'Hawkeye', publisher: 'Marvel', writer: 'Matt Fraction', artist: 'David Aja', issues: [1, 22], tags: 'superhero,comedy', era: 'Contemporary' },
  { title: 'Immortal Hulk', publisher: 'Marvel', writer: 'Al Ewing', artist: 'Joe Bennett', issues: [1, 50], tags: 'superhero,horror', era: 'Contemporary' },
  { title: 'Venom', publisher: 'Marvel', writer: 'Donny Cates', artist: 'Ryan Stegman', issues: [1, 35], tags: 'superhero,horror', era: 'Contemporary' },
  { title: 'Miles Morales: Spider-Man', publisher: 'Marvel', writer: 'Saladin Ahmed', artist: 'Javier Garron', issues: [1, 25], tags: 'superhero,all-ages', era: 'Contemporary' },
  { title: 'Guardians of the Galaxy', publisher: 'Marvel', writer: 'Dan Abnett', artist: 'Paul Pelletier', issues: [1, 25], tags: 'superhero,cosmic,sci-fi', era: 'Contemporary' },
  { title: 'Silver Surfer', publisher: 'Marvel', writer: 'Stan Lee', artist: 'John Buscema', issues: [1, 18], tags: 'superhero,cosmic,sci-fi', era: 'Silver Age' },
  { title: 'Doctor Strange', publisher: 'Marvel', writer: 'Stan Lee', artist: 'Steve Ditko', issues: [169, 183], tags: 'superhero,fantasy,supernatural', era: 'Silver Age' },
  { title: 'The Vision', publisher: 'Marvel', writer: 'Tom King', artist: 'Gabriel Hernandez Walta', issues: [1, 12], tags: 'superhero,drama', era: 'Contemporary' },
  { title: 'Runaways', publisher: 'Marvel', writer: 'Brian K. Vaughan', artist: 'Adrian Alphona', issues: [1, 18], tags: 'superhero,all-ages,drama', era: 'Contemporary' },
  { title: 'Secret Wars', publisher: 'Marvel', writer: 'Jim Shooter', artist: 'Mike Zeck', issues: [1, 12], tags: 'superhero,event,crossover', era: 'Modern Age' },
  { title: 'Civil War', publisher: 'Marvel', writer: 'Mark Millar', artist: 'Steve McNiven', issues: [1, 7], tags: 'superhero,event,crossover', era: 'Contemporary' },
  { title: 'House of X', publisher: 'Marvel', writer: 'Jonathan Hickman', artist: 'Pepe Larraz', issues: [1, 6], tags: 'superhero,sci-fi,event', era: 'Contemporary' },
  { title: 'Powers of X', publisher: 'Marvel', writer: 'Jonathan Hickman', artist: 'R.B. Silva', issues: [1, 6], tags: 'superhero,sci-fi,event', era: 'Contemporary' },
  { title: 'Marvels', publisher: 'Marvel', writer: 'Kurt Busiek', artist: 'Alex Ross', issues: [1, 4], tags: 'superhero,graphic-novel', era: 'Modern Age' },
  { title: 'Spider-Gwen', publisher: 'Marvel', writer: 'Jason Latour', artist: 'Robbi Rodriguez', issues: [1, 34], tags: 'superhero,action', era: 'Contemporary' },
  { title: 'Fantastic Four', publisher: 'Marvel', writer: 'Jonathan Hickman', artist: 'Dale Eaglesham', issues: [570, 611], tags: 'superhero,sci-fi', era: 'Contemporary' },
  { title: 'Invincible Iron Man', publisher: 'Marvel', writer: 'Matt Fraction', artist: 'Salvador Larroca', issues: [1, 33], tags: 'superhero,sci-fi', era: 'Contemporary' },

  // ═══ DC ═══
  { title: 'Batman', publisher: 'DC', writer: 'Dennis O\'Neil', artist: 'Neal Adams', issues: [232, 260], tags: 'superhero,noir,crime', era: 'Bronze Age' },
  { title: 'Batman', publisher: 'DC', writer: 'Doug Moench', artist: 'Kelley Jones', issues: [515, 560], tags: 'superhero,noir,crime', era: 'Modern Age' },
  { title: 'Batman', publisher: 'DC', writer: 'Scott Snyder', artist: 'Greg Capullo', issues: [1, 52], tags: 'superhero,noir,crime', era: 'Contemporary' },
  { title: 'Detective Comics', publisher: 'DC', writer: 'Dennis O\'Neil', artist: 'Neal Adams', issues: [395, 440], tags: 'superhero,mystery,noir', era: 'Bronze Age' },
  { title: 'Detective Comics', publisher: 'DC', writer: 'James Tynion IV', artist: 'Eddy Barrows', issues: [934, 981], tags: 'superhero,mystery,noir', era: 'Contemporary' },
  { title: 'Superman', publisher: 'DC', writer: 'Various', artist: 'Curt Swan', issues: [233, 300], tags: 'superhero,sci-fi', era: 'Silver Age' },
  { title: 'Superman', publisher: 'DC', writer: 'John Byrne', artist: 'John Byrne', issues: [1, 22], tags: 'superhero,sci-fi', era: 'Modern Age', titleSuffix: ' (1987)' },
  { title: 'Action Comics', publisher: 'DC', writer: 'Grant Morrison', artist: 'Rags Morales', issues: [1, 18], tags: 'superhero,sci-fi', era: 'Contemporary', titleSuffix: ' (2011)' },
  { title: 'Action Comics', publisher: 'DC', writer: 'Various', artist: 'Various', issues: [252, 320], tags: 'superhero,sci-fi', era: 'Silver Age' },
  { title: 'Wonder Woman', publisher: 'DC', writer: 'George Perez', artist: 'George Perez', issues: [1, 62], tags: 'superhero,fantasy,action', era: 'Modern Age' },
  { title: 'Wonder Woman', publisher: 'DC', writer: 'Greg Rucka', artist: 'Liam Sharp', issues: [1, 25], tags: 'superhero,fantasy,action', era: 'Contemporary', titleSuffix: ' (2016)' },
  { title: 'Justice League', publisher: 'DC', writer: 'Grant Morrison', artist: 'Howard Porter', issues: [1, 41], tags: 'superhero,team-up,action', era: 'Modern Age' },
  { title: 'Justice League', publisher: 'DC', writer: 'Geoff Johns', artist: 'Jim Lee', issues: [1, 52], tags: 'superhero,team-up,action', era: 'Contemporary', titleSuffix: ' (2011)' },
  { title: 'Green Lantern', publisher: 'DC', writer: 'Geoff Johns', artist: 'Ivan Reis', issues: [1, 67], tags: 'superhero,cosmic,sci-fi', era: 'Contemporary' },
  { title: 'Green Lantern', publisher: 'DC', writer: 'Dennis O\'Neil', artist: 'Neal Adams', issues: [76, 89], tags: 'superhero,cosmic', era: 'Bronze Age' },
  { title: 'The Flash', publisher: 'DC', writer: 'Mark Waid', artist: 'Mike Wieringo', issues: [62, 129], tags: 'superhero,sci-fi', era: 'Modern Age' },
  { title: 'The Flash', publisher: 'DC', writer: 'Geoff Johns', artist: 'Ethan Van Sciver', issues: [164, 225], tags: 'superhero,sci-fi', era: 'Contemporary' },
  { title: 'Aquaman', publisher: 'DC', writer: 'Geoff Johns', artist: 'Ivan Reis', issues: [1, 25], tags: 'superhero,fantasy', era: 'Contemporary' },
  { title: 'Green Arrow', publisher: 'DC', writer: 'Mike Grell', artist: 'Mike Grell', issues: [1, 80], tags: 'superhero,action', era: 'Modern Age' },
  { title: 'Teen Titans', publisher: 'DC', writer: 'Marv Wolfman', artist: 'George Perez', issues: [1, 50], tags: 'superhero,team-up,drama', era: 'Modern Age', titleSuffix: ' (New Teen Titans)' },
  { title: 'Nightwing', publisher: 'DC', writer: 'Chuck Dixon', artist: 'Scott McDaniel', issues: [1, 70], tags: 'superhero,action', era: 'Modern Age' },
  { title: 'Batgirl', publisher: 'DC', writer: 'Gail Simone', artist: 'Ardian Syaf', issues: [1, 34], tags: 'superhero,action', era: 'Contemporary' },
  { title: 'Harley Quinn', publisher: 'DC', writer: 'Amanda Conner', artist: 'Chad Hardin', issues: [1, 30], tags: 'superhero,comedy', era: 'Contemporary' },
  { title: 'Swamp Thing', publisher: 'DC', writer: 'Alan Moore', artist: 'Steve Bissette', issues: [20, 64], tags: 'horror,supernatural', era: 'Modern Age' },
  { title: 'Animal Man', publisher: 'DC', writer: 'Grant Morrison', artist: 'Chas Truog', issues: [1, 26], tags: 'superhero,drama,satire', era: 'Modern Age' },
  { title: 'Doom Patrol', publisher: 'DC', writer: 'Grant Morrison', artist: 'Richard Case', issues: [19, 63], tags: 'superhero,comedy,satire', era: 'Modern Age' },
  { title: 'Sandman', publisher: 'DC/Vertigo', writer: 'Neil Gaiman', artist: 'Sam Kieth', issues: [1, 75], tags: 'fantasy,horror,literary', era: 'Modern Age' },
  { title: 'Preacher', publisher: 'DC/Vertigo', writer: 'Garth Ennis', artist: 'Steve Dillon', issues: [1, 66], tags: 'horror,western,action,adult', era: 'Modern Age' },
  { title: 'Transmetropolitan', publisher: 'DC/Vertigo', writer: 'Warren Ellis', artist: 'Darick Robertson', issues: [1, 60], tags: 'sci-fi,cyberpunk,satire,adult', era: 'Modern Age' },
  { title: 'Y: The Last Man', publisher: 'DC/Vertigo', writer: 'Brian K. Vaughan', artist: 'Pia Guerra', issues: [1, 60], tags: 'sci-fi,drama,post-apocalyptic', era: 'Contemporary' },
  { title: 'Fables', publisher: 'DC/Vertigo', writer: 'Bill Willingham', artist: 'Mark Buckingham', issues: [1, 75], tags: 'fantasy,drama', era: 'Contemporary' },
  { title: '100 Bullets', publisher: 'DC/Vertigo', writer: 'Brian Azzarello', artist: 'Eduardo Risso', issues: [1, 60], tags: 'crime,noir,thriller', era: 'Contemporary' },
  { title: 'Hellblazer', publisher: 'DC/Vertigo', writer: 'Jamie Delano', artist: 'John Ridgway', issues: [1, 40], tags: 'horror,supernatural', era: 'Modern Age' },
  { title: 'Hellblazer', publisher: 'DC/Vertigo', writer: 'Garth Ennis', artist: 'Steve Dillon', issues: [41, 83], tags: 'horror,supernatural', era: 'Modern Age' },
  { title: 'Batman: The Dark Knight Returns', publisher: 'DC', writer: 'Frank Miller', artist: 'Frank Miller', issues: [1, 4], tags: 'superhero,noir,graphic-novel,classic', era: 'Modern Age' },
  { title: 'Watchmen', publisher: 'DC', writer: 'Alan Moore', artist: 'Dave Gibbons', issues: [1, 12], tags: 'superhero,noir,graphic-novel,classic,literary', era: 'Modern Age' },
  { title: 'Batman: Year One', publisher: 'DC', writer: 'Frank Miller', artist: 'David Mazzucchelli', issues: [404, 407], tags: 'superhero,noir,origin-story', era: 'Modern Age' },
  { title: 'Crisis on Infinite Earths', publisher: 'DC', writer: 'Marv Wolfman', artist: 'George Perez', issues: [1, 12], tags: 'superhero,event,crossover,cosmic', era: 'Modern Age' },
  { title: 'Kingdom Come', publisher: 'DC', writer: 'Mark Waid', artist: 'Alex Ross', issues: [1, 4], tags: 'superhero,graphic-novel,classic', era: 'Modern Age' },
  { title: 'All-Star Superman', publisher: 'DC', writer: 'Grant Morrison', artist: 'Frank Quitely', issues: [1, 12], tags: 'superhero,sci-fi,classic', era: 'Contemporary' },
  { title: 'Batman: The Long Halloween', publisher: 'DC', writer: 'Jeph Loeb', artist: 'Tim Sale', issues: [1, 13], tags: 'superhero,noir,mystery', era: 'Modern Age' },
  { title: 'Batman: Hush', publisher: 'DC', writer: 'Jeph Loeb', artist: 'Jim Lee', issues: [608, 619], tags: 'superhero,mystery,action', era: 'Contemporary' },
  { title: 'Blackest Night', publisher: 'DC', writer: 'Geoff Johns', artist: 'Ivan Reis', issues: [1, 8], tags: 'superhero,event,horror', era: 'Contemporary' },
  { title: 'Flashpoint', publisher: 'DC', writer: 'Geoff Johns', artist: 'Andy Kubert', issues: [1, 5], tags: 'superhero,event,sci-fi', era: 'Contemporary' },
  { title: 'Suicide Squad', publisher: 'DC', writer: 'John Ostrander', artist: 'Luke McDonnell', issues: [1, 40], tags: 'superhero,action,thriller', era: 'Modern Age' },
  { title: 'Catwoman', publisher: 'DC', writer: 'Ed Brubaker', artist: 'Darwyn Cooke', issues: [1, 24], tags: 'superhero,noir,crime', era: 'Contemporary' },

  // ═══ IMAGE ═══
  { title: 'Spawn', publisher: 'Image', writer: 'Todd McFarlane', artist: 'Todd McFarlane', issues: [1, 100], tags: 'superhero,horror,action', era: 'Modern Age' },
  { title: 'Invincible', publisher: 'Image', writer: 'Robert Kirkman', artist: 'Cory Walker', issues: [1, 50], tags: 'superhero,action,drama', era: 'Contemporary' },
  { title: 'Invincible', publisher: 'Image', writer: 'Robert Kirkman', artist: 'Ryan Ottley', issues: [51, 144], tags: 'superhero,action,drama', era: 'Contemporary' },
  { title: 'The Walking Dead', publisher: 'Image', writer: 'Robert Kirkman', artist: 'Tony Moore', issues: [1, 6], tags: 'horror,post-apocalyptic,drama', era: 'Contemporary' },
  { title: 'The Walking Dead', publisher: 'Image', writer: 'Robert Kirkman', artist: 'Charlie Adlard', issues: [7, 100], tags: 'horror,post-apocalyptic,drama', era: 'Contemporary' },
  { title: 'Saga', publisher: 'Image', writer: 'Brian K. Vaughan', artist: 'Fiona Staples', issues: [1, 66], tags: 'sci-fi,fantasy,romance,drama', era: 'Contemporary' },
  { title: 'East of West', publisher: 'Image', writer: 'Jonathan Hickman', artist: 'Nick Dragotta', issues: [1, 45], tags: 'sci-fi,western,dystopian', era: 'Contemporary' },
  { title: 'Deadly Class', publisher: 'Image', writer: 'Rick Remender', artist: 'Wes Craig', issues: [1, 44], tags: 'action,crime,drama', era: 'Contemporary' },
  { title: 'Chew', publisher: 'Image', writer: 'John Layman', artist: 'Rob Guillory', issues: [1, 60], tags: 'comedy,crime,sci-fi', era: 'Contemporary' },
  { title: 'Wicked + Divine', publisher: 'Image', writer: 'Kieron Gillen', artist: 'Jamie McKelvie', issues: [1, 45], tags: 'fantasy,drama', era: 'Contemporary' },
  { title: 'Paper Girls', publisher: 'Image', writer: 'Brian K. Vaughan', artist: 'Cliff Chiang', issues: [1, 30], tags: 'sci-fi,mystery,all-ages', era: 'Contemporary' },
  { title: 'Black Science', publisher: 'Image', writer: 'Rick Remender', artist: 'Matteo Scalera', issues: [1, 43], tags: 'sci-fi,action,drama', era: 'Contemporary' },
  { title: 'Descender', publisher: 'Image', writer: 'Jeff Lemire', artist: 'Dustin Nguyen', issues: [1, 32], tags: 'sci-fi,drama', era: 'Contemporary' },
  { title: 'Monstress', publisher: 'Image', writer: 'Marjorie Liu', artist: 'Sana Takeda', issues: [1, 36], tags: 'fantasy,horror,manga', era: 'Contemporary' },
  { title: 'Southern Bastards', publisher: 'Image', writer: 'Jason Aaron', artist: 'Jason Latour', issues: [1, 20], tags: 'crime,drama', era: 'Contemporary' },
  { title: 'Radiant Black', publisher: 'Image', writer: 'Kyle Higgins', artist: 'Marcelo Costa', issues: [1, 25], tags: 'superhero,sci-fi', era: 'Contemporary' },
  { title: 'Ice Cream Man', publisher: 'Image', writer: 'W. Maxwell Prince', artist: 'Martin Morazzo', issues: [1, 36], tags: 'horror,anthology', era: 'Contemporary' },
  { title: 'Nailbiter', publisher: 'Image', writer: 'Joshua Williamson', artist: 'Mike Henderson', issues: [1, 30], tags: 'horror,mystery,crime', era: 'Contemporary' },
  { title: 'Sex Criminals', publisher: 'Image', writer: 'Matt Fraction', artist: 'Chip Zdarsky', issues: [1, 30], tags: 'comedy,romance,adult', era: 'Contemporary' },
  { title: 'Savage Dragon', publisher: 'Image', writer: 'Erik Larsen', artist: 'Erik Larsen', issues: [1, 80], tags: 'superhero,action', era: 'Modern Age' },
  { title: 'Witchblade', publisher: 'Image', writer: 'Various', artist: 'Michael Turner', issues: [1, 50], tags: 'superhero,fantasy,action', era: 'Modern Age' },
  { title: 'Criminal', publisher: 'Image', writer: 'Ed Brubaker', artist: 'Sean Phillips', issues: [1, 36], tags: 'crime,noir', era: 'Contemporary' },
  { title: 'Kill or Be Killed', publisher: 'Image', writer: 'Ed Brubaker', artist: 'Sean Phillips', issues: [1, 20], tags: 'crime,noir,thriller', era: 'Contemporary' },
  { title: 'Lazarus', publisher: 'Image', writer: 'Greg Rucka', artist: 'Michael Lark', issues: [1, 29], tags: 'sci-fi,dystopian,action', era: 'Contemporary' },
  { title: 'Low', publisher: 'Image', writer: 'Rick Remender', artist: 'Greg Tocchini', issues: [1, 26], tags: 'sci-fi,drama', era: 'Contemporary' },
  { title: 'Manifest Destiny', publisher: 'Image', writer: 'Chris Dingess', artist: 'Matthew Roberts', issues: [1, 48], tags: 'historical,horror,action', era: 'Contemporary' },
  { title: 'Rat Queens', publisher: 'Image', writer: 'Kurtis Wiebe', artist: 'Roc Upchurch', issues: [1, 20], tags: 'fantasy,comedy,action', era: 'Contemporary' },
  { title: 'Revival', publisher: 'Image', writer: 'Tim Seeley', artist: 'Mike Norton', issues: [1, 47], tags: 'horror,mystery,drama', era: 'Contemporary' },
  { title: 'Snotgirl', publisher: 'Image', writer: 'Bryan Lee O\'Malley', artist: 'Leslie Hung', issues: [1, 15], tags: 'comedy,mystery', era: 'Contemporary' },

  // ═══ DARK HORSE ═══
  { title: 'Hellboy', publisher: 'Dark Horse', writer: 'Mike Mignola', artist: 'Mike Mignola', issues: [1, 56], tags: 'horror,supernatural,action', era: 'Modern Age' },
  { title: 'Sin City', publisher: 'Dark Horse', writer: 'Frank Miller', artist: 'Frank Miller', issues: [1, 13], tags: 'noir,crime,action,adult', era: 'Modern Age' },
  { title: 'Usagi Yojimbo', publisher: 'Dark Horse', writer: 'Stan Sakai', artist: 'Stan Sakai', issues: [1, 80], tags: 'action,historical,martial-arts', era: 'Modern Age' },
  { title: 'The Umbrella Academy', publisher: 'Dark Horse', writer: 'Gerard Way', artist: 'Gabriel Ba', issues: [1, 18], tags: 'superhero,sci-fi,action', era: 'Contemporary' },
  { title: 'B.P.R.D.', publisher: 'Dark Horse', writer: 'Mike Mignola', artist: 'Guy Davis', issues: [1, 50], tags: 'horror,supernatural,action', era: 'Contemporary' },
  { title: 'Aliens', publisher: 'Dark Horse', writer: 'Mark Verheiden', artist: 'Mark A. Nelson', issues: [1, 30], tags: 'sci-fi,horror', era: 'Modern Age' },
  { title: 'Conan the Barbarian', publisher: 'Dark Horse', writer: 'Kurt Busiek', artist: 'Cary Nord', issues: [1, 50], tags: 'fantasy,action', era: 'Contemporary' },
  { title: 'Black Hammer', publisher: 'Dark Horse', writer: 'Jeff Lemire', artist: 'Dean Ormston', issues: [1, 13], tags: 'superhero,mystery,drama', era: 'Contemporary' },

  // ═══ IDW ═══
  { title: 'Locke & Key', publisher: 'IDW', writer: 'Joe Hill', artist: 'Gabriel Rodriguez', issues: [1, 37], tags: 'horror,mystery,fantasy', era: 'Contemporary' },
  { title: 'Teenage Mutant Ninja Turtles', publisher: 'IDW', writer: 'Tom Waltz', artist: 'Dan Duncan', issues: [1, 80], tags: 'superhero,action,all-ages', era: 'Contemporary' },
  { title: '30 Days of Night', publisher: 'IDW', writer: 'Steve Niles', artist: 'Ben Templesmith', issues: [1, 3], tags: 'horror', era: 'Contemporary' },
  { title: 'Transformers', publisher: 'IDW', writer: 'James Roberts', artist: 'Alex Milne', issues: [1, 57], tags: 'sci-fi,action', era: 'Contemporary', titleSuffix: ': More Than Meets the Eye' },

  // ═══ BOOM! STUDIOS ═══
  { title: 'Lumberjanes', publisher: 'BOOM! Studios', writer: 'Shannon Watters', artist: 'Brooklyn Allen', issues: [1, 40], tags: 'comedy,fantasy,all-ages', era: 'Contemporary' },
  { title: 'Something is Killing the Children', publisher: 'BOOM! Studios', writer: 'James Tynion IV', artist: 'Werther Dell\'Edera', issues: [1, 36], tags: 'horror,mystery', era: 'Contemporary' },
  { title: 'Once & Future', publisher: 'BOOM! Studios', writer: 'Kieron Gillen', artist: 'Dan Mora', issues: [1, 30], tags: 'fantasy,action', era: 'Contemporary' },
  { title: 'Firefly', publisher: 'BOOM! Studios', writer: 'Greg Pak', artist: 'Dan McDaid', issues: [1, 24], tags: 'sci-fi,action', era: 'Contemporary' },

  // ═══ ONI PRESS ═══
  { title: 'Scott Pilgrim', publisher: 'Oni Press', writer: 'Bryan Lee O\'Malley', artist: 'Bryan Lee O\'Malley', issues: [1, 6], tags: 'comedy,romance,action,manga', era: 'Contemporary' },

  // ═══ VALIANT ═══
  { title: 'X-O Manowar', publisher: 'Valiant', writer: 'Robert Venditti', artist: 'Cary Nord', issues: [1, 50], tags: 'superhero,sci-fi,action', era: 'Contemporary' },
  { title: 'Bloodshot', publisher: 'Valiant', writer: 'Duane Swierczynski', artist: 'Manuel Garcia', issues: [1, 25], tags: 'superhero,action,sci-fi', era: 'Contemporary' },
  { title: 'Harbinger', publisher: 'Valiant', writer: 'Joshua Dysart', artist: 'Khari Evans', issues: [1, 25], tags: 'superhero,sci-fi', era: 'Contemporary' },

  // ═══ ARCHIE ═══
  { title: 'Afterlife with Archie', publisher: 'Archie Comics', writer: 'Roberto Aguirre-Sacasa', artist: 'Francesco Francavilla', issues: [1, 10], tags: 'horror,drama', era: 'Contemporary' },
  { title: 'Archie', publisher: 'Archie Comics', writer: 'Mark Waid', artist: 'Fiona Staples', issues: [1, 25], tags: 'comedy,romance,all-ages', era: 'Contemporary', titleSuffix: ' (2015)' },

  // ═══ MANGA (English editions) ═══
  { title: 'Berserk', publisher: 'Dark Horse', writer: 'Kentaro Miura', artist: 'Kentaro Miura', issues: [1, 41], tags: 'manga,fantasy,horror,action', era: 'Modern Age' },
  { title: 'Akira', publisher: 'Dark Horse', writer: 'Katsuhiro Otomo', artist: 'Katsuhiro Otomo', issues: [1, 6], tags: 'manga,sci-fi,cyberpunk,action', era: 'Modern Age' },
  { title: 'Lone Wolf and Cub', publisher: 'Dark Horse', writer: 'Kazuo Koike', artist: 'Goseki Kojima', issues: [1, 28], tags: 'manga,action,historical,martial-arts', era: 'Modern Age' },
  { title: 'Nausicaa of the Valley of the Wind', publisher: 'VIZ Media', writer: 'Hayao Miyazaki', artist: 'Hayao Miyazaki', issues: [1, 7], tags: 'manga,sci-fi,fantasy', era: 'Modern Age' },
  { title: 'Vagabond', publisher: 'VIZ Media', writer: 'Takehiko Inoue', artist: 'Takehiko Inoue', issues: [1, 37], tags: 'manga,historical,action,martial-arts', era: 'Contemporary' },
  { title: 'Vinland Saga', publisher: 'Kodansha', writer: 'Makoto Yukimura', artist: 'Makoto Yukimura', issues: [1, 27], tags: 'manga,historical,action,drama', era: 'Contemporary' },
  { title: 'One Punch Man', publisher: 'VIZ Media', writer: 'ONE', artist: 'Yusuke Murata', issues: [1, 26], tags: 'manga,superhero,comedy,action', era: 'Contemporary' },
  { title: 'My Hero Academia', publisher: 'VIZ Media', writer: 'Kohei Horikoshi', artist: 'Kohei Horikoshi', issues: [1, 38], tags: 'manga,superhero,action,all-ages', era: 'Contemporary' },
  { title: 'Attack on Titan', publisher: 'Kodansha', writer: 'Hajime Isayama', artist: 'Hajime Isayama', issues: [1, 34], tags: 'manga,action,horror,fantasy', era: 'Contemporary' },
  { title: 'Demon Slayer', publisher: 'VIZ Media', writer: 'Koyoharu Gotouge', artist: 'Koyoharu Gotouge', issues: [1, 23], tags: 'manga,action,fantasy,supernatural', era: 'Contemporary' },
  { title: 'Jujutsu Kaisen', publisher: 'VIZ Media', writer: 'Gege Akutami', artist: 'Gege Akutami', issues: [1, 22], tags: 'manga,action,supernatural', era: 'Contemporary' },
  { title: 'Chainsaw Man', publisher: 'VIZ Media', writer: 'Tatsuki Fujimoto', artist: 'Tatsuki Fujimoto', issues: [1, 16], tags: 'manga,action,horror', era: 'Contemporary' },
  { title: 'Death Note', publisher: 'VIZ Media', writer: 'Tsugumi Ohba', artist: 'Takeshi Obata', issues: [1, 12], tags: 'manga,mystery,thriller', era: 'Contemporary' },
  { title: 'Fullmetal Alchemist', publisher: 'VIZ Media', writer: 'Hiromu Arakawa', artist: 'Hiromu Arakawa', issues: [1, 27], tags: 'manga,action,fantasy,sci-fi', era: 'Contemporary' },
  { title: 'Monster', publisher: 'VIZ Media', writer: 'Naoki Urasawa', artist: 'Naoki Urasawa', issues: [1, 18], tags: 'manga,mystery,thriller,drama', era: 'Contemporary' },
  { title: '20th Century Boys', publisher: 'VIZ Media', writer: 'Naoki Urasawa', artist: 'Naoki Urasawa', issues: [1, 22], tags: 'manga,mystery,sci-fi,thriller', era: 'Contemporary' },
  { title: 'Pluto', publisher: 'VIZ Media', writer: 'Naoki Urasawa', artist: 'Naoki Urasawa', issues: [1, 8], tags: 'manga,sci-fi,mystery', era: 'Contemporary' },
  { title: 'Spy x Family', publisher: 'VIZ Media', writer: 'Tatsuya Endo', artist: 'Tatsuya Endo', issues: [1, 12], tags: 'manga,comedy,action,all-ages', era: 'Contemporary' },
  { title: 'Dragon Ball', publisher: 'VIZ Media', writer: 'Akira Toriyama', artist: 'Akira Toriyama', issues: [1, 42], tags: 'manga,action,comedy,all-ages', era: 'Modern Age' },
  { title: 'Naruto', publisher: 'VIZ Media', writer: 'Masashi Kishimoto', artist: 'Masashi Kishimoto', issues: [1, 72], tags: 'manga,action,fantasy', era: 'Contemporary' },
  { title: 'One Piece', publisher: 'VIZ Media', writer: 'Eiichiro Oda', artist: 'Eiichiro Oda', issues: [1, 100], tags: 'manga,action,comedy,fantasy', era: 'Contemporary' },
  { title: 'Bleach', publisher: 'VIZ Media', writer: 'Tite Kubo', artist: 'Tite Kubo', issues: [1, 74], tags: 'manga,action,supernatural', era: 'Contemporary' },
  { title: 'Hunter x Hunter', publisher: 'VIZ Media', writer: 'Yoshihiro Togashi', artist: 'Yoshihiro Togashi', issues: [1, 37], tags: 'manga,action,fantasy', era: 'Contemporary' },
  { title: 'Tokyo Ghoul', publisher: 'VIZ Media', writer: 'Sui Ishida', artist: 'Sui Ishida', issues: [1, 14], tags: 'manga,horror,action', era: 'Contemporary' },
  { title: 'Neon Genesis Evangelion', publisher: 'VIZ Media', writer: 'Yoshiyuki Sadamoto', artist: 'Yoshiyuki Sadamoto', issues: [1, 14], tags: 'manga,sci-fi,drama', era: 'Modern Age' },
  { title: 'Ghost in the Shell', publisher: 'Kodansha', writer: 'Masamune Shirow', artist: 'Masamune Shirow', issues: [1, 3], tags: 'manga,sci-fi,cyberpunk', era: 'Modern Age' },
  { title: 'Slam Dunk', publisher: 'VIZ Media', writer: 'Takehiko Inoue', artist: 'Takehiko Inoue', issues: [1, 31], tags: 'manga,comedy,drama', era: 'Modern Age' },
  { title: 'Mob Psycho 100', publisher: 'Dark Horse', writer: 'ONE', artist: 'ONE', issues: [1, 16], tags: 'manga,comedy,action,supernatural', era: 'Contemporary' },
  { title: 'Kaiju No. 8', publisher: 'VIZ Media', writer: 'Naoya Matsumoto', artist: 'Naoya Matsumoto', issues: [1, 11], tags: 'manga,action,sci-fi', era: 'Contemporary' },
  { title: 'Dandadan', publisher: 'VIZ Media', writer: 'Yukinobu Tatsu', artist: 'Yukinobu Tatsu', issues: [1, 14], tags: 'manga,action,comedy,supernatural', era: 'Contemporary' },

  // ═══ INDIE / OTHER ═══
  { title: 'Bone', publisher: 'Cartoon Books', writer: 'Jeff Smith', artist: 'Jeff Smith', issues: [1, 55], tags: 'fantasy,comedy,all-ages', era: 'Modern Age' },
  { title: 'Cerebus', publisher: 'Aardvark-Vanaheim', writer: 'Dave Sim', artist: 'Dave Sim', issues: [1, 80], tags: 'fantasy,satire,indie', era: 'Modern Age' },
  { title: 'Strangers in Paradise', publisher: 'Abstract Studio', writer: 'Terry Moore', artist: 'Terry Moore', issues: [1, 40], tags: 'romance,drama,thriller,indie', era: 'Modern Age' },
  { title: 'Concrete', publisher: 'Dark Horse', writer: 'Paul Chadwick', artist: 'Paul Chadwick', issues: [1, 10], tags: 'sci-fi,drama,indie', era: 'Modern Age' },
  { title: 'Elfquest', publisher: 'WaRP Graphics', writer: 'Wendy Pini', artist: 'Wendy Pini', issues: [1, 20], tags: 'fantasy,action,indie', era: 'Modern Age' },
  { title: 'Love and Rockets', publisher: 'Fantagraphics', writer: 'Los Bros Hernandez', artist: 'Los Bros Hernandez', issues: [1, 50], tags: 'drama,slice-of-life,indie', era: 'Modern Age' },
  { title: 'The Crow', publisher: 'Caliber Comics', writer: 'James O\'Barr', artist: 'James O\'Barr', issues: [1, 4], tags: 'noir,horror,action,indie', era: 'Modern Age' },
  { title: 'Planetary', publisher: 'Wildstorm', writer: 'Warren Ellis', artist: 'John Cassaday', issues: [1, 27], tags: 'superhero,sci-fi,mystery', era: 'Contemporary' },
  { title: 'The Authority', publisher: 'Wildstorm', writer: 'Warren Ellis', artist: 'Bryan Hitch', issues: [1, 29], tags: 'superhero,action,sci-fi', era: 'Contemporary' },
  { title: 'Astro City', publisher: 'Vertigo', writer: 'Kurt Busiek', artist: 'Brent Anderson', issues: [1, 52], tags: 'superhero,drama,slice-of-life', era: 'Modern Age' },
  { title: 'The Boys', publisher: 'Dynamite', writer: 'Garth Ennis', artist: 'Darick Robertson', issues: [1, 72], tags: 'superhero,satire,action,adult', era: 'Contemporary' },
  { title: 'Irredeemable', publisher: 'BOOM! Studios', writer: 'Mark Waid', artist: 'Peter Krause', issues: [1, 37], tags: 'superhero,drama', era: 'Contemporary' },
  { title: 'Atomic Robo', publisher: 'Red 5 Comics', writer: 'Brian Clevinger', artist: 'Scott Wegener', issues: [1, 25], tags: 'sci-fi,comedy,action', era: 'Contemporary' },
  { title: 'Conan the Barbarian', publisher: 'Marvel', writer: 'Roy Thomas', artist: 'Barry Windsor-Smith', issues: [1, 60], tags: 'fantasy,action', era: 'Bronze Age' },
  { title: 'Saga of the Swamp Thing', publisher: 'DC', writer: 'Len Wein', artist: 'Bernie Wrightson', issues: [1, 13], tags: 'horror,supernatural', era: 'Bronze Age' },
  { title: 'Alias', publisher: 'Marvel', writer: 'Brian Michael Bendis', artist: 'Michael Gaydos', issues: [1, 28], tags: 'superhero,noir,crime,adult', era: 'Contemporary' },

  // ═══ MORE MARVEL ═══
  { title: 'Amazing Spider-Man', publisher: 'Marvel', writer: 'J. Michael Straczynski', artist: 'John Romita Jr.', issues: [471, 524], tags: 'superhero', era: 'Contemporary' },
  { title: 'Amazing Spider-Man', publisher: 'Marvel', writer: 'Dan Slott', artist: 'Humberto Ramos', issues: [648, 700], tags: 'superhero', era: 'Contemporary' },
  { title: 'Superior Spider-Man', publisher: 'Marvel', writer: 'Dan Slott', artist: 'Ryan Stegman', issues: [1, 33], tags: 'superhero', era: 'Contemporary' },
  { title: 'Spider-Man', publisher: 'Marvel', writer: 'Todd McFarlane', artist: 'Todd McFarlane', issues: [1, 16], tags: 'superhero,action', era: 'Modern Age' },
  { title: 'Web of Spider-Man', publisher: 'Marvel', writer: 'Various', artist: 'Various', issues: [1, 50], tags: 'superhero', era: 'Modern Age' },
  { title: 'Peter Parker: The Spectacular Spider-Man', publisher: 'Marvel', writer: 'Various', artist: 'Various', issues: [1, 60], tags: 'superhero', era: 'Bronze Age' },
  { title: 'X-Force', publisher: 'Marvel', writer: 'Rob Liefeld', artist: 'Rob Liefeld', issues: [1, 30], tags: 'superhero,action', era: 'Modern Age' },
  { title: 'X-Factor', publisher: 'Marvel', writer: 'Peter David', artist: 'Various', issues: [71, 130], tags: 'superhero,team-up', era: 'Modern Age' },
  { title: 'New Mutants', publisher: 'Marvel', writer: 'Chris Claremont', artist: 'Bob McLeod', issues: [1, 50], tags: 'superhero,team-up', era: 'Modern Age' },
  { title: 'Excalibur', publisher: 'Marvel', writer: 'Chris Claremont', artist: 'Alan Davis', issues: [1, 34], tags: 'superhero,team-up,fantasy', era: 'Modern Age' },
  { title: 'Thor: God of Thunder', publisher: 'Marvel', writer: 'Jason Aaron', artist: 'Esad Ribic', issues: [1, 25], tags: 'superhero,fantasy,cosmic', era: 'Contemporary' },
  { title: 'Doctor Strange', publisher: 'Marvel', writer: 'Jason Aaron', artist: 'Chris Bachalo', issues: [1, 26], tags: 'superhero,supernatural,fantasy', era: 'Contemporary', titleSuffix: ' (2015)' },
  { title: 'Ghost Rider', publisher: 'Marvel', writer: 'Various', artist: 'Various', issues: [1, 40], tags: 'superhero,supernatural,horror', era: 'Bronze Age' },
  { title: 'The Eternals', publisher: 'Marvel', writer: 'Jack Kirby', artist: 'Jack Kirby', issues: [1, 19], tags: 'superhero,cosmic,sci-fi', era: 'Bronze Age' },
  { title: 'Annihilation', publisher: 'Marvel', writer: 'Keith Giffen', artist: 'Andrea Di Vito', issues: [1, 6], tags: 'superhero,cosmic,event', era: 'Contemporary' },
  { title: 'Planet Hulk', publisher: 'Marvel', writer: 'Greg Pak', artist: 'Carlo Pagulayan', issues: [92, 105], tags: 'superhero,sci-fi,action', era: 'Contemporary' },
  { title: 'Old Man Logan', publisher: 'Marvel', writer: 'Mark Millar', artist: 'Steve McNiven', issues: [66, 72], tags: 'superhero,post-apocalyptic', era: 'Contemporary' },
  { title: 'Infinity Gauntlet', publisher: 'Marvel', writer: 'Jim Starlin', artist: 'George Perez', issues: [1, 6], tags: 'superhero,cosmic,event', era: 'Modern Age' },
  { title: 'Secret Invasion', publisher: 'Marvel', writer: 'Brian Michael Bendis', artist: 'Leinil Francis Yu', issues: [1, 8], tags: 'superhero,event', era: 'Contemporary' },
  { title: 'Avengers vs. X-Men', publisher: 'Marvel', writer: 'Various', artist: 'Various', issues: [1, 12], tags: 'superhero,event,crossover', era: 'Contemporary' },
  { title: 'Age of Apocalypse', publisher: 'Marvel', writer: 'Various', artist: 'Various', issues: [1, 4], tags: 'superhero,event,sci-fi', era: 'Modern Age' },
  { title: 'Squirrel Girl', publisher: 'Marvel', writer: 'Ryan North', artist: 'Erica Henderson', issues: [1, 31], tags: 'superhero,comedy,all-ages', era: 'Contemporary' },
  { title: 'Captain Marvel', publisher: 'Marvel', writer: 'Kelly Sue DeConnick', artist: 'David Lopez', issues: [1, 17], tags: 'superhero,cosmic', era: 'Contemporary' },
  { title: 'She-Hulk', publisher: 'Marvel', writer: 'Dan Slott', artist: 'Juan Bobillo', issues: [1, 12], tags: 'superhero,comedy', era: 'Contemporary' },
  { title: 'Elektra: Assassin', publisher: 'Marvel', writer: 'Frank Miller', artist: 'Bill Sienkiewicz', issues: [1, 8], tags: 'superhero,action,noir', era: 'Modern Age' },
  { title: 'Silver Surfer: Black', publisher: 'Marvel', writer: 'Donny Cates', artist: 'Tradd Moore', issues: [1, 5], tags: 'superhero,cosmic,sci-fi', era: 'Contemporary' },
  { title: 'Moon Knight', publisher: 'Marvel', writer: 'Doug Moench', artist: 'Bill Sienkiewicz', issues: [1, 30], tags: 'superhero,noir,action', era: 'Modern Age', titleSuffix: ' (1980)' },
  { title: 'The Punisher', publisher: 'Marvel', writer: 'Greg Rucka', artist: 'Marco Checchetto', issues: [1, 16], tags: 'action,crime', era: 'Contemporary', titleSuffix: ' (2011)' },
  { title: 'Daredevil', publisher: 'Marvel', writer: 'Chip Zdarsky', artist: 'Marco Checchetto', issues: [1, 36], tags: 'superhero,noir,crime', era: 'Contemporary', titleSuffix: ' (2019)' },

  // ═══ MORE DC ═══
  { title: 'Superman: Red Son', publisher: 'DC', writer: 'Mark Millar', artist: 'Dave Johnson', issues: [1, 3], tags: 'superhero,sci-fi,graphic-novel', era: 'Contemporary' },
  { title: 'Identity Crisis', publisher: 'DC', writer: 'Brad Meltzer', artist: 'Rags Morales', issues: [1, 7], tags: 'superhero,mystery,event', era: 'Contemporary' },
  { title: 'Infinite Crisis', publisher: 'DC', writer: 'Geoff Johns', artist: 'Phil Jimenez', issues: [1, 7], tags: 'superhero,event,crossover', era: 'Contemporary' },
  { title: 'Batman: Court of Owls', publisher: 'DC', writer: 'Scott Snyder', artist: 'Greg Capullo', issues: [1, 7], tags: 'superhero,noir,mystery', era: 'Contemporary' },
  { title: 'Batman: Death of the Family', publisher: 'DC', writer: 'Scott Snyder', artist: 'Greg Capullo', issues: [13, 17], tags: 'superhero,horror', era: 'Contemporary' },
  { title: 'Gotham Central', publisher: 'DC', writer: 'Ed Brubaker', artist: 'Michael Lark', issues: [1, 40], tags: 'crime,noir,drama', era: 'Contemporary' },
  { title: 'Batwoman', publisher: 'DC', writer: 'J.H. Williams III', artist: 'J.H. Williams III', issues: [1, 24], tags: 'superhero,mystery', era: 'Contemporary' },
  { title: 'Red Hood and the Outlaws', publisher: 'DC', writer: 'Scott Lobdell', artist: 'Kenneth Rocafort', issues: [1, 20], tags: 'superhero,action', era: 'Contemporary' },
  { title: 'Saga of the Swamp Thing', publisher: 'DC', writer: 'Alan Moore', artist: 'Steve Bissette', issues: [21, 64], tags: 'horror,supernatural,literary', era: 'Modern Age' },
  { title: 'The Spectre', publisher: 'DC', writer: 'John Ostrander', artist: 'Tom Mandrake', issues: [1, 30], tags: 'superhero,supernatural,horror', era: 'Modern Age' },
  { title: 'Starman', publisher: 'DC', writer: 'James Robinson', artist: 'Tony Harris', issues: [1, 50], tags: 'superhero,drama', era: 'Modern Age' },
  { title: 'Mister Miracle', publisher: 'DC', writer: 'Tom King', artist: 'Mitch Gerads', issues: [1, 12], tags: 'superhero,drama', era: 'Contemporary' },
  { title: 'DC: The New Frontier', publisher: 'DC', writer: 'Darwyn Cooke', artist: 'Darwyn Cooke', issues: [1, 6], tags: 'superhero,graphic-novel,classic', era: 'Contemporary' },
  { title: 'Batman: Under the Hood', publisher: 'DC', writer: 'Judd Winick', artist: 'Doug Mahnke', issues: [635, 650], tags: 'superhero,action,mystery', era: 'Contemporary' },
  { title: 'Batman Beyond', publisher: 'DC', writer: 'Various', artist: 'Various', issues: [1, 25], tags: 'superhero,sci-fi,action', era: 'Contemporary' },
  { title: 'Deathstroke', publisher: 'DC', writer: 'Christopher Priest', artist: 'Carlo Pagulayan', issues: [1, 25], tags: 'superhero,action,thriller', era: 'Contemporary' },
  { title: 'Birds of Prey', publisher: 'DC', writer: 'Gail Simone', artist: 'Ed Benes', issues: [56, 108], tags: 'superhero,action,team-up', era: 'Contemporary' },

  // ═══ EVEN MORE (to reach 10,000) ═══
  { title: 'Star Wars', publisher: 'Marvel', writer: 'Jason Aaron', artist: 'John Cassaday', issues: [1, 75], tags: 'sci-fi,action', era: 'Contemporary' },
  { title: 'Darth Vader', publisher: 'Marvel', writer: 'Kieron Gillen', artist: 'Salvador Larroca', issues: [1, 25], tags: 'sci-fi,action', era: 'Contemporary' },
  { title: 'Doctor Aphra', publisher: 'Marvel', writer: 'Kieron Gillen', artist: 'Kev Walker', issues: [1, 40], tags: 'sci-fi,action,comedy', era: 'Contemporary' },
  { title: 'Alien', publisher: 'Marvel', writer: 'Phillip Kennedy Johnson', artist: 'Salvador Larroca', issues: [1, 12], tags: 'sci-fi,horror', era: 'Contemporary' },
  { title: 'Conan the Barbarian', publisher: 'Marvel', writer: 'Jason Aaron', artist: 'Mahmud Asrar', issues: [1, 25], tags: 'fantasy,action', era: 'Contemporary', titleSuffix: ' (2019)' },
  { title: 'Power Man and Iron Fist', publisher: 'Marvel', writer: 'Various', artist: 'Various', issues: [50, 100], tags: 'superhero,action,martial-arts', era: 'Bronze Age' },
  { title: 'Marvel Two-In-One', publisher: 'Marvel', writer: 'Various', artist: 'Various', issues: [1, 50], tags: 'superhero,team-up', era: 'Bronze Age' },
  { title: 'West Coast Avengers', publisher: 'Marvel', writer: 'Steve Englehart', artist: 'Al Milgrom', issues: [1, 50], tags: 'superhero,team-up', era: 'Modern Age' },
  { title: 'Alpha Flight', publisher: 'Marvel', writer: 'John Byrne', artist: 'John Byrne', issues: [1, 28], tags: 'superhero,team-up', era: 'Modern Age' },
  { title: 'Thunderbolts', publisher: 'Marvel', writer: 'Kurt Busiek', artist: 'Mark Bagley', issues: [1, 50], tags: 'superhero,action', era: 'Modern Age' },
  { title: 'Young Avengers', publisher: 'Marvel', writer: 'Allan Heinberg', artist: 'Jim Cheung', issues: [1, 12], tags: 'superhero,team-up,all-ages', era: 'Contemporary' },
  { title: 'Young Avengers', publisher: 'Marvel', writer: 'Kieron Gillen', artist: 'Jamie McKelvie', issues: [1, 15], tags: 'superhero,team-up', era: 'Contemporary', titleSuffix: ' (2013)' },
  { title: 'Champions', publisher: 'Marvel', writer: 'Mark Waid', artist: 'Humberto Ramos', issues: [1, 27], tags: 'superhero,team-up,all-ages', era: 'Contemporary' },
  { title: 'Silk', publisher: 'Marvel', writer: 'Robbie Thompson', artist: 'Stacey Lee', issues: [1, 19], tags: 'superhero,action', era: 'Contemporary' },
  { title: 'Gwenpool', publisher: 'Marvel', writer: 'Christopher Hastings', artist: 'Gurihiru', issues: [1, 25], tags: 'superhero,comedy', era: 'Contemporary' },
  { title: 'All-New Wolverine', publisher: 'Marvel', writer: 'Tom Taylor', artist: 'David Lopez', issues: [1, 35], tags: 'superhero,action', era: 'Contemporary' },
  { title: 'New X-Men', publisher: 'Marvel', writer: 'Grant Morrison', artist: 'Frank Quitely', issues: [114, 154], tags: 'superhero,sci-fi', era: 'Contemporary' },
  { title: 'Astonishing X-Men', publisher: 'Marvel', writer: 'Joss Whedon', artist: 'John Cassaday', issues: [1, 24], tags: 'superhero,sci-fi', era: 'Contemporary' },
  { title: 'Wolverine and the X-Men', publisher: 'Marvel', writer: 'Jason Aaron', artist: 'Chris Bachalo', issues: [1, 42], tags: 'superhero,comedy,action', era: 'Contemporary' },
  { title: 'Secret Warriors', publisher: 'Marvel', writer: 'Jonathan Hickman', artist: 'Stefano Caselli', issues: [1, 28], tags: 'superhero,spy,action', era: 'Contemporary' },
  { title: 'S.H.I.E.L.D.', publisher: 'Marvel', writer: 'Jonathan Hickman', artist: 'Dustin Weaver', issues: [1, 6], tags: 'superhero,sci-fi,spy', era: 'Contemporary' },

  // ═══ FILL TO 10,000+ ═══
  { title: 'Batgirl', publisher: 'DC', writer: 'Bryan Q. Miller', artist: 'Lee Garbett', issues: [1, 24], tags: 'superhero,action', era: 'Contemporary', titleSuffix: ' (2009)' },
  { title: 'Red Robin', publisher: 'DC', writer: 'Christopher Yost', artist: 'Ramon Bachs', issues: [1, 26], tags: 'superhero,action', era: 'Contemporary' },
  { title: 'Batwing', publisher: 'DC', writer: 'Judd Winick', artist: 'Ben Oliver', issues: [1, 20], tags: 'superhero,action', era: 'Contemporary' },
  { title: 'Blue Beetle', publisher: 'DC', writer: 'Keith Giffen', artist: 'Cully Hamner', issues: [1, 36], tags: 'superhero,all-ages', era: 'Contemporary' },
  { title: 'Booster Gold', publisher: 'DC', writer: 'Geoff Johns', artist: 'Dan Jurgens', issues: [1, 25], tags: 'superhero,sci-fi,comedy', era: 'Contemporary' },
  { title: 'Legion of Super-Heroes', publisher: 'DC', writer: 'Paul Levitz', artist: 'Keith Giffen', issues: [1, 63], tags: 'superhero,sci-fi,team-up', era: 'Modern Age' },
  { title: 'Shade the Changing Man', publisher: 'DC/Vertigo', writer: 'Peter Milligan', artist: 'Chris Bachalo', issues: [1, 50], tags: 'sci-fi,drama,indie', era: 'Modern Age' },
  { title: 'iZombie', publisher: 'DC/Vertigo', writer: 'Chris Roberson', artist: 'Mike Allred', issues: [1, 28], tags: 'horror,comedy,mystery', era: 'Contemporary' },
  { title: 'Sweet Tooth', publisher: 'DC/Vertigo', writer: 'Jeff Lemire', artist: 'Jeff Lemire', issues: [1, 40], tags: 'sci-fi,post-apocalyptic,drama', era: 'Contemporary' },
  { title: 'Scalped', publisher: 'DC/Vertigo', writer: 'Jason Aaron', artist: 'R.M. Guera', issues: [1, 60], tags: 'crime,noir,drama', era: 'Contemporary' },
  { title: 'DMZ', publisher: 'DC/Vertigo', writer: 'Brian Wood', artist: 'Riccardo Burchielli', issues: [1, 72], tags: 'war,drama', era: 'Contemporary' },
  { title: 'Northlanders', publisher: 'DC/Vertigo', writer: 'Brian Wood', artist: 'Davide Gianfelice', issues: [1, 50], tags: 'historical,action,war', era: 'Contemporary' },
  { title: 'The Wicked + The Divine', publisher: 'Image', writer: 'Kieron Gillen', artist: 'Jamie McKelvie', issues: [1, 45], tags: 'fantasy,drama,mystery', era: 'Contemporary' },
  { title: 'Die', publisher: 'Image', writer: 'Kieron Gillen', artist: 'Stephanie Hans', issues: [1, 20], tags: 'fantasy,horror', era: 'Contemporary' },
  { title: 'Bitter Root', publisher: 'Image', writer: 'David Walker', artist: 'Chuck Brown', issues: [1, 15], tags: 'superhero,horror,historical', era: 'Contemporary' },
  { title: 'Middlewest', publisher: 'Image', writer: 'Skottie Young', artist: 'Jorge Corona', issues: [1, 18], tags: 'fantasy,drama,all-ages', era: 'Contemporary' },
  { title: 'Gideon Falls', publisher: 'Image', writer: 'Jeff Lemire', artist: 'Andrea Sorrentino', issues: [1, 27], tags: 'horror,mystery', era: 'Contemporary' },
  { title: 'Undiscovered Country', publisher: 'Image', writer: 'Scott Snyder', artist: 'Giuseppe Camuncoli', issues: [1, 25], tags: 'sci-fi,action,mystery', era: 'Contemporary' },
  { title: 'Stray Bullets', publisher: 'Image', writer: 'David Lapham', artist: 'David Lapham', issues: [1, 41], tags: 'crime,noir,indie', era: 'Modern Age' },
  { title: 'Curse Words', publisher: 'Image', writer: 'Charles Soule', artist: 'Ryan Browne', issues: [1, 25], tags: 'fantasy,comedy', era: 'Contemporary' },
  { title: 'God Country', publisher: 'Image', writer: 'Donny Cates', artist: 'Geoff Shaw', issues: [1, 6], tags: 'fantasy,action,drama', era: 'Contemporary' },
  { title: 'Redneck', publisher: 'Image', writer: 'Donny Cates', artist: 'Lisandro Estherren', issues: [1, 25], tags: 'horror,drama', era: 'Contemporary' },
  { title: 'Extremity', publisher: 'Image', writer: 'Daniel Warren Johnson', artist: 'Daniel Warren Johnson', issues: [1, 12], tags: 'fantasy,action', era: 'Contemporary' },
  { title: 'Royal City', publisher: 'Image', writer: 'Jeff Lemire', artist: 'Jeff Lemire', issues: [1, 14], tags: 'drama,mystery,indie', era: 'Contemporary' },
  { title: 'Outcast', publisher: 'Image', writer: 'Robert Kirkman', artist: 'Paul Azaceta', issues: [1, 48], tags: 'horror,supernatural', era: 'Contemporary' },
  { title: 'Birthright', publisher: 'Image', writer: 'Joshua Williamson', artist: 'Andrei Bressan', issues: [1, 41], tags: 'fantasy,action', era: 'Contemporary' },
];

// ── Generate all issues ────────────────────────────────────────────────────
function generateCatalog() {
  const catalog = [];

  for (const series of SERIES) {
    const [start, end] = series.issues;
    for (let i = start; i <= end; i++) {
      const fullTitle = series.title + (series.titleSuffix || '');
      catalog.push({
        title: fullTitle,
        issue_num: String(i),
        publisher: series.publisher,
        writer: series.writer,
        artist: series.artist,
        cover_image: '', // Will be filled by cover fetch
        tags: series.tags,
        era: series.era || '',
      });
    }
  }

  return catalog;
}

const catalog = generateCatalog();
console.log(`Generated ${catalog.length} entries from ${SERIES.length} series`);

// Check if we need more to reach 10,000
if (catalog.length < 10000) {
  console.log(`Need ${10000 - catalog.length} more entries to reach 10,000`);
}

// Write to file
const outPath = path.join(__dirname, 'seed-catalog.json');
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 0)); // compact JSON
const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`Wrote ${outPath} (${sizeMB} MB)`);
