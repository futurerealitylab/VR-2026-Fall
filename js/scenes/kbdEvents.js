/*
   THIS SHOWS HOW YOU CAN RECEIVE EVENTS FROM YOUR KEYBOARD AND TRACKPAD.

   TO ACTIVATE keydown(), keyup(), mousedown(), mousemove() AND mouseup(),
   TYPE 'k' WHILE HOLDING DOWN THE SPACE KEY.

   IN THIS EXAMPLE:
      TYPING '1' THROUGH '8' SETS THE OBJECT'S COLOR.
      DRAGGING WITH YOUR MOUSE MOVES THE OBJECT IN X AND Y.
*/

export const init = async model => {
   let colors = 'red,orange,yellow,green,blue,indigo,violet,white'.split(',');

   // RESPOND TO KEYBOARD EVENTS: SET THE OBJECT'S COLOR.

   window.keydown = e => {}
   window.keyup = e => {
      let c = e.keyCode - 49;
      if (c >= 0 && c < colors.length)
         obj.color(colors[c]);
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
         mx += .0015 * (e.clientX - ex);
         my -= .0015 * (e.clientY - ey);
	 ex = e.clientX;
	 ey = e.clientY;
      }
   }

   // RENDER THE SCENE.

   let obj = model.add('square');
   model.animate(() => {
      obj.identity().move(mx,my,0).scale(.15);
   });
}
