var current_state = new dev_room();
var current_state_flag = "dev_room";
let width = 600;
let height = 600;

let global_port = 3128;
let tick_interval = 200; //in milliseconds
var random_seed = Math.floor(Math.random()*100000);
var tick_function_ids = [];

/*
var express = require('express');	// include express.js
var server = express(); // a local instance of express
var wsServer = require('express-ws')(server); // instance of the websocket server
var clients = new Array;  // list of client connections:
var clients_hash = new Array;

// serve static files from /public:
server.use('/', express.static('public'));
*/
// this runs after the server successfully starts:

var fs = require('fs');
var https = require('https');
var ip = require('ip');
var privateKey  = fs.readFileSync('sslcert/key.pem', 'utf8');
var certificate = fs.readFileSync('sslcert/cert.pem', 'utf8');

var {game_1_player, game_1_fruit, game_1_endzone} = 
        require("./dependencies/fruit_game_classes");
var {board_game_player, board_game_tile} = 
        require("./dependencies/board_game_classes");
var {game_2_ball, ball_game_player} =
        require("./dependencies/ball_game_classes");
var {fighting_game_player} =
        require("./dependencies/fighting_game_classes");

var credentials = {key: privateKey, cert: certificate};
var express = require('express');
const PoissonDiskSampling = require('poisson-disk-sampling');
var app = express();
var clients = new Array;
var client_session_ids = new Array;

var httpsServer = https.createServer(credentials, app);
httpsServer.listen(global_port);
var WebSocketServer = require('ws').Server;
var server = new WebSocketServer({ server: httpsServer });

function tick_function() { current_state.tick_function(); }

tick_function_ids[0] = setInterval(tick_function, tick_interval);

