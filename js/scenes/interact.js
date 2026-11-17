/*
   Simple example of allowing all users in a scene to share the same interactive state.
*/

window.objInfo = {                               // SHARED STATE IS A GLOBAL VARIABLE.
   rgb: 'white',                                 // IT MUST BE AN OBJECT OF THE FORM:
   xyz: [0,1,0],                                 // { name: value, name: value, ... }
};

export const init = async model => {
   let object = model.add('cube');

   inputEvents.onPress = hand => {
      objInfo.rgb = hand == 'left' ? 'red'      // TRIGGER PRESS SETS OBJECT COLOR: RED
                                   : 'blue';    // FOR LEFT TRIGGER AND BLUE FOR RIGHT
      objInfo.xyz = inputEvents.pos(hand);      // TRIGGER, THEN SETS THE OBJECT POSITION
      server.broadcastGlobal('objInfo');        // AND BROADCASTS THE NEW OBJECT STATE.
   }
   inputEvents.onDrag = hand => {
      objInfo.xyz = inputEvents.pos(hand);      // TRIGGER DRAG SETS THE OBJECT POSITION
      server.broadcastGlobal('objInfo');        // AND BROADCASTS THE NEW OBJECT STATE.
   }
   inputEvents.onRelease = hand => {
      objInfo.rgb = 'white';                    // TRIGGER RELEASE RESETS COLOR TO WHITE
      server.broadcastGlobal('objInfo');        // AND BROADCASTS THE NEW OBJECT STATE.
   }

   model.animate(() => {
      objInfo = server.synchronize('objInfo'); // BEGIN ANIMATE BY SYNCHRONIZING STATE.
      object.identity().move(objInfo.xyz).scale(.03).color(objInfo.rgb); // RENDER OBJECT
   });
}

