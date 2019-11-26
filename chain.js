'use strict';
(function(){
    // Physics constants
    const SimStepsPerFrame = 1000;
    const FrameDelayMillis = 10;
    const FrictionHalfLifeSeconds = 1.5;
    const BallMass = 0.1;
    const SpringRestLength = 0.04;
    const SpringConst = 500.0;

    // Rendering constants
    const PixelsPerMeter = 200.0;       // rendering zoom factor
    const iOrigin = 400;                // hor location of world origin on canvas [pixels]
    const jOrigin = 100;                // ver location of world origin on canvas [pixels]
    const BallRadiusMeters = 0.02;
    const GrabDistanceLimit = 2.0;

    var sim;

    class Ball {
        constructor(mass, anchor, x, y) {
            this.mass = mass;
            this.anchor = anchor;   // 0=mobile, positive=fixed in place

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

        Distance(x, y) {
            const dx = this.x - x;
            const dy = this.y - y;
            return Math.sqrt(dx*dx + dy*dy);
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
            const dx = this.ball2.x - this.ball1.x;
            const dy = this.ball2.y - this.ball1.y;
            const len = Math.sqrt(dx*dx + dy*dy);

            // The difference between the spring's rest length and its current length
            // tells how much it is stretched or compressed.
            // Multiply by the spring constant to get the magnitude of the force.
            const displacement = len - this.restLength;
            const force = this.springConst * displacement;

            // Safety valve: if two balls are at the same location, we avoid division by zero.
            if (Math.abs(len) >= 1.0e-6) {
                // Calculate force vector = force magnitude * directional unit vector
                const fx = force * (dx / len);
                const fy = force * (dy / len);

                // Add equal and opposite forces to the two connected balls.
                this.ball1.fx += fx;
                this.ball1.fy += fy;
                this.ball2.fx -= fx;
                this.ball2.fy -= fy;
            }

            const potentialEnergy = (force * displacement) / 2.0;
            return potentialEnergy;
        }
    }

    class Simulation {
        constructor() {
            this.ballList = [];
            this.springList = [];

            // Initialize gravity vector: 9.8 m/s^2, pointing straight down.
            this.gravity = -9.8;

            this.grabbedBall = null;
        }

        AddBall(ball) {
            this.ballList.push(ball);
            return ball;
        }

        AddSpring(spring) {
            this.springList.push(spring);
            return spring;
        }

        CalcState() {
            // Calculate the force vectors acting on all the balls: both from springs and from gravity.
            // Also add up all kinetic and potential energy in the system.
            let potentialEnergy = 0.0;
            let kineticEnergy = 0.0;

            // We need to add up all the forces on all the balls.
            // Start out with just the gravitational force.
            for (let b of this.ballList) {
                b.fx = 0.0;
                b.fy = b.mass * this.gravity;
                potentialEnergy += b.y * b.fy;
                kineticEnergy += (b.mass * (b.vx*b.vx + b.vy*b.vy)) / 2.0;
            }

            // Go through all the springs and calculate
            // the forces on the balls connected to their endpoints.
            // They will be equal and opposite forces on the pair.
            // Also add up all the potential energy stored in the springs.
            for (let s of this.springList) {
                potentialEnergy += s.AddForce();
            }

            return {
                kinetic: kineticEnergy,
                potential: potentialEnergy
            };
        }

        Update(dt) {
            this.CalcState();

            // Now all the forces are correct.
            // Use the forces to update the position and speed of each ball.
            const friction = Math.pow(0.5, dt / FrictionHalfLifeSeconds);
            for (let b of this.ballList) {
                if (b.anchor === 0) {       // skip anchors, because they don't move
                    // F = ma, therefore a = dv/dt = F/m.
                    // dv = dt * F/m
                    let dvx = dt * b.fx/b.mass;
                    let dvy = dt * b.fy/b.mass;

                    // Update the position using the mean speed in this increment.
                    b.x += dt * (b.vx + dvx/2.0);
                    b.y += dt * (b.vy + dvy/2.0);

                    // Update the ball's speed.
                    b.vx = (friction * b.vx) + dvx;
                    b.vy = (friction * b.vy) + dvy;
                }
            }
        }

        Grab(x, y) {
            // Not allowed to grab more than one ball at a time (safety valve).
            if (this.grabbedBall)
                return;

            // Find the ball closest to the mouse coordinates.
            let closest;
            let bestDistance;
            if (this.ballList.length > 0) {
                closest = this.ballList[0];
                bestDistance = closest.Distance(x, y);
                for (let i=0; i < this.ballList.length; ++i) {
                    const b = this.ballList[i];
                    const distance = b.Distance(x, y);
                    if (distance < bestDistance) {
                        closest = b;
                        bestDistance = distance;
                    }
                }

                // If it is close enough to be grabbed, grab it.
                if (bestDistance <= GrabDistanceLimit) {
                    ++closest.anchor;
                    this.grabbedBall = closest;
                    this.Pull(x, y);
                }
            }
        }

        Pull(x, y) {
            if (this.grabbedBall) {
                this.grabbedBall.x = x;
                this.grabbedBall.y = y;
                this.grabbedBall.vx = 0;
                this.grabbedBall.vy = 0;
            }
        }

        Release() {
            if (this.grabbedBall) {
                --this.grabbedBall.anchor;
                this.grabbedBall = null;
            }
        }
    }

    function MakeString(sim, x) {
        let anchor1 = sim.AddBall(new Ball(BallMass, 1, x, 0.0));
        let prevBall = anchor1;
        for (let i=1; i <= 35; ++i) {
            let ball = sim.AddBall(new Ball(BallMass, 0, x + (0.01 * i), -0.05 * i));
            sim.AddSpring(new Spring(ball, prevBall, SpringRestLength, SpringConst));
            prevBall = ball;
        }
    }

    function InitWorld() {
        let sim = new Simulation();
        MakeString(sim, 0.0);
        return sim;
    }

    function ScreenHor(x) {
        return iOrigin + (PixelsPerMeter * x);
    }

    function ScreenVer(y) {
        return jOrigin - (PixelsPerMeter * y);
    }

    function WorldX(hor) {
        return (hor - iOrigin) / PixelsPerMeter;
    }

    function WorldY(ver) {
        return (jOrigin - ver) / PixelsPerMeter;
    }

    function Render(sim) {
        const canvas = document.getElementById('SimCanvas');
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        context.strokeStyle = '#03f';
        context.lineWidth = 1;
        for (let s of sim.springList) {
            context.beginPath();
            context.moveTo(ScreenHor(s.ball1.x), ScreenVer(s.ball1.y));
            context.lineTo(ScreenHor(s.ball2.x), ScreenVer(s.ball2.y));
            context.stroke();
        }

        context.strokeStyle = '#000';
        context.lineWidth = 1;
        const pixelRadius = BallRadiusMeters * PixelsPerMeter;
        for (let b of sim.ballList) {
            if (b.anchor === 0) {
                // Draw each mobile ball as a filled-in, green circle.
                context.fillStyle = '#8f0';
                context.beginPath();
                context.arc(ScreenHor(b.x), ScreenVer(b.y), pixelRadius, 0, 2*Math.PI, true);
                context.fill();
                context.stroke();
            } else {
                // Draw each anchored ball as a filled-in, red square.
                context.fillStyle = '#f80';
                const x1 = ScreenHor(b.x) - pixelRadius;
                const y1 = ScreenVer(b.y) - pixelRadius;
                context.strokeRect(x1, y1, 2*pixelRadius, 2*pixelRadius);
                context.fillRect(x1, y1, 2*pixelRadius, 2*pixelRadius);
            }
        }
    }

    function AnimationFrame() {
        const dt = (0.001 * FrameDelayMillis) / SimStepsPerFrame;
        for (let i=0; i < SimStepsPerFrame; ++i) {
            sim.Update(dt);
        }
        Render(sim);
        window.setTimeout(AnimationFrame, FrameDelayMillis);
    }

    function OnMouseDown(evt) {
        const canvas = document.getElementById('SimCanvas');
        const hor = evt.pageX - canvas.offsetLeft;
        const ver = evt.pageY - canvas.offsetTop;
        const x = WorldX(hor);
        const y = WorldY(ver);
        sim.Grab(x, y);
    }

    function OnMouseUp(evt) {
        sim.Release();
    }

    function OnMouseMove(evt) {
        const canvas = document.getElementById('SimCanvas');
        const hor = evt.pageX - canvas.offsetLeft;
        const ver = evt.pageY - canvas.offsetTop;
        const x = WorldX(hor);
        const y = WorldY(ver);
        sim.Pull(x, y);
    }

    function OnMouseLeave() {
        sim.Release();
    }

    window.onload = function() {
        sim = InitWorld();
        const canvas = document.getElementById('SimCanvas');
        canvas.addEventListener('mousedown', OnMouseDown);
        canvas.addEventListener('mouseup', OnMouseUp);
        canvas.addEventListener('mousemove', OnMouseMove);
        canvas.addEventListener('mouseleave', OnMouseLeave);
        AnimationFrame();
    }
})();
