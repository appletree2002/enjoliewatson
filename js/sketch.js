//browser start :  browser-sync start --server -f -w
//Run this command to get a live debug environment in browser
//This will refresh everytime you save a file in vs code.
var repo_address = "";
var current_state = new main_menu(), current_state_flag = "main_menu";
var host_address = "127.0.0.1", global_port = 3128;
var font_set, font_size_scaling, connected_to_server;
var game_bounds, g_cam;

/*
P5 has several default functions.
These include, but are not limited to:
preload(), setup(), draw(), keyPressed(), keyReleased, mousePressed(), and mouseReleased().
preload() and setup() run once on startup, but can be called again.
draw() runs every time the frame is updated, and is an active rendering function.
The others listed are named after the events that activate them, and relate to user input.

Since we've written games as classes, each game will have its own corresponding function to each of these.
For instance, fruitgame has its own draw function, as well as a setup() that initializes local game variables.
Since the current game is stored in the variable current_state, the actual default functions which are 
listed below can simply call current_state's respective function (i.e. current_state.setup()).
*/


function preload() {  //This is a default p5 function which executes on load. Since games are written as functions, I've given each
  return;
}

function sigmoid_shift(peak_value, t1, t2, speed, t) { //a sigmoid smoothly goes from 0 to 1 around x = 0, and is scaled here accordingly.
  var exp_value = ((t - t1)/(t2 - t1) - 0.5)*10*speed;
  return peak_value / (1 + Math.exp(-(exp_value)));
}

function sigmoid_array(p_array, t_array, speed_array, t) { //this sums sigmoids in a way that is useful for animating.
  // smooth transitions along the real numbers from p1 at time t1 to p2 at time t2, etc.
  //I'm using this for nice UI animations.
  sum = p_array[0]
  for (i = 1; i < p_array.length; i++){
    var exp_value = ((t -  t_array[i-1]) / (t_array[i] - t_array[i-1]) - 0.5 ) * 10 * speed_array[i-1];
    sum += (p_array[i] - p_array[i-1]) / (1 + Math.exp(-(exp_value)));
  }
  return sum
}

function rainbow_gradient(t) {
  var r = 255*(Math.sin(1+t*3.19)+1)/2,
      g = 255*(Math.cos(2+t*2.15)+1)/2,
      b = 255*(Math.sin(3+t*2.23)+1)/2;
  return [r, g, b];
}

function make_socket() {
  if (host_address.includes(":") && !(host_address.includes("["))) {
    host_address = "[" + host_address + "]"; //IPv6 correction, urls written as ws://[::1]:3128/
  }
  console.log("Connecting to: "+"wss://"+host_address+":"+str(global_port));
  connected_to_server = false;
  socket = new WebSocket("wss://"+host_address+":"+str(global_port)); //Declares the websocket for connecting to host server.
  socket.onopen = (event) => { open_socket(); };                  //Sets function trigger for websocket being opened
  socket.onmessage = (event) => { process_message(event.data); }; //Sets function trigger for websocket recieving data
}

function setup() {
  console.log(millis());
  createCanvas(windowWidth, windowHeight); //Enables the canvas size. These are stored in global variables named width and height.
  background(50, 50, 50); //Declares the background color via RGB.
  g_cam = new g_camera(width/2, height/2, 1);
  connected_to_server = false;      //This variable is for referencing if the server is connected or no. We'll add features like auto-reconnect.

  font_set =[loadFont("media/fonts/Inconsolata.ttf"),
                loadFont("media/fonts/Alpharush.ttf"),
                loadFont("media/fonts/PublicPixel.ttf")];
  font_size_scaling = [1, 1.2, 0.5];
  make_socket();
  current_state.setup();
}

function open_socket() {
  socket.send("connected");
  connected_to_server = true;
}

function process_message(data) {          //Event function to process data recieved from the server through the websocket.
  var lines = data.split("\n");
  for (let i in lines) {
    console.log("line "+str(i)+": "+lines[i]);
    var line_split = lines[i].split(":");
    var flag = line_split[0],
        message = null;
    if (line_split.length > 1) { message = line_split[1]; }
    if (flag == "current_game" && current_state_flag != "main_menu") { swap_current_state(message); }
    current_state.read_network_data(flag, message);  //Feeds to current_state's local data recieved function.
  }
}

function convert_data_string(message, ints, floats, strings) {
  // Converts messages into an array of ints, floats, and strings according to passed indices for each.
  var message_split = message.split(",");
  var return_vals = [];
  for (let i in message_split) { return_vals[i] = NaN; }
  if (!(ints === undefined)) {
    for (let i in ints) {
      if (message_split[ints[i]] != "") { return_vals[ints[i]] = parseInt(message_split[ints[i]]); }
    }
  }
  if (!(floats === undefined)) {
    for (let i in floats) {
      if (message_split[floats[i]] != "") { return_vals[floats[i]] = parseInt(message_split[floats[i]]); }
    }
  }
  if (!(strings === undefined)) {
    for (let i in strings) { return_vals[strings[i]] = message_split[strings[i]]; }
  }
  return return_vals
}

function send_data(data) {  //Global function to send data to server.
  if (connected_to_server) { socket.send(data); }
}

function font_make(index, size) {
  textFont(font_set[index]);
  textSize(font_size_scaling[index]*size);
}

function text_make(font_index, size, stroke, stroke_weight) {
  textFont(font_set[font_index]);
  textSize(font_size_scaling[font_index]*size);
  strokeWeight(stroke_weight);
  //stroke(stroke);
}

