var map = []
var userToken = ''
var globalScale = 32
var currentPlayer = {}
var currentPlayerisMoving = false

var boxShadowEffect = "0px 0px 3px 1px"
var actionTimeout = 0
var imagePath = '/sprites/'

function setup() {
    checkPlayer()
    // max map size
    document.getElementById('map').style.width = globalScale +"000px"
    document.getElementById('map').style.height = globalScale + "000px"
    document.onkeydown = function (e) {
        e = e || window.event;
        if (!currentPlayer.isMoving) {
            switch(e.which || e.keyCode) {
                case 37:
                    playerMove('LEFT')
                    break
        
                case 38:
                    playerMove('UP')
                    break
        
                case 39:
                    playerMove('RIGHT')
                    break
        
                case 40:
                    playerMove('DOWN')
                    break
        
                default: return;
            }
        }
        e.preventDefault()
    }
    window.addEventListener('resize', function () {
        scrollToElement(document.getElementById(currentPlayer.id))
    });
    updateMapLoop()
}

function checkPlayer() {
    try {
        var token = document.cookie.split('token=')[1].split(';')[0] || false
        // check login
        if (token) {
            requestAPI("POST", "/checkLogin", function (result) {
                // no error?
                currentPlayer = result
                userToken = token
                document.getElementById('loginform').style.display = "none"
                updateMap()
                focus()
            }, 'token='+ token)
        } else {
            // document.getElementById('loginform').style.display = "block"
        }
    } catch(err) {
        // request new player
        requestAPI("GET", "/newPlayer", function (result) {
            if (result.token) {
                setCookie("token", result.token, 365)
                setTimeout(checkPlayer, 500);
            }
        })
        
        // login form
        // document.getElementById('loginform').style.display = "block"
    }
}

function login () {
    userToken = document.querySelector('#loginform input').value
    requestAPI("POST", "/checkLogin", function (result) {
        // no error?
        currentPlayer = result
        setCookie("token", userToken, 365)
        // save cookie
        document.getElementById('loginform').style.display = "none"
        // start game
        updateMap()
        initGame()
    }, 'token='+ userToken)
}

function getCurrentPlayer () {
    var token = document.cookie.split('token=')[1].split(';')[0] || false
    requestAPI("POST", "/checkLogin", function (result) {
        // no error?
        currentPlayer = result
    }, 'token='+ token)
}

function updateMapLoop () {
    // request map
    requestAPI('GET', '/map', function (data) {
        if (data.length > 0) {
            // render
            renderMap(data)
        }
    })
    setTimeout(updateMapLoop, 1000)
}

function updateMap ()  {
    // request map
    requestAPI('GET', '/map', function (data) {
        if (data.length > 0) {
            // render
            renderMap(data)
        }
    })
}

function renderMap (mapdata) {
    // invalidate all points
    var map = document.querySelectorAll('#map div')
    for (var index = 0; index < map.length; index++) {
        map[index].setAttribute('invalid', true)
    }

    // build new map
    var mapItemList = []
    for (var index = 0; index < mapdata.length; index++) {
        var mapItem = mapdata[index]
        var element = document.createElement('div')
        element.fulldata = mapItem
        element.id = mapItem.id
        if (mapItem.type !== 'Player') {
            // umgebung
            element.classList.add(mapItem.type)
            element.classList.add(mapItem.name)
            element.title = mapItem.name
            //element.setAttribute('uID', mapItem.id)
        } else {
            // player
            element.classList.add(mapItem.type)
            element.classList.add(mapItem.team)
        }

        // load default sprites
        if (mapItem.sprites.default) {
            var image = document.createElement('img')
            image.src = imagePath + mapItem.sprites.default
            element.appendChild(image)
        }

        // full update user
        if (currentPlayer.id == mapItem.id) {
            currentPlayer = mapItem
            element.style.left = mapItem.x * globalScale + randomNumber(-5,5) + "px"
            element.style.top = mapItem.y * globalScale + randomNumber(-5,5) + "px"
        } else {
            element.style.left = mapItem.x * globalScale + "px"
            element.style.top = mapItem.y * globalScale + "px"
        }
        
        mapItemList.push(element)
    }

    // find and rerender point
    for (var index = 0; index < mapItemList.length; index++) {
        var point = document.querySelector('#map div[id="'+ mapItemList[index].id +'"]')
        if (point) {
            document.querySelector('#map div[id="'+ mapItemList[index].id +'"]').removeAttribute('invalid')
            //document.querySelector('#map div[id="'+ mapItemList[index].id +'"]').outerHTML = mapItemList[index].outerHTML
            document.querySelector('#map div[id="'+ mapItemList[index].id +'"]').style.top = mapItemList[index].style.top
            document.querySelector('#map div[id="'+ mapItemList[index].id +'"]').style.left = mapItemList[index].style.left
            document.querySelector('#map div[id="'+ mapItemList[index].id +'"]').fulldata = mapItemList[index].fulldata
        } else {
            document.getElementById('map').insertAdjacentElement('afterbegin', mapItemList[index])
        }
    }

    // remove all invalid points
    var points = document.querySelectorAll('#map div[invalid="true"]')
    for (var index = 0; index < points.length; index++) {
        points[index].style.opacity = 0
        setTimeout(function(element) {
            return function() { element.remove() }
        } (points[index]), 2000)
    }
    
    document.getElementById('energy').textContent = currentPlayer.energy

    // update map
    // for (var index = 0; index < mapItemList.length; index++) {
    //     var item = mapItemList[index]
    //     document.getElementById('map').insertAdjacentElement('beforeend', item)
    // }
    //scrollToElement(document.getElementById(currentPlayer.id))

    document.getElementById('x').textContent = currentPlayer.x
    document.getElementById('y').textContent = currentPlayer.y
}

