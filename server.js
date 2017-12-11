var fs = require('fs');
var express = require('express');
var cookieParser = require('cookie-parser')

var app = express();

var allFiles = ['players.json', 'map.json', 'tokens.json', 'globalIDs.json', 'enemies.json']
var allRobotSprites = ['Robot1.gif']
var allScientistSprites = ['Scientist.gif']

// items
var items = []
fs.readFile(__dirname + '/files/items.json', {encoding: 'utf8'}, function (err, data) {
    items = JSON.parse(data);
    console.log('The file items.json was read!')
})
var globalID = 1
var maxSize = 100
var pages = {}
var cachedFiles = {}
var discSaver = 60000

var globalScale = 32
var maxInventarSize = 5

app.use(express.static(__dirname + '/public'));
app.use(cookieParser())
// app.use(express.urlencoded());

// DB
function initFiles() {
    console.log('read DB')
    allFiles.forEach(function(filename) {
        fs.readFile(__dirname + '/files/' + filename, {encoding: 'utf8'}, function (err, data) {
            cachedFiles[filename] = JSON.parse(data);
            console.log('The file '+ filename +' was read!')
        })
    })
}

initFiles()

// REST
app.post('/getCurrentPlayer', function (req, res) {
    var userObject = getcurrentPlayer(req)
    res.end( JSON.stringify( userObject ))
})

app.get('/map', function (req, res) {
    // current player location + x fields
    var currentPlayer = getCurrentPlayer(req)
    var viewSize = 5
    if (currentPlayer) {
        var x = currentPlayer.x - viewSize
        var y = currentPlayer.y - viewSize
        var width = currentPlayer.x + viewSize
        var height = currentPlayer.y + viewSize
    
        var result = []
        var map = cachedFiles['map.json']
        var players = cachedFiles['players.json']
        
        for (var index = 0; index < map.length; index++) {
            if (map[index].x >= x && map[index].x <= width && map[index].y >= y && map[index].y <= height) {
                result.push(map[index])
            }
        }
        for (var index = 0; index < players.length; index++) {
            if (players[index].x >= x && players[index].x <= width && players[index].y >= y && players[index].y <= height) {
                result.push(players[index])
            }
        }
        res.end( JSON.stringify(result, {encoding: 'utf8'}) );
    }
})

app.post('/move', function (req, res) {
    var bodyStr = '';
    req.on('data',function(chunk){
        bodyStr += chunk.toString();
        if (bodyStr.length > 1e6) { 
            // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
            req.connection.destroy();
        }
    });
    req.on('end',function() {
        var userObject = getCurrentPlayer(req)
        if (!userObject.isMoving) {
            // trap???
            var mapPoints = findMapPoints(userObject.x,userObject.y)
            for (var index = 0; index < mapPoints.length; index++) {
                if (mapPoints[index].name == 'Menschenfalle' && userObject.team == 'SCIENTIST') {
                    bodyStr = ''
                    res.end( JSON.stringify({'moved': false}) )
                }
                if (mapPoints[index].name == 'Roboterfalle' && userObject.team == 'ROBOT') {
                    bodyStr = ''
                    res.end( JSON.stringify({'moved': false}) )
                }    
            }
            
            switch (bodyStr) {
                case 'UP':
                    userObject.isMoving = true
                    var x = userObject.x
                    var y = userObject.y - 1
                    if (!isBlocked(x,y)) {
                        userObject.y = userObject.y - 1
                        userObject.isMoving = false
                        res.end( JSON.stringify({'moved': true}) )
                    } else {
                        userObject.isMoving = false
                        res.end( JSON.stringify({'moved': false}) )
                    }
                    break;
    
                case 'RIGHT':
                    userObject.isMoving = true
                    var x = userObject.x + 1
                    var y = userObject.y
                    if (!isBlocked(x,y) || x > maxSize) {
                        userObject.x = userObject.x + 1
                        userObject.isMoving = false
                        res.end( JSON.stringify({'moved': true}) )
                    } else {
                        userObject.isMoving = false
                        res.end( JSON.stringify({'moved': false}) )
                    }
                    break;
                case 'DOWN':
                    userObject.isMoving = true
                    var x = userObject.x
                    var y = userObject.y + 1
                    if (!isBlocked(x,y) || y > maxSize) {
                        userObject.y = userObject.y + 1
                        userObject.isMoving = false
                        res.end( JSON.stringify({'moved': true}) )
                    } else {
                        userObject.isMoving = false
                        res.end( JSON.stringify({'moved': false}) )
                    }
                    break;
                case 'LEFT':
                    userObject.isMoving = true
                    var x = userObject.x - 1
                    var y = userObject.y
                    if (!isBlocked(x,y)) {
                        userObject.x = userObject.x - 1
                        userObject.isMoving = false
                        res.end( JSON.stringify({'moved': true}) )
                    } else {
                        userObject.isMoving = false
                        res.end( JSON.stringify({'moved': false}) )
                    }
                    break;
                default:
                    res.end( JSON.stringify({'moved': false}) )
                    break;
            }
        }
    });
})

