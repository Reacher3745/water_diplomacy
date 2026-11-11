# The Dharoi Table

A serious game about sharing the Sabarmati river's water. Four sectors draw on Dharoi reservoir in Gujarat: **drinking water** for Ahmedabad and Mehsana villages, **industry**, **farmers** in the Dharoi canal command, and **the river** itself. In a dry year their demands are roughly twice what the reservoir can supply. Over five monsoons, players negotiate who joins which deal and how the money from pooling water is split. Each split is then compared with the **nucleolus**, a fair-share benchmark from cooperative game theory.

## Play

- **In a browser:** download `index.html` and open it. No install or server is needed. It needs an internet connection only for the web fonts, and falls back to system fonts offline.
- **On GitHub Pages:** push this folder to a repository, open **Settings → Pages**, set the source to the `main` branch and the root folder, and save. The game is served at `https://<your-username>.github.io/<repository-name>/`.

One to four people can play on one screen; any seat not taken by a person is played by a bot. In *Random monsoons* mode, the seed fixes both the years and the proposer draws, so a class can replay exactly the same game.

## How a year works

1. The monsoon fills Dharoi. Each sector's legal right is drawn as a layer of water in the reservoir.
2. The table meets for up to four sessions. In each session a sector drawn at random proposes a deal: which sectors are in it, and how much money each receives. A fixed rotation is available as an option, but report II shows it is inefficient in equilibrium: the next proposer is too expensive to include, so they get left out.
3. Everyone named must accept. A single rejection ends the session, and every group's worth shrinks by 6%.
4. A signed deal sends water wherever its last cubic metre is worth the most; shares are paid in money.
5. A sector still without a deal after four sessions uses only its own right.
6. Score = your share ÷ your nucleolus share × 100. Par is 100.
7. Before year 4, a council votes on reformed rights: industry's water partnership is restored and the river gets a flow right. It passes with three of four votes.

An optional **advisor** shows what each sector expects if the session fails, fills in the nucleolus or normalized-nucleolus split, and warns when some group would do better walking out.

## The model

Every number is computed live in the browser. There are no precomputed tables.

- **Coalition worth $v(S)$:** the coalition pools its members' fresh-water rights, adds the city's 150 MCM of treated wastewater if the city is a member, and allocates to maximise the total of concave benefit curves. The solver is accelerated projected gradient (FISTA with restart).
- **Fair shares:** the nucleolus and normalized nucleolus, computed by sequential linear programs with a dense two-phase simplex written in plain JavaScript. The Shapley value is deliberately not used: in this game it falls outside the core in most cases and under parameter noise. `engine.js` keeps a Shapley function only for comparison.
- **Years:** wet, normal and dry, plus a stress test in which the city's Narmada canal supply is cut.
- **Bots:** heuristic negotiators that are cooperative, balanced or hardliner. They are not equilibrium players.

## Repository layout

```
index.html    the complete game, a single self-contained file (this is what GitHub Pages serves)
engine.js     coalition worths, LP solver, nucleolus (Shapley kept for comparison only)
logic.js      game rules, bot strategies, settlement
ui.js         interface
shell.html    page template and styles
build.py      rebuilds index.html from the four source files above
verify.js     checks the engine against the project report
.nojekyll     tells GitHub Pages to serve the files as they are
```

To change the game, edit the source files and run `python3 build.py`. To check the engine, run `node verify.js`.

## Background

The game accompanies two project reports from a project course at IIT Gandhinagar: *Who Gets the Sabarmati?* (cooperative allocation with the nucleolus) and *Who Gets the Sabarmati? II* (structure, stability and bargaining in the same game). All economic parameters are assumptions documented in those reports; the game is a teaching tool, not a forecast of real allocations.
