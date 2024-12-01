
function lerp(p1, p2, t) {
    return p1 + t * (p2 - p1);
}

function lerp2(p1, p2, t1, t2, t) {
    return lerp(p1, p2, (t - t1) / (t2 - t1));
}

function degToRad(deg) {
    return deg * (Math.PI / 180.0);
}