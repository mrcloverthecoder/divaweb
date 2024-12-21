// 
const IsDebug = true;      // NOTE: Remember to set this to false on release
const EnableAudio = true; // NOTE: Remember to set this to true on release
const DebugSongID = "r000";

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

//
//
//
//

const SpriteScale = {
    sourceRes: [1280, 728],
    handScale: [1.23, 1.23],
    handScaleSp: [0.75, 0.75],
    defaultTargetScale: [1.13, 1.13],
    defaultButtonScale: [1.13, 1.13],
    targetAppearScale: [1.23, 1.23],

    notes: {

    }
}

// NOTE: Phaser helper functions
function getNoteSprite(noteType, sprType) {
    if (noteType == NT_STAR_SP || noteType == NT_STAR_SP2) {
        // NOTE: Temporarily just using the fail sprite
        if (sprType == "BTN") {
            return "BStarFail";
        }
        else if (sprType == "TGT") {
            return "TStarFail"
        }
    }

    if (sprType == "Hand") {
        if (noteType == NT_STAR_SP || noteType == NT_STAR_SP2) {
            return "Hand15";
        }
        else if (!isNoteDouble(noteType)) {
            return "Hand01";
        }
    }

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
                this.chart = preprocessChart(json);
                this.chartLoaded = true;
            });
       
        this.chartTime = 0.0;
        
        for (let i = 0; i < 13; i++) {
            const num = i.toString().padStart(2, "0");
            this.load.image("BTN" + num, "/sprites/PSB" + num + ".png");
            this.load.image("TGT" + num, "/sprites/PST" + num + ".png");
        }

        this.load.image("TStarFail", "/sprites/Target_StarFail.png");
        this.load.image("BStarFail", "/sprites/Button_StarFail.png");
        this.load.image("TStarSuccess", "/sprites/Target_StarSuccess.png");
        this.load.image("BStarSuccess", "/sprites/Button_StarSuccess.png");
        this.load.image("Hand01", "/sprites/Hand01.png");
        this.load.image("Hand04", "/sprites/Hand04.png");
        this.load.image("Hand05", "/sprites/Hand05.png");
        this.load.image("Hand06", "/sprites/Hand06.png");
        this.load.image("Hand07", "/sprites/Hand07.png");
        this.load.image("Hand15", "/sprites/Hand15.png");
        this.load.image("Kiseki01", "/sprites/Kiseki01.png");

        if (EnableAudio) {
            this.load.audio("music", "/default/song/" + DebugSongID + "/music.mp3");
            this.load.audio("commonNoteSE", "/sound/NoteSE_01.wav");
            this.load.audio("arrowNoteSE", "/sound/NoteSE_02.wav");
            this.load.audio("starNoteSE", "/sound/NoteSE_03.wav");
            this.load.audio("spNoteSE", "/sound/NoteSE_Cymbal.wav");
        }
    }

    create()
    {
        if (IsDebug) {
            this.dbgTimeTxt = this.add.text(10, 10, "time: 0.0");
            this.dbgNoteRank = "none"
            this.dbgRankTxt = this.add.text(10, 30, "");
            this.dbgComboTxt = this.add.text(10, 50, "combo: 0");
            this.dbgChanceTxt = this.add.text(10, 70, "chance: 0%");
        }

        this.notesSpawned = []
        this.chartTimer = new HighResolutionTimer();

        this.gameStarted = false;

        this.inputMgr = new InputManager();
        this.inputMgr.init(this);

        resetGameState(this.chart);

        if (EnableAudio) {
            this.buttonSE  = this.sound.add("commonNoteSE");
            this.doubleSE  = this.sound.add("arrowNoteSE");
            this.touchSE   = this.sound.add("starNoteSE");
            this.specialSE = this.sound.add("spNoteSE");
        }
        
        if (IsDebug) {
            this.meshDebug = this.add.graphics();
        }
    }

    update()
    {
        this.gameWidth  = this.sys.game.scale.gameSize.width;
        this.gameHeight = this.sys.game.scale.gameSize.height;

        this.inputMgr.update(this);

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

        gameState.frame.noteSE = SE_NONE;
        this.chartTime = this.chartTimer.getEllapsed();

        // NOTE: Check for inputs to see if note SE should be played
        for (let i = 0; i < 4; i++) {
            if (this.inputMgr.isActionTapped(FaceKeyMap[i]) || this.inputMgr.isActionTapped(ArrowKeyMap[i])) {
                gameState.frame.noteSE = SE_BUTTON;
            }

            if (this.inputMgr.isAnyActionTapped("starL", "starR")) {
                gameState.frame.noteSE = SE_TOUCH;
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
                processNoteHit(this, this.inputMgr, this.chartTime, this.chart, note, noteIndex);

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

        if (EnableAudio) {
            if (gameState.frame.noteSE == SE_BUTTON) {
                this.buttonSE.play();
            }
            else if (gameState.frame.noteSE == SE_DOUBLE) {
                this.doubleSE.play();
            }
            else if (gameState.frame.noteSE == SE_TOUCH) {
                this.touchSE.play({ volume: 0.45 });
            }
            else if (gameState.frame.noteSE == SE_TOUCH_SP) {
                this.specialSE.play({ volume: 0.7 });
            }
        }

        if (IsDebug) {
            this.dbgTimeTxt.text = "time: " + (this.chartTime / 1000.0).toFixed(2);
            this.dbgRankTxt.text = "rank: " + this.dbgNoteRank;
            this.dbgComboTxt.text = "combo: " + gameState.combo + " / " + gameState.maxCombo;

            //
            //
            const ev = getCurrentEvent(this.chart, this.chartTime);
            if (ev != null) {
                const eventState = gameState.events[ev.index];

                if (ev.name == EV_CHANCE_TIME) {
                    this.dbgChanceTxt.text = "Chance Time: " + Math.round(gameState.chancePercentage) + "%";
                }
                else if (ev.name == EV_TECH_ZONE) {
                    this.dbgChanceTxt.text = "Tech Zone: " + eventState.notesHit + " / " + eventState.noteCount;
                    if (eventState.notesHit == eventState.noteCount) {
                        this.dbgChanceTxt.text += " [SUCCESS!]";
                    }
                    else if (eventState.failed) {
                        this.dbgChanceTxt.text += " [FAILED!]";
                    }
                    else {
                        this.dbgChanceTxt.text += " [IN PROGRESS]";
                    }
                }
            }
            else {
                const nextEvent = getNextEvent(this.chart, this.chartTime, null);
                if (nextEvent != null) {
                    const timeRemaining = Math.round((nextEvent.start - this.chartTime) / 1000);
                    this.dbgChanceTxt.text = timeRemaining + "s until ";
                    this.dbgChanceTxt.text += (nextEvent.name == EV_CHANCE_TIME) ? "Chance Time" : "Technical Zone"; 
                }
                else {
                    this.dbgChanceTxt.text = "No event";
                }
            }
        }
    }

    updateNotes()
    {
        if (this.chartLoaded == false)
            return;

        const sprResScale = [
            this.gameWidth / SpriteScale.sourceRes[0],
            this.gameHeight / SpriteScale.sourceRes[1]
        ];

        const flyingTime = getFlyingTime(this.chartTime, this.chart);
        this.chart.notes.forEach((note, noteIndex) => {
            const noteSpawnTime = note["time"] - flyingTime;
            const noteHitTime = note["time"];
            const noteDespawnBeginTime = noteHitTime + SafeWindow;
            
            if (this.chartTime >= noteSpawnTime) {
                if (!note.added) {
                    let noteObject = {};

                    const targetScaledPos = getCanvasScaledNotePos(
                        note.posX,
                        note.posY,
                        this.gameWidth,
                        this.gameHeight
                    );

                    const buttonSprScale = SpriteScale.notes.hasOwnProperty(note.type) ? SpriteScale.notes[note.type].buttonBaseScale : SpriteScale.defaultButtonScale; 
                    const targetSprScale = SpriteScale.notes.hasOwnProperty(note.type) ? SpriteScale.notes[note.type].targetBaseScale : SpriteScale.defaultTargetScale;

                    // NOTE: The button's position is updated further down
                    //       
                    noteObject.button = this.add.image(0.0, 0.0, getNoteSprite(note["type"], "BTN"));
                    noteObject.button.setScale(
                        sprResScale[0] * buttonSprScale[0],
                        sprResScale[1] * buttonSprScale[1]
                    )

                    //
                    //
                    noteObject.target = this.add.image(
                        targetScaledPos[0],
                        targetScaledPos[1],
                        getNoteSprite(note["type"], "TGT")
                    );

                    noteObject.target.setScale(
                        sprResScale[0] * targetSprScale[0],
                        sprResScale[1] * targetSprScale[1]
                    )

                    //
                    //
                    noteObject.hand = this.add.image(
                        targetScaledPos[0],
                        targetScaledPos[1],
                        getNoteSprite(note.type, "Hand")
                    );
                    
                    if (note.type != NT_STAR_SP && note.type != NT_STAR_SP2) {
                        noteObject.hand.setDisplayOrigin(10, 47);
                        noteObject.hand.setScale(
                            sprResScale[0] * SpriteScale.handScale[0],
                            sprResScale[1] * SpriteScale.handScale[1]
                        );
                    }
                    else {
                        noteObject.hand.setDisplayOrigin(20, 116);
                        noteObject.hand.setScale(
                            sprResScale[0] * SpriteScale.handScaleSp[0],
                            sprResScale[1] * SpriteScale.handScaleSp[1]
                        );
                    }

                    // NOTE: Create the note's kiseki mesh
                    //
                    noteObject.kiseki = this.add.mesh(
                        this.gameWidth / 2,
                        this.gameHeight / 2,
                        "Kiseki01"
                    );

                    if (IsDebug) { noteObject.kiseki.setDebug(this.meshDebug); }
                    // NOTE: Required so that the mesh faces are updated every frame
                    noteObject.kiseki.ignoreDirtyCache = true;
                    // NOTE: Won't draw faces correctly if it's true
                    noteObject.kiseki.hideCCW = false;

                    // NOTE: Set Z index so that buttons always appear on top of targets
                    noteObject.target.depth = 100;
                    noteObject.hand.depth   = 100;
                    noteObject.kiseki.depth = 101;
                    noteObject.button.depth = 105;

                    // NOTE: Keep base scale for reference
                    noteObject.tgtBaseScale = [noteObject.target.scaleX, noteObject.target.scaleY];
                    noteObject.butBaseScale = [noteObject.button.scaleX, noteObject.button.scaleY];
                    noteObject.handBaseScale = [noteObject.hand.scaleX, noteObject.hand.scaleY];

                    this.noteObjects.push(noteObject);
                    note.added = true;
                }

                let noteObj = this.noteObjects[noteIndex];

                if (note.type == NT_STAR_SP || note.type == NT_STAR_SP2) {
                    if (gameState.chancePercentage >= SuccessThreshold) {
                        noteObj.target.setTexture("TStarSuccess");
                        noteObj.button.setTexture("BStarSuccess");
                    }
                }

                // NOTE: Update kiseki mesh
                //
                if (noteObj.kiseki != null) {
                    if (!isNoteLong(note.type) || (isNoteLong(note.type) && !note.isRelease)) {
                        const kisekiMeshData = calculateKiseki(note, flyingTime, this.chartTime, [this.gameWidth, this.gameHeight]);
                        noteObj.kiseki.clear().addVertices(
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
                        noteObj.kiseki.preUpdate();
                        noteObj.kiseki.hideCCW = false;
                        noteObj.kiseki.setOrtho(this.gameWidth, this.gameHeight);
                    }
                }

                let handRot = lerp2(0, 360, note.time - flyingTime, note.time, this.chartTime);
                if (handRot > 360) { handRot = 360; }

                // NOTE: Update note button position
                let buttonPos = getNoteButtonPosition(this.chartTime, flyingTime, note);
                if (isNoteLong(note.type) && note.state == NS_HOLDING) {
                    buttonPos = [note.posX, note.posY];
                }
                
                const buttonScaledPos = getCanvasScaledNotePos(
                    buttonPos[0],
                    buttonPos[1],
                    this.gameWidth,
                    this.gameHeight
                );

                if (this.chartTime - noteSpawnTime < 200) {
                    noteObj.target.setScale(
                        noteObj.tgtBaseScale[0] * SpriteScale.targetAppearScale[0],
                        noteObj.tgtBaseScale[1] * SpriteScale.targetAppearScale[1]
                    );

                    noteObj.hand.setScale(
                        noteObj.handBaseScale[0] * SpriteScale.targetAppearScale[0],
                        noteObj.handBaseScale[1] * SpriteScale.targetAppearScale[1]
                    );
                }
                else {
                    noteObj.target.setScale(noteObj.tgtBaseScale[0], noteObj.tgtBaseScale[1]);
                    noteObj.hand.setScale(noteObj.handBaseScale[0], noteObj.handBaseScale[1]);
                }

                noteObj.button.setPosition(
                    buttonScaledPos[0],
                    buttonScaledPos[1]
                );

                noteObj.hand.setRotation(degToRad(handRot));

                // NOTE: Do the note's "shrinking" exit animation once it's past it's hit time
                if (note.state == NS_VANISHING) {
                    const scale = 1.0 - (this.chartTime - noteDespawnBeginTime) / NoteVanishLength;

                    noteObj.button.setScale(
                        noteObj.butBaseScale[0] * scale,
                        noteObj.butBaseScale[1] * scale
                    );

                    noteObj.target.setScale(
                        noteObj.tgtBaseScale[0] * scale,
                        noteObj.tgtBaseScale[1] * scale
                    );

                    noteObj.hand.setScale(
                        noteObj.handBaseScale[0] * scale,
                        noteObj.handBaseScale[1] * scale
                    );

                    if (scale <= 0.0) {
                        note.state = NS_DEAD;
                    }
                }
                else if (note.state == NS_HOLDING) {
                    noteObj.button.visible = false;
                    noteObj.kiseki.depth = 99;
                }

                if (note.state == NS_DEAD) {
                    noteObj.target.visible = false;
                    noteObj.button.visible = false;
                    noteObj.hand.visible = false;

                    if (noteObj.kiseki != null) {
                        noteObj.kiseki.destroy();
                        noteObj.kiseki = null;
                    }
                }
            }
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: 768,
    height: 432,
    canvas: document.getElementById("gameCanvas"),
    scene: GameScene
};

const game = new Phaser.Game(config);