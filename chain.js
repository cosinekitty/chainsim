'use strict';
(function(){
    // Physics constants
    const FrameDelayMillis = 10;
    const BallMass = 0.1;
    const SpringRestLength = 0.04;
    const SpringConst = 1000.0;

    // Rendering constants
    const Friction = 0.9998;
    const PixelsPerMeter = 400.0;       // rendering zoom factor
    const iOrigin = 400;                // hor location of world origin on canvas [pixels]
    const jOrigin =  50;                // ver location of world origin on canvas [pixels]
    const BallRadiusMeters = 0.01;

    var sim;

    class Ball {
        constructor(mass, isAnchor, x, y) {
            this.mass = mass;
            this.isAnchor = isAnchor;   // true if ball is fixed in place

            // position vector
            this.x = x;
            this.y = y;

            // velocity vector
            this.vx = 0.0;
            this.vy = 0.0;

            // force vector
            this.fx = 0.0;
            this.fy = 0.0;
        }
    }

    class Spring {
        constructor(ball1, ball2, restLength, springConst) {
            this.ball1 = ball1;
            this.ball2 = ball2;
            this.restLength = restLength;       // meters
            this.springConst = springConst;     // newtons/meter
        }

        AddForce() {
            // Calculate the length of the spring.
            let dx = this.ball2.x - this.ball1.x;
            let dy = this.ball2.y - this.ball1.y;
            let len = Math.sqrt(dx*dx + dy*dy);

            // The difference between the spring's rest length and its current length
            // tells how much it is stretched or compressed.
            // Multiply by the spring constant to get the magnitude of the force.
            let force = this.springConst * (len - this.restLength);

            // Calculate force vector = force magnitude * directional unit vector
            let fx = force * (dx / len);
            let fy = force * (dy / len);

            // Add equal and opposite forces to the two connected balls.
            this.ball1.fx += fx;
            this.ball1.fy += fy;
            this.ball2.fx -= fx;
            this.ball2.fy -= fy;
        }
    }

    class Simulation {
        constructor() {
            this.ballList = [];
            this.springList = [];

            // Initialize gravity vector: 9.8 m/s^2, pointing straight down.
            this.gx = 0.0;
            this.gy = -9.8;
        }

        AddBall(ball) {
            this.ballList.push(ball);
            return ball;
        }

        AddSpring(spring) {
            this.springList.push(spring);
            return spring;
        }

        Update(dt) {
            let b, s;

            // We need to add up all the forces on all the balls.
            // Start out with just the gravitational force.
            for (b of this.ballList) {
                b.fx = this.gx;
                b.fy = this.gy;
            }

            // Go through all the springs and calculate
            // the forces on the balls connected to their endpoints.
            // They will be equal and opposite forces on the pair.
            for (s of this.springList) {
                s.AddForce();
            }

            // Now all the forces are correct.
            // Use the forces to update the position and speed of each ball.
            for (b of this.ballList) {
                if (!b.isAnchor) {       // skip anchors, because they don't move
                    // F = ma, therefore a = dv/dt = F/m.
                    // dv = dt * F/m
                    let dvx = dt * b.fx/b.mass;
                    let dvy = dt * b.fy/b.mass;

                    // Update the position using the mean speed in this increment.
                    b.x += dt * (b.vx + dvx/2.0);
                    b.y += dt * (b.vy + dvy/2.0);

                    // Update the ball's speed.
                    b.vx = Friction*b.vx + dvx;
                    b.vy = Friction*b.vy + dvy;
                }
            }
        }
    }

    function InitWorld() {
        let sim = new Simulation();
        let anchor1 = sim.AddBall(new Ball(BallMass, true, 0.0, 0.0));

        let prevBall = anchor1;
        for (let i=1; i <= 10; ++i) {
            let ball = sim.AddBall(new Ball(BallMass, false, 0.01 * i, -0.05 * i));
            sim.AddSpring(new Spring(ball, prevBall, SpringRestLength, SpringConst));
            prevBall = ball;
        }

        return sim;
    }

    function ScreenHor(x) {
        return iOrigin + (PixelsPerMeter * x);
    }

    function ScreenVer(y) {
        return jOrigin - (PixelsPerMeter * y);
    }

    function Render(sim) {
        const canvas = document.getElementById('SimCanvas');
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        for (let b of sim.ballList) {
            // Draw each ball as a filled-in circle.
            context.beginPath();
            context.arc(ScreenHor(b.x), ScreenVer(b.y), BallRadiusMeters * PixelsPerMeter, 0, 2*Math.PI, true);
            context.strokeStyle = '#000';
            context.lineWidth = 1;
            context.stroke();
        }
    }

    function AnimationFrame() {
        const SimStepsPerFrame = 100;
        const dt = (0.001 * FrameDelayMillis) / SimStepsPerFrame;
        for (let i=0; i < SimStepsPerFrame; ++i) {
            sim.Update(dt);
        }
        Render(sim);
        window.setTimeout(AnimationFrame, FrameDelayMillis);
    }

    window.onload = function() {
        sim = InitWorld();
        AnimationFrame();
    }
})();
