
class InputManager {
    constructor() {
        this.actions = { };
    }

    init(parent) {
        let _this = this;
        let addAction = function(name, keys) {
            _this.actions[name] = { "keys": [] };

            for (const key of keys) {
                _this.actions[name].keys.push({
                    "prev": false,
                    "cur": false,
                    "phaserKey": parent.input.keyboard.addKey(key)
                });
            }
        };

        // ARROW BUTTONS
        addAction("up",    ["W"]);
        addAction("left",  ["A"]);
        addAction("down",  ["S"]);
        addAction("right", ["D"]);

        // FACE BUTTONS
        addAction("triangle", ["I"]);
        addAction("square",   ["J"]);
        addAction("cross",    ["K"]);
        addAction("circle",   ["L"]);

        // STAR
        addAction("starL", ["Q", "U"]);
        addAction("starR", ["E", "O"]);

        console.log(this.actions);
    }

    update(parent) {
        for (let [k, action] of Object.entries(this.actions)) {
            for (let key of action.keys) {
                key.prev = key.cur;
                key.cur = key.phaserKey.isDown;
            }
        }
    }

    isActionDown(name) {
        let cond = false;

        for (const key of this.actions[name].keys) {
            cond |= key.cur;
        }

        return cond;
    }

    isActionTapped(name) {
        let cond = false;

        for (const key of this.actions[name].keys) {
            cond |= (key.cur && !key.prev);
        }

        return cond;
    }

    isActionReleased(name) {
        let cond = false;

        for (const key of this.actions[name].keys) {
            cond |= (!key.cur && key.prev);
        }

        return cond;
    }

    isAnyActionTapped(...names) {
        let cond = false;

        for (const name of names) {
            cond |= this.isActionTapped(name);
        }

        return cond;
    }
}