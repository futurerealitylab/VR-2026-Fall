/*
   THIS SHOWS HOW YOU CAN RECEIVE EVENTS FROM YOUR KEYBOARD AND TRACKPAD
   AND THEN SHARE THEM WITH OTHER CLIENTS.

   TO ACTIVATE keydown(), keyup(), mousedown(), mousemove() AND mouseup(),
   TYPE 'k' WHILE HOLDING DOWN THE SPACE KEY.

   IN THIS EXAMPLE:
      TYPING '1' THROUGH '8' SETS THE OBJECT'S COLOR.
      DRAGGING WITH YOUR MOUSE MOVES THE OBJECT IN X AND Y.
*/

window.kbdInfo = { c: 0, x: 0, y: 1.5 };

export const init = async model => {
   let colors = 'red,orange,yellow,green,blue,indigo,violet,white'.split(',');

   // RESPOND TO KEYBOARD EVENTS: SET THE OBJECT'S COLOR.

   window.keyup = e => {
      let c = e.keyCode - 49;
      if (c >= 0 && c < colors.length) {
         kbdInfo.c = c;
	 server.broadcastGlobal('kbdInfo');
      }
   }

   // RESPOND TO MOUSE EVENTS: MOVE THE OBJECT IN X AND Y.

   let isMouseDown = false, ex, ey, mx = 0, my = 1.5;
   window.mousedown = e => {
      isMouseDown = true;
      ex = e.clientX;
      ey = e.clientY;
   }
   window.mouseup = e => isMouseDown = false;
   window.mousemove = e => {
      if (isMouseDown) {
         kbdInfo.x += .0015 * (e.clientX - ex);
         kbdInfo.y -= .0015 * (e.clientY - ey);
	 ex = e.clientX;
	 ey = e.clientY;
	 server.broadcastGlobal('kbdInfo');
      }
   }

   // RENDER THE SCENE.

   let obj = model.add('square');
   model.animate(() => {
      kbdInfo = server.synchronize('kbdInfo');
      obj.identity().move(kbdInfo.x,kbdInfo.y,0).color(colors[kbdInfo.c]).scale(.15);
   });
}
