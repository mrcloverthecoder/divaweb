
// NOTE STATES
const NS_NONE = "none";       // Hasn't appeared on screen yet
const NS_POLLING = "poll";  // Waiting for input
const NS_HOLDING = "hold";    // Long note is being held down
const NS_VANISHING = "die";   // Note shrinking animation is in course
const NS_DEAD = "dead";       // Disappear from screen

// NOTE JUDGEMENTS
const NJ_NONE  = "none";
const NJ_COOL  = "cool";
const NJ_FINE  = "fine";
const NJ_SAFE  = "safe";
const NJ_BAD   = "bad";
const NJ_WORST = "worst";

// NOTE TYPES
const NT_TRIANGLE = 0;
const NT_CIRCLE   = 1;
const NT_CROSS    = 2;
const NT_SQUARE   = 3;
const NT_TRIANGLE_W = 4;
const NT_CIRCLE_W   = 5;
const NT_CROSS_W    = 6;
const NT_SQUARE_W   = 7;
const NT_TRIANGLE_LONG = 8;
const NT_CIRCLE_LONG   = 9;
const NT_CROSS_LONG    = 10;
const NT_SQUARE_LONG   = 11;
const NT_STAR          = 12;
const NT_STAR_LONG     = 13;
const NT_STAR_W        = 14;

// INPUT 
const FaceKeyMap  = ["tri", "circle", "cross", "square"];
const ArrowKeyMap = ["up",  "right",  "down",  "left"];

// GLOBAL GAME STATE
let gameState = {
    combo: 0,
    maxCombo: 0
}

// HELPER FUNCTIONS
function isNoteLong(type) { return type >= NT_TRIANGLE_LONG && type <= NT_SQUARE_LONG; }
function isNoteDouble(type) { return type >= NT_TRIANGLE_W && type <= NT_SQUARE_W; }

function getNoteButtonPosition(time, flyingTime, note, offsetX = 0.0, offsetY = 0.0) {
    const targetAppearTime = note["time"] - flyingTime;
    const timeProgress = (time - targetAppearTime) / flyingTime;
    const invTimeProgress = 1.0 - timeProgress; // NOTE: Distance delta to hit time

    // NOTE: Convert degrees to radians
    const noteAngle = note["angle"] * (Math.PI / 180.0);

    let notePosDelta = new Phaser.Math.Vector2(
        // PS:   Thanks EIRexe from EIRteam for this math.
        Math.sin(invTimeProgress * Math.PI * note["frequency"]) / 12.0 * note["amplitude"] + offsetX,
        // NOTE: Invert distance so that (hit position + delta y) comes from *top* and not
        //       from the bottom. This was originally a little different in EIRexe's code,
        //       I think he managed to get the same result but with slightly different approach.
        //       With how he did it, DIVA angles would look off (by about 90 degrees, I think).
        invTimeProgress * -note["distance"] + offsetY
    ).rotate(noteAngle);

    return [note["posX"] + notePosDelta.x, note["posY"] + notePosDelta.y];
}

//
function resetGameState() {
    gameState.combo = 0;
    gameState.maxCombo = 0;
}

function processNoteHit(scene, input, time, chart, note, noteIndex) {
    let noteWasHit = false;

    // --- Normal notes ---
    // 0 - Triangle
    // 1 - Circle
    // 2 - Cross
    // 3 - Square
    if (note.type >= 0 && note.type < 4) {
        if (input.isAnyKeyTapped(FaceKeyMap[note.type], ArrowKeyMap[note.type])) {
            noteWasHit = true;
            note.state = NS_DEAD;
        }
    }
    // --- Double notes ---
    // 4 - Up W
    // 5 - Right W
    // 6 - Down W
    // 7 - Left W
    else if (note.type >= 4 && note.type < 8) {
        const index = note.type - 4;
        const wCond1 = input.isKeyTapped(FaceKeyMap[index]) && input.isKeyDown(ArrowKeyMap[index]);
        const wCond2 = input.isKeyTapped(ArrowKeyMap[index]) && input.isKeyDown(FaceKeyMap[index]);

        if (wCond1 || wCond2) {
            // this.playNoteSE = "arrowNoteSE";
            noteWasHit = true;
            note.state = NS_DEAD;
        }
    }
    // --- Long notes ---
    // 8  - Long Triangle
    // 9  - Long Circle
    // 10 - Long Cross
    // 11 - Long Square
    else if (note.type >= 8 && note.type < 12) {
        const index = note.type - 8;

        if (note.isRelease) {
            if (input.isAnyKeyReleased(FaceKeyMap[index], ArrowKeyMap[index])) {
                noteWasHit = true;
                note.state = NS_DEAD;

                // NOTE: This means there cannot be any notes in between long notes.
                // TODO: *Even though it's not recommended to do this*, I think it
                //       should be programatically allowed.
                chart.notes[noteIndex - 1].state = NS_DEAD;
            }
        }
        else {
            if (note.state != NS_HOLDING) {
                if (input.isAnyKeyTapped(FaceKeyMap[index], ArrowKeyMap[index])) {
                    note.state = NS_HOLDING;
                    noteWasHit = true;
                }
            }
            else {
                if (!input.isKeyDown(FaceKeyMap[index])) {
                    note.state = NS_DEAD;
                    chart.notes[noteIndex + 1].state = NS_DEAD;
                    chart.notes[noteIndex + 1].hitStatus = "worst";
                }
            }
        }
    }

    if (noteWasHit) {
        // NOTE: Evaluate note hit 
        const noteHitTime = time - note.time;

        if (noteHitTime <= CoolWindow && noteHitTime >= -CoolWindow) {
            note.hitStatus = NJ_COOL;
            gameState.combo += 1;
        }
        else if (noteHitTime <= FineWindow && noteHitTime >= -FineWindow) {
            note.hitStatus = NJ_FINE;
            gameState.combo += 1;
        }
        else if (noteHitTime <= SafeWindow && noteHitTime >= -SafeWindow) {
            note.hitStatus = NJ_SAFE;
            gameState.combo += 1;
        }
        else if (noteHitTime <= BadWindow && noteHitTime >= -BadWindow) {
            note.hitStatus = NJ_BAD;
            gameState.combo = 0;
        }
    }

    if (time >= note.time + BadWindow && note.hitStatus == NJ_NONE) {
        gameState.combo = 0;
        note.hitStatus = NJ_WORST;

        if (isNoteLong(note.type)) {
            if (!note.isRelease && note.state != NS_HOLDING) {
                note.state = NS_DEAD;

                if (isNoteLong(note.type) && !note.isRelease) {
                    chart.notes[noteIndex + 1].state = NS_DEAD;
                    chart.notes[noteIndex + 1].hitStatus = NJ_WORST;
                }
            }
            else if (note.isRelease) {
                note.state = NS_VANISHING;
                chart.notes[noteIndex - 1].state = NS_DEAD;
            }
        }
        else {
            note.state = NS_VANISHING;
        }
    }

    if (gameState.combo > gameState.maxCombo) {
        gameState.maxCombo = gameState.combo;
    }
}