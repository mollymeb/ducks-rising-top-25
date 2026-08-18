const TEAMS = [
  "Air Force", "Akron", "Alabama", "Appalachian State", "Arizona", "Arizona State", "Arkansas", "Arkansas State", "Army", "Auburn",
  "Ball State", "Baylor", "Boise State", "Boston College", "Bowling Green", "Buffalo", "BYU",
  "California", "Central Michigan", "Charlotte", "Cincinnati", "Clemson", "Coastal Carolina", "Colorado", "Colorado State", "Connecticut",
  "Delaware", "Duke", "East Carolina", "Eastern Michigan", "FIU", "Florida", "Florida Atlantic", "Florida State", "Fresno State",
  "Georgia", "Georgia Southern", "Georgia State", "Georgia Tech", "Hawai'i", "Houston", "Illinois", "Indiana", "Iowa", "Iowa State",
  "Jacksonville State", "James Madison", "Kansas", "Kansas State", "Kent State", "Kentucky", "Kennesaw State", "Liberty", "Louisiana", "Louisiana Tech", "Louisville", "LSU",
  "Marshall", "Maryland", "Memphis", "Miami (FL)", "Miami (OH)", "Michigan", "Michigan State", "Middle Tennessee", "Minnesota", "Mississippi State", "Missouri", "Missouri State",
  "Navy", "NC State", "Nebraska", "Nevada", "New Mexico", "New Mexico State", "North Carolina", "North Texas", "Northern Illinois", "Northwestern", "Notre Dame",
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
const dialog = document.querySelector("#success-dialog");

document.querySelector("#ballot-label").textContent = config.ballotLabel || "Preseason Ballot";

function buildRanker() {
  const options = TEAMS.map(team => `<option value="${team}">${team}</option>`).join("");
  rankList.innerHTML = Array.from({ length: 25 }, (_, index) => `
    <label class="rank-row" aria-label="Rank ${index + 1}">
      <span class="rank-number">${index + 1}</span>
      <select class="team-select placeholder" data-rank="${index + 1}">
        <option value="">Select a team</option>${options}
      </select>
    </label>
  `).join("");
  document.querySelectorAll(".team-select").forEach(select => select.addEventListener("change", updateRanker));
}

function getPicks() {
  return [...document.querySelectorAll(".team-select")].map(select => select.value);
}

function updateRanker() {
  const picks = getPicks();
  const selected = picks.filter(Boolean);
  const used = new Set(selected);
  document.querySelectorAll(".team-select").forEach(select => {
    select.classList.toggle("placeholder", !select.value);
    [...select.options].forEach(option => {
      option.disabled = Boolean(option.value && used.has(option.value) && option.value !== select.value);
    });
  });
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
      }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Submission failed");
    dialog.showModal();
    messageEl.textContent = "Ballot submitted. Thank you!";
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
