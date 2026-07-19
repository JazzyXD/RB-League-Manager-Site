// USBL stats site — no build step, no framework. Fetches the JSON the bot
// publishes to data/*.json and renders it client-side. Routing is a plain
// hash switch (#/, #/leaders, #/games, #/team/<name>, #/game/<id>) so the
// whole thing works as static files with zero server-side logic.

const DATA_FILES = ["standings", "teams", "games", "leaders", "meta"];

let store = { standings: [], teams: {}, games: [], leaders: {}, meta: {} };

const LEADER_LABELS = {
  ppg: "Points Per Game",
  rpg: "Rebounds Per Game",
  apg: "Assists Per Game",
  spg: "Steals Per Game",
  bpg: "Blocks Per Game",
  "fg%": "Field Goal %",
};

async function loadData() {
  const results = await Promise.all(
    DATA_FILES.map((name) =>
      fetch(`data/${name}.json?_=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  );
  DATA_FILES.forEach((name, i) => {
    if (results[i] !== null) store[name] = results[i];
  });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderScoreboard() {
  const row = document.getElementById("scoreboard-row");
  const sub = document.getElementById("scoreboard-sub");
  const label = document.querySelector(".scoreboard__label");

  const topScorer = (store.leaders.ppg || [])[0];
  const topTeam = store.standings[0];

  if (!topScorer && !topTeam) {
    row.innerHTML = `<span class="scoreboard__digits">--</span>`;
    sub.textContent = "Waiting for the first game to be recorded.";
    return;
  }

  if (topScorer) {
    label.textContent = "PPG LEADER";
    row.innerHTML = `<span class="scoreboard__digits">${escapeHtml(topScorer.username)} — ${topScorer.value.toFixed(1)}</span>`;
    sub.textContent = topTeam ? `Top record: ${escapeHtml(topTeam.name)} (${topTeam.wins}-${topTeam.losses})` : "";
  } else if (topTeam) {
    label.textContent = "TOP RECORD";
    row.innerHTML = `<span class="scoreboard__digits">${escapeHtml(topTeam.name)} ${topTeam.wins}-${topTeam.losses}</span>`;
    sub.textContent = "";
  }
}

function renderFooter() {
  const el = document.getElementById("footer-updated");
  if (store.meta && store.meta.generated_at) {
    const d = new Date(store.meta.generated_at);
    el.textContent = `Last updated ${d.toLocaleString()}`;
  } else {
    el.textContent = "Not yet published";
  }
}

function standingsTable(rows) {
  if (!rows.length) return `<p class="empty-state">No teams linked yet.</p>`;
  return `
    <table class="standings">
      <thead>
        <tr>
          <th>Team</th>
          <th class="num">W</th>
          <th class="num">L</th>
          <th class="num">PPG</th>
          <th class="num">Roster</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (t) => `
          <tr onclick="location.hash='#/team/${encodeURIComponent(t.name)}'">
            <td class="team-name">${escapeHtml(t.name)}</td>
            <td class="num record"><span class="win-count">${t.wins}</span>-<span class="loss-count">${t.losses}</span></td>
            <td class="num record">${t.wins}-${t.losses}</td>
            <td class="num record">${t.avg_ppg.toFixed(1)}</td>
            <td class="num record">${t.roster_size}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function leaderCard(metric, limit) {
  const rows = (store.leaders[metric] || []).slice(0, limit);
  if (!rows.length) return `<p class="empty-state">No data yet.</p>`;
  return rows
    .map(
      (r) => `
    <div class="leader-row">
      <span><span class="name">${escapeHtml(r.username)}</span>${r.team_name ? `<span class="team">${escapeHtml(r.team_name)}</span>` : ""}</span>
      <span class="value">${r.value.toFixed(1)}</span>
    </div>`
    )
    .join("");
}

function gameRow(g) {
  const winnerA = g.winner && g.team_a && g.winner.toLowerCase() === g.team_a.toLowerCase();
  const winnerB = g.winner && g.team_b && g.winner.toLowerCase() === g.team_b.toLowerCase();
  return `
    <div class="game-row" onclick="location.hash='#/game/${g.id}'">
      <div>
        <div class="game-row__matchup">
          <span class="${winnerA ? "winner" : ""}">${escapeHtml(g.team_a || "—")}</span>
          vs
          <span class="${winnerB ? "winner" : ""}">${escapeHtml(g.team_b || "—")}</span>
        </div>
        <div class="game-row__meta">${escapeHtml(g.season)} · ${new Date(g.played_at).toLocaleDateString()}</div>
      </div>
      <div class="game-row__score">${g.team_a_points}–${g.team_b_points}</div>
    </div>`;
}

function boxScoreTable(boxScore) {
  return `
    <table class="box-score">
      <thead>
        <tr>
          <th>Player</th><th>Team</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG</th><th>FT</th>
        </tr>
      </thead>
      <tbody>
        ${boxScore
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p.username)}</td>
            <td>${escapeHtml(p.team_name || "—")}</td>
            <td>${p.points}</td>
            <td>${p.rebounds}</td>
            <td>${p.assists}</td>
            <td>${p.steals}</td>
            <td>${p.blocks}</td>
            <td>${p.turnovers}</td>
            <td>${p.fgm}/${p.fga}</td>
            <td>${p.ftm}/${p.fta}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function viewHome() {
  return `
    <h2 class="section-title">Standings</h2>
    ${standingsTable(store.standings)}

    <div class="grid-2">
      <div>
        <h2 class="section-title">Recent Games</h2>
        <div class="card">
          ${store.games.length ? store.games.slice(0, 6).map(gameRow).join("") : `<p class="empty-state">No games recorded yet.</p>`}
        </div>
        <a href="#/games" class="back-link">All games →</a>
      </div>
      <div>
        <h2 class="section-title">PPG Leaders</h2>
        <div class="card">${leaderCard("ppg", 5)}</div>
        <a href="#/leaders" class="back-link">All leaderboards →</a>
      </div>
    </div>`;
}

function viewLeaders() {
  const metrics = Object.keys(LEADER_LABELS);
  const active = window._activeLeaderMetric || "ppg";

  return `
    <h2 class="section-title">League Leaders</h2>
    <div class="leader-tabs">
      ${metrics
        .map(
          (m) => `<button class="${m === active ? "active" : ""}" onclick="window._activeLeaderMetric='${m}'; render();">${escapeHtml(LEADER_LABELS[m])}</button>`
        )
        .join("")}
    </div>
    <div class="card">
      <div class="card__title">${escapeHtml(LEADER_LABELS[active])}</div>
      ${leaderCard(active, 10)}
    </div>`;
}

function viewGames() {
  return `
    <h2 class="section-title">All Games</h2>
    <div class="card">
      ${store.games.length ? store.games.map(gameRow).join("") : `<p class="empty-state">No games recorded yet.</p>`}
    </div>`;
}

function viewTeam(name) {
  const team = store.teams[name];
  if (!team) {
    return `<p class="empty-state">Team not found.</p><a href="#/" class="back-link">← Back to standings</a>`;
  }

  const roster = team.roster || [];

  return `
    <a href="#/" class="back-link">← Standings</a>
    <div class="team-header">
      <h1>${escapeHtml(team.name)}</h1>
      <span class="record"><span class="win-count">${team.wins}</span>-<span class="loss-count">${team.losses}</span></span>
    </div>

    <div class="grid-2">
      <div>
        <h2 class="section-title">Roster</h2>
        <table class="roster-table">
          <tbody>
            ${roster.length ? roster.map((p) => `<tr><td>${escapeHtml(p.username)}</td></tr>`).join("") : `<tr><td class="empty-state">No players assigned yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div>
        <h2 class="section-title">Team Leaders</h2>
        <div class="card">
          ${team.leading_scorer ? `<div class="leader-row"><span class="name">${escapeHtml(team.leading_scorer.username)}</span><span class="value">${team.leading_scorer.value.toFixed(1)} PPG</span></div>` : ""}
          ${team.leading_rebounder ? `<div class="leader-row"><span class="name">${escapeHtml(team.leading_rebounder.username)}</span><span class="value">${team.leading_rebounder.value.toFixed(1)} RPG</span></div>` : ""}
          ${team.leading_assister ? `<div class="leader-row"><span class="name">${escapeHtml(team.leading_assister.username)}</span><span class="value">${team.leading_assister.value.toFixed(1)} APG</span></div>` : ""}
          ${!team.leading_scorer && !team.leading_rebounder && !team.leading_assister ? `<p class="empty-state">No games played yet.</p>` : ""}
        </div>
      </div>
    </div>`;
}

function viewGame(id) {
  const game = store.games.find((g) => String(g.id) === String(id));
  if (!game) {
    return `<p class="empty-state">Game not found.</p><a href="#/games" class="back-link">← Back to games</a>`;
  }
  return `
    <a href="#/games" class="back-link">← All games</a>
    <h2 class="section-title">Game #${game.id} — ${escapeHtml(game.season)}</h2>
    <div class="card">
      <div class="game-row__matchup" style="margin-bottom: 10px;">
        ${escapeHtml(game.team_a || "—")} ${game.team_a_points} — ${game.team_b_points} ${escapeHtml(game.team_b || "—")}
      </div>
      ${boxScoreTable(game.box_score)}
    </div>`;
}

// ---------------------------------------------------------------------
// Arena widget: two team-corner dropdowns + Compare button, toggled with
// a single Roblox-username box + View Player button. Populated once data
// loads; selections drive navigation, they don't persist across routes.
// ---------------------------------------------------------------------

function populateArena() {
  const teamNames = store.standings.map((t) => t.name).sort((a, b) => a.localeCompare(b));
  const teamAOptions = ['<option value="">Select team…</option>', ...teamNames.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)].join("");
  document.getElementById("arena-team-a").innerHTML = teamAOptions;
  document.getElementById("arena-team-b").innerHTML = teamAOptions;

  const playerNames = Object.keys(store.players || {}).sort((a, b) => a.localeCompare(b));
  document.getElementById("arena-player-list").innerHTML = playerNames
    .map((n) => `<option value="${escapeHtml(n)}"></option>`)
    .join("");
}

function updateCompareButton() {
  const a = document.getElementById("arena-team-a").value;
  const b = document.getElementById("arena-team-b").value;
  const btn = document.getElementById("arena-compare-btn");
  btn.disabled = !(a && b && a !== b);
}

function updateViewPlayerButton() {
  const val = document.getElementById("arena-player-input").value.trim();
  const btn = document.getElementById("arena-view-player-btn");
  const known = Object.keys(store.players || {}).some((n) => n.toLowerCase() === val.toLowerCase());
  btn.disabled = !known;
}

function setArenaMode(mode) {
  const teamAWrap = document.getElementById("arena-team-a-wrap");
  const teamBWrap = document.getElementById("arena-team-b-wrap");
  const playerWrap = document.getElementById("arena-player-wrap");
  const compareBtn = document.getElementById("arena-compare-btn");
  const viewPlayerBtn = document.getElementById("arena-view-player-btn");
  const toggle = document.getElementById("arena-mode-toggle");

  if (mode === "player") {
    teamAWrap.hidden = true;
    teamBWrap.hidden = true;
    playerWrap.hidden = false;
    compareBtn.hidden = true;
    viewPlayerBtn.hidden = false;
    toggle.textContent = "Teams";
  } else {
    teamAWrap.hidden = false;
    teamBWrap.hidden = false;
    playerWrap.hidden = true;
    compareBtn.hidden = false;
    viewPlayerBtn.hidden = true;
    toggle.textContent = "Player";
  }
}

function initArena() {
  populateArena();
  setArenaMode("teams");

  document.getElementById("arena-team-a").addEventListener("change", updateCompareButton);
  document.getElementById("arena-team-b").addEventListener("change", updateCompareButton);
  document.getElementById("arena-player-input").addEventListener("input", updateViewPlayerButton);

  document.getElementById("arena-mode-toggle").addEventListener("click", () => {
    const inPlayerMode = !document.getElementById("arena-player-wrap").hidden;
    setArenaMode(inPlayerMode ? "teams" : "player");
  });

  document.getElementById("arena-compare-btn").addEventListener("click", () => {
    const a = document.getElementById("arena-team-a").value;
    const b = document.getElementById("arena-team-b").value;
    if (a && b && a !== b) {
      window.location.hash = `#/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;
    }
  });

  document.getElementById("arena-view-player-btn").addEventListener("click", () => {
    const val = document.getElementById("arena-player-input").value.trim();
    const match = Object.keys(store.players || {}).find((n) => n.toLowerCase() === val.toLowerCase());
    if (match) window.location.hash = `#/player/${encodeURIComponent(match)}`;
  });

  document.getElementById("arena-player-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("arena-view-player-btn").click();
  });
}