function keyPressed() { //Event function that triggers upon user pressing a key on their keyboard.
  current_state.key_pressed(keyCode); 
}

function keyReleased() {  //Event function that triggers upon user releasing a key on their keyboard.
  current_state.key_released(keyCode);
}

function mousePressed() { current_state.mouse_pressed(); }
function mouseReleased() { current_state.mouse_released(); }

function draw() { //Global frame render function.
  background(200, 200, 200);
  current_state.draw();
}

function swap_current_state(flag) { //Global function for changing current_state
  if (flag == "main_menu") { current_state = new main_menu(); }
  else if (flag == "load_screen") { current_state = new load_screen(); }
  else if (flag == "fruit_game") { current_state = new fruitGame(); }
  else if (flag == "purgatory") { current_state = new purgatory(); }
  else { return; }
  current_state.setup();
  current_state_flag = flag;
}

class g_camera {
  constructor(x, y, scale) {
    this.x = x;
    this.y = y;
    this.scale = scale;
  }
  
  update(x, y, scale) {
    this.x = x;
    this.y = y;
    this.scale = scale;
  }

  reset() {
    this.x = width/2;
    this.y = height/2;
    this.scale = 1;
  }

  new_coords(x, y) { //Map x in the coords to 
    var new_x = (x - this.x) * this.scale + width/2;
    var new_y = (y - this.y) * this.scale + height/2;
    return [new_x, new_y];
  }

  new_x(x) {
    return (x - this.x) / this.scale + width/2;
  }

  new_y(y) {
    return (y - this.y) / this.scale + height/2;
  }

  new_size(in_value) {
    return in_value / this.scale;
  }

  translate(x, y) {
    translate(this.new_x(x), this.new_y(y));
  }

  image(img, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight) {
    if (dx != null || dy != null) { this.translate(dx, dy); }
    image(img, 0, 0, this.new_size(dWidth), this.new_size(dHeight), sx, sy, sWidth, sHeight);
  }

  stroke_weight_adjust() {
    
  }

  text_size_adjust() {
    var old_size = textSize()
  }

  text(str_in, x, y) { 
    var old_text_size = textSize();
    textSize(textSize()/this.scale);
    text(str_in, this.new_x(x), this.new_y(y));
    textSize(old_text_size);
  }

  rect(x, y, w, h) {
    rect(this.new_x(x), this.new_y(y), this.new_size(w), this.new_size(h));
  }
}

class game_1_player {
  constructor(spriteSheet, x, y, face) {
    this.spriteSheet = spriteSheet;
    this.sx = 0;        //Frame counter for when the player is moving.
    this.x = x;
    this.y = y;
    this.move = 0;      //Whether or not player is moving. Int is more convenient than boolean for network messages.
    this.speed = 5;     // Player movement speed
    this.facing = face; // use 4, maybe 8 later. 0, 1, 2, 3 for East West North South respectively
    this.sprite_row = 0;
    this.fruit_holding = 0;
    this.fruit_held_id = 0;
    this.bounds = [0, 2000, 0, 1000];
  }

  draw() {
    push();
    g_cam.translate(this.x, this.y);
    if (this.move == 1){
      if (this.facing < 2){
        scale(1-this.facing*2, 1);  
        g_cam.image(this.spriteSheet, null, null, 100, 100, 80*(this.sx+1), 0, 80, 80);
        this.x = this.x + this.speed * (1-this.facing*2);
      } else if (this.facing == 2) {
        g_cam.image(this.spriteSheet, null, null, 100, 100, 80*(this.sx), 400, 80, 80);
        this.y = this.y - this.speed;
      } else if (this.facing == 3) {
        g_cam.image(this.spriteSheet, null, null, 100, 100, 480 + 80*(this.sx), 400, 80, 80);
        this.y = this.y + this.speed;
      }

      this.x = Math.min(this.bounds[1]-40, Math.max(this.bounds[0]+40, this.x));    //Prevents the player from leaving the game boundaries.
      this.y = Math.min(this.bounds[3]-40, Math.max(this.bounds[2]+40, this.y));   

    }
    else {
      if (this.facing < 2){
        scale(1-this.facing*2, 1);  
        g_cam.image(this.spriteSheet, null, null, 100, 100, 0, 0, 80, 80);
      } else if (this.facing == 2) {
        g_cam.image(this.spriteSheet, null, null, 100, 100, 0, 400, 80, 80);
      } else if (this.facing == 3) {
        g_cam.image(this.spriteSheet, null, null, 100, 100, 480, 400, 80, 80);
      }
    }
    
    if (frameCount % 6 == 0) {
      this.sx = (this.sx + 1) % 6;
    }

    pop();
  }

  grab_fruit(fruit_id, size){
    this.fruit_holding = 1;
    this.fruit_held_id = fruit_id;
    this.speed = 15/size;
  }

  drop_fruit(){
    this.speed = 5;
    this.fruit_holding = 0;
  }

  get_pos_string(){
    var string_make = str(this.x)+","+str(this.y)+","+str(this.move)+","+str(this.facing);
    return string_make;
  }
  
  update_data(sprite, x, y, move, speed, facing, fruit_holding, fruit_id){
    //if (sprite != null) {this.spriteSheet = }
    if (x != null) { this.x = x; }
    if (y != null) { this.y = y; }
    if (move != null) { this.move = move; }
    if (speed != null) { this.speed = speed; }
    if (facing != null) { this.facing = facing; }
    if (fruit_holding != null) { this.fruit_holding = fruit_holding; }
    if (fruit_id != null) { this.fruit_held_id = fruit_id; }
  }

