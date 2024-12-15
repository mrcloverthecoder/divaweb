

// NOTE: Transform vertices from screen space (0~res) to Phaser's space (-res/2~res/2).
//       As phaser uses coordinates relative to the origin point, the origin is always
//       at the center of the screen (targetRes/2).
//       It takes in vertices in pixel space in 1920x1080 resolution.
function transformScreenSpace(src, targetRes) {
    const scaleX  = targetRes[0] / 1920;
    const scaleY  = targetRes[1] / 1080;
    const offsetX = targetRes[0] / 2;
    const offsetY = targetRes[1] / 2;

    let transformed = [];

    for (let i = 0; i < src.length; i += 2) {
        transformed.push((src[i] * scaleX) - offsetX);
        // NOTE: -Y goes towards the bottom,
        //       so you need to invert it
        transformed.push(-((src[i + 1] * scaleY) - offsetY));
    }

    return transformed;
}
