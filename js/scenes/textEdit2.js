/*
	A scene to allow a client running on a computer
	to type on their physical keyboard and trackpad
	to edit a text document.  Other clients running
	on XR headsets can see the changing text window
	and cursor.

	To do:
		Ability to add or delete a window.
		Compile code to modify a 3d object.
		Wrap cursor / windows around me.
*/

// RELOAD OR INITIALIZE THE SHARED TEXT EDITOR STATE

let addDoc = (pos,text) => te2.doc.push({
   nCols: 50,
   nRows: 25,
   i: 0,
   text: text,
   fontHeight: .028,
   col: 0,
   row: 0,
   pos: pos,
});

window.te2 = { id: 0, mouseX: 0, mouseY: 0, needToUpdate: true, doc: [] };

addDoc([-.5,1.5,0], 'Window 0');
addDoc([ .5,1.5,0], 'Window 1');

let doc = id => te2.doc[id];
let form = id => 'doc' + id;

server.get('te2', saved_te2 => {
   if (saved_te2) {
      window.te2 = saved_te2;
      for (let i = 0 ; i < te2.doc.length ; i++)
         setText(i);
   }
});

export const init = async model => {

   // DEFINE A NEW TEXT MESH FORM WITH nCols AND nRows

   let defineTextMesh = (id, nCols, nRows) => {
      let vertexData = [];
      for (let row = 0 ; row < nRows ; row++)
      for (let col = 0 ; col < nCols ; col++) {
	 vertexData.push(
            [col  ,-2*row  ,0, 0,0,1, 0,0],
	    [col  ,-2*row-2,0, 0,0,1, 0,1],
	    [col+1,-2*row-2,0, 0,0,1, 1,1],

            [col  ,-2*row  ,0, 0,0,1, 0,0],
	    [col+1,-2*row-2,0, 0,0,1, 1,1],
	    [col+1,-2*row  ,0, 0,0,1, 1,0],
         );
      }
      clay.defineMesh(form(id), clay.trianglesMesh(vertexData));
      let mesh = clay.getMesh(form(id));
   }

   // SET THE CURSOR POSITION IN A TEXT MESH FORM

   let setTextCursor = (id, col, row) => {
      let mesh = clay.getMesh(form(id));
      let setCursorColor = (r, g, b) => {
	 let rgb = r + (g * 256 >> 0) + (b * 256 >> 0) * 256;
         let n = 6 * 16 * (doc(id).nCols * mesh.cursor.row + mesh.cursor.col) + 8;
	 for (let i = 0 ; i < 6 ; i++)
	    mesh[n + i * 16] = rgb;
      }
      if (mesh.cursor)
         setCursorColor(.99, .99, .99);
      mesh.cursor = {col: col, row: row};
      setCursorColor(.0, .5, .99);
   }

   // SET THE MULTI-LINE TEXT CONTENTS OF A TEXT MESH FORM

   let setText = id => {
      let text = doc(id).text;
      let mesh = clay.getMesh(form(id));
      let nCols = doc(id).nCols, nRows = doc(id).nRows;

      // ERASE ANY PREVIOUS TEXT

      for (let n = 6 ; n < mesh.length ; n += 16)
         mesh[n] = mesh[n+1] = 0;

      // TEXTURE SUCCESSIVE QUADS IN THE MESH BY ASCII CHARACTERS

      for (let i=0, col=0, row=0 ; i < text.length ; i++, col++) {

         if (col >= nCols)           // CHARACTERS OFF TO THE RIGHT
	    continue;                // ARE JUST IGNORED

         let c = text.charCodeAt(i);

	 if (c == 10) {              // HANDLE LINE BREAK
	    if (++row >= nRows)
	       break;
	    col = -1;
	    continue;
	 }

         let u0 = ((c-32) % 12     ) / 12+.01, u1 = u0 + 1 / 12-.01;
         let v0 = ((c-32) / 12 >> 0) /  8, v1 = v0 + 1 /  8;

	 let n = 6 * 16 * (nCols * row + col) + 6;

	 mesh[n       ] = u0; mesh[n        + 1] = v0;
	 mesh[n + 1*16] = u0; mesh[n + 1*16 + 1] = v1;
	 mesh[n + 2*16] = u1; mesh[n + 2*16 + 1] = v1;

	 mesh[n + 3*16] = u0; mesh[n + 3*16 + 1] = v0;
	 mesh[n + 4*16] = u1; mesh[n + 4*16 + 1] = v1;
	 mesh[n + 5*16] = u1; mesh[n + 5*16 + 1] = v0;
      }
   }

   // CUSTOM SHADER TO DISPLAY WHITE TEXT AGAINST A TRANSPARENT BACKGROUND

   for (let i = 0 ; i < te2.doc.length ; i++) {
      defineTextMesh(i, doc(i).nCols, doc(i).nRows);
      let obj = model.add(form(i)).txtr(15).flag('uText');
      obj.customShader(`
         uniform int uText, uFocus;
         ----------------------------------
         if (uText==1) {
	    color = vec3(1);
            opacity = texture(uSampler[15],uv).r < .5 ? 1. : uFocus==1 ? .6 : .4;
         }
      `);
      setText(i);
   }

   // WHENEVER TEXT CHANGES, UPDATE INTERNAL STATE VARIABLES AND RESYNC

   let C, setCol = true;

   let updateText = () => {
      let id = te2.id;
      C = [];
      let c = 0;
      let lines = doc(id).text.split('\n');
      for (let i = 0 ; i < lines.length ; i++) {
         C.push(c);
         let line = lines[i] + ' ';
         if (doc(id).i >= c && doc(id).i < c + line.length) {
	    doc(id).row = i;
	    if (setCol)
	       doc(id).col = doc(id).i - c;
         }
         c += line.length;
      }
      C.push(c);

      te2.needToUpdate = true;
      if (clientID == clients[0]) {
         server.broadcastGlobal('te2');
         te2.needToUpdate = false;
      }
      setText(id);
      let i = Math.min(doc(id).col, C[doc(id).row+1]-1 - C[doc(id).row]);
      setTextCursor(id, i, doc(id).row);
   }
   updateText();

   // SET CURSOR POSITION CORRESPONDING TO WHERE THE USER CLICKS.
   // FOR THIS TO WORK PROPERLY, BROWSER WINDOW MUST BE MAXIMIZED

   window.interactMode = 4;

   let isMouseDown, isOverText;

   let hitTest = () => {
      for (let i = 0 ; i < te2.doc.length ; i++)
         te2.doc[i].isHit = false;
      for (let i = 0 ; i < te2.doc.length ; i++) {
         let doc = te2.doc[i];
	 let x0 = doc.pos[0] - doc.fontHeight * doc.nCols / 4;
	 let x1 = doc.pos[0] + doc.fontHeight * doc.nCols / 4;
	 let y0 = doc.pos[1] - doc.fontHeight * doc.nRows;
	 let y1 = doc.pos[1];
	 if ( te2.mouseX >= x0 && te2.mouseX < x1 &&
	      te2.mouseY >= y0 && te2.mouseY < y1 ) {
            te2.id = i;
	    doc.isHit = true;
            updateText();
	    break;
         }
      }
   }

   window.mousedown = e => isMouseDown = true;

   window.mousemove = e => {
      let id = te2.id;
      let sw = screen.width, sh = screen.height;
      let mouseX = 3.1858/sw * (e.clientX - sw/2);
      let mouseY = 3.1858/sw * (1.26*sh - e.clientY);
      let row = (doc(id).pos[1] - mouseY) / doc(id).fontHeight >> 0;
      isOverText = row < C.length-1;
      if (isMouseDown && doc(id).isHit && ! isOverText) {
         doc(id).pos[0] += mouseX - te2.mouseX;
         doc(id).pos[1] += mouseY - te2.mouseY;
      }
      te2.mouseX = mouseX;
      te2.mouseY = mouseY;
      if (! isMouseDown)
         hitTest();
      server.broadcastGlobal('te2');
   }

   window.mouseup = e => {
      let id = te2.id;
      isMouseDown = false;
      let col = (te2.mouseX - doc(id).pos[0]) / doc(id).fontHeight * 2 + doc(id).nCols / 2 >> 0;
      let row = (doc(id).pos[1] - te2.mouseY) / doc(id).fontHeight >> 0;
      if (isOverText) {
         doc(id).col = col;
         doc(id).row = row;
         doc(id).i = Math.min(C[row] + col, C[row+1]-1);
         setCol = false;
         updateText();
      }
   }

   // RESPOND TO KEYBOARD KEY EVENTS

   let isKeyDown = {};

   window.keydown = e => isKeyDown[e.key] = true;

   window.keyup = e => {
      let id = te2.id;
      isKeyDown[e.key] = false;
      setCol = true;
      let key = e.key;
      if (isKeyDown.Alt) {
         switch (key) {
	 case '≠': doc(id).fontHeight *= Math.pow(2,1/7); break;
	 case '–': doc(id).fontHeight /= Math.pow(2,1/7); break;
	 case 'ArrowUp'   : defineTextMesh(id, doc(id).nCols, ++doc(id).nRows); break;
	 case 'ArrowDown' : defineTextMesh(id, doc(id).nCols, --doc(id).nRows); break;
	 case 'ArrowLeft' : defineTextMesh(id, --doc(id).nCols, doc(id).nRows); break;
	 case 'ArrowRight': defineTextMesh(id, ++doc(id).nCols, doc(id).nRows); break;
	 default: return;
	 }
         updateText();
	 return;
      }
      switch (key) {
      case 'Alt':
      case 'Control':
      case 'Escape':
      case 'Meta':
      case 'Shift':
         break;
      case 'ArrowDown':
         if (doc(id).row < C.length-2) {
	    doc(id).i = Math.min(C[doc(id).row+1] + doc(id).col, C[doc(id).row+2]-1);
	    setCol = false;
	 }
         break;
      case 'ArrowUp':
         if (doc(id).row > 0) {
	    doc(id).i = Math.min(C[doc(id).row-1] + doc(id).col, C[doc(id).row]-1);
	    setCol = false;
	 }
         break;
      case 'ArrowLeft':
         doc(id).i = Math.max(doc(id).i - 1, 0);
         break;
      case 'ArrowRight':
         doc(id).i = Math.min(doc(id).i + 1, doc(id).text.length);
         break;
      case 'Backspace':
         if (doc(id).i > 0)
            doc(id).text = doc(id).text.substring(0,doc(id).i-1) + doc(id).text.substring(doc(id).i--);
         break;
      default:
         switch (key) {
	 case 'Enter': key = '\n'; break;
	 case 'Space': key = ' ' ; break;
	 }
         doc(id).text = doc(id).text.substring(0,doc(id).i) + key + doc(id).text.substring(doc(id).i);
         doc(id).i++;
         break;
      }
      updateText();
   }

   // CREATE THE CROSSHAIRS THAT SHOW THE MOUSE POSITION

   let crosshairs = model.add().dull();
   crosshairs.add('square').scale(.12,.49,1).color(0,0,0);
   crosshairs.add('square').scale(.49,.12,1).color(0,0,0);
   crosshairs.add('square').scale(.06,.43,1).move(0,0,.0005);
   crosshairs.add('square').scale(.43,.06,1).move(0,0,.0005);

   model.animate(() => {

      // GET UPDATED STATE FROM THE MASTER CLIENT

      te2 = server.synchronize('te2');
      if (te2.needToUpdate) {
         updateText();
         te2.needToUpdate = false;
      }
      for (let i = 0 ; i < te2.doc.length ; i++) {
         model.child(i).identity()
	               .move(doc(i).pos)
		       .move(0,0,.001 * i)
		       .scale(doc(i).fontHeight/2)
	               .move(-doc(i).nCols/2,0,0)
		       .flag('uFocus', i == te2.id);
      }
      crosshairs.identity().move(te2.mouseX,te2.mouseY,.0005).scale(doc(te2.id).fontHeight);
   });
}