app.post('/action', function (req, res) {
    var bodyStr = '';
    req.on('data',function(chunk){
        bodyStr += chunk.toString();
        if (bodyStr.length > 1e6) { 
            // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
            req.connection.destroy();
        }
    });
    req.on('end', function () {
        var currentPlayer = getCurrentPlayer(req)
        if (currentPlayer) {
            if (bodyStr == 'BLOCK') {
                var mapPoints = findMapPoints(currentPlayer.x, currentPlayer.y)
                if (mapPoints.length == 0) {
                    if (currentPlayer.team == 'ROBOT' && currentPlayer.energy >= 10) {
                        var newMapPoint = new mapItem (currentPlayer.x, currentPlayer.y, 'Menschenfalle', 'Falle', false, false, 'Falle1.gif')
                        newMapPoint.lifetime = 3 * currentPlayer.energy
                        currentPlayer.energy = currentPlayer.energy - 10
                        cachedFiles['map.json'].push(newMapPoint)
                        res.end( JSON.stringify({'error': false}) )
                    } else if (currentPlayer.team == 'SCIENTIST' && currentPlayer.energy >= 10) {
                        var newMapPoint = new mapItem (currentPlayer.x, currentPlayer.y, 'Roboterfalle', 'Falle', false, false, 'Falle2.gif')
                        newMapPoint.lifetime = 3 * currentPlayer.energy
                        currentPlayer.energy = currentPlayer.energy - 10
                        cachedFiles['map.json'].push(newMapPoint)
                        res.end( JSON.stringify({'error': false}) )
                    }
                }
            }
            if (bodyStr == 'HARVEST') {
                var mapPoints = findMapPoints(currentPlayer.x, currentPlayer.y)
                for (var index = 0; index < mapPoints.length; index++) {
                    if (mapPoints[index].name == 'Stein' && currentPlayer.energy <= 200) {
                        currentPlayer.energy = currentPlayer.energy + 10
                    } else {
                        res.end( JSON.stringify({'error': true}) )
                    }
                }
            }
        }
        res.end( JSON.stringify({'error': true, 'message': 'Das hat nicht funktioniert.'}) )
    });
})

app.post('/checkLogin', function (req, res) {
    var bodyStr = '';
    req.on('data', function (chunk) {
        bodyStr += chunk.toString();
        if (bodyStr.length > 1e6) { 
            // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
            req.connection.destroy();
        }
    });
    req.on('end', function () {
        var currentPlayer = getCurrentPlayer(req)
        if (currentPlayer && typeof currentPlayer.id !== 'undefined') {
            res.end( JSON.stringify(currentPlayer) )
        }
        res.status(500)
        res.end( JSON.stringify({'error': true}) )
    });
})

app.get('/newPlayer', function (req, res) {
    var newPlayerVars = new newPlayer(randomNumber(15,70), randomNumber(15,70))
    var newID = newPlayerVars.id + Date.now()
    
    cachedFiles['players.json'].push(newPlayerVars)
    cachedFiles['tokens.json'].push({"id": newPlayerVars.id, "token": newID})
    
    var token = {}
    token.token = newID
    res.end(JSON.stringify(token));
})