function seed_random(seed) {
  var x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function game_start() {
  console.log("Game Reset");
  current_state = new dev_room();
  current_state.setup();
  current_state_flag = "dev_room";
}

function server_start() {
  game_start();
  console.log('Server address: ' + ip.address());
  console.log('Server port:    ' + global_port);
  console.log("Initializing game");
  console.log("Current game: "+current_state_flag);
  console.log(Date.now());
}

server.on('open', function open() {console.log("server started");});

server.on('connection', function connection(thisClient) {
  console.log("New Connection");        // you have a new client
  console.log("clients length "+clients.length);
  clients.push(thisClient);
  console.log("clients length "+clients.length);
  console.log("user connecting");
                    
  thisClient.on('close', function(msg){         //Triggers on a client disconnect
    var position = clients.indexOf(thisClient); //Gets clients position in array
    clients.splice(position, 1);                //Removes client from global client array
    for (i = position; i < clients.length; i++) { clients[i].test_position--; }
    current_state.user_disconnected(position);  //Triggers current_state's user disconnect function.
    console.log("connection closed, client: "+position);
  });

  thisClient.on('message', function incoming(data) { //Activates when a client sends data in.
    console.log(data);
    var lines = data.split("\n");             //Packets may contain multiple commands, separated by newline
    var index = clients.indexOf(thisClient);  //grabs the index of the client that sent it in
    for (let i in lines) {                    //Processes each individual command in the packet
      var line_pieces = lines[i].split(":");  //Commands are formatted as flag:data, flag indicating what to activate.
      var flag = line_pieces[0],  
          message = null;
      if (line_pieces.length > 1) {           //Some commands are just a flag, this accounts for that.
        message = line_pieces[1];             
      }
      if (flag == 'connected') { thisClient.send("connected"); } //This only constitutes a hello, establishes that the connection was made
      if (flag == 'load_game') { thisClient.send("current_game:"+current_state_flag); }
      //In the unique case that the server is issuing the current state, the current state doesn't deal with that.
      current_state.read_network_data(flag, message, index);  //Passes the flag, message, and sender id to current_state's network trigger.
    }
  });
});


function broadcast(data) {  //Send a message to all connected clients
  for (let c in clients) {
    clients[c].send(data);
  }
}

function broadcast_exclusive(data, excluded_clients_array) {  //Send a message to all clients excluding a passed array.
  if (excluded_clients_array.length > 1) {
    for (let c in clients) { if (!(excluded_clients_array.includes(c))) { clients[c].send(data); } }
  }
  else {  //For whatever reason javascript treats an array of 1 as an element, so array.includes doesn't work. This accounts for that.
    for (let c in clients) { if (c != excluded_clients_array) { clients[c].send(data); } }
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

function swap_current_state(state_flag) {
  if (state_flag == "fruit_game") { current_state = new fruitGame(); }
  else if (state_flag == "purgatory") { current_state = new purgatory(); }
  else if (state_flag == "load_room") { current_state = new load_room(); }
  else if (state_flag == "board_game") {current_state = new board_game(); }
  else if (state_flag == "ball_game") { current_state = new ball_game(); }
  else if (state_flag == "dev_room") { current_state = new dev_room(); }
  else if (state_flag == "fighting_game") { current_state = new fighting_game(); }
  else { return; } // failsafe for invalid flags
  current_state.setup();
  current_state_flag = state_flag;
  broadcast("current_game:"+state_flag);
}

function start_board_game(message) {
  swap_current_state("board_game");
  broadcast("start_board_game");
}

class client_info {
  constructor() {
    this.connected_to_game;
    this.session_id;
    this.latency;
    if (arguments.length >= 1) { this.update_info(arguments); } 
  }

  update_info() {
    if (arguments.length >= 1) { this.connected_to_game = arguments[0]; }
    if (arguments.length >= 2) { this.connected_to_game = arguments[1]; }
    if (arguments.length >= 3) { this.connected_to_game = arguments[2]; }
  }
}

function fruitGame() {
  this.setup = function() {
    this.fruits_count = 800;
    this.remove_percentage_of_fruits = 0.2;
    this.players = [];
    this.fruits = [];
    this.endzones = [];
    this.game_active = 0;
    this.game_length = 30.000;
    this.start_time = Date.now()/1000;
    this.current_time = this.game_length;
    this.game_dimensions = [2000, 1000];
    for (i=0; i < clients.length; i++) {
      this.players[i] = new game_1_player(600*Math.random(), 600*Math.random(), 1);
    }
    var p = new PoissonDiskSampling({
      shape: [this.game_dimensions[0], this.game_dimensions[1]],
      minDistance: 20,
      maxDistance: 30,
      tries: 3
    });
    var poisson_points = p.fill();
    console.log("Poisson points: "+poisson_points[0]);
    console.log("made "+poisson_points.length+" poisson points");
    this.endzones[0] = new game_1_endzone(0, 100, this.game_dimensions[1]/2-100, this.game_dimensions[1]/2+100);
    this.endzones[1] = new game_1_endzone(this.game_dimensions[0]-100, this.game_dimensions[0], 
                                          this.game_dimensions[1]/2-100, this.game_dimensions[1]/2+100);
    //The following code removes fruits that are generated in an endzone.
    for (i=0; i < poisson_points.length; i++) { //counts downwards because we will be removing indices
      for (let j in this.endzones) {
        if (this.endzones[j].check_placement(poisson_points[i][0], poisson_points[i][1])) {
          poisson_points.splice(i, 1);
          break;
        }
      }
    }
    while (poisson_points.length > this.fruits_count) {
      poisson_points.splice(Math.floor(Math.random()*poisson_points.length), 1);
    }
    console.log("Generated "+poisson_points.length+" fruits ( targeted: "+this.fruits_count+")");
    for (i = 0; i < poisson_points.length; i++) {
      this.fruits[i] = new game_1_fruit(poisson_points[i][0], poisson_points[i][1], 3+Math.random()*12);
    }
  }
  
  this.tick_function = function() { this.game_update(); }

  this.game_update = function() {
    this.current_time = this.game_length - (Date.now()/1000 - this.start_time);
    if (this.current_time < 0 && this.game_active != 2) {
      if (this.game_active == 0) {
        this.game_active = 1;
        this.game_length = 60;
        this.start_time = Date.now()/1000;
        this.current_time = this.game_length;
      } else if (this.game_active == 1) {
        this.game_active = 2;
        this.game_length = 20;
        this.start_time = Date.now()/1000;
      }
      broadcast("game_state:"+this.game_active+","+this.current_time+","+this.game_length);
    }
  }

  this.read_network_data = function(flag, message, usr_id) {
    console.log(flag+":"+message);
    this.game_update();
    if (flag == "load_game") {
      this.user_loaded(usr_id);
    } else if (flag == "my_pos") {
      this.read_in_player_position(usr_id+","+message);
      broadcast_exclusive(this.players[usr_id].make_data(usr_id), [usr_id]);
    } else if (flag == "pos_fruit") {
      var fruit_id = this.read_in_fruit_position(message);
      //if (this.fruits[fruit_id].scored) { broadcast('pop_fruit:'+fruit_id); }
      broadcast_exclusive(this.fruits[usr_id].make_data(fruit_id), [usr_id]);
    } else if (flag == "upd_endzone") {
      var endzone_id = this.read_in_endzone_data(message);
      broadcast_exclusive(this.endzones[endzone_id].make_data(endzone_id), [usr_id]);
    }
  }

  this.user_loaded = function(usr_id) {
    clients[usr_id].send("load_recieved");
    this.players[usr_id] = new game_1_player(600*Math.random(), 600*Math.random(), 1);
    broadcast_exclusive("new_player:"+usr_id+"\n"+this.players[usr_id].make_data(usr_id), [usr_id]);
    clients[usr_id].send("player_count:" + clients.length + "\n" + "assigned_id:" + usr_id + "\n");
    clients[usr_id].send(this.make_everything());
    broadcast("game_state:"+this.game_active+","+this.current_time+","+this.game_length);
  }

  this.user_disconnected = function(usr_id) {
    broadcast("rmv_player:"+usr_id);
    if (!(this.players[usr_id])) { return; }
    if (this.players[usr_id].fruit_holding == 1) {
      this.fruits[this.players[usr_id].fruit_held_id].drop();
    } 
    this.players.splice(usr_id, 1);
  }

  this.make_everything = function() {
    str_make = "";
    for (let i in this.players) { str_make += this.players[i].make_data(i) + "\n"; }
    for (let i in this.fruits) { str_make += this.fruits[i].make_data(i) + "\n"; }
    for (let i in this.endzones) { str_make += this.endzones[i].make_data(i) + "\n"; }
    return str_make;
  }

  this.read_in_player_position = function(data_string) { //format packet as pos_player:id,x,y,move,speed,facing,fruit_holding,fruit_id
    p_vals = convert_data_string(data_string, [0, 3, 5, 6, 7], [1, 2, 4]);
    this.players[p_vals[0]].update_data(null, p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7]);
    return p_vals[0];
  }

  this.read_in_fruit_position = function(data_string) {
    p_vals = convert_data_string(data_string, [0, 3, 4, 5, 6], [1, 2]);
    this.fruits[p_vals[0]].update_data(p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6]);
    return p_vals[0];
  }

  this.read_in_endzone_data = function(data_string) {
    p_vals = convert_data_string(data_string, [0, 5], [1, 2, 3, 4]);
    this.endzones[p_vals[0]].update_data(p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5]);
    return p_vals[0];
  }
}