function action (type) {
    // request
    requestAPI('POST', '/action', function (data) {
        updateMap()
    }, type)
}

function playerMove (direction) {
    if (!currentPlayerisMoving) {
        // disable moving
        currentPlayerisMoving = true
        document.getElementById('move'+ direction).style.boxShadow = boxShadowEffect
        var inputs = document.querySelectorAll('#controls input')
        for (var index = 0; index < inputs.length; index++) {
            inputs[index].setAttribute('disabled', 'disabled')
        }

        var playerElement = document.getElementById(currentPlayer.id)
        // move animation
        if (currentPlayer.sprites.move) {
            playerElement.querySelector('img').src = imagePath + currentPlayer.sprites.move
        }
        
        // request
        switch (direction) {
            case 'UP':
                playerMoveDirection('UP')
                break
            case 'LEFT':
                playerElement.querySelector('img').style.transform = ''
                playerMoveDirection('LEFT')
                break
            case 'RIGHT':
                playerElement.querySelector('img').style.transform = 'scale(-1, 1)'
                playerMoveDirection('RIGHT')
                break
            case 'DOWN':
                playerMoveDirection('DOWN')
                break
        }
        
        // reset animation
        setTimeout(function () {
            document.getElementById('move'+ direction).style.boxShadow = ''
            var inputs = document.querySelectorAll('#controls input')
            for (var index = 0; index < inputs.length; index++) {
                inputs[index].removeAttribute('disabled')
            }
            playerElement.querySelector('img').src = imagePath + currentPlayer.sprites.default
            currentPlayerisMoving = false
        }, actionTimeout)
    }
}

function playerMoveDirection (direction) {
    // request
    requestAPI('POST', '/move', function (data) {
        updateMap()
    }, direction)
}

function checkOptions () {
    // clear options
    var allOptions = document.querySelectorAll('#options .options div')
    for (var index = 0; index < allOptions.length; index++) {
        allOptions[index].innerHTML = ''
    }
    
    var map = document.querySelectorAll('#map div')
    for (var index = 0; index < map.length; index++) {
        var point = map[index]
        if (point.fulldata.x == currentPlayer.x && point.fulldata.y == currentPlayer.y) {
            // material crafting
            if (point.fulldata.type == "Umgebung" && point.fulldata.interaction && hasItem(point.fulldata.needTool)) {
                newOption ("interact", point.fulldata.buttonText)
            }

            // check material and build


            // check pickup items
            /*var itemOnGround = point.fulldata.onground || []
            for (var itemIndex = 0; itemIndex < itemOnGround.length; itemIndex++ ) {
                newPickup (itemOnGround[itemIndex], itemOnGround[itemIndex] +" mitnehmen")
            }*/
        }
    }

    // display all items
    /*var inventar = currentPlayer.inventar
    for (var index = 0; index < inventar.length; index++) {
        displayInventar (inventar[index])
    }*/
}

