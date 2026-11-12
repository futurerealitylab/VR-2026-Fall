/*
   THIS SHOWS HOW YOU CAN RECEIVE EVENTS FROM YOUR KEYBOARD AND TRACKPAD
   AND THEN SHARE THEM WITH OTHER CLIENTS.

   TO ACTIVATE keydown(), keyup(), mousedown(), mousemove() AND mouseup(),
   TYPE 'k' WHILE HOLDING DOWN THE SPACE KEY.

   IN THIS EXAMPLE:
      TYPING '1' THROUGH '8' SETS THE OBJECT'S COLOR.
      DRAGGING WITH YOUR MOUSE MOVES THE OBJECT IN X AND Y.
*/

window.objInfo = { c: 0, x: 0, y: 1.5 };

export const init = async model => {
   let colors = 'red,orange,yellow,green,blue,indigo,violet,white'.split(',');

   // RESPOND TO KEYBOARD EVENTS: SET THE OBJECT'S COLOR.

   window.keyup = e => {
      let c = e.keyCode - 49;
      if (c >= 0 && c < colors.length) {
         objInfo.c = c;
	 server.broadcastGlobal('objInfo');
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
         objInfo.x += .0015 * (e.clientX - ex);
         objInfo.y -= .0015 * (e.clientY - ey);
	 ex = e.clientX;
	 ey = e.clientY;
	 server.broadcastGlobal('objInfo');
      }
   }

   // RENDER THE SCENE.

   let obj = model.add('square');
   model.animate(() => {
      objInfo = server.synchronize('objInfo');
      obj.identity().move(objInfo.x,objInfo.y,0).color(colors[objInfo.c]).scale(.15);
   });
}