  make_data_raw(){
    return this.x+","+this.y+","+this.move+","+
            this.speed+","+this.facing+","+this.fruit_holding+","+this.fruit_held_id;
  }

  make_data(player_index){
    var string_make = "pos_player:"+player_index+","+this.x+","+this.y+","+this.move+","+
                      this.speed+","+this.facing+","+this.fruit_holding+","+this.fruit_held_id;
    return string_make;
  }
}

class game_1_fruit {

  /*
  network commands:
  make_fruit:x,y,size
  upd_fruit:x,y,size,held,scored,player_holding_id //from server

  */

  constructor(spriteSheet, x, y, size) {
    this.spriteSheet = spriteSheet;
    this.x = x;
    this.y = y;
    this.size = int(size);
    this.held = 0;
    this.scored = 0;
    this.player_holding_id = 0;
    this.sprite_select = 0;
    if ((size < 5) || (size > 15)) {
      size = Math.min(15, Math.max(0, 5));
    }

    if (size > 12) {
      this.sprite_select = 3;
    } else if (size > 10) {
      this.sprite_select = 2;
    } else if (size > 7) {
      this.sprite_select = 1;
    }
  }

  draw() {
    if (this.scored) {
      return;
    }
    push();
    g_cam.translate(this.x, this.y);
    g_cam.image(this.spriteSheet, null, null, 20, 20, 20*(this.sprite_select), 0, 20, 20);
    pop();
  }

  update_position(x, y) {
    this.x = x;
    this.y = y;
  }

  check_grabbed(x, y, player_index) {
    if (this.held || this.scored) {
      return;
    }
    var player_x_norm = Math.abs(x - this.x),
        player_y_norm = Math.abs(y - this.y);
    if ((player_x_norm <= 40) & (player_y_norm <= 40)) {
      this.held = 1;
      this.player_holding_id = player_index;
    }
  }

  drop() {
    this.held = 0;
  }

  update_data(x, y, size, held, scored, player_holding_id) {
    if (!(isNaN(x)) && x != null) {this.x = x;}
    if (!(isNaN(y)) && y != null) {this.y = y;}
    if (!(isNaN(size)) && size != null) {this.size = size;}
    if (!(isNaN(held)) && held != null) {this.held = held;}
    if (!(isNaN(scored)) && scored != null) {this.scored = scored;}
    if (!(isNaN(player_holding_id)) && player_holding_id != null) {this.player_holding_id = player_holding_id;}
    if (this.size > 12) { this.sprite_select = 3; }
    else if (this.size > 10) { this.sprite_select = 2; } 
    else if (this.size > 7) { this.sprite_select = 1; } 
    else { this.sprite_select = 0; }
  }

  make_data(index) {
    var str_make = "pos_fruit:"+str(index)+","+str(this.x)+","+str(this.y)+","+
                    str(this.size)+","+str(this.held)+","+str(this.scored)+","+str(this.player_holding_id);
    return str_make;
  }
}

class game_1_endzone {
  constructor(x1, x2, y1, y2) {
    this.x = x1;
    this.y = y1;
    this.width = x2 - x1;
    this.height = y2 - y1;  
    this.score = 0;
  }

  draw(){
    push();
    text_make(0, 30, 0, 1);
    fill(255, 204, 0);
    g_cam.rect(this.x, this.y, this.width, this.height);
    fill(0, 0, 0);
    g_cam.text(str(this.score), this.width/2+this.x, this.height/2+this.y);
    pop();
  }

  check_placement(x, y){
    x -= this.x;
    y -= this.y;
    if ((x >= 0) && (x <= this.width) && (y >= 0) && (y <= this.height)) {
      return true;
    }
    return false;
  }

  update_data(x, y, width, height, score){
    if (!isNaN(x)) { this.x = x; }
    if (!isNaN(y)) { this.y = y; }
    if (!isNaN(width)) { this.width = width; }
    if (!isNaN(height)) { this.height = height; }
    if (!isNaN(score)) { this.score = score; }
  }

  make_data(index){
    return "upd_endzone:"+str(index)+","+str(this.x)+","+str(this.y)+","+str(this.width)+","+str(this.height)+","+str(this.score);
  }

}

class button {
  constructor(x_in, y_in, width_in, height_in, color, text_color, text) {
    this.x_cen = x_in;
    this.y_cen = y_in;
    this.box_width = width_in;
    this.box_height = height_in;
    this.text = text;
    this.color = color;
    this.text_color = text_color;
    this.pressed = 0;
    this.execute = function() {return;}
  }

  draw() {
    fill(this.color[0], this.color[1], this.color[2]);
    stroke(10);
    if (this.pressed) {strokeWeight(3);} else {strokeWeight(1);}
    rect(this.x_cen - this.box_width/2, this.y_cen - this.box_height/2, this.box_width, this.box_height);
    strokeWeight(0);
    textAlign(CENTER, CENTER);
    text_make(0, 0.3*Math.min(this.box_width, this.box_height), 0, 0);
    fill(this.text_color[0], this.text_color[1], this.text_color[2]);
    text(this.text, this.x_cen, this.y_cen);
  }

  check_press(x, y) {
    if ((Math.abs(x - this.x_cen) < this.box_width/2) && 
        (Math.abs(y - this.y_cen) < this.box_height/2)) {
          this.pressed = 1;
          return true;
    }
    return false;
  }

  activate() {
    this.execute();
  }

}

