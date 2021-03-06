const robot = {
    rotationsPerCm: 1 / 17.6,
    rotationsPerDegree: 0.5 / 90,
    wheelbaseWidth: 13,
    motorSet: motors.largeBC,
    colorSensor: sensors.color3,
    ultrasonicSensor: sensors.ultrasonic1,
    screenWidthChars: 28,
    screenHeightChars: 13,
    screenWidthPx: 200,
    screenHeightPx: 130
}

const programs: { [name: string]: Function } = {
    'quit': brick.exitProgram,
    'square': p_square,
    'rectangle': p_rectangle,
    'circle': p_circle,
    'wander': p_wander,
    'waypoints': p_waypoints,
    'snake' : p_snake,
    'music (needs debugging)': p_music
};

function turn(degrees: number, motorSpeed: number = 50) {
    degrees = (degrees + 180) % 360 - 180;
    robot.motorSet.tank(motorSpeed,
        -motorSpeed, degrees * robot.rotationsPerDegree,
        MoveUnit.Rotations);
}

function driveStraight(distanceCm: number, motorSpeed: number = 50) {
    robot.motorSet.tank(motorSpeed, motorSpeed,
        distanceCm * robot.rotationsPerCm, MoveUnit.Rotations);
}

function playMusic(musicData: string) {
    /* Structure of musicData
    musicData is a list of notes seperated by \n
    each note has three sections which are seperated by ,
    
    first section is note name - c, cs, db, d, ds, eb, e, es...
    second section is octave - in range 0-8
    third section is duration, in beats
    EG
    c,3,1\n // play C3 for 1 beat
    ds,3,2\n // play D-sharp3 for 2 beats
    */

    const noteToPitch: { [name: string]: number } = {
        'r': 0, // rest is no noise
        'c': Note.C,
        'cs': Note.CSharp,
        'db': Note.CSharp,
        'd': Note.D,
        'ds': Note.Eb,
        'eb': Note.Eb,
        'e': Note.E,
        'fb': Note.E,
        'es': Note.F,
        'f': Note.F,
        'fs': Note.FSharp,
        'gb': Note.FSharp,
        'g': Note.G,
        'gs': Note.GSharp,
        'ab': Note.GSharp,
        'a': Note.A,
        'as': Note.Bb,
        'bb': Note.Bb,
        'b': Note.B,
        'cb': Note.B,
        'bs': Note.C
    };

    let notes = musicData.split('\n');
    notes.forEach(note => {
        let noteSections = note.split(',');
        if (noteSections.length == 3) {
            let noteName = noteSections[0];
            let noteOctave = parseInt(noteSections[1]);
            let noteBeats = parseFloat(noteSections[2]);
            let pitch = noteToPitch[noteName];
            pitch *= 2 ** (noteOctave - 3);

            music.playTone(pitch, noteBeats * 1000 / 4);
        }
    });
}

function p_square() {
    const squareCount = 1;
    const squareSize = 50;

    for (let i = 0; i < squareCount * 4; i++) {
        driveStraight(squareSize, 50);
        turn(-90);
    }
}

function p_rectangle() {
    const width = 50;
    const height = 100;
    const rectCount = 1;

    for (let i = 0; i < rectCount * 2; i++) {
        driveStraight(width, 50);
        turn(-90);
        driveStraight(height, 50);
        turn(-90);
    }
}

function p_circle() {
    const radius = 30;
    const motorSpeed = 100;
    const clockwise = true;

    const neutralRotations = radius * Math.PI * 2 * robot.rotationsPerCm;

    const innerCircum =
        (radius - robot.wheelbaseWidth / 2) * Math.PI * 2;
    const innerRotations = innerCircum * robot.rotationsPerCm;
    let innerSpeed = motorSpeed * (innerRotations / neutralRotations);

    const outerCircum =
        (radius + robot.wheelbaseWidth / 2) * Math.PI * 2;
    const outerRotations = outerCircum * robot.rotationsPerCm;
    let outerSpeed = motorSpeed * (outerRotations / neutralRotations);

    // Speed is capped to 100
    // We don't want only one wheel getting capped - 
    // (as that would mess up the whole thing)
    // So reduce both to fit
    if (outerSpeed > 100) {
        const reduction = 100 / outerSpeed;
        innerSpeed *= reduction;
        outerSpeed *= reduction;
    }

    if (clockwise) {
        robot.motorSet.tank(outerSpeed, innerSpeed,
            neutralRotations, MoveUnit.Rotations);
    }
    else {
        robot.motorSet.tank(innerSpeed, outerSpeed,
            neutralRotations, MoveUnit.Rotations);
    }
}