app.post('/dropItem', function (req, res) {
    var bodyStr = '';
    req.on('data',function (chunk) {
        bodyStr += chunk.toString();
        if (bodyStr.length > 1e6) { 
            // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
            req.connection.destroy();
        }
    });
    req.on('end',function () {
        var currentPlayer = getCurrentPlayer(req)
        var inventar = currentPlayer.inventar
        var map = cachedFiles['map.json']
        for (var index = 0; index < inventar.length; index++) {
            if (inventar[index] == bodyStr) {
                // found item
                var mapPoints = findMapPoints(currentPlayer.x, currentPlayer.y)
                if (mapPoints.length > 0) {
                    var itemsOnGround = mapPoints[0].onground
                    itemsOnGround.push(inventar[index])
                } else {
                    var newMapPoint = new mapItem(currentPlayer.x, currentPlayer.y, 'Zeug', 'Zeug', true, false)
                    newMapPoint.onground.push(inventar[index])
                    map.push(newMapPoint)
                }
                // drop inventar
                inventar.splice(index, 1)
                res.end( JSON.stringify(currentPlayer) )
            }
        }
        res.end( JSON.stringify({'error': true}) )
    });
})

app.post('/pickupItem', function (req, res) {
    var bodyStr = '';
    req.on('data',function(chunk){
        bodyStr += chunk.toString();
        if (bodyStr.length > 1e6) { 
            // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
            req.connection.destroy();
        }
    });
    req.on('end',function () {
        var currentPlayer = getCurrentPlayer(req)
        var inventar = currentPlayer.inventar
        if (inventar < maxInventarSize - 1) {
            var mapPoints = findMapPoints(currentPlayer.x, currentPlayer.y)
            var itemsOnGround = mapPoints[0].onground
            for (var index = 0; index < itemsOnGround.length; index++) {
                if (itemsOnGround[index] == bodyStr) {
                    // found item

                    // add item to current player
                    inventar.push(itemsOnGround[index])

                    // remove item
                    itemsOnGround.splice(index, 1)
                    res.end( JSON.stringify(currentPlayer) )
                }
            }
        } else {
            res.end( JSON.stringify({'error': true, 'message': 'Du kannst das nicht aufheben. Du hast zu viele Sachen bei dir!'}) )
        }

        res.end( JSON.stringify({'error': true, 'message': 'Das hat nicht funktioniert.'}) )
    });
})

// map generator
app.get('/generateMap', function (req, res) {
    var map = []
    
    for (var index = 0; index < 100 * globalScale; index++) {
        if (randomNumber(1,2) == 1) {
            var grasSprite = 'Gras1.gif'
        } else {
            var grasSprite = 'Gras2.gif'
        }
        var gras = new mapItem (generateCords('x'), generateCords('y'), 'Gras', 'Umgebung', false, false, grasSprite)
        if (gras) {
            map.push(gras)
        }
    }
    
    for (var index = 0; index < 50; index++) {
        var tree = new mapItem (generateCords('x'), generateCords('y'), 'Baum', 'Umgebung', true, true, 'Tree1.gif')
        if (tree) {
            map.push(tree)
        }
    }
    
    for (var index = 0; index < 30; index++) {
        if (randomNumber(1,2) == 1) {
            var stone = new mapItem (generateCords('x'), generateCords('y'), 'Stein', 'Umgebung', true, false, 'Stone1.gif')
        } else {
            var stone = new mapItem (generateCords('x'), generateCords('y'), 'Stein', 'Umgebung', false, true, 'Stone2.gif')
        }
        
        if (stone) {
            map.push(stone)
        }
    }
    cachedFiles['map.json'] = map
    res.end( 'map generiert' );
})

// helper
function randomNumber (min, max) {
	return Math.floor((Math.random() * max) + min);
}

function cleanName (input) {
    return input.replace(/\W+/g, '');
}

function errorObject (errormessage) {
    var error = {
        'error': errormessage
    }
    return error;
}

function select (id, source) {
    for (var object in source) {
        if (object == id) {
            console.log(source + ' info id: '+ object)
            return source[object];
        }
    }
    return errorObject('not found');    
}

function findMapPoints (x, y) {
    var map = cachedFiles['map.json']
    var result = []
    
    for (var index = 0; index < map.length; index++) {
        if (map[index].x == x && map[index].y == y) {
            result.push(map[index]);
        }
    }
    return result || false;
}

