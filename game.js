var kill = new Audio();
window.requestAnimFrame = (function() {
	return window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.moxRequestAnimationFrame ||
	window.oRequestAnimationFrame ||
	window.msRequestAnimationFrame ||
	function(callback, element) {
		window.setTimeout(callback, 1000/60);
	};
})();

function distance(x1, y1, x2, y2) {
	return Math.sqrt(((x1 - x2) * (x1 - x2)) + ((y1 - y2) * (y1 - y2)))
}

function AssetManager() {
	this.successCount = 0;
	this.errorCount = 0;
	this.cache = {};
	this.downloadQueue = [];
}

AssetManager.prototype.queueDownload = function(path) {
	this.downloadQueue.push(path);
}

AssetManager.prototype.isDone = function() {
	return (this.downloadQueue.length == this.successCount + this.errorCount);
}

AssetManager.prototype.downloadAll = function(callback) {
	for (var i = 0; i < this.downloadQueue.length; i++) {
		var path = this.downloadQueue[i];
		var img = new Image();
		var that = this;
		img.addEventListener("load", function() {
			that.successCount += 1;
			if (that.isDone()) { callback(); }
		});
		img.addEventListener("error", function() {
			that.errorCount += 1;
			if (that.isDone()) { callback(); }
		});
		img.src = path;
		this.cache[path] = img;
	}
}

AssetManager.prototype.getAsset = function(path) {
	return this.cache[path];
}

function Timer() {
	this.gameTime = 0;
	this.maxStep = 0.05;
	this.wallLastTimestamp = 0;
}

Timer.prototype.tick = function() {
	var wallCurrent = Date.now();
	var wallDelta = (wallCurrent - this.wallLastTimestamp) / 1000;
	this.wallLastTimestamp = wallCurrent;

	var gameDelta = Math.min(wallDelta, this.maxStep);
	this.gameTime += gameDelta;
	return gameDelta;
}

function Score() {
	this.kills = 0;
	this.saves = 0;
}

Score.prototype.getScore = function() {
	return (this.saves - this.kills);
}

function GameEngine () {
	this.entities = [];
	this.ctx = null;
	this.click = null;
	this.mouse = null;
	this.timer = new Timer();
	this.score = new Score();
	this.surfaceWidth = null;
	this.surfaceHeight = null;
	this.halfSurfaceWidth = null;
	this.halfSurfaceHeight = null;
}

GameEngine.prototype.init = function(ctx) {
	console.log('game initialized');
	this.ctx = ctx;
	this.surfaceWidth = this.ctx.canvas.width;
	this.surfaceHeight = this.ctx.canvas.height;
	this.halfSurfaceWidth = this.surfaceWidth/2;
	this.halfSurfaceHeight = this.surfaceHeight/2;
	this.startInput();
}

GameEngine.prototype.start = function() {
	console.log("starting game");
	var that = this;
	(function gameLoop() {
		that.loop();
		requestAnimFrame(gameLoop, that.ctx.canvas);
	})();
}

GameEngine.prototype.startInput = function() {
	var getXandY = function(e) {
		var x = e.clientX - that.ctx.canvas.getBoundingClientRect().left;
		var y = e.clientY - that.ctx.canvas.getBoundingClientRect().top;
		return {x: x, y: y}
	}
	var that = this;

	this.ctx.canvas.addEventListener("click", function(e) {
		that.click = getXandY(e);
		e.stopPropagation();
		e.preventDefault();
	}, false);

	this.ctx.canvas.addEventListener("mousemove", function(e) {
		that.mouse = getXandY(e);
	}, false);
}

GameEngine.prototype.addEntity = function(entity) {
	this.entities.push(entity);
}

GameEngine.prototype.draw = function(callback) {
	this.ctx.clearRect(0,0, this.ctx.canvas.width, this.ctx.canvas.height);
	this.ctx.save();
	for (var i = 0; i < this.entities.length; i++) {
		this.entities[i].draw(this.ctx);
	}
	this.cowboy.draw(this.ctx);
	if (callback) {
		callback(this);
	}
	this.ctx.restore();
	document.getElementById('score').innerHTML = "Score: " + this.score.getScore();
}