function p_wander() {
    const updatesPerSecond = 1 / 10;
    const obstacleSlowDist = 30;
    const obstacleAvoidDist = 10;

    let isCautious = false;
    let time = 0;

    const maxTurnFactor = 10;

    brick.showString('Hold the robot over the edge', 1);
    brick.showString('of the table and press enter', 2);
    brick.showString('to calibrate the brightness', 3);

    brick.buttonEnter.pauseUntil(ButtonEvent.Pressed);
    let dark = robot.colorSensor.reflectedLight();
    
    brick.clearScreen();
    brick.showString('Press enter to start driving', 1);
    brick.buttonEnter.pauseUntil(ButtonEvent.Pressed);

    brick.clearScreen();

    function avoidObstacle() {
        robot.motorSet.stop();
        driveStraight(-10, 50);
        turn(-90, 50);
        robot.motorSet.stop();
        driveStraight(Infinity);
    }

    function startTankDriving(lSpeed: number, rSpeed: number) {
        control.runInParallel(function () {
            robot.motorSet.tank(lSpeed, rSpeed, Infinity, MoveUnit.Rotations);
        });
    }

    while (true) {
        let turnFactor = (perlinNoise(time, 0, 0) * 2 - 1) * maxTurnFactor;
        let lSpeed = 50 + turnFactor;
        let rSpeed = 50 - turnFactor;
        if (isCautious) {
            lSpeed /= 2;
            rSpeed /= 2;
        }
        startTankDriving(lSpeed, rSpeed);
        
        let light = robot.colorSensor.reflectedLight();
        let distance = robot.ultrasonicSensor.distance();
        if (light < dark) {
            avoidObstacle();
        }
        if (distance < obstacleAvoidDist) {
            avoidObstacle();
        }
        if (distance < obstacleSlowDist) {
            isCautious = true;
        }
        else {
            isCautious = false;
        }
        pause(updatesPerSecond * 1000);
        time += updatesPerSecond;
    }

    function onObstacleFar() {

    }

    function onObstacleNear() {

    }
}

function p_music() {
    let musicData = 
`
e,3,1
d,3,1
c,3,1
d,3,1
`;
`
e,3,1
e,3,1
e,3,1
r,0,1

e,3,1
d,3,1
c,3,1
d,3,1

e,3,1
e,3,1
e,3,1
e,3,1

d,3,1
d,3,1
e,3,1
d,3,1

c,3,4
`;
    playMusic(musicData);
}

function p_waypoints() {
    function getWaypointPos(): number[] {
        const increment = 10;

        let x = 0;
        let y = 0;

        // Clear buffer of buttons to avoid issues
        brick.buttonLeft.wasPressed();
        brick.buttonRight.wasPressed();
        brick.buttonUp.wasPressed();
        brick.buttonDown.wasPressed();
        brick.buttonEnter.wasPressed();


        while (true) {
            brick.clearScreen();
            brick.showString('Use the direction buttons', 1);
            brick.showString('to select next waypoint pos.', 2);
            brick.showString('Press enter to drive there.', 3);
            brick.showString('(To quit, press enter when', 4);
            brick.showString('  x = 0 and y = 0)', 5);
            brick.showString(`X: ${x}`, 7);
            brick.showString(`Y: ${y}`, 8);
            brick.showString(`Distance: ${xyToDist(x, y)}`, 9);
            brick.showString(`Heading: ${xyToAngle(x, y)}`, 10);

            pause(50);

            if (brick.buttonLeft.wasPressed()) x -= increment;
            if (brick.buttonRight.wasPressed()) x += increment;
            if (brick.buttonDown.wasPressed()) y -= increment;
            if (brick.buttonUp.wasPressed()) y += increment;
            if (brick.buttonEnter.wasPressed()) break;
        }

        return [x, y];
    }

    function xyToAngle(x: number, y: number): number {
        x *= -1;
        let angle = Math.atan2(y, x);
        let degrees = 180 * angle / Math.PI;
        degrees -= 90;
        return degrees;
    }

    function xyToDist(x: number, y: number): number {
        return Math.sqrt(x ** 2 + y ** 2);
    }

    while (true) {
        let [x, y] = getWaypointPos();
        if (x == 0 && y == 0) break;
        let dist = xyToDist(x, y);
        let angle = xyToAngle(x, y)
        
        brick.clearScreen();
        brick.showString('Driving...', 1);

        turn(angle, 50);
        driveStraight(dist, 50);
    }
}

function p_dino() {
    // Very laggy, doesn't run well

    const frameRate = 1 / 20;

    const floorY = robot.screenHeightPx - 20;

    const dinoJumpStrength = -200;
    const gravity = 250;
    const dinoWidth = 10;
    const dinoHeight = 20;
    
    let dinoX = 10; // relative to left of dino
    let dinoY = floorY - dinoHeight; // relative to top of dino
    let dinoVelY = 0;

    let img = image.create(robot.screenWidthPx, robot.screenHeightPx);

    // Define below dino to allow use of vars
    function draw() {

        img.fillRect(0, 0, robot.screenWidthPx, robot.screenWidthPx, 0);

        // Draw dino
        img.fillRect(dinoX, dinoY, dinoWidth, dinoHeight, 1);

        // Draw floor
        img.drawLine(0, floorY, robot.screenWidthPx, floorY, 1);

        brick.showImage(img);
    }

    // Clear buffer
    brick.buttonUp.wasPressed();

    let alive = true;
    while (alive) {
        let grounded = dinoY + dinoHeight >= floorY;

        if (dinoY + dinoHeight > floorY) {
            dinoY = floorY - dinoHeight;
        }

        if (brick.buttonUp.wasPressed() && grounded) {
            dinoVelY = dinoJumpStrength;
        }

        if (! grounded) {
            dinoVelY += gravity * frameRate;
        }

        dinoY += dinoVelY * frameRate;

        draw();
        pause(frameRate * 1000);
    }
}