class board_game_player {
  constructor(spriteSheet, x, y, face) {
    this.spriteSheet = spriteSheet;
    this.sx = 0;
    this.x = x;
    this.y = y;
    this.move = 0;
    this.speed = 5;
    this.facing = face; // use 4, maybe 8 later. 0, 1, 2, 3 for EWNS respectively
    this.sprite_row = 0;
    this.fruit_holding = 0;
    this.fruit_held_id = 0;
  }
  
  draw() {
    push();
    translate(this.x, this.y);
    if (this.move == 1){
      if (this.facing < 2){
        scale(1-this.facing*2, 1);  
        image(this.spriteSheet, 0, 0, 100, 100, 80*(this.sx+1), 0, 80, 80);
        this.x = this.x + this.speed * (1-this.facing*2);
      } else if (this.facing == 2) {
        image(this.spriteSheet, 0, 0, 100, 100, 80*(this.sx), 400, 80, 80);
        this.y = this.y - this.speed;
      } else if (this.facing == 3) {
        image(this.spriteSheet, 0, 0, 100, 100, 480 + 80*(this.sx), 400, 80, 80);
        this.y = this.y + this.speed;
      }

      this.x = Math.min(width-40, Math.max(40, this.x));
      this.y = Math.min(height-40, Math.max(40, this.y));

    }
    else {
      if (this.facing < 2){
        scale(1-this.facing*2, 1);  
        image(this.spriteSheet, 0, 0, 100, 100, 0, 0, 80, 80);
      } else if (this.facing == 2) {
        image(this.spriteSheet, 0, 0, 100, 100, 0, 400, 80, 80);
      } else if (this.facing == 3) {
        image(this.spriteSheet, 0, 0, 100, 100, 480, 400, 80, 80);
      }
    }
    
    if (frameCount % 6 == 0) {
      this.sx = (this.sx + 1) % 6;
    }

    pop();
  }

  get_pos_string(){
    var string_make = str(this.x)+","+str(this.y)+","+str(this.move)+","+str(this.facing);
    return string_make;
  }
  
  update_data(sprite, x, y, move, speed, facing, fruit_holding, fruit_id){
    //if (sprite != null) {this.spriteSheet = }
    if (x != null) { this.x = x; }
    if (y != null) { this.y = y; }
    if (move != null) { this.move = move; }
    if (speed != null) { this.speed = speed; }
    if (facing != null) { this.facing = facing; }
    if (fruit_holding != null) { this.fruit_holding = fruit_holding; }
    if (fruit_id != null) { this.fruit_held_id = fruit_id; }
  }

  make_data_raw(){
    return this.x+","+this.y+","+this.move+","+
            this.speed+","+this.facing+","+this.fruit_holding+","+this.fruit_held_id;
  }

  make_data(player_index){
    var string_make = "pos_player:"+player_index+","+this.x+","+this.y+","+this.move+","+
                      this.speed+","+this.facing+","+this.fruit_holding+","+this.fruit_held_id;
    return string_make;
  }
}