GameEngine.prototype.update = function() {
	var entitiesCount = this.entities.length;
	for (var i= 0; i < entitiesCount; i++) {
		var entity = this.entities[i];
		if (!entity.removeFromWorld) {
			entity.update();
		}
	}
	for (var i = this.entities.length-1; i >= 0; --i) {
		if (this.entities[i].removeFromWorld) {
			this.entities.splice(i, 1);
		}
	}
}

GameEngine.prototype.collision = function() {
	for (var i = 3; i < this.entities.length; i++) {
		var entity = this.entities[i];
		// collision with cowboy
		if (entity.collides && distance(entity.x, entity.y, this.cowboy.x, this.cowboy.y) < entity.radius + this.cowboy.radius) {
			this.entities[i].removeFromWorld = true;
			this.addEntity(new Blood(this, entity.x, entity.y));
			this.score.kills++;
			kill.play();
		}
		// collision with pen
		if (distance(entity.x, entity.y, this.pen.x, this.pen.y) < entity.radius + this.pen.radius) {
			this.entities[i].removeFromWorld = true;
			this.score.saves++;
		}
		if (entity.x > this.surfaceWidth) {
			this.entities[i].x = this.surfaceWidth-1;
		} else if (entity.x < 0) {
			this.entities[i].x = 1;
		}
		if (entity.y > this.surfaceHeight) {
			this.entities[i].y = this.surfaceHeight-1;
		} else if (entity.y < 0) {
			this.entities[i].y = 1;
		}
	}
}
		

GameEngine.prototype.loop = function() {
	this.clockTick = this.timer.tick();
	this.update();
	this.collision();
	this.draw();
	this.click = null;
}

function Entity(game, x, y) {
	this.game = game;
	this.x = x;
	this.y = y;
	this.removeFromWorld = false;
}

Entity.prototype.update = function() {
}

Entity.prototype.draw = function(ctx) {
	if (this.showOutlines && this.radius) {
		ctx.beginPath();
		ctx.strokeStyle = "green";
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2, false);
		ctx.stroke();
		ctx.closePath();
	}
}

Entity.prototype.drawSpriteCentered = function(ctx) {
	if (this.sprite && this.x && this.y) {
		var x = this.x - this.sprite.width/2;
		var y = this.y - this.sprite.height/2;
		ctx.drawImage(this.sprite, x, y);
	}
}

function Cat(game, x, y) {
	Entity.call(this, game);
	this.x = x;
	this.y = y;
	this.angle = 2 * Math.random() * Math.PI
	this.collides = true;
	this.speed = 150;
	this.sprite = ASSET_MANAGER.getAsset('res/cat.png');
	this.radius = this.sprite.height/2;
	this.showOutlines = true;
}

Cat.prototype = new Entity();
Cat.prototype.constructor = Cat;

Cat.prototype.setCoords = function(dx, dy) {
	this.x = this.x + dx;
	this.y = this.y + dy;
}

Cat.prototype.update = function() {
	if (distance(this.game.cowboy.x, this.game.cowboy.y, this.x, this.y) < 150) {
		this.angle = Math.atan2(this.y - this.game.cowboy.y, this.x - this.game.cowboy.x);
	} else {
		this.angle += -(Math.PI/4) + (Math.random() * Math.PI/2)
	}
	dx = Math.cos(this.angle) * this.speed * this.game.clockTick;
	dy = Math.sin(this.angle) * this.speed * this.game.clockTick;
	this.setCoords(dx, dy);

	Entity.prototype.update.call(this);
}

Cat.prototype.draw = function(ctx) {
	this.drawSpriteCentered(ctx);
	Entity.prototype.draw.call(this, ctx);
}