function purgatory() {
  this.setup = function() {
    this.start_time = Date.now()/1000;
    this.current_time = 0;
    this.players = [];
    for (i=0; i < clients.length; i++) {
      this.players[i] = new game_1_player(600*Math.random(), 600*Math.random(), 1);
    }
  }

  this.tick_function = function() { 
    this.current_time = Date.now()/1000 - this.start_time;
    if (this.current_time >= 5) { swap_current_state("fruit_game"); }
  }

  this.read_network_data = function(flag, message, usr_id) {
    console.log(flag+":"+message);
    if (flag == "load_game") {
      this.user_loaded(usr_id);
    } else if (flag == "my_pos") {
      this.read_in_player_position(usr_id+","+message);
      broadcast_exclusive(this.players[usr_id].make_data(usr_id), [usr_id]);
    }
  }

  this.user_loaded = function(usr_id) {
    clients[usr_id].send("load_recieved");
    this.players[usr_id] = new game_1_player(600*Math.random(), 600*Math.random(), 1);
    broadcast_exclusive("new_player:"+usr_id+"\n"+this.players[usr_id].make_data(usr_id), [usr_id]);
    clients[usr_id].send("player_count:" + clients.length + "\n" + "assigned_id:" + usr_id + "\n");
    clients[usr_id].send(this.make_everything());
  }

  this.user_disconnected = function(usr_id) {
    broadcast("rmv_player:"+usr_id);
    this.players.splice(usr_id, 1);
  }

  this.make_everything = function() {
    str_make = "";
    for (let i in this.players) { str_make += this.players[i].make_data(i) + "\n"; }
    return str_make;
  }

  this.read_in_player_position = function(data_string) { //format packet as pos_player:id,x,y,move,speed,facing,fruit_holding,fruit_id
    p_vals = convert_data_string(data_string, [0, 3, 5, 6, 7], [1, 2, 4]);
    this.players[p_vals[0]].update_data(null, p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7]);
    return p_vals[0];
  }
}

