/*
	A scene to allow a client running on a computer
	to type on their physical keyboard and trackpad
	to edit a text document.  Other clients running
	on XR headsets can see the changing text window
	and cursor.
*/

// USEFUL CONSTANTS

const nCols = 50, nRows = 25, yTop = 1.5;

// RELOAD OR INITIALIZE THE SHARED TEXT EDITOR STATE

let tes_json = localStorage.getItem('tes');
if (tes_json)
   window.tes = JSON.parse(tes_json);
else
   window.tes = {
      i: 0,
      text: '',
      fontHeight: .007,
      needToUpdate: true,
      col: 0,
      row: 0,
      mouseX: 0,
      mouseY: 0,
   };

export const init = async model => {

   // DEFINE A NEW TEXT MESH FORM WITH nCols AND nRows

   let defineTextMesh = (form, nCols, nRows) => {
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
      clay.defineMesh(form, clay.trianglesMesh(vertexData));
      let mesh = clay.getMesh(form);
      mesh.nCols = nCols;
      mesh.nRows = nRows;
   }

   // SET THE CURSOR POSITION IN A TEXT MESH FORM

   let setTextCursor = (form, col, row) => {
      let mesh = clay.getMesh(form);
      let setCursorColor = (r, g, b) => {
	 let rgb = r + (g * 256 >> 0) + (b * 256 >> 0) * 256;
         let n = 6 * 16 * (mesh.nCols * mesh.cursor.row + mesh.cursor.col) + 8;
	 for (let i = 0 ; i < 6 ; i++)
	    mesh[n + i * 16] = rgb;
      }
      if (mesh.cursor)
         setCursorColor(.99, .99, .99);
      mesh.cursor = {col: col, row: row};
      setCursorColor(.0, .5, .99);
   }

   // SET THE MULTI-LINE TEXT CONTENTS OF A TEXT MESH FORM

   let setText = (form, str) => {
      let mesh = clay.getMesh(form);
      let nCols = mesh.nCols, nRows = mesh.nRows;

      // ERASE ANY PREVIOUS TEXT

      for (let n = 6 ; n < mesh.length ; n += 16)
         mesh[n] = mesh[n+1] = 0;

      // TEXTURE SUCCESSIVE QUADS IN THE MESH BY ASCII CHARACTERS

      for (let i=0, col=0, row=0 ; i < str.length ; i++, col++) {

         if (col >= nCols)           // CHARACTERS OFF TO THE RIGHT
	    continue;                // ARE JUST IGNORED

         let c = str.charCodeAt(i);

	 if (c == 10) {              // HANDLE LINE BREAK
	    if (++row >= nRows)
	       break;
	    col = -1;
	    continue;
	 }

         let u0 = ((c-32) % 12     ) / 12, u1 = u0 + 1 / 12;
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

   defineTextMesh('myTextMesh', nCols, nRows);
   let obj = model.add('myTextMesh').txtr(15).flag('uText');
   obj.customShader(`
      uniform int uText;
      ----------------------------------
      if (uText == 1) {
         opacity = texture(uSampler[15],uv).r < .5 ? 1. : .5;
	 color = vec3(1);
      }
   `);
   let objScale = () => 2 * tes.fontHeight;

   // WHENEVER TEXT CHANGES, UPDATE INTERNAL STATE VARIABLES AND RESYNC

   let C, setCol = true;

   let updateText = () => {
      C = [];
      let c = 0;
      let lines = tes.text.split('\n');
      for (let i = 0 ; i < lines.length ; i++) {
         C.push(c);
         let line = lines[i] + ' ';
         if (tes.i >= c && tes.i < c + line.length) {
	    tes.row = i;
	    if (setCol)
	       tes.col = tes.i - c;
         }
         c += line.length;
      }
      C.push(c);

      tes.needToUpdate = true;
      if (clientID == clients[0])
         server.broadcastGlobal('tes');

      setText('myTextMesh', tes.text);
      let i = Math.min(tes.col, C[tes.row+1]-1 - C[tes.row]);
      setTextCursor('myTextMesh', i, tes.row);
   }
   updateText();

   // SET CURSOR POSITION CORRESPONDING TO WHERE THE USER CLICKS.
   // FOR THIS TO WORK PROPERLY, BROWSER WINDOW MUST BE MAXIMIZED

   window.interactMode = 4;

   window.mousemove = e => {
      tes.mouseX =  e.clientX/565 - 1.595;
      tes.mouseY = -e.clientY/565 + 2.6  ;
      server.broadcastGlobal('tes');
   }

   window.mouseup = e => {
      tes.col = nCols / 2 + tes.mouseX  / objScale() >> 0;
      tes.row = (yTop - tes.mouseY) / 2 / objScale() >> 0;
      tes.i   = Math.min(C[tes.row] + tes.col, C[tes.row+1]-1);
      setCol = false;
      updateText();
   }

   // RESPOND TO KEYBOARD KEY EVENTS

   let isKeyDown = {};

   window.keydown = e => isKeyDown[e.key] = true;

   window.keyup = e => {
      isKeyDown[e.key] = false;
      setCol = true;
      let key = e.key;
      switch (key) {
      case 'Alt':
      case 'Control':
      case 'Escape':
      case 'Meta':
      case 'Shift':
         break;
      case 'ArrowDown':
         if (isKeyDown.Shift)
	    tes.fontHeight /= 1.41428;
         else if (tes.row < C.length-2) {
	    tes.i = Math.min(C[tes.row+1] + tes.col, C[tes.row+2]-1);
	    setCol = false;
	 }
         break;
      case 'ArrowUp':
         if (isKeyDown.Shift)
	    tes.fontHeight *= 1.41428;
         else if (tes.row > 0) {
	    tes.i = Math.min(C[tes.row-1] + tes.col, C[tes.row]-1);
	    setCol = false;
	 }
         break;
      case 'ArrowLeft':
         tes.i = Math.max(tes.i - 1, 0);
         break;
      case 'ArrowRight':
         tes.i = Math.min(tes.i + 1, tes.text.length);
         break;
      case 'Backspace':
         if (tes.i > 0)
            tes.text = tes.text.substring(0,tes.i-1) + tes.text.substring(tes.i--);
         break;
      default:
         switch (key) {
	 case 'Enter': key = '\n'; break;
	 case 'Space': key = ' ' ; break;
	 }
         tes.text = tes.text.substring(0,tes.i) + key + tes.text.substring(tes.i);
         tes.i++;
         break;
      }
      updateText();
      localStorage.setItem('tes', JSON.stringify(tes));
      tes.needToUpdate = false;
   }

   // CREATE THE CROSSHAIRS THAT SHOW THE MOUSE POSITION

   let crosshairs = model.add().dull();
   crosshairs.add('square').scale(.0016,.0098,1).color(0,0,0);
   crosshairs.add('square').scale(.0098,.0016,1).color(0,0,0);
   crosshairs.add('square').scale(.0009,.0090,1).move(0,0,.0005);
   crosshairs.add('square').scale(.0090,.0009,1).move(0,0,.0005);

   model.animate(() => {

      // GET UPDATED STATE FROM THE MASTER CLIENT

      tes = server.synchronize('tes');
      if (tes.needToUpdate) {
         updateText();
         tes.needToUpdate = false;
      }

      // DRAW THE TEXT EDITOR OBJECT AND MOUSE CROSSHAIRS

      obj.identity().move(0,yTop,0).scale(objScale()).move(-nCols/2,0,0);
      crosshairs.identity().move(tes.mouseX,tes.mouseY,.0005).scale(70 * objScale());
   });
}

