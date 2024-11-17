// 
const IsDebug = true;
const DebugSongID = "d1";

const SongStorageDirs = ["/default/song"];

//
//
//
//
//

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
        }

        this.notesSpawned = []
        this.chartTimer = this.time.addEvent({
            delay: 1000.0 / 60.0,
            callback: this.updateNotes,
            args: [],
            callbackScope: this,
            loop: true,
        });
    }

    update()
    {
        if (IsDebug) {
            this.dbgTimeTxt.text = "time: " + (this.chartTime / 1000.0).toFixed(2);
        }
    }

    updateNotes()
    {
        if (this.chartLoaded == false)
            return;

        this.chartTime += 1000.0 / 60.0;
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
            const noteDespawnTime = note["time"] + 100;
            
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