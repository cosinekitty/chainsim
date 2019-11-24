'use strict';
(function(){
    const FrameDelayMillis = 30;

    function AnimationFrame() {
        window.setTimeout(AnimationFrame, FrameDelayMillis);
    }

    window.onload = function() {
        AnimationFrame();
    }
})();
