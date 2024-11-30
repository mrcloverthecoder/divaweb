
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

// INPUT 
const FaceKeyMap  = ["tri", "circle", "cross", "square"];
const ArrowKeyMap = ["up",  "right",  "down",  "left"];

// HELPER FUNCTIONS
function isNoteLong(type) { return type >= 8 && type < 12; }

//
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
        }
        else if (noteHitTime <= FineWindow && noteHitTime >= -FineWindow) {
            note.hitStatus = NJ_FINE;
        }
        else if (noteHitTime <= SafeWindow && noteHitTime >= -SafeWindow) {
            note.hitStatus = NJ_SAFE;
        }
        else if (noteHitTime <= BadWindow && noteHitTime >= -BadWindow) {
            note.hitStatus = NJ_BAD;
        }
    }

    if (time >= note.time + BadWindow && note.hitStatus == NJ_NONE) {
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
}