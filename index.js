// 
const IsDebug = true;
const DebugSongID = "d1";

const SongStorageDirs = ["/default/song"];

//
//
//
//
//

const CoolWindow = 30;
const FineWindow = 70;
const SafeWindow = 100;
const BadWindow  = 130;
const NoteVanishLength = 133;

// NOTE: Phaser helper functions
function getNoteSprName(noteType, sprType) {
    return sprType + noteType.toString().padStart(2, "0");
}

function getCanvasScaledNotePos(posX, posY, targetW, targetH) {
    const noteCanvasWidth = 1920.0;
    const noteCanvasHeight = 1080.0;

    return [
        targetW * (posX / noteCanvasWidth),
        targetH * (posY / noteCanvasHeight)
    ];
}

// NOTE: Rhythm game timing functions
function getFlyingTime(time, chart) {
    let barLength = 0;

    chart["tempo"].forEach((tempo) => {
        if (time >= tempo["time"]) {
            barLength = tempo["flyingTime"];
            // barLength = 60.0 / tempo["bpm"] * tempo["signature"] * 1000.0;
            // barLength *= tempo["factor"];
        }
    });
    
    return barLength;
}

function getNoteButtonPosition(time, flyingTime, note) {
    const targetAppearTime = note["time"] - flyingTime;
    const timeProgress = (time - targetAppearTime) / flyingTime;
    const invTimeProgress = 1.0 - timeProgress; // NOTE: Distance delta to hit time

    // NOTE: Convert degrees to radians
    const noteAngle = note["angle"] * (Math.PI / 180.0);

    const notePosDelta = new Phaser.Math.Vector2(
        // PS:   Thanks EIRexe from EIRteam for this math.
        Math.sin(invTimeProgress * Math.PI * note["frequency"]) / 12.0 * note["amplitude"],
        // NOTE: Invert distance so that (hit position + delta y) comes from *top* and not
        //       from the bottom. This was originally a little different in EIRexe's code,
        //       I think he managed to get the same result but with slightly different approach.
        //       With how he did it, DIVA angles would look off (by about 90 degrees, I think).
        invTimeProgress * -note["distance"]
    ).rotate(noteAngle);

    return [note["posX"] + notePosDelta.x, note["posY"] + notePosDelta.y]
}

class Example extends Phaser.Scene
{
    preload()
    {
        this.noteObjects = []; // Phaser

        this.chartLoaded = false;
        this.chart = {};
        fetch("/default/song/" + DebugSongID + "/normal.json")
            .then((response) => response.json())
            .then((json) => {
                this.chart = json;
                this.chartLoaded = true;
            });
       
        this.chartTime = 0.0;
        
        for (let i = 0; i < 13; i++)
        {
            const num = i.toString().padStart(2, "0");
            this.load.image(getNoteSprName(i, "BTN"), "/sprites/PSB" + num + ".png");
            this.load.image(getNoteSprName(i, "TGT"), "/sprites/PST" + num + ".png");
        }
    }

    create()
    {
        if (IsDebug) {
            this.dbgTimeTxt = this.add.text(10, 10, "time: 0.0");
            this.dbgNoteRank = "none"
            this.dbgRankTxt = this.add.text(10, 30, "");
        }

        this.initInput();

        this.notesSpawned = []
        this.chartTimer = new HighResolutionTimer();
        this.chartTimer.start();
    }

    update()
    {
        this.updateInput();
        this.chartTime = this.chartTimer.getEllapsed();

        if (this.chartLoaded) {
            this.chart["notes"].every((note, noteIndex) => {
                const windowStart = note["time"] - BadWindow;
                const windowEnd = note["time"] + BadWindow;

                // NOTE: This check makes multi-notes impossible to hit, as it will only allow
                //       a single note to be checked each frame. That's fine for now, because
                //       I only plan on adding F-style charts, but I should definitely seek
                //       for a better way to do this.
                //
                // TODO: What can I do to improve this check?
                if (this.chartTime >= windowStart && this.chartTime <= windowEnd && !note["dead"]) {
                    this.processNoteHit(this.chart, note, noteIndex);

                    // NOTE: Return false to break the loop after the first note
                    //       matching the conditions is met
                    return false;
                }

                return true;
            });
        }

        this.updateNotes();

        if (IsDebug) {
            this.dbgTimeTxt.text = "time: " + (this.chartTime / 1000.0).toFixed(2);
            this.dbgRankTxt.text = "rank: " + this.dbgNoteRank;
        }
    }