function load_room() {
  this.setup = function() {
    this.start_time = Date.now()/1000;
    this.current_time = 0;
    this.start_game = false;
    this.players = [];
    for (i=0; i < clients.length; i++) {
      this.players[i] = new game_1_player(600*Math.random(), 600*Math.random(), 1);
    }
    this.host_id = 0;
  }

  this.tick_function = function() {
    this.current_time = Date.now()/1000 - this.start_time;
    if (this.start_game && this.current_time >= 10) { 
      start_board_game(); 
    }
  }

  this.read_network_data = function(flag, message, usr_id) {
    console.log(flag+":"+message);
    if (flag == "load_game") {
      this.user_loaded(usr_id);
    } else if (flag == "my_pos") {
      this.read_in_player_position(usr_id+","+message);
      broadcast_exclusive(this.players[usr_id].make_data(usr_id), [usr_id]);
    } else if (flag == "start_game" && usr_id == this.host_id) {
      this.start_game = true;
      this.start_time = Date.now()/1000;
      broadcast("host_started_game:"+0);
    }
  }

  this.user_loaded = function(usr_id) {
    clients[usr_id].send("load_recieved");
    this.players[usr_id] = new game_1_player(600*Math.random(), 600*Math.random(), 1);
    broadcast_exclusive("new_player:"+usr_id+"\n"+this.players[usr_id].make_data(usr_id), [usr_id]);
    clients[usr_id].send("player_count:" + clients.length + "\n" + "assigned_id:" + usr_id + "\n");
    clients[usr_id].send(this.make_everything());
    if (this.start_game) { clients[usr_id].send("host_started_game:"+this.current_time); }
    if (usr_id == this.host_id) { clients[usr_id].send("assigned_host"); }
  }

  this.user_disconnected = function(usr_id) {
    broadcast("rmv_player:"+usr_id);
    this.players.splice(usr_id, 1);
  }

  this.make_everything = function() {
    str_make = "";
    for (let i in this.players) { str_make += this.players[i].make_data(i) + "\n"; }
    return str_make;
  }

  this.read_in_player_position = function(data_string) { //format packet as pos_player:id,x,y,move,speed,facing,fruit_holding,fruit_id
    p_vals = convert_data_string(data_string, [0, 3, 5, 6, 7], [1, 2, 4]);
    this.players[p_vals[0]].update_data(null, p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7]);
    return p_vals[0];
  }
}

function dev_room() {
  this.setup = function() {
    this.start_time = Date.now()/1000;
    this.current_time = 0;
    this.start_game = false;
    this.players = [];
    for (i=0; i < clients.length; i++) {
      this.players[i] = new game_1_player(600*Math.random(), 600*Math.random(), 1);
    }
    this.host_id = 0;
  }

  this.tick_function = function() { return; }

  this.read_network_data = function(flag, message, usr_id) {
    console.log(flag+":"+message);
    if (flag == "load_game") {
      this.user_loaded(usr_id);
    } else if (flag == "my_pos") {
      this.read_in_player_position(usr_id+","+message);
      broadcast_exclusive(this.players[usr_id].make_data(usr_id), [usr_id]);
    } else if (flag == "start_game" && usr_id == this.host_id) {
      swap_current_state(message);
    }
  }

  this.user_loaded = function(usr_id) {
    clients[usr_id].send("load_recieved");
    this.players[usr_id] = new game_1_player(600*Math.random(), 600*Math.random(), 1);
    broadcast_exclusive("new_player:"+usr_id+"\n"+this.players[usr_id].make_data(usr_id), [usr_id]);
    clients[usr_id].send("player_count:" + clients.length + "\n" + "assigned_id:" + usr_id + "\n");
    clients[usr_id].send(this.make_everything());
    if (usr_id == this.host_id) { clients[usr_id].send("assigned_host"); }
  }

  this.user_disconnected = function(usr_id) {
    broadcast("rmv_player:"+usr_id);
    this.players.splice(usr_id, 1);
  }

  this.make_everything = function() {
    str_make = "";
    for (let i in this.players) { str_make += this.players[i].make_data(i) + "\n"; }
    return str_make;
  }

  this.read_in_player_position = function(data_string) { //format packet as pos_player:id,x,y,move,speed,facing,fruit_holding,fruit_id
    p_vals = convert_data_string(data_string, [0, 3, 5, 6, 7], [1, 2, 4]);
    this.players[p_vals[0]].update_data(null, p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7]);
    return p_vals[0];
  }
}