function headToHead(teamA, teamB) {
  return store.games.filter(
    (g) =>
      g.team_a &&
      g.team_b &&
      ((g.team_a.toLowerCase() === teamA.toLowerCase() && g.team_b.toLowerCase() === teamB.toLowerCase()) ||
        (g.team_a.toLowerCase() === teamB.toLowerCase() && g.team_b.toLowerCase() === teamA.toLowerCase()))
  );
}

function viewCompare(nameA, nameB) {
  const teamA = store.teams[nameA];
  const teamB = store.teams[nameB];
  if (!teamA || !teamB) {
    return `<p class="empty-state">One or both teams weren't found.</p><a href="#/" class="back-link">← Back to standings</a>`;
  }

  const games = headToHead(nameA, nameB);
  let winsA = 0;
  let winsB = 0;
  games.forEach((g) => {
    if (g.winner && g.winner.toLowerCase() === nameA.toLowerCase()) winsA++;
    else if (g.winner && g.winner.toLowerCase() === nameB.toLowerCase()) winsB++;
  });

  const statRow = (label, a, b) => `
    <div class="compare-row">
      <span class="compare-row__value">${a}</span>
      <span class="compare-row__label">${label}</span>
      <span class="compare-row__value">${b}</span>
    </div>`;

  return `
    <a href="#/" class="back-link">← Standings</a>
    <h2 class="section-title">Head-to-Head</h2>
    <div class="card">
      <div class="compare-header">
        <span class="compare-header__team">${escapeHtml(nameA)}</span>
        <span class="compare-header__vs">VS</span>
        <span class="compare-header__team">${escapeHtml(nameB)}</span>
      </div>
      ${statRow("Record", `${teamA.wins}-${teamA.losses}`, `${teamB.wins}-${teamB.losses}`)}
      ${statRow("PPG", teamA.avg_ppg.toFixed(1), teamB.avg_ppg.toFixed(1))}
      ${statRow("Roster Size", teamA.roster.length, teamB.roster.length)}
      ${statRow("Head-to-Head Wins", winsA, winsB)}
    </div>

    <h2 class="section-title">Meetings</h2>
    <div class="card">
      ${games.length ? games.map(gameRow).join("") : `<p class="empty-state">These teams haven't played each other yet.</p>`}
    </div>`;
}

function viewPlayer(username) {
  const player = (store.players || {})[username];
  if (!player) {
    return `<p class="empty-state">Player not found.</p><a href="#/" class="back-link">← Back to standings</a>`;
  }

  return `
    <a href="#/" class="back-link">← Standings</a>
    <div class="team-header">
      <h1>${escapeHtml(player.username)}</h1>
      <span class="record">${player.team_name ? escapeHtml(player.team_name) : "Unassigned"}</span>
    </div>

    <h2 class="section-title">Career Averages</h2>
    <div class="card stat-grid">
      <div class="stat-cell"><span class="stat-cell__value">${player.ppg.toFixed(1)}</span><span class="stat-cell__label">PPG</span></div>
      <div class="stat-cell"><span class="stat-cell__value">${player.rpg.toFixed(1)}</span><span class="stat-cell__label">RPG</span></div>
      <div class="stat-cell"><span class="stat-cell__value">${player.apg.toFixed(1)}</span><span class="stat-cell__label">APG</span></div>
      <div class="stat-cell"><span class="stat-cell__value">${player.spg.toFixed(1)}</span><span class="stat-cell__label">SPG</span></div>
      <div class="stat-cell"><span class="stat-cell__value">${player.bpg.toFixed(1)}</span><span class="stat-cell__label">BPG</span></div>
      <div class="stat-cell"><span class="stat-cell__value">${player.fg_pct.toFixed(1)}%</span><span class="stat-cell__label">FG%</span></div>
    </div>
    <p class="empty-state" style="padding: 8px 0 0;">${player.games_played} game(s) played</p>`;
}

function render() {
  const content = document.getElementById("content");
  const hash = window.location.hash || "#/";
  const parts = hash.replace(/^#\//, "").split("/").filter(Boolean);

  if (parts.length === 0) {
    content.innerHTML = viewHome();
  } else if (parts[0] === "leaders") {
    content.innerHTML = viewLeaders();
  } else if (parts[0] === "games") {
    content.innerHTML = viewGames();
  } else if (parts[0] === "team" && parts[1]) {
    content.innerHTML = viewTeam(decodeURIComponent(parts[1]));
  } else if (parts[0] === "compare" && parts[1] && parts[2]) {
    content.innerHTML = viewCompare(decodeURIComponent(parts[1]), decodeURIComponent(parts[2]));
  } else if (parts[0] === "player" && parts[1]) {
    content.innerHTML = viewPlayer(decodeURIComponent(parts[1]));
  } else if (parts[0] === "game" && parts[1]) {
    content.innerHTML = viewGame(parts[1]);
  } else {
    content.innerHTML = viewHome();
  }

  renderScoreboard();
  renderFooter();
}

window.addEventListener("hashchange", render);

loadData().then(() => {
  initArena();
  render();
});