function findMapPlayers (x, y) {
    var players = cachedFiles['players.json']
    var result = []
    for (var index = 0; index < players.length; index++) {
        if (players[index].x == x && players[index].y == y) {
            result.push(players[index])
        }
    }
    return result;
}

function findMapEnemy (x, y) {
    var enemies = cachedFiles['enemies.json']
    var result = []
    for (var index = 0; index < enemies.length; index++) {
        if (enemies[index].x == x && enemies[index].y == y) {
            result.push(enemies[index])
        }
    }
    return result;
}

function isBlocked (x, y) {
    var map = cachedFiles['map.json']
    var result = []

    for (var index = 0; index < map.length; index++) {
        if (map[index].x == x && map[index].y == y && map[index].blocked) {
            return true;
        }
    }

    if (x < 0 || y < 0) {
        return true;
    }
    return false;
}

function cleanTraps () {
    if (cachedFiles['map.json']) {
        var mapPoints = cachedFiles['map.json']
        for (var index = 0; index < mapPoints.length; index++) {
            if (mapPoints[index].type == 'Falle' && mapPoints[index].lifetime) {
                mapPoints[index].lifetime--
            }
            if (mapPoints[index].lifetime <= 0) {
                mapPoints.splice(index,1)
            }
        }
    }

    setTimeout(cleanTraps, 1000)
}

function getCurrentPlayer (req, loginToken) {
    var tokens = cachedFiles['tokens.json']
    var token = req.cookies.token || loginToken
    for (var index = 0; index < tokens.length; index++) {
        if (tokens[index].token == token) {
            var players = cachedFiles['players.json']
            for (var userIndex = 0; userIndex < players.length; userIndex++) {
                if (players[userIndex].id == tokens[index].id) {
                    // console.log('auth true')
                    return players[userIndex];
                }
            }
        }
    }
    return false;
}

function generateCords (type) {
    var map = cachedFiles['map.json']
	// check if not used
	var x = randomNumber(1, maxSize)
	var y = randomNumber(1, maxSize)

	for (var index = 0; index < map.length; index++) {
		if (map[index].x === x && map[index].y === y) {
            x = randomNumber(1, maxSize)
            y = randomNumber(1, maxSize)
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

function mapItem (x, y, name, type, interaction, blocked, sprite, needTool, buttonText) {
    this.id = cachedFiles['globalIDs.json'].lastid
	this.name = name
	this.type = type
    this.buttonText = buttonText
	this.blocked = blocked || false
	this.needTool = needTool || "",
	this.x = x
    this.y = y
    this.sprites = {'default': sprite}
    cachedFiles['globalIDs.json'].lastid++
}

function newPlayer (x, y) {
    this.id = cachedFiles['globalIDs.json'].lastid
    this.life = 100
    this.energy = 60
    this.type = 'Player'
    this.x = x
    this.y = y
    if (randomNumber(1,2) == 1) {
        this.team = 'ROBOT'
        this.sprites = {
            "default": allRobotSprites[randomNumber(0, allRobotSprites.length)]
        }
    } else {
        this.team = "SCIENTIST"
        this.sprites = {
            "default": allScientistSprites[randomNumber(0, allScientistSprites.length)]
        }
    }
    cachedFiles['globalIDs.json'].lastid++
}

function getCookie (req, cookiename) {
  // Get name followed by anything except a semicolon
  var cookiestring = RegExp(""+cookiename+"[^;]+").exec(req.cookies);
  // Return everything after the equal sign, or an empty string if the cookie name not found
  return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./,"") : "");
}

function eventStarter () {

}

// data saver
function saveDB () {
    allFiles.forEach(function (filename) {
        try {
            if (typeof cachedFiles[filename] !== 'undefined' && typeof JSON.stringify(cachedFiles[filename]) == 'string') {
                // console.log(JSON.stringify(cachedFiles[filename]))
                fs.writeFile(__dirname + '/files/' + filename, JSON.stringify(cachedFiles[filename]), function (err) {
                    if (err) { return console.log(err); }
                    console.log('DB saved: '+ filename)
                });
            }
        } catch (err) {
            console.log('WRITE ERROR! ' + err);
        }

    })

    setTimeout(saveDB, discSaver)
}
saveDB()
cleanTraps()

// server
var server = app.listen(process.env.PORT || 1337, function () {
    // nothing
})