function swap_new_direction(dir) {
  if (dir == "up") { return "down"; }
  if (dir == "down") { return "up"; }
  if (dir == "left") { return "right"; }
  if (dir == "right") { return "left"; }
}

function board_game() {
	this.setup = function() {
		this.players = [];
		this.tiles = [];
		this.tile_grid_dimensions = [50, 50];
		
    

		this.turning_player_index = 0; 	//Player currently rolling dice

    for (i=0; i < clients.length; i++) {
      this.players[i] = new board_game_player(0, 0, 1);
    }
    this.make_board_layout_preset_1();
	}

	this.make_board_layout_preset_1 = function() {
		this.tiles[0] = new board_game_tile(0, 25, 0, [1]);
		for (i = 1; i < 49; i++) {
			this.tiles[i] = new board_game_tile(i, 25, 1+Math.floor(Math.random()*4), [1]);
			this.pair_tiles(i-1, i, "right");
			this.pair_tiles(i, i-1, "left");
		}
		this.tiles[49] = new board_game_tile(49, 25, 5, [1]);
		this.pair_tiles(48, 49, "right");
		this.pair_tiles(49, 48, "left");
		this.tiles[50] = new board_game_tile(2, 24, 4, [1]);
		this.pair_tiles(2, 50, "up");
		this.pair_tiles(50, 2, "down");
    for (let i in this.players) {
      this.players[i].x = this.tiles[0].x;
      this.players[i].y = this.tiles[0].y;
      this.user_loaded(i);
    }
	}

  this.tick_function = function() {
    return;
  }

	this.pair_tiles = function(parent, child, flow_direction) {
		var reverse_direction = swap_new_direction(flow_direction);
		this.tiles[parent].make_child(flow_direction, child);
		this.tiles[child].make_parent(reverse_direction, parent);
	}

  this.make_everything = function() {
    str_make = "";
    for (let i in this.players) { str_make += this.players[i].make_data(i)+"\n"; }
    for (let i in this.tiles) { str_make += this.tiles[i].make_data(i)+"\n"; }
    return str_make;
  }

  this.read_network_data = function(flag, message, usr_id) {
    console.log(flag+":"+message);
    if (flag == "load_game") {
      this.user_loaded(usr_id);
    } else if (flag == "move_tile_direction" && usr_id == this.turning_player_index) {
      this.move_player_to_tile(usr_id, message);
    }
  }

  this.move_player_to_tile = function(usr_id, direction) {
    if (!this.tiles[this.players[usr_id].current_tile_index].check_child(direction)) 
		{ console.log("child failed"); return; }
    this.players[usr_id].previous_tile_index = this.players[usr_id].current_tile_index;
    this.players[usr_id].current_tile_index = this.tiles[this.players[usr_id].current_tile_index].connected_tiles[direction]["tile_id"];
    this.players[usr_id].x = this.tiles[this.players[usr_id].current_tile_index].x;
    this.players[usr_id].y = this.tiles[this.players[usr_id].current_tile_index].y;
    broadcast("player_move_tile:"+usr_id+","+direction);
  }

  this.user_loaded = function(usr_id) {
    clients[usr_id].send("load_recieved");
    this.players[usr_id] = new board_game_player(this.tiles[0].x, this.tiles[0].y, 1);
    this.players[usr_id].x = this.tiles[0].x;
    this.players[usr_id].y = this.tiles[0].y;
    broadcast_exclusive("new_player:"+usr_id+"\n"+this.players[usr_id].make_data(usr_id), [usr_id]);
    clients[usr_id].send("player_count:" + clients.length + "\n" + "assigned_id:" + usr_id + "\n");
    clients[usr_id].send(this.make_everything());
    console.log("player_info:"+this.players[usr_id].make_data_raw());
  }

  this.user_disconnected = function(usr_id) {
    broadcast("rmv_player:"+usr_id);
    this.players.splice(usr_id, 1);
    if (this.turning_player_index > usr_id) {
      this.turning_player_index--;
    }
    broadcast("turning_player:"+this.turning_player_index);
  }

  this.read_in_player_position = function(message) {
    p_vals = convert_data_string(message, [0, 6, 7], [1, 2, 3, 4], [5, 8]);
    if (p_vals[0] >= this.players.length) { this.players[p_vals[0]] = new board_game_player(0, 0, 1); }
    this.players[p_vals[0]].update_data(null, p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7], p_vals[8]);
  }
}

