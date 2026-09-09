const TEAMS = [
  "Air Force", "Akron", "Alabama", "Appalachian State", "Arizona", "Arizona State", "Arkansas", "Arkansas State", "Army", "Auburn",
  "Ball State", "Baylor", "Boise State", "Boston College", "Bowling Green", "Buffalo", "BYU",
  "California", "Central Michigan", "Charlotte", "Cincinnati", "Clemson", "Coastal Carolina", "Colorado", "Colorado State", "Connecticut",
  "Delaware", "Duke", "East Carolina", "Eastern Michigan", "FIU", "Florida", "Florida Atlantic", "Florida State", "Fresno State",
  "Georgia", "Georgia Southern", "Georgia State", "Georgia Tech", "Hawai'i", "Houston", "Illinois", "Indiana", "Iowa", "Iowa State",
  "Jacksonville State", "James Madison", "Kansas", "Kansas State", "Kent State", "Kentucky", "Kennesaw State", "Liberty", "Louisiana", "Louisiana Tech", "Louisville", "LSU",
  "Marshall", "Maryland", "Memphis", "Miami (FL)", "Miami (OH)", "Michigan", "Michigan State", "Middle Tennessee", "Minnesota", "Mississippi State", "Missouri", "Missouri State",
  "Navy", "NC State", "Nebraska", "Nevada", "New Mexico", "New Mexico State", "North Carolina", "North Dakota", "North Texas", "Northern Illinois", "Northwestern", "Notre Dame",
  "Ohio", "Ohio State", "Oklahoma", "Oklahoma State", "Old Dominion", "Ole Miss", "Oregon", "Oregon State",
  "Penn State", "Pittsburgh", "Purdue", "Rice", "Rutgers", "Sam Houston", "San Diego State", "San Jose State", "SMU", "South Alabama", "South Carolina", "South Florida", "Southern Miss", "Stanford", "Syracuse",
  "TCU", "Temple", "Tennessee", "Texas", "Texas A&M", "Texas State", "Texas Tech", "Toledo", "Troy", "Tulane", "Tulsa", "UAB", "UCF", "UCLA", "UL Monroe", "UMass", "UNLV", "USC", "UTEP", "UTSA", "Utah", "Utah State",
  "Vanderbilt", "Virginia", "Virginia Tech", "Wake Forest", "Washington", "Washington State", "West Virginia", "Western Kentucky", "Western Michigan", "Wisconsin", "Wyoming"
].sort((a, b) => a.localeCompare(b));

const config = window.DUCKS_RISING_CONFIG || {};
const rankList = document.querySelector("#rank-list");
const countEl = document.querySelector("#pick-count");
const progressEl = document.querySelector("#progress-bar");
const submitButton = document.querySelector("#submit-button");
const messageEl = document.querySelector("#form-message");
const nameInput = document.querySelector("#voter-name");
const emailInput = document.querySelector("#voter-email");
const websiteInput = document.querySelector("#website");
const dialog = document.querySelector("#success-dialog");

document.querySelector("#ballot-label").textContent = config.ballotLabel || "Preseason Ballot";

function buildRanker() {
  rankList.innerHTML = Array.from({ length: 25 }, (_, index) => `
    <div class="rank-row" aria-label="Rank ${index + 1}">
      <span class="rank-number">${index + 1}</span>
      <div class="team-combobox">
        <input class="team-input" data-rank="${index + 1}" type="text" placeholder="Search for a team" autocomplete="off"
          role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="team-options-${index + 1}" />
        <ul class="team-options" id="team-options-${index + 1}" role="listbox"></ul>
      </div>
    </div>
  `).join("");
  document.querySelectorAll(".team-input").forEach(input => {
    input.addEventListener("input", () => {
      input.dataset.team = "";
      showTeamOptions(input);
      updateRanker();
    });
    input.addEventListener("focus", () => showTeamOptions(input));
    input.addEventListener("keydown", handleTeamKeys);
    input.addEventListener("blur", () => setTimeout(() => closeTeamOptions(input), 120));
  });
}

function getPicks() {
  return [...document.querySelectorAll(".team-input")].map(input => input.dataset.team || "");
}