function p_snake() {
    class Position {
        x: number;
        y: number;

        constructor(x: number, y: number) {
            this.x = x;
            this.y = y;
        }

        touches(position: Position): boolean {
            return this.x == position.x && this.y == position.y;
        }

        copy(): Position {
            return new Position(this.x, this.y);
        }
    }

    enum Direction {
        Up,
        Down,
        Left,
        Right
    }

    
    const oppositeDirections = {
        [Direction.Up] : Direction.Down,
        [Direction.Down] : Direction.Up,
        [Direction.Left] : Direction.Right,
        [Direction.Right] : Direction.Left
    }

    const frameRate = 1 / 10;
    const gridSize = 12;
    const pixelSize = Math.floor(Math.min(robot.screenWidthPx, robot.screenHeightPx) / gridSize);
    const screenSize = gridSize * pixelSize;

    let img = image.create(screenSize + gridSize, screenSize + gridSize);

    const startPos = Math.floor(gridSize / 2);
    let segmentPositions: Position[] = [
        new Position(startPos, startPos),
        new Position(startPos - 1, startPos),
        new Position(startPos - 2, startPos)
    ];

    let applePositions: Position[] = [];

    let crntDirection: Direction = Direction.Right;
    let needsToGrow = false;

    // Define below snake data to allow use of vars
    function draw() {
        // Clear screen
        img.fillRect(0, 0, screenSize, screenSize, 0);

        // Draw snake
        segmentPositions.forEach(position => {
            img.fillRect(position.x * pixelSize, position.y * pixelSize,
                pixelSize, pixelSize, 1);
        });

        // Draw apples
        applePositions.forEach(position => {
            img.fillRect(position.x * pixelSize + pixelSize * 0.25,
                position.y * pixelSize + pixelSize * 0.25,
                pixelSize / 2, pixelSize / 2, 1);
        });

        brick.showImage(img);
    }

    function moveSnake() {
        let newHead = segmentPositions[0].copy();
        switch (crntDirection) {
            case Direction.Up:
                newHead.y -= 1;
                break;
            case Direction.Down:
                newHead.y += 1;
                break;
            case Direction.Left:
                newHead.x -= 1;
                break;
            case Direction.Right:
                newHead.x += 1;
                break;
        }
        segmentPositions.unshift(newHead);
        if (! needsToGrow) segmentPositions.pop();
    }

    function checkControls() {
        let newDirection = crntDirection;
        if (brick.buttonLeft.wasPressed()) {
            newDirection = Direction.Left;
        }
        else if (brick.buttonRight.wasPressed()) {
            newDirection = Direction.Right;
        }
        else if (brick.buttonUp.wasPressed()) {
            newDirection = Direction.Up;
        }
        else if (brick.buttonDown.wasPressed()) {
            newDirection = Direction.Down;
        }

        // Don't allow to turn from left to right directly
        if (oppositeDirections[crntDirection] != newDirection) {
            crntDirection = newDirection;
        }
    }

    function checkIfAlive(): boolean {
        let alive = true;

        // Check wall collision
        // (use for...of to allow break)
        for (let position of segmentPositions) {
            if (position.x < 0 || position.x > gridSize ||
                position.y < 0 || position.y > gridSize) {
                alive = false;
                break;
            }
        };

        if (! alive) return false;

        // Check self-collision
        // (use for...of to allow break)
        let filledPositions: Position[] = [];
        for (let position of segmentPositions) {
            for (let position2 of filledPositions) {
                if (position.touches(position2)) {
                    alive = false;
                    break;
                }
            }
            filledPositions.push(position);
        };

        return alive;
    }

    function createApple() {
        let generatePos = () => Math.floor(Math.random() * gridSize);
        let newApplePos = new Position(generatePos(), generatePos());
        applePositions.push(newApplePos);
    }

    function eatApples() {
        for (let segmentPosition of segmentPositions) {
            for (let applePosition of applePositions) {
                if (segmentPosition.touches(applePosition)) {
                    needsToGrow = true;
                    applePositions.splice(applePositions.indexOf(applePosition), 1);
                    break;
                }
            }
        }
    }

    // Flush controls
    brick.buttonLeft.wasPressed();
    brick.buttonRight.wasPressed();
    brick.buttonUp.wasPressed();
    brick.buttonDown.wasPressed();

    let alive = true;
    while (alive) {
        checkControls();
        if (applePositions.length == 0) createApple();
        eatApples();
        moveSnake();
        draw();
        alive = checkIfAlive();
        needsToGrow = false;
        pause(frameRate * 1000);
    }
}

while (true) {
    programSelector.showPrograms(programs);
}