function ball_game() {
  this.setup = function() {
    this.start_time = Date.now()/1000;
    this.current_time = 0;
    this.add_last_time = Date.now()/1000;
    this.players = [];
    this.balls = [];
    for (i=0; i < clients.length; i++) {
      this.players[i] = new ball_game_player(600*Math.random(), 600*Math.random(), 1);
      //this.balls[i] = new game_2_ball();
    }
    this.random_seed = Math.floor(Math.random()*100000);
    tick_function_ids[tick_function_ids.length] = setInterval(function() { current_state.tick_function_ball(); }, 20);
  }

  this.tick_function = function() { 
    this.current_time = Date.now()/1000 - this.start_time;
    //if (this.current_time >= 5) { swap_current_state("fruit_game"); }
    if (Date.now()/1000 - this.add_last_time > 10) {
      this.add_last_time = Date.now()/1000;
      this.balls[this.balls.length] = new game_2_ball();
      broadcast(this.balls[this.balls.length-1].make_data(this.balls.length-1));
      console.log("added ball "+this.balls);
      //broadcast(this.make_everything());
    }
    for (let i in this.balls) { 
      console.log("updating ball "+i);
      this.balls[i].update(seed_random, random_seed); 
    }
    //broadcast(this.make_everything());
  }

  this.tick_function_ball = function() {
    //console.log("ball_tick_function 1");
    //console.log("players: "+this.players);
    for (let i in this.balls) { this.balls[i].update(seed_random, random_seed); }
    var str_make = "";
    //console.log("ball_tick_function 2" + this.balls);

    for (let i in this.balls) { 
      //console.log("data for ball "+i);
      //console.log(this.balls[i].make_data(i)); 
      str_make += this.balls[i].make_data(i) + "\n";
    }
    for (let i in this.players){
      if (this.players[i].isDead) { continue; }
      for (let j in this.balls) {
        var dx= Math.abs(this.balls[j].x-(this.players[i].x));
        var dy= Math.abs(this.balls[j].y-(this.players[i].y));
        var distance = Math.sqrt(dx*dx + dy*dy);
        console.log("distance: "+distance);
          if (distance <= this.balls[j].radius){
            console.log("Player "+i+" is dead");
            this.players[i].isDead = 1; 
          }
      }
    }

    //console.log("ball_tick_function 3");
    broadcast(str_make);
  }

  this.read_network_data = function(flag, message, usr_id) {
    console.log(flag+":"+message);
    if (flag == "load_game") {
      this.user_loaded(usr_id);
    } else if (flag == "my_pos") {
      this.read_in_player_position(usr_id+","+message);
      broadcast_exclusive(this.players[usr_id].make_data(usr_id), [usr_id]);
    }
  }

  this.user_loaded = function(usr_id) {
    clients[usr_id].send("load_recieved");
    this.players[usr_id] = new ball_game_player(600*Math.random(), 600*Math.random(), 1);
    broadcast_exclusive("new_player:"+usr_id+"\n"+this.players[usr_id].make_data(usr_id), [usr_id]);
    clients[usr_id].send("player_count:" + clients.length + "\n" + "assigned_id:" + usr_id + "\n");
    clients[usr_id].send(this.make_everything()+"random_seed:"+random_seed);
  }

  this.user_disconnected = function(usr_id) {
    broadcast("rmv_player:"+usr_id);
    this.players.splice(usr_id, 1);
  }

  this.make_everything = function() {
    str_make = "";
    for (let i in this.players) { str_make += this.players[i].make_data(i) + "\n"; }
    for (let i in this.balls) { str_make += this.balls[i].make_data(i) + "\n"; }
    return str_make;
  }

  this.read_in_player_position = function(data_string) { //format packet as pos_player:id,x,y,move,speed,facing,fruit_holding,fruit_id
    p_vals = convert_data_string(data_string, [0, 3, 5, 6, 7], [1, 2, 4]);
    if (p_vals[0] >= this.players.length) {this.players[p_vals[0]] = new game_1_player(0, 0, 1); }
    this.players[p_vals[0]].update_data(null, p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7]);
    return p_vals[0];
  }
}