function fruitGame() {
  this.setup = function() {
    this.fruits_count = 15;
    this.players = [];
    this.fruits = [];
    this.endzones = [];
    this.game_active = 0;
    this.game_length = 30.000;
    this.start_time;
    this.current_time = this.game_length;
    this.main_player_index;
    this.arrow_keys = [39, 37, 38, 40];  
    this.sounds = new Tone.Players({
      Fail : 'media/sounds/fail_sound.mp3',
      Win : 'media/sounds/win_sound.mp3',
      Hit : 'media/sounds/hit.mp3',
      Miss : 'media/sounds/miss.mp3'
    })
    this.sounds.toDestination();
    this.soundNames = ['Fail', 'Win', 'Hit', 'Miss']
    this.greenSprite = loadImage(repo_address+"media/sprites/Green.png");
    this.fruitSprite = loadImage(repo_address+"media/sprites/fruit_sprites.png");
    this.start_time = millis()/1000;
    this.game_dimensions = [2000, 1000];
    textFont(font_set[0]);
    textSize(20);
    textAlign(CENTER, CENTER);
    fill(0, 0, 0);
    imageMode(CENTER);
    for (i=0; i < 15; i++) {
      this.fruits[i] = new game_1_fruit(this.fruitSprite, width*Math.random(), height*Math.random(), 3+Math.random()*12);
    }
    this.players[0] = new game_1_player(this.greenSprite, 200, 200, 0);
    this.endzones[0] = new game_1_endzone(0, 100, 200, 400);
    this.endzones[1] = new game_1_endzone(500, 600, 200, 400);
    this.main_player_index = 0;
    this.end_message = "GAME OVER";
    g_cam.reset();
  }

  this.key_pressed = function(keycode) {
    for (i=0;i<4;i++){
      if (keycode == this.arrow_keys[i]){
        this.players[this.main_player_index].facing = i;
        this.players[this.main_player_index].move = 1;
        this.players[this.main_player_index].sx = 0;
        send_data("my_pos:"+this.players[this.main_player_index].make_data_raw());
        return;
      }
    }
    if (this.game_active != 1) { return; }
    if (keycode == 32) {
      if (this.players[this.main_player_index].fruit_holding == 1) {
        var fruit_id = this.players[this.main_player_index].fruit_held_id;
        this.players[this.main_player_index].drop_fruit();
        this.fruits[fruit_id].drop();
        for (i=0; i<this.endzones.length; i++) {
          var fr_x = this.fruits[fruit_id].x,
              fr_y = this.fruits[fruit_id].y;
          if (!(this.fruits[this.players[this.main_player_index].fruit_held_id].scored) &&
              this.endzones[i].check_placement(fr_x, fr_y)) {
            this.fruits[fruit_id].scored = 1;
            this.endzones[i].score += this.fruits[fruit_id].size;
            send_data(this.fruits[fruit_id].make_data(fruit_id)+"\n"+
                  this.players[this.main_player_index].make_data(this.main_player_index)+"\n"+
                  this.endzones[i].make_data(i));
            break;
          }
        }
        this.playSound("Miss");
        send_data(this.fruits[fruit_id].make_data(fruit_id)+"\n"+
                  this.players[this.main_player_index].make_data(this.main_player_index));
      } else {
        for (i=0; i < this.fruits.length; i++) {
          this.fruits[i].check_grabbed(
            this.players[this.main_player_index].x, 
            this.players[this.main_player_index].y,
            this.main_player_index
          );
          if (this.fruits[i].held) {  
            this.players[this.main_player_index].grab_fruit(i, this.fruits[i].size);
            this.playSound("Hit");

            send_data(this.fruits[i].make_data(i)+"\n"+
                      this.players[this.main_player_index].make_data(this.main_player_index));
            
            return;
          }
        }
      }
    }
  }

  this.key_released = function(keycode) {
    for (i=0;i<4;i++){
      if(keycode == this.arrow_keys[i] && this.players[this.main_player_index].facing == i) {
        this.players[this.main_player_index].move = 0;
      }
    }
    send_data("my_pos:"+this.players[this.main_player_index].make_data_raw());
  }

  this.mouse_pressed = function() { return; }
  this.mouse_released = function() { return; }

  this.draw = function() {
    textFont(font_set[0]);
    this.current_time = this.game_length - ((millis()/1000) - this.start_time);
    if (this.game_active == 0) { this.draw_game_load(); }
    else if (this.game_active == 1) { this.draw_game_active();}
    else if (this.game_active == 2) { this.draw_game_over(); }
  }

  this.draw_game_load = function() {
    background(200, 200, 200);
    fill(0, 0, 0);
    text_make(0, 50, 0, 0);
    for (let i in this.players) {
      this.players[i].draw();
    }
    textAlign(CENTER, CENTER);
    g_cam.text("Game starts in "+str(int(this.current_time)), width/2, height/2);
    if (this.current_time < 0) {
      this.game_active = 1;
    }
  }

  this.draw_game_active = function() {
    g_cam.x = this.players[this.main_player_index].x;
    g_cam.y = this.players[this.main_player_index].y;
    g_cam.scale = 0.8;
    background(200, 200, 200);
    fill(0, 0, 0);
    text_make(0, 50, 0, 0);
    textSize(50);
    for (let i in this.endzones) { this.endzones[i].draw(); }
    for (let i in this.players) {
      if (this.players[i].fruit_holding == 1) {
        this.fruits[this.players[i].fruit_held_id].update_position(
          this.players[i].x, this.players[i].y
        );
      }
      this.players[i].draw();
    }
    for (let i in this.fruits){ this.fruits[i].draw(); }
    text("Time: "+str(Math.max(0, int(this.current_time))), width/2, 50);
  }

  this.game_over = function() {
    g_cam.reset();
    this.start_time = millis()/1000;
    var indices_winners = [0], max=0;
    for (let i in this.endzones) {
      if (this.endzones[i].score > max) {
        indices_winners = [i];
        max = this.endzones[i].score;
      } else if (this.endzones[i].score == max) {
        indices_winners[indices_winners.length] = i;
      }
    }
    if (indices_winners.length > 1) {
      this.end_message = "TIE";
      /*
      for (let i in indices_winners) {
        this.end_message += "Team "+str(indices_winners[i])+",";
      }
      */
    } else {
      this.end_message = "TEAM "+str(indices_winners)+" WINS";
    }
    console.log(this.end_message);
    this.game_active = 2;
  }

  this.draw_game_over = function() {
    var time = this.game_length - this.current_time;
    var breakpoint = 3;
    var text_position_x = sigmoid_array([width*2, width/2, -width], [0, 1.5, 3], [1.5, 3], time),
        box_position_x = sigmoid_array([-width, width/2, width*2], [0, 1.5, 3], [1.5, 3], time),
        r = 255*(Math.sin(time/5)+1)/2,
        g = 255*(Math.cos(time/5.13)+1)/2,
        b = 255*(Math.sin(time/5.3+5)+1)/2;
    stroke(51);
    strokeWeight(2);
    textSize(100);
    textAlign(CENTER, CENTER);
    textStyle(ITALIC);
    fill(127.5+g/2, 127.5+b/2, 127.5+r/2);
    if (time < breakpoint) {
      stroke(0, 0, 0);
      strokeWeight(4);
      fill(255, 78, 0);
      g_cam.rect(box_position_x-250, height/2 - 100, 500, 200);
      fill(r, g, b);
      g_cam.text("GAME OVER", text_position_x, height/2);
      return;
    }
    stroke(51);
    strokeWeight(4);
    font_make(0, 100);
    textAlign(CENTER, CENTER);
    for (i=Math.max(0, Math.floor(20*((time - breakpoint)/1.5)%39-20)); 
        i<Math.min(20, Math.floor(20*((time - breakpoint)/1.5)%39));i++) {
      text_make(int(time*2) % 3, 100, 51, 4);
      var r = 255*(Math.sin(time*2+i*PI/15+3)+1)/2,
          g = 255*(Math.cos(time*2+i*PI/15)+1)/2,
          b = 255*(Math.sin(time*2+i*PI/15+5)+1)/2;
      fill(r, g, b);
      g_cam.text(this.end_message, width/2, i*25+height/2-250);
    }
    
  }
  
  this.playSound = function(whichSound='Fail') {
    this.sounds.player(whichSound).start();
  }

  this.read_network_data = function(flag, message) {
    /*
    Server packets will be formatted as such

    new_player:id
    pos_player:3,500,200,3,1    (id, x_pos, y_pos, facing, moving, speed)
    rmv_player:3                deletes player from array

    multiple statements can be send, split by newline \n

    on connection
    assigned_id:3               tells client where they are in server array

    new_id:2                    if a player leaves, indices change, and the assignments will too
    */
    //console.log("Recieved:" + str(data_in));
    if (flag == "player_count") {
      for (j=this.players.length; j < parseInt(message); j++){
        this.players[j] = new game_1_player(this.greenSprite, 300, 300, 1);
      }
    } else if (flag == "assigned_id") {
      this.main_player_index = parseInt(message);
    } else if (flag == "pos_player") {
      this.read_in_player_position(message);
    } else if (flag == "new_player") {
      this.players[parseInt(message)] = new game_1_player(this.greenSprite, 300, 300, 0);
    } else if (flag == "rmv_player") {
      var player_index = parseInt(message);
      this.players.splice(player_index, 1);
      if (this.main_player_index > player_index) {
        this.main_player_index -= 1;
      }
    } else if (flag == "pos_fruit") {
      this.read_in_fruit_position(message);
    } else if (flag == "upd_endzone") {
      this.read_in_endzone_data(message);
    } else if (flag == "game_state") {
      this.read_in_game_state(message)
    } //else if (flag == "pop_fruit") {
      //this.fruits.splice(parseInt(message), 1);
    //}
  }

  this.read_in_player_position = function(data_string) { //format packet as pos_player:id,x,y,move,speed,facing,fruit_holding,fruit_id
    p_vals = convert_data_string(data_string, [0, 3, 5, 6, 7], [1, 2, 4]);
    this.players[p_vals[0]].update_data(null, p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7]);
  }

  this.read_in_fruit_position = function(data_string) {
    p_vals = convert_data_string(data_string, [0, 3, 4, 5, 6], [1, 2]);
    if (p_vals[0] >= this.fruits.length) { this.fruits[p_vals[0]] = new game_1_fruit(this.fruitSprite, 0, 0, 0); }
    this.fruits[p_vals[0]].update_data(p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6]);
    return p_vals[0];
  }

  this.read_in_endzone_data = function(data_string) {
    p_vals = convert_data_string(data_string, [0, 5], [1, 2, 3, 4]);
    if (p_vals[0] >= this.endzones.length) { this.endzones[p_vals[0]] = new game_1_endzone(0, 0, 0, 0); }
    this.endzones[p_vals[0]].update_data(p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5]);
  }
  this.read_in_game_state = function(data_string) {
    p_vals = convert_data_string(data_string, [0], [1, 2]);
    this.current_time = p_vals[1];
    this.game_active = p_vals[0];
    this.game_length = p_vals[2];
    this.start_time = millis()/1000 - (this.game_length - this.current_time);
    if (this.game_active != 2 && p_vals[0] == 2) { this.game_over(); }
  }
}

