
// NOTE: Factor for determining the length of non-long note's kiseki. Default is 0.5,
//       which means it's a 2/4 beat length.
const KisekiLength = 0.5;
const SubdivisionCount = 20;  // NOTE: Number of quads in the mesh
const AlphaThresholdHead = 2; // NOTE: Change this according to subdivision count
const AlphaThresholdTail = 5; //

function calculateKisekiRange(note, flyingTime, time, timeStart, length, color, alphaOnEdges, startV, endV, width) {
    let mesh = { "vertices": [], "uvs": [], "indices": [], "colors": [], "alphas": [] };

    for (let i = 0; i < SubdivisionCount; i++) {
        const progress = i / SubdivisionCount;
        const subTime = timeStart - length * progress;

        const posR = getNoteButtonPosition(subTime, flyingTime, note, width / 2);
        const posL = getNoteButtonPosition(subTime, flyingTime, note, -(width / 2));

        mesh.vertices.push(posR[0], posR[1]);
        mesh.vertices.push(posL[0], posL[1]);

        const freq = 1;
        if (note.freq < 0) { freq = -1; }

        mesh.uvs.push(progress + time / flyingTime * 0.8 * freq, endV);
        mesh.uvs.push(progress + time / flyingTime * 0.8 * freq, startV);

        mesh.colors.push(color, color);

        if (alphaOnEdges) {
            if (i < AlphaThresholdHead) {
                let alpha = i / AlphaThresholdHead;
                mesh.alphas.push(alpha, alpha);
            }
            else if (SubdivisionCount - i - 1 < AlphaThresholdTail) {
                let alpha = (SubdivisionCount - i - 1) / AlphaThresholdTail;
                mesh.alphas.push(alpha, alpha);
            }
            else {
                mesh.alphas.push(1, 1);
            }            
        }

        if (i > 0) {
            mesh.indices.push(
                (i - 1) * 2 + 0,
                (i - 1) * 2 + 1,
                i * 2 + 0,
                (i - 1) * 2 + 1,
                i * 2 + 0,
                i * 2 + 1
            );
        }
    }

    return mesh;
}

function calculateKiseki(note, flyingTime, time, res) {
    let startTime = time;
    let length = isNoteLong(note.type) ? note.length : flyingTime * KisekiLength;
    let alphaOnEdges = isNoteLong(note.type) ? false : true;
    let startV = 0;
    let endV = 32;
    let color = 0xFFFFFF;
    let width = 32;

    switch (note.type) {
        case NT_TRIANGLE:
        case NT_TRIANGLE_W:
            color = 0xCBFF89;
            break;
        case NT_CIRCLE:
        case NT_CIRCLE_W:
            color = 0xEE4449;
            break;
        case NT_CROSS:
        case NT_CROSS_W:
            color = 0xB4FFFF;
            break;
        case NT_SQUARE:
        case NT_SQUARE_W:
            color = 0xFFCEFF;
            break;
        case NT_STAR:
        case NT_STAR_W:
            color = 0xE5E519;
            break;
    }

    if (note.type >= NT_TRIANGLE && note.type <= NT_SQUARE_W) {
        if (note.eventIndex != -1 && note.eventType == EV_CHANCE_TIME) {
            startV = 32;
            endV = 64;
        }
    }
    else if (isNoteLong(note.type)) {
        width = 56;
        startV = 64 + 32 * (note.type - NT_TRIANGLE_LONG);
        endV = startV + 32;

        if (note.state == NS_HOLDING) {
            startTime = note.time;
            length = note.length - (time - note.time);
        }
    }

    let mesh = calculateKisekiRange(note, flyingTime, time, startTime, length, color, alphaOnEdges, startV / 256, endV / 256, width);
    mesh.vertices = transformScreenSpace(mesh.vertices, res);

    return mesh;
}