function newOption (action, text) {
    var optionHTML = '<input type="button" onclick="requestAction(this, \''+ action +'\')" value="'+ text +'"/><br/>'
    document.querySelector('#options .options #top').insertAdjacentHTML('beforeend', optionHTML)
}

function displayInventar (itemName) {
    var HTML = '<p><span>'+ itemName +'</span> <span class="drop" onclick="requestDropItem(this, \''+ itemName +'\')">DROP</span></p>'
    document.querySelector('#options .options #right').insertAdjacentHTML('beforeend', HTML)
}

function newPickup (itemName, text) {
    var HTML = '<input type="button" onclick="requestPickup(this, \''+ itemName +'\')" value="'+ text +'"/><br/>'
    document.querySelector('#options .options #left').insertAdjacentHTML('beforeend', HTML)
}

// requests
function requestAction (element, action) {
    // element animation
    currentPlayerisMoving = true
    playerAnimation('work', 5000)
    setTimeout(function () {
        requestAPI('POST', '/action', function (result) {
            if (result) {
                currentPlayerisMoving = false
                updateMap()
            }
        }, action)
    }, 4900)
}

function requestPickup (element, name) {
    // element animation
    requestAPI('POST', '/pickupItem', function (result) {
        if (result && !result.error) {
            currentPlayer = result
            updateMap()
        }
    }, name)
}

function requestDropItem (element, itemName) {
    requestAPI('POST', '/dropItem', function (result) {
        if (result && !result.error) {
            currentPlayer = result
            updateMap()
        } else {
            message(result.message)
        }
    }, itemName)
}

// helper
function toggleMENU () {
    var options = document.getElementById('options')
    options.classList.toggle('open')
    if (options.classList.contains('open')) {
        document.getElementById('togglemenue').textContent = "<"
    } else {
        document.getElementById('togglemenue').textContent = ">"
    }
}

function message (text) {
    try {
        var messageBox = document.getElementById('message')
        messageBox.textContent = text || "Ein Fehler ist aufgetreten..."
        messageBox.classList.add('open')
        setTimeout(function () {
            messageBox.textContent = ''
            messageBox.classList.remove('open')
            }, 15000)
    } catch(err) {
        console.log(err)
    }
}

function playerAnimation (type, timeout) {
    if (currentPlayer.sprites[type]) {
        var playerElement = document.getElementById(currentPlayer.id)
        playerElement.style.top = playerElement.offsetTop + 3 + 'px'
        playerElement.style.left = playerElement.offsetLeft + 7 + 'px'
        playerElement.querySelector('img').src = imagePath + currentPlayer.sprites[type]
        setTimeout(function () {
            playerElement.style.top = playerElement.offsetTop - 3 + 'px'
            playerElement.style.left = playerElement.offsetLeft - 7 + 'px'
            playerElement.querySelector('img').src = imagePath + currentPlayer.sprites.default
        }, timeout || 5000)
    }
}

function randomNumber (min, max) {
	return Math.floor((Math.random() * max) + min);
}

function focus () {
    scrollToElement(document.getElementById(currentPlayer.id))
    setTimeout(focus, 16);
}

function hasItem (checkItem) {
    try {
        var inventar = currentPlayer.inventar
        for (var index = 0; index < inventar.length; index++) {
            if (checkItem == inventar[index]) {
                return true;
            }
        }
    } catch(err) {
        console.log(err)
        return false;
    }
}

function setCookie (cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function scrollToElement (element) {
    if (element) {
        var offset = 0
        if (window.innerWidth >= 1000) {
            //offset = parseInt(window.innerWidth * 0.15)
        }
        var container = document.getElementById('container')
        container.scrollTop = element.offsetTop - window.innerHeight / 2
        container.scrollLeft = element.offsetLeft - window.innerWidth / 2 + offset
    }
}

function requestAPI (method, url, callback, params) {
    var xmlhttp = new XMLHttpRequest()
    xmlhttp.open(method, url, true)
    xmlhttp.overrideMimeType('application/json')
    xmlhttp.onload = function () {
        if (this.readyState == 4 && this.status == 200) {
            var result = JSON.parse(this.responseText)
            callback(result)
        } else {
            document.cookie = 'token=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            setTimeout(function () {
                document.location.reload()
            }, 5000)
            message('SORRY! ERROR = '+ this.status +'.')
            console.log(this.responseText)
        }
    }
    xmlhttp.send(params || '')
}

setup()