function showTeamOptions(input) {
  const query = input.value.trim().toLowerCase();
  const used = new Set(getPicks().filter(team => team && team !== input.dataset.team));
  const matches = TEAMS.filter(team => !used.has(team) && team.toLowerCase().includes(query));
  const list = input.nextElementSibling;
  list.innerHTML = matches.length
    ? matches.map(team => `<li role="option" tabindex="-1" data-team="${team}">${team}</li>`).join("")
    : `<li class="no-results">No teams found</li>`;
  list.querySelectorAll("[data-team]").forEach(option => {
    option.addEventListener("mousedown", event => {
      event.preventDefault();
      selectTeam(input, option.dataset.team);
    });
  });
  input.setAttribute("aria-expanded", "true");
  list.classList.add("open");
}

function closeTeamOptions(input) {
  input.setAttribute("aria-expanded", "false");
  input.nextElementSibling.classList.remove("open");
  if (!input.dataset.team) input.value = "";
}

function selectTeam(input, team) {
  input.value = team;
  input.dataset.team = team;
  closeTeamOptions(input);
  updateRanker();
  const inputs = [...document.querySelectorAll(".team-input")];
  const nextInput = inputs[inputs.indexOf(input) + 1];
  if (nextInput && !nextInput.dataset.team) nextInput.focus();
}

function handleTeamKeys(event) {
  const input = event.currentTarget;
  const list = input.nextElementSibling;
  let options = [...list.querySelectorAll("[data-team]")];
  let active = list.querySelector(".active");
  let index = options.indexOf(active);

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!list.classList.contains("open")) {
      showTeamOptions(input);
      options = [...list.querySelectorAll("[data-team]")];
      active = list.querySelector(".active");
      index = options.indexOf(active);
    }
    const direction = event.key === "ArrowDown" ? 1 : -1;
    index = Math.max(0, Math.min(options.length - 1, index + direction));
    options.forEach(option => option.classList.remove("active"));
    if (options[index]) options[index].classList.add("active");
  } else if (event.key === "Enter" && active) {
    event.preventDefault();
    selectTeam(input, active.dataset.team);
  } else if (event.key === "Escape") {
    closeTeamOptions(input);
  }
}

function updateRanker() {
  const picks = getPicks();
  const selected = picks.filter(Boolean);
  countEl.textContent = selected.length;
  progressEl.style.width = `${selected.length * 4}%`;
  submitButton.disabled = selected.length !== 25;
  messageEl.textContent = selected.length === 25 ? "Your ballot is ready to submit." : `Choose ${25 - selected.length} more team${25 - selected.length === 1 ? "" : "s"}.`;
  messageEl.classList.remove("error");
}

function validIdentity() {
  if (!nameInput.value.trim()) {
    nameInput.focus();
    messageEl.textContent = "Please enter your name.";
    return false;
  }
  if (!emailInput.validity.valid || !emailInput.value.trim()) {
    emailInput.focus();
    messageEl.textContent = "Please enter a valid email.";
    return false;
  }
  return true;
}

async function submitBallot() {
  if (!validIdentity()) {
    messageEl.classList.add("error");
    return;
  }
  if (!config.endpoint) {
    messageEl.textContent = "This ballot needs its Google Apps Script URL added in config.js.";
    messageEl.classList.add("error");
    return;
  }

  submitButton.disabled = true;
  submitButton.innerHTML = "Submitting…";
  messageEl.textContent = "Sending your ballot securely…";
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        ballot: config.ballotLabel || "Preseason Ballot",
        picks: getPicks(),
        website: websiteInput.value,
      }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Submission failed");
    dialog.showModal();
    messageEl.textContent = result.updated ? "Your previous ballot was updated." : "Ballot submitted. Thank you!";
  } catch (error) {
    messageEl.textContent = "We couldn't submit that ballot. Please try again.";
    messageEl.classList.add("error");
    submitButton.disabled = false;
  } finally {
    submitButton.innerHTML = "Submit ballot <span>→</span>";
  }
}

submitButton.addEventListener("click", submitBallot);
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
buildRanker();
updateRanker();