    updateNotes()
    {
        if (this.chartLoaded == false)
            return;

        const flyingTime = getFlyingTime(this.chartTime, this.chart);
        this.chart["notes"].forEach((note, noteIndex) => {
            if (!note.hasOwnProperty("added")) {
                note["added"] = false;
            }

            if (!note.hasOwnProperty("dead")) {
                note["dead"] = false;
            }

            const noteSpawnTime = note["time"] - flyingTime;
            const noteHitTime = note["time"];
            const noteDespawnBeginTime = noteHitTime + SafeWindow;
            const noteDespawnTime = noteDespawnBeginTime + NoteVanishLength;
            
            if (this.chartTime >= noteSpawnTime) {
                if (!note["added"]) {
                    let noteObject = {};

                    const targetScaledPos = getCanvasScaledNotePos(
                        note["posX"],
                        note["posY"],
                        this.sys.game.scale.gameSize["width"],
                        this.sys.game.scale.gameSize["height"]
                    );

                    noteObject["target"] = this.add.image(
                        targetScaledPos[0],
                        targetScaledPos[1],
                        getNoteSprName(note["type"], "TGT")
                    );
                    
                    // NOTE: Position is updated further down
                    //       
                    noteObject["button"] = this.add.image(0.0, 0.0, getNoteSprName(note["type"], "BTN"));

                    noteObject["target"].setDisplaySize(46, 46);
                    noteObject["button"].setDisplaySize(46, 46);

                    // NOTE: Set Z index so that buttons always appear on top of targets
                    noteObject["target"].depth = 99;
                    noteObject["button"].depth = 100;

                    this.noteObjects.push(noteObject);
                    note["added"] = true;
                }

                // NOTE: Update note button position
                const buttonPos = getNoteButtonPosition(this.chartTime, flyingTime, note);
                const buttonScaledPos = getCanvasScaledNotePos(
                    buttonPos[0],
                    buttonPos[1],
                    this.sys.game.scale.gameSize["width"],
                    this.sys.game.scale.gameSize["height"]
                );

                this.noteObjects[noteIndex]["button"].setPosition(
                    buttonScaledPos[0],
                    buttonScaledPos[1]
                );

                // NOTE: Do the note's "shrinking" exit animation once it's past it's hit time
                if (this.chartTime >= noteDespawnBeginTime && this.chartTime < noteDespawnTime) {
                    const scale = 1.0 - (this.chartTime - noteDespawnBeginTime) / NoteVanishLength;
                    this.noteObjects[noteIndex]["target"].setDisplaySize(46 * scale, 46 * scale);
                    this.noteObjects[noteIndex]["button"].setDisplaySize(46 * scale, 46 * scale);
                }

                //
                //

                if (this.chartTime >= noteDespawnTime && note["added"] && !note["dead"]) {
                    this.noteObjects[noteIndex]["target"].visible = false;
                    this.noteObjects[noteIndex]["button"].visible = false;
                    note["dead"] = true;
                }
            }
        });
    }

