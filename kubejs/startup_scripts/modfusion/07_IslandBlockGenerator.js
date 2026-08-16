// 真正放置方块

var BlockPos =
Java.loadClass(
"net.minecraft.core.BlockPos"
)



global.IslandBlockGenerator={



generate:function(level,island){


console.log(
"[ModFusion] Generating island blocks"
)

var radius =
island.radius



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



var dist =
Math.sqrt(
x*x+z*z
)



if(
dist>radius
)
continue



var factor =
1-dist/radius



var height =
Math.floor(
factor*island.height
)



for(
var y=0;
y<height;
y++
){


var blockState
if(
y==height-1
)
{

blockState =
Block.getBlock(
"minecraft:grass_block"
)
.defaultBlockState()


}

else if(
y>height-6
)
{

blockState =
Block.getBlock(
"minecraft:dirt"
)
.defaultBlockState()


}

else
{

blockState =
Block.getBlock(
"minecraft:stone"
)
.defaultBlockState()


}

var pos =
BlockPos.containing(
island.x+x,
island.y-y,
island.z+z
)


level.getChunk(
pos.getX() >> 4,
pos.getZ() >> 4
)


level.setBlock(
pos,
blockState,
3
)



}



}



}



console.log(
"[ModFusion] Island block generation finished"
)



}



}