function uiTest() {
  this.setup = function() {
    this.time = millis();
  }

  this.key_pressed = function(keycode) {
    return;
  }

  this.key_released = function(keycode) {
    return;
  }
  
  this.draw = function() {
    this.time = millis();
    fill(255, 255, 255);
    rect(width/2-200, height/2-200, 400, 400);
    textSize(20);
    fill(0, 0, 0);
    text("Time: "+str(this.time), width/2, height/2);
  }

  this.read_network_data = function(flag, message) {
    console.log("network_data_read");
    return;
  }
}

function main_menu() {
  this.setup = function() {
    this.start_time = millis()/1000;
    this.server_address_input;
    this.server_port_input;
    this.cert_hyperlink;
    this.temp_server_address = host_address;
    this.temp_server_port = str(global_port);
    this.current_time = 0.000;
    this.current_menu = 1;
    this.buttons_menu_1 = [];
    this.buttons_menu_2 = [];
    this.buttons_menu_3 = [];
    this.button_funcs = [];
    this.buttons_menu_1[0] = new button(width/2 - 150, 200, 150, 100, [255, 78, 0], [10, 10, 10], "Certify");
    this.buttons_menu_1[1] = new button(width/2 + 150, 200, 150, 100, [255, 78, 0], [10, 10, 10], "Connect");
    this.buttons_menu_1[2] = new button(width/2 - 150, 350, 150, 100, [255, 78, 0], [10, 10, 10], "Server");
    this.buttons_menu_2[0] = new button(width/2 - 100, 400, 150, 100, [255, 78, 0], [10, 10, 10], "Submit");
    this.buttons_menu_2[1] = new button(width/2 + 100, 400, 150, 100, [255, 78, 0], [10, 10, 10], "Cancel");
    this.buttons_menu_3[0] = new button(width/2, 400, 150, 100, [255, 78, 0], [10, 10, 10], "Back");
    g_cam.reset();
  }

  this.draw = function() {
    this.current_time = millis()/1000 - this.start_time;
    if (this.current_time < 3) { this.draw_startup_animation(); return; }
    if (this.current_menu == 1) { this.draw_menu_1(); }
    else if (this.current_menu == 2) { this.draw_menu_2(); }
    else if (this.current_menu == 3) { this.draw_menu_3(); }
  }

  this.draw_menu_1 = function() {
    var r_color = rainbow_gradient(2*this.current_time);
    textAlign(CENTER, CENTER);
    text_make(2, 90, 0, 2);
    fill(r_color[0], r_color[1], r_color[2]);
    text("RETRO ROYALE", width/2, 50);
    for (let i in this.buttons_menu_1) { this.buttons_menu_1[i].draw(); }
    text_make(0, 10, 0, 1);
    stroke(11);
    if (connected_to_server) {
      fill(0, 255, 0);
      text("Connected", width - 50, 10);
    } else {
      fill(255, 0, 0);
      text("Not connected", width - 50, 10);
    }
  }

  this.draw_menu_2 = function() {
    //background(255, 78, 0);
    strokeWeight(5);
    fill(200, 200, 255);
    rect(width/2 - 200, height/2 - 200, 400, 400);
    text_make(0, 20, 0, 0);
    fill(0, 0, 0);
    textAlign(CENTER, CENTER);
    text("Server address", width/2, height/2 - 125);
    text("Server port", width/2, height/2-50);
    for (let i in this.buttons_menu_2) { this.buttons_menu_2[i].draw(); }
  }

  this.draw_menu_3 = function() {
    strokeWeight(5);
    fill(200, 200, 255);
    rect(width/2 - 175, height/2 - 175, 350, 350);
    text_make(0, 20, 0, 0);
    fill(0, 0, 0);
    textAlign(CENTER, CENTER);
    text("WebSockets with self-signed\ncertificates aren't accepted\nuntil you authorize them",
                width/2, height/2-100);
    for (let i in this.buttons_menu_3) { this.buttons_menu_3[i].draw(); }
  }

  this.draw_startup_animation = function() {
    text_make(1, 50,  0, 2);
    var text_position_x = sigmoid_array([width*2, width/2, -width], [0, 1.5, 3], [1.5, 3], this.current_time),
        box_position_x = sigmoid_array([-width, width/2, width*2], [0, 1.5, 3], [1.5, 3], this.current_time),
        box_width = 350, box_height = 100;
    fill(255, 78, 0);
    rect(box_position_x - box_width/2, height/2 - box_height/2, box_width, box_height);
    var r_color = rainbow_gradient(this.current_time);
    fill(r_color[0], r_color[1], r_color[2]);
    textAlign(CENTER, CENTER);
    text("RETRO ROYALE", text_position_x, height/2);
  }

  this.key_pressed = function(keycode) {
    return;
  }

  this.key_released = function(keycode) {
    return;
  }

  this.mouse_pressed = function() {
    if (this.current_menu == 1) {
      for (let i in this.buttons_menu_1) { 
        if (this.buttons_menu_1[i].check_press(mouseX, mouseY)) {return;} 
      }
    } else if (this.current_menu == 2) {
      for (let i in this.buttons_menu_2) {
        if (this.buttons_menu_2[i].check_press(mouseX, mouseY)) {return;}
      }
    } else if (this.current_menu == 3) {
      for (let i in this.buttons_menu_3) {
        if (this.buttons_menu_3[i].check_press(mouseX, mouseY)) {return;}
      }
    }
  }

  this.mouse_released = function() {
    if (this.current_menu == 1) {
      for (let i in this.buttons_menu_1) {
        if (this.buttons_menu_1[i].pressed) {this.button_press(i);}
        this.buttons_menu_1[i].pressed = 0; 
      }
    } else if (this.current_menu == 2) {
      for (let i in this.buttons_menu_2) {
        if (this.buttons_menu_2[i].pressed) {this.button_press(i);}
        this.buttons_menu_2[i].pressed = 0; 
      }
    } else if (this.current_menu == 3) {
      for (let i in this.buttons_menu_3) {
        if (this.buttons_menu_3[i].pressed) {this.button_press(i);}
        this.buttons_menu_3[i].pressed = 0; 
      }
    }
  }

  this.button_press = function(code) {
    if (this.current_menu == 1) {
      if (code == 0) { this.authorize_menu_enable(); }
      else if (code == 1) { swap_current_state("load_screen"); }
      else if (code == 2) { this.server_menu_enable(); }
    } else if (this.current_menu == 2) {
      if (code == 0) { this.update_server_address(); }
      else if (code == 1) { this.server_menu_disable(); }
    }
    else if (this.current_menu == 3) {
      if (code == 0) { this.authorize_menu_disable(); }
    }
  }

  this.read_network_data = function(flag, message) {
    return;
  }

  this.server_menu_enable = function() {
    this.server_address_input = createInput(host_address);
    this.server_address_input.position(width/2 - 75, height/2-105);
    this.server_address_input.input(oninput_address);  

    this.server_port_input = createInput(str(global_port));
    this.server_port_input.position(width/2 - 75, height/2-30);
    this.server_port_input.input(oninput_port);
    this.current_menu = 2;
  }

  this.server_menu_disable = function() {
    this.server_address_input.remove();
    this.server_port_input.remove();
    this.current_menu = 1;
  }

  this.update_server_address = function() {
    host_address = this.temp_server_address;
    global_port = parseInt(this.temp_server_port);
    make_socket();
    this.server_menu_disable();
  }

  this.authorize_menu_enable = function() {
    this.cert_hyperlink = createA("https://"+host_address+":"+global_port, "Authorize Connection");
    this.cert_hyperlink.position(width/2-70, height/2-20);
    this.current_menu = 3;
  }

  this.authorize_menu_disable = function() {
    this.cert_hyperlink.remove();
    this.current_menu = 1;
  }
}

