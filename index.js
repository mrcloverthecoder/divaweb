// 
const IsDebug = true;      // NOTE: Remember to set this to false on release
const EnableAudio = false; // NOTE: Remember to set this to true on release
const DebugSongID = "d2";

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
        }
    });
    
    return barLength;
}

class GameScene extends Phaser.Scene
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
        
        for (let i = 0; i < 13; i++) {
            const num = i.toString().padStart(2, "0");
            this.load.image(getNoteSprName(i, "BTN"), "/sprites/PSB" + num + ".png");
            this.load.image(getNoteSprName(i, "TGT"), "/sprites/PST" + num + ".png");
        }

        this.load.image("Hand01", "/sprites/Hand01.png");
        this.load.image("Hand04", "/sprites/Hand04.png");
        this.load.image("Hand05", "/sprites/Hand05.png");
        this.load.image("Hand06", "/sprites/Hand06.png");
        this.load.image("Hand07", "/sprites/Hand07.png");
        this.load.image("Kiseki01", "/sprites/Kiseki01.png");

        if (EnableAudio) {
            this.load.audio("music", "/default/song/d1/music.mp3");
            this.load.audio("commonNoteSE", "/sound/NoteSE_01.wav");
            this.load.audio("arrowNoteSE", "/sound/NoteSE_02.wav");
        }
    }

    create()
    {
        if (IsDebug) {
            this.dbgTimeTxt = this.add.text(10, 10, "time: 0.0");
            this.dbgNoteRank = "none"
            this.dbgRankTxt = this.add.text(10, 30, "");
            this.dbgComboTxt = this.add.text(10, 50, "combo: 0");
        }

        this.initInput();

        this.notesSpawned = []
        this.chartTimer = new HighResolutionTimer();

        this.gameStarted = false;
        
        if (IsDebug) {
            this.meshDebug = this.add.graphics();
            
        }
    }

    update()
    {
        if (IsDebug) {
            this.meshDebug.clear();
            this.meshDebug.lineStyle(1, 0x00ff00);
        }

        // NOTE: Check if WebAudio context isn't unavailable
        if (this.game.sound.locked) {
            return;
        }

        if (!this.chartLoaded) { return; }
        else if (this.chartLoaded && !this.gameStarted) {
            this.chartTimer.start();
            this.gameStarted = true;
        }

        this.updateInput();
        this.playNoteSE = "none";
        this.chartTime = this.chartTimer.getEllapsed();

        // NOTE: Check for inputs to see if note SE should be played
        for (let i = 0; i < 4; i++) {
            if (this.divaInput.isKeyTapped(FaceKeyMap[i]) || this.divaInput.isKeyTapped(ArrowKeyMap[i])) {
                this.playNoteSE = "commonNoteSE";
            }
        }

        if (EnableAudio) {
            // NOTE: Play song after it's offset has been reached
            if (this.chartTime >= this.chart["song_offset"] && !this.musicPlaying) {
                this.sound.play("music");
                this.musicPlaying = true;
            }
        }

        this.chart["notes"].every((note, noteIndex) => {
            if (!note.hasOwnProperty("added")) {
                note.added = false;
                note.state = NS_NONE;
                note.hitStatus = NJ_NONE;
            }

            const windowStart = note["time"] - BadWindow;
            const windowEnd = note["time"] + BadWindow;

            if (note.state == NS_NONE && this.chartTime >= windowStart && this.chartTime <= windowEnd) {
                note.state = NS_POLLING;
            }
            
            if (note.state == NS_POLLING || note.state == NS_HOLDING) {
                processNoteHit(this, this.divaInput,this.chartTime, this.chart, note, noteIndex);

                // TEMPORARY
                if (note.hitStatus != NJ_NONE) {
                    this.dbgNoteRank = note.hitStatus;
                }
                
                // TEMPORARY
                if (!isNoteLong(note.type)) {
                    return false;
                }
            }

            return true;
        });

        this.updateNotes();

        if (EnableAudio && this.playNoteSE != "none") {
            this.sound.play(this.playNoteSE);
        }

        if (IsDebug) {
            this.dbgTimeTxt.text = "time: " + (this.chartTime / 1000.0).toFixed(2);
            this.dbgRankTxt.text = "rank: " + this.dbgNoteRank;
            this.dbgComboTxt.text = "combo: " + gameState.combo + " / " + gameState.maxCombo;
        }
    }

    updateNotes()
    {
        if (this.chartLoaded == false)
            return;

        const flyingTime = getFlyingTime(this.chartTime, this.chart);
        this.chart["notes"].forEach((note, noteIndex) => {
            const noteSpawnTime = note["time"] - flyingTime;
            const noteHitTime = note["time"];
            const noteDespawnBeginTime = noteHitTime + SafeWindow;
            const noteDespawnTime = noteDespawnBeginTime + NoteVanishLength;
            
            if (this.chartTime >= noteSpawnTime) {
                if (!note.added) {
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

                    noteObject.hand = this.add.image(
                        targetScaledPos[0],
                        targetScaledPos[1],
                        isNoteDouble(note.type) ? getNoteSprName(note.type, "Hand") : "Hand01"
                    );

                    noteObject.hand.setDisplayOrigin(10, 47);
                    noteObject.hand.setScale(0.75, 0.75);

                    // NOTE: Create the note's kiseki mesh
                    //
                    noteObject.kiseki = this.add.mesh(
                        768 / 2,
                        432 / 2,
                        "Kiseki01"
                    );

                    if (IsDebug) { noteObject.kiseki.setDebug(this.meshDebug); }
                    // NOTE: Required so that the mesh faces are updated every frame
                    noteObject.kiseki.ignoreDirtyCache = true;
                    noteObject.kiseki.hideCCW = false;
                    
                    // NOTE: Position is updated further down
                    //       
                    noteObject["button"] = this.add.image(0.0, 0.0, getNoteSprName(note["type"], "BTN"));

                    noteObject["target"].setDisplaySize(46, 46);
                    noteObject["button"].setDisplaySize(46, 46);

                    // NOTE: Set Z index so that buttons always appear on top of targets
                    noteObject.target.depth = 100;
                    noteObject.hand.depth   = 100;
                    noteObject.kiseki.depth = 101;
                    noteObject.button.depth = 105;

                    this.noteObjects.push(noteObject);
                    note.added = true;
                }

                // NOTE: Update kiseki mesh
                //
                if (this.noteObjects[noteIndex].kiseki != null) {
                    if (!isNoteLong(note.type) || (isNoteLong(note.type) && !note.isRelease)) {
                        const kisekiMeshData = calculateKiseki(note, flyingTime, this.chartTime);
                        this.noteObjects[noteIndex].kiseki.clear().addVertices(
                            kisekiMeshData.vertices,
                            kisekiMeshData.uvs,
                            kisekiMeshData.indices,
                            false, // Has Z
                            null,  // Normals
                            kisekiMeshData.colors,
                            kisekiMeshData.alphas
                        );

                        // NOTE: The update function must be called manually when updating the mesh's
                        //       content every frame.
                        this.noteObjects[noteIndex].kiseki.preUpdate();
                        this.noteObjects[noteIndex].kiseki.hideCCW = false;
                        this.noteObjects[noteIndex].kiseki.setOrtho(768, 432);
                    }
                }

                let handRot = lerp2(0, 360, note.time - flyingTime, note.time, this.chartTime);

                // NOTE: Update note button position
                let buttonPos = getNoteButtonPosition(this.chartTime, flyingTime, note);
                if (isNoteLong(note.type) && note.state == NS_HOLDING) {
                    buttonPos = [note.posX, note.posY];
                    handRot = 0.0;
                }
                
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

                this.noteObjects[noteIndex].hand.setRotation(degToRad(handRot));

                // NOTE: Do the note's "shrinking" exit animation once it's past it's hit time
                if (note.state == NS_VANISHING) {
                    const scale = 1.0 - (this.chartTime - noteDespawnBeginTime) / NoteVanishLength;
                    this.noteObjects[noteIndex]["target"].setDisplaySize(46 * scale, 46 * scale);
                    this.noteObjects[noteIndex]["button"].setDisplaySize(46 * scale, 46 * scale);
                    this.noteObjects[noteIndex].hand.setScale(0.75 * scale, 0.75 * scale);

                    if (scale <= 0.0) {
                        note.state = NS_DEAD;
                    }
                }

                if (note.state == NS_DEAD) {
                    this.noteObjects[noteIndex]["target"].visible = false;
                    this.noteObjects[noteIndex]["button"].visible = false;
                    this.noteObjects[noteIndex].hand.visible = false;

                    if (this.noteObjects[noteIndex].kiseki != null) {
                        this.noteObjects[noteIndex].kiseki.destroy();
                        this.noteObjects[noteIndex].kiseki = null;
                    }
                }
            }
        });
    }

    // Phaser's input functions didn't have some stuff I needed (or maybe I just didn't look
    // far enough into the documentation), so I decided to make my own sort of "wrapper" around it.
    //
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

        this.divaInput.isKeyUp = function(k) { return !this[k]["cur"]; }
        this.divaInput.isKeyDown = function(k) { return this[k]["cur"]; }
        this.divaInput.isKeyTapped = function(k) { return this[k]["cur"] && !this[k]["prev"]; }
        this.divaInput.isKeyReleased = function(k) { return !this[k]["cur"] && this[k]["prev"]; }
        this.divaInput.isAnyKeyTapped = function(...ks)
        {
            let cond = false;
            for (const k of ks) {
                cond |= this.isKeyTapped(k);
            }
    
            return cond;
        }

        this.divaInput.isAnyKeyReleased = function(...ks)
        {
            let cond = false;
            for (const k of ks) {
                cond |= this.isKeyReleased(k);
            }
    
            return cond;
        }
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
    scene: GameScene
};

const game = new Phaser.Game(config);