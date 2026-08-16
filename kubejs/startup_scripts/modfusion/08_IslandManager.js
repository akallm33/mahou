// 负责岛屿数量、随机位置、防碰撞

console.log(
"[ModFusion] Loading IslandManager"
)



global.IslandManager={


generated:false,


islands:[],



// ====================
// 主入口
// ====================

generate:function(level){



if(this.generated)
{

console.log(
"[ModFusion] Islands already generated"
)

return

}



this.generated=true



var cfg=
global.FusionConfig



console.log(
"[ModFusion] Generating island cluster"
)



var attempts=0



while(
this.islands.length < cfg.islandCount
&&
attempts < 1000
){

attempts++



var island =
this.createRandomIsland()



if(
this.checkCollision(island)
)
{

continue

}



this.islands.push(
island
)



console.log(
"[Island]",
this.islands.length,
"x:",
island.x,
"z:",
island.z,
"r:",
island.radius
)



global.IslandBlockGenerator.generate(
level,
island
)



}



console.log(
"[ModFusion] Generated islands:",
this.islands.length
)


},




// ====================
// 创建随机岛
// ====================


createRandomIsland:function(){


var cfg=global.FusionConfig

var x;
var z;

do{


x=Math.floor(
(
Math.random()*2-1
)
*
cfg.generationRange
)


z=Math.floor(
(
Math.random()*2-1
)
*
cfg.generationRange
)



}
while(

Math.sqrt(
x*x+z*z
)
<
cfg.spawnProtectionRadius

)



var levelRoll=Math.random();


var y;


if(levelRoll<0.5)
{

y=
140+
Math.floor(
Math.random()*30
)

}

else if(levelRoll<0.85)
{

y=
180+
Math.floor(
Math.random()*40
)

}

else
{

y=
230+
Math.floor(
Math.random()*50
)

}



var radius=
cfg.minRadius+
Math.random()
*
(
cfg.maxRadius-cfg.minRadius
)



var height=
Math.floor(
radius*0.45
)
+
Math.floor(
Math.random()*10
)



return new global.Island({

x:x,

y:y,

z:z,

radius:radius,

height:height

})
},




// ====================
// 防碰撞
// ====================


checkCollision:function(island){


for(
var i=0;
i<this.islands.length;
i++
){

if(
island.isOverlap(
this.islands[i]
)
)
{

return true

}

}


return false


}



}



console.log(
"[ModFusion] IslandManager loaded"
)