function fighting_game() {
  this.setup = function() {
    this.start_time = Date.now()/1000;
    this.current_time = 0;
    this.floor = 600;
    this.players = [];
    for (i=0; i < clients.length; i++) {
      this.players[i] = new fighting_game_player(100+400*Math.random(), this.floor, 0, i);
    }
  }

  this.read_network_data = function(flag, message, usr_id) {
    if (usr_id >= this.players.length) { this.user_loaded(usr_id); }
    console.log(flag+":"+message);
    if (flag == "load_game") {
      this.user_loaded(usr_id);
    } else if (flag == "my_pos") {
      this.read_in_player_position(usr_id+","+message);
      broadcast_exclusive(this.players[usr_id].make_data(usr_id), [usr_id]);
    }else if(flag == "attack"){
      this.attack(usr_id);
      broadcast_exclusive("attack:"+usr_id+","+this.players[usr_id].make_data_raw(), [usr_id]);
    }else if (flag == "hit"){
      this.attack_end(usr_id);
    }else if (flag == "debug") {
      console.log("debug:"+message);
    }
  }

  this.tick_function = function() {
    for(let i in this.players) {
      console.log("Y position is: " + this.players[i].make_data(i));
      broadcast_exclusive(this.players[i].make_data(i),[i]);
    }
  }

  this.user_loaded = function(usr_id) {
    clients[usr_id].send("load_recieved");
    this.players[usr_id] = new fighting_game_player(100+Math.random()*400, this.floor, 0, usr_id%4);
    broadcast_exclusive("new_player:"+usr_id+"\n"+this.players[usr_id].make_data(usr_id), [usr_id]);
    clients[usr_id].send("player_count:" + clients.length + "\n" + "assigned_id:" + usr_id + "\n");
    clients[usr_id].send(this.make_everything());
  }

  this.user_disconnected = function(usr_id) {
    broadcast("rmv_player:"+usr_id);
    this.players.splice(usr_id, 1);
  }

  this.make_everything = function() {
    str_make = "";
    for (let i in this.players) { str_make += this.players[i].make_data(i) + "\n"; }
    return str_make;
  }

  this.read_in_player_position = function(data_string) 
  { //format packet as pos_player: id, x, y, dx, dy, facing, health, isAttacking, isDucking
    p_vals = convert_data_string(data_string, [0, 5, 6, 7, 8], [1, 2, 3, 4]);
    this.players[p_vals[0]].update_data( p_vals[1], p_vals[2], p_vals[3], p_vals[4], p_vals[5], p_vals[6], p_vals[7], p_vals[8]); //just removed null as first argument in update_data, not sure if it's right
    return p_vals[0];
  }

  
  this.attack = function(usr_id){
    var player = this.players[usr_id];
    var hit_radius = 100;
    for (let i in this.players) {
      var x_dist = this.players[i].x - this.players[usr_id].x,
          y_dist = this.players[i].y - this.players[usr_id].y;
      if (Math.sqrt(x_dist*x_dist + y_dist*y_dist) < hit_radius) {
        this.players[i].health -= 10;
        broadcast("hit:"+i+","+this.players[i].health);
      }
    }
  }
}

server_start();
