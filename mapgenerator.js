/*
	Der Mapgenerator ist jetzt in server.js als Endpunkt
*/
var fs = require('fs');

var globalScale = 16
var maxSize = 1000
var steps = 5

var count_x = 1;
var count_y = 1;

var map = []

function generateCords(type) {
	// check if not used
	var x = randomNumber(1, maxSize) * globalScale
	var y = randomNumber(1, maxSize) * globalScale

	for (var index = 0; index < map.length; index++) {
		if (map[index].x === x && map[index].y === y) {
			return false;
		}
	}

	switch (type) {
		case 'x':
			return x;
			break;
		case 'y':
			return y;
			break;
	}
	return false;
}

for (var index = 0; index < 1000 * globalScale; index++) {
	var gras = new mapItem('Gras', 'Umgebung', false, false)
	if (gras) {
		map.push(gras)
	}
}

for (var index = 0; index < 1000; index++) {
	var tree = new mapItem('Baum', 'Umgebung', true, false)
	if (tree) {
		map.push(tree)
	}
}

for (var index = 0; index < 1000; index++) {
	var stone = new mapItem('Stein', 'Umgebung', true, false, ["Hacke"])
	if (stone) {
		map.push(stone)
	}
}

function mapItem (name, type, interaction, blocked, needTools) {
	this.name = name
	this.type = type
	this.interaction = interaction
	this.blocked = blocked
	this.onground = [],
	this.needTools = needTools,
	this.x = generateCords('x')
	this.y = generateCords('y')
}

function randomNumber(min, max) {
	return Math.floor((Math.random() * max) + min);
}

// fs.writeFile(__dirname + '/init_map.json', JSON.stringify(map), function (err) {
fs.writeFile(__dirname + '/files/map.json', JSON.stringify(map), function (err) {
    if (err) { return console.log(err); }
	console.log('map generated')
});
