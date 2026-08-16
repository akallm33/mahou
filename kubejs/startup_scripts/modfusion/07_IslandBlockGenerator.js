// 真正放置方块

var BlockPos=
Java.loadClass(
"net.minecraft.core.BlockPos"
)



global.IslandBlockGenerator={



generate:function(level,island){



console.log(
"[ModFusion] Generating island:",
island.x,
island.z
)



var radius=
Math.floor(
island.radius
)



for(
var x=-radius;
x<=radius;
x++
){


for(
var z=-radius;
z<=radius;
z++
){



var distance=
Math.sqrt(
x*x+z*z
)



if(
distance>radius
)
continue



// 中心厚，边缘薄

var factor=
1-distance/radius



var height=
Math.floor(
factor*island.height
)



for(
var y=0;
y<height;
y++
){


var state



if(
y==height-1
)
{

state=
Block.getBlock(
"minecraft:grass_block"
)
.defaultBlockState()


}

else if(
y>height-5
)
{

state=
Block.getBlock(
"minecraft:dirt"
)
.defaultBlockState()


}

else
{

state=
Block.getBlock(
"minecraft:stone"
)
.defaultBlockState()


}



var pos=
BlockPos.containing(
island.x+x,
island.y-y,
island.z+z
)



level.getChunk(
pos.getX()>>4,
pos.getZ()>>4
)



level.setBlock(
pos,
state,
3
)



}


}



}



console.log(
"[ModFusion] Island finished"
)



}



}