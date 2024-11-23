
class HighResolutionTimer {
    constructor() {
        this.pausedAt  = 0.0;
        this.startTime = 0.0;
        this.running   = false;
    }

    // NOTE: Starts/continues running the timer. By default, the timer is stopped when created.
    start() {
        this.startTime = performance.now() - this.pausedAt;
        this.running = true;
    }

    pause() {
        this.pausedAt = this.getEllapsed();
        this.running = false;
    }

    reset() {
        this.pausedAt = 0.0;
        this.start();
    }

    // NOTE: Returns the ellapsed time in milliseconds.
    getEllapsed() {
        if (this.running)
            return performance.now() - this.startTime;
        return this.pausedAt;
    }
}