    processNoteHit(chart, note, noteIndex)
    {
        const faceKeyMap  = ["tri", "circle", "cross", "square"];
        const arrowKeyMap = ["up", "right", "down", "left"];

        const noteType = note["type"];
        let noteWasHit = false;

        // --- Normal notes ---
        // 0 - Triangle
        // 1 - Circle
        // 2 - Cross
        // 3 - Square
        if (noteType >= 0 && noteType < 4) {
            if (this.isKeyTapped(faceKeyMap[noteType]) || this.isKeyTapped(arrowKeyMap[noteType])) {
                console.log("oi!");
                noteWasHit = true;
            }
        }
        // --- Double notes ---
        // 4 - Up W
        // 5 - Right W
        // 6 - Down W
        // 7 - Left W
        else if (noteType >= 4 && noteType < 8) {
            const index = noteType - 4;
            const wCond1 = this.isKeyTapped(faceKeyMap[index]) && this.isKeyDown(arrowKeyMap[index]);
            const wCond2 = this.isKeyTapped(arrowKeyMap[index]) && this.isKeyDown(faceKeyMap[index]);

            if (wCond1 || wCond2) {
                console.log("oi 2!");
                noteWasHit = true;
            }
        }

        if (noteWasHit) {
            // NOTE: Evaluate note hit 
            const noteHitTime = this.chartTime - note["time"];

            if (noteHitTime <= CoolWindow && noteHitTime >= -CoolWindow) {
                this.dbgNoteRank = "cool";
            }
            else if (noteHitTime <= FineWindow && noteHitTime >= -FineWindow) {
                this.dbgNoteRank = "fine";
            }
            else if (noteHitTime <= SafeWindow && noteHitTime >= -SafeWindow) {
                this.dbgNoteRank = "safe";
            }
            else if (noteHitTime <= BadWindow && noteHitTime >= -BadWindow) {
                this.dbgNoteRank = "bad";
            }

            // NOTE: Hide visual note sprite
            this.noteObjects[noteIndex]["target"].visible = false;
            this.noteObjects[noteIndex]["button"].visible = false;
            note["dead"] = true;
        }
    }

    // Phaser's input functions didn't have some stuff I needed (or maybe I just didn't look
    // far enough into the documentation), so I decided to make my own sort of "wrapper" around it.
    //
    isKeyUp(k) { return !this.divaInput[k]["cur"]; }
    isKeyDown(k) { return this.divaInput[k]["cur"]; }
    isKeyTapped(k) { return this.divaInput[k]["cur"] && !this.divaInput[k]["prev"]; }
    isKeyReleased(k) { return !this.divaInput[k]["cur"] && this.divaInput[k]["prev"]; }

    initInput()
    {
        this.divaInput = {};
        this.divaInput["tri"] = { "prev": false, "cur": false };
        this.divaInput["circle"] = { "prev": false, "cur": false };
        this.divaInput["cross"] = { "prev": false, "cur": false };
        this.divaInput["square"] = { "prev": false, "cur": false };
        this.divaInput["up"] = { "prev": false, "cur": false };
        this.divaInput["right"] = { "prev": false, "cur": false };
        this.divaInput["down"] = { "prev": false, "cur": false };
        this.divaInput["left"] = { "prev": false, "cur": false };

        this.keyTriangle = this.input.keyboard.addKey("I");
        this.keyCircle = this.input.keyboard.addKey("L");
        this.keyCross = this.input.keyboard.addKey("K");
        this.keySquare = this.input.keyboard.addKey("J");

        this.keyUp = this.input.keyboard.addKey("W");
        this.keyRight = this.input.keyboard.addKey("D");
        this.keyDown = this.input.keyboard.addKey("S");
        this.keyLeft = this.input.keyboard.addKey("A");
    }

    updateInput()
    {
        this.divaInput["tri"]["prev"] = this.divaInput["tri"]["cur"];
        this.divaInput["tri"]["cur"]  = this.keyTriangle.isDown;

        this.divaInput["circle"]["prev"] = this.divaInput["circle"]["cur"];
        this.divaInput["circle"]["cur"]  = this.keyCircle.isDown;
        
        this.divaInput["cross"]["prev"] = this.divaInput["cross"]["cur"];
        this.divaInput["cross"]["cur"]  = this.keyCross.isDown;

        this.divaInput["square"]["prev"] = this.divaInput["square"]["cur"];
        this.divaInput["square"]["cur"]  = this.keySquare.isDown;

        this.divaInput["up"]["prev"] = this.divaInput["up"]["cur"];
        this.divaInput["up"]["cur"]  = this.keyUp.isDown;

        this.divaInput["right"]["prev"] = this.divaInput["right"]["cur"];
        this.divaInput["right"]["cur"]  = this.keyRight.isDown;
        
        this.divaInput["down"]["prev"] = this.divaInput["down"]["cur"];
        this.divaInput["down"]["cur"]  = this.keyDown.isDown;

        this.divaInput["left"]["prev"] = this.divaInput["left"]["cur"];
        this.divaInput["left"]["cur"]  = this.keyLeft.isDown;
    }
}

const config = {
    type: Phaser.AUTO,
    width: 768,
    height: 432,
    scene: Example,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 200 }
        }
    }
};

const game = new Phaser.Game(config);