function Blood(game, x, y) {
	Entity.call(this, game);
	this.x = x;
	this.y = y;
	this.sprite = ASSET_MANAGER.getAsset('res/blood.png');
	this.radius = this.sprite.width/2;
}
Blood.prototype = new Entity();
Blood.prototype.constructor = Blood;

Blood.prototype.draw = function(ctx) {
	this.drawSpriteCentered(ctx);
	Entity.prototype.draw.call(this, ctx)
}

function Background(game) {
	Entity.call(this,game, 0, 0);
	this.sprite = ASSET_MANAGER.getAsset('res/background.png');
}
Background.prototype = new Entity();
Background.prototype.constructor = Background;

Background.prototype.draw = function(ctx) {
	ctx.drawImage(this.sprite, this.x, this.y)
}

function Pen(game) {
	Entity.call(this,game, 400, 300);
	this.sprite = ASSET_MANAGER.getAsset('res/pen.png');
	this.radius = this.sprite.width/2;
	this.showOutlines = true;
}
Pen.prototype = new Entity();
Pen.prototype.constructor = Pen;

Pen.prototype.draw = function(ctx) {
	this.drawSpriteCentered(ctx);
	Entity.prototype.draw.call(this, ctx)
}

function Cowboy(game, x, y) {
	Entity.call(this, game);
	this.x = this.game.halfSurfaceWidth;
	this.y = this.game.halfSurfaceHeight;
	this.speed = 300;
	this.sprite = ASSET_MANAGER.getAsset('res/cowboy.png');
	this.radius = this.sprite.height/2;
	this.showOutlines = true;
}
Cowboy.prototype = new Entity();
Cowboy.prototype.constructor = Cowboy;

Cowboy.prototype.update = function() {
	if (this.game.mouse) {
		var mousex = this.game.mouse.x, mousey = this.game.mouse.y;
		this.angle = Math.atan2(this.y - this.game.mouse.y, this.x - this.game.mouse.x);
		if (this.angle < 0) {
			this.angle += Math.PI * 2;
		}
		if (distance(mousex, mousey, this.x, this.y) > 5) {
			this.x -= Math.cos(this.angle) * this.speed * this.game.clockTick;
			this.y -= Math.sin(this.angle) * this.speed * this.game.clockTick;
		}
	}
	Entity.prototype.update.call(this);
}

Cowboy.prototype.draw = function(ctx) {
	this.drawSpriteCentered(ctx);
	Entity.prototype.draw.call(this, ctx);
}

function CatWrangler() {
	GameEngine.call(this);
}

CatWrangler.prototype = new GameEngine();
CatWrangler.prototype.constructor = CatWrangler;

CatWrangler.prototype.start = function() {
	this.background = new Background(this);
	this.addEntity(this.background);
	this.pen = new Pen(this);
	this.addEntity(this.pen);
	this.cowboy = new Cowboy(this);
	this.addEntity(this.cowboy);
	GameEngine.prototype.start.call(this);
}

CatWrangler.prototype.update = function() {
	if (this.lastCatAddedAt == null || (this.timer.gameTime - this.lastCatAddedAt) > 2) {
		this.addEntity(new Cat(this, Math.random() * this.surfaceWidth, Math.random() * this.surfaceHeight));
		this.lastCatAddedAt = this.timer.gameTime;
	}

	GameEngine.prototype.update.call(this);
}

CatWrangler.prototype.draw = function() {
	GameEngine.prototype.draw.call(this);
}

// MAIN

var canvas = document.getElementById('screen');
var ctx = canvas.getContext('2d');
var game = new CatWrangler();
var ASSET_MANAGER = new AssetManager();

ASSET_MANAGER.queueDownload('res/cat.png');
ASSET_MANAGER.queueDownload('res/blood.png');
ASSET_MANAGER.queueDownload('res/cowboy.png');
ASSET_MANAGER.queueDownload('res/pen.png');
ASSET_MANAGER.queueDownload('res/background.png');
kill.src = 'res/kill.wav';
ASSET_MANAGER.downloadAll(function() {
	game.init(ctx);
	game.start();
});