function load_screen() {
  this.setup = function(){
    this.start_time = millis()/1000;
    this.current_time = 0;
    this.attempts = 0;
    this.connect_attempted = true;
    g_cam.reset();
  }

  this.draw = function(){
    this.current_time = millis()/1000 - this.start_time;
    var menu_text, cycle_time = 15 - this.current_time;
    if (connected_to_server) {
      menu_text = "Connection successful";
      socket.send("load_game");
    } else if (this.attempts == 0) {
      menu_text = "Attempting to connect";
      make_socket();
      this.attempts++;
    } else if (this.attempts == 1) {
      menu_text = "Attempting to connect";
      for (i = 0; i < (int(this.current_time) % 4); i++) {
        menu_text += ".";
      }
      if (cycle_time <= 0) {
        this.start_time = millis()/1000;
        this.attempts++;
      }
    } else if (this.attempts >= 5) {
      menu_text = "5 Failed attempts\n Returning to menu";
      if (cycle_time <= 10) {
        swap_current_state("main_menu");
      }
    } else if (cycle_time > 0) {
      menu_text = "Retrying in " + str(int(Math.max(0, cycle_time)));
    } else if (cycle_time <= 0 && !(connected_to_server)) {
      make_socket();
      this.start_time = millis()/1000;
      this.attempts++;
    }
    text_make(0, 40, 0, 0);
    textAlign(CENTER, CENTER);
    fill(0, 0, 0);
    g_cam.text(menu_text, width/2, height/2);
  }

  this.key_pressed = function(keycode) { return; }
  this.key_released = function(keycode) { return; }
  this.mouse_pressed = function() { return; }
  this.mouse_released = function() { return; }
  this.read_network_data = function(flag, message) { return; }
}

function oninput_address() {
  current_state.temp_server_address = this.value();
}

function oninput_port() {
  current_state.temp_server_port = this.value();
}

function board_game() {
  this.setup = function() {
    this.camera_pos = [width/2, height/2];
    this.camera_scale = 1;
    this.players = [];
    //this.players[0] = new;
  }

  this.draw = function() {
    return;
  }

  this.key_pressed = function(keycode) {
    return;
  }

  this.key_released = function(keycode) {
    return;
  }

  this.mouse_pressed = function() {
    return;
  }

  this.mouse_released = function() {
    return;
  }

  this.read_network_data = function(flag, message) {
    return
  }
}

function purgatory() {
  this.setup = function() {
    this.players = [];
    this.main_player_index;
    this.arrow_keys = [39, 37, 38, 40];
    this.greenSprite = loadImage(repo_address+"media/sprites/Green.png");
    imageMode(CENTER);
    this.players[0] = new game_1_player(this.greenSprite, 200, 200, 0);
    this.main_player_index = 0;
  }

  this.key_pressed = function(keycode) {
    for (i=0;i<4;i++){
      if (keycode == this.arrow_keys[i]){
        this.players[this.main_player_index].facing = i;
        this.players[this.main_player_index].move = 1;
        this.players[this.main_player_index].sx = 0;
        send_data("my_pos:"+this.players[this.main_player_index].make_data_raw());
        return;
      }
    }
  }

  this.key_released = function(keycode) {
    for (i=0;i<4;i++){
      if(keycode == this.arrow_keys[i] && this.players[this.main_player_index].facing == i) {
        this.players[this.main_player_index].move = 0;
      }
    }
    send_data("my_pos:"+this.players[this.main_player_index].make_data_raw());
  }

  this.mouse_pressed = function() { return; }
  this.mouse_released = function() { return; }

  this.draw = function() {
    background(200, 200, 200);
    fill(0, 0, 0);
    text_make(0, 200, 0, 2);
    textAlign(CENTER, CENTER);
    text("PURGATORY", width/2, height/2);
    for (let i in this.players) {
      this.players[i].draw();
    }
  }

  this.read_network_data = function(flag, message) {
    if (flag == "player_count") {
      for (j=this.players.length; j < parseInt(message); j++){
        this.players[j] = new game_1_player(this.greenSprite, 300, 300, 1);
      }
    } else if (flag == "assigned_id") {
      this.main_player_index = parseInt(message);
    } else if (flag == "pos_player") {
      this.read_in_player_position(message);
    } else if (flag == "new_player") {
      this.players[parseInt(message)] = new game_1_player(this.greenSprite, 300, 300, 0);
    } else if (flag == "rmv_player") {
      var player_index = parseInt(message);
      this.players.splice(player_index, 1);
      if (this.main_player_index > player_index) {
        this.main_player_index -= 1;
      }
    }
  }

  this.read_in_player_position = function(data_string) { //format packet as pos_player:id,x,y,move,speed,facing,fruit_holding,fruit_id
    p_vals = convert_data_string(data_string, [0, 3, 5, 6, 7], [1, 2, 4]);
    this.players[p_vals[0]].update_data(null, p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7]);
  }
}

function template_game() {
  this.setup = function() {
    return;
  }

  this.draw = function() {
    return;
  }

  this.key_pressed = function(keycode) {
    return;
  }

  this.key_released = function(keycode) {
    return;
  }

  this.mouse_pressed = function() {
    return;
  }

  this.mouse_released = function() {
    return;
  }

  this.read_network_data = function(flag, message) {
    return;
  }
}